// Drives headless Chromium over the pocket console's game. Run by scripts/probe-pocket-game.sh, which installs
// Playwright into PW_PREFIX and passes BASE_URL, ROOT (and EXPECT_SHA, checked if set), with type stripping on
// so this file can play lib/snake.ts itself.
//
// The checkout-only fixture: an init script arms Math.random with a chosen value for the one call B's press
// makes (it arms on the B keydown or B chip click, in the capture phase, before the page's own handler runs),
// so the board B deals has a known seed. Nothing in the shipped page reads a fixture. The page's state is read
// from the game's data-* attributes and the console's readout, never set.
import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";

const require = createRequire(path.join(process.env.PW_PREFIX, "package.json"));
const { chromium } = require("playwright");
const S = await import(pathToFileURL(path.join(process.env.ROOT, "lib/snake.ts")).href);

const BASE_URL = process.env.BASE_URL;
const EXPECT_SHA = process.env.EXPECT_SHA ?? "";
const PHONE = { width: 390, height: 844 };
const DESKTOP = { width: 1366, height: 768 };
const FIX = 0.3141592; // the fixture's Math.random value for B's deal
const seedOf = (v) => Math.floor(v * 2 ** 32);
const CONSOLE = 'section[aria-label="Pocket console"]';

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
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function instrument({ blockStorage, storage, sound }) {
  if (blockStorage) {
    const deny = () => {
      throw new DOMException("probe: storage denied", "SecurityError");
    };
    Object.defineProperty(window, "localStorage", { configurable: true, get: deny });
  } else {
    // only on the first load of this context's origin: a reload keeps what the page stored
    if (!sessionStorage.getItem("probe:seeded")) {
      sessionStorage.setItem("probe:seeded", "1");
      for (const [k, v] of Object.entries(storage ?? {})) localStorage.setItem(k, v);
      if (sound) localStorage.setItem("sound", sound);
    }
  }
  // the seed fixture
  const real = Math.random;
  let armed = null;
  const arm = () => {
    if (window.__seedNext != null) {
      armed = window.__seedNext;
      window.__seedNext = null;
    }
  };
  addEventListener("keydown", (e) => (e.key === "b" || e.key === "B") && arm(), true);
  addEventListener("click", (e) => e.target instanceof Element && e.target.closest("button")?.textContent?.includes("B Play") && arm(), true);
  Math.random = function () {
    if (armed !== null) {
      const v = armed;
      armed = null;
      return v;
    }
    return real();
  };
  // an AudioContext spy
  const a = (window.__audio = { made: 0, starts: 0 });
  const Real = window.AudioContext;
  if (Real) {
    const start = OscillatorNode.prototype.start;
    OscillatorNode.prototype.start = function (...args) {
      a.starts++;
      return start.apply(this, args);
    };
    window.AudioContext = class extends Real {
      constructor(...args) {
        super(...args);
        a.made++;
      }
    };
  }
}

async function open(browser, { viewport = DESKTOP, scheme = "light", reduced = false, js = true, blockStorage = false, storage = null, sound = null } = {}) {
  const phone = viewport === PHONE;
  const context = await browser.newContext({
    viewport,
    isMobile: phone,
    hasTouch: phone,
    javaScriptEnabled: js,
    colorScheme: scheme,
    reducedMotion: reduced ? "reduce" : "no-preference",
  });
  await context.addInitScript({ content: `(${instrument.toString()})(${JSON.stringify({ blockStorage, storage, sound })})` });
  const page = await context.newPage();
  page.on("console", (m) => m.type() === "error" && errors.push(`console ${page.url()}: ${m.text()}`));
  page.on("pageerror", (e) => errors.push(`pageerror ${page.url()}: ${e.message}`));
  return { context, page };
}

async function home(page) {
  await page.goto(BASE_URL + "/", { waitUntil: "load" });
  await page.waitForFunction(
    (sel) => {
      const sec = [...document.querySelectorAll(sel)].find((s) => s.checkVisibility());
      const b = sec && [...sec.querySelectorAll("button")].find((x) => x.textContent?.includes("Down"));
      return b && Object.keys(b).some((k) => k.startsWith("__reactProps"));
    },
    CONSOLE,
    { timeout: 15000 },
  );
  await page.evaluate(() => scrollTo({ top: 0, behavior: "instant" }));
}

