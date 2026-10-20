// Drives headless Chromium over Planisphere's wheel with a finger. Run by scripts/probe-planisphere-touch.sh,
// which installs Playwright and axe-core into PW_PREFIX and passes BASE_URL.
//
// Every "touch" line sends real touch through a CDP session (Input.dispatchTouchEvent). Mouse events at a phone
// viewport pass even when touch-action is wrong, so they are used only for the 1366x768 mouse line.
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(path.join(process.env.PW_PREFIX, "package.json"));
const { chromium } = require("playwright");
const AXE_PATH = require.resolve("axe-core/axe.min.js");

const BASE_URL = process.env.BASE_URL;
const TOKYO = `${BASE_URL}/planisphere?city=tokyo&date=2026-10-20&hour=21`;
const SYDNEY = `${BASE_URL}/planisphere?city=sydney&date=2026-10-20&hour=21`;
const PHONE = { width: 390, height: 844 };
const DESKTOP = { width: 1366, height: 768 };

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

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const errors = [];

async function open(browser, { viewport, touch = false, js = true, url }) {
  const context = await browser.newContext({ viewport, isMobile: touch, hasTouch: touch, javaScriptEnabled: js });
  const page = await context.newPage();
  page.on("console", (m) => m.type() === "error" && errors.push(`console: ${m.text()}`));
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  await page.addInitScript(() => {
    window.__cancels = 0;
    window.addEventListener("pointercancel", () => void window.__cancels++, true);
  });
  const cdp = await context.newCDPSession(page);
  await page.goto(url, { waitUntil: "load" });
  if (js) await page.waitForSelector("[data-actions] button", { timeout: 15000 });
  return { context, page, cdp };
}

/** The wheel's centre and the finger radius: 0.3 x the .frame-face width. */
async function wheelGeometry(page) {
  const box = await page.locator(".frame-face").boundingBox();
  return { cx: box.x + box.width / 2, cy: box.y + box.height / 2, r: 0.3 * box.width };
}

/**
 * The first start angle (degrees, screen, y down) from the list whose point on the finger circle lands on the
 * disc. The disc is clipped to the oval window, so on a southern city the point below the centre can fall on the
 * frame; the finger then starts as near the preferred angle as the window allows.
 */
async function grabAngle(page, g, angles) {
  for (const a of angles) {
    const x = g.cx + g.r * Math.cos((a * Math.PI) / 180);
    const y = g.cy + g.r * Math.sin((a * Math.PI) / 180);
    const hit = await page.evaluate(([x, y]) => !!document.elementFromPoint(x, y)?.closest("[data-disc]"), [x, y]);
    if (hit) return a;
  }
  return null;
}
// Offsets from a preferred angle, nearest first.
const near = (a0) => [0, 10, -10, 20, -20, 30, -30, 45, -45, 60, -60, 90, -90, 120, -120, 150, -150, 180].map((d) => a0 + d);

const touch = (cdp, type, points) =>
  cdp.send("Input.dispatchTouchEvent", { type, touchPoints: points.map(([x, y], id) => ({ x, y, id })) });

/** A finger from (x0, y0) along the given points, then up. */
async function finger(cdp, path) {
  const [first, ...rest] = path;
  await touch(cdp, "touchStart", [first]);
  await sleep(30);
  for (const p of rest) {
    await touch(cdp, "touchMove", [p]);
    await sleep(16);
  }
  await touch(cdp, "touchEnd", []);
  await sleep(250);
}

/** Points on a circle of radius r around (cx, cy), from a0 degrees through a sweep (screen angles, y down). */
function arc({ cx, cy, r }, a0, sweep, stepDeg = 4) {
  const n = Math.max(2, Math.round(Math.abs(sweep) / stepDeg));
  return Array.from({ length: n + 1 }, (_, i) => {
    const a = ((a0 + (sweep * i) / n) * Math.PI) / 180;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  });
}

const when = (page) =>
  page.evaluate(() => ({
    date: document.querySelector('input[name="date"]').value,
    hour: Number(document.querySelector('input[name="hour"]').value),
  }));
