// Drives headless Chromium over the Work page's pipeline simulation. Run by scripts/probe-pipeline.sh, which
// installs Playwright into PW_PREFIX and passes BASE_URL (and EXPECT_SHA, checked if set).
//
// Everything is read from the DOM as the browser holds it: the counters from the machine's stats, the packets
// from the drawing (each a g[data-place] in the inked svg), the dashboard's lit bars and printed count, the
// figure's data-busy and the readout. The 12 fps clock's live timers are counted by wrapping setInterval, and
// "no work" is measured as zero timers and zero mutations of the drawing over a fixed window. Each negative
// control runs the same assertion against a page with one thing knocked out, and that assertion must fail.
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
const SIM = 'section[aria-label="Pipeline simulation"]';
const CONVEYOR = 'section[aria-label="Data pipeline"]';
const RACK = 'section[aria-label="Server rack"]';
const PLACES = ["source", "to-queue", "queue", "to-warehouse", "warehouse", "to-dashboard"];
const PIPES = ["to-queue", "to-warehouse", "to-dashboard"];
const CAP = 32;
if (SHOTS) mkdirSync(SHOTS, { recursive: true });

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
const frame = (page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

// Every page counts the figure clock's live timers (setInterval at 1000/12 ms), and the most ever live at once.
const COUNT_TIMERS = () => {
  const set = window.setInterval.bind(window);
  const clear = window.clearInterval.bind(window);
  const live = new Set();
  let most = 0;
  window.__figureTimers = () => live.size;
  window.__mostTimers = () => most;
  window.setInterval = (fn, ms, ...rest) => {
    const id = set(fn, ms, ...rest);
    if (Math.abs(ms - 1000 / 12) < 0.5) {
      live.add(id);
      most = Math.max(most, live.size);
    }
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
  const foreign = [];
  page.on("request", (r) => {
    if (!r.url().startsWith(BASE_URL) && !r.url().startsWith("data:")) foreign.push(r.url());
  });
  await page.addInitScript(COUNT_TIMERS);
  if (init) await page.addInitScript(init);
  return { context, page, phone, foreign };
}

// Loaded, hydrated (React's props on the Emit chip) and printed in (the figure's 0.6 s print has landed).
async function load(page) {
  await page.goto(BASE_URL + "/work", { waitUntil: "load" });
  await page.waitForFunction(
    (s) => {
      const b = document.querySelector(`${s} .machine-controls button`);
      return b && Object.keys(b).some((k) => k.startsWith("__reactProps"));
    },
    SIM,
    { timeout: 15000 },
  );
  await sleep(800);
}

// One commit's worth of the machine, as drawn and as counted.
const read = (page) =>
  page.evaluate(
    ([s, places]) => {
      const sec = document.querySelector(s);
      const stats = Object.fromEntries(
        [...sec.querySelectorAll(".machine-stats .stat")].map((d) => [d.querySelector("dt").textContent, Number(d.querySelector("dd").textContent)]),
      );
      const drawn = Object.fromEntries(places.map((p) => [p, sec.querySelectorAll(`svg.figure g[data-place="${p}"]`).length]));
      const packets = [...sec.querySelectorAll("svg.figure g[data-packet]")].map((g) => {
        const r = g.getBoundingClientRect();
        return { id: Number(g.dataset.packet), place: g.dataset.place, x: r.x, y: r.y };
      });
      const chips = [...sec.querySelectorAll(".machine-controls button")].map((b) => ({
        text: b.textContent.trim(),
        disabled: b.getAttribute("aria-disabled") === "true",
      }));
      return {
        stats,
        drawn,
        packets,
        bars: sec.querySelectorAll("svg.figure [data-bar='on']").length,
        printed: Number(sec.querySelector("svg.figure [data-shown]")?.textContent ?? NaN),
        hold: [...sec.querySelectorAll("svg.figure text")].some((t) => t.textContent === "HOLD"),
        busy: sec.querySelector(".machine-figure").hasAttribute("data-busy"),
        readout: sec.querySelector(".readout").textContent,
        chips,
        timers: window.__figureTimers(),
        most: window.__mostTimers(),
      };
    },
    [SIM, PLACES],
  );

// The drawing agrees with the counters: packets per place, the lag, the dashboard.
function agrees(st) {
  const s = st.stats;
  const inPipes = PIPES.reduce((n, p) => n + st.drawn[p], 0);
  const total = PLACES.reduce((n, p) => n + st.drawn[p], 0);
  return (
    s["In flight"] === inPipes &&
    s.Queue === st.drawn.queue &&
    s.Stored === st.drawn.warehouse &&
    s.Lag === s.Sent - s.Shown &&
    s.Lag === total &&
    st.bars === Math.min(8, s.Shown) &&
    st.printed === s.Shown
  );
}
const show = (st) => JSON.stringify({ stats: st.stats, drawn: st.drawn, bars: st.bars, printed: st.printed, busy: st.busy, timers: st.timers });

// Samples until `until` holds or the time runs out; returns every sample.
async function watch(page, until, ms = 12000) {
  const samples = [];
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const st = await read(page);
    samples.push(st);
    if (until(st)) break;
    await sleep(50);
  }
  return samples;
}
const atRest = (st) => !st.busy && st.timers === 0;

const chip = (page, text) => page.locator(`${SIM} .machine-controls button`, { hasText: text });
async function tap(page, phone, text, force = false) {
  const c = chip(page, text);
  if (phone) await c.tap({ force });
  else await c.click({ force });
  await frame(page);
}

// Mutations of the drawing over a window.
const quiet = (page, ms) =>
  page.evaluate(
    ([s, ms]) =>
      new Promise((resolve) => {
        let n = 0;
        const o = new MutationObserver((list) => (n += list.length));
        o.observe(document.querySelector(`${s} svg.figure`), { subtree: true, attributes: true, childList: true, characterData: true });
        setTimeout(() => {
          o.disconnect();
          resolve(n);
        }, ms);
      }),
    [SIM, ms],
  );

const setHidden = (page, hidden) =>
  page.evaluate((h) => {
    Object.defineProperty(document, "hidden", { configurable: true, get: () => h });
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => (h ? "hidden" : "visible") });
    document.dispatchEvent(new Event("visibilitychange"));
  }, hidden);

