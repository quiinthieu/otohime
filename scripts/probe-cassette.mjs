// Drives headless Chromium over Music's Now playing shelf. Run by scripts/probe-cassette.sh, which installs
// Playwright into PW_PREFIX and passes BASE_URL and FACE.
//
//   FACE=quiet  the server has no provider configured: both labels are the quiet face.
//   FACE=live   the server reads loopback fakes (probe-cassette.sh starts them) that answer the longest track and
//               game the parsers let through, with the track playing: the reels turn, unless motion is reduced.
//   SENTINELS   comma-separated secrets the server was given; no response the browser receives may contain one.
//
// Real: Chromium's layout, fonts, colours, media queries, keyboard focus and a JavaScript-off load. Fake (FACE=live
// only): the providers, which are loopback servers. Long text is the cap from lib/now-playing-data.ts. What is read
// back is what a visitor meets: the label's box and its words' boxes, computed colours, the focus ring, the reels'
// running animations and the HTML and scripts the page loaded.
//
// Negative controls, each on the same assertion it guards: labels forced to one unbroken line overflow; the label's
// text greyed out fails contrast; removing data-spin stops the reels. Each is undone and the check passes again.
import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { LIMITS } from "../lib/now-playing-data.ts";

const require = createRequire(path.join(process.env.PW_PREFIX, "package.json"));
const { chromium } = require("playwright");

const BASE_URL = process.env.BASE_URL;
const FACE = process.env.FACE === "live" ? "live" : "quiet";
const SHOTS_DIR = process.env.SHOTS_DIR || "";
const SENTINELS = (process.env.SENTINELS || "").split(",").filter(Boolean);
const PHONE = { width: 390, height: 844 };
const DESKTOP = { width: 1366, height: 768 };
// The fakes' longest answers (probe-cassette.sh): exactly at the caps, so the label is at its fullest.
const LONG_TITLE = `${"W".repeat(LIMITS.title - 1)}…`;
const LONG_GAME = `${"M".repeat(LIMITS.game - 1)}…`;

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
const bodies = [];

async function open(browser, { viewport = DESKTOP, dark = false, reduced = false, js = true } = {}) {
  const phone = viewport === PHONE;
  const context = await browser.newContext({
    viewport,
    isMobile: phone,
    hasTouch: phone,
    colorScheme: dark ? "dark" : "light",
    reducedMotion: reduced ? "reduce" : "no-preference",
    javaScriptEnabled: js,
  });
  // Nothing leaves the machine: a third-party request (YouTube's player API for the television) gets an empty 200.
  const origin = new URL(BASE_URL).origin;
  await context.route(
    (url) => url.origin !== origin,
    (route) => route.fulfill({ status: 200, contentType: "text/javascript", body: "" }),
  );
  const page = await context.newPage();
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`console ${page.url()}: ${m.text()}`);
  });
  page.on("pageerror", (e) => errors.push(`pageerror ${page.url()}: ${e.message}`));
  page.on("response", async (res) => {
    const type = res.headers()["content-type"] || "";
    if (!/html|javascript|json|text\/x-component|css/.test(type)) return;
    try {
      bodies.push({ url: res.url(), text: await res.text() });
    } catch {
      // a redirect or an aborted request has no body to scan
    }
  });
  await page.goto(`${BASE_URL}/music`, { waitUntil: "load" });
  return { context, page };
}

async function shot(page, name) {
  if (!SHOTS_DIR) return;
  mkdirSync(SHOTS_DIR, { recursive: true });
  await page.locator("[data-now-playing]").screenshot({ path: path.join(SHOTS_DIR, `${name}.png`) });
}

