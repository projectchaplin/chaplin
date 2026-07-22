import { spawn } from "node:child_process";
import { access, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const baseUrl = process.env.HEADER_BASE_URL ?? "http://127.0.0.1:3000";
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
  async navigate(url) { const loaded = this.wait("Page.loadEventFired"); await this.send("Page.navigate", { url }); await loaded; await sleep(700); }
  close() { this.socket.close(); }
}

async function firstExisting() {
  for (const candidate of chromeCandidates) { try { await access(candidate); return candidate; } catch { /* next */ } }
  throw new Error("Chrome is not installed in a known location.");
}

async function inspect(cdp) {
  return cdp.evaluate(`(() => {
    const header = document.querySelector("header[data-header-compact]");
    const wordmark = document.querySelector("[data-header-wordmark]");
    const logo = document.querySelector("[data-header-compact-mark]");
    const fullLogo = document.querySelector("[data-header-full-logo]");
    const profile = document.querySelector('button[aria-label="Switch demo login and role"]');
    return {
      compact: header?.dataset.headerCompact,
      headerHeight: header?.getBoundingClientRect().height,
      wordmarkOpacity: wordmark ? Number(getComputedStyle(wordmark).opacity) : -1,
      logoOpacity: logo ? Number(getComputedStyle(logo).opacity) : -1,
      logoWidth: logo?.getBoundingClientRect().width,
      fullLogoWidth: fullLogo?.getBoundingClientRect().width,
      profileVisible: Boolean(profile && profile.getBoundingClientRect().width > 0),
      width: window.innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
    };
  })()`);
}

async function runViewport(cdp, directory, name, width, height, mobile) {
  await cdp.send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile });
  await cdp.navigate(`${baseUrl}/feed`);
  const top = await inspect(cdp);
  const topCapture = await cdp.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
  const topOutput = path.join(directory, `header-${name}-top.png`);
  await writeFile(topOutput, Buffer.from(topCapture.data, "base64"));
  await cdp.evaluate("window.scrollTo(0, 360)");
  await sleep(900);
  const scrolled = await inspect(cdp);
  if (top.compact !== "false" || top.wordmarkOpacity < 0.95 || top.logoOpacity > 0.05) throw new Error(`${name}: full wordmark is not visible at the top.`);
  if (scrolled.compact !== "true" || scrolled.logoOpacity < 0.95 || scrolled.wordmarkOpacity > 0.05) throw new Error(`${name}: compact icon did not replace the wordmark.`);
  if (scrolled.headerHeight >= top.headerHeight || !scrolled.profileVisible || scrolled.scrollWidth > scrolled.width) throw new Error(`${name}: compact header geometry is incorrect.`);
  const capture = await cdp.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
  const output = path.join(directory, `header-${name}.png`);
  await writeFile(output, Buffer.from(capture.data, "base64"));
  return { top, scrolled, topOutput, output };
}

async function main() {
  const directory = await mkdtemp(path.join(os.tmpdir(), "chaplin-header-qa-"));
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
    const desktop = await runViewport(cdp, directory, "desktop", 1440, 900, false);
    const mobile = await runViewport(cdp, directory, "mobile", 390, 844, true);
    console.log(JSON.stringify({ desktop, mobile }, null, 2));
  } finally {
    cdp?.close(); chrome.kill();
  }
}

main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
