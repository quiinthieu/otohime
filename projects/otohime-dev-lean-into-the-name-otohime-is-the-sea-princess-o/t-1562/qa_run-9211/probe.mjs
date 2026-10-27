// QA run-9211 probe for t-1562 (opt-in palace sound), independent of the SWE's probe-sound.mjs / probe-bfcache.mjs and
// of qa_run-8975/probe-signal.mjs. Real Google Chrome through the repo's locked playwright-core; the signal is measured by
// mirroring every connect() to a destination into an AnalyserNode, so silence and sound are RMS readings, not attributes.
//   silent     a fresh visit and a stored "on" both make no AudioContext before a gesture (no autoplay on load)
//   enable     the palace button starts one running context with a quiet, non-zero output
//   pocket     Pocket's chip on the home page (another tab) switches it off: palace RMS 0, Home never makes a context
//   leave      "Back to the surface" closes the palace's context
//   bfcache    Back restores the palace from the back/forward cache (Playwright's --disable-back-forward-cache is
//              dropped): the old context stays closed, nothing plays before a gesture, then the button works again
//   no-audio   without Web Audio the button is unsupported/aria-disabled, nothing is stored and nothing throws
// BASE_URL (default http://localhost:4091). Exit 1 on any failed check.
import { chromium } from "playwright-core";

