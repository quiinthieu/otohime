// Drives headless Chromium over the pocket console's session boot. Run by scripts/probe-boot.sh, which installs
// Playwright into PW_PREFIX and passes BASE_URL (and EXPECT_SHA, checked if set).
//
// An init script, before any page script, records every boot-* animation event, whether <html> carried
// data-booted at DOMContentLoaded, and a frame-by-frame sample of the visible console (menu, name, scan line,
// screen, lamp and cartridge, and the console's layout boxes relative to its section, so the page's own .rise
// entrance does not count). It also wraps AudioContext to count contexts and oscillator starts, and can deny
// storage. Hops between pages are real clicks on the masthead's links, so they carry user activation.
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import path from "node:path";

const require = createRequire(path.join(process.env.PW_PREFIX, "package.json"));
const { chromium } = require("playwright");

const BASE_URL = process.env.BASE_URL;
const EXPECT_SHA = process.env.EXPECT_SHA ?? "";
const SHOTS = process.env.SHOTS ?? "";
const PHONE = { width: 390, height: 844 };
const DESKTOP = { width: 1366, height: 768 };
const LIMIT = 2400; // the whole boot, ms
const STEP = 400; // any one movement, ms
const SLACK = 300; // the browser's frame and paint scheduling, ms
const SETTLE = LIMIT + 500;
const MENU = ["/work", "/play", "/notes", "/music", "/projects", "/sketches"];
const BOOT_SCRIPT_RE = /<script>try\{if\(sessionStorage\.getItem\("console:booted"\)\)[^<]*<\/script>/;

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
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function instrument({ sound, blockStorage }) {
  if (blockStorage) {
    const deny = () => {
      throw new DOMException("probe: storage denied", "SecurityError");
    };
    Object.defineProperty(window, "localStorage", { configurable: true, get: deny });
    Object.defineProperty(window, "sessionStorage", { configurable: true, get: deny });
  } else if (sound) {
    localStorage.setItem("sound", sound);
  }

  const B = (window.__boot = { events: [], dcl: null, frames: [], timings: null, sampling: false });
  const log = (e) => {
    if (/^boot/.test(e.animationName)) B.events.push(`${e.type}:${e.animationName}`);
  };
  for (const type of ["animationstart", "animationcancel"]) addEventListener(type, log, true);
  document.addEventListener("DOMContentLoaded", () => {
    B.dcl = { booted: document.documentElement.hasAttribute("data-booted") };
  });

  const a = (window.__audio = { made: 0, starts: 0 });
  const Real = window.AudioContext;
  if (Real) {
    const start = OscillatorNode.prototype.start;
    OscillatorNode.prototype.start = function (...args) {
      a.starts++;
      return start.apply(this, args);
    };
    window.AudioContext = class extends Real {
      constructor(...args) {
        super(...args);
        a.made++;
      }
    };
  }

  const q = (v) => Math.round(v * 2) / 2;
  const console_ = () => [...document.querySelectorAll('section[aria-label="Pocket console"]')].find((s) => s.checkVisibility());
  // One frame of the visible console, or null before it has arrived.
  window.__frame = () => {
    const sec = console_();
    const menu = sec?.querySelector("g.boot");
    if (!sec || !menu) return null;
    const base = sec.getBoundingClientRect();
    const rel = (el) => {
      if (!el) return "none";
      const r = el.getBoundingClientRect();
      return [q(r.x - base.x), q(r.y - base.y), q(r.width), q(r.height)].join(",");
    };
    const svg = menu.ownerSVGElement;
    const s = (sel) => sec.querySelector(sel);
    const cs = (sel) => {
      const el = s(sel);
      return el ? getComputedStyle(el) : null;
    };
    const cart = s(".boot-cart")?.getBoundingClientRect();
    const svgBox = svg?.getBoundingClientRect();
    return {
      t: Math.round(performance.now()),
      booted: document.documentElement.hasAttribute("data-booted"),
      menu: cs("g.boot")?.opacity,
      splash: cs("g.splash")?.opacity,
      print: cs(".boot-print")?.clipPath,
      scan: cs(".boot-scan")?.opacity,
      lcd: cs(".boot-lcd")?.opacity,
      lamp: cs(".boot-lamp")?.opacity,
      cart: cs(".boot-cart")?.translate,
      cartInside: !cart || !svgBox || (cart.top >= svgBox.top - 0.5 && cart.bottom <= svgBox.bottom + 0.5),
      layout: [
        `section ${q(base.width)}x${q(base.height)}`,
        `figure ${rel(s(".machine-figure"))}`,
        `svg ${rel(svg)}`,
        `lcd ${rel(s(".boot-lcd"))}`,
        `controls ${rel(s(".machine-controls"))}`,
        `readout ${rel(s(".readout"))}`,
      ].join(" | "),
    };
  };
  // Samples every frame for ms, and keeps the first frame's boot animation timings.
  let gen = 0;
  window.__sample = (ms) => {
    const mine = ++gen;
    B.frames = [];
    B.timings = null;
    B.sampling = true;
    const until = performance.now() + ms;
    const tick = () => {
      if (mine !== gen) return;
      const f = window.__frame();
      if (f) {
        B.frames.push(f);
        if (!B.timings) {
          const anims = document.getAnimations().filter((x) => /^boot/.test(x.animationName ?? ""));
          if (anims.length) {
            B.timings = anims.map((x) => {
              const c = x.effect.getComputedTiming();
              return { name: x.animationName, delay: c.delay, active: c.activeDuration, end: c.endTime, iterations: c.iterations };
            });
          }
        }
      }
      if (performance.now() < until) requestAnimationFrame(tick);
      else B.sampling = false;
    };
    requestAnimationFrame(tick);
  };
  window.__sample(LIMIT_PLACEHOLDER);
}

const instrumentSource = (opts) =>
  `(${instrument.toString().replace("LIMIT_PLACEHOLDER", String(LIMIT + 800))})(${JSON.stringify(opts)})`;

async function open(browser, { viewport = DESKTOP, scheme = "light", reduced = false, js = true, sound = null, blockStorage = false, sink = errors }) {
  const phone = viewport === PHONE;
  const context = await browser.newContext({
    viewport,
    isMobile: phone,
    hasTouch: phone,
    javaScriptEnabled: js,
    colorScheme: scheme,
    reducedMotion: reduced ? "reduce" : "no-preference",
  });
  await context.addInitScript({ content: instrumentSource({ sound, blockStorage }) });
  const page = await context.newPage();
  watch(page, sink);
  return { context, page };
}

function watch(page, sink) {
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    const from = m.location().url;
    sink.push(`console ${page.url()}: ${m.text()}${from && from !== page.url() ? ` (${from})` : ""}`);
  });
  page.on("pageerror", (e) => sink.push(`pageerror ${page.url()}: ${e.message}`));
}