const noOverflow = (page) => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);
const toFigure = (page) => page.locator(`${SIM} .machine-figure`).scrollIntoViewIfNeeded();

async function shot(page, name) {
  if (!SHOTS) return;
  const buf = await page.locator(SIM).screenshot({ animations: "disabled" });
  writeFileSync(path.join(SHOTS, `${name}.png`), buf);
}

// Backfill from rest: eight delivered through every pipe, each sample's drawing agreeing with its counters, and
// packets visibly moving along a pipe and through the places in order.
async function backfillEight(page, phone, base) {
  await tap(page, phone, "Backfill");
  const samples = await watch(page, (st) => atRest(st) && st.stats.Shown >= base + 8);
  const last = samples.at(-1);
  const disagree = samples.find((st) => !agrees(st));
  const seenPipes = PIPES.filter((p) => samples.some((st) => st.drawn[p] > 0));
  // every packet's places come in order, and some packet moves along a pipe between two samples
  const order = new Map();
  let ordered = true;
  let moved = false;
  for (let i = 0; i < samples.length; i++) {
    for (const p of samples[i].packets) {
      const k = PLACES.indexOf(p.place);
      if (k < (order.get(p.id) ?? 0)) ordered = false;
      order.set(p.id, k);
      const prev = samples[i - 1]?.packets.find((q) => q.id === p.id && q.place === p.place);
      if (prev && PIPES.includes(p.place) && Math.hypot(p.x - prev.x, p.y - prev.y) > 2) moved = true;
    }
  }
  return { samples, last, disagree, seenPipes, ordered, moved };
}

