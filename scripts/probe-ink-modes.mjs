// Drives headless Chromium over the machines' Hand picker, Re-roll and Boil. Run by scripts/probe-ink-modes.sh,
// which installs Playwright into PW_PREFIX and passes BASE_URL (and EXPECT_SHA, checked if set).
//
// The filter is read from the DOM as the browser holds it (each primitive's tag and attributes, the merge order,
// the line weight on the filtered group), not from React state. Materials are told apart on pixels: a figure's
// screenshot is decoded in the page and compared channel by channel, and the line work's darkest percentile is
// measured against the machine's own swatch (the line work is the same dark ink on either paper). A boil is
// counted from mutations of the first feTurbulence's seed attribute over a fixed window, and the figure clock's
// timers are counted by wrapping setInterval. Each negative control runs the same assertion against a page with
// one thing knocked out, and that assertion must fail.
import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(path.join(process.env.PW_PREFIX, "package.json"));
const { chromium } = require("playwright");

const BASE_URL = process.env.BASE_URL;
const EXPECT_SHA = process.env.EXPECT_SHA ?? "";
const SHOTS = process.env.SHOTS ?? "";
const PHONE = { width: 390, height: 844 };
const DESKTOP = { width: 1366, height: 768 };
const CONSOLE = 'section[aria-label="Pocket console"]';
const BOARD = 'section[aria-label="Switchboard"]';
const PIPELINE = 'section[aria-label="Data pipeline"]';
const RACK = 'section[aria-label="Server rack"]';
const HANDS = ["Ink", "Pencil", "Crayon", "Watercolour"];
const WINDOW = 3000;
if (SHOTS) mkdirSync(SHOTS, { recursive: true });

// The house filter, as Inked drew it before there were hands (seed 0, wobble 3.5).
const HOUSE = [
  ["feTurbulence", { type: "turbulence", baseFrequency: "0.035", numOctaves: "2", seed: "3", result: "warp" }],
  [
    "feDisplacementMap",
    { in: "SourceGraphic", in2: "warp", scale: "3.5", xChannelSelector: "R", yChannelSelector: "G", result: "inked" },
  ],
  ["feTurbulence", { type: "fractalNoise", baseFrequency: "0.85", numOctaves: "1", seed: "8", result: "noise" }],
  ["feColorMatrix", { in: "noise", type: "matrix", values: "0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1.6 0 0 0 -0.82", result: "specks" }],
  ["feComposite", { in: "specks", in2: "inked", operator: "in", result: "grain" }],
  ["feMerge", ["inked", "grain"]],
];

// What each hand must put in the actual filter: its line weight, the warp frequency, the merge order and the
// primitives it adds.
const SIGNATURE = {
  Ink: { stroke: "2.4", warp: "0.035", merge: "inked grain", count: 6 },
  Pencil: { stroke: "1.6", warp: "0.08", merge: "faint bitten grain", count: 9 },
  Crayon: { stroke: "3.2", warp: "0.022", merge: "faint bitten grain", count: 9 },
  Watercolour: { stroke: "1.8", warp: "0.03", merge: "wash faint bitten grain", count: 13, blur: true },
};

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

// Every page counts the figure clock's live timers (setInterval at 1000/12 ms).
const COUNT_TIMERS = () => {
  const set = window.setInterval.bind(window);
  const clear = window.clearInterval.bind(window);
  const live = new Set();
  window.__figureTimers = () => live.size;
  window.setInterval = (fn, ms, ...rest) => {
    const id = set(fn, ms, ...rest);
    if (Math.abs(ms - 1000 / 12) < 0.5) live.add(id);
    return id;
  };
  window.clearInterval = (id) => {
    live.delete(id);
    return clear(id);
  };
};

async function open(browser, { viewport, scheme = "light", reduced = false, init = null, sink = errors }) {
  const phone = viewport === PHONE;
  const context = await browser.newContext({
    viewport,
    isMobile: phone,
    hasTouch: phone,
    colorScheme: scheme,
    reducedMotion: reduced ? "reduce" : "no-preference",
  });
  const page = await context.newPage();
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    const from = m.location().url;
    sink.push(`console ${page.url()}: ${m.text()}${from && from !== page.url() ? ` (${from})` : ""}`);
  });
  page.on("pageerror", (e) => sink.push(`pageerror ${page.url()}: ${e.message}`));
  await page.addInitScript(COUNT_TIMERS);
  if (init) await page.addInitScript(init);
  return { context, page, phone };
}

