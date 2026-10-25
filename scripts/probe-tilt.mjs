// Drives headless Chromium over the pocket console's pointer tilt on /. Run by scripts/probe-tilt.sh, which
// installs Playwright into PW_PREFIX and passes BASE_URL.
//
// The pose is read as the browser computes it once the 0.2 s glide has landed: the tilt wrapper's transform,
// with the known perspective(60rem) taken back off, gives the rotation itself, so the six-degree bound and the
// lean toward the pointer are measured on the matrix, not on the custom properties that feed it. A leave is
// timed from the mouse move to the resting pose (no transform, no data-tilting, shadow at opacity 0), bounded by
// 500 ms. Each stillness check moves or taps across the figure after hydration and then reads the pose; the
// negative controls run the same checks against a page whose guard or leave listener is knocked out, and those
// checks must fail.
import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(path.join(process.env.PW_PREFIX, "package.json"));
const { chromium } = require("playwright");

const BASE_URL = process.env.BASE_URL;
const SHOTS_DIR = process.env.SHOTS_DIR || "";
const PHONE = { width: 390, height: 844 };
const DESKTOP = { width: 1366, height: 768 };
const FIGURE = 'section[aria-label="Pocket console"] .machine-figure';
const LIMIT = 6;
const LEAVE_MS = 500;

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
  if (init) await page.addInitScript(init);
  return { context, page };
}