async function work(browser, viewport, scheme) {
  const phone = viewport === PHONE;
  const label = `${phone ? "phone" : "desktop"} ${scheme} /work`;
  const { context, page, foreign } = await open(browser, { viewport, scheme });
  try {
    await load(page);
    // place and company
    const layout = await page.evaluate(
      ([sim, conveyor, rack]) => {
        const s = document.querySelector(sim);
        const intro = document.querySelector("p.max-w-prose");
        const before = (a, b) => Boolean(a && b && a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
        return {
          afterIntro: before(intro, s),
          beforeConveyor: before(s, document.querySelector(conveyor)),
          rack: Boolean(document.querySelector(rack)),
          stack: document.querySelector("#stack")?.textContent.trim() ?? "",
          note: s?.textContent.includes("illustrative simulation") ?? false,
        };
      },
      [SIM, CONVEYOR, RACK],
    );
    check(
      `${label}: the simulation sits after the intro, before the Conveyor, with Stack and the rack kept`,
      layout.afterIntro && layout.beforeConveyor && layout.rack && layout.stack === "Stack",
      JSON.stringify(layout),
    );
    check(`${label}: the drawing says it is an illustrative simulation`, layout.note);
    await toFigure(page);
    const start = await read(page);
    const still = await quiet(page, 800);
    check(
      `${label}: at rest on load: zero counters, no packet, no timer, no mutation`,
      Object.values(start.stats).every((v) => v === 0) && start.packets.length === 0 && !start.busy && start.timers === 0 && still === 0 && agrees(start),
      `${show(start)}, ${still} mutations`,
    );
    await shot(page, `${phone ? "phone" : "desktop"}-${scheme}-rest`);

    // Backfill delivers eight.
    const b = await backfillEight(page, phone, 0);
    check(`${label}: Backfill delivers eight and comes to rest with no timer`, b.last.stats.Sent === 8 && b.last.stats.Shown === 8 && b.last.stats.Lag === 0 && atRest(b.last), show(b.last));
    check(`${label}: every one of ${b.samples.length} samples' drawing agrees with its counters`, !b.disagree, b.disagree && show(b.disagree));
    check(`${label}: packets flow through all three pipes, in order, moving along them`, b.seenPipes.length === 3 && b.ordered && b.moved, JSON.stringify({ pipes: b.seenPipes, ordered: b.ordered, moved: b.moved }));
    check(`${label}: the dashboard lights eight bars and the readout says it caught up`, b.last.bars === 8 && b.last.readout.includes("All 8"), b.last.readout);
    check(`${label}: one figure timer at most`, b.last.most <= 1, `${b.last.most}`);

    // Pause: the queue accumulates and the clock stops once only the held queue is left.
    await tap(page, phone, "Pause");
    const paused = await read(page);
    check(`${label}: Pause turns into Resume and shuts the valve`, paused.chips.some((c) => c.text === "Resume") && paused.hold, JSON.stringify(paused.chips));
    for (let i = 0; i < 5; i++) await tap(page, phone, "Emit");
    const filling = await watch(page, atRest);
    const held = filling.at(-1);
    const queues = filling.map((st) => st.stats.Queue);
    check(
      `${label}: paused, five emits land in the queue while the dashboard holds at 8`,
      held.stats.Queue === 5 && held.stats.Shown === 8 && held.stats.Lag === 5 && queues.every((q, i) => i === 0 || q >= queues[i - 1]),
      `${show(held)}; queue ${queues.join(",")}`,
    );
    check(`${label}: every paused sample agrees with its counters`, filling.every(agrees));
    const heldQuiet = await quiet(page, 1000);
    const heldAfter = await read(page);
    check(
      `${label}: a paused, held queue runs no timer and draws nothing`,
      heldQuiet === 0 && heldAfter.timers === 0 && heldAfter.stats.Queue === 5 && heldAfter.readout.includes("Paused with 5"),
      `${heldQuiet} mutations, ${heldAfter.timers} timers, ${heldAfter.readout}`,
    );
    await shot(page, `${phone ? "phone" : "desktop"}-${scheme}-held`);

    // Resume drains it.
    await tap(page, phone, "Resume");
    const draining = await watch(page, (st) => atRest(st) && st.stats.Shown === 13);
    const drained = draining.at(-1);
    const dq = draining.map((st) => st.stats.Queue);
    check(
      `${label}: Resume drains the queue in order to the dashboard`,
      drained.stats.Queue === 0 && drained.stats.Shown === 13 && drained.stats.Lag === 0 && atRest(drained) && dq.every((q, i) => i === 0 || q <= dq[i - 1]),
      `${show(drained)}; queue ${dq.join(",")}`,
    );
    check(`${label}: every draining sample agrees with its counters`, draining.every(agrees));

    // A hidden document stops the clock and the drawing; shown again, it finishes.
    await tap(page, phone, "Backfill");
    await sleep(400);
    await setHidden(page, true);
    await sleep(150);
    const hid = await read(page);
    const hidQuiet = await quiet(page, 800);
    const hidAfter = await read(page);
    check(
      `${label}: a hidden page stops the clock mid-flow and nothing redraws`,
      hid.busy && hid.timers === 0 && hidQuiet === 0 && JSON.stringify(hidAfter.stats) === JSON.stringify(hid.stats),
      `${show(hid)}, ${hidQuiet} mutations`,
    );
    await setHidden(page, false);
    const unhid = (await watch(page, (st) => atRest(st) && st.stats.Shown === 21)).at(-1);
    check(`${label}: shown again, it carries on and delivers`, unhid.stats.Shown === 21 && atRest(unhid), show(unhid));

    // A figure scrolled away stops too.
    await tap(page, phone, "Backfill");
    await sleep(400);
    const away = await page.evaluate((s) => {
      const fig = document.querySelector(`${s} .machine-figure`);
      scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" });
      const r = fig.getBoundingClientRect();
      return r.bottom < 0 || r.top > innerHeight;
    }, SIM);
    await sleep(250);
    const off = await read(page);
    const offQuiet = await quiet(page, 800);
    check(`${label}: scrolled out of view, the clock and the drawing stop`, away && off.busy && off.timers === 0 && offQuiet === 0, `away ${away}, ${show(off)}, ${offQuiet} mutations`);
    await toFigure(page);
    const back = (await watch(page, (st) => atRest(st) && st.stats.Shown === 29)).at(-1);
    check(`${label}: back in view, it finishes`, back.stats.Shown === 29 && atRest(back), show(back));

    // Keyboard: the chips take focus with a visible ring and Enter presses them.
    await chip(page, "Backfill").focus();
    await page.keyboard.press("Shift+Tab");
    const ring = await page.evaluate((s) => {
      const el = document.activeElement;
      const cs = getComputedStyle(el);
      return { inSim: Boolean(el.closest(s)), text: el.textContent.trim(), visible: el.matches(":focus-visible") && cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) > 0 };
    }, SIM);
    await page.keyboard.press("Enter");
    const keyed = (await watch(page, (st) => atRest(st) && st.stats.Shown === 30)).at(-1);
    check(`${label}: Emit by keyboard, with a visible focus ring`, ring.inSim && ring.text === "Emit" && ring.visible && keyed.stats.Sent === 30, `${JSON.stringify(ring)} ${show(keyed)}`);

    // Fit: the labels inside their tags, nothing sideways.
    const fit = await page.evaluate((s) =>
      [...document.querySelectorAll(`${s} svg.figure g[data-station] > text`)].map((t) => {
        const r = t.previousElementSibling.getBBox();
        const b = t.getBBox();
        return { text: t.textContent, fits: b.x >= r.x - 0.5 && b.x + b.width <= r.x + r.width + 0.5 && b.height <= r.height + 2 };
      }),
    SIM);
    check(`${label}: the four station labels fit their tags`, fit.length >= 4 && fit.every((f) => f.fits), JSON.stringify(fit));
    check(`${label}: nothing scrolls sideways`, await noOverflow(page));
    check(`${label}: no request leaves the site`, foreign.length === 0, foreign.slice(0, 3).join(" "));
  } finally {
    await context.close();
  }
}