// Loaded, hydrated (React's props on the Boil chip) and printed in (the figure's 0.6 s print has landed).
async function load(page, route, sel) {
  await page.goto(BASE_URL + route, { waitUntil: "load" });
  await page.waitForFunction(
    (s) => {
      const b = document.querySelector(`${s} .machine-pen button[aria-pressed]`);
      return b && Object.keys(b).some((k) => k.startsWith("__reactProps"));
    },
    sel,
    { timeout: 15000 },
  );
  await sleep(800);
}

// The filter as the DOM holds it.
const filterOf = (page, sel) =>
  page.evaluate((s) => {
    const svg = document.querySelector(`${s} svg.figure`);
    const filter = svg?.querySelector("filter");
    if (!filter) return null;
    const prims = [...filter.children].map((el) =>
      el.localName === "feMerge"
        ? [el.localName, [...el.children].map((n) => n.getAttribute("in"))]
        : [el.localName, Object.fromEntries([...el.attributes].map((a) => [a.name, a.value]))],
    );
    const g = svg.querySelector(":scope > g[filter]");
    return {
      prims,
      linked: g?.getAttribute("filter") === `url(#${filter.id})`,
      stroke: g?.getAttribute("stroke-width"),
      hand: svg.closest("section")?.dataset.hand ?? null,
      seed: svg.closest("section")?.dataset.seed ?? null,
    };
  }, sel);

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const seeds = (f) => f.prims.filter(([t]) => t === "feTurbulence").map(([, a]) => Number(a.seed));
const withoutSeeds = (f) => f.prims.map(([t, a]) => (t === "feTurbulence" ? [t, { ...a, seed: "" }] : [t, a]));

function signatureOk(f, hand) {
  const s = SIGNATURE[hand];
  const merge = f.prims.at(-1);
  const warp = f.prims[0];
  return (
    f.linked &&
    f.stroke === s.stroke &&
    f.prims.length === s.count &&
    warp[0] === "feTurbulence" &&
    warp[1].baseFrequency === s.warp &&
    merge[0] === "feMerge" &&
    merge[1].join(" ") === s.merge &&
    f.prims.some(([t]) => t === "feGaussianBlur") === Boolean(s.blur) &&
    // a blur only ever softens the wash, never the line work
    f.prims.filter(([t]) => t === "feGaussianBlur").every(([, a]) => a.in === "spread")
  );
}

async function pick(page, phone, sel, hand) {
  const label = page.locator(`${sel} .machine-pen label`, { hasText: hand });
  if (phone) await label.tap();
  else await label.click();
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
}

async function press(page, phone, sel, name) {
  const b = page.locator(`${sel} .machine-pen button[aria-label="${name}"]`);
  if (phone) await b.tap();
  else await b.click();
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(r)));
}
const boilChip = (page, sel) => page.locator(`${sel} .machine-pen button[aria-label="Boil the lines"]`);

// A screenshot of the figure, then the page back at the top (a locator screenshot scrolls, and the console only
// takes its keys at scrollY 0).
async function shot(page, sel, name) {
  const buf = await page.locator(`${sel} .machine-figure`).screenshot({ animations: "disabled" });
  await page.evaluate(() => scrollTo({ top: 0, behavior: "instant" }));
  if (SHOTS) writeFileSync(path.join(SHOTS, `${name}.png`), buf);
  return buf.toString("base64");
}

