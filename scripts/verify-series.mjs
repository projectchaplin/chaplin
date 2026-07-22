import { spawn } from "node:child_process";
import { access, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const baseUrl = process.env.SERIES_BASE_URL ?? "http://127.0.0.1:3000";
const chromeCandidates = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  path.join(process.env.LOCALAPPDATA ?? "", "Google", "Chrome", "Application", "chrome.exe"),
];

const beats = [
  "Pattern-break hook", "Immediate consequence", "Actor makes a choice", "Obstacle answers",
  "New information", "Pressure closes in", "False win", "Cost of the win",
  "Irreversible move", "Truth is exposed", "Apparent resolution", "Cliffhanger reversal",
];
const actions = [
  "Vikrant sees the lighthouse beam stop in the middle of its sweep; his tea keeps trembling in its glass.",
  "He crosses to the dead control panel as a ship horn sounds far too close to the rocks.",
  "Vikrant breaks the station seal and reaches for the manual lamp key he swore never to use again.",
  "The key turns, but a second beam answers from the abandoned island across the channel.",
  "A coded rhythm in the answering beam matches the final signal his missing brother sent twelve years ago.",
  "Vikrant climbs the exterior ladder while monsoon spray drives across the tower and the horn grows louder.",
  "The manual lamp ignites and catches the cargo ship seconds before the reef.",
  "In the relit beam, a human silhouette appears inside the sealed lantern room behind Vikrant.",
  "He locks the lamp on course and turns away from the rescued ship toward the impossible intruder.",
  "The intruder places Vikrant's brother's brass compass on the floor between them.",
  "Vikrant takes one step forward as the figure removes a salt-stained hood.",
  "The face is Vikrant's own, older and scarred; it says the storm has already happened.",
];

async function json(url, init) {
  const response = await fetch(url, init);
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error ?? `${url} returned ${response.status}.`);
  return payload;
}

async function findChrome() {
  for (const candidate of chromeCandidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // Try the next installation path.
    }
  }
  throw new Error("Chrome is not installed in a known location.");
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
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
        return message.error ? pending.reject(new Error(message.error.message)) : pending.resolve(message.result);
      }
      for (const listener of this.events.get(message.method) ?? []) listener(message.params);
      this.events.delete(message.method);
    });
  }
  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }
  waitFor(method) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`Timed out waiting for ${method}.`)), 10000);
      const listener = (params) => { clearTimeout(timer); resolve(params); };
      this.events.set(method, [...(this.events.get(method) ?? []), listener]);
    });
  }
  async evaluate(expression) {
    const result = await this.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    return result.result.value;
  }
  close() { this.socket.close(); }
}

async function screenshot(url, width = 1440, height = 1000) {
  const chrome = await findChrome();
  const directory = await mkdtemp(path.join(os.tmpdir(), "chaplin-series-qa-"));
  const output = path.join(directory, "series-pilot.png");
  const profile = path.join(directory, "profile");
  const chromeProcess = spawn(chrome, ["--headless=new", "--disable-gpu", "--hide-scrollbars", "--remote-debugging-port=0", `--user-data-dir=${profile}`, "about:blank"], { stdio: "ignore" });
  let cdp;
  try {
    let port;
    for (let attempt = 0; attempt < 80; attempt += 1) {
      try {
        [port] = (await readFile(path.join(profile, "DevToolsActivePort"), "utf8")).trim().split(/\r?\n/);
        if (port) break;
      } catch { await sleep(100); }
    }
    if (!port) throw new Error("Chrome did not expose its debugging port.");
    const pages = await fetch(`http://127.0.0.1:${port}/json/list`).then((response) => response.json());
    cdp = new CdpClient(pages.find((item) => item.type === "page").webSocketDebuggerUrl);
    await cdp.connect();
    await Promise.all([cdp.send("Page.enable"), cdp.send("Runtime.enable")]);
    await cdp.send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: width < 600 });
    const loaded = cdp.waitFor("Page.loadEventFired");
    await cdp.send("Page.navigate", { url });
    await loaded;
    await sleep(1000);
    const layout = await cdp.evaluate("({ width: window.innerWidth, scrollWidth: document.documentElement.scrollWidth })");
    if (layout.scrollWidth > layout.width) throw new Error(`Series page overflows at ${width}px (${layout.scrollWidth}px content).`);
    const capture = await cdp.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
    await writeFile(output, Buffer.from(capture.data, "base64"));
    return { output, layout };
  } finally {
    cdp?.close();
    chromeProcess.kill();
  }
}

