// t-1562 QA (run-8975): an independent real-Chrome probe of the palace's sea sound. Unlike the SWE's probe-sound.mjs
// it measures the signal itself: every connect() to an AudioContext's destination is mirrored into an AnalyserNode,
// so "silent" and "playing" are RMS readings of the real Web Audio graph, not status attributes.
// Run: TMPDIR=/tmp BASE_URL=http://localhost:4075 node probe-signal.mjs (from a checkout with node_modules).
import { chromium } from "playwright-core";
import assert from "node:assert/strict";

const BASE = process.env.BASE_URL ?? "http://localhost:4075";
const log = (...a) => console.log(...a);
const browser = await chromium.launch({ channel: "chrome", args: ["--autoplay-policy=user-gesture-required"] });

const TAP = () => {
  const C = window.AudioContext;
  if (!C) return;
  window.__ctxs = [];
  const connect = AudioNode.prototype.connect;
  AudioNode.prototype.connect = function (to, ...rest) {
    const r = connect.call(this, to, ...rest);
    if (to instanceof AudioDestinationNode) {
      const ctx = this.context;
      if (!ctx.__tap) {
        ctx.__tap = ctx.createAnalyser();
        ctx.__tap.fftSize = 2048;
      }
      connect.call(this, ctx.__tap);
    }
    return r;
  };
  window.AudioContext = class extends C {
    constructor(...a) {
      super(...a);
      window.__ctxs.push(this);
    }
  };
  window.__rms = () =>
    window.__ctxs.map((c) => {
      if (!c.__tap || c.state === "closed") return { state: c.state, rms: 0 };
      const buf = new Float32Array(c.__tap.fftSize);
      c.__tap.getFloatTimeDomainData(buf);
      return { state: c.state, rms: Math.sqrt(buf.reduce((s, x) => s + x * x, 0) / buf.length) };
    });
};

async function rig({ noAudio = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  if (noAudio) await ctx.addInitScript(() => { delete window.AudioContext; delete window.webkitAudioContext; });
  else await ctx.addInitScript(TAP);
  ctx.on("page", (p) => {
    p.on("pageerror", (e) => errors.push(String(e)));
    p.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  });
  return { ctx, errors };
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const rms = (page) => page.evaluate(() => (window.__rms ? window.__rms() : null));
const status = (page) => page.getAttribute("[data-ambience]", "data-ambience");
const hydrated = (page) => page.waitForFunction(() => document.querySelector("[data-ambience]") && document.querySelector(".sound"), null, { timeout: 15000 });
const SILENT = 1e-6;

{
  const { ctx, errors } = await rig();
  const page = await ctx.newPage();
  await page.goto(`${BASE}/ryugu`);
  await hydrated(page);
  // A. off by default: gestures elsewhere in the palace make no context and no signal
  await page.mouse.click(640, 700);
  await page.keyboard.press("a");
  await page.keyboard.press("Enter");
  await wait(600);
  assert.equal(await status(page), "off");
  assert.deepEqual(await rms(page), [], "no AudioContext while off");
  log("A off by default: 0 contexts after a click, 'a' and Enter; aria-pressed =", await page.getAttribute(".sound", "aria-pressed"));

  // B. the button: one running context whose real output is audible but quiet
  await page.click(".sound");
  await wait(2600); // past the 2 s fade-in
  const on = await rms(page);
  assert.equal(on.length, 1);
  assert.equal(on[0].state, "running");
  assert.ok(on[0].rms > SILENT && on[0].rms < 0.05, `quiet but audible: ${on[0].rms}`);
  log("B button on: contexts", on.length, "state", on[0].state, "output RMS", on[0].rms.toExponential(2), "stored", await page.evaluate(() => localStorage.getItem("ryugu-sound")));

  // C. Pocket in another tab: its chip shows on, pressing it silences the palace's real output
  const home = await ctx.newPage();
  await home.goto(`${BASE}/`);
  const chip = home.locator("[data-pocket-sea-sound]");
  await chip.waitFor({ timeout: 15000 });
  await home.waitForFunction(() => document.querySelector("[data-pocket-sea-sound]")?.getAttribute("aria-pressed") === "true", null, { timeout: 15000 });
  await chip.click();
  await wait(900); // past the 0.4 s release
  const off = await rms(page);
  assert.ok(off[0].rms < SILENT, `silenced by Pocket: ${off[0].rms}`);
  assert.equal(await status(page), "off");
  assert.deepEqual(await rms(home), [], "Home never makes an AudioContext (no sound on other routes)");
  log("C Pocket chip off in another tab: palace RMS", off[0].rms.toExponential(2), "status off; Home contexts 0");

  // D. Pocket on again, then a key in the palace brings the water back; leaving the palace closes it
  await chip.click();
  await home.close();
  await page.bringToFront();
  await page.waitForFunction(() => document.querySelector("[data-ambience]")?.getAttribute("data-ambience") === "waiting", null, { timeout: 5000 });
  await page.keyboard.press("ArrowUp");
  await wait(2600);
  const again = await rms(page);
  assert.ok(again.at(-1).rms > SILENT, "plays again after a gesture");
  const handle = await page.evaluateHandle(() => window.__ctxs.at(-1));
  await page.click("a[data-surface]");
  await page.waitForURL(`${BASE}/`);
  await wait(800);
  const left = await page.evaluate((c) => (c ? c.state : "gone"), handle).catch(() => "page-replaced");
  assert.ok(left === "closed" || left === "page-replaced", `left the palace: ${left}`);
  log("D Pocket on -> waiting; ArrowUp -> RMS", again.at(-1).rms.toExponential(2), "; back to the surface -> context", left);
  assert.deepEqual(errors, [], "no page errors");
  await ctx.close();
}

{
  // E. no Web Audio: disabled button, nothing stored, nothing thrown
  const { ctx, errors } = await rig({ noAudio: true });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/ryugu`);
  await hydrated(page);
  await page.waitForFunction(() => document.querySelector("[data-ambience]")?.getAttribute("data-ambience") === "unsupported", null, { timeout: 5000 });
  await page.click(".sound", { force: true });
  await page.keyboard.press("x");
  await wait(300);
  assert.equal(await page.evaluate(() => localStorage.getItem("ryugu-sound")), null);
  assert.deepEqual(errors, []);
  log("E no Web Audio: unsupported, aria-disabled =", await page.getAttribute(".sound", "aria-disabled"), ", stored null, errors 0");
  await ctx.close();
}

await browser.close();
log("QA PROBE PASS");