const hoursBetween = (a, b) => (Date.parse(b.date) - Date.parse(a.date)) / 3_600_000 + (b.hour - a.hour);
const show = (w) => `${w.date} ${w.hour}`;
const scrollY = (page) => page.evaluate(() => Math.round(window.scrollY));
const cancels = (page) => page.evaluate(() => window.__cancels);

async function scrollTo(page, y) {
  await page.evaluate((y) => window.scrollTo(0, y), y);
  await sleep(100);
}

// A quarter turn each way on one city, from a fresh page each time.
async function quarterTurns(browser, label, url, expected) {
  const got = [];
  for (const sweep of [90, -90]) {
    const { context, page, cdp } = await open(browser, { viewport: PHONE, touch: true, url });
    try {
      await scrollTo(page, 120);
      const start = await when(page);
      const y0 = await scrollY(page);
      const g = await wheelGeometry(page);
      const a0 = await grabAngle(page, g, near(90));
      check(`${label}: a point on the finger circle, near below the centre, is on the disc`, a0 !== null);
      if (a0 === null) continue;
      await finger(cdp, arc(g, a0, sweep));
      const end = await when(page);
      const moved = hoursBetween(start, end);
      const name = `${label}: ${sweep > 0 ? "clockwise" : "anticlockwise"} finger quarter turn`;
      got.push(end);
      check(`${name} moves the hour by 6 h`, Math.abs(moved) === 6, `${show(start)} -> ${show(end)}`);
      check(`${name} fires no pointercancel`, (await cancels(page)) === 0, `${await cancels(page)} pointercancel`);
      check(`${name} leaves the page scrolled at ${y0}`, (await scrollY(page)) === y0, `scrollY ${await scrollY(page)}`);
    } finally {
      await context.close();
    }
  }
  if (expected) {
    const seen = got.map(show).sort().join(" | ");
    const want = expected.slice().sort().join(" | ");
    check(`${label}: the two turns land on ${expected.join(" and ")}`, seen === want, seen);
  }
}

async function runAxe(page, label) {
  await page.addScriptTag({ path: AXE_PATH });
  const violations = await page.evaluate(async () => {
    const result = await window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] } });
    return result.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length }));
  });
  const nested = violations.filter((v) => v.id === "nested-interactive");
  const bad = violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  check(`axe ${label}: no nested-interactive`, nested.length === 0, JSON.stringify(nested));
  check(`axe ${label}: no serious or critical violation`, bad.length === 0, JSON.stringify(bad));
}