// Hydrated: React has attached to the console's Down chip.
async function hydrated(page) {
  await page.waitForFunction(
    () => {
      const sec = [...document.querySelectorAll('section[aria-label="Pocket console"]')].find((s) => s.checkVisibility());
      const b = sec && [...sec.querySelectorAll("button")].find((x) => x.textContent?.includes("Down"));
      return b && Object.keys(b).some((k) => k.startsWith("__reactProps"));
    },
    null,
    { timeout: 15000 },
  );
}

const boot = (page) => page.evaluate(() => ({ ...window.__boot, events: [...window.__boot.events] }));
const frame = (page) => page.evaluate(() => window.__frame());
const audio = (page) => page.evaluate(() => ({ ...window.__audio }));
const stored = (page) =>
  page.evaluate(() => {
    try {
      return sessionStorage.getItem("console:booted");
    } catch {
      return "blocked";
    }
  });
const running = (page) =>
  page.evaluate(() => document.getAnimations().filter((a) => /^boot/.test(a.animationName ?? "") && a.playState !== "finished").length);
const readout = (page) =>
  page.evaluate(() => [...document.querySelectorAll(".readout")].map((p) => p.textContent).find((t) => /^Press A to open/.test(t ?? "")) ?? "");
const waitSampling = (page) => page.waitForFunction(() => !window.__boot.sampling, null, { timeout: 15000 });

// Real activations: back to Home by the masthead's brand link, away from it by the console's own Pages link
// (focused, then Enter, which the console leaves to the link). After a client-side hop the old page stays
// mounted and hidden, so only visible elements count.
async function hop(page, href) {
  if (href === "/") {
    await page.locator('header.masthead:visible a[href="/"]').first().click();
  } else {
    await page.locator(`section[aria-label="Pocket console"]:visible nav[aria-label="Pages"] a[href="${href}"]`).focus();
    await page.keyboard.press("Enter");
  }
  await page.waitForURL(BASE_URL + href, { timeout: 10000 });
  await page.waitForTimeout(150);
}
// A hop back to Home, sampling the console from the hop on.
async function hopHome(page) {
  await page.evaluate((ms) => {
    window.__boot.events = [];
    window.__sample(ms);
  }, LIMIT + 800);
  await hop(page, "/");
}

