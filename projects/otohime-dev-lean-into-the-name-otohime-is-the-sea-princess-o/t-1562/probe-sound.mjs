// t-1562 browser probe: the palace's sea sound against `next start` of this build, in real Chrome (playwright-core,
// channel chrome). Run from a checkout with node_modules: TMPDIR=/tmp BASE_URL=http://localhost:4064 node probe-sound.mjs.
// The server needs BETTER_AUTH_SECRET and BETTER_AUTH_URL (any placeholder) or Home renders its 500 page.
import { chromium } from "playwright-core";
import assert from "node:assert/strict";

const BASE = process.env.BASE_URL ?? "http://localhost:4064";
const log = (...a) => console.log(...a);
const browser = await chromium.launch({ channel: "chrome", args: ["--autoplay-policy=user-gesture-required"] });

const INSTRUMENT = () => {
  const report = (e) => window.__audio?.(e);
  const C = window.AudioContext;
  if (!C) return;
  window.AudioContext = class extends C {
    constructor(...a) {
      super(...a);
      report("created");
      this.addEventListener("statechange", () => report(`state:${this.state}`));
    }
    close() {
      report("close");
      sessionStorage.setItem("probe-closed", `${Number(sessionStorage.getItem("probe-closed") ?? 0) + 1}:${this.state}`);
      return super.close();
    }
  };
  const stop = AudioBufferSourceNode.prototype.stop;
  AudioBufferSourceNode.prototype.stop = function (...a) { report("source-stop"); return stop.apply(this, a); };
};

async function rig(noAudio = false) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const seen = [];
  const errors = [];
  await ctx.exposeBinding("__audio", ({ page }, e) => { seen.push(`${new URL(page.url()).pathname} ${e}`); });
  if (noAudio) await ctx.addInitScript(() => { delete window.AudioContext; delete window.webkitAudioContext; });
  else await ctx.addInitScript(INSTRUMENT);
  ctx.on("page", (p) => {
    p.on("pageerror", (e) => errors.push(String(e)));
    p.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  });
  return { ctx, seen, errors };
}
const hydrated = (page) => page.waitForFunction(() => document.querySelector(".sound")?.textContent?.includes("Sea sound") && document.querySelector("[data-ambience]"), null, { timeout: 15000 });
const status = (page) => page.getAttribute("[data-ambience]", "data-ambience");
const settle = (ms = 400) => new Promise((r) => setTimeout(r, ms));