// Decodes PNGs in the page: the share of pixels that differ between two, and one image's darkest-percentile
// luminance against a colour.
const pixels = (page, a, b = null, against = null) =>
  page.evaluate(
    async ([a, b, against]) => {
      const decode = async (b64) => {
        const img = new Image();
        img.src = `data:image/png;base64,${b64}`;
        await img.decode();
        const c = document.createElement("canvas");
        c.width = img.width;
        c.height = img.height;
        const ctx = c.getContext("2d");
        ctx.drawImage(img, 0, 0);
        return ctx.getImageData(0, 0, c.width, c.height);
      };
      const lin = (v) => {
        const s = v / 255;
        return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
      };
      const lum = (r, g, bl) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(bl);
      const A = await decode(a);
      const out = { width: A.width, height: A.height };
      if (b) {
        const B = await decode(b);
        if (B.width !== A.width || B.height !== A.height) out.diff = 1;
        else {
          let n = 0;
          for (let i = 0; i < A.data.length; i += 4) {
            if (
              Math.abs(A.data[i] - B.data[i]) > 40 ||
              Math.abs(A.data[i + 1] - B.data[i + 1]) > 40 ||
              Math.abs(A.data[i + 2] - B.data[i + 2]) > 40
            )
              n++;
          }
          out.diff = n / (A.width * A.height);
        }
      }
      if (against) {
        const ls = [];
        for (let i = 0; i < A.data.length; i += 4) ls.push(lum(A.data[i], A.data[i + 1], A.data[i + 2]));
        ls.sort((x, y) => x - y);
        const dark = ls[Math.floor(ls.length * 0.01)];
        const m = against.match(/\d+(\.\d+)?/g).map(Number);
        const bg = lum(m[0], m[1], m[2]);
        out.contrast = (Math.max(dark, bg) + 0.05) / (Math.min(dark, bg) + 0.05);
        out.darkShare = ls.filter((l) => l < 0.1).length / ls.length;
      }
      return out;
    },
    [a, b, against],
  );

const swatchOf = (page, sel) =>
  page.evaluate((s) => {
    const probe = document.createElement("span");
    probe.style.color = "var(--fig)";
    document.querySelector(s).append(probe);
    const c = getComputedStyle(probe).color;
    probe.remove();
    return c;
  }, sel);

// Seed changes of the first turbulence over a window: their times, so the rate and the spacing both show.
const seedChanges = (page, sel, ms = WINDOW) =>
  page.evaluate(
    ([s, ms]) =>
      new Promise((resolve) => {
        const t = document.querySelector(`${s} svg.figure filter feTurbulence`);
        if (!t) return resolve(null);
        let last = t.getAttribute("seed");
        const times = [];
        const mo = new MutationObserver(() => {
          const v = t.getAttribute("seed");
          if (v !== last) {
            last = v;
            times.push(performance.now());
          }
        });
        mo.observe(t, { attributes: true, attributeFilter: ["seed"] });
        setTimeout(() => {
          mo.disconnect();
          resolve(times);
        }, ms);
      }),
    [sel, ms],
  );

// Six a second, give or take timer jitter, and never two changes closer than ~8 Hz would allow.
function rateOk(times, ms = WINDOW) {
  if (!times) return { pass: false, detail: "no filter" };
  const hz = times.length / (ms / 1000);
  const gaps = times.slice(1).map((t, i) => t - times[i]);
  const minGap = gaps.length ? Math.min(...gaps) : Infinity;
  return { pass: hz >= 4.5 && hz <= 6.7 && minGap >= 120, detail: `${hz.toFixed(2)} Hz, min gap ${minGap.toFixed(0)} ms` };
}

const timers = (page) => page.evaluate(() => window.__figureTimers());
const boiling = (page) => page.evaluate(() => [...document.querySelectorAll("section[data-boil='on']")].map((s) => s.getAttribute("aria-label")));

const setHidden = (page, hidden) =>
  page.evaluate((h) => {
    Object.defineProperty(document, "hidden", { configurable: true, get: () => h });
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => (h ? "hidden" : "visible") });
    document.dispatchEvent(new Event("visibilitychange"));
  }, hidden);

const noOverflow = (page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);

