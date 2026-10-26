// The Stamp Ledger in a real browser, against a running production server: a day's receipt from the keyboard,
// the Press replay counted tick by tick, the reduced-motion path and a phone. Drives Chrome through
// playwright-core: CHROME_PATH if set, else the installed Google Chrome, else Playwright's own Chromium.
// What is real: the built page, React, CSS, requestAnimationFrame and the browser's transition events. What is
// fake: AudioContext, swapped before any page script runs for one that only counts the oscillators the stamp cue
// starts, so the thuds are counted exactly and nothing has to be heard.
//   BASE_URL  the server (default http://localhost:4000)
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright-core";
import { cellLabel, daysOf, moveIndex } from "../app/(site)/(app)/ledger/_lib/calendar.ts";
import { endOf, ledgerGrid, pressSounds, receiptLines, WEEKDAYS, WINDOW_DAYS } from "../lib/ledger.ts";
import { parseLedger } from "../lib/ledger-data.ts";
import { CUES } from "../lib/sound.ts";

const BASE = process.env.BASE_URL ?? "http://localhost:4000";
const DESKTOP = { width: 1366, height: 900 };
const PHONE = { width: 390, height: 844 };
const TIMEOUT = 90_000;

// The year the build pressed: the same content/ledger.json the prebuild step left behind.
const ledger = parseLedger(JSON.parse(readFileSync(join(import.meta.dirname, "../content/ledger.json"), "utf8")));
const end = endOf(ledger);
assert.ok(end, "content/ledger.json has a date");
const grid = ledgerGrid(ledger, end);
const cells = daysOf(grid);
const N = cells.length;
const [THUD_HZ, THUD_LOW_HZ] = CUES.stamp.notes.map((n) => n.hz);

type Probe = {
  thuds: number;
  thudLows: number;
  transitions: string[];
  animations: string[];
  // every value data-press-step took, in order (null before the first press)
  steps: (string | null)[];
  // callbacks where the pressed days were not exactly 0..step-1
  misordered: string[];
  pressingSeen: number;
  // read once, mid-replay: every day ahead of the press is bare, and some behind it is inked
  midway: { step: number; aheadHidden: boolean; behindShown: boolean } | null;
};

declare global {
  interface Window {
    __ledger: Probe;
  }
}

