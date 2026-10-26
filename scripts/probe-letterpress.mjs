// Drives headless Chromium over the letterpress keys and their press cue. Run by scripts/probe-letterpress.sh, which
// installs Playwright and axe-core into PW_PREFIX and passes BASE_URL.
//
// An init script replaces AudioContext with a fake before any page script, so window.__audio counts every context
// made and every oscillator start with its wave and pitch; the fake is always "running", so a cue is scheduled at
// once. The same script cancels the default action of a click on a link (window, capture: it runs first and stops
// nothing else), so a key's press is heard without the page leaving. Clicks are real mouse input except the throttle
// pair, which is two element.click() calls in one task so they are certainly inside 60 ms.
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(path.join(process.env.PW_PREFIX, "package.json"));
const { chromium } = require("playwright");
const AXE_PATH = require.resolve("axe-core/axe.min.js");

const BASE_URL = process.env.BASE_URL;
const PAGES = ["/", "/play", "/projects", "/notes"];
const PHONE = { width: 390, height: 844 };
const DESKTOP = { width: 1366, height: 768 };
const KEYS = ".btn, .nav-item";
// lib/sound.ts: press is a triangle at 140 Hz then 90 Hz; the speaker's "open" is square 660 then 990.
const PRESS = [140, 90];
const OPEN = [660, 990];

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
const size = (viewport) => (viewport === PHONE ? "390x844" : "1366x768");

function fake({ sound, theme }) {
  try {
    if (sound) localStorage.setItem("sound", sound);
    if (theme) localStorage.setItem("theme", theme);
  } catch {
    // storage blocked: nothing to preset
  }
  const a = (window.__audio = { made: 0, starts: [] });
  const param = () => ({ value: 0, setValueAtTime() {}, linearRampToValueAtTime() {} });
  const node = () => ({ connect: (next) => next, disconnect() {} });
  class FakeAudioContext {
    constructor() {
      a.made++;
      this.state = "running";
      this.currentTime = 0;
      this.destination = node();
    }
    createOscillator() {
      const osc = {
        ...node(),
        type: "sine",
        frequency: param(),
        onended: null,
        start: () => a.starts.push({ type: osc.type, hz: osc.frequency.value }),
        stop() {},
      };
      return osc;
    }
    createGain() {
      return { ...node(), gain: param() };
    }
    resume() {
      this.state = "running";
      return Promise.resolve();
    }
    suspend() {
      this.state = "suspended";
      return Promise.resolve();
    }
    close() {
      this.state = "closed";
      return Promise.resolve();
    }
  }
  window.AudioContext = FakeAudioContext;
  addEventListener(
    "click",
    (event) => {
      if (event.target instanceof Element && event.target.closest("a[href]")) event.preventDefault();
    },
    true,
  );
}

async function open(browser, { viewport = DESKTOP, sound = null, theme = null, reduced = false, forced = false } = {}) {
  const phone = viewport === PHONE;
  const context = await browser.newContext({
    viewport,
    isMobile: phone,
    hasTouch: phone,
    reducedMotion: reduced ? "reduce" : "no-preference",
    forcedColors: forced ? "active" : "none",
  });
  const page = await context.newPage();
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`console ${page.url()}: ${m.text()}`);
  });
  page.on("pageerror", (e) => errors.push(`pageerror ${page.url()}: ${e.message}`));
  await page.addInitScript(fake, { sound, theme });
  return { context, page };
}

// Hydrated: React has attached to the speaker, so the press listener is mounted too.
async function load(page, url) {
  await page.goto(BASE_URL + url, { waitUntil: "load" });
  await page.waitForFunction(
    () => {
      const b = document.querySelector("button.sound-toggle");
      return b && Object.keys(b).some((k) => k.startsWith("__reactProps"));
    },
    null,
    { timeout: 20000 },
  );
  await page.waitForTimeout(300);
}

const audio = (page) => page.evaluate(() => ({ made: window.__audio.made, starts: window.__audio.starts.map((s) => ({ ...s })) }));
const since = async (page, before) => (await audio(page)).starts.slice(before.starts.length);
const cues = (starts, hz) => {
  // Starts read as whole cues of `hz`, in order; null when they do not.
  if (starts.length % hz.length !== 0) return null;
  for (let i = 0; i < starts.length; i++) if (starts[i].hz !== hz[i % hz.length]) return null;
  return starts.length / hz.length;
};
const isPress = (starts, n) => cues(starts, PRESS) === n && starts.every((s) => s.type === "triangle");
const show = (starts) => starts.map((s) => `${s.type}@${s.hz}`).join(",") || "none";

