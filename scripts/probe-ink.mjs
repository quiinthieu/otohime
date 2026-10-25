// Drives headless Chromium over the ink hero on /. Run by scripts/probe-ink.sh, which installs Playwright into
// PW_PREFIX and passes BASE_URL.
//
// The canvas reports its state (data-state loading / scattered / settled), renderer and speck count, but those
// are the component's own words, so the probe also looks: a screenshot of the box with the canvas hidden must
// differ from one with it shown (ink is drawn), a scattered frame must differ from the settled one, and the
// settled frame after a blow must match the one before it (the specks land exactly). Scatter-to-settle is timed
// in the page from the dispatch, against a 3 s bound. The lazy chunks are found by difference: scripts / loads
// with motion that it does not load under reduced motion. Layout shifts are summed by a PerformanceObserver
// installed before the page's own scripts.
import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(path.join(process.env.PW_PREFIX, "package.json"));
const { chromium } = require("playwright");

const BASE_URL = process.env.BASE_URL;
const SHOTS_DIR = process.env.SHOTS_DIR || "";
const PHONE = { width: 390, height: 844 };
const DESKTOP = { width: 1366, height: 768 };
const BOX = "main .ink-hero";
const CANVAS = `${BOX} canvas`;
const MARK = `${BOX} svg.ink-hero-mark`;
const MARKER = "ink-hero speck";
const SETTLE_MS = 3000;
const IDLE_MS = 15000;

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

// Sum layout shifts from the first paint on, the way CLS counts them (shifts right after input excluded): the
// whole page's, and those with a source inside <main>, where the hero is. The masthead, outside <main>, already
// shifts by about 0.0004 on some loads when its Sign in link streams in (on main before the hero too), so the
// page as a whole is held to under 0.001, which CLS reports as 0.00, and <main> to exactly 0.
const clsInit = () => {
  window.__cls = 0;
  window.__mainCls = 0;
  window.__shifts = [];
  new PerformanceObserver((list) => {
    for (const e of list.getEntries()) {
      if (e.hadRecentInput) continue;
      const nodes = (e.sources ?? []).map((s) => s.node).filter(Boolean);
      window.__cls += e.value;
      if (nodes.length === 0 || nodes.some((n) => n.closest?.("main") ?? n.parentElement?.closest("main"))) window.__mainCls += e.value;
      window.__shifts.push(nodes.map((n) => `${n.nodeName}.${n.className?.baseVal ?? n.className ?? ""}`).join(" "));
    }
  }).observe({ type: "layout-shift", buffered: true });
};

async function open(browser, { viewport, scheme = "light", reduced = false, init = [], sink = errors }) {
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
  // every script the page requests, with its body once it arrives
  const scripts = new Map();
  page.on("response", (r) => {
    if (r.request().resourceType() !== "script") return;
    scripts.set(r.url(), r.text().catch(() => ""));
  });
  await page.addInitScript(clsInit);
  for (const fn of init) await page.addInitScript(fn);
  return { context, page, scripts };
}

const label = (viewport) => (viewport === PHONE ? "390x844 touch" : "1366x768");

async function shot(page, name) {
  const buf = await page.locator(BOX).screenshot();
  if (SHOTS_DIR) {
    mkdirSync(SHOTS_DIR, { recursive: true });
    writeFileSync(path.join(SHOTS_DIR, `${name}.png`), buf);
  }
  return buf;
}

// Wait for the canvas to report settled; null past the bound.
async function waitSettled(page, timeout = IDLE_MS) {
  try {
    await page.waitForSelector(`${CANVAS}[data-state="settled"]`, { timeout, state: "attached" });
    return await page.locator(CANVAS).evaluate((c) => ({ ...c.dataset }));
  } catch {
    return null;
  }
}

// Dispatch a synthetic pointermove at the middle of the box and time, in the page, scattered then settled.
const blowAndTime = (page, { pointerType = "mouse", fx = 0.5, fy = 0.55 } = {}) =>
  page.evaluate(
    ({ sel, pointerType, fx, fy, bound }) =>
      new Promise((resolve) => {
        const canvas = document.querySelector(sel);
        const box = canvas.parentElement;
        const r = box.getBoundingClientRect();
        const t0 = performance.now();
        box.dispatchEvent(
          new PointerEvent("pointermove", {
            bubbles: true,
            pointerType,
            isPrimary: true,
            clientX: r.left + r.width * fx,
            clientY: r.top + r.height * fy,
          }),
        );
        let scattered = null;
        const tick = () => {
          const t = performance.now() - t0;
          const state = canvas.isConnected ? canvas.dataset.state : "removed";
          if (state === "scattered" && scattered === null) scattered = t;
          if (scattered !== null && state === "settled") return resolve({ scattered, settled: t, state });
          if (t > bound) return resolve({ scattered, settled: null, state });
          // a timer, not a frame: a page whose frames stop must still answer
          setTimeout(tick, 16);
        };
        tick();
      }),
    { sel: CANVAS, pointerType, fx, fy, bound: SETTLE_MS },
  );