// Runs in the page before any of its scripts.
function instrument([thudHz, thudLowHz]: [number, number]) {
  localStorage.setItem("sound", "on");
  const probe: Probe = {
    thuds: 0,
    thudLows: 0,
    transitions: [],
    animations: [],
    steps: [],
    misordered: [],
    pressingSeen: 0,
    midway: null,
  };
  window.__ledger = probe;

  class Param {
    value = 0;
    setValueAtTime() {}
    linearRampToValueAtTime() {}
  }
  class Node {
    connect<T>(next: T) {
      return next;
    }
    disconnect() {}
  }
  class Oscillator extends Node {
    type = "square";
    frequency = new Param();
    onended = null;
    start() {
      if (this.frequency.value === thudHz) probe.thuds++;
      if (this.frequency.value === thudLowHz) probe.thudLows++;
    }
    stop() {}
  }
  class Gain extends Node {
    gain = new Param();
  }
  class FakeAudioContext {
    state = "running";
    currentTime = 0;
    destination = new Node();
    createOscillator() {
      return new Oscillator();
    }
    createGain() {
      return new Gain();
    }
    resume() {
      return Promise.resolve();
    }
    suspend() {
      return Promise.resolve();
    }
    close() {
      return Promise.resolve();
    }
  }
  Object.defineProperty(window, "AudioContext", { value: FakeAudioContext, configurable: true, writable: true });

  // The ledger element and everything in it.
  const name = (t: EventTarget | null) =>
    t instanceof Element ? `${t.tagName.toLowerCase()}${t.className && typeof t.className === "string" ? `.${t.className}` : ""}` : "";
  const inLedger = (t: EventTarget | null) => t instanceof Element && t.closest(".ledger") !== null;
  document.addEventListener("transitionrun", (e) => inLedger(e.target) && probe.transitions.push(`${name(e.target)} ${e.propertyName}`), true);
  document.addEventListener("animationstart", (e) => inLedger(e.target) && probe.animations.push(`${name(e.target)} ${e.animationName}`), true);

  new MutationObserver((records) => {
    const ours = records.filter((r) => (r.target as Element).classList.contains("ledger"));
    if (ours.some((r) => r.attributeName === "data-pressing" && (r.target as Element).hasAttribute("data-pressing"))) {
      probe.pressingSeen++;
    }
    // Records batch per callback: a record's new value is the next one's old value, or the attribute as it is now.
    const steps = ours.filter((r) => r.attributeName === "data-press-step");
    steps.forEach((r, j) => {
      if (probe.steps.length === 0) probe.steps.push(r.oldValue);
      probe.steps.push(j + 1 < steps.length ? steps[j + 1].oldValue : (r.target as Element).getAttribute("data-press-step"));
    });
    const box = document.querySelector(".ledger");
    const step = Number(box?.getAttribute("data-press-step"));
    if (!box || !(step > 0)) return;
    const pressed = new Set([...box.querySelectorAll("[data-pressed]")].map((m) => Number(m.getAttribute("data-k"))));
    const marks = [...box.querySelectorAll("[data-k]")];
    const want = new Set(marks.map((m) => Number(m.getAttribute("data-k"))).filter((k) => k < step));
    if (pressed.size !== want.size || [...want].some((k) => !pressed.has(k))) {
      probe.misordered.push(`step ${step}: ${pressed.size} pressed, ${want.size} due`);
    }
    if (!probe.midway && step >= 100 && box.hasAttribute("data-pressing")) {
      const opacity = (m: Element) => getComputedStyle(m).opacity;
      probe.midway = {
        step,
        aheadHidden: marks.filter((m) => Number(m.getAttribute("data-k")) >= step).every((m) => opacity(m) === "0"),
        behindShown: marks.filter((m) => Number(m.getAttribute("data-k")) < step - 30).some((m) => opacity(m) !== "0"),
      };
    }
  }).observe(document, {
    subtree: true,
    attributes: true,
    attributeOldValue: true,
    attributeFilter: ["data-press-step", "data-pressing"],
  });
}

let browser: Browser;
const contexts: BrowserContext[] = [];
const errors: string[] = [];

// Chrome puts its singleton socket under TMPDIR and aborts when that path passes the 108-byte socket limit
// (a deep per-job TMPDIR does): such a TMPDIR is swapped for a short one under /tmp, removed afterwards.
let shortTmp = "";
function browserEnv(): Record<string, string | undefined> {
  if (tmpdir().length <= 60) return process.env;
  shortTmp ||= mkdtempSync("/tmp/ledger-e2e-");
  return { ...process.env, TMPDIR: shortTmp };
}

async function launch(): Promise<Browser> {
  const env = browserEnv();
  if (process.env.CHROME_PATH) return chromium.launch({ executablePath: process.env.CHROME_PATH, env });
  try {
    return await chromium.launch({ channel: "chrome", env });
  } catch (chrome) {
    try {
      return await chromium.launch({ env });
    } catch {
      throw new Error(
        `e2e/ledger.test.ts needs a browser: install Google Chrome or set CHROME_PATH (${String(chrome).split("\n")[0]})`,
      );
    }
  }
}

before(async () => {
  browser = await launch();
});

after(async () => {
  for (const c of contexts) await c.close().catch(() => {});
  await browser?.close();
  if (shortTmp) rmSync(shortTmp, { recursive: true, force: true });
});