const BASE = process.env.BASE_URL ?? "http://localhost:4091";
const fails = [];
const check = (ok, msg) => { if (!ok) fails.push(msg); console.log(`${ok ? "ok" : "not ok"} - ${msg}`); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const SILENT = 1e-6;
const browser = await chromium.launch({
  channel: "chrome",
  args: ["--autoplay-policy=user-gesture-required"],
  ignoreDefaultArgs: ["--disable-back-forward-cache"],
});

function TAP() {
  window.__shows = [];
  addEventListener("pageshow", (e) => window.__shows.push(e.persisted));
  const C = window.AudioContext;
  if (!C) return;
  window.__ctxs = [];
  const connect = AudioNode.prototype.connect;
  AudioNode.prototype.connect = function (to, ...rest) {
    const r = connect.call(this, to, ...rest);
    if (to instanceof AudioDestinationNode) {
      const c = this.context;
      if (!c.__tap) { c.__tap = c.createAnalyser(); c.__tap.fftSize = 2048; }
      connect.call(this, c.__tap);
    }
    return r;
  };
  window.AudioContext = class extends C { constructor(...a) { super(...a); window.__ctxs.push(this); } };
  window.__rms = () => window.__ctxs.map((c) => {
    if (!c.__tap || c.state !== "running") return { state: c.state, rms: 0 };
    const b = new Float32Array(c.__tap.fftSize);
    c.__tap.getFloatTimeDomainData(b);
    return { state: c.state, rms: Math.sqrt(b.reduce((s, x) => s + x * x, 0) / b.length) };
  });
}

async function rig({ noAudio = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  await ctx.addInitScript(noAudio ? () => { delete window.AudioContext; delete window.webkitAudioContext; } : TAP);
  ctx.on("page", (p) => {
    p.on("pageerror", (e) => errors.push(String(e)));
    p.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  });
  return { ctx, errors };
}
const meter = (page) => page.evaluate(() => (window.__rms ? window.__rms() : null));
const status = (page) => page.getAttribute("[data-ambience]", "data-ambience");
const until = (page, s, timeout = 8000) =>
  page.waitForFunction((s) => document.querySelector("[data-ambience]")?.getAttribute("data-ambience") === s, s, { timeout }).then(() => true, () => false);
const palace = async (page) => {
  await page.goto(`${BASE}/ryugu`);
  await page.waitForSelector("[data-ambience] .sound");
  await wait(500); // hydration and the stored preference
};

{
  const { ctx, errors } = await rig();
  const page = await ctx.newPage();

  // silent: off by default, and gestures that are not the button make nothing
  await palace(page);
  await page.mouse.click(400, 600);
  await page.keyboard.press("ArrowDown");
  await wait(500);
  check((await status(page)) === "off" && (await page.getAttribute(".sound", "aria-pressed")) === "false", "silent: served off, aria-pressed=false");
  check((await meter(page)).length === 0, "silent: a click and a key elsewhere make no AudioContext while off");

  // enable
  await page.click(".sound");
  await wait(2600); // past the fade-in
  const on = await meter(page);
  check(on.length === 1 && on[0].state === "running", `enable: one running context (${JSON.stringify(on.map((x) => x.state))})`);
  check(on[0]?.rms > SILENT && on[0]?.rms < 0.05, `enable: quiet but audible output (RMS ${on[0]?.rms?.toExponential(2)})`);
  check((await page.evaluate(() => localStorage.getItem("ryugu-sound"))) === "on", "enable: the preference is stored on");

  // a stored on is not autoplay: a reload waits for a gesture
  await palace(page);
  check((await status(page)) === "waiting", `silent: a stored on reloads as waiting (${await status(page)})`);
  check((await meter(page)).length === 0, "silent: a stored on makes no context on load");
  await page.mouse.click(400, 600);
  await wait(2600);
  const resumed = await meter(page);
  check(resumed.length === 1 && resumed[0].rms > SILENT, `enable: a click in the palace starts it (RMS ${resumed[0]?.rms?.toExponential(2)})`);

  // pocket: the chip on Home, in another tab, switches the palace off
  const home = await ctx.newPage();
  await home.goto(`${BASE}/`);
  const chip = home.locator("[data-pocket-sea-sound]");
  await chip.waitFor({ state: "attached", timeout: 15000 });
  const shownOn = await home.waitForFunction(() => document.querySelector("[data-pocket-sea-sound]")?.getAttribute("aria-pressed") === "true", null, { timeout: 10000 }).then(() => true, () => false);
  check(shownOn, "pocket: the chip shows the stored on");
  if (!(await chip.isVisible())) await home.evaluate(() => document.querySelector("[data-pocket-sea-sound]").click());
  else await chip.click();
  await wait(900); // past the release
  const off = await meter(page);
  check(off.at(-1).rms < SILENT && (await status(page)) === "off", `pocket: off from Pocket silences the palace (RMS ${off.at(-1).rms.toExponential(2)}, ${await status(page)})`);
  check((await page.evaluate(() => localStorage.getItem("ryugu-sound"))) === "off", "pocket: the preference is stored off");
  check((await meter(home)).length === 0, "pocket: Home makes no AudioContext (no sound on other routes)");
  await home.close();
  await page.bringToFront();
  await page.mouse.click(400, 600);
  await wait(600);
  check((await meter(page)).every((c) => c.rms < SILENT), "pocket: after Pocket's off a palace click brings nothing back");

  // leave, then come Back
  await page.click(".sound");
  await wait(2600);
  const before = (await meter(page)).length;
  check((await meter(page)).at(-1).rms > SILENT, "leave: playing again before leaving");
  await page.click("a[data-surface]");
  await page.waitForURL(`${BASE}/`);
  await wait(800);
  check((await meter(page)).length === 0, "leave: the surface makes no context of its own");
  await page.goBack({ waitUntil: "commit" }); // a bfcache restore fires pageshow, not load
  await page.waitForFunction(() => location.pathname === "/ryugu" && document.querySelector("[data-ambience]"));
  await wait(1000);
  const restored = (await page.evaluate(() => window.__shows.at(-1))) === true;
  check(restored, `bfcache: Back restored the palace from the back/forward cache (pageshow persisted=${restored})`);
  if (restored) {
    const back = await meter(page);
    check(back.length === before && back.at(-1).state === "closed", `leave: the context made before leaving is closed (${back.at(-1).state})`);
    check((await status(page)) === "waiting", `bfcache: the restored button rereads the stored on (${await status(page)})`);
    check((await meter(page)).length === before, "bfcache: no new context before a gesture (no autoplay on return)");
    await page.keyboard.press("ArrowLeft");
    const playing = await until(page, "playing");
    await wait(2600);
    const after = await meter(page);
    check(playing && after.length === before + 1 && after.at(-1).rms > SILENT, `bfcache: a key press plays again (${await status(page)}, RMS ${after.at(-1)?.rms?.toExponential(2)})`);
    await page.click(".sound");
    const offAgain = await until(page, "off");
    await wait(900);
    check(offAgain && (await meter(page)).at(-1).rms < SILENT, "bfcache: the restored button switches it off");
  }
  check(errors.length === 0, `no page or console errors (${errors.join("; ")})`);
  await ctx.close();
}

{
  const { ctx, errors } = await rig({ noAudio: true });
  const page = await ctx.newPage();
  await palace(page);
  check(await until(page, "unsupported"), "no-audio: the button says unsupported");
  check((await page.getAttribute(".sound", "aria-disabled")) === "true", "no-audio: aria-disabled");
  await page.click(".sound", { force: true });
  await page.keyboard.press("x");
  await wait(300);
  check((await page.evaluate(() => localStorage.getItem("ryugu-sound"))) === null, "no-audio: nothing is stored");
  check(errors.length === 0, `no-audio: no page or console errors (${errors.join("; ")})`);
  await ctx.close();
}

await browser.close();
console.log(fails.length ? `FAIL ${fails.length}` : "PASS");
process.exit(fails.length ? 1 : 0);