const timed = (t) => `scattered at ${t.scattered === null ? "never" : `${t.scattered.toFixed(0)} ms`}, settled at ${t.settled === null ? `never (still ${t.state})` : `${t.settled.toFixed(0)} ms`}`;

const markShown = (page) =>
  page.evaluate((sel) => {
    const svg = document.querySelector(sel);
    if (!svg) return { shown: false, why: "no svg" };
    const r = svg.getBoundingClientRect();
    const o = getComputedStyle(svg).opacity;
    return { shown: r.width > 100 && r.height > 30 && o === "1", why: `${r.width.toFixed(0)}x${r.height.toFixed(0)} opacity ${o}` };
  }, MARK);

const cls = (page) => page.evaluate(() => ({ value: window.__cls, main: window.__mainCls, shifts: window.__shifts }));
const clsOk = (c) => c.main === 0 && c.value < 0.001;
const clsDetail = (c) => `main ${c.main}, page ${c.value} ${JSON.stringify(c.shifts)}`;

// The JS on / with motion: what loaded, and the canvas's own report.
async function home(browser, viewport) {
  const name = label(viewport);
  const { context, page, scripts } = await open(browser, { viewport });
  try {
    const res = await page.goto(`${BASE_URL}/`, { waitUntil: "load" });
    const html = await res.text();
    const a11y = await page.evaluate((sel) => {
      const h1 = document.querySelector("main h1");
      const box = document.querySelector(sel);
      const r = box?.getBoundingClientRect();
      return {
        h1: h1?.textContent,
        h1Visible: !!h1 && h1.getBoundingClientRect().height > 0,
        hidden: box?.getAttribute("aria-hidden"),
        ratio: r ? r.width / r.height : 0,
        afterH1: !!h1 && h1.nextElementSibling === box,
      };
    }, BOX);
    check(`${name}: the h1 is real text and the ink box is aria-hidden right after it`, a11y.h1 === "Otohime" && a11y.h1Visible && a11y.hidden === "true" && a11y.afterH1, JSON.stringify(a11y));
    check(`${name}: the box keeps the mark's 300:120 ratio`, Math.abs(a11y.ratio - 2.5) < 0.02, a11y.ratio.toFixed(3));

    const first = await waitSettled(page);
    check(`${name}: after idle the canvas reaches data-state=settled`, first !== null, first ? "" : JSON.stringify(await page.locator(CANVAS).evaluateAll((cs) => cs.map((c) => ({ ...c.dataset })))));
    if (!first) return { scripts: [...scripts.keys()], bodies: scripts, html };
    const want = first.renderer === "webgl2" ? (viewport === PHONE ? "1200" : "2400") : "600";
    check(`${name}: ${first.renderer} draws its tier of ${want} specks`, first.n === want, JSON.stringify(first));
    console.log(`# ${name}: renderer ${first.renderer}, ${first.n} specks`);
    await sleep(400);
    const hidden = await page.evaluate((sel) => getComputedStyle(document.querySelector(sel)).opacity, MARK);
    check(`${name}: once live the SVG fades under the canvas`, hidden === "0", `opacity ${hidden}`);

    // Ink is on the canvas: the box looks different with it hidden.
    const settledShot = await shot(page, `${name}-settled`);
    await page.locator(CANVAS).evaluate((c) => (c.style.visibility = "hidden"));
    const blank = await shot(page, `${name}-blank`);
    await page.locator(CANVAS).evaluate((c) => (c.style.visibility = ""));
    check(`${name}: the canvas draws ink`, !settledShot.equals(blank));

    const t = await blowAndTime(page, { pointerType: viewport === PHONE ? "touch" : "mouse" });
    check(`${name}: a synthetic pointermove gives scattered, then settled within ${SETTLE_MS} ms`, t.scattered !== null && t.scattered < 100 && t.settled !== null, timed(t));

    // A scattered frame differs, and the specks land back on the same mark.
    const r = await page.locator(BOX).boundingBox();
    await page.evaluate(
      ({ sel, x, y }) => document.querySelector(sel).dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, clientX: x, clientY: y, pointerType: "touch" })),
      { sel: BOX, x: r.x + r.width * 0.5, y: r.y + r.height * 0.5 },
    );
    const mid = await shot(page, `${name}-scattered`);
    const midState = await page.locator(CANVAS).getAttribute("data-state");
    const back = await waitSettled(page, SETTLE_MS + 1000);
    await sleep(100);
    const again = await shot(page, `${name}-settled-again`);
    check(`${name}: a scattered frame differs from the settled mark`, midState === "scattered" && !mid.equals(settledShot), `state at shot ${midState}`);
    check(`${name}: the specks land back on exactly the same mark`, back !== null && again.equals(settledShot));

    // Real input scatters too: a mouse move on the desktop, a tap on the phone.
    const real = await page.locator(BOX).boundingBox();
    if (viewport === PHONE) await page.touchscreen.tap(real.x + real.width * 0.3, real.y + real.height * 0.5);
    else await page.mouse.move(real.x + real.width * 0.3, real.y + real.height * 0.5, { steps: 6 });
    const state = await page.locator(CANVAS).getAttribute("data-state");
    check(`${name}: a real ${viewport === PHONE ? "tap" : "mouse move"} scatters the specks`, state === "scattered", state);
    const settledAgain = await waitSettled(page, SETTLE_MS);
    check(`${name}: and they settle again`, settledAgain !== null);
    if (viewport !== PHONE) await page.mouse.move(4, DESKTOP.height - 4);

    const wide = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    check(`${name}: nothing scrolls sideways`, wide <= 0, `${wide} px over`);

    // A theme switch re-reads the ink.
    const before = await page.locator(CANVAS).getAttribute("data-ink");
    await page.evaluate(() => (document.documentElement.dataset.theme = "dark"));
    await sleep(200);
    const after = await page.locator(CANVAS).getAttribute("data-ink");
    const shown = await page.evaluate(() => getComputedStyle(document.querySelector("main .ink-hero")).color);
    check(`${name}: switching to the dark theme re-reads the ink`, before === "35,30,22" && after === "235,230,218", `${before} -> ${after} (css ${shown})`);
    await page.evaluate(() => delete document.documentElement.dataset.theme);
    await sleep(200);

    const shift = await cls(page);
    check(`${name}: CLS is 0 (nothing in <main> shifts, the page under 0.001)`, clsOk(shift), clsDetail(shift));

    if (first.renderer === "webgl2") {
      await page.locator(CANVAS).evaluate((c) => c.getContext("webgl2").getExtension("WEBGL_lose_context").loseContext());
      let gone = false;
      try {
        await page.waitForSelector(CANVAS, { state: "detached", timeout: 1000 });
        gone = true;
      } catch {}
      await sleep(400);
      const svg = await markShown(page);
      check(`${name}: a lost WebGL context removes the canvas and the SVG shows again`, gone && svg.shown, `removed ${gone}, ${svg.why}`);
    }

    // Reduced motion switched on unmounts the canvas (a fresh load, so the context is whole).
    await page.reload({ waitUntil: "load" });
    if (await waitSettled(page)) {
      await page.emulateMedia({ reducedMotion: "reduce" });
      let gone = false;
      try {
        await page.waitForSelector(CANVAS, { state: "detached", timeout: 1000 });
        gone = true;
      } catch {}
      // the SVG's opacity transition (0.01 ms under reduced motion) lands on the next frame
      await sleep(400);
      const svg = await markShown(page);
      check(`${name}: reduced motion switched on unmounts the canvas and shows the SVG`, gone && svg.shown, `removed ${gone}, ${svg.why}`);
      await page.emulateMedia({ reducedMotion: "no-preference" });
    }

    return { scripts: [...scripts.keys()], bodies: scripts, html };
  } finally {
    await context.close();
  }
}

