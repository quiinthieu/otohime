// Independent QA against a real production build. No application imports or mocked renderer.
// Usage: SKIP_BUILD=1 node scripts/e2e.mjs --test projects/.../qa-run-8761.mjs
// Or BASE_URL=https://otohime.dev node --test <this file> for the deployed path.
// Real: React, CSS, shader compilation/linking/draw, browser media emulation and context loss.
// Synthetic: keyboard/mouse/CDP touch input; software GPU is not a physical mobile GPU.
import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { chromium } from "playwright-core";

const base = process.env.BASE_URL;
assert.ok(base, "Use scripts/e2e.mjs or set BASE_URL");
let browser;
before(async () => {
  browser = await chromium.launch({
    channel: "chrome",
    env: { ...process.env, TMPDIR: "/tmp" },
    args: ["--enable-unsafe-swiftshader", "--use-angle=swiftshader"],
  });
  console.log(JSON.stringify({ base, browser: browser.version(), runtime: process.version }));
});
after(async () => browser?.close());

test("independent entry walkthrough and editable-field negative control", async () => {
  const ctx = await browser.newContext({ reducedMotion: "reduce", hasTouch: true });
  ctx.setDefaultTimeout(5000);
  try {
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", error => errors.push({ message: error.message, stack: error.stack, url: page.url() }));
    assert.equal((await page.goto(`${base}/notes`)).status(), 200);
    const waterline = page.locator("[data-end-waterline] a");
    assert.equal(await waterline.getAttribute("href"), "/ryugu");
    await waterline.tap();
    await page.waitForURL(`${base}/ryugu`);
    assert.equal(await page.locator("h1").textContent(), "Ryugu-jo");
    assert.equal(await page.locator("link[rel=stylesheet]").count(), 1);
    await page.locator("a[data-surface]").click();
    await page.waitForURL(`${base}/`);
    await page.locator("[data-pocket-ryugu]").click();
    await page.waitForURL(`${base}/ryugu`);
    await page.locator("a[data-surface]").click();
    await page.waitForURL(`${base}/`);
    await page.locator("[data-pocket-ryugu]").waitFor();
    await page.keyboard.type("urashima", { delay: 80 });
    await page.waitForURL(`${base}/ryugu`);
    await page.waitForFunction(() => document.querySelector(".sea")?.dataset.water === "still");
    await page.goto(`${base}/sign-in`);
    const input = page.locator("input").first();
    await input.fill("urashima");
    await input.press("End");
    await page.keyboard.type("urashima");
    assert.equal(new URL(page.url()).pathname, "/sign-in");
    assert.equal(await input.inputValue(), "urashimaurashima");
    assert.deepEqual(errors, []);
    console.log("walkthrough: touch waterline, surface return, Pocket, keyboard; editable-field negative control passed");
  } finally { await ctx.close(); }
});

test("real shader construction, touch flee, reduced motion, and context-loss negative control", async () => {
  const ctx = await browser.newContext({ hasTouch: true, viewport: { width: 1000, height: 900 } });
  ctx.setDefaultTimeout(5000);
  try {
    const page = await ctx.newPage();
    await page.addInitScript(() => {
      window.__qaDraws = 0;
      const draw = WebGLRenderingContext.prototype.drawArrays;
      WebGLRenderingContext.prototype.drawArrays = function (...args) {
        const result = draw.apply(this, args);
        window.__qaDraws++;
        return result;
      };
    });
    assert.equal((await page.goto(`${base}/ryugu`)).status(), 200);
    await page.waitForFunction(() => window.__qaDraws > 10);
    const gl = await page.evaluate(() => {
      const canvas = document.querySelector("canvas");
      const gl = canvas.getContext("webgl");
      const program = gl.getParameter(gl.CURRENT_PROGRAM);
      return { linked: gl.getProgramParameter(program, gl.LINK_STATUS), error: gl.getError(), width: canvas.width, height: canvas.height };
    });
    assert.equal(gl.linked, true);
    assert.equal(gl.error, 0);
    assert.ok(gl.width > 0 && gl.height > 0);
    console.log(JSON.stringify({ realWebGL: gl }));
    await page.locator(".surface").evaluate(el => Promise.all(el.getAnimations().map(animation => animation.finished)));
    const index = await page.locator("[data-fish]").evaluateAll(gs => gs.findIndex(g => {
      const box = g.getBoundingClientRect();
      const x = box.x + box.width / 2, y = box.y + box.height / 2;
      return x > 120 && x < innerWidth - 120 && y > 120 && y < innerHeight - 120;
    }));
    assert.ok(index >= 0, "a fish is visible and clear of the surface and viewport edges");
    const fish = page.locator("[data-fish]").nth(index);
    const box = await fish.boundingBox();
    const touch = { x: box.x + box.width / 2 - 20, y: box.y + box.height / 2 };
    assert.equal(await page.evaluate(t => !!document.elementFromPoint(t.x, t.y)?.closest(".sea"), touch), true);
    const cdp = await ctx.newCDPSession(page);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [touch] });
    await page.waitForFunction(({ touch: t, index }) => {
      const box = document.querySelectorAll("[data-fish]")[index].getBoundingClientRect();
      return Math.hypot(box.x + box.width / 2 - t.x, box.y + box.height / 2 - t.y) > 100;
    }, { touch, index }, { timeout: 5000 });
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.waitForFunction(() => document.querySelector(".sea").dataset.water === "still");
    const transforms = await page.locator("[data-fish]").evaluateAll(gs => gs.map(g => g.getAttribute("transform")));
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    assert.deepEqual(await page.locator("[data-fish]").evaluateAll(gs => gs.map(g => g.getAttribute("transform"))), transforms);
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.waitForFunction(() => document.querySelector(".sea").dataset.water === "live");
    const before = await page.evaluate(() => window.__qaDraws);
    await page.waitForFunction(n => window.__qaDraws > n + 5, before);
    assert.equal(await page.evaluate(() => {
      const extension = document.querySelector("canvas").getContext("webgl").getExtension("WEBGL_lose_context");
      extension?.loseContext();
      return !!extension;
    }), true);
    await page.waitForFunction(() => document.querySelector(".sea").dataset.water === "static");
    const frozen = await page.locator("[data-fish]").evaluateAll(gs => gs.map(g => g.getAttribute("transform")));
    await page.mouse.move(500, 300);
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    assert.deepEqual(await page.locator("[data-fish]").evaluateAll(gs => gs.map(g => g.getAttribute("transform"))), frozen);
    assert.equal(await page.locator("canvas").evaluate(c => getComputedStyle(c).opacity), "0");
    console.log("renderer: linked real program/draw, touch flee, motion toggle, real context-loss negative control passed");
  } finally { await ctx.close(); }
});
