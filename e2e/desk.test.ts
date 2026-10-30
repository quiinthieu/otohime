// The Ink Desk in a real browser, against a running production server: a drag that survives a reload, the
// string following a pin, Tidy up, the keys, the long-press menu, reduced motion (with the full-motion run as
// its negative control) and the stacked desk on a phone, a narrow window and a touch tablet. Drives Chrome
// through playwright-core: CHROME_PATH if set, else the installed Google Chrome, else Playwright's own Chromium.
// What is real: the built page, React, CSS, the media queries, requestAnimationFrame, the browser's transition
// and animation events, and touches sent through the DevTools protocol. The full-motion notebook control alone
// installs a browser clock and drives its last phase, so a 900ms navigation fallback cannot outrun its frame-count
// assertion on a busy host. Other pages, including every swipe control, use real clocks. Sound stays off.
//   BASE_URL  the server (default http://localhost:4000)
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { after, before, test } from "node:test";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright-core";
import { DRAG_THRESHOLD, STACKED, PINS, PIN_PAIRS, dropAt, pastThreshold, pinHomes } from "../app/(site)/(app)/desk/_lib/drag.ts";
import { LONG_PRESS_MS } from "../app/(site)/(app)/desk/_lib/long-press.ts";
import { formatTrace, hasGesture, traceOf, type GestureRecord } from "../scripts/e2e-gesture-trace.ts";
import {
  DESK_ITEMS,
  DESK_KEY,
  NUDGE,
  NUDGE_FAST,
  ROTATE_STEP,
  bringToFront,
  defaultLayout,
  deskSay,
  moveTo,
  normalizeRot,
  nudge,
  parseDesk,
  rotate,
  sendToBack,
  tidy,
  type DeskLayout,
} from "../lib/desk.ts";

const BASE = process.env.BASE_URL ?? "http://localhost:4000";
const DESKTOP = { width: 1366, height: 900 };
const PHONE = { width: 390, height: 844 };
const NARROW = { width: 600, height: 900 };
const TABLET = { width: 1024, height: 1366 };
const TIMEOUT = 90_000;
const N = DESK_ITEMS.length;

type Probe = {
  transitions: string[];
  animations: string[];
  // every transform an item or a leaf took, in order, by data-desk-item id or leaf index
  items: Record<string, string[]>;
  leaves: Record<string, string[]>;
  // the pointer events since the last forget() (swipe() calls it), for a failed gesture's trace
  gestures: GestureRecord[];
};

declare global {
  interface Window {
    __desk: Probe;
  }
}

// Runs in the page before any of its scripts.
function instrument() {
  const probe: Probe = { transitions: [], animations: [], items: {}, leaves: {}, gestures: [] };
  window.__desk = probe;
  const name = (t: EventTarget | null) =>
    t instanceof Element ? `${t.tagName.toLowerCase()}${typeof t.className === "string" && t.className ? `.${t.className.split(" ").join(".")}` : ""}` : "";
  const inDesk = (t: EventTarget | null) => t instanceof Element && t.closest(".desk-wrap") !== null;
  document.addEventListener("transitionrun", (e) => inDesk(e.target) && probe.transitions.push(`${name(e.target)} ${e.propertyName}`), true);
  document.addEventListener("animationstart", (e) => inDesk(e.target) && probe.animations.push(`${name(e.target)} ${e.animationName}`), true);
  const push = (list: string[], value: string) => list.at(-1) !== value && list.push(value);
  new MutationObserver((records) => {
    for (const r of records) {
      const el = r.target as HTMLElement;
      const id = el.getAttribute("data-desk-item");
      if (id) push((probe.items[id] ??= []), el.style.transform);
      if (el.classList.contains("desk-leaf")) {
        const i = String([...document.querySelectorAll(".desk-leaf")].indexOf(el));
        push((probe.leaves[i] ??= []), el.style.transform);
      }
    }
  }).observe(document, { subtree: true, attributes: true, attributeFilter: ["style"] });
  // Before the page's own handlers (React listens on its root): what arrived, where, and whether the item under it
  // was already dragging. Capped here too; scripts/e2e-gesture-trace.ts keeps the last 40 for a message.
  for (const type of ["pointerdown", "pointermove", "pointerup", "pointercancel"] as const) {
    document.addEventListener(
      type,
      (e) => {
        if (probe.gestures.length >= 400) probe.gestures.shift();
        probe.gestures.push({
          type,
          t: e.timeStamp,
          x: e.clientX,
          y: e.clientY,
          pointerId: e.pointerId,
          pointerType: e.pointerType,
          target: name(e.target),
          dragging: e.target instanceof Element && e.target.closest("[data-desk-item]")?.hasAttribute("data-dragging") === true,
        });
      },
      true,
    );
  }
}

let browser: Browser;
const contexts: BrowserContext[] = [];
const errors: string[] = [];