// Under reduced motion: no canvas, the SVG, and the scripts / loads without the ink hero.
async function reduced(browser, viewport, init = [], sink = errors) {
  const { context, page, scripts } = await open(browser, { viewport, reduced: true, init, sink });
  try {
    await page.goto(`${BASE_URL}/`, { waitUntil: "load" });
    // past the idle timeout the loader waits on, and past a settle
    await sleep(3500);
    const canvases = await page.locator(CANVAS).count();
    const svg = await markShown(page);
    const shift = await cls(page);
    return { canvases, svg, scripts: [...scripts.keys()], cls: shift };
  } finally {
    await context.close();
  }
}

// /work, loaded fresh: the scripts it requests.
async function work(browser, viewport) {
  const { context, page, scripts } = await open(browser, { viewport });
  try {
    await page.goto(`${BASE_URL}/work`, { waitUntil: "load" });
    await sleep(3500);
    const bodies = await Promise.all([...scripts.values()]);
    return { scripts: [...scripts.keys()], marked: [...scripts.keys()].filter((_, i) => bodies[i].includes(MARKER)) };
  } finally {
    await context.close();
  }
}

// No WebGL2: the Canvas2D fallback.
async function fallback(browser) {
  const name = "1366x768 without WebGL2";
  const { context, page } = await open(browser, {
    viewport: DESKTOP,
    init: [
      () => {
        const get = HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
          return type === "webgl2" ? null : get.call(this, type, ...rest);
        };
      },
    ],
  });
  try {
    await page.goto(`${BASE_URL}/`, { waitUntil: "load" });
    const first = await waitSettled(page);
    check(`${name}: the Canvas2D fallback settles with 600 specks`, first?.renderer === "2d" && first?.n === "600", JSON.stringify(first));
    if (!first) return;
    const settledShot = await shot(page, "fallback-settled");
    await page.locator(CANVAS).evaluate((c) => (c.style.visibility = "hidden"));
    const blank = await shot(page, "fallback-blank");
    await page.locator(CANVAS).evaluate((c) => (c.style.visibility = ""));
    check(`${name}: the fallback draws ink`, !settledShot.equals(blank));
    const t = await blowAndTime(page);
    check(`${name}: a synthetic pointermove gives scattered, then settled within ${SETTLE_MS} ms`, t.scattered !== null && t.settled !== null, timed(t));
  } finally {
    await context.close();
  }
}

