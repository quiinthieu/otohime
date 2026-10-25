// Drives headless Chromium over the home page's switchboard plug. Run by scripts/probe-switchboard-drag.sh, which
// installs Playwright into PW_PREFIX and passes BASE_URL (and EXPECT_SHA, checked if set).
//
// Positions are read in figure units (the svg's 400x320 viewBox) from the svg's own box, not from getScreenCTM,
// so the negative control can knock that out without blinding the probe. The plug is the handle's cx/cy; a jack is
// the centre of its [data-jack] hole. Mouse lines use page.mouse; every touch line sends real touch through a CDP
// session (Input.dispatchTouchEvent), since mouse events at a phone viewport pass even when the pan is not stopped.
// A spring is traced in the page on every animation frame from just before the release, so "six frames" is
// measured as distinct in-between positions and time to home, not read off the reducer.
import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(path.join(process.env.PW_PREFIX, "package.json"));
const { chromium } = require("playwright");

const BASE_URL = process.env.BASE_URL;
const EXPECT_SHA = process.env.EXPECT_SHA ?? "";
const SHOTS = process.env.SHOTS ?? "";
const PHONE = { width: 390, height: 844 };
const DESKTOP = { width: 1366, height: 768 };
const SECTION = 'section[aria-label="Switchboard"]';
const VIEW = [400, 320];
const SNAP = 14;
const EMPTY = [60, 60]; // figure units well away from every jack
const IDLE = "Pick a line and the operator connects you.";
const HELD = "Plug in hand. Let go over a jack to connect.";
const OUTSIDE = new Set(["t.me", "x.com", "open.spotify.com"]);

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
  // Nothing here may leave the site: outside requests are refused and counted, new pages and main-frame
  // navigations are counted too.
  const away = { requests: [], pages: 0, navigations: [] };
  await context.route("**/*", (route) => {
    const host = new URL(route.request().url()).hostname;
    if (OUTSIDE.has(host)) {
      away.requests.push(route.request().url());
      return route.abort();
    }
    return route.continue();
  });
  context.on("page", () => away.pages++);
  const page = await context.newPage();
  away.pages = 0;
  page.on("framenavigated", (frame) => {
    if (frame === page.mainFrame()) away.navigations.push(frame.url());
  });
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    const from = m.location().url;
    sink.push(`console ${page.url()}: ${m.text()}${from && from !== page.url() ? ` (${from})` : ""}`);
  });
  page.on("pageerror", (e) => sink.push(`pageerror ${page.url()}: ${e.message}`));
  if (init) await page.addInitScript(init);
  const cdp = phone ? await context.newCDPSession(page) : null;
  return { context, page, cdp, away };
}

// Load /, wait for React to hydrate the handle, bring the switchboard into view and let the print-in land.
async function load(page) {
  await page.goto(`${BASE_URL}/`, { waitUntil: "load" });
  await page.waitForFunction(
    (sel) => {
      const el = document.querySelector(`${sel} .plug-handle`);
      return el && Object.keys(el).some((k) => k.startsWith("__reactProps"));
    },
    SECTION,
    { timeout: 15000 },
  );
  await page.locator(SECTION).evaluate((el) => el.scrollIntoView({ block: "center", behavior: "instant" }));
  await sleep(700);
}

// The board as drawn: plug and jacks in figure and screen units, readout, stats, chips and the Open link.
const board = (page) =>
  page.evaluate(
    ({ sel, view }) => {
      const section = document.querySelector(sel);
      const svg = section.querySelector("svg.figure");
      const r = svg.getBoundingClientRect();
      const [kx, ky] = [r.width / view[0], r.height / view[1]];
      const handle = section.querySelector(".plug-handle");
      const plug = [Number(handle.getAttribute("cx")), Number(handle.getAttribute("cy"))];
      const jacks = [...section.querySelectorAll("[data-jack]")].map((el) => {
        const b = el.getBoundingClientRect();
        return [(b.left + b.width / 2 - r.left) / kx, (b.top + b.height / 2 - r.top) / ky];
      });
      const open = section.querySelector("a.btn-primary");
      const stats = [...section.querySelectorAll(".machine-stats .stat")].map((s) => s.querySelector("dd").textContent);
      return {
        rect: { left: r.left, top: r.top, kx, ky },
        plug,
        held: handle.hasAttribute("data-held"),
        jacks,
        readout: section.querySelector(".readout").textContent,
        line: stats[0],
        picked: stats[1],
        pressed: [...section.querySelectorAll(".machine-controls .chip")].filter((c) => c.getAttribute("aria-pressed") === "true").map((c) => c.textContent),
        open: open ? { text: open.textContent, href: open.getAttribute("href"), target: open.getAttribute("target") } : null,
        scrollY,
      };
    },
    { sel: SECTION, view: VIEW },
  );

