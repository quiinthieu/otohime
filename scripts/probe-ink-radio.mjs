// Drives headless Chromium over Ink Radio on /music. Run by scripts/probe-ink-radio.sh, which installs
// Playwright into PW_PREFIX and passes BASE_URL.
//
// Real: the browser, its media pipeline, the mouse, the keyboard and CDP touch. Fake: every station stream
// (the probe answers it: a generated WAV, or a 503) and YouTube's player API (a stand-in that counts play and
// pause and reports them like the real one). What is read back is what a listener or assistive technology
// meets: the slider's value and text, the readout, the lamp, the <audio> element's src, paused and volume,
// and which stream URLs the page asked for.
import { mkdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { dialOrder, nearest } from "../app/(site)/(app)/music/_lib/tuning.ts";

const require = createRequire(path.join(process.env.PW_PREFIX, "package.json"));
const { chromium } = require("playwright");

const BASE_URL = process.env.BASE_URL;
const SHOTS_DIR = process.env.SHOTS_DIR || "";
const PHONE = { width: 390, height: 844 };
const DESKTOP = { width: 1366, height: 768 };

const snapshot = JSON.parse(
  readFileSync(new URL("../app/(site)/(app)/music/_lib/stations.json", import.meta.url), "utf8"),
);
const STATIONS = snapshot.stations;
const DIAL = dialOrder(STATIONS);
const HOME = nearest(STATIONS, { lat: 35.68, lon: 139.69 });
const keyOf = (u) => {
  const url = new URL(u);
  return `${url.host}${url.pathname}`;
};
const STREAMS = new Map(STATIONS.map((s) => [keyOf(s.url), s]));
const valueText = (s) => s.name; // aria-valuetext starts with the name, then the country

let ok = 0;
let failed = 0;
function check(name, pass, detail = "") {
  if (pass) {
    ok++;
    console.log(`ok - ${name}`);
  } else {
    failed++;
    console.log(`not ok - ${name}${detail ? `: ${detail}` : ""}`);
  }
}

const errors = [];
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// 20 s of a quiet 440 Hz tone, 8 kHz mono 16-bit PCM: a stream the media pipeline really decodes and plays.
function wav(seconds = 20, rate = 8000) {
  const n = seconds * rate;
  const buf = Buffer.alloc(44 + n * 2);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + n * 2, 4);
  buf.write("WAVEfmt ", 8);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(rate, 24);
  buf.writeUInt32LE(rate * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write("data", 36);
  buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) buf.writeInt16LE(Math.round(800 * Math.sin((2 * Math.PI * 440 * i) / rate)), 44 + i * 2);
  return buf;
}
const TONE = wav();

// YouTube's IFrame API, as far as components/television.tsx uses it.
const FAKE_YT = `
window.__tv = { plays: 0, pauses: 0 };
window.YT = {
  Player: class {
    constructor(el, options) {
      this.events = options.events;
      const screen = document.createElement("div");
      screen.dataset.fakeYt = "";
      el.replaceWith(screen);
      setTimeout(() => this.events.onReady({ target: this }), 0);
    }
    cuePlaylist() {}
    getPlaylistIndex() { return 0; }
    playVideoAt() { this.playVideo(); }
    playVideo() { window.__tv.plays++; setTimeout(() => this.events.onStateChange({ target: this, data: 1 }), 30); }
    pauseVideo() { window.__tv.pauses++; setTimeout(() => this.events.onStateChange({ target: this, data: 2 }), 30); }
    destroy() {}
  },
};
window.onYouTubeIframeAPIReady && window.onYouTubeIframeAPIReady();
`;

