import { spawn } from "node:child_process";
import { access, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const baseUrl = process.env.CHAPLIN_BASE_URL ?? "http://127.0.0.1:3000";
const chromeCandidates = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  path.join(process.env.LOCALAPPDATA ?? "", "Google", "Chrome", "Application", "chrome.exe"),
];

async function firstExisting(paths) {
  for (const candidate of paths) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // Try the next location.
    }
  }
  throw new Error("Google Chrome was not found.");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function debugPort(profile) {
  const file = path.join(profile, "DevToolsActivePort");
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      const [port] = (await readFile(file, "utf8")).trim().split(/\r?\n/);
      if (port) return Number(port);
    } catch {
      // Chrome is starting.
    }
    await sleep(100);
  }
  throw new Error("Chrome did not expose its debug port.");
}

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
        if (message.error) pending.reject(new Error(message.error.message));
        else pending.resolve(message.result);
        return;
      }
      for (const listener of this.events.get(message.method) ?? []) listener(message.params);
    });
  }

  send(method, params = {}) {
    const id = this.id++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  on(method, listener) {
    this.events.set(method, [...(this.events.get(method) ?? []), listener]);
  }

  async evaluate(expression) {
    const response = await this.send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (response.exceptionDetails) throw new Error(response.exceptionDetails.text ?? "Browser evaluation failed.");
    return response.result.value;
  }

  async navigate(url) {
    await this.send("Page.navigate", { url });
    for (let attempt = 0; attempt < 80; attempt += 1) {
      const state = await this.evaluate("document.readyState");
      if (state === "complete") break;
      await sleep(100);
    }
    await sleep(900);
  }

  close() {
    this.socket.close();
  }
}

function check(name, passed, detail) {
  return { name, passed: Boolean(passed), detail };
}

async function waitFor(cdp, expression, attempts = 40) {
  let value;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    value = await cdp.evaluate(expression);
    if (value?.ready) return value;
    await sleep(250);
  }
  return value;
}

async function pageMetrics(cdp) {
  return cdp.evaluate(`(() => ({
    width: window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
    overflow: document.documentElement.scrollWidth > window.innerWidth,
    text: document.body.innerText,
  }))()`);
}