const toScreen = (b, [x, y]) => [b.rect.left + x * b.rect.kx, b.rect.top + y * b.rect.ky];
const near = (a, b, tol = 0.6) => Math.hypot(a[0] - b[0], a[1] - b[1]) <= tol;
const fmt = (p) => `(${p[0].toFixed(1)}, ${p[1].toFixed(1)})`;

// Trace the plug on every animation frame for `ms`, from now.
const trace = (page, ms = 1500) =>
  page.evaluate(
    ({ sel, ms }) => {
      const handle = document.querySelector(`${sel} .plug-handle`);
      const t0 = performance.now();
      window.__plug = [];
      const frame = () => {
        const h = document.querySelector(`${sel} .plug-handle`) ?? handle;
        window.__plug.push([performance.now() - t0, Number(h.getAttribute("cx")), Number(h.getAttribute("cy"))]);
        if (performance.now() - t0 < ms) requestAnimationFrame(frame);
      };
      frame();
    },
    { sel: SECTION, ms },
  );

// The way home after a release: positions it passed through and when it reached home.
async function traced(page, home, from, ms = 1500) {
  await sleep(ms + 100);
  const samples = await page.evaluate(() => window.__plug);
  const positions = [];
  for (const [, x, y] of samples) {
    const last = positions.at(-1);
    if (!last || !near(last, [x, y], 0.05)) positions.push([x, y]);
  }
  const arrived = samples.find(([, x, y], i) => near([x, y], home) && samples.slice(i).every(([, a, b]) => near([a, b], home)));
  const between = positions.filter((p) => !near(p, home) && !near(p, from, 1.5));
  return { positions, between, ms: arrived ? arrived[0] : null, end: positions.at(-1) };
}

// A mouse drag from the plug to a point in figure units. `during` reads the board while still held.
async function mouseDrag(page, to, { trace: tracing = false } = {}) {
  const b = await board(page);
  await page.mouse.move(...toScreen(b, b.plug));
  await page.mouse.down();
  await page.mouse.move(...toScreen(b, to), { steps: 10 });
  await sleep(60);
  const during = await board(page);
  if (tracing) await trace(page);
  await page.mouse.up();
  await sleep(tracing ? 0 : 120);
  return { before: b, during };
}

const touch = (cdp, type, points) =>
  cdp.send("Input.dispatchTouchEvent", { type, touchPoints: points.map(([x, y], id) => ({ x, y, id })) });

// A finger from one screen point to another; it ends with a lift ("touchEnd") or a cancel ("touchCancel").
async function finger(cdp, from, to, { end = "touchEnd", steps = 10, before = null } = {}) {
  await touch(cdp, "touchStart", [from]);
  await sleep(30);
  for (let i = 1; i <= steps; i++) {
    await touch(cdp, "touchMove", [[from[0] + ((to[0] - from[0]) * i) / steps, from[1] + ((to[1] - from[1]) * i) / steps]]);
    await sleep(16);
  }
  await sleep(60);
  const during = before ? await before() : null;
  await touch(cdp, end, []);
  return during;
}

const pickedUp = (page, text) =>
  page
    .waitForFunction(
      ({ sel, text }) => document.querySelector(`${sel} .readout`)?.textContent === text,
      { sel: SECTION, text },
      { timeout: 3000 },
    )
    .then(() => true)
    .catch(() => false);

const sideways = (page) => page.evaluate(() => document.documentElement.scrollWidth - innerWidth);

async function shot(page, name) {
  if (!SHOTS) return;
  mkdirSync(SHOTS, { recursive: true });
  await page.locator(SECTION).screenshot({ path: path.join(SHOTS, `${name}.png`) });
}

const TELEGRAM = { readout: "@otohime73 picked up on Telegram.", href: "https://t.me/otohime73" };

