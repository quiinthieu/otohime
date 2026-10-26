// Drives headless Chromium over the Suminagashi Pond on /play. Run by scripts/probe-pond.sh, which installs
// Playwright and axe-core into PW_PREFIX and passes BASE_URL.
//
// The canvas reports its renderer, drop and vertex counts and state, but those are the component's own words, so
// the probe also looks: a screenshot of the pond after each tool must differ from the one before (ink moved), and
// one after Clear must differ from the print (the print was drawn). The pond's lazy chunk is found by its shader's
// first comment among the scripts /play requests with motion; it must be absent under reduced motion and from the
// HTML. A real touch drag goes through CDP, so the browser decides whether to take it for scrolling (pointercancel).
import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(path.join(process.env.PW_PREFIX, "package.json"));
const { chromium } = require("playwright");
const AXE_PATH = require.resolve("axe-core/axe.min.js");

const BASE_URL = process.env.BASE_URL;
const SHOTS_DIR = process.env.SHOTS_DIR || "";
const PHONE = { width: 390, height: 844 };
const DESKTOP = { width: 1366, height: 768 };
const POND = "main .pond";
const STAGE = `${POND} .pond-stage`;
const CANVAS = `${POND} canvas.pond-canvas`;
const STILL = `${POND} svg.pond-still`;
const CLAW = 'main [aria-label="Claw machine"]';
const MARKER = "suminagashi pond fill";
const IDLE_MS = 15000;
const OP_MS = 3000;

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
const label = (viewport) => (viewport === PHONE ? "390x844 touch" : "1366x768");

async function open(browser, { viewport, reduced = false, js = true, init = [], sink = errors }) {
  const phone = viewport === PHONE;
  const context = await browser.newContext({
    viewport,
    isMobile: phone,
    hasTouch: phone,
    javaScriptEnabled: js,
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
  for (const fn of init) await page.addInitScript(fn);
  return { context, page, scripts };
}

async function marked(scripts) {
  const urls = [...scripts.keys()];
  const bodies = await Promise.all(urls.map((u) => scripts.get(u)));
  return urls.filter((_, i) => bodies[i].includes(MARKER));
}

async function shot(page, name) {
  const buf = await page.locator(STAGE).screenshot();
  if (SHOTS_DIR) {
    mkdirSync(SHOTS_DIR, { recursive: true });
    writeFileSync(path.join(SHOTS_DIR, `${name}.png`), buf);
  }
  return buf;
}

const data = (page) => page.locator(CANVAS).evaluate((c) => ({ ...c.dataset }));

// Wait for the canvas to come live; null past the bound.
async function waitReady(page, timeout = IDLE_MS) {
  try {
    await page.waitForSelector(`${CANVAS}[data-state="ready"]`, { timeout, state: "attached" });
    return await data(page);
  } catch {
    return null;
  }
}

// Wait until a canvas data attribute passes a test; the last value either way.
async function waitData(page, key, test, timeout = OP_MS) {
  try {
    await page.waitForFunction(
      ({ sel, key, test }) => {
        const c = document.querySelector(sel);
        return c && new Function("v", `return ${test}`)(c.dataset[key]);
      },
      { sel: CANVAS, key, test },
      { timeout, polling: 50 },
    );
    return { pass: true, value: (await data(page))[key] };
  } catch {
    const c = await page.locator(CANVAS).count();
    return { pass: false, value: c ? (await data(page))[key] : "no canvas" };
  }
}

const printShown = (page) =>
  page.evaluate((sel) => {
    const svg = document.querySelector(sel);
    if (!svg) return { shown: false, why: "no svg" };
    const r = svg.getBoundingClientRect();
    const paths = svg.querySelectorAll("path").length;
    const hidden = svg.closest("[aria-hidden]")?.getAttribute("aria-hidden");
    return { shown: r.width > 200 && r.height > 120 && paths > 10 && hidden !== "true", why: `${r.width.toFixed(0)}x${r.height.toFixed(0)}, ${paths} paths, aria-hidden ${hidden}` };
  }, STILL);

const clawShown = (page) =>
  page.evaluate((sel) => {
    const m = document.querySelector(sel);
    const svg = m?.querySelector("svg");
    const r = svg?.getBoundingClientRect();
    const pond = document.querySelector("main .pond");
    const below = !!m && !!pond && (m.compareDocumentPosition(pond) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
    return { shown: !!r && r.width > 100 && r.height > 100 && below, why: r ? `${r.width.toFixed(0)}x${r.height.toFixed(0)}, pond after it ${below}` : "no claw machine svg" };
  }, CLAW);

async function runAxe(page, name) {
  await page.addScriptTag({ path: AXE_PATH });
  const violations = await page.evaluate(async () => {
    const result = await window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] } });
    return result.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length, first: v.nodes[0]?.target }));
  });
  const bad = violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  check(`${name}: axe finds nothing serious or critical on /play`, bad.length === 0, JSON.stringify(bad));
}