// Every key on the page: its inset shadow, its grain, its border widths.
const keys = (page) =>
  page.evaluate((sel) => {
    return [...document.querySelectorAll(sel)].map((el) => {
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return {
        shown: el.checkVisibility() && r.width > 1 && r.height > 1,
        what: `${el.tagName.toLowerCase()}.${[...el.classList].join(".")} "${(el.textContent ?? "").trim().slice(0, 24)}"`,
        btn: el.classList.contains("btn"),
        shadow: cs.boxShadow,
        grain: cs.backgroundImage,
        border: [cs.borderTopWidth, cs.borderRightWidth, cs.borderBottomWidth, cs.borderLeftWidth].join(" "),
        styled: cs.borderTopStyle,
      };
    });
  }, KEYS);
const grained = (k) => /data:image\/svg\+xml/.test(k.grain) && /feTurbulence/.test(k.grain);

async function styles(browser) {
  for (const viewport of [DESKTOP, PHONE]) {
    for (const url of PAGES) {
      const { context, page } = await open(browser, { viewport });
      try {
        await load(page, url);
        const all = await keys(page);
        const flat = all.filter((k) => !/inset/.test(k.shadow));
        const plain = all.filter((k) => !grained(k));
        check(`${size(viewport)} ${url}: every key (${all.length}) has an inset shadow`, all.length > 0 && flat.length === 0, JSON.stringify(flat.slice(0, 3)));
        check(`${size(viewport)} ${url}: every key (${all.length}) wears the grain`, all.length > 0 && plain.length === 0, JSON.stringify(plain.slice(0, 3).map((k) => k.what)));
      } finally {
        await context.close();
      }
    }
  }
}

// The y of a computed translate ("none", "0px", "0px 1px").
const ty = (t) => (t === "none" ? 0 : parseFloat(t.split(" ")[1] ?? "0"));

async function presses(browser) {
  for (const reduced of [false, true]) {
    const { context, page } = await open(browser, { reduced });
    const name = reduced ? "reduced motion" : "1366x768";
    try {
      await load(page, "/projects");
      for (const sel of [".appnav .nav-item:not([aria-current])", ".masthead .btn"]) {
        const key = page.locator(sel).first();
        await key.hover();
        const rest = await key.evaluate((el) => getComputedStyle(el).translate);
        await page.mouse.down();
        await page.waitForTimeout(200);
        const held = await key.evaluate((el) => ({ t: getComputedStyle(el).translate, active: el.matches(":active") }));
        await page.mouse.up();
        const want = reduced ? 0 : 1;
        check(`${name}: a held ${sel} sits ${want}px down (rest ${rest}, held ${held.t})`, held.active && ty(rest) === 0 && ty(held.t) === want, JSON.stringify({ rest, held }));
      }
    } finally {
      await context.close();
    }
  }
}

async function sounds(browser) {
  for (const viewport of [DESKTOP, PHONE]) {
    const s = size(viewport);
    const tap = (locator) => (viewport === PHONE ? locator.tap() : locator.click());
    // Sound on: each key kind sounds one press.
    {
      const { context, page } = await open(browser, { viewport, sound: "on" });
      try {
        await load(page, "/projects");
        const targets = [
          ["a button", page.locator(".masthead .btn:visible").first()],
          ["a nav item", page.locator(".nav-item:visible:not([aria-current])").first()],
          ["a cartridge title", page.locator(".cartridge .project-title:visible").first()],
        ];
        for (const [what, locator] of targets) {
          const before = await audio(page);
          await tap(locator);
          await page.waitForTimeout(120);
          const heard = await since(page, before);
          check(`${s} sound on: ${what} starts one press cue (triangle 140, 90)`, isPress(heard, 1), show(heard));
        }
        check(`${s} sound on: the presses share one AudioContext`, (await audio(page)).made === 1, String((await audio(page)).made));
        check(`${s} sound on: nothing left the page`, new URL(page.url()).pathname === "/projects", page.url());

        const key = ".nav-item:not([aria-current])";
        let before = await audio(page);
        await page.evaluate((sel) => {
          const el = [...document.querySelectorAll(sel)].find((e) => e.checkVisibility());
          el.click();
          el.click();
        }, key);
        let heard = await since(page, before);
        check(`${s} sound on: two clicks inside 60 ms start one press`, isPress(heard, 1), show(heard));
        await page.waitForTimeout(120); // clear of the pair above, so its throttle does not swallow the next click
        before = await audio(page);
        await page.evaluate(async (sel) => {
          const el = [...document.querySelectorAll(sel)].find((e) => e.checkVisibility());
          el.click();
          await new Promise((r) => setTimeout(r, 120));
          el.click();
        }, key);
        heard = await since(page, before);
        check(`${s} sound on: two clicks 120 ms apart start two presses`, isPress(heard, 2), show(heard));
      } finally {
        await context.close();
      }
    }
    // Controls with their own sound: the speaker plays only its "open"; the pocket console's menu links play nothing.
    for (const strip of [false, true]) {
      const { context, page } = await open(browser, { viewport });
      try {
        await load(page, "/");
        if (strip) await page.evaluate(() => document.querySelectorAll("[data-own-sound]").forEach((el) => el.removeAttribute("data-own-sound")));
        let before = await audio(page);
        await tap(page.locator("button.sound-toggle:visible"));
        await page.waitForTimeout(150);
        const toggled = await since(page, before);
        const onlyOpen = cues(toggled, OPEN) === 1 && toggled.every((t) => t.type === "square");
        if (!strip) check(`${s}: turning sound on starts only the speaker's "open"`, onlyOpen, show(toggled));

        const link = page.locator('section[aria-label="Pocket console"] nav .btn').first();
        await link.focus(); // the menu links show when tabbed to
        await page.waitForTimeout(100);
        before = await audio(page);
        await tap(link);
        await page.waitForTimeout(150);
        const own = await since(page, before);
        const silent = own.length === 0;
        if (!strip) check(`${s}: a key inside the pocket console (own sound) starts no press`, silent, show(own));
        // The negative control: without the marks, the same check sees the press it guards against.
        else check(`${s} negative control: with data-own-sound stripped the console's key presses, and the check catches it`, !silent && isPress(own, 1), show(own));
      } finally {
        await context.close();
      }
    }
    // Sound off: nothing at all.
    {
      const { context, page } = await open(browser, { viewport, sound: "off" });
      try {
        await load(page, "/projects");
        for (const sel of [".masthead .btn:visible", ".nav-item:visible:not([aria-current])", ".cartridge .project-title:visible"]) {
          await tap(page.locator(sel).first());
          await page.waitForTimeout(80);
        }
        const a = await audio(page);
        check(`${s} sound off: a button, a nav item and a cartridge title make no context and start nothing`, a.made === 0 && a.starts.length === 0, JSON.stringify(a));
      } finally {
        await context.close();
      }
    }
  }
}