// The visible console's game, readout and stored values.
const read = (page) =>
  page.evaluate((sel) => {
    const sec = [...document.querySelectorAll(sel)].find((s) => s.checkVisibility());
    const g = sec?.querySelector("g.pocket-game");
    const n = (k) => (g && g.dataset[k] !== undefined && g.dataset[k] !== "" ? Number(g.dataset[k]) : null);
    let store;
    try {
      store = { high: localStorage.getItem("pocket:high"), ach: localStorage.getItem("pocket:achievement"), end: localStorage.getItem("end:achievement") };
    } catch {
      store = "blocked";
    }
    return {
      game: !!g,
      status: g?.dataset.status ?? null,
      score: n("score"),
      best: n("best"),
      steps: n("steps"),
      head: n("head"),
      food: n("food"),
      length: n("length"),
      wrap: !!g?.hasAttribute("data-wrap"),
      badge: !!sec?.querySelector("[data-pocket-achievement]"),
      readout: sec?.querySelector(".readout")?.textContent ?? "",
      menuHidden: sec?.querySelector("g.boot")?.getAttribute("visibility") === "hidden",
      links: sec ? sec.querySelectorAll('nav[aria-label="Pages"] a').length : 0,
      chips: sec ? [...sec.querySelectorAll(".machine-controls button")].map((b) => b.textContent.trim()) : [],
      store,
      scrollY,
    };
  }, CONSOLE);

const chip = (page, text) => page.locator(`${CONSOLE}:visible .machine-controls button`, { hasText: text }).first();
const audio = (page) => page.evaluate(() => ({ ...window.__audio }));
const armSeed = (page, v = FIX) => page.evaluate((x) => (window.__seedNext = x), v);
const KEY = { up: "ArrowUp", down: "ArrowDown", left: "ArrowLeft", right: "ArrowRight", a: "a", b: "b" };
async function keys(page, list) {
  for (const k of list) await page.keyboard.press(KEY[k] ?? k);
}
const waitFor = async (page, pred, ms = 8000) => {
  const until = Date.now() + ms;
  let s = await read(page);
  while (!pred(s) && Date.now() < until) {
    await sleep(100);
    s = await read(page);
  }
  return s;
};

// The engine's game for the fixture's seed, as B deals it.
const dealt = (v = FIX) => S.newSnake(seedOf(v));
const same = (dom, model) => dom.head === model.body[0] && dom.food === model.food && dom.score === model.score && dom.length === model.body.length;

// A step towards the food that the engine says survives.
function choose(model) {
  const [hx, hy] = S.xy(model.body[0]);
  const [fx, fy] = S.xy(model.food);
  const prefer = [fx > hx ? "right" : fx < hx ? "left" : null, fy > hy ? "down" : fy < hy ? "up" : null].filter(Boolean);
  for (const d of [...prefer, "up", "down", "left", "right"]) {
    const next = S.snake(model, { type: "step", dir: d });
    if (next !== model && next.status === "playing") return [d, next];
  }
  return [null, model];
}

// Reduced motion, a fixed seed: the browser and the engine play the same game, cell by cell, two records.
async function deterministic(browser) {
  const { context, page } = await open(browser, { reduced: true, sound: "on" });
  try {
    await home(page);
    await armSeed(page);
    await page.keyboard.press("b");
    let dom = await read(page);
    let model = dealt();
    check("B opens snake inside the LCD; the menu text hides, its six links stay", dom.game && dom.status === "ready" && dom.menuHidden && dom.links === 6, JSON.stringify(dom));
    check("seeded fixture: the first record lands where lib/snake.ts says for the seed", same(dom, model), `dom ${dom.food}, engine ${model.food}`);
    // negative control: the same comparison against a neighbouring seed
    check("negative control: the same comparison against seed+1 fails", !same(dom, S.newSnake(seedOf(FIX) + 1)), "an unpinned seed would pass this too");
    await sleep(1200);
    check("reduced motion: no clock, the ready board does not move", (await read(page)).steps === 0);
    let mismatch = null;
    let moves = 0;
    while (model.score < 2 && moves < 80) {
      const [d, next] = choose(model);
      if (!d) break;
      await page.keyboard.press(KEY[d]);
      model = next;
      moves++;
      dom = await read(page);
      if (!same(dom, model) || dom.steps !== model.steps) {
        mismatch = { moves, dom, engine: { head: model.body[0], food: model.food, score: model.score, steps: model.steps } };
        break;
      }
    }
    check("each arrow moves exactly one cell, matching the engine step by step", !mismatch && moves > 0, JSON.stringify(mismatch));
    check("two records eaten: score 2, length 5, new food from the seed", dom.score === 2 && dom.length === 5 && dom.food === model.food, JSON.stringify(dom));
    const before = dom.steps;
    await sleep(1200);
    check("reduced motion: still no clock mid-game", (await read(page)).steps === before);
    check("readout announces the score, not every move", /^Score 2\. Best 2\.$/.test(dom.readout), dom.readout);
    check("the best score is stored as pocket:high", dom.store.high === "2", JSON.stringify(dom.store));
    const a = await audio(page);
    check("sound on: B, the steering and the records beep through one context", a.made === 1 && a.starts > moves, JSON.stringify(a));
    // reload: the best comes back
    await home(page);
    await page.keyboard.press("b");
    dom = await read(page);
    check("after a reload the best score is restored", dom.best === 2 && /Best 2\./.test(dom.readout), `${dom.best} / ${dom.readout}`);
  } finally {
    await context.close();
  }
}

