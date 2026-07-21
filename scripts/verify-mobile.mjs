import { spawn } from "node:child_process";
import { access, mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const baseUrl = process.env.MOBILE_BASE_URL ?? "http://127.0.0.1:3100";
const candidates = process.platform === "win32"
  ? [
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
      "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
      path.join(process.env.LOCALAPPDATA ?? "", "Google", "Chrome", "Application", "chrome.exe"),
    ]
  : ["/usr/bin/google-chrome", "/usr/bin/chromium", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"];

async function firstExisting(paths) {
  for (const candidate of paths) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // Try the next known Chrome location.
    }
  }
  throw new Error("Google Chrome was not found. Set up Chrome before running mobile verification.");
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function waitForDebugPort(profileDir) {
  const file = path.join(profileDir, "DevToolsActivePort");
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const [port] = (await readFile(file, "utf8")).trim().split(/\r?\n/);
      if (port) return Number(port);
    } catch {
      // Chrome has not finished starting.
    }
    await sleep(100);
  }
  throw new Error("Chrome did not expose its debugging port.");
}

class CdpClient {
  constructor(url) {
    this.socket = new WebSocket(url);
    this.nextId = 1;
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
        if (message.error) pending.reject(new Error(message.error.message));
        else pending.resolve(message.result);
        return;
      }
      const listeners = this.events.get(message.method) ?? [];
      for (const listener of listeners) listener(message.params);
      this.events.delete(message.method);
    });
  }

  send(method, params = {}) {
    const id = this.nextId;
    this.nextId += 1;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  waitFor(method, timeoutMs = 10000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`Timed out waiting for ${method}`)), timeoutMs);
      const listener = (params) => {
        clearTimeout(timer);
        resolve(params);
      };
      this.events.set(method, [...(this.events.get(method) ?? []), listener]);
    });
  }

  async evaluate(expression) {
    const result = await this.send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text ?? "Browser evaluation failed.");
    return result.result.value;
  }

  async navigate(url) {
    const loaded = this.waitFor("Page.loadEventFired");
    await this.send("Page.navigate", { url });
    await loaded;
    await sleep(1200);
  }

  close() {
    this.socket.close();
  }
}

function result(name, passed, detail) {
  return { name, passed: Boolean(passed), detail };
}

async function pageState(cdp, requiredText) {
  let state;
  for (let attempt = 0; attempt < 24; attempt += 1) {
    state = await cdp.evaluate(`(() => {
      const text = document.body.innerText;
      const expected = ${JSON.stringify(requiredText)};
      return {
        required: expected.every((value) => text.includes(value)),
        missing: expected.filter((value) => !text.includes(value)),
        width: window.innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
        overflow: document.documentElement.scrollWidth > window.innerWidth,
        url: window.location.href,
      };
    })()`);
    if (state.required) return state;
    await sleep(250);
  }
  return state;
}

function pageDetail(state) {
  const size = `${state.width}px viewport · ${state.scrollWidth}px content`;
  return state.missing?.length ? `${size} · missing: ${state.missing.join(", ")} · ${state.url}` : size;
}