async function main() {
  const characters = (await json(`${baseUrl}/api/characters`)).characters;
  if (!characters.some((character) => character.id === "c-bramble")) {
    throw new Error("Captain Vikrant Suri is missing from the shared actor catalogue.");
  }

  const existing = (await json(`${baseUrl}/api/series`)).series.find((item) => item.title === "The Last Signal");
  let seriesId = existing?.id;
  if (!seriesId) {
    const shots = beats.map((beat, index) => ({
      beat,
      visualAction: actions[index],
      cameraDirection: index === 0
        ? "24mm low wide, locked for one second, then a precise push toward Vikrant."
        : index === 11
          ? "85mm close-up; hold still after the reveal."
          : "40mm shoulder-height coverage preserving screen direction toward the lantern room.",
      lightingDirection: "Motivated warm lighthouse key from frame left, cool monsoon fill from frame right, thin wet edge; preserve direction and exposure continuity.",
      dialogue: index === 2 ? "VIKRANT: Then we do it by hand." : index === 11 ? "OLDER VIKRANT: The storm has already happened." : "",
      audioDirection: index === 0
        ? "Ship horn, relay click, then room tone; theme enters only after the failed beam."
        : index === 11
          ? "Two-note unresolved brass sting and hard cut before release."
          : "Wind, metal strain, restrained three-note theme; dialogue stays foreground-clear.",
    }));
    const created = await json(`${baseUrl}/api/series`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ownerId: "u-admin",
        title: "The Last Signal",
        logline: "A retired lighthouse keeper receives warnings from a storm that has not happened yet—and every rescue brings his missing brother closer.",
        premise: "Each episode begins with an impossible signal at the Konkan lighthouse. Vikrant must rescue someone before dawn while decoding who is sending the warnings and why every saved life rewrites his own past.",
        genre: "Micro-thriller",
        primaryLanguage: "Hindi",
        secondaryLanguage: "English",
        storyEngine: {
          audiencePromise: "One urgent rescue, one impossible signal, and one emotional reversal every minute.",
          centralConflict: "Vikrant can save strangers only by reopening the mystery that destroyed his family.",
          seasonQuestion: "Is the signal changing the future, or creating the disaster it predicts?",
          escalationRule: "Every successful rescue makes the signal more personal and removes one safe choice.",
          cliffhangerRule: "End on physical evidence that reverses who controls time, never a spoken explanation.",
          tone: "Rain-soaked coastal suspense; precise, restrained performance; no exposition dumps.",
          brandBoundaries: [],
        },
        cast: [{ characterId: "c-bramble", roleName: "Captain Vikrant Suri", continuityNotes: "Locked uniform, brass compass, restrained physicality, and established voice." }],
        pilot: {
          title: "Episode 1 — The Dead Beam",
          logline: "When the lighthouse dies during a monsoon, Vikrant receives a signal from the brother who vanished twelve years ago.",
          openingHook: "The lighthouse beam stops mid-sweep while an unseen ship bears down on the reef.",
          episodeObjective: "Vikrant must relight the lamp manually before the ship reaches the rocks.",
          cliffhanger: "An older version of Vikrant steps out of the sealed lantern room and says the storm has already happened.",
          shots,
        },
      }),
    });
    seriesId = created.series.id;
  }

  const detail = (await json(`${baseUrl}/api/series/${seriesId}`)).series;
  if (detail.episodes.length !== 1 || detail.episodes[0].shots.length !== 12) {
    throw new Error("The pilot did not reload with one episode and twelve shots.");
  }
  const desktop = await screenshot(`${baseUrl}/series/${seriesId}`);
  const mobile = await screenshot(`${baseUrl}/series/new`, 390, 844);
  console.log(`Series verified: ${detail.title}`);
  console.log(`Persistent chain: ${detail.cast.length} actor -> ${detail.episodes.length} episode -> ${detail.episodes[0].shots.length} shots`);
  console.log(`Desktop detail: ${desktop.layout.width}px viewport, ${desktop.layout.scrollWidth}px content`);
  console.log(`Mobile builder: ${mobile.layout.width}px viewport, ${mobile.layout.scrollWidth}px content`);
  console.log(`Rendered page screenshots: ${desktop.output} | ${mobile.output}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
