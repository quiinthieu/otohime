// Drives headless Chromium over the masthead's speaker and the console's beeps. Run by scripts/probe-sound.sh,
// which installs Playwright into PW_PREFIX and passes BASE_URL (and EXPECT_SHA, checked if set).
//
// An init script wraps AudioContext before any page script, so window.__audio counts every context made, resume,
// close and oscillator start, with the start's wave type and the highest gain any ramp asks for. Modes: "normal"
// (the real context), "blocked" (state stays suspended and resume() rejects, as when autoplay is refused),
// "throws" (the constructor throws) and "eager" (the negative control: the page opens a context at load).
// Every press is real input (keyboard or a click/tap on the real button), so it carries user activation.
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
const CAP = 10 ** (-18 / 20); // -18 dB
const LABEL = "Console sounds";

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

function spy({ mode, theme, blockStorage }) {
  if (theme) {
    try {
      localStorage.setItem("theme", theme);
    } catch {
      // the blocked-storage context sets no theme
    }
  }
  if (blockStorage) {
    const deny = () => {
      throw new DOMException("probe: storage denied", "SecurityError");
    };
    Object.defineProperty(window, "localStorage", { configurable: true, get: deny });
  }
  const a = (window.__audio = { made: 0, resumes: 0, closed: 0, starts: 0, types: [], peak: 0 });
  const Real = window.AudioContext;
  if (!Real) return;
  const ramp = AudioParam.prototype.linearRampToValueAtTime;
  AudioParam.prototype.linearRampToValueAtTime = function (value, time) {
    a.peak = Math.max(a.peak, value);
    return ramp.call(this, value, time);
  };
  const start = OscillatorNode.prototype.start;
  OscillatorNode.prototype.start = function (...args) {
    a.starts++;
    a.types.push(this.type);
    return start.apply(this, args);
  };
  class Spy extends Real {
    constructor(...args) {
      if (mode === "throws") throw new DOMException("probe: no audio here", "NotSupportedError");
      super(...args);
      a.made++;
    }
    get state() {
      return mode === "blocked" ? "suspended" : super.state;
    }
    resume() {
      a.resumes++;
      if (mode === "blocked") return Promise.reject(new DOMException("probe: autoplay refused", "NotAllowedError"));
      return super.resume();
    }
    close() {
      a.closed++;
      return super.close();
    }
  }
  window.AudioContext = Spy;
  if (mode === "eager") addEventListener("DOMContentLoaded", () => void new window.AudioContext());
}

async function open(browser, { viewport, mode = "normal", theme = null, blockStorage = false, js = true, sink = errors }) {
  const phone = viewport === PHONE;
  const context = await browser.newContext({ viewport, isMobile: phone, hasTouch: phone, javaScriptEnabled: js });
  const page = await context.newPage();
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    const from = m.location().url;
    sink.push(`console ${page.url()}: ${m.text()}${from && from !== page.url() ? ` (${from})` : ""}`);
  });
  page.on("pageerror", (e) => sink.push(`pageerror ${page.url()}: ${e.message}`));
  await page.addInitScript(spy, { mode, theme, blockStorage });
  return { context, page, phone };
}

const audio = (page) => page.evaluate(() => ({ ...window.__audio, types: [...window.__audio.types] }));
// After a client-side hop Next keeps the old route mounted and hidden, so only the visible speaker counts.
const toggle = (page) => page.locator("button.sound-toggle:visible");
const pressed = (page) => toggle(page).getAttribute("aria-pressed");
const stored = (page) =>
  page.evaluate(() => {
    try {
      return localStorage.getItem("sound");
    } catch {
      return "blocked";
    }
  });
const readout = (page) =>
  page.evaluate(() => [...document.querySelectorAll(".readout")].map((p) => p.textContent).find((t) => /^Press A to open/.test(t ?? "")) ?? "");

// Hydrated: React has attached to the speaker.
async function load(page, url = "/") {
  await page.goto(BASE_URL + url, { waitUntil: "load" });
  await page.waitForFunction(() => {
    const b = document.querySelector("button.sound-toggle");
    return b && Object.keys(b).some((k) => k.startsWith("__reactProps"));
  }, null, { timeout: 15000 });
  await page.waitForTimeout(150);
}