function stayed(label, page, away) {
  check(
    `${label}: nothing navigated away or opened a page`,
    away.requests.length === 0 && away.pages === 0 && away.navigations.every((u) => u.startsWith(`${BASE_URL}/`)) && page.url() === `${BASE_URL}/`,
    JSON.stringify({ requests: away.requests, pages: away.pages, navigations: away.navigations, url: page.url() }),
  );
}

async function desktop(browser, scheme) {
  const label = `1366x768 ${scheme}`;
  const { context, page, away } = await open(browser, { viewport: DESKTOP, scheme });
  try {
    await load(page);
    const rest = await board(page);
    check(`${label}: the plug rests on the desk with no line picked`, rest.readout === IDLE && rest.line === "—" && !rest.held && rest.jacks.length === 4, JSON.stringify(rest));

    // A miss: dragged into empty paper, held, then let go; it springs home in a handful of frames.
    const miss = await mouseDrag(page, EMPTY, { trace: true });
    check(
      `${label}: in hand the plug follows the mouse and the readout says so`,
      miss.during.held && near(miss.during.plug, EMPTY, 2) && miss.during.readout === HELD,
      `${fmt(miss.during.plug)} held ${miss.during.held} "${miss.during.readout}"`,
    );
    const spring = await traced(page, rest.plug, miss.during.plug);
    check(
      `${label}: a miss springs the plug home in about six frames (3 to 7 in-between positions, home within 1 s)`,
      spring.ms !== null && spring.ms <= 1000 && spring.between.length >= 3 && spring.between.length <= 7,
      `between ${spring.between.length} [${spring.between.map(fmt).join(" ")}], home after ${spring.ms} ms`,
    );
    const missed = await board(page);
    check(`${label}: after the miss no line is picked and the plug is home`, missed.line === "—" && missed.readout === IDLE && near(missed.plug, rest.plug) && !missed.open, JSON.stringify(missed));

    // The snap radius: twenty units below the Telegram jack misses, ten units below connects.
    const tg = rest.jacks[0];
    await mouseDrag(page, [tg[0], tg[1] + SNAP + 6]);
    await sleep(900);
    const outside = await board(page);
    check(`${label}: a drop ${SNAP + 6} units from the Telegram jack misses`, outside.line === "—" && near(outside.plug, rest.plug), JSON.stringify(outside));
    await mouseDrag(page, [tg[0], tg[1] + SNAP - 4]);
    const inside = await board(page);
    check(
      `${label}: a drop ${SNAP - 4} units from the Telegram jack connects Telegram, plug in the jack`,
      inside.line === "1" && inside.pressed.join() === "Telegram" && near(inside.plug, tg, 1.5),
      JSON.stringify(inside),
    );
    const up = await pickedUp(page, TELEGRAM.readout);
    const tgBoard = await board(page);
    check(
      `${label}: Telegram rings, picks up and offers Open Telegram to t.me`,
      up && tgBoard.picked === "@otohime73" && tgBoard.open?.href === TELEGRAM.href && tgBoard.open.text.startsWith("Open Telegram"),
      JSON.stringify(tgBoard),
    );
    await shot(page, `${scheme}-desktop-telegram`);

    // Pulled out of the jack and dropped on paper, it springs back into the jack and the call stands.
    const out = await mouseDrag(page, [300, 280], { trace: true });
    const back = await traced(page, tg, out.during.plug);
    const kept = await board(page);
    check(
      `${label}: a plug pulled out and dropped on paper springs back into Telegram's jack, call kept`,
      back.ms !== null && back.ms <= 1000 && kept.line === "1" && kept.readout === TELEGRAM.readout && kept.open?.href === TELEGRAM.href,
      `home after ${back.ms} ms; ${JSON.stringify(kept)}`,
    );

    // The X jack by drag: the existing flow switches the line.
    await mouseDrag(page, kept.jacks[1]);
    const x = await pickedUp(page, "@otohime73 picked up on X.");
    const xBoard = await board(page);
    check(`${label}: dragging on to X's jack moves the call to X`, x && xBoard.line === "2" && xBoard.open?.href === "https://x.com/otohime73", JSON.stringify(xBoard));

    // Keyboard: the Email chip by Enter, focus stays on it, then Tab reaches Open Email and the plain links.
    const chip = page.locator(SECTION).getByRole("button", { name: "Email" });
    await chip.focus();
    await page.keyboard.press("Enter");
    const email = await pickedUp(page, "hello@otohime.dev picked up on Email.");
    const focused = await page.evaluate(() => ({ text: document.activeElement?.textContent, visible: document.activeElement?.matches(":focus-visible") }));
    const emailBoard = await board(page);
    check(
      `${label}: Enter on the Email chip connects Email with focus kept on the chip`,
      email && focused.text === "Email" && emailBoard.pressed.join() === "Email" && emailBoard.open?.href === "mailto:hello@otohime.dev",
      `${JSON.stringify(focused)} ${JSON.stringify(emailBoard)}`,
    );
    await page.locator(SECTION).getByRole("button", { name: "Telegram" }).focus();
    await page.keyboard.press(" ");
    const spaced = await pickedUp(page, TELEGRAM.readout);
    check(`${label}: Space on the Telegram chip connects Telegram`, spaced, (await board(page)).readout);

    let link = null;
    const links = [];
    for (let i = 0; i < 20; i++) {
      await page.keyboard.press("Tab");
      const f = await page.evaluate((sel) => {
        const el = document.activeElement;
        if (!el?.closest(sel) || el.tagName !== "A") return null;
        const r = el.getBoundingClientRect();
        return { text: el.textContent, href: el.getAttribute("href"), width: r.width, height: r.height, visible: el.matches(":focus-visible") };
      }, SECTION);
      if (f) links.push(f);
      if (f?.text.startsWith("Open Telegram")) link = f;
      if (links.length >= 5) break;
    }
    check(`${label}: Tab reaches Open Telegram, visibly focused`, link !== null && link.visible && link.width > 0, JSON.stringify(link));
    const plain = links.filter((l) => !l.text.startsWith("Open"));
    check(
      `${label}: Tab then reaches the plain contact links, shown when focused`,
      plain.length >= 1 && plain.every((l) => l.visible && l.width > 0 && l.height > 0) && plain[0].href === TELEGRAM.href,
      JSON.stringify(links),
    );
    await page.evaluate(() => document.activeElement?.blur());

    const wide = await sideways(page);
    check(`${label}: nothing scrolls sideways`, wide <= 0, `${wide} px over`);
    stayed(label, page, away);
  } finally {
    await context.close();
  }
}