async function main() {
  const chromePath = await firstExisting(chromeCandidates);
  const tempRoot = path.resolve(os.tmpdir());
  const profile = await mkdtemp(path.join(tempRoot, "chaplin-current-ui-"));
  if (!path.resolve(profile).startsWith(`${tempRoot}${path.sep}`)) throw new Error("Unsafe Chrome profile path.");
  const chrome = spawn(chromePath, [
    "--headless=new",
    "--disable-gpu",
    "--hide-scrollbars",
    "--no-first-run",
    "--no-default-browser-check",
    "--remote-debugging-port=0",
    `--user-data-dir=${profile}`,
    "about:blank",
  ], { stdio: "ignore" });

  let cdp;
  try {
    const port = await debugPort(profile);
    const targets = await fetch(`http://127.0.0.1:${port}/json/list`).then((response) => response.json());
    const page = targets.find((item) => item.type === "page");
    if (!page?.webSocketDebuggerUrl) throw new Error("Chrome did not expose a page.");
    cdp = new Cdp(page.webSocketDebuggerUrl);
    await cdp.connect();
    const runtimeErrors = [];
    const consoleErrors = [];
    cdp.on("Runtime.exceptionThrown", (event) => runtimeErrors.push(event.exceptionDetails?.text ?? "Runtime exception"));
    cdp.on("Runtime.consoleAPICalled", (event) => {
      if (event.type !== "error") return;
      const message = (event.args ?? [])
        .map((argument) => argument.value ?? argument.description ?? "")
        .filter(Boolean)
        .join(" ");
      consoleErrors.push(message || "Console error");
    });
    cdp.on("Log.entryAdded", (event) => {
      if (event.entry?.level === "error") consoleErrors.push(event.entry.text || "Browser log error");
    });
    await Promise.all([
      cdp.send("Page.enable"),
      cdp.send("Runtime.enable"),
      cdp.send("Log.enable"),
      cdp.send("Network.enable"),
      cdp.send("Emulation.setDeviceMetricsOverride", {
        width: 390,
        height: 844,
        deviceScaleFactor: 1,
        mobile: true,
      }),
    ]);

    const checks = [];
    await cdp.navigate(`${baseUrl}/`);
    const home = await waitFor(cdp, `(() => {
      const text = document.body.innerText.toUpperCase();
      const cards = document.querySelectorAll('[data-hero-character-id]').length;
      const videos = document.querySelectorAll('[data-home-video="active"] video').length;
      return { ready: text.includes('THE WORLD OF AI ACTORS') && cards >= 10 && videos === 1, cards, videos };
    })()`);
    const homeMetrics = await pageMetrics(cdp);
    checks.push(check("Scroll-preview homepage", home.ready && !homeMetrics.overflow, `${home.cards} stable cards · ${home.videos} active video`));
    const touchPreview = await cdp.evaluate(`(() => {
      const cards = [...document.querySelectorAll('[data-home-video-ready="true"]')];
      const target = cards.find((card) => card.dataset.homeVideo !== 'active');
      if (!target) return { ready: false, reason: 'no inactive playable card' };
      const id = target.dataset.heroCharacterId;
      target.querySelector('a')?.click();
      return {
        ready: true,
        id,
        before: {
          top: target.offsetTop,
          left: target.offsetLeft,
          width: target.offsetWidth,
          height: target.offsetHeight,
        },
      };
    })()`);
    await sleep(900);
    const touchPreviewAfter = touchPreview.ready
      ? await cdp.evaluate(`(() => {
          const target = document.querySelector('[data-hero-character-id="${touchPreview.id}"]');
          if (!target) return { active: false, stable: false };
          return {
            active: target.dataset.homeVideo === 'active' && Boolean(target.querySelector('video')),
            stable:
              Math.abs(target.offsetTop - ${touchPreview.before.top}) < 1 &&
              Math.abs(target.offsetLeft - ${touchPreview.before.left}) < 1 &&
              Math.abs(target.offsetWidth - ${touchPreview.before.width}) < 1 &&
              Math.abs(target.offsetHeight - ${touchPreview.before.height}) < 1,
          };
        })()`)
      : { active: false, stable: false };
    checks.push(check(
      "In-place touch preview",
      touchPreview.ready && touchPreviewAfter.active && touchPreviewAfter.stable,
      touchPreview.ready ? `active ${touchPreviewAfter.active} · layout stable ${touchPreviewAfter.stable}` : touchPreview.reason,
    ));
    if (process.env.CHAPLIN_UI_SCREENSHOT) {
      const screenshot = await cdp.send("Page.captureScreenshot", {
        format: "png",
        captureBeyondViewport: false,
      });
      await writeFile(path.resolve(process.env.CHAPLIN_UI_SCREENSHOT), Buffer.from(screenshot.data, "base64"));
    }

    await cdp.navigate(`${baseUrl}/characters`);
    const shelf = await waitFor(cdp, `(() => {
      const text = document.body.innerText;
      const cards = document.querySelectorAll('a[href^="/characters/"]').length;
      return { ready: text.includes('Lightning Raju') && text.includes('Maah Dehbi') && cards >= 10, cards };
    })()`);
    const shelfMetrics = await pageMetrics(cdp);
    checks.push(check("Shared actor shelf", shelf.ready && !shelfMetrics.overflow, `${shelf.cards} actor links · ${shelfMetrics.scrollWidth}px content`));

    await cdp.navigate(`${baseUrl}/feed`);
    const feed = await waitFor(cdp, `(() => {
      const posts = document.querySelectorAll('[data-feed-post]').length;
      const media = document.querySelectorAll('[data-feed-post] img, [data-feed-post] video').length;
      return { ready: posts > 0 && media > 0, posts, media };
    })()`, 60);
    const feedMetrics = await pageMetrics(cdp);
    checks.push(check("Creator feed", feed.ready && !feedMetrics.overflow, `${feed.posts} posts · ${feed.media} visible media`));

    await cdp.navigate(`${baseUrl}/create`);
    const create = await waitFor(cdp, `(() => {
      const text = document.body.innerText;
      const links = [...document.querySelectorAll('main a[href]')].filter((item) => /create an actor|create a spark|create a punch|create an episode/i.test(item.innerText)).length;
      return { ready: text.includes('BUILD A PERFORMER') && links === 4, links };
    })()`);
    const createMetrics = await pageMetrics(cdp);
    checks.push(check("Creator output desk", create.ready && !createMetrics.overflow, `${create.links} output choices`));

    await cdp.navigate(`${baseUrl}/characters/c-bramble`);
    const actor = await waitFor(cdp, `(() => {
      const workflow = document.querySelector('[data-production-workflow]');
      const stages = document.querySelectorAll('[data-production-step-jump]').length;
      const media = document.querySelectorAll('[data-media-player]').length;
      const history = Boolean(document.querySelector('[data-generation-history]'));
      return { ready: Boolean(workflow) && stages === 6 && media >= 3 && history, stages, media, history };
    })()`, 60);
    const actorMetrics = await pageMetrics(cdp);
    checks.push(check("Actor production studio", actor.ready && !actorMetrics.overflow, `${actor.stages} stages · ${actor.media} media players · history ${actor.history}`));

    await cdp.navigate(`${baseUrl}/studio/write?format=punch&cast=c-selene`);
    const writing = await waitFor(cdp, `(() => {
      const magic = Boolean(document.querySelector('[data-action="magic-script"]'));
      const cast = document.querySelectorAll('[data-magic-cast] button[aria-pressed]').length;
      const timeline = document.querySelectorAll('[data-writing-step]').length;
      return { ready: magic && cast > 0, magic, cast, timeline };
    })()`);
    const writingMetrics = await pageMetrics(cdp);
    checks.push(check("Writing room", writing.ready && !writingMetrics.overflow, `Magic ${writing.magic} · ${writing.cast} cast options`));

    const login = await cdp.evaluate(`fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'admin-login', email: 'chaplin@chaplin.in', password: 'chaplin' })
    }).then(async (response) => ({ status: response.status, data: await response.json() }))`);
    checks.push(check("Browser Super Admin login", login.status === 200 && login.data?.identity?.role === "admin", `HTTP ${login.status}`));

    await cdp.navigate(`${baseUrl}/admin/logs`);
    const logs = await waitFor(cdp, `(() => {
      const text = document.body.innerText;
      return { ready: text.includes('GENERATION LOGS') && text.includes('Complete history') && Boolean(document.querySelector('[data-admin-generation-logs]')) };
    })()`, 80);
    const logsMetrics = await pageMetrics(cdp);
    checks.push(check("Admin generation logs", logs.ready && !logsMetrics.overflow, `${logsMetrics.scrollWidth}px content`));

    await cdp.navigate(`${baseUrl}/admin/pipeline`);
    const pipeline = await waitFor(cdp, `(() => {
      const text = document.body.innerText;
      return { ready: text.includes('PRODUCTION SYSTEM') && text.includes('Writing & direction') && text.includes('Signature SFX') && text.includes('Video') };
    })()`, 80);
    const pipelineMetrics = await pageMetrics(cdp);
    checks.push(check("Admin pipeline controls", pipeline.ready && !pipelineMetrics.overflow, `${pipelineMetrics.scrollWidth}px content`));
    checks.push(check("No uncaught browser exceptions", runtimeErrors.length === 0, runtimeErrors.length ? runtimeErrors.join(" · ") : "clean runtime"));
    const consoleErrorSummary = consoleErrors
      .map((message) => message.replace(/\s+/g, " ").slice(0, 280))
      .join(" · ");
    checks.push(check("No browser console errors", consoleErrors.length === 0, consoleErrors.length ? consoleErrorSummary : "clean console"));

    console.table(checks);
    const failures = checks.filter((item) => !item.passed);
    if (failures.length) {
      if (consoleErrors.length) console.error(JSON.stringify({ consoleErrors }, null, 2));
      throw new Error(`${failures.length} current UI verification check${failures.length === 1 ? "" : "s"} failed.`);
    }
    console.log("Current Chaplin mobile-width product and admin UI verified in real Chrome.");
  } finally {
    cdp?.close();
    chrome.kill();
    await sleep(300);
    await rm(profile, { recursive: true, force: true }).catch(() => undefined);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