// The same checks against a broken page must fail; their errors go to a separate sink.
async function negatives(browser) {
  const sink = [];
  {
    const guardless = await reduced(
      browser,
      DESKTOP,
      [
        () => {
          const real = window.matchMedia.bind(window);
          window.matchMedia = (q) => real(q.includes("prefers-reduced-motion: no-preference") ? "all" : q);
        },
      ],
      sink,
    );
    check("negative control: with the motion guard bypassed, the reduced-motion check catches the canvas", guardless.canvases > 0, `${guardless.canvases} canvases`);
  }
  {
    const { context, page } = await open(browser, { viewport: DESKTOP, sink });
    try {
      await page.goto(`${BASE_URL}/`, { waitUntil: "load" });
      await waitSettled(page);
      await page.evaluate(() => (window.requestAnimationFrame = () => 0));
      const t = await blowAndTime(page);
      check("negative control: with animation frames stopped, the 3 s check catches the stuck scatter", t.scattered !== null && t.settled === null, timed(t));
    } finally {
      await context.close();
    }
  }
  {
    const { context, page } = await open(browser, { viewport: DESKTOP, sink });
    try {
      await page.goto(`${BASE_URL}/`, { waitUntil: "load" });
      await waitSettled(page);
      // a box that grows in late above the hero, the shift a canvas without a reserved box would cause
      await page.evaluate((sel) => {
        const late = document.createElement("div");
        late.style.height = "40px";
        document.querySelector(sel).before(late);
      }, BOX);
      await sleep(300);
      const shift = await cls(page);
      check("negative control: with a late 40 px box above the hero, the CLS check catches the shift", !clsOk(shift), clsDetail(shift));
    } finally {
      await context.close();
    }
  }
}

// WebGL2 through SwiftShader where the machine has no GPU; the page falls back to Canvas2D when even that fails.
const browser = await chromium.launch({ args: ["--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
try {
  for (const viewport of [DESKTOP, PHONE]) {
    const name = label(viewport);
    const live = await home(browser, viewport);
    const still = await reduced(browser, viewport);
    check(`${name} reduced motion: no canvas renders`, still.canvases === 0, `${still.canvases} canvases`);
    check(`${name} reduced motion: the SVG mark shows`, still.svg.shown, still.svg.why);
    check(`${name} reduced motion: CLS is 0 (nothing in <main> shifts, the page under 0.001)`, clsOk(still.cls), clsDetail(still.cls));

    // The lazy chunks: loaded on / with motion, not under reduced motion. They carry the ink hero, and / does not
    // name them in its HTML (nothing preloads or blocks on them).
    const lazy = live.scripts.filter((u) => !still.scripts.includes(u));
    const bodies = await Promise.all(lazy.map((u) => live.bodies.get(u)));
    const marked = lazy.filter((_, i) => bodies[i].includes(MARKER));
    check(`${name}: the ink hero arrives in its own lazy chunk`, marked.length >= 1, `lazy ${JSON.stringify(lazy.map((u) => new URL(u).pathname))}`);
    const named = lazy.filter((u) => live.html.includes(new URL(u).pathname));
    check(`${name}: /'s HTML names none of the lazy chunks`, lazy.length > 0 && named.length === 0, JSON.stringify(named));
    console.log(`# ${name}: lazy chunks ${lazy.map((u) => new URL(u).pathname).join(" ")}`);

    const onWork = await work(browser, viewport);
    const fetched = onWork.scripts.filter((u) => lazy.includes(u));
    check(
      `${name}: /work never requests the ink-hero chunk`,
      lazy.length > 0 && fetched.length === 0 && onWork.marked.length === 0,
      `lazy fetched ${JSON.stringify(fetched)}, marked ${JSON.stringify(onWork.marked)}`,
    );
  }
  await fallback(browser);
  await negatives(browser);
  check("no console errors or page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
} finally {
  await browser.close();
}

console.log(`probe: ${ok} ok, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