async function open({ phone = false, reduced = false } = {}): Promise<Page> {
  const context = await browser.newContext({
    viewport: phone ? PHONE : DESKTOP,
    isMobile: phone,
    hasTouch: phone,
    reducedMotion: reduced ? "reduce" : "no-preference",
  });
  contexts.push(context);
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(`${page.url()}: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`${page.url()} console: ${m.text()}`);
  });
  await page.addInitScript(instrument, [THUD_HZ, THUD_LOW_HZ] as [number, number]);
  const res = await page.goto(`${BASE}/ledger`, { waitUntil: "load" });
  assert.equal(res?.status(), 200);
  // React has hydrated the cells and the Press chip (their props are on the nodes)
  await page.waitForFunction(
    () =>
      [document.querySelector(".ledger-cell"), document.querySelector(".ledger-press button")].every(
        (el) => el && Object.keys(el).some((k) => k.startsWith("__reactProps")),
      ),
    null,
    { timeout: 20_000 },
  );
  const to = await page.locator("time").first().getAttribute("datetime");
  assert.equal(to, grid.to, "the page ends on the day content/ledger.json does");
  return page;
}

const probe = (page: Page) => page.evaluate(() => window.__ledger);
const receipt = (page: Page) =>
  page.evaluate(() => {
    const el = document.querySelector(".ledger-receipt");
    return el ? [...el.querySelectorAll("p")].map((p) => p.textContent ?? "") : null;
  });
const linesOf = (i: number) => [...receiptLines(cells[i]), ...(cells[i].total ? [`TOTAL ${cells[i].total}`] : [])];
const step = (page: Page) => page.locator(".ledger").getAttribute("data-press-step");
const ticks = async (page: Page) => Number(await page.locator(".ledger").getAttribute("data-press-ticks"));
const pressButton = (page: Page, name: "Press" | "Stop") => page.getByRole("button", { name, exact: true });

// The thuds a sequence of data-press-step values should have played: one per step that presses a seventh day.
function thudsFor(steps: (string | null)[]): number {
  let count = 0;
  for (let i = 1; i < steps.length; i++) {
    const from = Number(steps[i - 1] ?? 0);
    const to = Number(steps[i]);
    if (to > from && pressSounds(from, to)) count++;
  }
  return count;
}

// After the replay: every mark is pressed and shows at its own ink, nothing is hidden.
const finalState = (page: Page) =>
  page.evaluate(() => {
    const box = document.querySelector(".ledger")!;
    const marks = [...box.querySelectorAll("[data-k]")];
    return {
      marks: marks.length,
      unpressed: marks.filter((m) => !m.hasAttribute("data-pressed")).length,
      hidden: marks.filter((m) => {
        const want = m.getAttribute("opacity") ?? "1";
        return Math.abs(Number(getComputedStyle(m).opacity) - Number(want)) > 0.01;
      }).length,
      pressing: box.hasAttribute("data-pressing"),
      days: new Set(marks.map((m) => m.getAttribute("data-k"))).size,
    };
  });

test("a day's receipt opens from the keyboard: Tab to the last day, arrows to an inked one, Enter pins, Escape closes", { timeout: TIMEOUT }, async () => {
  const page = await open();
  let focused = false;
  for (let i = 0; i < 80 && !focused; i++) {
    await page.keyboard.press("Tab");
    focused = await page.evaluate(() => document.activeElement?.classList.contains("ledger-cell") ?? false);
  }
  assert.ok(focused, "Tab reaches the calendar");
  // One tab stop: the calendar is entered on its last day.
  const label = await page.evaluate(() => document.activeElement?.getAttribute("aria-label"));
  assert.equal(label, cellLabel(cells[N - 1]));
  assert.deepEqual(await receipt(page), linesOf(N - 1), "focus alone shows the day's receipt");

  // Walk to the latest inked day with the arrows: left a week at a time, then up a day at a time.
  let target = cells.findLastIndex((c) => c.total > 0);
  if (target < 0) target = 0;
  const keys = [
    ...Array<string>(Math.floor((N - 1 - target) / WEEKDAYS)).fill("ArrowLeft"),
    ...Array<string>((N - 1 - target) % WEEKDAYS).fill("ArrowUp"),
  ];
  assert.equal(keys.reduce((i, key) => moveIndex(i, key, N) ?? i, N - 1), target);
  for (const key of keys) await page.keyboard.press(key);
  assert.equal(await page.evaluate(() => document.activeElement?.getAttribute("data-i")), String(target));
  const lines = await receipt(page);
  assert.deepEqual(lines, linesOf(target));
  if (cells[target].total) assert.ok(lines!.length > 2, "an inked day's receipt lists what was done");

  await page.keyboard.press("Enter");
  assert.equal(await page.locator(`.ledger-cell[data-i="${target}"]`).getAttribute("data-open"), "");
  await page.keyboard.press("Escape");
  assert.equal(await receipt(page), null, "Escape puts the receipt away");
  assert.equal(await page.locator(".ledger-cell[data-open]").count(), 0);
});

test("Press replays the year in date order, a day per tick, with a stamp thud every seventh day", { timeout: TIMEOUT }, async (ctx) => {
  const page = await open();
  const before = await probe(page);
  assert.equal(before.thuds, 0, "nothing thuds before the press");
  assert.equal(await step(page), null);

  await pressButton(page, "Press").click();
  await pressButton(page, "Stop").waitFor({ timeout: 5_000 });
  await page.waitForFunction((n) => document.querySelector(".ledger")?.getAttribute("data-press-step") === String(n), N, {
    timeout: 30_000,
  });
  await pressButton(page, "Press").waitFor({ timeout: 5_000 });
  await page.waitForTimeout(400); // the last fade-ins finish

  const p = await probe(page);
  const t = await ticks(page);
  assert.equal(N, WINDOW_DAYS);
  // The steps: from nothing, 0, then up a day or two per frame to every day of the year, never backwards.
  const values = p.steps.slice(1).map(Number);
  assert.equal(p.steps[0], null);
  assert.equal(values[0], 0);
  assert.equal(values[1], 1, "the first day is pressed by the click itself");
  assert.equal(values.at(-1), N);
  for (let i = 1; i < values.length; i++) assert.ok(values[i] > values[i - 1], `step ${values[i]} follows ${values[i - 1]}`);
  // Ticks, not time: each frame that pressed anything is one tick, and the year took many of them.
  assert.equal(t, values.length - 1, "data-press-ticks counts every step the page took");
  assert.ok(t >= 20, `the press is a replay over many frames, not a jump (${t} ticks)`);
  assert.ok(Math.max(...values.slice(1).map((v, i) => v - values[i])) < N / 2, "no frame presses half the year");
  assert.deepEqual(p.misordered, [], "at every tick exactly the days before the step are pressed");
  assert.ok(p.midway, "the replay was seen midway");
  assert.ok(p.midway.aheadHidden, `at step ${p.midway.step} every later day is bare paper`);
  assert.ok(p.midway.behindShown, `at step ${p.midway.step} the earlier days are inked`);

  // The sound: one stamp cue per seventh day pressed, at most one a frame, each its two notes.
  assert.equal(p.thuds, thudsFor(p.steps), "a thud for each step that pressed a seventh day");
  assert.equal(p.thudLows, p.thuds, "every thud is the whole stamp cue");
  assert.ok(p.thuds >= Math.ceil(N / WEEKDAYS / 2) && p.thuds <= Math.ceil(N / WEEKDAYS), `${p.thuds} thuds for ${N} days`);
  ctx.diagnostic(`${N} days in ${t} ticks, ${p.thuds} thuds, ${p.transitions.length} transitions`);

  // The motion path animates: the fade-ins run as transitions (the reduced-motion test's negative control).
  assert.ok(p.transitions.some((e) => e.startsWith("use") && e.endsWith("opacity")), "pressed stamps fade in");
  assert.ok(p.pressingSeen >= 1);

  const done = await finalState(page);
  assert.equal(done.days, N);
  assert.equal(done.unpressed, 0);
  assert.equal(done.hidden, 0, "every mark is back at its own ink");
  assert.equal(done.pressing, false);
  assert.match((await page.locator(".ledger-press [aria-live]").textContent()) ?? "", new RegExp(`Pressed all ${N} days`));

  // Stop lands the rest of the year at once.
  await pressButton(page, "Press").click();
  await pressButton(page, "Stop").click();
  assert.equal(await step(page), String(N));
  await page.waitForTimeout(400);
  const stopped = await finalState(page);
  assert.equal(stopped.unpressed, 0);
  assert.equal(stopped.hidden, 0);
  assert.equal(stopped.pressing, false);
  assert.deepEqual(errors, []);
});

test("under reduced motion Press lands the final year at once: no replay, no transition or animation in the ledger", { timeout: TIMEOUT }, async () => {
  const page = await open({ reduced: true });
  await pressButton(page, "Press").hover();
  await pressButton(page, "Press").click();
  assert.equal(await step(page), String(N), "the whole year in one go");
  assert.equal(await ticks(page), 1, "in one tick");
  // A cell's receipt, under the same rule.
  await page.locator(`.ledger-cell[data-i="${N - 1}"]`).focus();
  assert.deepEqual(await receipt(page), linesOf(N - 1));
  await page.waitForTimeout(600);

  const p = await probe(page);
  assert.equal(p.pressingSeen, 0, "the year is never hidden for a replay");
  assert.deepEqual(p.steps, [null, "0", String(N)]);
  assert.deepEqual(p.misordered, []);
  assert.deepEqual(p.transitions, [], "no transition runs on the ledger or anything in it, the Press chip included");
  assert.deepEqual(p.animations, [], "no animation starts on the ledger or anything in it, the receipt included");
  assert.equal(p.thuds, 1, "one thud for the one press");
  assert.equal(p.thudLows, 1);
  const done = await finalState(page);
  assert.equal(done.unpressed, 0);
  assert.equal(done.hidden, 0, "the final state: every mark at its own ink");
  assert.equal(await pressButton(page, "Press").count(), 1, "nothing to stop");
  assert.deepEqual(errors, []);
});

test("on a phone the sheet scrolls inside its frame, Press works by touch and a tapped day shows its receipt", { timeout: TIMEOUT }, async () => {
  const page = await open({ phone: true });
  const layout = await page.evaluate(() => {
    const scroller = document.querySelector(".ledger-scroll")!;
    return {
      pageOverflow: document.documentElement.scrollWidth - innerWidth,
      sheetScrolls: scroller.scrollWidth > scroller.clientWidth,
    };
  });
  assert.ok(layout.pageOverflow <= 0, `the page does not scroll sideways (${layout.pageOverflow}px over)`);
  assert.ok(layout.sheetScrolls, "the year scrolls inside its frame");

  const chip = pressButton(page, "Press");
  const box = await chip.boundingBox();
  assert.ok(box, "the Press chip is laid out");
  assert.ok(box.x >= 0 && box.x + box.width <= PHONE.width, "the Press chip fits the screen");
  assert.ok(box.height >= 24 && box.width >= 24, `the Press chip is a fingertip's size (${box.width}x${box.height})`);

  await chip.tap();
  await page.waitForFunction((n) => document.querySelector(".ledger")?.getAttribute("data-press-step") === String(n), N, {
    timeout: 30_000,
  });
  assert.ok((await ticks(page)) >= 20, "the replay runs on a phone too");

  await page.locator('.ledger-cell[data-i="0"]').tap();
  assert.deepEqual(await receipt(page), linesOf(0), "a tap shows the day's receipt");
  assert.equal(await page.locator('.ledger-cell[data-i="0"]').getAttribute("data-open"), "");
  await page.getByRole("heading", { level: 1 }).tap();
  assert.equal(await receipt(page), null, "a tap elsewhere puts it away");
  assert.deepEqual(errors, []);
});