async function open(browser, { viewport = DESKTOP, reduced = false, http = false } = {}) {
  const phone = viewport === PHONE;
  const context = await browser.newContext({
    viewport,
    isMobile: phone,
    hasTouch: phone,
    reducedMotion: reduced ? "reduce" : "no-preference",
  });
  const page = await context.newPage();
  const net = { mode: "ok", requests: [] };
  page.on("console", (m) => {
    if (m.type() === "error" && !/Failed to load resource.*503/.test(m.text()))
      errors.push(`console ${page.url()}: ${m.text()}`);
  });
  page.on("pageerror", (e) => errors.push(`pageerror ${page.url()}: ${e.message}`));
  await context.route("https://www.youtube.com/iframe_api", (route) =>
    route.fulfill({ status: 200, contentType: "text/javascript", body: FAKE_YT }),
  );
  await context.route(
    (url) => STREAMS.has(`${url.host}${url.pathname}`),
    (route) => {
      net.requests.push(route.request().url());
      if (net.mode === "fail") return route.fulfill({ status: 503, body: "off air" });
      return route.fulfill({ status: 200, contentType: "audio/wav", body: TONE });
    },
  );
  if (http) {
    // Negative control: the radio's chunk with every stream rewritten to plain http.
    await context.route(/\/_next\/static\/chunks\/[\w.-]+\.js$/, async (route) => {
      const res = await route.fetch();
      let body = await res.text();
      if (body.includes(HOME.url))
        for (const s of STATIONS) body = body.split(s.url).join(s.url.replace(/^https:/, "http:"));
      await route.fulfill({ response: res, body });
    });
  }
  await page.goto(`${BASE_URL}/music`, { waitUntil: "load" });
  return { context, page, net };
}

const radio = (page) => page.locator('section[aria-label="Ink Radio"]');
const dial = (page) => page.getByRole("slider", { name: /Tuning dial/ });
const playChip = (page) => radio(page).getByRole("button", { name: /^(Play|Stop) the radio$/ });

// Scroll the slot in and wait for the set and React's handlers on it.
async function bringIn(page) {
  await page.locator('[data-radio="slot"]').scrollIntoViewIfNeeded();
  await radio(page).waitFor({ timeout: 15000 });
  await page.waitForFunction(
    () => {
      const el = document.querySelector('[data-radio="play"]');
      return el && Object.keys(el).some((k) => k.startsWith("__reactProps"));
    },
    null,
    { timeout: 15000 },
  );
  await radio(page).scrollIntoViewIfNeeded();
  await sleep(150);
}

const read = (page) =>
  page.evaluate(() => {
    const a = document.querySelector('audio[data-radio="audio"]');
    const s = document.querySelector('section[aria-label="Ink Radio"]');
    const slider = s?.querySelector('input[type="range"]');
    const needle = s?.querySelector(".radio-needle");
    return {
      readout: s?.querySelector(".readout")?.textContent ?? "",
      value: slider ? Number(slider.value) : -1,
      text: slider?.getAttribute("aria-valuetext") ?? "",
      lamp: s?.querySelector(".radio-lamp")?.hasAttribute("data-on") ?? false,
      src: a?.getAttribute("src") ?? null,
      paused: a ? a.paused : null,
      volume: a ? a.volume : null,
      autoplay: a ? a.autoplay || a.hasAttribute("autoplay") : null,
      preload: a?.getAttribute("preload") ?? null,
      status: s?.querySelector(".radio-set")?.dataset.status ?? "",
      hiss: s?.querySelector(".radio-static")?.hasAttribute("data-on") ?? false,
      needle: needle?.getAttribute("transform") ?? "",
      frac: Number(needle?.dataset.frac ?? NaN),
      tv: window.__tv ? { ...window.__tv } : null,
      sideways: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    };
  });

const until = async (page, test, timeout = 4000) => {
  const end = Date.now() + timeout;
  let r = await read(page);
  while (!test(r) && Date.now() < end) {
    await sleep(60);
    r = await read(page);
  }
  return r;
};

async function shot(page, name) {
  if (!SHOTS_DIR) return;
  mkdirSync(SHOTS_DIR, { recursive: true });
  await radio(page)
    .screenshot({ path: path.join(SHOTS_DIR, `${name}.png`) })
    .catch(() => {});
}

