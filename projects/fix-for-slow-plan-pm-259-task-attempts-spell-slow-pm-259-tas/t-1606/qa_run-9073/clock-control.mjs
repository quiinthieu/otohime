// Diagnostic for CI's Kame clock assertion. This isolates the real locked Playwright clock;
// it does not execute or establish correctness of the Kame application.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { setTimeout as delay } from "node:timers/promises";
const require = createRequire(`${process.cwd()}/package.json`);
const { chromium } = require("playwright-core");
const browser = await chromium.launch({ channel: "chrome", env: { ...process.env, TMPDIR: "/tmp" } });
console.log(JSON.stringify({ browser: browser.version(), playwright: require("playwright-core/package.json").version }));
try {
  for (const wallMs of [0, 50, 50, 50, 150]) {
    const context = await browser.newContext();
    try {
      const page = await context.newPage();
      await page.clock.install({ time: new Date("2026-10-26T03:00:00Z") });
      await page.clock.pauseAt(new Date("2026-10-26T04:00:00Z"));
      await page.clock.resume();
      await page.evaluate(() => {
        window.fired = false;
        window.started = performance.now();
        setTimeout(() => { window.fired = true; }, 500);
      });
      // Deliberately reproduce the test's wall-time assumption, not a synchronization strategy.
      await delay(wallMs);
      await page.clock.runFor(499);
      const seen = await page.evaluate(() => ({ fired: window.fired, elapsed: performance.now() - window.started }));
      await page.clock.runFor(1);
      const after = await page.evaluate(() => window.fired);
      assert.equal(after, true, "the same timer fires when virtual time reaches its threshold");
      console.log(JSON.stringify({ wallMs, virtualMs: 499, seen, afterOneMoreVirtualMs: after }));
    } finally { await context.close(); }
  }
  // Proposed fixture repair: observe browser time rather than assume a host delay advanced it.
  for (let attempt = 1; attempt <= 3; attempt++) {
    const context = await browser.newContext();
    try {
      const page = await context.newPage();
      await page.clock.install();
      await page.evaluate(() => {
        window.fired = false;
        window.started = performance.now();
        setTimeout(() => { window.fired = true; }, 500);
      });
      await page.waitForFunction(() => performance.now() - window.started >= 50);
      await page.clock.runFor(499);
      const seen = await page.evaluate(() => ({ fired: window.fired, elapsed: performance.now() - window.started }));
      assert.equal(seen.fired, true);
      console.log(JSON.stringify({ observedClockControl: attempt, seen }));
    } finally { await context.close(); }
  }
} finally { await browser.close(); }
