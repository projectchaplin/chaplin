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
    const production = await pageState(cdp, ["CHARACTER PRODUCTION PIPELINE", "Seedance 1.5 Pro needs account activation", "Generate dialogue", "Generate 5-second video"]);
    checks.push(result("Production studio at 390px", production.required && !production.overflow, pageDetail(production)));

    await cdp.send("Network.setCookie", {
      name: "chaplin-demo-role",
      value: "admin",
      url: baseUrl,
      path: "/",
    });
    await cdp.navigate(`${baseUrl}/admin`);
    const admin = await pageState(cdp, ["ADMIN CONTROL ROOM", "Video pipeline action required", "Generation spend", "Recent generation activity"]);
    checks.push(result("Admin control room at 390px", admin.required && !admin.overflow, pageDetail(admin)));

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