const stationAt = (i) => DIAL[i];
const needleX = (r) => Number(/translate\(([-\d.]+)/.exec(r.needle)?.[1] ?? NaN);

async function desktop(browser) {
  const { context, page, net } = await open(browser);
  // Lazy: the set is not on the page until its slot nears the viewport.
  const early = await page.evaluate(() => ({
    set: !!document.querySelector('section[aria-label="Ink Radio"]'),
    waiting: !!document.querySelector('[data-radio="waiting"]'),
    slotTop: document.querySelector('[data-radio="slot"]')?.getBoundingClientRect().top ?? 0,
  }));
  if (early.slotTop > DESKTOP.height + 400)
    check("lazy: the set waits below the fold, the slot says so", !early.set && early.waiting, JSON.stringify(early));
  else check("lazy: the slot is within reach on load (no lazy check at this size)", true);

  await bringIn(page);
  let r = await read(page);
  check(
    "the set loads on scroll and tunes the station nearest Tokyo",
    r.text.startsWith(valueText(HOME)) && r.value === DIAL.indexOf(HOME),
    r.text,
  );
  check(
    "the audio element has no autoplay and preloads nothing",
    r.autoplay === false && r.preload === "none",
    JSON.stringify(r),
  );
  await sleep(1500);
  r = await read(page);
  check(
    "no autoplay: idle after load, lamp off, no stream asked for",
    r.status === "idle" && !r.lamp && r.src === null && net.requests.length === 0,
    JSON.stringify({ ...r, requests: net.requests }),
  );
  check("the readout invites play", /Press play\.$/.test(r.readout), r.readout);
  await shot(page, "idle");

  // The dial's keys.
  await dial(page).focus();
  const start = r.value;
  await page.keyboard.press("ArrowRight");
  r = await read(page);
  check(
    "ArrowRight tunes one station east",
    r.value === start + 1 && r.text.startsWith(valueText(stationAt(start + 1))),
    `${r.value} ${r.text}`,
  );
  check("the readout follows the dial", r.readout.startsWith(stationAt(start + 1).name), r.readout);
  // The needle springs: right after the key it is still on its way, then it settles on the station.
  const target = r.frac * 340;
  const moving = needleX(await read(page));
  const settledR = await until(page, (x) => Math.abs(needleX(x) - target) < 0.5, 3000);
  check(
    "the needle springs to the station and settles there",
    Math.abs(needleX(settledR) - target) < 0.5,
    `${moving} -> ${needleX(settledR)} target ${target}`,
  );
  await page.keyboard.press("ArrowLeft");
  check("ArrowLeft tunes back", (await read(page)).value === start);
  await page.keyboard.press("End");
  check("End tunes the far east", (await read(page)).value === DIAL.length - 1);
  await page.keyboard.press("Home");
  check("Home tunes the far west", (await read(page)).value === 0);
  await page.keyboard.press("PageUp");
  check("PageUp jumps further east", (await read(page)).value > 1);
  check("tuning while idle asks for no stream", net.requests.length === 0, net.requests.join(" "));

  // The West/East chips and the Nearby chips.
  await radio(page).getByRole("button", { name: "Tune east" }).click();
  const afterEast = await read(page);
  await radio(page).getByRole("button", { name: "Tune west" }).click();
  check("the East and West chips step the dial", afterEast.value === (await read(page)).value + 1);
  const nearChips = radio(page).getByRole("button", { name: /^Tune to / });
  check("three nearby stations are offered", (await nearChips.count()) === 3, String(await nearChips.count()));
  const pick = (await nearChips.nth(0).getAttribute("aria-label")).replace(/^Tune to /, "");
  await nearChips.nth(0).click();
  r = await read(page);
  check(
    "a nearby chip tunes its station",
    pick.startsWith(r.text.split(",")[0]) && r.text === pick,
    `${pick} vs ${r.text}`,
  );
  const tuned = DIAL[r.value];

  // Play by keyboard: Enter on the Play chip.
  await playChip(page).focus();
  await page.keyboard.press("Enter");
  r = await until(page, (x) => x.status === "playing", 6000);
  check(
    "Enter on Play opens the tuned stream, and only it",
    net.requests.length >= 1 && net.requests.every((u) => keyOf(u) === keyOf(tuned.url)),
    net.requests.join(" "),
  );
  check(
    "on air: playing, the lamp lit, the readout says so",
    r.status === "playing" && r.lamp && r.paused === false && /^On air: /.test(r.readout),
    JSON.stringify(r),
  );
  check("the volume is capped", r.volume !== null && r.volume <= 0.6 + 1e-9, String(r.volume));
  check("the Play chip turns to Stop", (await playChip(page).getAttribute("aria-label")) === "Stop the radio");
  await shot(page, "on-air");

  // The Television starting stops the radio.
  await page.waitForFunction(() => !!window.__tv, null, { timeout: 5000 }).catch(() => {});
  const tvPlay = page.locator('section[aria-label="Television"]').getByRole("button", { name: "Play", exact: true });
  await tvPlay.click();
  r = await until(page, (x) => x.status === "idle");
  check(
    "the Television starting stops the radio",
    r.tv?.plays === 1 && r.status === "idle" && !r.lamp && r.src === null && r.paused === true,
    JSON.stringify(r),
  );
  // And the radio starting pauses the Television.
  const before = net.requests.length;
  await playChip(page).click();
  r = await until(page, (x) => x.status === "playing" && (x.tv?.pauses ?? 0) >= 1, 6000);
  check(
    "the radio starting pauses the Television, once, and only now that it plays",
    r.tv?.pauses === 1 && r.status === "playing" && net.requests.length > before,
    JSON.stringify(r.tv),
  );

  // Stop closes the stream.
  await playChip(page).click();
  r = await until(page, (x) => x.status === "idle");
  check(
    "Stop closes the stream",
    r.status === "idle" && r.src === null && r.paused === true && !r.lamp,
    JSON.stringify(r),
  );

  // A failing stream: no signal, a suggestion, no retry.
  net.mode = "fail";
  await playChip(page).click();
  r = await until(page, (x) => x.status === "no-signal", 9000);
  const failedUrl = tuned.url;
  check(
    "a failing stream shows no signal",
    r.status === "no-signal" && !r.lamp && /^No signal from /.test(r.readout),
    JSON.stringify(r),
  );
  const suggestion = radio(page).locator('[data-radio="suggestion"]');
  check(
    "no signal offers the nearest other station",
    (await suggestion.count()) === 1 && / Try .+\.$/.test(r.readout),
    r.readout,
  );
  const triesAtFail = net.requests.filter((u) => keyOf(u) === keyOf(failedUrl)).length;
  await sleep(2500);
  r = await read(page);
  check(
    "the failed stream is never retried on its own",
    net.requests.filter((u) => keyOf(u) === keyOf(failedUrl)).length === triesAtFail && r.status === "no-signal",
    `${triesAtFail}`,
  );
  await playChip(page).click();
  await sleep(400);
  check(
    "Play on the failed station asks for nothing again",
    net.requests.filter((u) => keyOf(u) === keyOf(failedUrl)).length === triesAtFail,
  );
  await shot(page, "no-signal");
  net.mode = "ok";
  const suggested = (await suggestion.textContent()).replace(/^Try /, "");
  await suggestion.click();
  r = await read(page);
  check(
    "the suggestion tunes its station",
    r.text.startsWith(suggested) && r.status === "idle",
    `${suggested} vs ${r.text}`,
  );
  await playChip(page).click();
  r = await until(page, (x) => x.status === "playing", 6000);
  check("and it plays", r.status === "playing" && r.lamp);

  // Drag the globe: it hisses between stations, and the one under the crosshair comes in on release.
  // The figure can sit outside the viewport while the chips are in view: bring the globe itself in.
  const globeEl = radio(page).locator('[data-radio="globe"]');
  await globeEl.scrollIntoViewIfNeeded();
  await sleep(100);
  const globe = await globeEl.boundingBox();
  const cx = globe.x + globe.width / 2;
  const cy = globe.y + globe.height / 2;
  const was = (await read(page)).text;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx - 60, cy + 10, { steps: 4 });
  await page.mouse.move(cx - 140, cy + 20, { steps: 6 });
  const mid = await read(page);
  check(
    "mid-drag the set hisses between stations",
    mid.hiss && /^Between stations/.test(mid.readout),
    JSON.stringify(mid),
  );
  await page.mouse.up();
  r = await until(page, (x) => x.status === "playing", 6000);
  check(
    "letting go tunes a new station, and on air it switches stream",
    r.text !== was && r.status === "playing" && !r.hiss,
    `${was} -> ${r.text}`,
  );
  // A tap on the globe's edge tunes the station nearest that point.
  const beforeTap = (await read(page)).text;
  await page.mouse.click(cx + globe.width * 0.38, cy - globe.height * 0.05);
  r = await read(page);
  check("a tap on the globe tunes the nearest dot", r.text !== beforeTap, `${beforeTap} -> ${r.text}`);
  check("no sideways scroll on desktop", !r.sideways);
  await shot(page, "dragged");

  // Leaving the page stops the sound.
  await page.locator("nav[aria-label='Main'] a[href='/notes']").first().click();
  await page.waitForURL(/\/notes$/, { timeout: 15000 }).catch(() => {});
  await sleep(600);
  const left = await page.evaluate(() =>
    [...document.querySelectorAll("audio")].map((a) => ({ paused: a.paused, src: a.getAttribute("src") })),
  );
  check(
    "leaving /music stops the radio",
    new URL(page.url()).pathname === "/notes" && left.every((a) => a.paused && a.src === null),
    JSON.stringify(left),
  );
  await context.close();
}