const distinct = (xs) => [...new Set(xs)];
const firstAt = (frames, pred) => frames.find(pred)?.t ?? null;

async function shot(page, name) {
  if (!SHOTS) return;
  mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`) });
}

// A fresh session at one size and theme: the whole boot, once, inside the console's reserved box.
async function fresh(browser, viewport, scheme) {
  const label = `${viewport === PHONE ? "390x844" : "1366x768"} ${scheme}`;
  const { context, page } = await open(browser, { viewport, scheme });
  try {
    await page.goto(BASE_URL + "/", { waitUntil: "domcontentloaded" });
    const early = await boot(page);
    check(`${label}: a fresh session has no data-booted before first paint`, early.dcl?.booted === false, JSON.stringify(early.dcl));
    if (SHOTS) {
      await sleep(1800);
      await shot(page, `${scheme}-${viewport.width}-booting`);
    }
    await waitSampling(page);
    const b = await boot(page);
    const f = b.frames;
    const fcp = await page.evaluate(() => performance.getEntriesByName("first-contentful-paint")[0]?.startTime ?? null);
    const hiddenFirst = f.length > 0 && f[0].menu === "0";
    const menuAt = firstAt(f, (x) => x.menu === "1");
    check(`${label}: the menu starts hidden and comes up`, hiddenFirst && menuAt !== null, `first ${f[0]?.menu}, up at ${menuAt}`);
    check(
      `${label}: the menu is up within ${LIMIT} ms of first paint`,
      menuAt !== null && fcp !== null && menuAt - fcp <= LIMIT + SLACK,
      `fcp ${fcp?.toFixed?.(0)} ms, menu ${menuAt} ms, ${menuAt !== null && fcp !== null ? (menuAt - fcp).toFixed(0) : "?"} ms`,
    );
    const splashAt = firstAt(f, (x) => x.splash === "1");
    check(`${label}: OTOHIME shows before the menu and is gone once it is up`, splashAt !== null && splashAt < menuAt && f.at(-1).splash === "0", `name at ${splashAt}, last ${f.at(-1)?.splash}`);
    const prints = distinct(f.filter((x) => x.splash === "1").map((x) => x.print));
    check(`${label}: the name types out in steps (clip-path)`, prints.length >= 3 && prints.some((p) => /inset/.test(p ?? "")), prints.join(" / "));
    check(`${label}: a scan line runs down the screen`, f.some((x) => x.scan === "1") && f.at(-1).scan === "0", distinct(f.map((x) => x.scan)).join(","));
    const lcd = distinct(f.map((x) => x.lcd));
    check(`${label}: the screen flickers on in steps`, lcd.length >= 3 && f.at(-1).lcd === "1", lcd.join(","));
    check(`${label}: the power lamp lights`, f[0].lamp === "0" && f.at(-1).lamp === "1", `${f[0].lamp} -> ${f.at(-1).lamp}`);
    const carts = distinct(f.map((x) => x.cart));
    check(`${label}: the cartridge clicks in from above`, carts.length >= 3 && ["none", "0px", "0px 0px"].includes(f.at(-1).cart), carts.join(" / "));
    check(`${label}: the cartridge stays inside the drawing`, f.every((x) => x.cartInside));
    const layouts = distinct(f.map((x) => x.layout));
    check(`${label}: the console's boxes hold still across the boot`, layouts.length === 1, layouts.join("  ≠  "));

    const t = b.timings ?? [];
    const moves = t.filter((x) => x.name !== "boot-show");
    check(
      `${label}: every boot animation is finite and ends within ${LIMIT} ms`,
      t.length >= 7 && t.every((x) => x.iterations === 1 && x.end <= LIMIT),
      t.map((x) => `${x.name}@${x.delay}+${x.active}`).join(" "),
    );
    check(`${label}: no boot movement runs over ${STEP} ms`, moves.length >= 6 && moves.every((x) => x.active <= STEP), moves.map((x) => `${x.name}:${x.active}`).join(" "));

    await sleep(200);
    const end = await frame(page);
    check(`${label}: done, the console is marked booted for the session`, end?.booted === true && (await stored(page)) === "1", `${end?.booted} ${await stored(page)}`);
    check(`${label}: no boot animation left`, (await running(page)) === 0);
    check(`${label}: the menu rests up, the name and scan line gone`, end?.menu === "1" && end?.splash === "0" && end?.scan === "0", JSON.stringify(end));
    check(`${label}: the resting layout matches the booting one`, end?.layout === layouts[0], `${end?.layout}`);
    const wide = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    check(`${label}: nothing scrolls sideways`, wide <= 0, `${wide} px over`);
    await shot(page, `${scheme}-${viewport.width}-booted`);

    // A reload in the same tab is the same session: no boot animation at all, the menu up at first paint.
    await page.reload({ waitUntil: "domcontentloaded" });
    const r0 = await boot(page);
    await waitSampling(page);
    const r = await boot(page);
    check(`${label}: reload: data-booted is on <html> before the body parses`, r0.dcl?.booted === true, JSON.stringify(r0.dcl));
    check(`${label}: reload: no boot animation starts (no delays either)`, r.events.length === 0 && r.timings === null, r.events.join(","));
    check(`${label}: reload: the menu is up from the first frame`, r.frames.length > 0 && r.frames.every((x) => x.menu === "1" && x.splash === "0"), `${r.frames[0]?.menu}`);
    check(`${label}: reload: the layout is the booting one`, distinct(r.frames.map((x) => x.layout)).join() === layouts[0], distinct(r.frames.map((x) => x.layout)).join("  ≠  "));
  } finally {
    await context.close();
  }
}

