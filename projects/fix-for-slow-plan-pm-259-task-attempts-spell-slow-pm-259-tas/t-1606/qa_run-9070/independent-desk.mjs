// Independent QA probe: no delivered swipe(), browser fixture or gesture helper is reused.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(`${process.cwd()}/package.json`);
const { chromium } = require("playwright-core");
const base = process.env.BASE_URL ?? "https://otohime.dev";
const browser = await chromium.launch({ channel: "chrome", env: { ...process.env, TMPDIR: "/tmp" } });
console.log(JSON.stringify({ base, browser: browser.version(), node: process.version, playwright: require("playwright-core/package.json").version }));
try {
  for (const tablet of [false, false, false, true]) {
    const context = await browser.newContext({ viewport: tablet ? { width: 1024, height: 1366 } : { width: 1366, height: 900 }, hasTouch: tablet, isMobile: tablet, reducedMotion: "reduce" });
    try {
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", e => errors.push(e.message));
      await page.addInitScript(() => {
        window.qaTrace = [];
        for (const type of ["pointerdown", "pointermove", "pointerup", "pointercancel"]) document.addEventListener(type, e => {
          window.qaTrace.push({ type, x: e.clientX, y: e.clientY, t: e.timeStamp, target: e.target.className });
          if (window.qaTrace.length > 40) window.qaTrace.shift();
        }, true);
      });
      assert.equal((await page.goto(`${base}/desk`, { waitUntil: "load" })).status(), 200);
      const build = await page.locator('meta[name="build-sha"]').getAttribute("content");
      await page.waitForFunction(() => [...document.querySelectorAll(".desk-item, .desk-bar button")].every(el => Object.keys(el).some(k => k.startsWith("__reactProps"))));
      const tape = page.locator('[data-desk-item="music"] .desk-tape');
      await tape.scrollIntoViewIfNeeded();
      const geometry = await tape.evaluate(async el => {
        await document.fonts.ready;
        let prev = "";
        for (let i = 0; i < 120; i++) {
          await new Promise(requestAnimationFrame);
          const r = el.getBoundingClientRect(), box = JSON.stringify(r.toJSON());
          if (box === prev) {
            const x = r.x + r.width / 2, y = r.y + r.height / 2;
            return { x, y, hit: document.elementFromPoint(x, y) === el, width: document.querySelector(".desk").getBoundingClientRect().width };
          }
          prev = box;
        }
        throw Error("tape did not settle");
      });
      assert.equal(geometry.hit, true);
      const left = await page.locator('[data-desk-item="music"]').evaluate(el => parseFloat(el.style.left));
      const cdp = await context.newCDPSession(page);
      const send = (type, dx = 0) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x: geometry.x + dx, y: geometry.y, id: 1 }] });
      await send("touchStart");
      await send("touchMove", 12);
      if (!tablet) await page.locator('[data-desk-item="music"][data-dragging]').waitFor({ state: "attached", timeout: 5000 });
      for (let dx = 24; dx <= 120; dx += 12) await send("touchMove", dx);
      await send("touchEnd");
      await cdp.detach();
      await page.locator('[data-desk-item="music"][data-dragging]').waitFor({ state: "detached", timeout: 5000 });
      const result = await page.evaluate(() => ({ raw: localStorage.getItem("desk:v1"), left: parseFloat(document.querySelector('[data-desk-item="music"]').style.left), trace: window.qaTrace }));
      if (tablet) {
        assert.equal(result.raw, null, JSON.stringify(result));
        assert.equal(result.left, left);
        assert.throws(() => assert.ok(result.raw, "deliberately require tablet to persist a drag"), /deliberately require/);
      } else {
        assert.ok(Math.abs(result.left - left - 120 / geometry.width * 100) < 0.01, JSON.stringify(result));
        assert.ok(result.raw);
        await page.reload({ waitUntil: "load" });
        await page.waitForFunction(raw => localStorage.getItem("desk:v1") === raw && Object.keys(document.querySelector(".desk-item")).some(k => k.startsWith("__reactProps")), result.raw);
        assert.equal(await page.locator('[data-desk-item="music"]').evaluate(el => parseFloat(el.style.left)), result.left);
      }
      assert.deepEqual(errors, []);
      console.log(JSON.stringify({ tablet, build, geometry, initialLeft: left, ...result, negativeControl: tablet ? "forced drag expectation rejected" : null }));
    } finally { await context.close(); }
  }
} finally { await browser.close(); }