async function blocked(browser) {
  const { context, page, net } = await open(browser, { http: true });
  await bringIn(page);
  await playChip(page).click();
  const r = await until(page, (x) => x.status === "no-signal");
  check(
    "negative control: an http stream is blocked, not played",
    r.status === "no-signal" && / isn't on a safe stream\./.test(r.readout) && r.src === null,
    JSON.stringify(r),
  );
  check("negative control: a blocked stream is never requested", net.requests.length === 0, net.requests.join(" "));
  check(
    "negative control: no unsafe station is suggested",
    (await radio(page).locator('[data-radio="suggestion"]').count()) === 0,
  );
  await context.close();
}

async function reducedMotion(browser) {
  const { context, page } = await open(browser, { reduced: true });
  await bringIn(page);
  await dial(page).focus();
  await page.keyboard.press("ArrowRight");
  await sleep(50);
  const r = await read(page);
  check(
    "reduced: the needle jumps straight to the station",
    Math.abs(needleX(r) - r.frac * 340) < 0.01,
    `${needleX(r)} vs ${r.frac * 340}`,
  );
  const anim = await page.evaluate(() => ({
    type: getComputedStyle(document.querySelector(".radio-type")).animationName,
    hiss: getComputedStyle(document.querySelector(".radio-static")).animationName,
  }));
  check(
    "reduced: the label does not type and the static does not hiss",
    anim.type === "none" && anim.hiss === "none",
    JSON.stringify(anim),
  );
  await playChip(page).click();
  const p = await until(page, (x) => x.status === "playing", 6000);
  await sleep(300);
  const q = await read(page);
  check(
    "reduced: on air the needle holds still",
    p.status === "playing" && p.needle === q.needle,
    `${p.needle} ${q.needle}`,
  );
  await context.close();
}