// Normal motion: the clock, a crash, restart, menu round trip, offscreen hold and a live reduced switch.
async function clock(browser) {
  const { context, page } = await open(browser);
  try {
    await home(page);
    await page.keyboard.press("ArrowDown");
    const menu = (await read(page)).readout;
    check("menu: the arrow moves the cursor", menu === "Press A to open play.", menu);
    await armSeed(page);
    await page.keyboard.press("b");
    await page.keyboard.press("ArrowDown"); // steers the ready train, not the cursor
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("a");
    let s = await read(page);
    check("A starts the game", s.status === "playing", JSON.stringify(s));
    await sleep(900);
    s = await read(page);
    check("the train moves on its own clock", s.steps >= 1 && s.status === "playing", JSON.stringify(s));
    s = await waitFor(page, (x) => x.status === "over", 9000);
    check("heading right it crashes into the wall at x=15 and the game is over", s.status === "over" && S.xy(s.head)[0] === 15 && /^Crashed with 0/.test(s.readout), JSON.stringify(s));
    const settled = s.steps;
    await sleep(600);
    check("a lost game stops its clock", (await read(page)).steps === settled);
    await page.keyboard.press("a");
    s = await read(page);
    check("A restarts: playing again from three cells", s.status === "playing" && s.length === 3 && s.score === 0 && s.steps === 0, JSON.stringify(s));
    // offscreen: the board holds still
    await page.evaluate(() => scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" }));
    await sleep(400);
    const off = (await read(page)).steps;
    await sleep(1200);
    const off2 = await read(page);
    check("scrolled off screen the game holds still", off2.steps === off && off2.status === "playing", `${off} -> ${off2.steps}`);
    await page.keyboard.press("b");
    check("scrolled away, the console ignores B", (await read(page)).game === true);
    await page.evaluate(() => scrollTo({ top: 0, behavior: "instant" }));
    s = await waitFor(page, (x) => x.steps > off, 3000);
    check("back on screen it moves again", s.steps > off, `${off} -> ${s.steps}`);
    // a live switch to reduced motion stops the clock; arrows step
    await page.emulateMedia({ reducedMotion: "reduce" });
    await sleep(300);
    s = await read(page);
    await sleep(1000);
    const held = await read(page);
    check("live reduced motion: the clock stops", held.steps === s.steps, `${s.steps} -> ${held.steps}`);
    if (held.status === "playing") {
      const turn = S.xy(held.head)[1] < 7 ? "ArrowDown" : "ArrowUp";
      await page.keyboard.press(turn);
      const stepped = await read(page);
      check("live reduced motion: one arrow, one cell", stepped.steps === held.steps + 1 || stepped.status === "over", `${held.steps} -> ${stepped.steps}`);
    } else {
      check("live reduced motion: one arrow, one cell", false, `game already ${held.status}`);
    }
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.keyboard.press("b");
    s = await read(page);
    check("B goes back to the menu with the cursor where it was", !s.game && !s.menuHidden && s.readout === menu && s.links === 6, JSON.stringify(s));
    await page.keyboard.press("ArrowDown");
    check("menu navigation survives the game", (await read(page)).readout === "Press A to open notes.");
    const a = await audio(page);
    check("sound off: the whole game made no AudioContext", a.made === 0 && a.starts === 0, JSON.stringify(a));
  } finally {
    await context.close();
  }
}

const listenLate = (page) =>
  page.evaluate(() => {
    window.__late = [];
    addEventListener("keydown", (e) => window.__late.push({ key: e.key, handled: e.defaultPrevented }));
  });

// The console's code, and the footer's.
async function konami(browser) {
  const CODE = ["up", "up", "down", "down", "left", "right", "left", "right", "b", "a"];
  const { context, page } = await open(browser);
  try {
    await home(page);
    // Home keeps its footer below the fold at any viewport height, so the footer's listener (attached only
    // while it is in view) is never live while the console works its keys at scrollY 0. As well as that, the
    // console marks every key it takes: a bubble-phase window listener, the footer's spot, with the footer's
    // defaultPrevented guard, records what still reaches it unhandled.
    await listenLate(page);
    await page.keyboard.press("b");
    // wrong order
    await keys(page, ["up", "up", "down", "down", "left", "right", "left", "right", "a"]);
    let s = await read(page);
    check("a wrong code does not unlock (its A starts the game as usual)", !s.badge && !s.wrap && s.store.ach === null && s.status === "playing", JSON.stringify(s));
    await page.keyboard.press("b"); // to the menu
    await page.keyboard.press("b"); // a new ready board
    // typed into a form control: nothing
    // focus scrolls the slider into view; back to the top with the focus kept, so only the guard can say no
    await page.locator(`${CONSOLE}:visible input[type="range"]`).focus();
    await page.evaluate(() => scrollTo({ top: 0, behavior: "instant" }));
    const focused = await page.evaluate(() => scrollY === 0 && document.activeElement?.matches('input[type="range"]'));
    await keys(page, CODE);
    s = await read(page);
    check(
      "the code typed into a form control (console at the top) unlocks nothing",
      focused && !s.badge && s.store.ach === null && s.store.end === null && s.game && s.status === "ready",
      JSON.stringify({ focused, ...s }),
    );
    // focusing the slider scrolled it into view, which turns the console's keys off: back to the top
    await page.evaluate(() => {
      document.activeElement?.blur();
      scrollTo({ top: 0, behavior: "instant" });
    });
    s = await read(page);
    const readyBefore = s.status;
    await keys(page, CODE);
    s = await read(page);
    check("the code on the console unlocks the pocket achievement and debug wrap", s.badge && s.wrap && s.store.ach === "1" && /walls wrap/.test(s.readout), JSON.stringify(s));
    check("the code's B and A are taken by the code: still in the game, not restarted", s.game && s.status === readyBefore, `${readyBefore} -> ${s.status}`);
    check("footer isolation: the footer saw none of it (end:achievement unset)", s.store.end === null, JSON.stringify(s.store));
    const late = (await page.evaluate(() => window.__late)).slice(-CODE.length);
    check(
      "footer isolation: every key of the code reached the footer's listener already handled",
      late.length === CODE.length && late.every((e) => e.handled),
      JSON.stringify(late.filter((e) => !e.handled)),
    );
    await page.keyboard.press("a");
    s = await waitFor(page, (x) => x.steps >= 11 || x.status !== "playing", 10000);
    check("debug mode: the train wraps through the wall instead of crashing", s.status === "playing" && s.steps >= 11, JSON.stringify(s));
    // reload keeps the achievement
    await home(page);
    await page.keyboard.press("b");
    s = await read(page);
    check("after a reload the achievement and wrap come back", s.badge && s.wrap, JSON.stringify(s));
    await listenLate(page);
    // positive control: scrolled away, the console lets the code through to the footer
    await page.keyboard.press("b");
    await page.evaluate(() => scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" }));
    await sleep(600);
    await page.evaluate(() => localStorage.removeItem("pocket:achievement"));
    await keys(page, CODE);
    await sleep(300);
    s = await read(page);
    const reached = (await page.evaluate(() => window.__late)).slice(-CODE.length);
    check("positive control: scrolled to the footer, the console leaves the keys unhandled", reached.every((e) => !e.handled), JSON.stringify(reached));
    check("positive control: and the same code unlocks the footer, not the console", s.store.end === "1" && s.store.ach === null, JSON.stringify(s.store));
  } finally {
    await context.close();
  }
}

async function storage(browser) {
  {
    const { context, page } = await open(browser, { storage: { "pocket:high": "9999x", "pocket:achievement": "yes" } });
    try {
      await home(page);
      await page.keyboard.press("b");
      const s = await read(page);
      check("corrupt storage: best 0, no achievement, the game opens", s.game && s.best === 0 && !s.badge && !s.wrap, JSON.stringify(s));
    } finally {
      await context.close();
    }
  }
  {
    const { context, page } = await open(browser, { blockStorage: true, reduced: true });
    try {
      await home(page);
      await page.keyboard.press("b");
      await page.keyboard.press("a");
      await page.keyboard.press("ArrowDown");
      await page.keyboard.press("ArrowRight");
      const s = await read(page);
      check("blocked storage: the game still plays", s.game && s.status === "playing" && s.steps === 2 && s.store === "blocked", JSON.stringify(s));
    } finally {
      await context.close();
    }
  }
}

// Each size and theme: chips, taps on touch, the board inside the LCD, no overflow.
async function matrix(browser, viewport, scheme) {
  const label = `${viewport === PHONE ? "390x844" : "1366x768"} ${scheme}`;
  const { context, page } = await open(browser, { viewport, scheme });
  try {
    await home(page);
    const tap = async (text) => (viewport === PHONE ? chip(page, text).tap() : chip(page, text).click());
    await tap("B Play");
    let s = await read(page);
    check(`${label}: the B chip opens the game with four labelled directions, A and B`, s.game && ["▲ Up", "▼ Down", "◀ Left", "▶ Right", "A Start", "B Menu"].every((c) => s.chips.includes(c)), s.chips.join(","));
    const fit = await page.evaluate((sel) => {
      const sec = [...document.querySelectorAll(sel)].find((x) => x.checkVisibility());
      const lcd = sec.querySelector("rect.boot-lcd").getBoundingClientRect();
      const g = sec.querySelector("g.pocket-game").getBoundingClientRect();
      const chips = [...sec.querySelectorAll(".machine-controls button")].map((b) => b.getBoundingClientRect());
      return {
        inside: g.left >= lcd.left - 3 && g.right <= lcd.right + 3 && g.top >= lcd.top - 3 && g.bottom <= lcd.bottom + 3,
        overflow: document.documentElement.scrollWidth - innerWidth,
        chips: chips.every((r) => r.width > 0 && r.right <= innerWidth + 0.5),
      };
    }, CONSOLE);
    check(`${label}: the board sits inside the LCD`, fit.inside, JSON.stringify(fit));
    check(`${label}: no horizontal overflow and every chip on screen`, fit.overflow <= 0 && fit.chips, JSON.stringify(fit));
    await tap("A Start");
    await tap("▼ Down");
    s = await waitFor(page, (x) => x.steps >= 1, 3000);
    check(`${label}: A starts it and the d-pad chips steer`, s.status === "playing" && s.steps >= 1, JSON.stringify(s));
    await tap("B Menu");
    s = await read(page);
    check(`${label}: the B chip goes back to the menu`, !s.game && !s.menuHidden && s.chips.includes("A Open") && s.chips.includes("B Play"), JSON.stringify(s));
    // keyboard focus on a chip is visible
    await chip(page, "A Open").focus();
    await page.keyboard.press("Tab");
    const outline = await chip(page, "B Play").evaluate((b) => getComputedStyle(b).outlineStyle);
    check(`${label}: a focused chip shows its outline`, outline !== "none", outline);
  } finally {
    await context.close();
  }
}

async function noJs(browser) {
  const { context, page } = await open(browser, { js: false });
  try {
    await page.goto(BASE_URL + "/", { waitUntil: "load" });
    const s = await read(page);
    check("no JavaScript: the menu and its six links, no game", !s.game && s.links === 6 && !s.menuHidden, JSON.stringify(s));
  } finally {
    await context.close();
  }
}

const browser = await chromium.launch();
try {
  if (EXPECT_SHA) {
    const html = await (await fetch(BASE_URL + "/")).text();
    const sha = html.match(/<meta name="build-sha" content="([^"]*)"/)?.[1] ?? "none";
    check(`build-sha is ${EXPECT_SHA}`, sha === EXPECT_SHA, sha);
  }
  await deterministic(browser);
  await clock(browser);
  await konami(browser);
  await storage(browser);
  for (const viewport of [DESKTOP, PHONE]) for (const scheme of ["light", "dark"]) await matrix(browser, viewport, scheme);
  await noJs(browser);
  check("no console errors or page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
} finally {
  await browser.close();
}

console.log(`probe: ${ok} ok, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