async function contrast(browser) {
  for (const theme of ["light", "dark"]) {
    for (const url of PAGES) {
      // Reduced motion, so nothing is caught halfway through its rise.
      const { context, page } = await open(browser, { theme, reduced: true });
      try {
        await load(page, url);
        await page.addScriptTag({ path: AXE_PATH });
        const result = await page.evaluate(async () => {
          const r = await window.axe.run(document, { runOnly: { type: "rule", values: ["color-contrast"] } });
          return {
            violations: r.violations.flatMap((v) => v.nodes.map((n) => `${n.target.join(" ")}: ${n.any[0]?.message ?? ""}`)),
            passes: r.passes.reduce((n, v) => n + v.nodes.length, 0),
            incomplete: r.incomplete.reduce((n, v) => n + v.nodes.length, 0),
          };
        });
        check(`${theme} ${url}: axe color-contrast finds nothing (${result.passes} pass, ${result.incomplete} to judge by eye)`, result.violations.length === 0, result.violations.slice(0, 3).join(" | "));
      } finally {
        await context.close();
      }
    }
  }
}

async function forcedColours(browser) {
  for (const viewport of [DESKTOP, PHONE]) {
    for (const url of PAGES) {
      const normal = await open(browser, { viewport });
      const forced = await open(browser, { viewport, forced: true });
      try {
        await load(normal.page, url);
        await load(forced.page, url);
        const plain = await keys(normal.page);
        const high = await keys(forced.page);
        const name = `${size(viewport)} ${url} forced colours`;
        const dressed = high.filter((k) => k.shadow !== "none" || k.grain !== "none");
        check(`${name}: every key (${high.length}) drops its shadow and grain`, high.length > 0 && dressed.length === 0, JSON.stringify(dressed.slice(0, 2)));
        const lost = high.filter((k, i) => plain[i] && k.border !== plain[i].border);
        check(`${name}: every key keeps its borders`, high.length === plain.length && lost.length === 0, JSON.stringify(lost.slice(0, 2).map((k) => k.what)));
        // An sr-only key (the skip link until focused) has no border in any mode, so only keys on screen count.
        const bare = high.filter((k) => k.btn && k.shown && (k.styled === "none" || /^0px/.test(k.border)));
        check(`${name}: every button on screen (${high.filter((k) => k.btn && k.shown).length}) shows a border`, bare.length === 0, JSON.stringify(bare.slice(0, 2).map((k) => k.what)));
      } finally {
        await normal.context.close();
        await forced.context.close();
      }
    }
  }
}

const browser = await chromium.launch();
try {
  await styles(browser);
  await presses(browser);
  await sounds(browser);
  await contrast(browser);
  await forcedColours(browser);
  check("no console errors or page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
} finally {
  await browser.close();
}

console.log(`probe: ${ok} ok, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