// Long runs stay bounded: backfills past the cap send only what fits, Emit is disabled while full, one timer at
// most, a full paused queue rests with no timer and drains in bounded time.
async function bounded(browser) {
  const label = "desktop light /work long run";
  const { context, page } = await open(browser, { viewport: DESKTOP });
  try {
    await load(page);
    await toFigure(page);
    await tap(page, false, "Pause");
    // past the cap the chip is aria-disabled, so the last presses are forced through to show they do nothing
    for (let i = 0; i < 6; i++) await tap(page, false, "Backfill", true);
    const full = await read(page);
    check(`${label}: six backfills send only the cap (${CAP})`, full.stats.Sent === CAP && full.packets.length === CAP, show(full));
    check(
      `${label}: at the cap Emit and Backfill are disabled and a press does nothing`,
      full.chips.filter((c) => c.disabled).map((c) => c.text).join() === "Emit,Backfill",
      JSON.stringify(full.chips),
    );
    await chip(page, "Emit").click({ force: true });
    check(`${label}: an Emit at the cap leaves the count alone`, (await read(page)).stats.Sent === CAP);
    const rest = (await watch(page, atRest, 15000)).at(-1);
    check(`${label}: paused, all ${CAP} come to rest in the queue with no timer`, rest.stats.Queue === CAP && rest.drawn.queue === CAP && atRest(rest) && agrees(rest), show(rest));
    const t0 = Date.now();
    await tap(page, false, "Resume");
    const samples = await watch(page, (st) => atRest(st) && st.stats.Shown === CAP, 20000);
    const done = samples.at(-1);
    check(
      `${label}: resumed, the full queue drains in bounded time (${((Date.now() - t0) / 1000).toFixed(1)} s)`,
      done.stats.Shown === CAP && atRest(done) && samples.every(agrees) && samples.every((st) => st.packets.length <= CAP),
      show(done),
    );
    check(`${label}: never more than one figure timer`, done.most <= 1, `${done.most}`);
  } finally {
    await context.close();
  }
}

