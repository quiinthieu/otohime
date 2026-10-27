// t-1562 run-9207 browser probe: a palace restored by Back from the browser's back/forward cache gets a working sound
// button again, and still waits for a gesture. Real Chrome (playwright-core, channel chrome) against `next start`.
// Run: TMPDIR=/tmp BASE_URL=http://localhost:4077 node probe-bfcache.mjs (from a checkout with node_modules).
import { chromium } from "playwright-core";
import assert from "node:assert/strict";

const BASE = process.env.BASE_URL ?? "http://localhost:4077";
const browser = await chromium.launch({ channel: "chrome", args: ["--autoplay-policy=user-gesture-required", "--enable-features=BackForwardCache"] });
const ctx = await browser.newContext();
const events = [];
await ctx.exposeBinding("__audio", ({ page }, e) => events.push(`${new URL(page.url()).pathname} ${e}`));
await ctx.addInitScript(() => {
  addEventListener("pageshow", (e) => window.__audio?.(`pageshow persisted=${e.persisted}`));
  const C = window.AudioContext;
  if (!C) return;
  window.AudioContext = class extends C {
    constructor(...a) {
      super(...a);
      window.__audio?.("created");
      this.addEventListener("statechange", () => window.__audio?.(`state:${this.state}`));
    }
  };
});
const errors = [];
const page = await ctx.newPage();
page.on("pageerror", (e) => errors.push(String(e)));
const status = () => page.getAttribute("[data-ambience]", "data-ambience");
const until = (s) => page.waitForFunction((s) => document.querySelector("[data-ambience]")?.getAttribute("data-ambience") === s, s, { timeout: 10000 });
const settle = (ms = 500) => new Promise((r) => setTimeout(r, ms));

await page.goto(`${BASE}/ryugu`);
await page.waitForSelector("[data-ambience]");
await settle();
assert.equal(await status(), "off");
await page.click(".sound");
await until("playing");
console.log("1 button on:", await status());

await page.click("a[data-surface]");
await page.waitForURL(`${BASE}/`);
await settle();
await page.goBack();
await page.waitForURL(`${BASE}/ryugu`);
await settle(800);
const shows = events.filter((e) => e.includes("pageshow"));
const restored = shows.at(-1)?.endsWith("persisted=true") ?? false;
console.log("2 back to the palace:", shows.at(-1), restored ? "(bfcache restore)" : "(fresh load: inconclusive for bfcache)");
const created = events.filter((e) => e.endsWith("created")).length;
assert.equal(await status(), "waiting", "the restored palace reads the stored on again");
await settle();
assert.equal(events.filter((e) => e.endsWith("created")).length, created, "no new context on return: no autoplay");
console.log("3 restored status: waiting, contexts made on return:", 0);
await page.keyboard.press("ArrowLeft");
await until("playing");
console.log("4 a key press plays again:", await status(), events.slice(-2).join(", "));
await page.click(".sound");
await until("off");
assert.equal(await page.evaluate(() => localStorage.getItem("ryugu-sound")), "off");
console.log("5 the restored button switches it off: stored off");
assert.deepEqual(errors, []);
assert.ok(restored, "Chrome did not restore the page from the bfcache");
await browser.close();
console.log("PROBE PASS");