async function materials(page, phone, label) {
  const swatch = await swatchOf(page, CONSOLE);
  const shots = {};
  for (const hand of HANDS) {
    await pick(page, phone, CONSOLE, hand);
    const f = await filterOf(page, CONSOLE);
    const checked = await page.locator(`${CONSOLE} .machine-pen label`, { hasText: hand }).locator("input").isChecked();
    check(`${label}: ${hand} puts its own primitives and line weight in the filter`, f && signatureOk(f, hand) && checked && f.hand === hand.toLowerCase(), f ? `${f.prims.length} primitives, stroke ${f.stroke}, hand ${f.hand}` : "no filter");
    shots[hand] = await shot(page, CONSOLE, `${label}-${hand}`.replace(/\W+/g, "-"));
  }
  const pairs = [];
  for (let i = 0; i < HANDS.length; i++)
    for (let j = i + 1; j < HANDS.length; j++) pairs.push([HANDS[i], HANDS[j], (await pixels(page, shots[HANDS[i]], shots[HANDS[j]])).diff]);
  check(`${label}: the four hands render visibly different (>= 1% of pixels each pair)`, pairs.every(([, , d]) => d >= 0.01), pairs.map(([a, b, d]) => `${a}/${b} ${(d * 100).toFixed(1)}%`).join(", "));
  const quality = [];
  for (const hand of HANDS) quality.push([hand, await pixels(page, shots[hand], null, swatch)]);
  const ink = quality[0][1];
  check(
    `${label}: every hand's line work stays dark (>= 4.5:1 on the swatch) and present (>= 35% of ink's dark pixels)`,
    quality.every(([, q]) => q.contrast >= 4.5 && q.darkShare >= ink.darkShare * 0.35),
    quality.map(([h, q]) => `${h} ${q.contrast.toFixed(1)}:1 ${(q.darkShare * 100).toFixed(1)}%`).join(", "),
  );
  return shots;
}