async function phone(browser, scheme) {
  const label = `390x844 touch ${scheme}`;
  const { context, page, cdp, away } = await open(browser, { viewport: PHONE, scheme });
  try {
    await load(page);
    const rest = await board(page);
    const tg = rest.jacks[0];

    // A finger carries the plug to Telegram's jack; the page does not pan.
    await finger(cdp, toScreen(rest, rest.plug), toScreen(rest, tg));
    const up = await pickedUp(page, TELEGRAM.readout);
    const b = await board(page);
    check(
      `${label}: a finger drag from the plug to Telegram's jack connects Telegram`,
      up && b.line === "1" && b.open?.href === TELEGRAM.href && near(b.plug, tg, 1.5),
      JSON.stringify(b),
    );
    check(`${label}: the drag does not scroll the page`, Math.abs(b.scrollY - rest.scrollY) < 1, `${rest.scrollY} -> ${b.scrollY}`);

    // A cancelled touch (pointercancel) springs the plug back into Telegram's jack and the call stands.
    const during = await finger(cdp, toScreen(b, b.plug), toScreen(b, EMPTY), {
      end: "touchCancel",
      before: async () => {
        const held = await board(page);
        await trace(page);
        return held;
      },
    });
    const spring = await traced(page, tg, during.plug);
    const kept = await board(page);
    check(`${label}: in hand under the finger the plug follows it`, during.held && near(during.plug, EMPTY, 3), fmt(during.plug));
    check(
      `${label}: pointercancel springs the plug back to its jack in about six frames, call kept`,
      spring.ms !== null && spring.ms <= 1000 && spring.between.length >= 3 && spring.between.length <= 7 && kept.line === "1" && kept.readout === TELEGRAM.readout,
      `between ${spring.between.length}, home after ${spring.ms} ms; ${JSON.stringify(kept)}`,
    );

    // A finger lifted on paper misses the same way.
    await finger(cdp, toScreen(kept, kept.plug), toScreen(kept, [330, 40]));
    await sleep(900);
    const missed = await board(page);
    check(`${label}: a finger lifted on paper misses and the plug is back in its jack`, missed.line === "1" && near(missed.plug, tg), JSON.stringify(missed));

    // Elsewhere on the figure a finger still scrolls the page.
    const desk = toScreen(missed, [330, 250]);
    const y0 = await page.evaluate(() => scrollY);
    await finger(cdp, desk, [desk[0], desk[1] - 220], { steps: 12 });
    await sleep(400);
    const y1 = await page.evaluate(() => scrollY);
    const still = await board(page);
    check(`${label}: a finger on the desk away from the plug scrolls the page`, y1 - y0 > 40 && still.line === "1" && near(still.plug, tg), `${y0} -> ${y1}`);

    await page.locator(SECTION).evaluate((el) => el.scrollIntoView({ block: "center", behavior: "instant" }));
    await page.locator(SECTION).getByRole("button", { name: "Spotify" }).tap();
    const sp = await pickedUp(page, "otohime picked up on Spotify.");
    const spBoard = await board(page);
    check(`${label}: tapping the Spotify chip still connects Spotify`, sp && spBoard.open?.href.startsWith("https://open.spotify.com/"), JSON.stringify(spBoard));
    await shot(page, `${scheme}-phone-spotify`);

    const wide = await sideways(page);
    check(`${label}: nothing scrolls sideways`, wide <= 0, `${wide} px over`);
    stayed(label, page, away);
  } finally {
    await context.close();
  }
}