const browser = await chromium.launch();
try {
  // Phone, JavaScript on.
  {
    const { context, page, cdp } = await open(browser, { viewport: PHONE, touch: true, url: TOKYO });
    try {
      const turnable = await page.evaluate(() => document.querySelector("svg.wheel")?.hasAttribute("data-turnable"));
      check("390x844 JS on: the svg is data-turnable once hydrated", turnable === true);
      const computed = await page.evaluate(() => getComputedStyle(document.querySelector("svg.wheel")).touchAction);
      check("390x844 JS on: the svg box has touch-action none", computed === "none", computed);

      // 60 degrees, starting with the finger moving upward (right of the centre, anticlockwise on screen).
      await scrollTo(page, 120);
      const start = await when(page);
      const y0 = await scrollY(page);
      const g = await wheelGeometry(page);
      // Anticlockwise from the right half, or clockwise from the left half: the finger's first move is upward.
      const right = await grabAngle(page, g, near(0).filter((a) => Math.abs(a) <= 80));
      const left = right === null ? await grabAngle(page, g, near(180).filter((a) => Math.abs(a - 180) <= 80)) : null;
      check("390x844 touch: a point where the finger starts moving upward is on the disc", right !== null || left !== null);
      await finger(cdp, right !== null ? arc(g, right, -60) : arc(g, left ?? 180, 60));
      const end = await when(page);
      check("390x844 touch: a 60 degree arc starting upward moves the hour by 4 h", Math.abs(hoursBetween(start, end)) === 4, `${show(start)} -> ${show(end)}`);
      check("390x844 touch: that arc does not scroll the page", (await scrollY(page)) === y0, `scrollY ${await scrollY(page)}`);
      check("390x844 touch: that arc fires no pointercancel", (await cancels(page)) === 0, `${await cancels(page)} pointercancel`);
    } finally {
      await context.close();
    }
  }

  await quarterTurns(browser, "390x844 Tokyo", TOKYO, ["2026-10-20 15", "2026-10-21 3"]);
  await quarterTurns(browser, "390x844 Sydney", SYDNEY, null);

  // A finger on the explainer scrolls the page.
  {
    const { context, page, cdp } = await open(browser, { viewport: PHONE, touch: true, url: TOKYO });
    try {
      await page.locator("[data-explainer]").scrollIntoViewIfNeeded();
      await page.evaluate(() => document.querySelector("[data-explainer]").scrollIntoView({ block: "center" }));
      await sleep(150);
      const box = await page.locator("[data-explainer]").boundingBox();
      const x = box.x + box.width / 2;
      const y = Math.min(Math.max(box.y + box.height / 2, 200), 500);
      const onIt = await page.evaluate(([x, y]) => !!document.elementFromPoint(x, y)?.closest("[data-explainer]"), [x, y]);
      const before = await scrollY(page);
      await finger(cdp, Array.from({ length: 16 }, (_, i) => [x, y + i * 16]));
      const moved = Math.abs((await scrollY(page)) - before);
      check("390x844 touch: the start point is on the explainer", onIt);
      check("390x844 touch: a finger drag on the explainer scrolls the page by at least 100 px", moved >= 100, `moved ${moved} px`);
    } finally {
      await context.close();
    }
  }

  // JavaScript off: nothing turns the disc, so the chart scrolls.
  {
    const { context, page, cdp } = await open(browser, { viewport: PHONE, touch: true, js: false, url: TOKYO });
    try {
      const turnable = await page.evaluate(() => document.querySelector("svg.wheel")?.hasAttribute("data-turnable"));
      check("390x844 JS off: the svg has no data-turnable", turnable === false, String(turnable));
      const g = await wheelGeometry(page);
      const before = await scrollY(page);
      await finger(cdp, Array.from({ length: 16 }, (_, i) => [g.cx, g.cy + g.r - i * 16]));
      const moved = Math.abs((await scrollY(page)) - before);
      check("390x844 JS off: a finger drag on the chart scrolls the page by at least 100 px", moved >= 100, `moved ${moved} px`);
    } finally {
      await context.close();
    }
  }

  // Desktop: the mouse and the keyboard are unchanged; axe.
  {
    const { context, page } = await open(browser, { viewport: DESKTOP, url: TOKYO });
    try {
      const start = await when(page);
      const g = await wheelGeometry(page);
      const pts = arc(g, 90, 90);
      await page.mouse.move(...pts[0]);
      await page.mouse.down();
      for (const p of pts.slice(1)) {
        await page.mouse.move(...p);
        await sleep(8);
      }
      await page.mouse.up();
      await sleep(250);
      const end = await when(page);
      check("1366x768 mouse: a 90 degree drag still moves the hour by 6 h", Math.abs(hoursBetween(start, end)) === 6, `${show(start)} -> ${show(end)}`);
      await runAxe(page, "1366x768");
    } finally {
      await context.close();
    }
  }
  {
    const { context, page } = await open(browser, { viewport: DESKTOP, url: TOKYO });
    try {
      await page.locator("[data-disc]").focus();
      await page.keyboard.press("ArrowRight");
      await sleep(150);
      const text = await page.locator("[data-disc]").getAttribute("aria-valuetext");
      check("1366x768 keyboard: ArrowRight on the disc gives 21:15", text === "21:15", String(text));
    } finally {
      await context.close();
    }
  }
  {
    const { context, page } = await open(browser, { viewport: PHONE, touch: true, url: TOKYO });
    try {
      await runAxe(page, "390x844");
    } finally {
      await context.close();
    }
  }

  check("no console errors or page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
} finally {
  await browser.close();
}

console.log(`probe: ${ok} ok, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