async function desktopHome(browser, scheme) {
  const label = `desktop ${scheme} /`;
  const { context, page, phone } = await open(browser, { viewport: DESKTOP, scheme });
  try {
    await load(page, "/", CONSOLE);
    for (const sel of [CONSOLE, BOARD]) {
      const f = await filterOf(page, sel);
      check(`${label}: ${sel.match(/"(.*)"/)[1]} draws the house ink filter exactly`, f && same(f.prims, HOUSE) && f.stroke === "2.4" && f.linked && f.hand === "ink" && f.seed === "0", f ? JSON.stringify(f.prims).slice(0, 120) : "no filter");
    }
    const rest = await timers(page);
    const idle = await seedChanges(page, CONSOLE, 1500);
    check(`${label}: Boil is off at rest: not pressed, no seed change, no figure timer`, (await boilChip(page, CONSOLE).getAttribute("aria-pressed")) === "false" && idle?.length === 0 && rest === 0, `pressed ${await boilChip(page, CONSOLE).getAttribute("aria-pressed")}, ${idle?.length} changes, ${rest} timers`);

    const inkA = await shot(page, CONSOLE, `${label}-ink-a`.replace(/\W+/g, "-"));
    await materials(page, phone, label);

    // Re-roll moves every turbulence seed by the same step and nothing else, and the strokes visibly move.
    await pick(page, phone, CONSOLE, "Crayon");
    const before = await filterOf(page, CONSOLE);
    const b64 = await shot(page, CONSOLE, "reroll-before");
    await press(page, phone, CONSOLE, "Re-roll the strokes");
    const after = await filterOf(page, CONSOLE);
    const steps = seeds(after).map((s, i) => s - seeds(before)[i]);
    const moved = (await pixels(page, b64, await shot(page, CONSOLE, "reroll-after"))).diff;
    check(`${label}: Re-roll moves every turbulence seed and nothing else`, steps.length > 0 && steps.every((d) => d !== 0 && d === steps[0]) && same(withoutSeeds(before), withoutSeeds(after)) && after.seed !== before.seed && after.hand === "crayon", `steps ${steps}, seed ${before.seed} -> ${after.seed}`);
    check(`${label}: re-rolled strokes render differently (>= 0.3% of pixels)`, moved >= 0.003, `${(moved * 100).toFixed(2)}%`);

    // Back to Ink at the re-rolled seed, then a reload: the house filter (nothing is kept).
    await pick(page, phone, CONSOLE, "Ink");
    const back = await filterOf(page, CONSOLE);
    check(`${label}: Ink again is the house filter at the new seed`, same(withoutSeeds(back), withoutSeeds({ prims: HOUSE })) && back.stroke === "2.4");
    await load(page, "/", CONSOLE);
    const fresh = await filterOf(page, CONSOLE);
    const inkB = await shot(page, CONSOLE, `${label}-ink-b`.replace(/\W+/g, "-"));
    check(`${label}: a reload is back to the house ink (no persistence)`, same(fresh.prims, HOUSE) && fresh.hand === "ink");
    const twin = (await pixels(page, inkA, inkB)).diff;
    check(`negative control (${label}): two house-ink renders fail the distinction check`, !(twin >= 0.01), `${(twin * 100).toFixed(2)}%`);

    // Boil: six a second, one figure at a time, and off again.
    await boilChip(page, CONSOLE).click();
    const times = await seedChanges(page, CONSOLE);
    const rate = rateOk(times);
    check(`${label}: Boil changes the console's actual seed about six times a second`, rate.pass && (await boiling(page)).join() === "Pocket console", rate.detail);
    check(`${label}: a boil runs one figure timer`, (await timers(page)) === 1, `${await timers(page)} timers`);
    const f = await filterOf(page, CONSOLE);
    check(`${label}: the boiling filter's seeds follow the figure's seed`, seeds(f)[0] === 3 + Number(f.seed) && seeds(f)[1] === 8 + Number(f.seed), `${seeds(f)} for ${f.seed}`);

    await boilChip(page, BOARD).click();
    await page.locator(`${BOARD} .machine-figure`).scrollIntoViewIfNeeded();
    const [consoleAfter, boardAfter] = await Promise.all([seedChanges(page, CONSOLE, 1500), seedChanges(page, BOARD, 1500)]);
    // the console lets go outright (no data-boil, not merely held for being out of view)
    const consoleBoil = await page.evaluate((s) => document.querySelector(s).dataset.boil ?? "none", CONSOLE);
    check(
      `${label}: pressing the switchboard's Boil hands it over (one boiling figure)`,
      consoleAfter.length === 0 && consoleBoil === "none" && boardAfter.length >= 6 && (await boiling(page)).join() === "Switchboard" && (await boilChip(page, CONSOLE).getAttribute("aria-pressed")) === "false" && (await timers(page)) === 1,
      `console ${consoleAfter.length} (${consoleBoil}), board ${boardAfter.length}, boiling ${await boiling(page)}, ${await timers(page)} timers`,
    );

    // A hidden document stops it; shown again, it carries on.
    await setHidden(page, true);
    await sleep(100);
    const hidden = await seedChanges(page, BOARD, 1200);
    check(`${label}: a hidden page stops the boil and its timer`, hidden.length === 0 && (await timers(page)) === 0, `${hidden.length} changes, ${await timers(page)} timers`);
    await setHidden(page, false);
    const shown = await seedChanges(page, BOARD, 1200);
    check(`${label}: shown again, the boil carries on`, shown.length >= 4, `${shown.length} changes`);

    await boilChip(page, BOARD).click();
    await page.evaluate(() => scrollTo({ top: 0, behavior: "instant" }));
    const off = await seedChanges(page, BOARD, 1200);
    check(`${label}: pressing Boil again stops it and its timer`, off.length === 0 && (await timers(page)) === 0 && (await boiling(page)).length === 0, `${off.length} changes, ${await timers(page)} timers`);

    // Live reduced motion: the boil stops, lets go, and stays off when the preference goes away again.
    await boilChip(page, CONSOLE).click();
    await page.evaluate(() => scrollTo({ top: 0, behavior: "instant" }));
    await sleep(400);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await sleep(150);
    const reduced = await seedChanges(page, CONSOLE, 1200);
    check(`${label}: switching to reduced motion mid-boil stops it and disables Boil`, reduced.length === 0 && (await timers(page)) === 0 && (await boilChip(page, CONSOLE).getAttribute("aria-disabled")) === "true" && (await boilChip(page, CONSOLE).getAttribute("aria-pressed")) === "false", `${reduced.length} changes, ${await timers(page)} timers`);
    await page.emulateMedia({ reducedMotion: "no-preference" });
    const resumed = await seedChanges(page, CONSOLE, 800);
    check(`${label}: and it does not start again when the preference goes`, resumed.length === 0 && (await boiling(page)).length === 0);

    // Keyboard: arrows move the hand, Tab reaches Re-roll and Enter re-rolls, each with a visible ring.
    await page.locator(`${CONSOLE} .machine-knobs input[type="range"]`).focus();
    await page.keyboard.press("Tab");
    await page.keyboard.press("ArrowRight");
    const ring = await page.evaluate((s) => {
      const label = document.querySelector(`${s} .machine-pen label:has(:focus-visible)`);
      return label ? { text: label.textContent, outline: getComputedStyle(label).outlineStyle } : null;
    }, CONSOLE);
    const kbHand = (await filterOf(page, CONSOLE)).hand;
    check(`${label}: the hands work by arrow keys with a visible focus ring`, kbHand === "pencil" && ring?.outline !== "none" && ring?.text === "Pencil", JSON.stringify({ kbHand, ring }));
    const seedBefore = (await filterOf(page, CONSOLE)).seed;
    await page.keyboard.press("Tab");
    const focused = await page.evaluate(() => [document.activeElement?.getAttribute("aria-label"), getComputedStyle(document.activeElement).outlineStyle]);
    await page.keyboard.press("Enter");
    await sleep(50);
    check(`${label}: Tab reaches Re-roll, with a ring, and Enter re-rolls`, focused[0] === "Re-roll the strokes" && focused[1] !== "none" && (await filterOf(page, CONSOLE)).seed !== seedBefore && page.url() === `${BASE_URL}/`, `${focused}, ${page.url()}`);
    check(`${label}: nothing scrolls sideways`, await noOverflow(page));
  } finally {
    await context.close();
  }
}

