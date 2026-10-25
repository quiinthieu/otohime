// Smoke for the paper almanac. First, in node with no browser and no server:
// resolveSeason and the pre-paint script for a fixed clock. Then, when run by
// scripts/probe-seasons.sh (which builds, starts the app and installs a pinned
// Playwright into PW_PREFIX), the ambient layer (components/season-layer.tsx) in
// headless Chromium. Each check prints one line; any mismatch exits 1. Later
// season tasks add their checks to CHECKS or LAYER.
//
//   node --experimental-strip-types --disable-warning=ExperimentalWarning \
//     --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/probe-seasons.mjs   # node checks only
//   bash scripts/probe-seasons.sh                                                # node + layer checks
import { hemisphereFromZone, resolveSeason, SEASON_ATTR, seasonScript } from "../lib/seasons.ts";

// Mid-January, noon UTC: high summer in Sydney, deep winter in London.
const CLOCK = new Date("2026-01-15T12:00:00Z");
// Late on 28 February in UTC is already 1 March in Auckland: autumn there, by its own wall clock.
const TURN = new Date("2026-02-28T23:30:00Z");

// The layouts' pre-paint script (lib/seasons.ts seasonScript), run as the browser would but with this clock,
// zone and stored value: it returns the data-season it set on <html>.
function prePaint(script, now, zone, stored) {
  const attrs = {};
  const document = { documentElement: { setAttribute: (k, v) => void (attrs[k] = v) } };
  const localStorage = {
    getItem() {
      if (stored instanceof Error) throw stored;
      return stored;
    },
  };
  const FixedDate = class extends Date {
    constructor() {
      super(now.getTime());
    }
  };
  function DateTimeFormat(locale, options) {
    return options ? new Intl.DateTimeFormat(locale, options) : { resolvedOptions: () => ({ timeZone: zone }) };
  }
  new Function("document", "localStorage", "Date", "Intl", script)(document, localStorage, FixedDate, { DateTimeFormat });
  return attrs[SEASON_ATTR];
}

// The script against resolveSeason itself: "same" when they agree, else both answers.
const same = (script, now, zone, stored) => {
  const a = prePaint(script, now, zone, stored);
  const b = resolveSeason(stored instanceof Error ? null : stored, now, zone);
  return a === b ? `same ${a}` : `script ${a}, resolveSeason ${b}`;
};
// Negative control: the script with its hemisphere stuck on north must be told apart.
const northOnly = seasonScript.replace(/south=[^;]+;/, "south=false;").replace(/south=true/, "south=false");

const CHECKS = [
  ["hemisphere Australia/Sydney", () => hemisphereFromZone("Australia/Sydney"), "south"],
  ["season Australia/Sydney", () => resolveSeason(null, CLOCK, "Australia/Sydney"), "summer"],
  ["season Europe/London", () => resolveSeason(null, CLOCK, "Europe/London"), "winter"],
  ["season no zone", () => resolveSeason(null, CLOCK, ""), "winter"],
  ["manual autumn in Sydney", () => resolveSeason("autumn", CLOCK, "Australia/Sydney"), "autumn"],
  ["pre-paint Australia/Sydney", () => same(seasonScript, CLOCK, "Australia/Sydney", null), "same summer"],
  ["pre-paint Europe/London", () => same(seasonScript, CLOCK, "Europe/London", null), "same winter"],
  ["pre-paint no zone", () => same(seasonScript, CLOCK, undefined, null), "same winter"],
  ["pre-paint unknown zone", () => same(seasonScript, CLOCK, "Not/AZone", null), "same winter"],
  ["pre-paint Pacific/Auckland at the month's turn", () => same(seasonScript, TURN, "Pacific/Auckland", null), "same autumn"],
  ["pre-paint stored autumn in Sydney", () => same(seasonScript, CLOCK, "Australia/Sydney", "autumn"), "same autumn"],
  ["pre-paint stored nonsense", () => same(seasonScript, CLOCK, "Australia/Sydney", "monsoon"), "same summer"],
  ["pre-paint storage throws", () => same(seasonScript, CLOCK, "Australia/Sydney", new Error("SecurityError")), "same summer"],
  ["negative control: north-only script", () => same(northOnly, CLOCK, "Australia/Sydney", null), "script winter, resolveSeason summer"],
];