// The masthead's parts, rounded to 0.5 px.
const boxes = (page) =>
  page.evaluate(() => {
    const r = (el) => {
      if (!el) return null;
      const b = el.getBoundingClientRect();
      const q = (v) => Math.round(v * 2) / 2;
      return [q(b.x), q(b.y), q(b.width), q(b.height)].join(",");
    };
    const head = [...document.querySelectorAll("header.masthead")].find((h) => h.checkVisibility());
    return {
      masthead: r(head),
      brand: r(head?.firstElementChild),
      sound: r(head?.querySelector(".sound-toggle")),
      theme: r(head?.querySelector(".theme-toggle")),
    };
  });
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// One press of the console: the Down key on desktop, the Down chip on a phone.
async function down(page, phone) {
  if (phone) await page.getByRole("button", { name: "▼ Down" }).tap();
  else await page.keyboard.press("ArrowDown");
  await page.waitForTimeout(120);
}
async function tapToggle(page, phone) {
  if (phone) await toggle(page).tap();
  else await toggle(page).click();
  await page.waitForTimeout(200);
}

const browser = await chromium.launch();
try {
  if (EXPECT_SHA) {
    const html = await (await fetch(BASE_URL + "/")).text();
    const sha = html.match(/<meta name="build-sha" content="([^"]*)"/)?.[1] ?? "none";
    check(`build-sha is ${EXPECT_SHA}`, sha === EXPECT_SHA, sha);
  }

  for (const viewport of [DESKTOP, PHONE]) {
    const size = viewport === PHONE ? "390x844" : "1366x768";
    const { context, page, phone } = await open(browser, { viewport });
    try {
      await load(page);
      const name = await toggle(page).getAttribute("aria-label");
      check(`${size}: the speaker is a button named "${LABEL}"`, (await toggle(page).count()) === 1 && name === LABEL, name ?? "none");
      check(`${size}: the speaker starts off (aria-pressed=false)`, (await pressed(page)) === "false", String(await pressed(page)));
      const first = await boxes(page);
      check(`${size}: the speaker is 32x32 beside the theme toggle`, /,32,32$/.test(first.sound ?? "") && /,32,32$/.test(first.theme ?? ""), JSON.stringify(first));
      check(`${size}: no AudioContext at load`, (await audio(page)).made === 0, JSON.stringify(await audio(page)));

      const before = await readout(page);
      await down(page, phone);
      const moved = await readout(page);
      check(`${size}: Down with sound off moves the cursor`, moved !== before && moved !== "", `${before} -> ${moved}`);
      check(`${size}: console input with sound off makes no AudioContext`, (await audio(page)).made === 0, JSON.stringify(await audio(page)));

      await tapToggle(page, phone);
      const on = await audio(page);
      check(`${size}: enabling sets aria-pressed=true`, (await pressed(page)) === "true");
      check(`${size}: enabling makes exactly one AudioContext and beeps`, on.made === 1 && on.starts > 0, JSON.stringify(on));
      check(`${size}: localStorage.sound is "on"`, (await stored(page)) === "on", String(await stored(page)));
      check(`${size}: the masthead does not move when sound turns on`, same(first, await boxes(page)), JSON.stringify([first, await boxes(page)]));

      await down(page, phone);
      const moveCue = await audio(page);
      check(`${size}: Down beeps on the same context`, moveCue.made === 1 && moveCue.starts > on.starts, JSON.stringify(moveCue));
      check(`${size}: every note is a square wave`, moveCue.types.length > 0 && moveCue.types.every((t) => t === "square"), moveCue.types.join(","));
      check(`${size}: no ramp asks for more than -18 dB`, moveCue.peak > 0 && moveCue.peak <= CAP + 1e-9, String(moveCue.peak));

      // A: the cue sounds before the console navigates.
      const where = page.url();
      if (phone) await page.getByRole("button", { name: "A Open" }).tap();
      else await page.keyboard.press("a");
      await page.waitForTimeout(100);
      const openCue = await audio(page);
      check(`${size}: A beeps on the same context`, openCue.made === 1 && openCue.starts > moveCue.starts, JSON.stringify(openCue));
      await page.waitForURL((u) => u.href !== where, { timeout: 5000 }).catch(() => {});
      check(`${size}: A still opens the page`, page.url() !== where, page.url());
      await page.waitForTimeout(300);
      check(`${size}: the speaker stays on across the hop`, (await pressed(page)) === "true");

      // Reload: remembered, and still no context until a press.
      await load(page);
      check(`${size}: the choice survives a reload`, (await pressed(page)) === "true");
      check(`${size}: no AudioContext after reload before a press`, (await audio(page)).made === 0, JSON.stringify(await audio(page)));
      const reloaded = await boxes(page);
      check(`${size}: the masthead is where it was with sound on after reload`, same(first, reloaded), JSON.stringify([first, reloaded]));
      await down(page, phone);
      const after = await audio(page);
      check(`${size}: the first press after reload makes one context and beeps`, after.made === 1 && after.starts > 0, JSON.stringify(after));

      // Off: silent from then on.
      await tapToggle(page, phone);
      check(`${size}: switching off sets aria-pressed=false and stores "off"`, (await pressed(page)) === "false" && (await stored(page)) === "off", String(await stored(page)));
      const off = await audio(page);
      await down(page, phone);
      await down(page, phone);
      const silent = await audio(page);
      check(`${size}: no beep once switched off`, silent.starts === off.starts && silent.made === off.made, JSON.stringify([off, silent]));
      check(`${size}: the masthead does not move when sound turns off`, same(first, await boxes(page)));

      // pagehide closes the context; the next press after turning it on makes a fresh one.
      await page.evaluate(() => dispatchEvent(new PageTransitionEvent("pagehide", { persisted: true })));
      await page.waitForTimeout(50);
      check(`${size}: pagehide closes the context`, (await audio(page)).closed === 1, JSON.stringify(await audio(page)));
      await tapToggle(page, phone);
      const fresh = await audio(page);
      check(`${size}: after pagehide a press opens one new context`, fresh.made === 2 && fresh.starts > silent.starts, JSON.stringify(fresh));

      // Keyboard focus on the speaker shows a ring.
      if (!phone) {
        await toggle(page).focus();
        await page.keyboard.press("Shift+Tab");
        await page.keyboard.press("Tab");
        const ring = await toggle(page).evaluate((b) => {
          const s = getComputedStyle(b);
          return { focused: b.matches(":focus-visible"), outline: s.outlineStyle, width: s.outlineWidth };
        });
        check(`${size}: the speaker shows a keyboard focus ring`, ring.focused && ring.outline !== "none" && ring.width !== "0px", JSON.stringify(ring));
        await page.keyboard.press("Enter");
        await page.waitForTimeout(150);
        check(`${size}: Enter on the speaker toggles it`, (await pressed(page)) === "false", String(await pressed(page)));
      }
    } finally {
      await context.close();
    }
  }

  // Blocked storage: off at load, toggles for this page, forgets on reload, no error.
  for (const viewport of [DESKTOP, PHONE]) {
    const size = viewport === PHONE ? "390x844" : "1366x768";
    const { context, page, phone } = await open(browser, { viewport, blockStorage: true });
    try {
      await load(page);
      check(`${size} blocked storage: the speaker starts off`, (await pressed(page)) === "false");
      await tapToggle(page, phone);
      const a = await audio(page);
      check(`${size} blocked storage: the speaker still turns on and beeps`, (await pressed(page)) === "true" && a.made === 1 && a.starts > 0, JSON.stringify(a));
      const before = await readout(page);
      await down(page, phone);
      check(`${size} blocked storage: the console still moves`, (await readout(page)) !== before);
      await load(page);
      check(`${size} blocked storage: a reload is off again`, (await pressed(page)) === "false");
    } finally {
      await context.close();
    }
  }

  // Autoplay refused, and no Web Audio at all: silent, usable, no error.
  for (const mode of ["blocked", "throws"]) {
    const what = mode === "blocked" ? "refused resume" : "throwing AudioContext";
    const { context, page } = await open(browser, { viewport: DESKTOP, mode });
    try {
      await load(page);
      await tapToggle(page, false);
      check(`${what}: the speaker still turns on`, (await pressed(page)) === "true");
      const before = await readout(page);
      await down(page, false);
      const a = await audio(page);
      check(`${what}: nothing plays`, a.starts === 0, JSON.stringify(a));
      if (mode === "blocked") check(`${what}: the press asked to resume`, a.resumes > 0, JSON.stringify(a));
      check(`${what}: the console still moves`, (await readout(page)) !== before);
      const where = page.url();
      await page.keyboard.press("a");
      await page.waitForURL((u) => u.href !== where, { timeout: 5000 }).catch(() => {});
      check(`${what}: A still opens the page`, page.url() !== where, page.url());
      await tapToggle(page, false);
      check(`${what}: the speaker still turns off`, (await pressed(page)) === "false");
    } finally {
      await context.close();
    }
  }

  // Both themes at both sizes: the speaker fits, reads in ink, and the masthead is the same with and without JS.
  for (const viewport of [DESKTOP, PHONE]) {
    for (const theme of ["light", "dark"]) {
      const size = viewport === PHONE ? "390x844" : "1366x768";
      const label = `${size} ${theme}`;
      const nojs = await open(browser, { viewport, theme, js: false });
      let still;
      try {
        await nojs.page.goto(BASE_URL + "/", { waitUntil: "load" });
        still = await boxes(nojs.page);
      } finally {
        await nojs.context.close();
      }
      const { context, page, phone } = await open(browser, { viewport, theme });
      try {
        await load(page);
        const live = await boxes(page);
        check(`${label}: the masthead is the same with and without JavaScript`, same(still, live), JSON.stringify([still, live]));
        const look = await page.evaluate(() => {
          const b = document.querySelector("button.sound-toggle");
          const shown = (sel) => getComputedStyle(b.querySelector(sel)).display !== "none";
          const r = b.getBoundingClientRect();
          return {
            theme: document.documentElement.dataset.theme,
            color: getComputedStyle(b).color,
            ink: getComputedStyle(document.body).color,
            waves: shown(".sound-waves"),
            cross: shown(".sound-off"),
            inside: r.left >= 0 && r.right <= innerWidth,
            overflow: document.documentElement.scrollWidth - innerWidth,
          };
        });
        check(`${label}: the theme applied`, look.theme === theme, String(look.theme));
        check(`${label}: off shows the cross, not the waves`, look.cross && !look.waves, JSON.stringify(look));
        check(`${label}: the speaker is drawn in the page's ink`, look.color === look.ink, `${look.color} vs ${look.ink}`);
        check(`${label}: the speaker is inside the viewport, no page overflow`, look.inside && look.overflow <= 0, JSON.stringify(look));
        if (SHOTS) {
          mkdirSync(SHOTS, { recursive: true });
          await page.screenshot({ path: path.join(SHOTS, `${size}-${theme}-off.png`), clip: { x: 0, y: 0, width: viewport.width, height: 80 } });
        }
        await tapToggle(page, phone);
        const on = await page.evaluate(() => {
          const b = document.querySelector("button.sound-toggle");
          const shown = (sel) => getComputedStyle(b.querySelector(sel)).display !== "none";
          return { waves: shown(".sound-waves"), cross: shown(".sound-off") };
        });
        check(`${label}: on shows the waves, not the cross`, on.waves && !on.cross, JSON.stringify(on));
        check(`${label}: the masthead does not move when toggled`, same(live, await boxes(page)), JSON.stringify([live, await boxes(page)]));
        if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `${size}-${theme}-on.png`), clip: { x: 0, y: 0, width: viewport.width, height: 80 } });
      } finally {
        await context.close();
      }
    }
  }

  // Negative: a page that opens a context at load fails the same no-context assertion.
  {
    const { context, page } = await open(browser, { viewport: DESKTOP, mode: "eager", sink: [] });
    try {
      await load(page);
      const a = await audio(page);
      check("negative: an eager AudioContext at load is caught by the no-context check", !(a.made === 0), JSON.stringify(a));
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