// /work: the pipeline and the rack; a figure scrolled out of view stops boiling and picks up when it is back.
async function work(browser, viewport, scheme) {
  const label = `${viewport === PHONE ? "phone" : "desktop"} ${scheme} /work`;
  const { context, page, phone } = await open(browser, { viewport, scheme });
  try {
    await load(page, "/work", PIPELINE);
    for (const sel of [PIPELINE, RACK]) {
      const f = await filterOf(page, sel);
      check(`${label}: ${sel.match(/"(.*)"/)[1]} draws the house ink filter exactly`, f && same(f.prims, HOUSE) && f.stroke === "2.4");
    }
    await boilChip(page, RACK).scrollIntoViewIfNeeded();
    await (phone ? boilChip(page, RACK).tap() : boilChip(page, RACK).click());
    // the rack's figure can sit wholly above its knobs' view: pressed there, the boil is held until it is seen
    const held = await page.evaluate((s) => {
      const r = document.querySelector(`${s} .machine-figure`).getBoundingClientRect();
      return r.bottom < 0 || r.top > innerHeight ? document.querySelector(s).dataset.boil : "seen";
    }, RACK);
    check(`${label}: pressed with its figure out of view, the rack's boil is held, not running`, held === "seen" || held === "held", held);
    await page.locator(`${RACK} .machine-figure`).scrollIntoViewIfNeeded();
    const on = await seedChanges(page, RACK, 1500);
    check(`${label}: the rack boils in view`, on.length >= 6 && (await boiling(page)).join() === "Server rack", `${on.length} changes`);
    // scroll the rack's figure fully out of the viewport, above or below
    const away = await page.evaluate((s) => {
      const fig = document.querySelector(`${s} .machine-figure`);
      const r = fig.getBoundingClientRect();
      scrollTo({ top: r.top + scrollY > innerHeight ? 0 : r.bottom + scrollY + 40, behavior: "instant" });
      const q = fig.getBoundingClientRect();
      return q.bottom < 0 || q.top > innerHeight;
    }, RACK);
    await sleep(200);
    const off = await seedChanges(page, RACK, 1200);
    check(`${label}: scrolled out of view, the boil stops and its timer with it`, away && off.length === 0 && (await timers(page)) === 0, `away ${away}, ${off.length} changes, ${await timers(page)} timers`);
    await page.locator(`${RACK} .machine-figure`).scrollIntoViewIfNeeded();
    const back = await seedChanges(page, RACK, 1200);
    check(`${label}: back in view, it boils again`, back.length >= 4, `${back.length} changes`);
    // the other machine takes over
    await boilChip(page, PIPELINE).scrollIntoViewIfNeeded();
    await (phone ? boilChip(page, PIPELINE).tap() : boilChip(page, PIPELINE).click());
    await page.locator(`${PIPELINE} .machine-figure`).scrollIntoViewIfNeeded();
    await sleep(200);
    check(`${label}: the pipeline's Boil takes it from the rack`, (await boiling(page)).join() === "Data pipeline" && (await boilChip(page, RACK).getAttribute("aria-pressed")) === "false");
    await (phone ? boilChip(page, PIPELINE).tap() : boilChip(page, PIPELINE).click());
    await sleep(150);
    check(`${label}: off again, no figure timer runs`, (await timers(page)) === 0 && (await boiling(page)).length === 0);
    if (phone) {
      // the hands by touch
      await page.evaluate(() => scrollTo({ top: 0, behavior: "instant" }));
      for (const hand of ["Watercolour", "Pencil"]) {
        await pick(page, phone, PIPELINE, hand);
        const f = await filterOf(page, PIPELINE);
        check(`${label}: a tap on ${hand} draws in it`, f && signatureOk(f, hand));
      }
    }
    check(`${label}: nothing scrolls sideways`, await noOverflow(page));
  } finally {
    await context.close();
  }
}