// React has hydrated the figure (its props are on the node) and its effects have had a frame to run.
async function hydrated(page) {
  await page.waitForFunction(
    (sel) => {
      const el = document.querySelector(sel);
      return el && Object.keys(el).some((k) => k.startsWith("__reactProps"));
    },
    FIGURE,
    { timeout: 15000 },
  );
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

const figureBox = (page) => page.locator(FIGURE).boundingBox();
const at = (box, fx, fy) => [box.x + box.width * fx, box.y + box.height * fy];

// The pose of the visible console: the transform, the rotation in degrees with the perspective taken off, the
// depth a point right of and above the centre ends at (negative: it leans away), and the shadow.
const pose = (page) =>
  page.evaluate((sel) => {
    const fig = document.querySelector(sel);
    const wrap = fig.querySelector(":scope > .machine-tilt");
    const transform = wrap ? getComputedStyle(wrap).transform : "missing";
    let angle = 0;
    let rightZ = 0;
    let topZ = 0;
    if (wrap && transform !== "none") {
      const p = new DOMMatrix();
      p.m34 = -1 / (parseFloat(getComputedStyle(document.documentElement).fontSize) * 60);
      const r = p.inverse().multiply(new DOMMatrix(transform));
      angle = (Math.acos(Math.max(-1, Math.min(1, (r.m11 + r.m22 + r.m33 - 1) / 2))) * 180) / Math.PI;
      rightZ = r.transformPoint(new DOMPoint(100, 0, 0)).z;
      topZ = r.transformPoint(new DOMPoint(0, -100, 0)).z;
    }
    const after = getComputedStyle(fig, "::after");
    const [sx = "0px", sy = "0px"] = after.translate === "none" ? [] : after.translate.split(" ");
    return {
      transform,
      tilting: fig.hasAttribute("data-tilting"),
      angle,
      rightZ,
      topZ,
      shadowOpacity: Number(after.opacity),
      shadowX: parseFloat(sx),
      shadowY: parseFloat(sy),
    };
  }, FIGURE);

const atRest = (p) => p.transform === "none" && !p.tilting && p.shadowOpacity === 0;
const describe = (p) =>
  `transform ${p.transform.slice(0, 40)}, tilting ${p.tilting}, angle ${p.angle.toFixed(2)}, shadow ${p.shadowOpacity} (${p.shadowX}, ${p.shadowY})`;

// Mouse onto a point of the figure, then let the glide land.
async function hover(page, fx, fy) {
  const box = await figureBox(page);
  const [x, y] = at(box, fx, fy);
  await page.mouse.move(x, y, { steps: 4 });
  await sleep(320);
  return pose(page);
}

// After hydration a hovering mouse tilts the console; retried for a slow first effect, bounded at 5 s.
async function firstTilt(page) {
  for (let i = 0; i < 10; i++) {
    const p = await hover(page, i % 2 ? 0.8 : 0.85, 0.5);
    if (p.tilting && p.transform !== "none") return p;
    await sleep(180);
  }
  return pose(page);
}

// Leave the figure and time the way back to rest, or null past the 500 ms bound.
async function leave(page) {
  const start = Date.now();
  await page.mouse.move(4, DESKTOP.height - 4);
  try {
    await page.waitForFunction(
      (sel) => {
        const fig = document.querySelector(sel);
        const wrap = fig.querySelector(":scope > .machine-tilt");
        return (
          getComputedStyle(wrap).transform === "none" &&
          !fig.hasAttribute("data-tilting") &&
          Number(getComputedStyle(fig, "::after").opacity) === 0
        );
      },
      FIGURE,
      { timeout: LEAVE_MS, polling: "raf" },
    );
    return Date.now() - start;
  } catch {
    return null;
  }
}

// Mouse moves (or taps, on a touch screen) across the figure; true when the console stayed at rest throughout.
async function stillUnder(page, { touch = false } = {}) {
  const box = await figureBox(page);
  const seen = [];
  for (const [fx, fy] of [[0.15, 0.2], [0.85, 0.5], [0.5, 0.85], [0.9, 0.1]]) {
    const [x, y] = at(box, fx, fy);
    if (touch) await page.touchscreen.tap(x, y);
    else await page.mouse.move(x, y, { steps: 4 });
    await sleep(320);
    seen.push(await pose(page));
  }
  const moved = seen.find((p) => !atRest(p));
  return { still: !moved, detail: moved ? describe(moved) : "" };
}

// Elements with a transform, as "tag.class" keys, leaving out anything mid-animation.
const transformed = (page) =>
  page.evaluate(() =>
    [...document.querySelectorAll("body *")]
      .filter((el) => getComputedStyle(el).transform !== "none" && el.getAnimations().length === 0)
      .map((el) => `${el.tagName.toLowerCase()}.${el.getAttribute("class") ?? ""}`)
      .sort(),
  );

const readout = (page) => page.locator('section[aria-label="Pocket console"] .readout').textContent();
const sideways = (page) => page.evaluate(() => document.documentElement.scrollWidth - innerWidth);

async function shot(page, name) {
  if (!SHOTS_DIR) return;
  mkdirSync(SHOTS_DIR, { recursive: true });
  // a locator screenshot scrolls the section into view; the console's keys want the top of the page
  await page.locator('section[aria-label="Pocket console"]').screenshot({ path: path.join(SHOTS_DIR, `${name}.png`) });
  await page.evaluate(() => scrollTo({ top: 0, behavior: "instant" }));
}

async function desktop(browser, scheme) {
  const label = `1366x768 ${scheme}`;
  const { context, page } = await open(browser, { viewport: DESKTOP, scheme });
  try {
    await page.goto(`${BASE_URL}/`, { waitUntil: "domcontentloaded" });
    // a pointer already over the console while it boots
    const early = await figureBox(page);
    if (early) await page.mouse.move(...at(early, 0.7, 0.4));
    await hydrated(page);

    await page.mouse.move(4, DESKTOP.height - 4);
    await sleep(320);
    const rest = await pose(page);
    check(`${label}: at rest the console has no transform and no shadow`, atRest(rest), describe(rest));
    const restTransforms = await transformed(page);
    await shot(page, `${scheme}-desktop-rest`);

    const first = await firstTilt(page);
    check(`${label}: a hovering mouse tilts the console`, first.tilting && first.transform.startsWith("matrix3d"), describe(first));

    const right = await hover(page, 0.95, 0.5);
    check(
      `${label}: pointer at the right edge leans the right side away and slides the shadow left`,
      right.rightZ < -1 && Math.abs(right.topZ) < Math.abs(right.rightZ) && right.shadowX < 0 && right.shadowOpacity > 0,
      describe(right),
    );
    const top = await hover(page, 0.5, 0.05);
    check(
      `${label}: pointer at the top edge leans the top away and slides the shadow down`,
      top.topZ < -1 && top.shadowY > 0,
      describe(top),
    );

    const sweep = [];
    for (const [fx, fy] of [[0, 0], [1, 0], [1, 1], [0, 1], [0.5, 0.5], [0.02, 0.5], [0.98, 0.98], [0.3, 0.7]]) {
      sweep.push(await hover(page, fx, fy));
    }
    const widest = Math.max(...sweep.map((p) => p.angle));
    const corner = sweep[0].angle;
    check(`${label}: across edges and corners the tilt stays within ${LIMIT} degrees`, widest <= LIMIT + 0.05, `widest ${widest.toFixed(3)}°`);
    check(`${label}: a corner tilts the full way (5.5 to 6 degrees)`, corner >= 5.5 && corner <= LIMIT + 0.05, `${corner.toFixed(3)}°`);
    check(
      `${label}: the shadow slides at most ${LIMIT} px`,
      sweep.every((p) => Math.hypot(p.shadowX, p.shadowY) <= LIMIT + 0.05),
      sweep.map((p) => `(${p.shadowX}, ${p.shadowY})`).join(" "),
    );

    const tilted = await hover(page, 0.9, 0.15);
    const tiltTransforms = await transformed(page);
    const added = tiltTransforms.filter((k, i) => tiltTransforms.indexOf(k) === i && tiltTransforms.filter((x) => x === k).length > restTransforms.filter((x) => x === k).length);
    const removed = restTransforms.filter((k) => !tiltTransforms.includes(k));
    check(
      `${label}: only the console's tilt wrapper gains a transform`,
      tilted.tilting && added.length === 1 && added[0] === "div.machine-tilt" && removed.length === 0,
      `added [${added.join(", ")}], removed [${removed.join(", ")}]`,
    );
    const wide = await sideways(page);
    check(`${label}: nothing scrolls sideways while tilted`, wide <= 0, `${wide} px over`);
    await shot(page, `${scheme}-desktop-tilted`);

    const ms = await leave(page);
    check(`${label}: leaving returns the console to rest within ${LEAVE_MS} ms`, ms !== null, ms === null ? describe(await pose(page)) : "");
    if (ms !== null) console.log(`# ${label}: rest ${ms} ms after leave`);

    const boot = await page.evaluate(() => {
      const parts = [...document.querySelectorAll(".boot, .splash")];
      const menu = document.querySelector("g.boot");
      return {
        parts: parts.length,
        running: parts.flatMap((el) => el.getAnimations()).filter((a) => a.playState !== "finished").length,
        menu: menu ? getComputedStyle(menu).opacity : "missing",
      };
    });
    check(
      `${label}: the console booted with a pointer over it (menu shown, boot animations finished)`,
      boot.parts > 0 && boot.running === 0 && boot.menu === "1",
      JSON.stringify(boot),
    );

    // The controls still work, the pointer on them and off the figure.
    const before = await readout(page);
    await page.locator('section[aria-label="Pocket console"]').getByRole("button", { name: "▼ Down" }).click();
    const after = await readout(page);
    check(`${label}: the Down chip moves the menu`, before === "Press A to open work." && after === "Press A to open play.", `${before} -> ${after}`);
    await hover(page, 0.6, 0.6);
    await page.keyboard.press("ArrowDown");
    const keyed = await readout(page);
    await page.keyboard.press("ArrowUp");
    await page.keyboard.press("ArrowUp");
    check(`${label}: the arrow keys move the menu while it tilts`, keyed === "Press A to open notes." && (await readout(page)) === "Press A to open work.", keyed);

    // Keyboard focus reaches the screen-reader links, shown when tabbed to.
    let focus = null;
    for (let i = 0; i < 40 && !focus; i++) {
      await page.keyboard.press("Tab");
      focus = await page.evaluate(() => {
        const el = document.activeElement;
        if (!el?.closest('section[aria-label="Pocket console"] nav[aria-label="Pages"]')) return null;
        const r = el.getBoundingClientRect();
        return { text: el.textContent, width: r.width, height: r.height, visible: el.matches(":focus-visible") };
      });
    }
    check(
      `${label}: Tab focuses the console's page links, visibly`,
      focus !== null && focus.width > 0 && focus.height > 0 && focus.visible,
      JSON.stringify(focus),
    );
    // the console's keys work only at the top of the page
    await page.evaluate(() => {
      document.activeElement?.blur();
      scrollTo({ top: 0, behavior: "instant" });
    });

    // A reduced-motion preference turned on mid-hover puts it back and keeps it there; turned off, it tilts again.
    await hover(page, 0.85, 0.3);
    const hovering = await pose(page);
    await page.emulateMedia({ reducedMotion: "reduce" });
    let midway = null;
    try {
      await page.waitForFunction((sel) => !document.querySelector(sel).hasAttribute("data-tilting"), FIGURE, { timeout: LEAVE_MS, polling: "raf" });
      await sleep(80);
      midway = await pose(page);
    } catch {
      midway = await pose(page);
    }
    check(
      `${label}: reduced motion switched on mid-hover returns the console to rest`,
      hovering.tilting && atRest(midway),
      `${describe(hovering)} -> ${describe(midway)}`,
    );
    const reducedMoves = await stillUnder(page);
    check(`${label}: after that switch, mouse moves leave it still`, reducedMoves.still, reducedMoves.detail);
    await page.emulateMedia({ reducedMotion: "no-preference" });
    const again = await hover(page, 0.2, 0.8);
    check(`${label}: reduced motion switched off, it tilts again`, again.tilting && again.transform !== "none", describe(again));

    // A hidden document puts it back.
    await hover(page, 0.8, 0.8);
    await page.evaluate(() => {
      Object.defineProperty(document, "hidden", { value: true, configurable: true });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await sleep(320);
    const hidden = await pose(page);
    await page.evaluate(() => {
      delete document.hidden;
    });
    check(`${label}: a hidden document returns the console to rest`, atRest(hidden), describe(hidden));

    // A client-side hop away hides the page (Activity) and runs the cleanup; back again it rests, then tilts.
    await hover(page, 0.75, 0.25);
    await page.keyboard.press("a");
    await page.waitForURL(`${BASE_URL}/work`, { timeout: 10000 });
    await sleep(320);
    const away = await page.evaluate((sel) => {
      const fig = document.querySelector(sel);
      if (!fig) return "unmounted";
      return fig.hasAttribute("data-tilting") || fig.style.getPropertyValue("--tilt-x") ? "tilting" : "rest";
    }, FIGURE);
    check(`${label}: A opens Work and the hidden console is left at rest`, away === "rest" || away === "unmounted", away);
    await page.goBack();
    await page.waitForURL(`${BASE_URL}/`, { timeout: 10000 });
    await page.locator(FIGURE).waitFor({ state: "visible" });
    await sleep(320);
    const back = await pose(page);
    check(`${label}: back on Home the console is at rest`, atRest(back), describe(back));
    const retilt = await firstTilt(page);
    check(`${label}: back on Home a hovering mouse tilts it again`, retilt.tilting && retilt.transform !== "none", describe(retilt));
  } finally {
    await context.close();
  }
}

async function phone(browser, scheme) {
  const label = `390x844 touch ${scheme}`;
  const { context, page } = await open(browser, { viewport: PHONE, scheme });
  try {
    await page.goto(`${BASE_URL}/`, { waitUntil: "load" });
    await hydrated(page);
    const hoverable = await page.evaluate(() => matchMedia("(hover: hover) and (pointer: fine)").matches);
    check(`${label}: the screen is not a hover-capable fine pointer`, !hoverable);
    const taps = await stillUnder(page, { touch: true });
    check(`${label}: taps across the console leave it still`, taps.still, taps.detail);
    const moves = await stillUnder(page);
    check(`${label}: mouse events on the touch screen leave it still`, moves.still, moves.detail);
    const button = page.locator('section[aria-label="Pocket console"]').getByRole("button", { name: "▼ Down" });
    await button.tap();
    check(`${label}: the Down chip still moves the menu`, (await readout(page)) === "Press A to open play.", await readout(page));
    const wide = await sideways(page);
    check(`${label}: nothing scrolls sideways`, wide <= 0, `${wide} px over`);
    await shot(page, `${scheme}-phone`);
  } finally {
    await context.close();
  }
}

async function reduced(browser) {
  const label = "1366x768 reduced motion";
  const { context, page } = await open(browser, { viewport: DESKTOP, reduced: true });
  try {
    await page.goto(`${BASE_URL}/`, { waitUntil: "load" });
    await hydrated(page);
    const menu = await page.evaluate(() => getComputedStyle(document.querySelector("g.boot")).opacity);
    check(`${label}: the menu shows at once`, menu === "1", menu);
    const moves = await stillUnder(page);
    check(`${label}: mouse moves across the console leave it still`, moves.still, moves.detail);
    await page.locator('section[aria-label="Pocket console"]').getByRole("button", { name: "▼ Down" }).click();
    check(`${label}: the Down chip still moves the menu`, (await readout(page)) === "Press A to open play.", await readout(page));
  } finally {
    await context.close();
  }
}

// The same checks against a broken page must fail; their errors go to a separate sink.
async function negatives(browser) {
  const sink = [];
  {
    const { context, page } = await open(browser, {
      viewport: DESKTOP,
      reduced: true,
      sink,
      init: () => {
        const real = window.matchMedia.bind(window);
        window.matchMedia = (q) => real(q.includes("(hover: hover)") ? "all" : q);
      },
    });
    try {
      await page.goto(`${BASE_URL}/`, { waitUntil: "load" });
      await hydrated(page);
      const moves = await stillUnder(page);
      check("negative control: with the preference guard bypassed, the reduced-motion stillness check catches the tilt", !moves.still);
    } finally {
      await context.close();
    }
  }
  {
    const { context, page } = await open(browser, {
      viewport: DESKTOP,
      sink,
      init: () => {
        const add = EventTarget.prototype.addEventListener;
        EventTarget.prototype.addEventListener = function (type, ...rest) {
          if (type === "pointerleave") return;
          return add.call(this, type, ...rest);
        };
      },
    });
    try {
      await page.goto(`${BASE_URL}/`, { waitUntil: "load" });
      await hydrated(page);
      const tilted = await firstTilt(page);
      const ms = await leave(page);
      check("negative control: with the leave listener dropped, the leave check catches the stuck pose", tilted.tilting && ms === null);
    } finally {
      await context.close();
    }
  }
}

const browser = await chromium.launch();
try {
  for (const scheme of ["light", "dark"]) await desktop(browser, scheme);
  for (const scheme of ["light", "dark"]) await phone(browser, scheme);
  await reduced(browser);
  await negatives(browser);
  check("no console errors or page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
} finally {
  await browser.close();
}

console.log(`probe: ${ok} ok, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
