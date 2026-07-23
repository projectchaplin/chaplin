import { spawn } from "node:child_process";
import { access, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const baseUrl = process.env.CREATE_ORB_BASE_URL ?? "http://127.0.0.1:3000";
const chromeCandidates = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  path.join(process.env.LOCALAPPDATA ?? "", "Google", "Chrome", "Application", "chrome.exe"),
];
const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

class Cdp {
  constructor(url) {
    this.socket = new WebSocket(url);
    this.id = 1;
    this.pending = new Map();
    this.events = new Map();
  }
  async connect() {
    await new Promise((resolve, reject) => {
      this.socket.addEventListener("open", resolve, { once: true });
      this.socket.addEventListener("error", reject, { once: true });
    });
    this.socket.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data));
      if (message.id) {
        const pending = this.pending.get(message.id);
        if (!pending) return;
        this.pending.delete(message.id);
        return message.error ? pending.reject(new Error(message.error.message)) : pending.resolve(message.result);
      }
      for (const listener of this.events.get(message.method) ?? []) listener(message.params);
      this.events.delete(message.method);
    });
  }
  send(method, params = {}) {
    const id = this.id++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }
  wait(method) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`Timed out waiting for ${method}`)), 10000);
      const listener = (params) => {
        clearTimeout(timer);
        resolve(params);
      };
      this.events.set(method, [...(this.events.get(method) ?? []), listener]);
    });
  }
  async evaluate(expression) {
    const response = await this.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
    if (response.exceptionDetails) throw new Error(response.exceptionDetails.text);
    return response.result.value;
  }
  async navigate(url) {
    const loaded = this.wait("Page.loadEventFired");
    await this.send("Page.navigate", { url });
    await loaded;
    await sleep(800);
  }
  close() {
    this.socket.close();
  }
}

async function firstExisting() {
  for (const candidate of chromeCandidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // Try the next installed Chrome path.
    }
  }
  throw new Error("Chrome is not installed in a known location.");
}