async function phone(browser) {
  const { context, page, net } = await open(browser, { viewport: PHONE });
  await bringIn(page);
  const box = await radio(page).boundingBox();
  let r = await read(page);
  check(
    "phone: the set fits the width, no sideways scroll",
    box.x >= 0 && box.x + box.width <= PHONE.width + 0.5 && !r.sideways,
    JSON.stringify(box),
  );
  const touchAction = await page.locator('[data-radio="globe"]').evaluate((el) => getComputedStyle(el).touchAction);
  check("phone: the globe takes the drag, not the page", touchAction === "none", touchAction);
  await playChip(page).tap();
  r = await until(page, (x) => x.status === "playing", 6000);
  check("phone: a tap on Play plays", r.status === "playing" && net.requests.length >= 1);
  await shot(page, "phone");
  await context.close();
}

const browser = await chromium.launch();
try {
  for (const [name, run] of [
    ["desktop", desktop],
    ["blocked", blocked],
    ["reduced", reducedMotion],
    ["phone", phone],
  ]) {
    try {
      await run(browser);
    } catch (e) {
      check(`${name}: ran to the end`, false, e.message.split("\n")[0]);
    }
  }
} finally {
  await browser.close();
}

check("no console or page errors", errors.length === 0, errors.slice(0, 5).join(" | "));
console.log(`probe: ${ok} ok, ${failed} failed`);
process.exit(failed ? 1 : 0);