// Home on the very next frame: the release position, then home, with nothing between.
async function immediateMiss(page, home) {
  const miss = await mouseDrag(page, EMPTY, { trace: true });
  const spring = await traced(page, home, miss.during.plug, 600);
  return { spring, pass: spring.ms !== null && spring.ms <= 200 && spring.between.length === 0 };
}

async function reduced(browser) {
  const label = "1366x768 reduced motion";
  {
    const { context, page, away } = await open(browser, { viewport: DESKTOP, reduced: true });
    try {
      await load(page);
      const rest = await board(page);
      const { spring, pass } = await immediateMiss(page, rest.plug);
      check(`${label}: a miss is home at once, no spring`, pass, `between ${spring.between.length}, home after ${spring.ms} ms`);
      await mouseDrag(page, rest.jacks[0]);
      const b = await board(page);
      check(`${label}: a drop on Telegram's jack picks up at once`, b.readout === TELEGRAM.readout && b.open?.href === TELEGRAM.href, JSON.stringify(b));
      stayed(label, page, away);
    } finally {
      await context.close();
    }
  }
  {
    const live = "1366x768 reduced motion switched on live";
    const { context, page } = await open(browser, { viewport: DESKTOP });
    try {
      await load(page);
      const rest = await board(page);
      await page.emulateMedia({ reducedMotion: "reduce" });
      const { spring, pass } = await immediateMiss(page, rest.plug);
      check(`${live}: the next miss is home at once`, pass, `between ${spring.between.length}, home after ${spring.ms} ms`);
      await page.emulateMedia({ reducedMotion: "no-preference" });
      const again = await mouseDrag(page, EMPTY, { trace: true });
      const sprung = await traced(page, rest.plug, again.during.plug);
      check(`${live}: switched off again, a miss springs`, sprung.between.length >= 3, `between ${sprung.between.length}`);
    } finally {
      await context.close();
    }
  }
}

// The same checks against a broken page must fail; their errors go to a separate sink.
async function negatives(browser) {
  const sink = [];
  {
    const { context, page } = await open(browser, {
      viewport: DESKTOP,
      sink,
      init: () => {
        SVGGraphicsElement.prototype.getScreenCTM = () => null;
      },
    });
    try {
      await load(page);
      const rest = await board(page);
      await mouseDrag(page, rest.jacks[0]);
      const up = await pickedUp(page, TELEGRAM.readout);
      check("negative control: with getScreenCTM knocked out, the drag-to-Telegram check catches it", !up);
    } finally {
      await context.close();
    }
  }
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
      const rest = await board(page);
      const { pass } = await immediateMiss(page, rest.plug);
      check("negative control: with the reduced-motion read bypassed, the at-once check catches the spring", !pass);
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