// Chrome puts its singleton socket under TMPDIR and aborts when that path passes the 108-byte socket limit
// (a deep per-job TMPDIR does): such a TMPDIR is swapped for a short one under /tmp, removed afterwards.
let shortTmp = "";
function browserEnv(): Record<string, string | undefined> {
  if (tmpdir().length <= 60) return process.env;
  shortTmp ||= mkdtempSync("/tmp/desk-e2e-");
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
      throw new Error(`e2e/desk.test.ts needs a browser: install Google Chrome or set CHROME_PATH (${String(chrome).split("\n")[0]})`);
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

type Open = { viewport?: { width: number; height: number }; touch?: boolean; reduced?: boolean; js?: boolean; frameClock?: boolean };

async function open({ viewport = DESKTOP, touch = false, reduced = false, js = true, frameClock = false }: Open = {}): Promise<Page> {
  const context = await browser.newContext({
    viewport,
    isMobile: touch,
    hasTouch: touch,
    reducedMotion: reduced ? "reduce" : "no-preference",
    javaScriptEnabled: js,
  });
  contexts.push(context);
  const page = await context.newPage();
  if (frameClock) await page.clock.install();
  // The desk's own errors (a hydration mismatch among them), not those of the pages its links lead to.
  const onDeskPage = () => new URL(page.url()).pathname === "/desk";
  page.on("pageerror", (e) => onDeskPage() && errors.push(`${page.url()}: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error" && onDeskPage()) errors.push(`${page.url()} console: ${m.text()}`);
  });
  if (js) await page.addInitScript(instrument);
  const res = await page.goto(`${BASE}/desk`, { waitUntil: "load" });
  assert.equal(res?.status(), 200);
  if (js) await hydrated(page);
  return page;
}

// React has hydrated the items and the Tidy up chip (their props are on the nodes).
async function hydrated(page: Page) {
  await page.waitForFunction(
    () =>
      [document.querySelector(".desk-item"), document.querySelector(".desk-bar button")].every(
        (el) => el && Object.keys(el).some((k) => k.startsWith("__reactProps")),
      ),
    null,
    { timeout: 20_000 },
  );
}

const item = (page: Page, id: string) => page.locator(`[data-desk-item="${id}"]`);
const link = (page: Page, id: string) => page.locator(`[data-desk-item="${id}"] .desk-link`);
const raw = (page: Page) => page.evaluate((key) => localStorage.getItem(key), DESK_KEY);
const stored = async (page: Page) => parseDesk(await raw(page));
const said = async (page: Page) => ((await page.locator("[data-desk-said]").textContent()) ?? "").replace(/ $/, "");
const probe = (page: Page) => page.evaluate(() => window.__desk);
const deskSize = (page: Page) =>
  page.evaluate(() => {
    const r = document.querySelector(".desk")!.getBoundingClientRect();
    return { w: r.width, h: r.height };
  });
const transformOf = (page: Page, id: string) => item(page, id).evaluate((el) => (el as HTMLElement).style.transform);

// The component's transform for a body: lib rounding, then the base, the offset and the angle.
const r2 = (v: number) => Math.round(v * 100) / 100 || 0;
const itemTransform = (x: number, y: number, deg: number) => `translate(-50%, -50%) translate(${r2(x)}px, ${r2(y)}px) rotate(${r2(deg)}deg)`;
const at = (layout: DeskLayout, id: string) => layout.find((it) => it.id === id)!;
const restOf = (layout: DeskLayout, id: string) => itemTransform(0, 0, at(layout, id).rot);

// Every item has sprung onto its committed spot.
const settled = (page: Page, layout: DeskLayout) =>
  page.waitForFunction(
    (want) => Object.entries(want).every(([id, t]) => (document.querySelector(`[data-desk-item="${id}"]`) as HTMLElement).style.transform === t),
    Object.fromEntries(layout.map((it) => [it.id, restOf(layout, it.id)])),
    { timeout: 10_000 },
  );

function near(actual: number, expected: number, what: string, eps = 1e-6) {
  assert.ok(Math.abs(actual - expected) < eps, `${what}: ${actual} is not ${expected}`);
}
// An inline percentage as the browser prints it back: to four places.
const nearPct = (actual: string, expected: number, what: string) => near(parseFloat(actual), expected, what, 1e-3);
function sameLayout(actual: DeskLayout, expected: DeskLayout) {
  for (const want of expected) {
    const got = at(actual, want.id);
    near(got.x, want.x, `${want.id} x`);
    near(got.y, want.y, `${want.id} y`);
    near(got.rot, want.rot, `${want.id} rot`);
    assert.equal(got.z, want.z, `${want.id} z`);
  }
}

// An element's centre from the desk's corner: the page above the desk may settle a pixel or two after a load.
const onDesk = (page: Page, selector: string) =>
  page.evaluate((selector) => {
    const desk = document.querySelector(".desk")!.getBoundingClientRect();
    const r = document.querySelector(selector)!.getBoundingClientRect();
    return { x: r.x + r.width / 2 - desk.x, y: r.y + r.height / 2 - desk.y };
  }, selector);

async function centre(page: Page, selector: string) {
  const box = await page.locator(selector).boundingBox();
  assert.ok(box, `${selector} is laid out`);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

// A mouse drag of an item's link by (dx, dy), in steps, without letting go.
async function grab(page: Page, selector: string, dx: number, dy: number) {
  const c = await centre(page, selector);
  await page.mouse.move(c.x, c.y);
  await page.mouse.down();
  await page.mouse.move(c.x + dx, c.y + dy, { steps: 12 });
}

// The pointer events the page saw since the last forget(), kept to the last 40 and formatted for a message.
const forget = (page: Page) => page.evaluate(() => void (window.__desk.gestures = []));
const traceOfPage = async (page: Page) => traceOf((await probe(page)).gestures);
const gestureTrace = async (page: Page) => `pointer events the page saw:\n${formatTrace(await traceOfPage(page))}`;

// The tape's box once it is on screen and has held still for two animation frames (a font or an image above the
// desk can still move it after the load), and the element the browser would hit at its centre.
async function settledTape(page: Page, selector: string) {
  await page.locator(selector).scrollIntoViewIfNeeded({ timeout: 5_000 });
  let last = "";
  for (let i = 0; i < 60; i++) {
    const seen = await page.evaluate(async (selector) => {
      const frame = () => new Promise((done) => requestAnimationFrame(done));
      const box = () => {
        const r = document.querySelector(selector)!.getBoundingClientRect();
        return { x: r.x, y: r.y, w: r.width, h: r.height };
      };
      const a = box();
      await frame();
      await frame();
      const b = box();
      const c = { x: b.x + b.w / 2, y: b.y + b.h / 2 };
      const hit = document.elementFromPoint(c.x, c.y);
      return {
        still: JSON.stringify(a) === JSON.stringify(b),
        inView: c.x >= 0 && c.y >= 0 && c.x < innerWidth && c.y < innerHeight && b.w > 0 && b.h > 0,
        isTape: hit === document.querySelector(selector),
        hit: hit ? `${hit.tagName.toLowerCase()}.${String(hit.className).split(" ").join(".")}` : "nothing",
        box: b,
        c,
      };
    }, selector);
    last = JSON.stringify(seen);
    if (seen.still && seen.inView) {
      assert.ok(seen.isTape, `the finger lands on ${selector}, not on ${seen.hit} (${last})`);
      return seen.c;
    }
  }
  assert.fail(`${selector} never held still on screen for two frames (${last})`);
}

// A finger on the item's tape (its drag handle on touch), sent as real touches through the DevTools protocol.
// `drags` says what the page must show: a drag (data-dragging set on the item after the first move past
// DRAG_THRESHOLD, cleared after the let-go) or none at all. Either way a miss fails with the gesture's trace.
async function swipe(page: Page, id: string, dx: number, dy: number, { holdMs = 0, drags }: { holdMs?: number; drags: boolean }) {
  const body = `[data-desk-item="${id}"]`;
  const c = await settledTape(page, `${body} .desk-tape`);
  const dragging = page.locator(`${body}[data-dragging]`);
  const shows = async (state: "attached" | "detached", what: string) => {
    try {
      await dragging.waitFor({ state, timeout: 5_000 });
    } catch {
      assert.fail(`${what}\n${await gestureTrace(page)}`);
    }
  };
  await forget(page);
  const cdp = await page.context().newCDPSession(page);
  const touch = (type: "touchStart" | "touchMove" | "touchEnd", x: number, y: number) =>
    cdp.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x, y, id: 1 }] });
  try {
    await touch("touchStart", c.x, c.y);
    if (holdMs) await page.waitForTimeout(holdMs);
    let past = false;
    for (let i = 1; i <= 10; i++) {
      await touch("touchMove", c.x + (dx * i) / 10, c.y + (dy * i) / 10);
      if (drags && !past && pastThreshold((dx * i) / 10, (dy * i) / 10)) {
        past = true;
        await shows("attached", `${id} is dragging after the first move past ${DRAG_THRESHOLD}px`);
      }
    }
    if (drags) assert.ok(past, `a swipe of (${dx}, ${dy}) is a drag`);
    else assert.equal(await dragging.count(), 0, `${id} does not drag\n${await gestureTrace(page)}`);
    await touch("touchEnd", c.x + dx, c.y + dy);
    if (drags) await shows("detached", `${id} is let go after the touch ends`);
  } finally {
    await cdp.detach();
  }
  // The finger's press and let-go both reached the page (a no-drag swipe must not lose them either).
  const trace = await traceOfPage(page);
  assert.ok(hasGesture(trace, "pointerdown") && (hasGesture(trace, "pointerup") || hasGesture(trace, "pointercancel")), `the swipe reached the page\n${await gestureTrace(page)}`);
}

const tabTo = async (page: Page, id: string) => {
  for (let i = 0; i < 80; i++) {
    await page.keyboard.press("Tab");
    if (await page.evaluate((id) => document.activeElement?.closest("[data-desk-item]")?.getAttribute("data-desk-item") === id, id)) return;
  }
  assert.fail(`Tab never reaches ${id}`);
};

test("a dragged item stays where it was dropped after a reload, and the red string follows a pin live", { timeout: TIMEOUT }, async () => {
  const page = await open();
  assert.equal(await raw(page), null, "a fresh desk");
  const fresh = defaultLayout();
  for (const it of fresh) {
    const style = await item(page, it.id).evaluate((el) => ({ left: (el as HTMLElement).style.left, top: (el as HTMLElement).style.top }));
    nearPct(style.left, it.x * 100, `${it.id} left`);
    nearPct(style.top, it.y * 100, `${it.id} top`);
  }
  await settled(page, fresh);

  const size = await deskSize(page);
  const [dx, dy] = [140, -90];
  await grab(page, `[data-desk-item="music"] .desk-link`, dx, dy);
  assert.equal(await item(page, "music").getAttribute("data-dragging"), "", "past the threshold the press is a drag");
  await page.mouse.up();
  assert.equal(new URL(page.url()).pathname, "/desk", "the click a drag ends with goes nowhere");
  assert.equal(await item(page, "music").getAttribute("data-dragging"), null);

  // Where it went: its spot moved by the drag over the desk's size, and it came to the front.
  const to = dropAt(at(fresh, "music"), dx, dy, size);
  const want = moveTo(bringToFront(fresh, "music"), "music", to.x, to.y);
  const dropped = await stored(page);
  sameLayout(dropped, want);
  assert.equal(at(dropped, "music").z, N - 1);
  await settled(page, dropped);
  const moved = await onDesk(page, `[data-desk-item="music"]`);

  await page.reload({ waitUntil: "load" });
  await hydrated(page);
  sameLayout(await stored(page), want);
  await settled(page, want);
  const style = await item(page, "music").evaluate((el) => ({ left: (el as HTMLElement).style.left, top: (el as HTMLElement).style.top, z: (el as HTMLElement).style.zIndex }));
  nearPct(style.left, to.x * 100, "music left after the reload");
  nearPct(style.top, to.y * 100, "music top after the reload");
  assert.equal(style.z, String(N), "still on top after the reload");
  const back = await onDesk(page, `[data-desk-item="music"]`);
  assert.ok(Math.abs(back.x - moved.x) < 1 && Math.abs(back.y - moved.y) < 1, `drawn where it was dropped ${JSON.stringify([moved, back])}`);

  // The string: a path per related pair, redrawn while a pin is held, not only when it lands.
  assert.ok(PIN_PAIRS.length > 0, "some pinned projects share a tag");
  const [a] = PIN_PAIRS[0];
  const path = page.locator(".desk-string path").first();
  assert.equal(await page.locator(".desk-string path").count(), PIN_PAIRS.length);
  const before = await path.getAttribute("d");
  await grab(page, `[data-pin="${a}"] .desk-pin-head`, 30, 40);
  await page.waitForFunction((d) => document.querySelector(".desk-string path")?.getAttribute("d") !== d, before, { timeout: 5_000 });
  const during = await path.getAttribute("d");
  await page.mouse.up();
  assert.notEqual(during, before, "the string follows the pin during the drag");
  assert.equal(new URL(page.url()).pathname, "/desk");
  const pinStyle = () => page.locator(`[data-pin="${a}"]`).evaluate((el) => ({ left: (el as HTMLElement).style.left, top: (el as HTMLElement).style.top }));
  const droppedPin = await pinStyle();
  await page.reload({ waitUntil: "load" });
  await hydrated(page);
  await page.waitForFunction(({ id, spot }) => {
    const el = document.querySelector<HTMLElement>(`[data-pin="${id}"]`);
    return el?.style.left === spot.left && el?.style.top === spot.top;
  }, { id: a, spot: droppedPin }, { timeout: 5_000 });
  assert.deepEqual(await pinStyle(), droppedPin, "pinned project positions survive a reload too");
  await page.getByRole("button", { name: "Tidy up", exact: true }).click();
  await page.reload({ waitUntil: "load" });
  await hydrated(page);
  const homePin = pinHomes()[a];
  const tidiedPin = await pinStyle();
  nearPct(tidiedPin.left, homePin.x * 100, "tidied pin left after reload");
  nearPct(tidiedPin.top, homePin.y * 100, "tidied pin top after reload");
  assert.deepEqual(errors, []);
});

test("Tidy up springs everything home and square, keeps the stack, and the tidy desk survives a reload", { timeout: TIMEOUT }, async () => {
  const page = await open();
  await grab(page, `[data-desk-item="sketches"] .desk-link`, -200, 60);
  await page.mouse.up();
  await link(page, "projects").focus();
  await page.keyboard.press("r");
  const messy = await stored(page);
  assert.notEqual(at(messy, "sketches").x, at(defaultLayout(), "sketches").x);

  await page.getByRole("button", { name: "Tidy up", exact: true }).click();
  const want = tidy(messy);
  const done = await stored(page);
  sameLayout(done, want);
  for (const it of done) {
    const home = DESK_ITEMS.find((e) => e.id === it.id)!;
    assert.deepEqual([it.x, it.y, it.rot], [home.x, home.y, 0], `${it.id} is home and square`);
  }
  assert.equal(at(done, "sketches").z, at(messy, "sketches").z, "the stacking order is kept");
  assert.equal(await said(page), deskSay("", { type: "tidied" }));
  await settled(page, done);

  await page.reload({ waitUntil: "load" });
  await hydrated(page);
  sameLayout(await stored(page), want);
  await settled(page, want);
  assert.deepEqual(errors, []);
});

test("from the keyboard: Tab to an item, arrows nudge it (Shift for more), R turns it, [ and ] restack it, each said aloud", { timeout: TIMEOUT }, async () => {
  const page = await open();
  await tabTo(page, "sketches");
  const size = await deskSize(page);
  let want = defaultLayout();
  const label = DESK_ITEMS.find((e) => e.id === "sketches")!.label;

  await page.keyboard.press("ArrowRight");
  want = nudge(want, "sketches", NUDGE, 0, size);
  sameLayout(await stored(page), want);
  assert.equal(await said(page), deskSay(label, { type: "moved", x: at(want, "sketches").x, y: at(want, "sketches").y }));

  await page.keyboard.press("Shift+ArrowUp");
  want = nudge(want, "sketches", 0, -NUDGE_FAST, size);
  sameLayout(await stored(page), want);

  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowLeft");
  want = nudge(nudge(want, "sketches", 0, NUDGE, size), "sketches", -NUDGE, 0, size);
  sameLayout(await stored(page), want);

  await page.keyboard.press("r");
  want = rotate(want, "sketches", ROTATE_STEP);
  sameLayout(await stored(page), want);
  assert.equal(await said(page), deskSay(label, { type: "rotated", rot: at(want, "sketches").rot }));
  await page.keyboard.press("Shift+R");
  await page.keyboard.press("Shift+R");
  want = rotate(want, "sketches", -2 * ROTATE_STEP);
  near(at(want, "sketches").rot, normalizeRot(at(defaultLayout(), "sketches").rot - ROTATE_STEP), "Shift+R turns back");
  sameLayout(await stored(page), want);

  await page.keyboard.press("[");
  want = sendToBack(want, "sketches");
  sameLayout(await stored(page), want);
  assert.equal(at(want, "sketches").z, 0);
  assert.equal(await said(page), deskSay(label, { type: "back" }));
  await page.keyboard.press("]");
  want = bringToFront(want, "sketches");
  sameLayout(await stored(page), want);
  assert.equal(at(want, "sketches").z, N - 1);
  assert.equal(await said(page), deskSay(label, { type: "front" }));

  // The body springs into its new spot and angle, and the focus never left it.
  await settled(page, want);
  assert.equal(await page.evaluate(() => document.activeElement?.closest("[data-desk-item]")?.getAttribute("data-desk-item")), "sketches");
  // Enter is still the link's.
  await page.keyboard.press("Enter");
  await page.waitForURL(`${BASE}/sketches`, { timeout: 10_000 });
  assert.deepEqual(errors, []);
});

test("a long press opens the radial menu without following the link; it rotates, sends to back, and Esc closes it", { timeout: TIMEOUT }, async () => {
  const page = await open();
  const label = DESK_ITEMS.find((e) => e.id === "projects")!.label;
  const menu = page.locator(`[data-desk-menu="projects"]`);
  const c = await centre(page, `[data-desk-item="projects"] .desk-link`);
  await page.mouse.move(c.x, c.y);
  await page.mouse.down();
  await page.waitForTimeout(LONG_PRESS_MS / 2);
  assert.equal(await menu.count(), 0, "not before the long press is up");
  await menu.waitFor({ state: "attached", timeout: LONG_PRESS_MS * 2 });
  await page.mouse.up();
  assert.equal(new URL(page.url()).pathname, "/desk", "the hold's let-go is not a click on the link");
  assert.equal(await menu.getAttribute("role"), "menu");
  assert.deepEqual(await menu.locator('[role="menuitem"]').allTextContents(), ["Open", "Rotate", "Send to back"]);
  assert.equal(await page.evaluate(() => document.activeElement?.getAttribute("data-menu")), "open", "the menu takes the focus");
  assert.equal(await link(page, "projects").getAttribute("aria-expanded"), "true");
  assert.equal(await said(page), deskSay(label, { type: "menu" }));

  // Arrows go round it; Rotate turns the item and leaves the menu open.
  await page.keyboard.press("ArrowRight");
  assert.equal(await page.evaluate(() => document.activeElement?.getAttribute("data-menu")), "rotate");
  await page.keyboard.press("Enter");
  let want = rotate(defaultLayout(), "projects", ROTATE_STEP);
  sameLayout(await stored(page), want);
  assert.equal(await menu.count(), 1);

  // Send to back restacks it, closes the menu and hands the focus back to the item.
  await menu.locator('[data-menu="back"]').click();
  want = sendToBack(want, "projects");
  sameLayout(await stored(page), want);
  assert.equal(at(want, "projects").z, 0);
  assert.equal(await menu.count(), 0);
  assert.equal(await page.evaluate(() => document.activeElement?.closest("[data-desk-item]")?.getAttribute("data-desk-item")), "projects");

  // From the keyboard: Shift+F10 opens it, Esc closes it and the focus goes home.
  await page.keyboard.press("Shift+F10");
  await menu.waitFor({ state: "attached", timeout: 2_000 });
  await page.keyboard.press("Escape");
  assert.equal(await menu.count(), 0);
  assert.equal(await said(page), deskSay(label, { type: "closed" }));
  assert.equal(await page.evaluate(() => document.activeElement?.closest("[data-desk-item]")?.getAttribute("data-desk-item")), "projects");

  // A right click opens it too, a press outside closes it, and Open follows the link.
  await link(page, "music").click({ button: "right" });
  await page.locator(`[data-desk-menu="music"]`).waitFor({ state: "attached", timeout: 2_000 });
  const desk = await page.locator(".desk").boundingBox();
  assert.ok(desk);
  await page.mouse.click(desk.x + desk.width - 8, desk.y + desk.height - 8);
  assert.equal(await page.locator(".desk-menu").count(), 0);
  await link(page, "music").click({ button: "right" });
  await page.locator(`[data-desk-menu="music"] [data-menu="open"]`).click();
  await page.waitForURL(`${BASE}/music`, { timeout: 10_000 });
  assert.deepEqual(errors, []);
});

// One walk over the desk, run with motion and without: hover the chip, drag and drop, hold for the menu, nudge,
// tidy, then open the notebook. What each run saw, for the two tests below to compare.
async function walk(page: Page, { driveNotebook = false } = {}) {
  const fresh = defaultLayout();
  await page.getByRole("button", { name: "Tidy up", exact: true }).hover();
  await page.waitForTimeout(300);

  const [dx, dy] = [120, 70];
  await grab(page, `[data-desk-item="music"] .desk-link`, dx, dy);
  const held = await transformOf(page, "music");
  await page.evaluate(() => (window.__desk.items.music = []));
  await page.mouse.up();
  const dropped = await transformOf(page, "music");
  await page.waitForTimeout(500);
  const afterDrop = (await probe(page)).items.music ?? [];

  const c = await centre(page, `[data-desk-item="projects"] .desk-link`);
  await page.mouse.move(c.x, c.y);
  await page.mouse.down();
  await page.locator(`[data-desk-menu="projects"]`).waitFor({ state: "attached", timeout: LONG_PRESS_MS * 2 });
  const menuAnim = await page.locator(".desk-menu").evaluate((el) => `${getComputedStyle(el).animationName} ${el.getAnimations().length}`);
  // Long enough for a frame to send any animation event: a menu removed first never sends one.
  if (menuAnim.startsWith("desk-menu-in")) {
    await page.waitForFunction(() => window.__desk.animations.some((a) => a.endsWith("desk-menu-in")), null, { timeout: 2_000 });
  } else {
    await page.waitForTimeout(200);
  }
  await page.mouse.up();
  await page.keyboard.press("Escape");

  await page.evaluate(() => (window.__desk.items.projects = []));
  await page.keyboard.press("ArrowDown");
  const nudged = await transformOf(page, "projects");

  await page.getByRole("button", { name: "Tidy up", exact: true }).click();
  const tidied = await stored(page);
  const tidyNow = await Promise.all(DESK_ITEMS.map((e) => transformOf(page, e.id)));

  if (driveNotebook) {
    await settled(page, tidied);
    // Pause only after the bodies settle. runFor below delivers all notebook RAF/timer callbacks instead of
    // racing a host's frame budget against the application's deliberate 900ms navigation fallback.
    await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 1000);
  }
  await page.evaluate(() => (window.__desk.leaves = {}));
  const clicked = Date.now();
  await link(page, "notes").click();
  if (driveNotebook) await page.clock.runFor(900);
  await page.waitForURL(`${BASE}/notes`, { timeout: 10_000 });
  const tookMs = Date.now() - clicked;
  return { menuAnim, fresh, dx, dy, held, dropped, afterDrop, nudged, tidied, tidyNow, tookMs, probe: await probe(page) };
}

test("under reduced motion the desk snaps: no spring, no lean, no transition or animation on it or in it, and the notebook opens at once", { timeout: TIMEOUT }, async () => {
  const page = await open({ reduced: true });
  const w = await walk(page);
  const rot = (id: string) => at(w.fresh, id).rot;

  assert.equal(w.held, itemTransform(w.dx, w.dy, rot("music")), "a held item sits under the pointer, upright on its own angle");
  assert.equal(w.dropped, itemTransform(0, 0, rot("music")), "a drop lands on the spot at once");
  assert.ok(w.afterDrop.every((t) => t === w.dropped), `nothing moves after the drop (${w.afterDrop.join(" | ")})`);
  assert.equal(w.nudged, itemTransform(0, 0, rot("projects")), "a nudge lands at once");
  assert.deepEqual(w.tidyNow, DESK_ITEMS.map(() => itemTransform(0, 0, 0)), "Tidy up lands everything at once");
  sameLayout(w.tidied, tidy(w.tidied));

  // The notebook: every leaf goes straight over, in one write, and the page changes without waiting for it.
  const leaves = Object.values(w.probe.leaves);
  assert.ok(leaves.length > 0, "the leaves were turned");
  for (const values of leaves) assert.deepEqual(values, ["perspective(1200px) rotateY(-180deg)"]);
  assert.ok(w.tookMs < 900, `the page changed in ${w.tookMs} ms, before the slow path's 900`);

  assert.deepEqual(w.probe.transitions, [], "no transition runs on the desk or anything in it, the Tidy up chip included");
  assert.equal(w.menuAnim, "none 0", "the menu has no fade-in");
  assert.deepEqual(w.probe.animations, [], "no animation starts on the desk or anything in it, the menu included");
  assert.deepEqual(errors, []);
});

test("with motion the same walk springs, leans, fades the menu in and turns the leaves (reduced motion's negative control)", { timeout: TIMEOUT }, async () => {
  const page = await open({ frameClock: true });
  const w = await walk(page, { driveNotebook: true });
  assert.ok(w.afterDrop.length >= 3, `a drop settles over frames (${w.afterDrop.length} transforms)`);
  assert.ok(w.tidyNow.some((t) => t !== itemTransform(0, 0, 0)), `Tidy up springs, it does not jump (${w.tidyNow.join(" | ")})`);
  const turning = Object.values(w.probe.leaves).flat();
  console.log(`# notebook controlled clock: ${turning.length} observed poses`);
  assert.ok(turning.length > 6, `the leaves turn through many poses (${turning.length}, controlled clock)\n${turning.slice(-40).join("\n")}`);
  assert.equal(w.menuAnim, "desk-menu-in 1", "the menu has its fade-in");
  assert.ok(w.probe.animations.some((a) => a.endsWith("desk-menu-in")), `the menu fades in (${w.probe.animations.join(", ")})`);
  assert.ok(w.probe.transitions.length > 0, "the chip's hover transitions");
  assert.deepEqual(errors, []);
});

// Where every item and pin is drawn, and whether the desk is stacked.
const layoutOf = (page: Page) =>
  page.evaluate(() => {
    // Boxes from the desk's own corner (the page above it may settle a pixel or two), and its place on screen.
    const desk = document.querySelector(".desk")!.getBoundingClientRect();
    const rect = (el: Element) => {
      const r = el.getBoundingClientRect();
      return { x: Math.round(r.x - desk.x), y: Math.round(r.y - desk.y), w: Math.round(r.width), h: Math.round(r.height) };
    };
    const items = [...document.querySelectorAll<HTMLElement>("[data-desk-item]")];
    const pins = [...document.querySelectorAll<HTMLElement>("[data-pin]")];
    return {
      ids: items.map((el) => el.getAttribute("data-desk-item")),
      items: items.map(rect),
      pins: pins.map(rect),
      positions: [...items, ...pins].map((el) => getComputedStyle(el).position),
      transforms: [...items, ...pins].map((el) => getComputedStyle(el).transform),
      string: getComputedStyle(document.querySelector(".desk-string")!).display,
      bar: getComputedStyle(document.querySelector(".desk-bar")!).display,
      overflow: document.documentElement.scrollWidth - innerWidth,
      width: innerWidth,
      left: desk.x,
    };
  });

function assertStacked(l: Awaited<ReturnType<typeof layoutOf>>, where: string) {
  assert.deepEqual(l.ids, DESK_ITEMS.map((e) => e.id), `${where}: every item, in the registry's order`);
  assert.equal(l.pins.length, PINS.length, `${where}: every pinned project`);
  assert.ok(l.positions.every((p) => p === "relative"), `${where}: nothing sits on a spot (${l.positions})`);
  assert.ok(l.transforms.every((t) => t === "none"), `${where}: nothing tilts or moves (${l.transforms})`);
  assert.equal(l.string, "none", `${where}: no string`);
  assert.equal(l.bar, "none", `${where}: nothing to tidy`);
  assert.ok(l.overflow <= 0, `${where}: the page does not scroll sideways (${l.overflow}px over)`);
  for (const [i, r] of [...l.items, ...l.pins].entries()) {
    assert.ok(r.x + l.left >= 0 && r.x + l.left + r.w <= l.width && r.w > 0 && r.h > 0, `${where}: box ${i} is on screen (${JSON.stringify(r)})`);
  }
  // A list: read in order, each row below or level with the one before; the items come before the pins.
  for (let i = 1; i < l.items.length; i++) assert.ok(l.items[i].y >= l.items[i - 1].y, `${where}: item ${i} is not above item ${i - 1}`);
  assert.ok(Math.min(...l.pins.map((r) => r.y)) > Math.max(...l.items.map((r) => r.y)), `${where}: the pins follow the items`);
}

test("on a phone the server's HTML is already the stacked desk, hydration keeps it, and a finger neither drags nor holds", { timeout: TIMEOUT }, async () => {
  // No script at all: what the server sent, laid out by desk.css alone.
  const ssr = await open({ viewport: PHONE, touch: true, js: false });
  assert.equal(await ssr.evaluate((q) => matchMedia(q).matches, STACKED), true);
  const served = await layoutOf(ssr);
  assertStacked(served, "server HTML");

  const page = await open({ viewport: PHONE, touch: true });
  const live = await layoutOf(page);
  assertStacked(live, "hydrated");
  assert.deepEqual(live.items, served.items, "hydration moves nothing");
  assert.deepEqual(live.pins, served.pins);

  // A swipe on the tape, a hold, and the desk's keys: nothing moves, nothing is stored, no menu opens.
  await swipe(page, "music", 120, 0, { drags: false });
  await swipe(page, "projects", 0, 0, { holdMs: LONG_PRESS_MS + 300, drags: false });
  await link(page, "sketches").focus();
  for (const key of ["ArrowRight", "r", "[", "Shift+F10"]) await page.keyboard.press(key);
  assert.equal(await page.locator(".desk-menu").count(), 0, "no radial menu on the stacked desk");
  assert.equal(await raw(page), null, "nothing was stored");
  assert.equal(await page.locator("[data-dragging]").count(), 0);
  assert.deepEqual((await layoutOf(page)).items, served.items, "every item is where it was");
  assert.equal(new URL(page.url()).pathname, "/desk");

  // A tap is a link.
  await link(page, "music").tap();
  await page.waitForURL(`${BASE}/music`, { timeout: 10_000 });
  assert.deepEqual(errors, [], "no hydration mismatch or other error");
});

test("a narrow window and a wide touch tablet get the stacked desk too; the same touch swipe drags on a wide mouse desk", { timeout: TIMEOUT }, async () => {
  const narrow = await open({ viewport: NARROW });
  assert.equal(await narrow.evaluate(() => matchMedia("(pointer: fine)").matches), true, "a mouse");
  assertStacked(await layoutOf(narrow), "narrow window");
  await forget(narrow);
  await grab(narrow, `[data-desk-item="music"] .desk-link`, 100, 0);
  await narrow.mouse.up();
  assert.equal(await raw(narrow), null, `a mouse drag on the stacked desk moves nothing\n${await gestureTrace(narrow)}`);

  const tablet = await open({ viewport: TABLET, touch: true });
  assert.equal(await tablet.evaluate(() => matchMedia("(pointer: coarse)").matches), true, "a touch-first screen");
  assertStacked(await layoutOf(tablet), "touch tablet");
  await swipe(tablet, "music", 120, 0, { drags: false });
  assert.equal(await raw(tablet), null, `a swipe on the touch tablet moves nothing\n${await gestureTrace(tablet)}`);

  // The control: the very same swipe on the wide desk drags the item by its tape.
  const wide = await open();
  assert.equal(await wide.evaluate((q) => matchMedia(q).matches, STACKED), false);
  assert.notEqual((await layoutOf(wide)).string, "none", "the wide desk has its string");
  await swipe(wide, "music", 120, 0, { drags: true });
  const moved = await stored(wide);
  const size = await deskSize(wide);
  near(at(moved, "music").x, dropAt(at(defaultLayout(), "music"), 120, 0, size).x, `the swipe dragged music\n${await gestureTrace(wide)}`);
  assert.deepEqual(errors, []);
});