// One tab through a session: hops away and back, a new tab, the interrupted boots and the negative control.
async function session(browser) {
  const label = "session";
  const { context, page } = await open(browser, {});
  try {
    await page.goto(BASE_URL + "/", { waitUntil: "load" });
    await hydrated(page);
    await waitSampling(page);
    await sleep(200);
    check(`${label}: the first visit boots and marks the session`, (await stored(page)) === "1" && (await boot(page)).events.length > 0);

    await hop(page, "/work");
    await hopHome(page);
    await waitSampling(page);
    const back = await boot(page);
    check(`${label}: a client-side return to Home starts no boot animation`, back.events.length === 0, back.events.join(","));
    check(`${label}: and shows the menu from the first frame`, back.frames.length > 0 && back.frames.every((x) => x.menu === "1"), `${back.frames[0]?.menu}`);
    // the console takes the arrows only at the top of the page (the focused Pages link may have scrolled it)
    await page.evaluate(() => scrollTo({ top: 0, behavior: "instant" }));
    const before = await readout(page);
    await page.keyboard.press("ArrowDown");
    check(`${label}: the console still answers the keys`, before === "Press A to open work." && (await readout(page)) === "Press A to open play.", `${before} -> ${await readout(page)}`);

    // A new tab is a new session.
    const tab = await context.newPage();
    watch(tab, errors);
    await tab.goto(BASE_URL + "/", { waitUntil: "load" });
    await waitSampling(tab);
    const t = await boot(tab);
    check(`${label}: a new tab (new session) boots again`, t.dcl?.booted === false && t.events.some((e) => e === "animationstart:boot-cart") && t.frames[0]?.menu === "0", t.events.join(","));
    await tab.close();

    // Negative control: the same returning-visit assertion, with the pre-paint script stripped from the HTML.
    let stripped = 0;
    await page.route(BASE_URL + "/", async (route) => {
      const response = await route.fetch();
      const body = (await response.text()).replace(BOOT_SCRIPT_RE, () => {
        stripped++;
        return "";
      });
      await route.fulfill({ response, body });
    });
    page.removeAllListeners("console");
    page.removeAllListeners("pageerror");
    await page.reload({ waitUntil: "load" });
    await waitSampling(page);
    const neg = await boot(page);
    check(
      "negative: without the pre-paint script a returning visit is caught starting boot animations",
      stripped === 1 && !(neg.events.length === 0 && neg.timings === null),
      `stripped ${stripped}, events ${neg.events.length}`,
    );
    await page.unroute(BASE_URL + "/");
  } finally {
    await context.close();
  }
}