// Reduced motion: every press lands at rest at once; the clock never starts.
async function settlesAtOnce(page, phone) {
  const r = [];
  await tap(page, phone, "Backfill");
  r.push(await read(page));
  await tap(page, phone, "Pause");
  await tap(page, phone, "Backfill");
  r.push(await read(page));
  await tap(page, phone, "Resume");
  r.push(await read(page));
  const [a, b, c] = r;
  const pass =
    a.stats.Shown === 8 && a.stats.Lag === 0 && !a.busy &&
    b.stats.Queue === 8 && b.stats.Shown === 8 && !b.busy && b.drawn.queue === 8 &&
    c.stats.Shown === 16 && c.stats.Queue === 0 && !c.busy &&
    r.every(agrees) && c.most === 0;
  return { pass, detail: r.map(show).join(" / ") };
}

async function reduced(browser) {
  for (const [viewport, scheme] of [[DESKTOP, "light"], [PHONE, "dark"]]) {
    const phone = viewport === PHONE;
    const label = `${phone ? "phone" : "desktop"} ${scheme} /work reduced motion`;
    const { context, page } = await open(browser, { viewport, scheme, reduced: true });
    try {
      await load(page);
      await toFigure(page);
      const { pass, detail } = await settlesAtOnce(page, phone);
      check(`${label}: Backfill, Pause+Backfill and Resume each settle at once, with no timer ever`, pass, detail);
    } finally {
      await context.close();
    }
  }
  // switched on live, mid-flow and mid-fill
  const { context, page } = await open(browser, { viewport: DESKTOP });
  try {
    await load(page);
    await toFigure(page);
    await tap(page, false, "Backfill");
    await sleep(400);
    const mid = await read(page);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await sleep(150);
    const landed = await read(page);
    check(
      "desktop light /work: switching to reduced motion mid-flow shows every packet and stops the clock",
      mid.busy && mid.stats.Lag > 0 && landed.stats.Shown === 8 && landed.stats.Lag === 0 && atRest(landed) && agrees(landed),
      `${show(mid)} -> ${show(landed)}`,
    );
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await tap(page, false, "Pause");
    await tap(page, false, "Backfill");
    await sleep(500);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await sleep(150);
    const held = await read(page);
    check(
      "desktop light /work: switching to reduced motion while paused lands everything upstream in the queue",
      held.stats.Queue === 8 && held.stats.Shown === 8 && atRest(held) && agrees(held),
      show(held),
    );
  } finally {
    await context.close();
  }
}