// 1. off by default: no context on load, nor on a click in the palace
{
  const { ctx, seen, errors } = await rig();
  const page = await ctx.newPage();
  await page.goto(`${BASE}/ryugu`);
  await hydrated(page);
  await settle();
  assert.equal(await status(page), "off");
  assert.equal(await page.getAttribute(".sound", "aria-pressed"), "false");
  await page.click(".box"); // open the Tamatebako: a gesture, but sound is off
  await page.keyboard.press("ArrowLeft");
  await settle();
  assert.deepEqual(seen, [], "no AudioContext while off");
  log("1 off by default: status off, aria-pressed=false, contexts after a click and a key:", seen.length);

  // 2. the button turns it on inside its click
  await page.click(".sound");
  await page.waitForFunction(() => document.querySelector("[data-ambience]")?.getAttribute("data-ambience") === "playing");
  await settle(600);
  assert.equal(seen.filter((e) => e.endsWith("created")).length, 1);
  assert.ok(seen.some((e) => e.endsWith("state:running")), `running: ${seen}`);
  assert.equal(await page.evaluate(() => localStorage.getItem("ryugu-sound")), "on");
  log("2 button on:", JSON.stringify(seen), "stored", "on");

  // 3. Pocket on Home (another tab) switches it off: the palace's water stops at once
  const home = await ctx.newPage();
  await home.goto(`${BASE}/`);
  const chip = home.locator("section[aria-label='Pocket console'] [data-pocket-sea-sound]");
  await chip.waitFor();
  await home.waitForFunction(() => document.querySelector("[data-pocket-sea-sound]")?.getAttribute("aria-pressed") === "true", null, { timeout: 15000 });
  const homeBefore = seen.filter((e) => e.startsWith("/ ")).length;
  await chip.click();
  assert.equal(await chip.getAttribute("aria-pressed"), "false");
  await page.waitForFunction(() => document.querySelector("[data-ambience]")?.getAttribute("data-ambience") === "off", null, { timeout: 5000 });
  await settle();
  assert.ok(seen.includes("/ryugu source-stop"), `stopped: ${seen}`);
  assert.equal(seen.filter((e) => e.startsWith("/ ")).length, homeBefore, "Pocket makes no AudioContext on Home");
  log("3 Pocket chip off: palace status off, source stopped; Home audio events:", seen.filter((e) => e.startsWith("/ ")).length);
  // Pocket on again: the palace waits for a gesture, it does not start
  await chip.click();
  await page.waitForFunction(() => document.querySelector("[data-ambience]")?.getAttribute("data-ambience") === "waiting", null, { timeout: 5000 });
  const created = seen.filter((e) => e.endsWith("created")).length;
  await home.close();
  await settle();
  assert.equal(seen.filter((e) => e.endsWith("created")).length, created);
  log("3b Pocket chip on: palace status waiting, no new sound until a gesture");

  // 4. leaving the palace closes the context
  log("4a palace tab hidden while Home was in front:", await page.evaluate(() => document.hidden));
  await page.bringToFront();
  await page.waitForFunction(() => !document.hidden);
  await page.keyboard.press("ArrowRight"); // the gesture: plays again
  await page.waitForFunction(() => document.querySelector("[data-ambience]")?.getAttribute("data-ambience") === "playing");
  await page.click("a[data-surface]");
  await page.waitForURL(`${BASE}/`);
  await settle(800);
  const closed = await page.evaluate(() => sessionStorage.getItem("probe-closed"));
  assert.match(closed ?? "", /^1:/, `closed: ${closed} ${seen}`);
  log("4 back to the surface: AudioContext.close() called on the way out (count:state before close) =", closed);

  // 5. a return visit with sound stored on: silent on load, a key press starts it
  const before = seen.length;
  await page.goto(`${BASE}/ryugu`);
  await hydrated(page);
  await settle(800);
  assert.equal(await status(page), "waiting");
  assert.equal(seen.length, before, "nothing on load");
  await page.keyboard.press("ArrowDown");
  await page.waitForFunction(() => document.querySelector("[data-ambience]")?.getAttribute("data-ambience") === "playing");
  await settle(600);
  assert.ok(seen.slice(before).some((e) => e.endsWith("state:running")));
  log("5 return visit: waiting on load with 0 audio events, a key press ->", JSON.stringify(seen.slice(before)));
  // the button off from inside the palace
  await page.click(".sound");
  await settle();
  assert.equal(await status(page), "off");
  assert.equal(await page.evaluate(() => localStorage.getItem("ryugu-sound")), "off");
  log("5b palace button off: status off, stored off");
  assert.deepEqual(errors, []);
  await ctx.close();
}

// 6. no Web Audio at all
{
  const { ctx, errors } = await rig(true);
  const page = await ctx.newPage();
  await page.goto(`${BASE}/ryugu`);
  await hydrated(page);
  await page.waitForFunction(() => document.querySelector("[data-ambience]")?.getAttribute("data-ambience") === "unsupported");
  await page.click(".sound", { force: true }); // aria-disabled: Playwright would refuse; a visitor's click still lands
  await page.keyboard.press("ArrowLeft");
  await settle();
  assert.equal(await page.getAttribute(".sound", "aria-disabled"), "true");
  assert.equal(await page.evaluate(() => localStorage.getItem("ryugu-sound")), null);
  assert.deepEqual(errors, []);
  log("6 no Web Audio: status unsupported, aria-disabled, nothing stored, page errors:", errors.length, "-", await page.textContent("#ryugu-sound-note"));
  await ctx.close();
}

await browser.close();
log("PROBE PASS");