// Everything the checks read, in one pass in the page.
async function measure(page) {
  return page.evaluate(() => {
    const parse = (c) => {
      const m = /rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/.exec(c);
      if (m) return { rgb: [+m[1], +m[2], +m[3]], a: m[4] === undefined ? 1 : +m[4] };
      const s = /color\(srgb ([\d.]+) ([\d.]+) ([\d.]+)(?: \/ ([\d.]+))?\)/.exec(c);
      if (s) return { rgb: [s[1] * 255, s[2] * 255, s[3] * 255], a: s[4] === undefined ? 1 : +s[4] };
      return null;
    };
    const lum = ([r, g, b]) => {
      const f = (v) => ((v /= 255) <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    const ratio = (a, b) => {
      const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
      return (x + 0.05) / (y + 0.05);
    };
    const background = (el) => {
      for (let n = el; n; n = n.parentElement) {
        const c = parse(getComputedStyle(n).backgroundColor);
        if (c && c.a > 0.5) return c.rgb;
      }
      return [255, 255, 255];
    };
    const contrast = (el) => {
      const c = parse(getComputedStyle(el).color);
      return c ? ratio(c.rgb, background(el)) : 0;
    };
    const box = (el) => {
      const r = el.getBoundingClientRect();
      return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height };
    };
    const section = document.querySelector("[data-now-playing]");
    const labels = [...document.querySelectorAll(".np-label")].map((label) => {
      const outer = box(label);
      const parts = [...label.children].map((el) => ({ cls: el.className, text: el.textContent, ...box(el), contrast: contrast(el) }));
      return {
        cls: label.className,
        ...outer,
        clipped: label.scrollHeight > label.clientHeight + 1 || label.scrollWidth > label.clientWidth + 1,
        spill: parts.filter((p) => p.right > outer.right + 0.5 || p.bottom > outer.bottom + 0.5 || p.left < outer.left - 0.5).map((p) => p.cls),
        minContrast: Math.min(...parts.map((p) => p.contrast)),
        parts,
      };
    });
    const credit = document.querySelector("[data-now-playing-credit]");
    const reels = [...document.querySelectorAll(".reel")];
    return {
      present: Boolean(section),
      visible: section ? section.getBoundingClientRect().height > 0 && getComputedStyle(section).visibility !== "hidden" : false,
      face: document.querySelector(".tape")?.dataset.face,
      cart: document.querySelector(".game-cart")?.dataset.face,
      spin: document.querySelector(".tape")?.hasAttribute("data-spin"),
      text: section?.innerText ?? "",
      overflowX: document.scrollingElement.scrollWidth - document.scrollingElement.clientWidth,
      labels,
      creditContrast: credit ? Math.min(...[credit, ...credit.querySelectorAll("a, time")].map(contrast)) : 0,
      running: reels.flatMap((r) => r.getAnimations()).filter((a) => a.playState === "running").length,
      links: [...section.querySelectorAll(".np-link")].map((a) => ({ href: a.href, ...box(a) })),
    };
  });
}

const fits = (m) => m.labels.length === 2 && m.labels.every((l) => !l.clipped && l.spill.length === 0) && m.overflowX <= 0;
const legible = (m) => m.labels.every((l) => l.minContrast >= 4.5) && m.creditContrast >= 4.5;
const fitDetail = (m) =>
  JSON.stringify({ overflowX: m.overflowX, labels: m.labels.map((l) => ({ cls: l.cls, h: l.height, clipped: l.clipped, spill: l.spill })) });

// Fills both labels to their caps in the DOM (the words a provider could put there at most), to show the reserved
// space holds them. FACE=live gets these from the fakes, through the parsers, instead.
async function fillToCaps(page) {
  await page.evaluate(
    ({ title, game }) => {
      const set = (sel, text) => document.querySelectorAll(sel).forEach((el) => (el.textContent = text));
      set('.tape [data-label="title"]', title);
      set('.tape [data-label="sub"]', `${"A".repeat(62)}…`);
      set('.game-cart [data-label="game"]', game);
    },
    { title: LONG_TITLE, game: LONG_GAME },
  );
}

async function viewing(browser, name, opts) {
  const { context, page } = await open(browser, opts);
  await page.locator("[data-now-playing]").scrollIntoViewIfNeeded();
  const m = await measure(page);
  check(`${name}: the shelf is on the page`, m.present && m.visible);
  if (FACE === "quiet") {
    check(`${name}: quiet cassette and quiet cartridge`, m.face === "quiet" && m.cart === "quiet" && !m.spin, `${m.face}/${m.cart}`);
    check(`${name}: the quiet words`, /Nothing on the deck right now\./.test(m.text) && /Quiet/.test(m.text), m.text.slice(0, 160));
  } else {
    check(`${name}: the fixture track and game`, m.face === "track" && m.cart === "game" && m.spin, `${m.face}/${m.cart}/${m.spin}`);
    check(`${name}: the long labels arrive capped`, m.text.includes(LONG_TITLE) && m.text.includes(LONG_GAME), m.text.slice(0, 200));
  }
  check(`${name}: labels fit, nothing scrolls sideways`, fits(m), fitDetail(m));
  check(`${name}: label and credit text at least 4.5:1`, legible(m), JSON.stringify({ labels: m.labels.map((l) => l.minContrast.toFixed(2)), credit: m.creditContrast.toFixed(2) }));
  check(`${name}: links are at least 24 px tall`, m.links.length >= 1 && m.links.every((l) => l.height >= 24), JSON.stringify(m.links.map((l) => l.height)));
  if (FACE === "quiet") {
    const before = m.labels.map((l) => Math.round(l.height));
    await fillToCaps(page);
    const full = await measure(page);
    check(`${name}: capped labels fit the reserved space`, fits(full), fitDetail(full));
    check(
      `${name}: the label keeps its height when full`,
      full.labels.every((l, i) => Math.abs(l.height - before[i]) <= 1),
      JSON.stringify({ before, after: full.labels.map((l) => Math.round(l.height)) }),
    );
  }
  await shot(page, name);
  await context.close();
}

async function controls(browser) {
  const { context, page } = await open(browser, { viewport: PHONE });
  await page.locator("[data-now-playing]").scrollIntoViewIfNeeded();
  await fillToCaps(page);
  // Negative control: one unbroken line per label must overflow, and the fit check must say so.
  await page.addStyleTag({ content: ".np-label{overflow-wrap:normal!important;white-space:nowrap!important;min-height:0!important}" }).then((h) => h.evaluate((el) => (el.id = "nowrap")));
  check("control: an unbroken label is caught overflowing", !fits(await measure(page)));
  await page.evaluate(() => document.getElementById("nowrap")?.remove());
  check("control: undone, the labels fit again", fits(await measure(page)), fitDetail(await measure(page)));
  // Negative control: grey label text must fail the contrast check.
  await page.addStyleTag({ content: ".np-label>*{color:#bdb6a6!important}" }).then((h) => h.evaluate((el) => (el.id = "grey")));
  check("control: grey label text is caught below 4.5:1", !legible(await measure(page)));
  await page.evaluate(() => document.getElementById("grey")?.remove());
  check("control: undone, the label text is legible again", legible(await measure(page)));
  await context.close();
}

// The reels: turning only for a playing track, still under reduced motion at load and when it is switched on.
async function reels(browser) {
  {
    const { context, page } = await open(browser);
    const spinning = FACE === "live";
    if (!spinning) await page.evaluate(() => document.querySelector(".tape").setAttribute("data-spin", ""));
    let m = await measure(page);
    check("reels: a playing tape's reels turn", m.running === 2, `running ${m.running}`);
    await page.emulateMedia({ reducedMotion: "reduce" });
    m = await measure(page);
    check("reels: reduced motion switched on mid-play stops them", m.running === 0, `running ${m.running}`);
    await page.emulateMedia({ reducedMotion: "no-preference" });
    m = await measure(page);
    check("reels: and switched off, they turn again", m.running === 2, `running ${m.running}`);
    // Negative control: without data-spin (nothing playing) the same count is zero.
    await page.evaluate(() => document.querySelector(".tape").removeAttribute("data-spin"));
    m = await measure(page);
    check("control: a tape that is not playing stands still", m.running === 0, `running ${m.running}`);
    await context.close();
  }
  {
    const { context, page } = await open(browser, { reduced: true });
    if (FACE !== "live") await page.evaluate(() => document.querySelector(".tape").setAttribute("data-spin", ""));
    const m = await measure(page);
    check("reels: under reduced motion from the start they stand still", m.running === 0, `running ${m.running}`);
    await context.close();
  }
}

// Keyboard: Tab reaches the cassette's link, and the ring shows against the paper label.
async function keyboard(browser) {
  for (const dark of [false, true]) {
    const { context, page } = await open(browser, { dark });
    let found = null;
    for (let i = 0; i < 120 && !found; i++) {
      await page.keyboard.press("Tab");
      found = await page.evaluate(() => {
        const a = document.activeElement;
        if (!a?.classList.contains("np-link") || !a.closest(".tape")) return null;
        const s = getComputedStyle(a);
        return { visible: a.matches(":focus-visible"), style: s.outlineStyle, width: parseFloat(s.outlineWidth), color: s.outlineColor };
      });
    }
    const theme = dark ? "dark" : "light";
    check(`keyboard ${theme}: Tab reaches the cassette's link`, Boolean(found));
    check(
      `keyboard ${theme}: its focus ring is drawn in label ink`,
      found && found.visible && found.style !== "none" && found.width >= 2 && /\(35, 30, 22\)/.test(found.color),
      JSON.stringify(found),
    );
    await context.close();
  }
}

// JavaScript off: the first HTML is the whole shelf, with the same face.
async function noJs(browser) {
  const { context, page } = await open(browser, { js: false });
  const m = await measure(page);
  check("no-JS: the shelf is there and visible", m.present && m.visible);
  if (FACE === "quiet") check("no-JS: the quiet face", m.face === "quiet" && /Nothing on the deck right now\./.test(m.text), m.text.slice(0, 160));
  else check("no-JS: the fixture reading, not a fallback", m.face === "track" && m.text.includes(LONG_TITLE) && m.text.includes(LONG_GAME), m.text.slice(0, 160));
  check("no-JS: a read stamp only when read", FACE === "live" ? /Read \d\d:\d\d UTC/.test(m.text) : /Not read live/.test(m.text), m.text.slice(-200));
  await context.close();
}

const browser = await chromium.launch();
try {
  const runs = [];
  for (const [vp, label] of [
    [DESKTOP, "desktop"],
    [PHONE, "phone"],
  ])
    for (const dark of [false, true]) runs.push([`${label} ${dark ? "dark" : "light"}`, (b) => viewing(b, `${label} ${dark ? "dark" : "light"}`, { viewport: vp, dark })]);
  runs.push(["controls", controls], ["reels", reels], ["keyboard", keyboard], ["no-JS", noJs]);
  for (const [name, run] of runs) {
    try {
      await run(browser);
    } catch (e) {
      check(`${name}: ran to the end`, false, e.message.split("\n")[0]);
    }
  }
} finally {
  await browser.close();
}

const leaks = SENTINELS.flatMap((s) => bodies.filter((b) => b.text.includes(s)).map((b) => b.url));
if (SENTINELS.length) check(`no secret in any of the ${bodies.length} responses the browser received`, leaks.length === 0, leaks.slice(0, 3).join(" "));
check("scripts were scanned", bodies.some((b) => /\.js(\?|$)/.test(b.url)), `${bodies.length} bodies`);
check("no console or page errors", errors.length === 0, errors.slice(0, 5).join(" | "));
console.log(`probe: ${ok} ok, ${failed} failed`);
process.exit(failed ? 1 : 0);