async function negatives(browser) {
  const sink = [];
  // an altered counter: the agreement check must catch it
  {
    const { context, page } = await open(browser, { viewport: DESKTOP, sink });
    try {
      await load(page);
      await toFigure(page);
      await tap(page, false, "Pause");
      await tap(page, false, "Backfill");
      await watch(page, atRest);
      await page.evaluate((s) => {
        const dd = [...document.querySelectorAll(`${s} .machine-stats .stat`)].find((d) => d.querySelector("dt").textContent === "Queue").querySelector("dd");
        dd.textContent = String(Number(dd.textContent) + 1);
      }, SIM);
      check("negative control: an altered Queue counter fails the agreement check", !agrees(await read(page)));
      await load(page);
      await toFigure(page);
      await tap(page, false, "Pause");
      await tap(page, false, "Backfill");
      check("negative control restored: reloaded, the same check passes", agrees((await watch(page, atRest)).at(-1)));
    } finally {
      await context.close();
    }
  }
  // visibilitychange swallowed: the hidden stop must fail
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
      await load(page);
      await toFigure(page);
      await tap(page, false, "Backfill");
      await sleep(300);
      await setHidden(page, true);
      await sleep(150);
      const hid = await read(page);
      const n = await quiet(page, 800);
      check("negative control: with visibilitychange swallowed, the hidden-page stop catches the clock", !(hid.timers === 0 && n === 0), `${hid.timers} timers, ${n} mutations`);
    } finally {
      await context.close();
    }
  }
  // the reduced-motion read bypassed: settlement must fail
  {
    const { context, page } = await open(browser, {
      viewport: DESKTOP,
      reduced: true,
      sink,
      init: () => {
        const real = window.matchMedia.bind(window);
        window.matchMedia = (q) => real(q.includes("prefers-reduced-motion: reduce") ? "not all" : q);
      },
    });
    try {
      await load(page);
      await toFigure(page);
      const { pass, detail } = await settlesAtOnce(page, false);
      check("negative control: with the reduced-motion read bypassed, the settlement check fails", !pass, detail);
    } finally {
      await context.close();
    }
  }
  // Backfill's handler disabled: delivery must fail
  {
    const { context, page } = await open(browser, { viewport: DESKTOP, sink });
    try {
      await load(page);
      await toFigure(page);
      await page.evaluate((s) => {
        window.addEventListener(
          "click",
          (e) => {
            if (e.target.closest?.(`${s} .machine-controls button`)?.textContent.trim() === "Backfill") e.stopPropagation();
          },
          true,
        );
      }, SIM);
      await tap(page, false, "Backfill");
      const last = (await watch(page, (st) => atRest(st) && st.stats.Shown >= 8, 2000)).at(-1);
      check("negative control: with Backfill's handler disabled, the delivery check fails", !(last.stats.Sent === 8 && last.stats.Shown === 8), show(last));
    } finally {
      await context.close();
    }
  }
  check("negative controls raised no page errors", sink.filter((e) => e.startsWith("pageerror")).length === 0, sink.slice(0, 3).join(" | "));
}

if (EXPECT_SHA) {
  const html = await (await fetch(BASE_URL + "/")).text();
  const sha = html.match(/<meta name="build-sha" content="([^"]*)"/)?.[1] ?? "none";
  check(`build-sha is ${EXPECT_SHA}`, sha === EXPECT_SHA, sha);
}

const browser = await chromium.launch();
try {
  for (const viewport of [DESKTOP, PHONE]) for (const scheme of ["light", "dark"]) await work(browser, viewport, scheme);
  await bounded(browser);
  await reduced(browser);
  await negatives(browser);
  check("no console errors or page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
} finally {
  await browser.close();
}

console.log(`probe: ${ok} ok, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