let failed = 0;
for (const [name, run, want] of CHECKS) {
  const got = run();
  const ok = got === want;
  if (!ok) failed++;
  console.log(`${ok ? "ok  " : "FAIL"} ${name}: ${got}${ok ? "" : ` (want ${want})`}`);
}
console.log(`clock ${CLOCK.toISOString()}: ${CHECKS.length - failed}/${CHECKS.length} checks pass`);

if (process.env.PW_PREFIX) failed += await layerChecks();
else console.log("note: PW_PREFIX unset, layer checks skipped (bash scripts/probe-seasons.sh runs them)");
process.exit(failed ? 1 : 0);

// The ambient layer in a real browser, against the built app at BASE_URL. The season is chosen the way the dial
// will choose it, through localStorage "season", which the pre-paint script reads; the page is never patched.
// The one fixture is document.hidden, which headless Chromium cannot flip, so the pause check overrides the getter
// on that page and fires visibilitychange, as a tab switch would.
async function layerChecks() {
  const { createRequire } = await import("node:module");
  const path = await import("node:path");
  const require = createRequire(path.join(process.env.PW_PREFIX, "package.json"));
  const { chromium } = require("playwright");
  const BASE_URL = process.env.BASE_URL;
  const EXPECT_SHA = process.env.EXPECT_SHA ?? "";
  const DESKTOP = { width: 1366, height: 768 };
  const PHONE = { width: 390, height: 844 };
  const KIND = { spring: "petal", summer: "rain", autumn: "leaf", winter: "snow" };
  const MAX = 40;
  let bad = 0;
  let good = 0;
  const check = (name, pass, detail = "") => {
    if (pass) good++;
    else bad++;
    console.log(`${pass ? "ok  " : "FAIL"} layer: ${name}${detail ? `: ${detail}` : ""}`);
  };
  const errors = [];

  async function open(browser, { season = null, reduced = false, viewport = DESKTOP, scheme = "light" } = {}) {
    const context = await browser.newContext({ viewport, colorScheme: scheme, reducedMotion: reduced ? "reduce" : "no-preference" });
    if (season) await context.addInitScript({ content: `try{localStorage.setItem("season",${JSON.stringify(season)})}catch(e){}` });
    const page = await context.newPage();
    page.on("console", (m) => m.type() === "error" && errors.push(`console ${page.url()}: ${m.text()}`));
    page.on("pageerror", (e) => errors.push(`pageerror ${page.url()}: ${e.message}`));
    await page.goto(BASE_URL + "/", { waitUntil: "load" });
    // hydrated: the layer says which season it drew, or "still"
    await page.waitForFunction(() => document.querySelector("svg.season-layer")?.dataset.seasonLayer, null, { timeout: 15000 }).catch(() => {});
    return { context, page };
  }

  // Everything the checks read, from the page: the layer, its elements, its bits and each bit's animations.
  const read = (page) =>
    page.evaluate(() => {
      const svg = document.querySelector("svg.season-layer");
      if (!svg) return null;
      const style = getComputedStyle(svg);
      const bits = [...svg.querySelectorAll(".almanac-bit")];
      const anims = document.getAnimations().filter((a) => a.effect?.target && svg.contains(a.effect.target));
      const META = new Set(["offset", "computedOffset", "easing", "composite"]);
      const props = [...new Set(anims.flatMap((a) => a.effect.getKeyframes().flatMap((k) => Object.keys(k).filter((p) => !META.has(p)))))].sort();
      const r = svg.getBoundingClientRect();
      return {
        count: svg.querySelectorAll("*").length + 1,
        layers: document.querySelectorAll("svg.season-layer").length,
        drawn: svg.dataset.seasonLayer,
        attr: document.documentElement.dataset.season,
        hidden: svg.getAttribute("aria-hidden"),
        pointer: style.pointerEvents,
        position: style.position,
        z: style.zIndex,
        covers: r.left === 0 && r.top === 0 && r.width === innerWidth && r.height === innerHeight,
        // Next's own hidden metadata boundary may come first; nothing rendered does
        first: [...document.body.children].find((el) => !el.hidden) === svg,
        bits: bits.length,
        kinds: [...new Set(bits.map((b) => [...b.classList].find((c) => c !== "almanac-bit")))],
        anims: anims.length,
        states: [...new Set(anims.map((a) => a.playState))].sort(),
        props,
        transitions: anims.filter((a) => a instanceof CSSTransition).length,
        // a bit's computed animation when no animation object exists (reduced motion), to tell none from 0.01ms
        names: [...new Set(bits.map((b) => getComputedStyle(b).animationName))],
      };
    });

  const browser = await chromium.launch();
  try {
    if (EXPECT_SHA) {
      const html = await (await fetch(BASE_URL + "/")).text();
      const sha = html.match(/<meta name="build-sha" content="([^"]*)"/)?.[1] ?? "none";
      check(`build-sha is ${EXPECT_SHA}`, sha === EXPECT_SHA, sha);
    }

    // The served HTML: the layer is in the shell, empty, before any masthead.
    {
      const html = await (await fetch(BASE_URL + "/")).text();
      const at = html.indexOf('<svg class="season-layer"');
      check("served HTML has one empty aria-hidden layer ahead of the masthead", at !== -1 && html.indexOf('<svg class="season-layer"', at + 1) === -1 && /^<svg class="season-layer" aria-hidden="true"[^>]*><\/svg>/.test(html.slice(at)) && at < html.indexOf('class="masthead'), html.slice(at, at + 160));
    }

    for (const [season, viewport] of [["spring", DESKTOP], ["summer", DESKTOP], ["autumn", DESKTOP], ["winter", DESKTOP], ["summer", PHONE], ["winter", PHONE]]) {
      const tag = `${season} ${viewport.width}px`;
      const { context, page } = await open(browser, { season, viewport });
      const s = await read(page);
      if (!s) {
        check(`${tag}: layer present`, false, "no svg.season-layer");
        await context.close();
        continue;
      }
      check(`${tag}: one layer, drawn for data-season`, s.layers === 1 && s.attr === season && s.drawn === season, JSON.stringify([s.layers, s.attr, s.drawn]));
      check(`${tag}: aria-hidden, pointer-events none, fixed behind the page over the whole viewport`, s.hidden === "true" && s.pointer === "none" && s.position === "fixed" && s.z === "-1" && s.covers, JSON.stringify([s.hidden, s.pointer, s.position, s.z, s.covers]));
      check(`${tag}: first rendered element in <body>, ahead of the skip link and masthead`, s.first);
      check(`${tag}: at most ${MAX} elements, layer included`, s.count <= MAX && s.bits > 0, `${s.count} elements, ${s.bits} bits`);
      check(`${tag}: only ${KIND[season]} bits`, s.kinds.length === 1 && s.kinds[0] === `almanac-${KIND[season]}`, s.kinds.join(","));
      check(`${tag}: every bit runs one animation, no transitions`, s.anims === s.bits && s.transitions === 0 && s.states.join() === "running", JSON.stringify([s.anims, s.transitions, s.states]));
      check(`${tag}: animated properties are transform and opacity only`, s.props.join() === "opacity,transform", s.props.join());
      await context.close();
    }

    // Hidden tab: paused while document.hidden, running again when it is shown.
    {
      const { context, page } = await open(browser, { season: "autumn" });
      const flip = (h) =>
        page.evaluate((h) => {
          Object.defineProperty(document, "hidden", { configurable: true, get: () => h });
          document.dispatchEvent(new Event("visibilitychange"));
        }, h);
      // negative control: a visibilitychange that leaves the tab visible must not pause it
      await flip(false);
      await page.waitForTimeout(200);
      let s = await read(page);
      check("visible after visibilitychange: still running (negative control)", s.states.join() === "running", s.states.join());
      await flip(true);
      await page.waitForFunction(() => document.querySelector("svg.season-layer")?.hasAttribute("data-paused"), null, { timeout: 5000 }).catch(() => {});
      s = await read(page);
      check("document.hidden: every bit paused", s.anims === s.bits && s.bits > 0 && s.states.join() === "paused", JSON.stringify([s.anims, s.states]));
      await flip(false);
      await page.waitForFunction(() => !document.querySelector("svg.season-layer")?.hasAttribute("data-paused"), null, { timeout: 5000 }).catch(() => {});
      s = await read(page);
      check("shown again: every bit running", s.anims === s.bits && s.states.join() === "running", s.states.join());

      // A season change on <html> (what the dial will do) redraws the layer for it.
      await page.evaluate(() => document.documentElement.setAttribute("data-season", "winter"));
      await page.waitForFunction(() => document.querySelector("svg.season-layer")?.dataset.seasonLayer === "winter", null, { timeout: 5000 }).catch(() => {});
      s = await read(page);
      check("data-season autumn -> winter: snow, still within the cap", s.drawn === "winter" && s.kinds.join() === "almanac-snow" && s.count <= MAX, JSON.stringify([s.drawn, s.kinds, s.count]));

      // Negative control for the property check: a bit animating r must be caught by the same reader.
      await page.evaluate(() => document.querySelector("svg.season-layer .almanac-bit").animate([{ r: "1px" }, { r: "6px" }], { duration: 1000, iterations: Infinity }));
      s = await read(page);
      check("negative control: an r animation is reported", s.props.includes("r"), s.props.join());

      // Live switch to reduced motion: the bits go.
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.waitForFunction(() => document.querySelector("svg.season-layer")?.dataset.seasonLayer === "still", null, { timeout: 5000 }).catch(() => {});
      s = await read(page);
      check("live switch to reduced motion: no bits, no animations", s.drawn === "still" && s.bits === 0 && s.anims === 0, JSON.stringify([s.drawn, s.bits, s.anims]));
      await context.close();
    }

    // Reduced motion from the start, in every season: the layer is there, aria-hidden and empty, nothing runs.
    for (const season of Object.keys(KIND)) {
      const { context, page } = await open(browser, { season, reduced: true, scheme: "dark" });
      const s = await read(page);
      check(`reduced motion ${season}: tinted, layer aria-hidden with no bits and no running animations`, s && s.attr === season && s.hidden === "true" && s.drawn === "still" && s.bits === 0 && s.anims === 0 && s.count === 1, JSON.stringify(s && [s.attr, s.drawn, s.bits, s.anims, s.count]));
      // The CSS guard alone, with a bit forced in: animation none, not the site-wide 0.01ms run.
      const forced = await page.evaluate(() => {
        const svg = document.querySelector("svg.season-layer");
        const c = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        c.setAttribute("class", "almanac-bit almanac-snow");
        c.setAttribute("r", "3");
        c.setAttribute("style", "--x: 50vw; --d: 10s; --delay: -2s");
        svg.append(c);
        const out = { name: getComputedStyle(c).animationName, running: c.getAnimations().length, opacity: getComputedStyle(c).opacity };
        c.remove();
        return out;
      });
      check(`reduced motion ${season}: a forced bit has animation none and opacity 0`, forced.name === "none" && forced.running === 0 && forced.opacity === "0", JSON.stringify(forced));
      await context.close();
    }

    // Negative control for the CSS guard: the same forced bit with motion welcome does animate.
    {
      const { context, page } = await open(browser, { season: "winter" });
      const forced = await page.evaluate(() => {
        const svg = document.querySelector("svg.season-layer");
        const c = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        c.setAttribute("class", "almanac-bit almanac-snow");
        c.setAttribute("r", "3");
        c.setAttribute("style", "--x: 50vw; --d: 10s; --delay: -2s");
        svg.append(c);
        const out = { name: getComputedStyle(c).animationName, running: c.getAnimations().length };
        c.remove();
        return out;
      });
      check("negative control: the forced bit animates when motion is welcome", forced.name === "almanac-snow" && forced.running === 1, JSON.stringify(forced));
      await context.close();
    }

    check("no console errors or page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
  } finally {
    await browser.close();
  }
  console.log(`layer: ${good}/${good + bad} checks pass`);
  return bad;
}