async function interrupted(browser) {
  // Console input mid-boot ends it at once.
  {
    const label = "interrupted by a key";
    const { context, page } = await open(browser, {});
    try {
      await page.goto(BASE_URL + "/", { waitUntil: "domcontentloaded" });
      await hydrated(page);
      const mid = await frame(page);
      await page.keyboard.press("ArrowDown");
      await sleep(80);
      const after = await frame(page);
      check(`${label}: the boot was still running when pressed`, mid?.booted === false && mid?.menu === "0", JSON.stringify(mid));
      check(`${label}: the menu shows at once and the session is marked`, after?.booted === true && after?.menu === "1" && after?.splash === "0" && (await stored(page)) === "1", JSON.stringify(after));
      check(`${label}: no boot animation left`, (await running(page)) === 0);
      check(`${label}: the press still moved the cursor`, (await readout(page)) === "Press A to open play.", await readout(page));
    } finally {
      await context.close();
    }
  }
  // Leaving Home mid-boot does not count as booted: the boot plays again, to the end.
  {
    const label = "interrupted by leaving";
    const { context, page } = await open(browser, {});
    try {
      await page.goto(BASE_URL + "/", { waitUntil: "domcontentloaded" });
      await hydrated(page);
      const mid = await frame(page);
      await hop(page, "/work");
      const away = { attr: await page.evaluate(() => document.documentElement.hasAttribute("data-booted")), stored: await stored(page) };
      check(`${label}: left before the menu came up, and not marked booted`, mid?.menu === "0" && away.attr === false && away.stored === null, `${JSON.stringify(mid?.menu)} ${JSON.stringify(away)}`);
      await hopHome(page);
      await waitSampling(page);
      const b = await boot(page);
      check(`${label}: back on Home the boot plays again`, b.events.includes("animationstart:boot-cart") && b.frames[0]?.menu === "0", b.events.join(","));
      const menuAt = firstAt(b.frames, (x) => x.menu === "1");
      check(`${label}: and ends with the menu up, marked booted`, menuAt !== null && (await stored(page)) === "1", `${menuAt}`);
    } finally {
      await context.close();
    }
  }
}

async function blocked(browser) {
  const label = "blocked storage";
  const sink = [];
  const { context, page } = await open(browser, { blockStorage: true, sink });
  try {
    await page.goto(BASE_URL + "/", { waitUntil: "load" });
    await hydrated(page);
    await waitSampling(page);
    await sleep(200);
    const end = await frame(page);
    check(`${label}: the boot plays and ends with the menu up`, (await boot(page)).events.length > 0 && end?.menu === "1" && end?.booted === true, JSON.stringify(end));
    await hop(page, "/work");
    await hopHome(page);
    await waitSampling(page);
    const back = await boot(page);
    check(`${label}: a client-side return to Home skips the boot`, back.events.length === 0 && back.frames.every((x) => x.menu === "1"), back.events.join(","));
    await page.reload({ waitUntil: "load" });
    await waitSampling(page);
    await sleep(200);
    const again = await boot(page);
    check(`${label}: a reload cannot remember, so the finite boot plays and ends usable`, again.events.length > 0 && (await frame(page))?.menu === "1");
    check(`${label}: no console errors or page errors`, sink.length === 0, sink.slice(0, 3).join(" | "));
  } finally {
    await context.close();
  }
}

async function noJs(browser) {
  const label = "JavaScript off";
  const { context, page } = await open(browser, { js: false });
  try {
    await page.goto(BASE_URL + "/", { waitUntil: "load" });
    const links = await page.locator('nav[aria-label="Pages"] a').evaluateAll((as) => as.map((a) => a.getAttribute("href")));
    check(`${label}: the menu's links are in the HTML`, links.join() === MENU.join(), links.join());
    await sleep(SETTLE);
    const end = await page.evaluate(() => {
      const sec = document.querySelector('section[aria-label="Pocket console"]');
      const o = (sel) => getComputedStyle(sec.querySelector(sel)).opacity;
      return { menu: o("g.boot"), splash: o("g.splash"), scan: o(".boot-scan") };
    });
    check(`${label}: the CSS boot still ends on the menu`, end.menu === "1" && end.splash === "0" && end.scan === "0", JSON.stringify(end));
    const focusable = await page.locator('nav[aria-label="Pages"] a').first().evaluate((a) => (a.focus(), document.activeElement === a && a.checkVisibility()));
    check(`${label}: the first menu link takes focus and shows`, focusable);
  } finally {
    await context.close();
  }
}

