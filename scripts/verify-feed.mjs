import { spawn } from "node:child_process";
import { access, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const baseUrl = process.env.FEED_BASE_URL ?? "http://127.0.0.1:3000";
const chromeCandidates = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  path.join(process.env.LOCALAPPDATA ?? "", "Google", "Chrome", "Application", "chrome.exe"),
];
const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

class Cdp {
  constructor(url) { this.socket = new WebSocket(url); this.id = 1; this.pending = new Map(); this.events = new Map(); }
  async connect() {
    await new Promise((resolve, reject) => { this.socket.addEventListener("open", resolve, { once: true }); this.socket.addEventListener("error", reject, { once: true }); });
    this.socket.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data));
      if (message.id) {
        const pending = this.pending.get(message.id); if (!pending) return; this.pending.delete(message.id);
        return message.error ? pending.reject(new Error(message.error.message)) : pending.resolve(message.result);
      }
      for (const listener of this.events.get(message.method) ?? []) listener(message.params);
      this.events.delete(message.method);
    });
  }
  send(method, params = {}) { const id = this.id++; return new Promise((resolve, reject) => { this.pending.set(id, { resolve, reject }); this.socket.send(JSON.stringify({ id, method, params })); }); }
  wait(method) { return new Promise((resolve, reject) => { const timer = setTimeout(() => reject(new Error(`Timed out waiting for ${method}`)), 10000); const listener = (params) => { clearTimeout(timer); resolve(params); }; this.events.set(method, [...(this.events.get(method) ?? []), listener]); }); }
  async evaluate(expression) { const response = await this.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true }); if (response.exceptionDetails) throw new Error(response.exceptionDetails.text); return response.result.value; }
  async navigate(url) { const loaded = this.wait("Page.loadEventFired"); await this.send("Page.navigate", { url }); await loaded; await sleep(1000); }
  close() { this.socket.close(); }
}

async function firstExisting() {
  for (const candidate of chromeCandidates) { try { await access(candidate); return candidate; } catch { /* next */ } }
  throw new Error("Chrome is not installed in a known location.");
}

async function main() {
  const directory = await mkdtemp(path.join(os.tmpdir(), "chaplin-feed-qa-"));
  const profile = path.join(directory, "profile");
  const chrome = spawn(await firstExisting(), ["--headless=new", "--disable-gpu", "--hide-scrollbars", "--remote-debugging-port=0", `--user-data-dir=${profile}`, "about:blank"], { stdio: "ignore" });
  let cdp;
  try {
    let port;
    for (let attempt = 0; attempt < 80; attempt += 1) {
      try { [port] = (await readFile(path.join(profile, "DevToolsActivePort"), "utf8")).trim().split(/\r?\n/); if (port) break; } catch { await sleep(100); }
    }
    if (!port) throw new Error("Chrome did not expose its debugging port.");
    const pages = await fetch(`http://127.0.0.1:${port}/json/list`).then((response) => response.json());
    cdp = new Cdp(pages.find((item) => item.type === "page").webSocketDebuggerUrl);
    await cdp.connect();
    await Promise.all([cdp.send("Page.enable"), cdp.send("Runtime.enable")]);

    await cdp.send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await cdp.navigate(`${baseUrl}/feed`);
    let mobile;
    for (let attempt = 0; attempt < 20; attempt += 1) {
      mobile = await cdp.evaluate(`(() => ({ text: document.body.innerText, width: window.innerWidth, scrollWidth: document.documentElement.scrollWidth, posts: document.querySelectorAll("[data-feed-post]").length, composer: Boolean(document.querySelector("[data-feed-composer]")), authCta: document.body.innerText.toLowerCase().includes("sign in or create account") }))()`);
      if (mobile.posts >= 4) break;
      await sleep(250);
    }
    const required = ["chaplin creators", "feed", "actors", "create", "watch", "studio"];
    const lowerText = mobile.text.toLowerCase();
    const missing = required.filter((text) => !lowerText.includes(text));
    if (mobile.scrollWidth > mobile.width || mobile.posts < 4 || (!mobile.composer && !mobile.authCta) || missing.length) {
      throw new Error(`The shared mobile feed did not render correctly: ${mobile.width}/${mobile.scrollWidth}px, ${mobile.posts} posts, composer=${mobile.composer}, authCta=${mobile.authCta}, missing=${missing.join("|")}.`);
    }
    const mobileCapture = await cdp.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
    const mobileImage = path.join(directory, "feed-mobile.png");
    await writeFile(mobileImage, Buffer.from(mobileCapture.data, "base64"));

    await cdp.send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
    await cdp.navigate(`${baseUrl}/`);
    const landing = await cdp.evaluate(`(() => ({ text: document.body.innerText, width: window.innerWidth, scrollWidth: document.documentElement.scrollWidth, cards: document.querySelectorAll("a[href^='/characters/']").length, gallery: Boolean(document.querySelector("[aria-label='AI actor gallery']")) }))()`);
    if (landing.scrollWidth > landing.width || !landing.text.includes("Ready to cast AI actors for") || !landing.text.includes("Open Feed") || landing.cards < 12 || !landing.gallery) throw new Error("The character-gallery homepage did not render correctly.");
    const desktopCapture = await cdp.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
    const desktopImage = path.join(directory, "landing-desktop.png");
    await writeFile(desktopImage, Buffer.from(desktopCapture.data, "base64"));

    console.log(`Mobile feed: ${mobile.posts} posts, ${mobile.width}px viewport, ${mobile.scrollWidth}px content`);
    console.log(`Persistent navigation: Feed · Actors · Create · Watch · Studio`);
    console.log(`Homepage is an infinite character gallery with direct Feed access.`);
    console.log(`Screenshots: ${mobileImage} | ${desktopImage}`);
  } finally {
    cdp?.close(); chrome.kill();
  }
}

main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