// A point on the canvas, as fractions of its box, in page px.
async function at(page, fx, fy) {
  const r = await page.locator(CANVAS).boundingBox();
  return [r.x + r.width * fx, r.y + r.height * fy];
}

// A real drag: the mouse on the desktop, CDP touch on the phone (so the browser may claim it for scrolling).
async function drag(page, cdp, from, to, steps = 12) {
  const [ax, ay] = await at(page, ...from);
  const [bx, by] = await at(page, ...to);
  if (!cdp) {
    await page.mouse.move(ax, ay);
    await page.mouse.down();
    for (let i = 1; i <= steps; i++) await page.mouse.move(ax + ((bx - ax) * i) / steps, ay + ((by - ay) * i) / steps);
    await page.mouse.up();
    return;
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: ax, y: ay }] });
  for (let i = 1; i <= steps; i++) {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: ax + ((bx - ax) * i) / steps, y: ay + ((by - ay) * i) / steps }] });
    await sleep(16);
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
}

async function press(page, cdp, fx, fy) {
  const [x, y] = await at(page, fx, fy);
  if (cdp) await page.touchscreen.tap(x, y);
  else await page.mouse.click(x, y);
}

const chip = (page, group, name) => page.locator(`${POND} fieldset:has(legend:text-is("${group}")) label.chip`).filter({ hasText: new RegExp(`^${name}$`) });
const button = (page, name) => page.locator(`${POND} button`).filter({ hasText: new RegExp(`^${name}$`) });
const statusText = (page) => page.locator(`${POND} .pond-status`).textContent();
const ariaLabel = (page) => page.locator(CANVAS).getAttribute("aria-label");