async function phoneHome(browser, scheme) {
  const label = `phone ${scheme} /`;
  const { context, page, phone } = await open(browser, { viewport: PHONE, scheme });
  try {
    await load(page, "/", CONSOLE);
    const f = await filterOf(page, CONSOLE);
    check(`${label}: the console draws the house ink filter exactly`, f && same(f.prims, HOUSE) && f.stroke === "2.4");
    await materials(page, phone, label);
    await page.evaluate(() => scrollTo({ top: 0, behavior: "instant" }));
    const before = (await filterOf(page, CONSOLE)).seed;
    await press(page, phone, CONSOLE, "Re-roll the strokes");
    check(`${label}: a tap on Re-roll re-rolls`, (await filterOf(page, CONSOLE)).seed !== before);
    await press(page, phone, CONSOLE, "Boil the lines");
    await boilChip(page, CONSOLE).scrollIntoViewIfNeeded();
    const rate = rateOk(await seedChanges(page, CONSOLE));
    check(`${label}: a tap on Boil boils at about six a second`, rate.pass, rate.detail);
    await press(page, phone, CONSOLE, "Boil the lines");
    check(`${label}: a second tap stops it`, (await timers(page)) === 0 && (await boiling(page)).length === 0);
    const knobs = await page.evaluate((s) => {
      const sec = document.querySelector(s).getBoundingClientRect();
      return [...document.querySelectorAll(`${s} .machine-knobs > *, ${s} .machine-pen > *`)].every((el) => {
        const r = el.getBoundingClientRect();
        return r.left >= sec.left - 1 && r.right <= sec.right + 1;
      });
    }, CONSOLE);
    check(`${label}: the knobs fit inside the machine and nothing scrolls sideways`, knobs && (await noOverflow(page)));
  } finally {
    await context.close();
  }
}

// Reduced motion from load: Boil is disabled and does nothing; Hand and Re-roll still change the filter.
async function reducedFromLoad(browser, init = null, sink = errors) {
  const { context, page } = await open(browser, { viewport: DESKTOP, reduced: true, init, sink });
  try {
    await load(page, "/", CONSOLE);
    // forced: the chip is aria-disabled, and the press must still do nothing
    await boilChip(page, CONSOLE).click({ force: true });
    const changes = await seedChanges(page, CONSOLE, 1500);
    const t = await timers(page);
    return { context, page, pass: changes?.length === 0 && t === 0, detail: `${changes?.length} changes, ${t} timers` };
  } catch (e) {
    await context.close();
    throw e;
  }
}

