// QA-owned control for the repaired verifier. Actual app/renderer, no supplied test helpers.
import assert from "node:assert/strict";
import { test } from "node:test";
import { chromium } from "playwright-core";

test("exact fallback wait detects a suppressed context-loss event, then actual fallback paints", async () => {
  const browser = await chromium.launch({ channel: "chrome", env: { ...process.env, TMPDIR: "/tmp" } });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on("pageerror", e => errors.push(e.message));
    assert.equal((await page.goto(process.env.BASE_URL + "/play/booth")).status(), 200);
    const studio = page.locator('[data-testid="booth-studio"][data-hydrated="true"]');
    await studio.waitFor();
    assert.equal(await studio.getAttribute("data-renderer-backend"), "webgl2");
    await page.evaluate(() => {
      const canvas = document.querySelector('[data-testid="booth-viewfinder-canvas"]');
      canvas.addEventListener("webglcontextlost", e => e.stopImmediatePropagation(), { capture: true, once: true });
      canvas.dispatchEvent(new Event("webglcontextlost", { cancelable: true }));
    });
    const fallback = () => document.querySelector('[data-testid="booth-studio"]')
      ?.getAttribute("data-renderer-backend") === "canvas2d";
    await assert.rejects(page.waitForFunction(fallback, null, { timeout: 500 }), /Timeout/);
    assert.equal(await studio.getAttribute("data-renderer-backend"), "webgl2");
    const immediate = await page.evaluate(() => {
      document.querySelector('[data-testid="booth-viewfinder-canvas"]')
        .dispatchEvent(new Event("webglcontextlost", { cancelable: true }));
      return document.querySelector('[data-testid="booth-studio"]').getAttribute("data-renderer-backend");
    });
    await page.waitForFunction(fallback, null, { timeout: 3000 });
    assert.equal(await studio.getAttribute("data-renderer-backend"), "canvas2d");
    const painted = await page.locator('[data-testid="booth-viewfinder-canvas"]').evaluate(canvas => {
      const data = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height).data;
      let opaque = 0, colour = 0;
      for (let i = 0; i < data.length; i += 4) {
        opaque += data[i + 3] > 0 ? 1 : 0;
        colour += data[i] + data[i + 1] + data[i + 2];
      }
      return { opaque, mean: colour / (data.length / 4) };
    });
    assert.ok(painted.opaque > 0 && painted.mean > 50);
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ kind: "booth-independent-negative", blockedEventWaitRejected: true,
      immediate, committed: "canvas2d", ...painted, chrome: browser.version(),
      boundary: "real app, Chrome and sample renderer; native event suppressed once for negative control, then injected normally; no canvas replacement" }));
  } finally { await browser.close(); }
});