// The live pond at one size: every tool, the keyboard, the caps, the fallbacks to the print.
async function live(browser, viewport) {
  const name = label(viewport);
  const phone = viewport === PHONE;
  const { context, page, scripts } = await open(browser, { viewport });
  try {
    const res = await page.goto(`${BASE_URL}/play`, { waitUntil: "load" });
    const html = await res.text();
    check(`${name}: /play's HTML already holds the still print`, /<svg[^>]*class="pond-still"/.test(html) && (html.match(/<path d="M/g) ?? []).length > 10);
    const claw = await clawShown(page);
    check(`${name}: the claw machine still renders, above the pond`, claw.shown, claw.why);

    const below = await page.locator(POND).evaluate((el) => el.getBoundingClientRect().top > innerHeight);
    if (below) {
      await sleep(2500);
      const early = await page.locator(CANVAS).count();
      check(`${name}: below the fold the pond waits; no canvas until it is in view`, early === 0, `${early} canvases`);
    }
    await page.locator(POND).scrollIntoViewIfNeeded();
    const first = await waitReady(page);
    check(`${name}: in view and idle, the canvas comes live (data-state=ready)`, first !== null);
    if (!first) return { html, scripts };
    console.log(`# ${name}: renderer ${first.renderer}, ${first.drops} drops, ${first.verts} verts`);
    check(`${name}: data-renderer is webgl2 or 2d`, first.renderer === "webgl2" || first.renderer === "2d", first.renderer);
    check(`${name}: the live pond starts from the print's recipe (24 drops)`, first.drops === "24" && Number(first.verts) > 1000, JSON.stringify(first));
    const touch = await page.evaluate((sel) => ({ canvas: getComputedStyle(document.querySelector(sel)).touchAction, print: getComputedStyle(document.querySelector("main .pond-print")).touchAction }), CANVAS);
    check(`${name}: touch-action is none on the live canvas, pan-y on the print`, touch.canvas === "none" && touch.print === "pan-y", JSON.stringify(touch));
    const hidden = await page.locator(`${POND} .pond-print`).getAttribute("aria-hidden");
    check(`${name}: once live the print is hidden from assistive tech, the canvas is role=img`, hidden === "true" && (await page.locator(CANVAS).getAttribute("role")) === "img", `aria-hidden ${hidden}`);
    const groups = await page.evaluate(() => ({
      tool: [...document.querySelectorAll('main .pond fieldset:has(legend) input[type="radio"]')].filter((i) => i.closest("fieldset").querySelector("legend").textContent === "Tool").map((i) => i.labels[0].textContent),
      ink: [...document.querySelectorAll('main .pond fieldset:has(legend) input[type="radio"]')].filter((i) => i.closest("fieldset").querySelector("legend").textContent === "Ink").map((i) => i.labels[0].textContent),
    }));
    check(`${name}: a Tool radio group (Drip, Comb, Blow) and an Ink radio group (Sumi, Ai, Bengara, Clear water)`, JSON.stringify(groups) === JSON.stringify({ tool: ["Drip", "Comb", "Blow"], ink: ["Sumi", "Ai", "Bengara", "Clear water"] }), JSON.stringify(groups));

    await page.evaluate((sel) => {
      window.__cancels = 0;
      document.querySelector(sel).addEventListener("pointercancel", () => window.__cancels++);
    }, CANVAS);
    const cdp = phone ? await context.newCDPSession(page) : null;

    // Drip: one press, one more drop, different pixels.
    const print = await shot(page, `${name}-print`);
    await press(page, cdp, 0.2, 0.3);
    const dripped = await waitData(page, "drops", 'v === "25"');
    await sleep(100);
    const afterDrip = await shot(page, `${name}-drip`);
    check(`${name}: a ${phone ? "tap" : "click"} with Drip adds a drop (data-drops 24 -> 25)`, dripped.pass, `data-drops ${dripped.value}`);
    check(`${name}: and the drip changes the canvas's pixels`, !afterDrip.equals(print));
    const live1 = await statusText(page);
    check(`${name}: the aria-live line says the count`, live1 === "25 drops of ink on the pond." && (await page.locator(`${POND} .pond-status`).getAttribute("aria-live")) === "polite", live1);
    const label1 = await ariaLabel(page);
    check(`${name}: the canvas's label follows the count`, label1?.includes("25 drops of ink") ?? false, label1);

    // Comb: a drag rakes the pond, refining the rings.
    await chip(page, "Tool", "Comb").click();
    const vertsBefore = Number((await data(page)).verts);
    await drag(page, cdp, [0.15, 0.5], [0.85, 0.55]);
    const combed = await waitData(page, "verts", `Number(v) > ${vertsBefore}`);
    await sleep(100);
    const afterComb = await shot(page, `${name}-comb`);
    check(`${name}: a ${phone ? "touch" : "mouse"} drag with Comb raises data-verts`, combed.pass, `${vertsBefore} -> ${combed.value}`);
    check(`${name}: and the comb changes the pixels`, !afterComb.equals(afterDrip));

    // Blow: a swirl round the pointer.
    await chip(page, "Tool", "Blow").click();
    const beforeBlow = Number((await data(page)).verts);
    await drag(page, cdp, [0.45, 0.5], [0.6, 0.5], 8);
    const blown = await waitData(page, "verts", `Number(v) !== ${beforeBlow}`);
    await sleep(100);
    const afterBlow = await shot(page, `${name}-blow`);
    check(`${name}: a drag with Blow swirls the ink (data-verts moves, pixels change)`, blown.pass && !afterBlow.equals(afterComb), `${beforeBlow} -> ${blown.value}`);
    const cancels = await page.evaluate(() => window.__cancels);
    check(`${name}: no pointercancel during the drags`, cancels === 0, `${cancels} pointercancel`);

    // Ink and the buttons.
    await chip(page, "Ink", "Bengara").click();
    const bengara = await page.locator(`${POND} input[type="radio"]`).evaluateAll((is) => is.filter((i) => i.checked).map((i) => i.labels[0].textContent));
    check(`${name}: picking Bengara checks it beside the tool`, JSON.stringify(bengara) === JSON.stringify(["Blow", "Bengara"]), JSON.stringify(bengara));
    const n0 = Number((await data(page)).drops);
    await button(page, "Random drip").click();
    const rnd = await waitData(page, "drops", `v === "${n0 + 1}"`);
    check(`${name}: Random drip adds a drop`, rnd.pass, `${n0} -> ${rnd.value}`);
    const v0 = Number((await data(page)).verts);
    const beforeAcross = await shot(page, `${name}-before-across`);
    await button(page, "Comb across").click();
    const across = await waitData(page, "verts", `Number(v) !== ${v0}`);
    await sleep(100);
    check(`${name}: Comb across rakes the pond (data-verts moves, pixels change)`, across.pass && !(await shot(page, `${name}-across`)).equals(beforeAcross), `${v0} -> ${across.value}`);

    // The keyboard: Shift+Tab from the tools reaches the canvas; arrows move the reticle, Space drips.
    await chip(page, "Tool", "Drip").click();
    await page.locator(`${POND} input[type="radio"][value="drip"]`).focus();
    await page.keyboard.press("Shift+Tab");
    const focused = await page.evaluate((sel) => document.activeElement === document.querySelector(sel), CANVAS);
    const r0 = await page.locator(`${POND} .pond-reticle`).evaluate((r) => ({ display: getComputedStyle(r).display, left: r.style.left }));
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("Shift+ArrowUp");
    const r1 = await page.locator(`${POND} .pond-reticle`).evaluate((r) => ({ left: r.style.left, top: r.style.top }));
    check(`${name}: Shift+Tab reaches the canvas and shows the reticle; arrows move it`, focused && r0.display === "block" && r1.left !== r0.left && r1.top !== "50%", `focused ${focused}, ${JSON.stringify(r0)} -> ${JSON.stringify(r1)}`);
    const k0 = Number((await data(page)).drops);
    const scrollY = await page.evaluate(() => scrollY);
    await page.keyboard.press(" ");
    const keyed = await waitData(page, "drops", `v === "${k0 + 1}"`);
    const scrolled = await page.evaluate((y) => scrollY !== y, scrollY);
    check(`${name}: Space drips at the reticle without scrolling the page`, keyed.pass && !scrolled, `${k0} -> ${keyed.value}, scrolled ${scrolled}`);

    // Caps: random drips until the pond refuses one, then Clear.
    const filled = await page.evaluate(async (sel) => {
      const c = document.querySelector(sel);
      const b = [...document.querySelectorAll("main .pond button")].find((x) => x.textContent === "Random drip");
      for (let i = 0; i < 200 && c.dataset.state !== "full"; i++) {
        b.click();
        await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
      }
      return { ...c.dataset };
    }, CANVAS);
    const fullLine = await statusText(page);
    check(`${name}: at the cap the pond refuses ink and says "The pond is full"`, filled.state === "full" && fullLine.startsWith("The pond is full"), `${JSON.stringify(filled)}, "${fullLine}"`);
    await button(page, "Clear").click();
    const cleared = await waitData(page, "drops", 'v === "0"');
    await sleep(100);
    const blank = await shot(page, `${name}-clear`);
    const state = (await data(page)).state;
    check(`${name}: Clear empties the pond (0 drops, state ready, count said)`, cleared.pass && state === "ready" && (await statusText(page)) === "0 drops of ink on the pond.", `${cleared.value} ${state}`);
    check(`${name}: the canvas had drawn the print (it differs from clear water)`, !blank.equals(print));

    const wide = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    check(`${name}: nothing scrolls sideways`, wide <= 0, `${wide} px over`);
    await runAxe(page, `${name} live`);

    if (first.renderer === "webgl2") {
      await page.locator(CANVAS).evaluate((c) => c.getContext("webgl2").getExtension("WEBGL_lose_context").loseContext());
      let gone = false;
      try {
        await page.waitForSelector(CANVAS, { state: "detached", timeout: 1000 });
        gone = true;
      } catch {}
      const svg = await printShown(page);
      check(`${name}: a lost WebGL context removes the canvas and the print shows again`, gone && svg.shown, `removed ${gone}, ${svg.why}`);
    }

    // Reduced motion switched on unmounts the canvas (a fresh load, so the context is whole).
    await page.reload({ waitUntil: "load" });
    await page.locator(POND).scrollIntoViewIfNeeded();
    if (await waitReady(page)) {
      await page.emulateMedia({ reducedMotion: "reduce" });
      let gone = false;
      try {
        await page.waitForSelector(CANVAS, { state: "detached", timeout: 1000 });
        gone = true;
      } catch {}
      const svg = await printShown(page);
      check(`${name}: reduced motion switched on unmounts the canvas and shows the print`, gone && svg.shown, `removed ${gone}, ${svg.why}`);
      await page.emulateMedia({ reducedMotion: "no-preference" });
    }
    return { html, scripts };
  } finally {
    await context.close();
  }
}

// Under reduced motion or without JavaScript: the print, no canvas, no pond chunk.
async function still(browser, viewport, { reduced = false, js = true, init = [], sink = errors, axe = false } = {}) {
  const { context, page, scripts } = await open(browser, { viewport, reduced, js, init, sink });
  try {
    await page.goto(`${BASE_URL}/play`, { waitUntil: "load" });
    await page.locator(POND).scrollIntoViewIfNeeded();
    // past the idle timeout the loader waits on
    await sleep(3500);
    const canvases = await page.locator(CANVAS).count();
    const svg = await printShown(page);
    const claw = await clawShown(page);
    const note = await page.locator(`${POND} .pond-note`).textContent().catch(() => null);
    if (axe) await runAxe(page, `${label(viewport)} reduced motion`);
    return { canvases, svg, claw, note, chunks: await marked(scripts) };
  } finally {
    await context.close();
  }
}

// No WebGL2: the Canvas2D fallback draws and drips.
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
    await page.goto(`${BASE_URL}/play`, { waitUntil: "load" });
    await page.locator(POND).scrollIntoViewIfNeeded();
    const first = await waitReady(page);
    check(`${name}: the Canvas2D fallback comes live with the print's 24 drops`, first?.renderer === "2d" && first?.drops === "24", JSON.stringify(first));
    if (!first) return;
    const before = await shot(page, "fallback-print");
    await press(page, null, 0.7, 0.4);
    const dripped = await waitData(page, "drops", 'v === "25"');
    await sleep(100);
    check(`${name}: a drip adds a drop and changes the pixels`, dripped.pass && !(await shot(page, "fallback-drip")).equals(before), `data-drops ${dripped.value}`);
    await chip(page, "Tool", "Comb").click();
    const v0 = Number((await data(page)).verts);
    await drag(page, null, [0.2, 0.3], [0.8, 0.35]);
    const combed = await waitData(page, "verts", `Number(v) > ${v0}`);
    check(`${name}: a comb drag raises data-verts`, combed.pass, `${v0} -> ${combed.value}`);
  } finally {
    await context.close();
  }
}

// The same checks against a broken page must fail; their errors go to a separate sink.
async function negatives(browser) {
  const sink = [];
  {
    const guardless = await still(browser, DESKTOP, {
      reduced: true,
      sink,
      init: [
        () => {
          const real = window.matchMedia.bind(window);
          window.matchMedia = (q) => real(q.includes("prefers-reduced-motion: no-preference") ? "all" : q);
        },
      ],
    });
    check("negative control: with the motion guard bypassed, the reduced-motion check catches the canvas", guardless.canvases > 0 && guardless.chunks.length > 0, `${guardless.canvases} canvases, ${guardless.chunks.length} pond chunks`);
  }
  {
    const { context, page } = await open(browser, { viewport: DESKTOP, sink });
    try {
      await page.goto(`${BASE_URL}/play`, { waitUntil: "load" });
      await page.locator(POND).scrollIntoViewIfNeeded();
      await waitReady(page);
      await page.evaluate(() => (window.requestAnimationFrame = () => 0));
      await press(page, null, 0.3, 0.3);
      const dripped = await waitData(page, "drops", 'v === "25"', 1500);
      check("negative control: with animation frames stopped, the drip check catches the unchanged count", !dripped.pass, `data-drops ${dripped.value}`);
    } finally {
      await context.close();
    }
  }
  {
    const context = await browser.newContext({ viewport: PHONE, isMobile: true, hasTouch: true });
    const page = await context.newPage();
    try {
      await page.goto(`${BASE_URL}/play`, { waitUntil: "load" });
      await page.locator(POND).scrollIntoViewIfNeeded();
      await waitReady(page);
      // a canvas that lets the page pan, as one with touch-action left at pan-y would
      await page.evaluate((sel) => {
        const c = document.querySelector(sel);
        c.style.touchAction = "pan-y";
        window.__cancels = 0;
        c.addEventListener("pointercancel", () => window.__cancels++);
      }, CANVAS);
      const cdp = await context.newCDPSession(page);
      await drag(page, cdp, [0.5, 0.8], [0.5, 0.1]);
      await sleep(300);
      const cancels = await page.evaluate(() => window.__cancels);
      check("negative control: with touch-action pan-y on the canvas, a vertical touch drag fires pointercancel", cancels > 0, `${cancels} pointercancel`);
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
    const { html, scripts } = await live(browser, viewport);
    const chunks = await marked(scripts);
    check(`${name}: the pond arrives in its own lazy chunk`, chunks.length >= 1, `${scripts.size} scripts, none with "${MARKER}"`);
    const named = chunks.filter((u) => html.includes(new URL(u).pathname));
    check(`${name}: /play's HTML names no pond chunk (first-load JS stays lazy)`, chunks.length > 0 && named.length === 0, JSON.stringify(named));
    console.log(`# ${name}: pond chunks ${chunks.map((u) => new URL(u).pathname).join(" ")}`);

    const calm = await still(browser, viewport, { reduced: true, axe: true });
    check(`${name} reduced motion: no canvas renders and no pond chunk is requested`, calm.canvases === 0 && calm.chunks.length === 0, `${calm.canvases} canvases, ${JSON.stringify(calm.chunks)}`);
    check(`${name} reduced motion: the SVG print shows, with its note`, calm.svg.shown && (calm.note ?? "").startsWith("A still print"), `${calm.svg.why}, note ${calm.note}`);
    check(`${name} reduced motion: the claw machine still renders`, calm.claw.shown, calm.claw.why);

    const off = await still(browser, viewport, { js: false });
    check(`${name} JavaScript off: the SVG print shows and no canvas`, off.svg.shown && off.canvases === 0, `${off.svg.why}, ${off.canvases} canvases`);
    check(`${name} JavaScript off: the claw machine still renders`, off.claw.shown, off.claw.why);
  }
  await fallback(browser);
  await negatives(browser);
  check("no console errors or page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
} finally {
  await browser.close();
}

console.log(`probe: ${ok} ok, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