async function main() {
  const chromePath = await firstExisting(candidates);
  const systemTemp = path.resolve(os.tmpdir());
  const profileDir = await mkdtemp(path.join(systemTemp, "chaplin-mobile-qa-"));
  if (!path.resolve(profileDir).startsWith(`${systemTemp}${path.sep}`)) {
    throw new Error("Refusing to use a Chrome profile outside the system temporary directory.");
  }

  const chrome = spawn(chromePath, [
    "--headless=new",
    "--disable-gpu",
    "--hide-scrollbars",
    "--no-first-run",
    "--no-default-browser-check",
    "--remote-debugging-port=0",
    `--user-data-dir=${profileDir}`,
    "about:blank",
  ], { stdio: "ignore" });

  let cdp;
  try {
    const port = await waitForDebugPort(profileDir);
    const pages = await fetch(`http://127.0.0.1:${port}/json/list`).then((response) => response.json());
    const page = pages.find((item) => item.type === "page");
    if (!page?.webSocketDebuggerUrl) throw new Error("Chrome did not expose a page target.");

    cdp = new CdpClient(page.webSocketDebuggerUrl);
    await cdp.connect();
    await Promise.all([
      cdp.send("Page.enable"),
      cdp.send("Runtime.enable"),
      cdp.send("Network.enable"),
      cdp.send("Emulation.setDeviceMetricsOverride", {
        width: 390,
        height: 844,
        deviceScaleFactor: 1,
        mobile: true,
      }),
    ]);
    await cdp.send("Network.setCookie", {
      name: "chaplin-demo-role",
      value: "admin",
      url: baseUrl,
      path: "/",
    });

    const checks = [];

    await cdp.navigate(`${baseUrl}/`);
    const caster = await pageState(cdp, ["CASTING FOR", "AI ACTORS", "Browse AI Characters", "Create a Casting"]);
    checks.push(result("Caster homepage at 390px", caster.required && !caster.overflow, pageDetail(caster)));
    let homeBroll = null;
    for (let attempt = 0; attempt < 20; attempt += 1) {
      homeBroll = await cdp.evaluate(`(() => {
        const reel = document.querySelector("[data-home-broll]");
        const activeCard = reel?.closest("div.relative");
        const video = activeCard?.querySelector("video");
        return reel ? {
          videoSource: video?.currentSrc || video?.src || null,
          soundControl: Boolean(reel.querySelector('button[aria-label*="B-roll with sound"]')),
        } : null;
      })()`);
      if (homeBroll?.videoSource?.startsWith("https://")) break;
      await sleep(250);
    }
    checks.push(result(
      "Homepage uses persisted B-roll",
      homeBroll?.videoSource?.startsWith("https://"),
      homeBroll?.videoSource ? "active tile playing Supabase CDN video" : "active tile has no persisted video"
    ));

    const makerClicked = await cdp.evaluate(`(() => {
      const button = [...document.querySelectorAll("button")].find((item) => item.innerText.includes("MAKER"));
      if (!button) return false;
      button.click();
      return true;
    })()`);
    await sleep(500);
    const maker = await pageState(cdp, ["CREATE AND MONETIZE", "AI CHARACTERS", "Create an AI Actor", "Open Maker Studio"]);
    checks.push(result("Maker homepage at 390px", makerClicked && maker.required && !maker.overflow, pageDetail(maker)));

    await cdp.evaluate(`(() => {
      const key = "chaplin:v15";
      const snapshot = JSON.parse(localStorage.getItem(key));
      snapshot.activeRole = "admin";
      snapshot.currentUserId = "u-admin";
      localStorage.setItem(key, JSON.stringify(snapshot));
      document.cookie = "chaplin-demo-role=admin; path=/; max-age=31536000; SameSite=Lax";
      return true;
    })()`);
    await cdp.navigate(`${baseUrl}/characters/c-selene`);
    const production = await pageState(cdp, ["CHARACTER PRODUCTION PIPELINE", "Magic Scene", "Generate dialogue", "Generate 12-second theme", "Generate 5-second video", "Real generated assets attached"]);
    const brollState = await cdp.evaluate(`(() => {
      const reel = document.querySelector("[data-character-broll]");
      if (!reel) return null;
      return {
        video: Boolean(reel.querySelector("video")),
        audioTracks: reel.querySelectorAll("audio").length,
        soundControl: Boolean(reel.querySelector('button[aria-label*="b-roll with sound"]')),
        punchline: Boolean(document.querySelector("[data-broll-punchline]")),
      };
    })()`);
    checks.push(result(
      "Character B-roll intro",
      brollState?.video && brollState.audioTracks >= 2 && brollState.soundControl && brollState.punchline,
      brollState ? `video · ${brollState.audioTracks} synchronized audio tracks · punchline` : "B-roll reel not found"
    ));
    const sceneBefore = await cdp.evaluate(`(() => Object.fromEntries(
      [...document.querySelectorAll("[data-scene-field]")].map((field) => [field.dataset.sceneField, field.value])
    ))()`);
    const magicClicked = await cdp.evaluate(`(() => {
      const button = document.querySelector('[data-action="magic-scene"]');
      if (!button) return false;
      button.click();
      return true;
    })()`);
    await sleep(300);
    const sceneAfter = await cdp.evaluate(`(() => ({
      fields: Object.fromEntries(
        [...document.querySelectorAll("[data-scene-field]")].map((field) => [field.dataset.sceneField, field.value])
      ),
      label: document.body.innerText.includes("Midnight Escape"),
    }))()`);
    const coordinatedFields = ["dialogue", "sfx", "theme", "image", "video"];
    const sceneChanged =
      magicClicked &&
      sceneAfter.label &&
      coordinatedFields.every((field) => sceneBefore[field] && sceneAfter.fields[field] && sceneBefore[field] !== sceneAfter.fields[field]);
    checks.push(result(
      "Magic Scene coordinates prompts",
      sceneChanged,
      sceneChanged ? "dialogue · SFX · theme · still · video updated together" : "one or more scene fields did not update"
    ));
    const soundProfile = await cdp.evaluate(`(() => {
      const section = document.querySelector("#sound-profile");
      if (!section) return null;
      const players = [...section.querySelectorAll("audio")];
      return {
        players: players.length,
        persistentSources: players.filter((audio) => (audio.currentSrc || audio.src).startsWith("https://")).length,
        customPlayers: section.querySelectorAll("[data-media-player]").length,
        nativeControls: section.querySelectorAll("audio[controls], video[controls]").length,
        missing: section.innerText.includes("Not generated yet"),
      };
    })()`);
    checks.push(result(
      "Public Sound Profile assets",
      soundProfile?.players === 3 && soundProfile.persistentSources === 3 && soundProfile.customPlayers === 3 && soundProfile.nativeControls === 0 && !soundProfile.missing,
      soundProfile ? `${soundProfile.persistentSources}/${soundProfile.players} persistent custom players · ${soundProfile.nativeControls} native controls` : "Sound Profile not found"
    ));
    const historyState = await cdp.evaluate(`(() => {
      const history = document.querySelector("[data-generation-history]");
      if (!history) return null;
      return {
        cards: history.querySelectorAll("article").length,
        customPlayers: history.querySelectorAll("[data-media-player]").length,
        videos: history.querySelectorAll('[data-media-player="video"]').length,
        nativeControls: history.querySelectorAll("audio[controls], video[controls]").length,
        text: history.innerText.includes("Generated Scene Log"),
      };
    })()`);
    checks.push(result(
      "Replayable generated scene log",
      historyState?.text && historyState.cards > 0 && historyState.customPlayers > 0 && historyState.videos > 0 && historyState.nativeControls === 0,
      historyState ? `${historyState.cards} logged assets · ${historyState.customPlayers} replay players · ${historyState.videos} videos` : "Generated Scene Log not found"
    ));
    let videoState = null;
    for (let attempt = 0; attempt < 24; attempt += 1) {
      videoState = await cdp.evaluate(`(() => {
        const video = document.querySelector('[data-media-player="video"] video');
        return video ? {
          src: video.currentSrc || video.src,
          readyState: video.readyState,
          duration: video.duration,
          width: video.videoWidth,
          height: video.videoHeight,
          error: video.error?.message ?? null,
        } : null;
      })()`);
      if (videoState?.readyState >= 1 || videoState?.error) break;
      await sleep(250);
    }
    const videoLoaded =
      videoState?.src?.startsWith("https://") &&
      videoState.readyState >= 1 &&
      videoState.duration >= 4.5 &&
      videoState.duration <= 5.5 &&
      videoState.width > 0 &&
      videoState.height > 0 &&
      !videoState.error;
    checks.push(result(
      "Production video at 390px",
      production.required && !production.overflow && videoLoaded,
      `${pageDetail(production)} · ${videoState?.duration?.toFixed(2) ?? "?"}s ${videoState?.width ?? "?"}×${videoState?.height ?? "?"} · readyState ${videoState?.readyState ?? "missing"}`
    ));

    await cdp.send("Network.setCookie", {
      name: "chaplin-demo-role",
      value: "admin",
      url: baseUrl,
      path: "/",
    });
    await cdp.navigate(`${baseUrl}/admin/logs`);
    const admin = await pageState(cdp, ["GENERATION LOGS", "Complete history", "seedance-1-5-pro-251215"]);
    const adminHasSuccessfulSeedance = await cdp.evaluate(`(() => {
      const text = document.body.innerText.toLowerCase();
      return text.includes("seedance-1-5-pro-251215") && text.includes("succeeded");
    })()`);
    checks.push(result("Dedicated admin logs at 390px", admin.required && adminHasSuccessfulSeedance && !admin.overflow, pageDetail(admin)));

    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await cdp.navigate(`${baseUrl}/`);
    const switchPosition = await cdp.evaluate(`(() => {
      const control = document.querySelector('[aria-label="Choose how you want to use Chaplin"]');
      if (!control) return null;
      const rect = control.getBoundingClientRect();
      return {
        left: Math.round(rect.left),
        right: Math.round(rect.right),
        viewport: window.innerWidth,
        overflow: document.documentElement.scrollWidth > window.innerWidth,
      };
    })()`);
    checks.push(result(
      "Audience switch on desktop right",
      switchPosition && switchPosition.left > switchPosition.viewport / 2 && !switchPosition.overflow,
      switchPosition
        ? `${switchPosition.left}px–${switchPosition.right}px in ${switchPosition.viewport}px viewport`
        : "Audience switch not found"
    ));

    console.table(checks);
    const failures = checks.filter((check) => !check.passed);
    if (failures.length) throw new Error(`${failures.length} mobile verification check${failures.length === 1 ? "" : "s"} failed.`);
    console.log("Mobile role, production, and admin flows verified in real Chrome at 390px.");
  } finally {
    cdp?.close();
    chrome.kill();
    await sleep(300);
    await rm(profileDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