async function main() {
  const directory = await mkdtemp(path.join(os.tmpdir(), "chaplin-create-orb-qa-"));
  const profile = path.join(directory, "profile");
  const chrome = spawn(
    await firstExisting(),
    [
      "--headless=new",
      "--disable-gpu",
      "--remote-debugging-port=0",
      `--user-data-dir=${profile}`,
      "about:blank",
    ],
    { stdio: "ignore" },
  );
  let cdp;
  try {
    let port;
    for (let attempt = 0; attempt < 80; attempt += 1) {
      try {
        [port] = (await readFile(path.join(profile, "DevToolsActivePort"), "utf8")).trim().split(/\r?\n/);
        if (port) break;
      } catch {
        await sleep(100);
      }
    }
    if (!port) throw new Error("Chrome did not expose its debugging port.");
    const pages = await fetch(`http://127.0.0.1:${port}/json/list`).then((response) => response.json());
    cdp = new Cdp(pages.find((item) => item.type === "page").webSocketDebuggerUrl);
    await cdp.connect();
    await Promise.all([cdp.send("Page.enable"), cdp.send("Runtime.enable")]);
    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width: 390,
      height: 844,
      deviceScaleFactor: 1,
      mobile: true,
    });

    await cdp.navigate(`${baseUrl}/`);
    await cdp.evaluate(`document.querySelector('[aria-label="Switch demo login and role"]')?.click()`);
    await sleep(120);
    await cdp.evaluate(`document.querySelector('[data-quick-view="maker"]')?.click()`);
    await sleep(180);
    await cdp.evaluate(`document.querySelector("[data-create-toggle]")?.click()`);
    await sleep(350);
    const create = await cdp.evaluate(`(() => {
      const panel = document.querySelector("[data-concierge]");
      const rect = panel?.getBoundingClientRect();
      return {
        mode: panel?.getAttribute("data-mode"),
        choices: [...document.querySelectorAll("[data-create-choice]")].map((node) => node.getAttribute("data-create-choice")),
        pushToTalk: Boolean(document.querySelector("[data-push-to-talk]")),
        pushToTalkCount: document.querySelectorAll("[data-push-to-talk]").length,
        draftFirst: Boolean(document.querySelector("[data-continue-drafts]")),
        bottomOrbOwnsVoice: document.querySelector("[data-create-toggle]")?.hasAttribute("data-push-to-talk") ?? false,
        withinViewport: Boolean(rect && rect.left >= 0 && rect.right <= innerWidth && rect.top >= 0 && rect.bottom <= innerHeight),
        voiceSessionRequests: performance.getEntriesByType("resource").filter((entry) => entry.name.includes("/api/agent/voice-session")).length,
        overflow: document.documentElement.scrollWidth > innerWidth,
        brandedScrollbar: Boolean(
          panel?.classList.contains("chaplin-scrollbar") &&
          getComputedStyle(panel).scrollbarColor !== "auto"
        ),
      };
    })()`);
    if (
      create.mode !== "push-to-talk" ||
      !create.choices.includes("actor") ||
      !create.choices.includes("video") ||
      !create.pushToTalk ||
      create.pushToTalkCount !== 1 ||
      !create.draftFirst ||
      !create.bottomOrbOwnsVoice ||
      !create.withinViewport ||
      create.voiceSessionRequests !== 0 ||
      create.overflow ||
      !create.brandedScrollbar
    ) {
      throw new Error(`Create orb failed: ${JSON.stringify(create)}`);
    }

    await cdp.evaluate(`(() => {
      window.__intentCalls = 0;
      window.__mockIntent = {
        intent: "unclear",
        name: null,
        archetypes: [],
        characterBrief: null,
        storyBrief: null,
        reply: "Tell me one character or video idea."
      };
      const realFetch = window.fetch.bind(window);
      window.fetch = (input, init) => {
        if (String(input).includes("/api/agent/intent")) {
          window.__intentCalls += 1;
          if (window.__mockHtmlIntent) {
            return Promise.resolve(new Response("<!DOCTYPE html><title>Rebuilding</title>", {
              status: 503,
              headers: { "Content-Type": "text/html" }
            }));
          }
          return Promise.resolve(new Response(JSON.stringify(window.__mockIntent), {
            status: 200,
            headers: { "Content-Type": "application/json" }
          }));
        }
        return realFetch(input, init);
      };
      window.SpeechSynthesisUtterance = class {
        constructor(text) { this.text = text; this.onend = null; this.onerror = null; }
      };
      window.speechSynthesis.cancel = () => {};
      window.speechSynthesis.getVoices = () => [];
      window.speechSynthesis.speak = (utterance) => setTimeout(() => utterance.onend?.(), 10);
      class MockRecognition {
        constructor() {
          this.lang = "";
          this.continuous = false;
          this.interimResults = true;
          this.onstart = null;
          this.onresult = null;
          this.onerror = null;
          this.onend = null;
        }
        start() {
          this.onstart?.();
          setTimeout(() => this.onresult?.({
            results: [Object.assign([{ transcript: "I want to make a funny delivery hero" }], { isFinal: true })]
          }), 20);
        }
        stop() { setTimeout(() => this.onend?.(), 10); }
        abort() { this.onend?.(); }
      }
      window.SpeechRecognition = MockRecognition;
      window.webkitSpeechRecognition = MockRecognition;
      const button = document.querySelector("[data-push-to-talk]");
      button?.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true }));
      setTimeout(() => button?.dispatchEvent(new KeyboardEvent("keyup", { key: " ", bubbles: true })), 80);
      return true;
    })()`);
    await sleep(1500);
    const pushToTalk = await cdp.evaluate(`(() => ({
      intentCalls: window.__intentCalls,
      conversation: document.querySelector("[data-agent-line]")?.parentElement?.textContent,
      agentLine: document.querySelector("[data-agent-line]")?.textContent,
      state: document.querySelector("[data-push-to-talk]")?.getAttribute("data-orb-state"),
      voiceSessionRequests: performance.getEntriesByType("resource").filter((entry) => entry.name.includes("/api/agent/voice-session")).length,
    }))()`);
    if (
      pushToTalk.intentCalls !== 1 ||
      !pushToTalk.conversation?.includes("funny delivery hero") ||
      !pushToTalk.agentLine?.includes("Tell me one character or video idea") ||
      pushToTalk.state !== "idle" ||
      pushToTalk.voiceSessionRequests !== 0
    ) {
      throw new Error(`Push-to-talk lifecycle failed: ${JSON.stringify(pushToTalk)}`);
    }

    await cdp.evaluate(`document.querySelector("[data-concierge] button[aria-label='Close']")?.click()`);
    await sleep(180);
    await cdp.evaluate(`(() => {
      const orb = document.querySelector("[data-create-toggle]");
      orb?.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true }));
      setTimeout(() => orb?.dispatchEvent(new KeyboardEvent("keyup", { key: " ", bubbles: true })), 160);
    })()`);
    await sleep(600);
    const directHold = await cdp.evaluate(`(() => ({
      panelOpen: Boolean(document.querySelector("[data-concierge]")),
      intentCalls: window.__intentCalls,
      state: document.querySelector("[data-push-to-talk]")?.getAttribute("data-orb-state"),
    }))()`);
    if (!directHold.panelOpen || directHold.intentCalls !== 2 || directHold.state !== "idle") {
      throw new Error(`Closed-orb hold failed: ${JSON.stringify(directHold)}`);
    }

    await cdp.evaluate(`(() => {
      window.__mockHtmlIntent = true;
      const input = document.querySelector("[data-concierge-input]");
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      setter?.call(input, "A hero caught in a rainstorm");
      input?.dispatchEvent(new Event("input", { bubbles: true }));
      input?.closest("form")?.requestSubmit();
    })()`);
    await sleep(350);
    const htmlFailure = await cdp.evaluate(`(() => ({
      line: document.querySelector("[data-agent-line]")?.textContent,
      leakedHtml: document.body.innerText.includes("<!DOCTYPE") || document.body.innerText.includes("Unexpected token"),
      state: document.querySelector("[data-push-to-talk]")?.getAttribute("data-orb-state"),
    }))()`);
    if (
      htmlFailure.leakedHtml ||
      !htmlFailure.line?.includes("briefly unavailable") ||
      htmlFailure.state !== "idle"
    ) {
      throw new Error(`HTML response boundary failed: ${JSON.stringify(htmlFailure)}`);
    }
    await cdp.evaluate(`window.__mockHtmlIntent = false`);

    const capture = await cdp.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
    const createScreenshot = path.join(directory, "create-orb-mobile.png");
    await writeFile(createScreenshot, Buffer.from(capture.data, "base64"));

    await cdp.evaluate(`document.querySelector('[data-create-choice="video"]')?.click()`);
    await sleep(1200);
    const videoHandoff = await cdp.evaluate(`(() => ({
      path: location.pathname,
      format: new URLSearchParams(location.search).get("format"),
      auto: new URLSearchParams(location.search).get("auto"),
      magicOpen: document.querySelector("[data-magic-writer]")?.hasAttribute("open"),
      manualSteps:
        document.body.innerText.includes("1. Concept") &&
        document.body.innerText.includes("2. Cast") &&
        Boolean(document.querySelector('[data-script-field="title"]')),
    }))()`);
    if (
      videoHandoff.path !== "/studio/write" ||
      videoHandoff.format !== "punch" ||
      videoHandoff.auto !== null ||
      videoHandoff.magicOpen ||
      !videoHandoff.manualSteps
    ) {
      throw new Error(`Video hand-off failed: ${JSON.stringify(videoHandoff)}`);
    }

    console.log(JSON.stringify({
      create,
      pushToTalk,
      directHold,
      htmlFailure,
      videoHandoff,
      createScreenshot,
    }, null, 2));
  } finally {
    cdp?.close();
    chrome.kill();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
