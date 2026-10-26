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
// Mid-July: deep winter in Sydney, high summer in London.
const JULY = new Date("2026-07-15T12:00:00Z");
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
  ["season Australia/Sydney in July", () => resolveSeason(null, JULY, "Australia/Sydney"), "winter"],
  ["season Europe/London in July", () => resolveSeason(null, JULY, "Europe/London"), "summer"],
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

if (process.env.PW_PREFIX) {
  failed += await layerChecks();
  failed += await dialChecks();
} else console.log("note: PW_PREFIX unset, layer and dial checks skipped (bash scripts/probe-seasons.sh runs them)");
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

// The season dial (components/season-dial.tsx) in a real browser. The visitor's zone and clock are the context's
// (timezoneId, clock.setFixedTime), so the pre-paint script and the dial's Auto both read them as a visitor's
// browser would. The one fixture is blocked storage: an init script makes every localStorage access throw, as a
// browser with site data blocked does. The masthead controls' boxes are sampled every frame from the first.
async function dialChecks() {
  const { createRequire } = await import("node:module");
  const path = await import("node:path");
  const require = createRequire(path.join(process.env.PW_PREFIX, "package.json"));
  const { chromium } = require("playwright");
  const BASE_URL = process.env.BASE_URL;
  const DESKTOP = { width: 1366, height: 768 };
  const PHONE = { width: 390, height: 844 };
  const STOPS = ["auto", "spring", "summer", "autumn", "winter"];
  let bad = 0;
  let good = 0;
  const check = (name, pass, detail = "") => {
    if (pass) good++;
    else bad++;
    console.log(`${pass ? "ok  " : "FAIL"} dial: ${name}${detail ? `: ${detail}` : ""}`);
  };

  const BLOCK = `(()=>{const deny=()=>{throw new DOMException("The operation is insecure.","SecurityError")};for(const o of [window,Window.prototype])try{Object.defineProperty(o,"localStorage",{configurable:true,get:deny})}catch(e){}})()`;
  // Each masthead control's box, sampled every frame from the first one: a new entry only when the box moves.
  const TRACK = `window.__track={};(function loop(){var h=document.querySelector("header.masthead");if(h){var items={brand:h.firstElementChild,sound:h.querySelector(".sound-toggle"),dial:h.querySelector("[data-season-dial]"),theme:h.querySelector(".theme-toggle")};for(var k in items){var el=items[k];if(!el)continue;var r=el.getBoundingClientRect(),v=k==="brand"?Math.round(r.left)+","+Math.round(r.top):[r.left,r.top,r.width,r.height].map(Math.round).join(),t=window.__track[k]||(window.__track[k]=[]);if(t[t.length-1]!==v)t.push(v)}}requestAnimationFrame(loop)})()`;

  async function open(browser, { zone = "Australia/Sydney", now = CLOCK, viewport = DESKTOP, blocked = false } = {}) {
    const context = await browser.newContext({ viewport, timezoneId: zone });
    await context.clock.setFixedTime(now);
    if (blocked) await context.addInitScript({ content: BLOCK });
    await context.addInitScript({ content: TRACK });
    const page = await context.newPage();
    const errors = [];
    page.on("console", (m) => m.type() === "error" && errors.push(`console ${page.url()}: ${m.text()}`));
    page.on("pageerror", (e) => errors.push(`pageerror ${page.url()}: ${e.message}`));
    await goto(page);
    return { context, page, errors };
  }
  // hydrated: the dial has a checked stop
  async function goto(page, reload = false) {
    if (reload) await page.reload({ waitUntil: "load" });
    else await page.goto(BASE_URL + "/", { waitUntil: "load" });
    await page.waitForFunction(() => document.querySelector("[data-season-dial] input:checked"), null, { timeout: 15000 }).catch(() => {});
  }

  const state = (page) =>
    page.evaluate(() => {
      const dial = document.querySelector("[data-season-dial]");
      const radios = dial ? [...dial.querySelectorAll('input[type="radio"]')] : [];
      let stored;
      try {
        stored = localStorage.getItem("season");
      } catch {
        stored = "blocked";
      }
      const active = document.activeElement;
      return {
        role: dial?.getAttribute("role") ?? null,
        label: dial?.getAttribute("aria-label") ?? null,
        stops: radios.map((r) => r.value).join(),
        names: radios.map((r) => r.labels?.[0]?.textContent ?? "").join("|"),
        checked: radios.filter((r) => r.checked).map((r) => r.value).join(),
        season: document.documentElement.dataset.season,
        stored,
        layer: document.querySelector("svg.season-layer")?.dataset.seasonLayer,
        focused: active instanceof HTMLInputElement && dial?.contains(active) ? active.value : null,
      };
    });
  const brief = (s) => JSON.stringify({ checked: s.checked, season: s.season, stored: s.stored, layer: s.layer, focused: s.focused });
  const layerIs = (page, season) =>
    page.waitForFunction((s) => document.querySelector("svg.season-layer")?.dataset.seasonLayer === s, season, { timeout: 5000 }).catch(() => {});

  // The focus ring: the outline on each stop's label.
  const rings = (page) =>
    page.evaluate(() =>
      Object.fromEntries(
        [...document.querySelectorAll("[data-season-dial] label")].map((l) => {
          const s = getComputedStyle(l);
          return [l.querySelector("input").value, s.outlineStyle === "none" ? "none" : `${s.outlineStyle} ${s.outlineWidth}`];
        }),
      ),
    );

  // The masthead's boxes: its height, the brand mark, each control on the right, and anything that spills.
  const layout = (page) =>
    page.evaluate(() => {
      const head = document.querySelector("header.masthead");
      const box = (el) => {
        const r = el.getBoundingClientRect();
        return { l: Math.round(r.left * 10) / 10, r: Math.round(r.right * 10) / 10, t: Math.round(r.top * 10) / 10, b: Math.round(r.bottom * 10) / 10, h: Math.round(r.height * 10) / 10 };
      };
      const brand = head.firstElementChild;
      const controls = [...head.lastElementChild.children].filter((el) => getComputedStyle(el).display !== "none");
      const hb = box(head);
      const items = controls.map((el) => ({ cls: el.getAttribute("class") ?? el.nodeName, ...box(el) }));
      const b = box(brand);
      return {
        head: hb.h,
        brand: b,
        theme: box(head.querySelector(".theme-toggle")),
        dial: head.querySelector("[data-season-dial]") ? box(head.querySelector("[data-season-dial]")) : null,
        // a control left of the brand mark's right edge, past the viewport, or outside the bar's height
        clash: items.filter((i) => i.l < b.r || i.r > innerWidth || i.t < hb.t || i.b > hb.b).map((i) => i.cls),
        overflow: document.documentElement.scrollWidth > innerWidth,
      };
    });

  const browser = await chromium.launch();
  try {
    // The served HTML: one radiogroup in the masthead, between the speaker and the theme toggle, no stop checked yet.
    {
      const html = await (await fetch(BASE_URL + "/")).text();
      const head = html.indexOf('<header class="masthead');
      const at = html.indexOf('class="season-dial"');
      const sound = html.indexOf("sound-toggle", head);
      const theme = html.indexOf("theme-toggle", head);
      const dial = at === -1 ? "" : html.slice(at, theme);
      const radios = dial.match(/<input[^>]*>/g) ?? [];
      check(
        "served HTML: one radiogroup in the masthead between the speaker and the theme toggle",
        head !== -1 && at > sound && sound > head && at < theme && html.indexOf('class="season-dial"', at + 1) === -1 && /role="radiogroup"/.test(html.slice(at - 60, at)),
        JSON.stringify([head, sound, at, theme]),
      );
      check("served HTML: five native radios, none checked before hydration", radios.length === 5 && radios.every((r) => /type="radio"/.test(r) && /name="season-dial"/.test(r) && !/checked/.test(r)), `${radios.length} radios`);
    }

    // Zone and clock pick the season: Sydney is in the south.
    for (const [zone, now, want] of [
      ["Australia/Sydney", CLOCK, "summer"],
      ["Australia/Sydney", JULY, "winter"],
      ["Europe/London", CLOCK, "winter"],
    ]) {
      const { context, page, errors } = await open(browser, { zone, now });
      const s = await state(page);
      const tag = `${zone} at ${now.toISOString().slice(0, 10)}`;
      check(`${tag}: Auto checked, data-season ${want}, layer ${want}${zone === "Europe/London" ? " (negative control: north at the same clock)" : ""}`, s.checked === "auto" && s.season === want && s.stored === null, brief(s));
      if (zone === "Australia/Sydney" && now === CLOCK) {
        check("radiogroup named Season with Auto and the four seasons, each stop named", s.role === "radiogroup" && s.label === "Season" && s.stops === STOPS.join() && s.names === "Auto, by your clock|Spring|Summer|Autumn|Winter", JSON.stringify([s.role, s.label, s.stops, s.names]));
      }
      check(`${tag}: no console or page errors`, errors.length === 0, errors.slice(0, 3).join(" | "));
      await context.close();
    }

    // Keyboard: Tab reaches the checked stop with a visible ring, arrows move the pick at once, it survives a reload,
    // and Auto clears it.
    {
      const { context, page, errors } = await open(browser);
      for (let i = 0; i < 30 && (await state(page)).focused === null; i++) await page.keyboard.press("Tab");
      let s = await state(page);
      check("Tab lands on the checked stop (Auto)", s.focused === "auto", brief(s));
      let r = await rings(page);
      check("the focused stop wears a 2px ring; the others none (negative control)", r.auto === "solid 2px" && STOPS.slice(1).every((v) => r[v] === "none"), JSON.stringify(r));

      await page.keyboard.press("ArrowRight");
      s = await state(page);
      check("ArrowRight: spring checked, focused, stored and on <html> at once", s.checked === "spring" && s.focused === "spring" && s.stored === "spring" && s.season === "spring", brief(s));
      r = await rings(page);
      check("the ring follows the focus to spring", r.spring === "solid 2px" && r.auto === "none", JSON.stringify(r));
      await layerIs(page, "spring");
      check("the ambient layer follows the dial to spring", (await state(page)).layer === "spring");

      for (let i = 0; i < 3; i++) await page.keyboard.press("ArrowRight");
      s = await state(page);
      check("ArrowRight x3: winter", s.checked === "winter" && s.stored === "winter" && s.season === "winter", brief(s));

      await goto(page, true);
      await layerIs(page, "winter");
      s = await state(page);
      check("reload: winter persists (checked, stored, data-season, layer)", s.checked === "winter" && s.stored === "winter" && s.season === "winter" && s.layer === "winter", brief(s));

      for (let i = 0; i < 30 && (await state(page)).focused === null; i++) await page.keyboard.press("Tab");
      await page.keyboard.press("ArrowRight");
      s = await state(page);
      check("ArrowRight from winter wraps to Auto: storage cleared, the clock's summer restored", s.checked === "auto" && s.focused === "auto" && s.stored === null && s.season === "summer", brief(s));
      await page.keyboard.press("ArrowLeft");
      await page.keyboard.press("ArrowLeft");
      s = await state(page);
      check("ArrowLeft x2 from Auto: autumn", s.checked === "autumn" && s.stored === "autumn" && s.season === "autumn", brief(s));
      await page.click('[data-season-dial] label[title^="Auto"]');
      s = await state(page);
      check("click Auto: storage cleared, summer restored", s.checked === "auto" && s.stored === null && s.season === "summer", brief(s));
      await goto(page, true);
      await layerIs(page, "summer");
      s = await state(page);
      check("reload after Auto: still Auto and summer", s.checked === "auto" && s.stored === null && s.season === "summer" && s.layer === "summer", brief(s));
      check("keyboard run: no console or page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
      await context.close();
    }

    // Storage blocked: Auto, a pick holds in memory, and a reload is Auto again, all without an error.
    {
      const { context, page, errors } = await open(browser, { blocked: true });
      let s = await state(page);
      check("blocked storage: the fixture holds (localStorage throws)", s.stored === "blocked", brief(s));
      check("blocked storage: falls back to Auto and the clock's summer", s.checked === "auto" && s.season === "summer", brief(s));
      await page.click('[data-season-dial] label[title="Winter"]');
      await layerIs(page, "winter");
      s = await state(page);
      check("blocked storage: a pick of winter holds in memory and on <html>", s.checked === "winter" && s.season === "winter" && s.layer === "winter", brief(s));
      await goto(page, true);
      s = await state(page);
      check("blocked storage: reload is Auto and summer again", s.checked === "auto" && s.season === "summer", brief(s));
      check("blocked storage: no console or page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
      await context.close();
    }

    // A phone folds the dial to one button showing the pick; a tap turns it, and the arrow keys still work.
    {
      const { context, page, errors } = await open(browser, { viewport: PHONE });
      const shown = () =>
        page.evaluate(() =>
          [...document.querySelectorAll("[data-season-dial] label")]
            .filter((l) => getComputedStyle(l).opacity !== "0" && getComputedStyle(l).pointerEvents !== "none")
            .map((l) => l.querySelector("input").value)
            .join(),
        );
      let s = await state(page);
      check("390px: folded, only the pick (Auto) shows", (await shown()) === "auto" && s.checked === "auto", `${await shown()} ${brief(s)}`);
      await page.click("[data-season-dial]");
      s = await state(page);
      check("390px: a tap turns Auto to spring, stored and on <html>", s.checked === "spring" && s.stored === "spring" && s.season === "spring" && (await shown()) === "spring", `${await shown()} ${brief(s)}`);
      await page.click("[data-season-dial]");
      s = await state(page);
      check("390px: a second tap turns it to summer, one stop per tap", s.checked === "summer" && s.stored === "summer", brief(s));
      for (let i = 0; i < 30 && (await state(page)).focused === null; i++) await page.keyboard.press("Tab");
      await page.keyboard.press("ArrowRight");
      s = await state(page);
      check("390px: ArrowRight on the folded dial: autumn", s.checked === "autumn" && s.stored === "autumn" && s.season === "autumn" && (await shown()) === "autumn", `${await shown()} ${brief(s)}`);
      await goto(page, true);
      s = await state(page);
      check("390px: reload keeps autumn", s.checked === "autumn" && s.season === "autumn" && (await shown()) === "autumn", brief(s));
      check("390px fold: no console or page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
      await context.close();
    }
    // Negative control for the fold: at a laptop width a click on the pick does not turn it.
    {
      const { context, page } = await open(browser);
      await page.click('[data-season-dial] label[title^="Auto"]');
      const s = await state(page);
      check("1366px: negative control: clicking the picked Auto keeps Auto", s.checked === "auto" && s.stored === null, brief(s));
      await context.close();
    }

    // The masthead with the dial, at a phone and a laptop width: the bar keeps its 4rem, nothing clashes or spills,
    // nothing in it moved from the first frame on, and taking the dial out moves neither the brand mark nor the
    // theme toggle nor the bar's height. Negative controls: a dial nudged after load is seen to move, and a
    // viewport-wide dial is caught as a clash.
    for (const viewport of [PHONE, DESKTOP]) {
      const tag = `${viewport.width}px`;
      const { context, page, errors } = await open(browser, { viewport });
      await page.waitForTimeout(500);
      const a = await layout(page);
      check(`${tag}: masthead 64px tall, dial 32px, nothing clashes or spills`, a.head === 64 && a.dial?.h === 32 && a.clash.length === 0 && !a.overflow, JSON.stringify({ head: a.head, dial: a.dial, clash: a.clash, overflow: a.overflow }));
      // The brand mark's corner and the speaker's, dial's and theme toggle's boxes, from the first frame on. The
      // account control streams in after the shell, left of all three, and must not move them.
      const moves = () => page.evaluate(() => Object.fromEntries(["brand", "sound", "dial", "theme"].map((k) => [k, window.__track[k] ?? []])));
      const track = await moves();
      check(`${tag}: nothing in the masthead moved from the first frame on`, Object.values(track).every((t) => t.length === 1), JSON.stringify(track));
      const nudge = await page.addStyleTag({ content: "[data-season-dial]{margin-right:12px!important}" });
      await page.waitForTimeout(300);
      const late = await moves();
      check(`${tag}: negative control: a dial nudged after load is seen to move`, late.dial.length > track.dial.length, JSON.stringify(late.dial));
      await nudge.evaluate((el) => el.remove());
      await page.addStyleTag({ content: "[data-season-dial]{display:none!important}" });
      const b = await layout(page);
      check(`${tag}: without the dial the bar height, brand mark and theme toggle are where they were`, b.head === a.head && JSON.stringify(b.brand) === JSON.stringify(a.brand) && JSON.stringify(b.theme) === JSON.stringify(a.theme), JSON.stringify({ with: [a.head, a.brand.r, a.theme.l], without: [b.head, b.brand.r, b.theme.l] }));
      await page.addStyleTag({ content: "[data-season-dial]{display:inline-flex!important;min-width:100vw!important}" });
      const c = await layout(page);
      check(`${tag}: negative control: a viewport-wide dial is caught`, c.clash.length > 0 || c.overflow || c.head !== 64, JSON.stringify({ clash: c.clash, overflow: c.overflow }));
      check(`${tag}: no console or page errors`, errors.length === 0, errors.slice(0, 3).join(" | "));
      await context.close();
    }
  } finally {
    await browser.close();
  }
  console.log(`dial: ${good}/${good + bad} checks pass`);
  return bad;
}