async function reducedMotion(browser) {
  {
    const label = "reduced motion";
    const { context, page } = await open(browser, { reduced: true, sound: "on" });
    try {
      // Start on another page, so the hop to Home carries a click: the chime would be allowed but for the preference.
      await page.goto(BASE_URL + "/work", { waitUntil: "load" });
      await page.waitForTimeout(300);
      await hopHome(page);
      await waitSampling(page);
      const b = await boot(page);
      check(`${label}: the menu is up from the first frame`, b.frames.length > 0 && b.frames.every((x) => x.menu === "1" && x.splash === "0" && x.scan === "0"), `${b.frames[0]?.menu}`);
      check(`${label}: marked booted`, (await stored(page)) === "1");
      const a = await audio(page);
      check(`${label}: no chime`, a.starts === 0, JSON.stringify(a));
      await page.goto(BASE_URL + "/", { waitUntil: "domcontentloaded" });
      const f = await frame(page);
      check(`${label}: a reload shows the menu`, f?.menu === "1", JSON.stringify(f));
    } finally {
      await context.close();
    }
  }
  {
    const label = "reduced motion turned on mid-boot";
    const { context, page } = await open(browser, {});
    try {
      await page.goto(BASE_URL + "/", { waitUntil: "domcontentloaded" });
      await hydrated(page);
      const mid = await frame(page);
      await page.emulateMedia({ reducedMotion: "reduce" });
      await sleep(150);
      const after = await frame(page);
      check(`${label}: the menu shows at once and the session is marked`, mid?.menu === "0" && after?.menu === "1" && after?.splash === "0" && (await stored(page)) === "1", `${mid?.menu} -> ${JSON.stringify(after)}`);
    } finally {
      await context.close();
    }
  }
}

async function chime(browser) {
  // A cold load never chimes, sound on or not. Playwright's evaluate and waitForFunction run as a user gesture,
  // which would hand the page the sticky activation a cold load lacks, so nothing is evaluated until the boot is
  // over; the page notes its own activation when the name prints.
  {
    const { context, page } = await open(browser, { sound: "on" });
    try {
      await page.addInitScript(() => setTimeout(() => (window.__activeAtPrint = navigator.userActivation?.hasBeenActive), 1700));
      await page.goto(BASE_URL + "/", { waitUntil: "load" });
      await sleep(SETTLE + 300);
      const a = await audio(page);
      const active = await page.evaluate(() => window.__activeAtPrint);
      check("audio: a cold load with sound on stays silent (no AudioContext)", active === false && a.made === 0 && a.starts === 0, `${JSON.stringify(a)}, activation at print ${active}`);
    } finally {
      await context.close();
    }
  }
  // A boot reached by a click: the chime with sound on, nothing with it off.
  for (const sound of ["on", "off"]) {
    const { context, page } = await open(browser, { sound });
    try {
      await page.goto(BASE_URL + "/work", { waitUntil: "load" });
      await page.waitForTimeout(300);
      await hopHome(page);
      await waitSampling(page);
      const a = await audio(page);
      if (sound === "on") {
        check("audio: sound on, a boot after a click plays the four-note chime", a.made === 1 && a.starts === 4, JSON.stringify(a));
        await hop(page, "/work");
        await hopHome(page);
        await waitSampling(page);
        const again = await audio(page);
        check("audio: the returning visit does not chime again", again.starts === a.starts, JSON.stringify(again));
      } else {
        check("audio: sound off, the same boot is silent (no AudioContext)", a.made === 0 && a.starts === 0, JSON.stringify(a));
      }
    } finally {
      await context.close();
    }
  }
}

const browser = await chromium.launch();
try {
  if (EXPECT_SHA) {
    const html = await (await fetch(BASE_URL + "/")).text();
    const sha = html.match(/<meta name="build-sha" content="([^"]*)"/)?.[1] ?? "none";
    check(`build-sha is ${EXPECT_SHA}`, sha === EXPECT_SHA, sha);
  }
  for (const viewport of [DESKTOP, PHONE]) for (const scheme of ["light", "dark"]) await fresh(browser, viewport, scheme);
  await session(browser);
  await interrupted(browser);
  await blocked(browser);
  await noJs(browser);
  await reducedMotion(browser);
  await chime(browser);
  check("no console errors or page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
} finally {
  await browser.close();
}

console.log(`probe: ${ok} ok, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