async function reduced(browser) {
  const { context, page, pass, detail } = await reducedFromLoad(browser);
  try {
    const chip = boilChip(page, CONSOLE);
    check("reduced motion: Boil is disabled and a press does not boil", pass && (await chip.getAttribute("aria-disabled")) === "true" && (await chip.getAttribute("aria-pressed")) === "false" && Boolean(await chip.getAttribute("aria-describedby")), detail);
    await pick(page, false, CONSOLE, "Watercolour");
    const f = await filterOf(page, CONSOLE);
    await press(page, false, CONSOLE, "Re-roll the strokes");
    const g = await filterOf(page, CONSOLE);
    check("reduced motion: Hand and Re-roll still change the filter", signatureOk(f, "Watercolour") && g.seed !== f.seed && signatureOk(g, "Watercolour"));
  } finally {
    await context.close();
  }

  // a plain server-drawn Figure (the parcel on /notes) draws the house ink too
  const { context: c2, page: p2 } = await open(browser, { viewport: DESKTOP });
  try {
    const res = await p2.goto(`${BASE_URL}/notes`, { waitUntil: "load" });
    const f = await filterOf(p2, "main");
    check("a plain Figure outside a machine (/notes) draws the house ink filter exactly", res?.ok() && f && same(f.prims, HOUSE) && f.stroke === "2.4", `${res?.status()} ${f ? JSON.stringify(f.prims).slice(0, 80) : "no filter"}`);
  } finally {
    await c2.close();
  }
}

async function negatives(browser) {
  const sink = [];
  // A doubled figure clock: the same rate bound must fail.
  {
    const { context, page } = await open(browser, {
      viewport: DESKTOP,
      sink,
      init: () => {
        const set = window.setInterval;
        window.setInterval = (fn, ms, ...rest) => set(fn, Math.abs(ms - 1000 / 12) < 0.5 ? ms / 2 : ms, ...rest);
      },
    });
    try {
      await load(page, "/", CONSOLE);
      await boilChip(page, CONSOLE).click();
      const rate = rateOk(await seedChanges(page, CONSOLE));
      check("negative control: with the figure clock doubled, the six-a-second bound catches it", !rate.pass, rate.detail);
    } finally {
      await context.close();
    }
  }
  // The reduced-motion read bypassed: the same reduced-motion stop must fail.
  {
    const { context, pass, detail } = await reducedFromLoad(
      browser,
      () => {
        const real = window.matchMedia.bind(window);
        window.matchMedia = (q) => real(q.includes("prefers-reduced-motion: reduce") ? "not all" : q);
      },
      sink,
    );
    await context.close();
    check("negative control: with the reduced-motion read bypassed, the reduced-motion stop catches the boil", !pass, detail);
  }
  // visibilitychange swallowed: the same hidden stop must fail.
  {
    const { context, page } = await open(browser, {
      viewport: DESKTOP,
      sink,
      init: () => {
        const add = Document.prototype.addEventListener;
        Document.prototype.addEventListener = function (type, ...rest) {
          if (type === "visibilitychange") return;
          return add.call(this, type, ...rest);
        };
      },
    });
    try {
      await load(page, "/", CONSOLE);
      await boilChip(page, CONSOLE).click();
      await sleep(300);
      await setHidden(page, true);
      await sleep(100);
      const hidden = await seedChanges(page, CONSOLE, 1200);
      check("negative control: with visibilitychange swallowed, the hidden-page stop catches the boil", !(hidden.length === 0 && (await timers(page)) === 0), `${hidden.length} changes`);
    } finally {
      await context.close();
    }
  }
}

if (EXPECT_SHA) {
  const html = await (await fetch(BASE_URL + "/")).text();
  const sha = html.match(/<meta name="build-sha" content="([^"]*)"/)?.[1] ?? "none";
  check(`build-sha is ${EXPECT_SHA}`, sha === EXPECT_SHA, sha);
}

const browser = await chromium.launch();
try {
  for (const scheme of ["light", "dark"]) await desktopHome(browser, scheme);
  for (const scheme of ["light", "dark"]) await phoneHome(browser, scheme);
  for (const scheme of ["light", "dark"]) await work(browser, DESKTOP, scheme);
  await work(browser, PHONE, "light");
  await reduced(browser);
  await negatives(browser);
  check("no console errors or page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
} finally {
  await browser.close();
}

console.log(`probe: ${ok} ok, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
