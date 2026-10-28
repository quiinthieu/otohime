// Independent diagnosis for the new upstream Booth assertion; no application edits.
import assert from "node:assert/strict";
import { test } from "node:test";
import { chromium } from "playwright-core";

test("upstream Booth context-loss state at dispatch and after React commits", async () => {
  const browser = await chromium.launch({ channel: "chrome", env: { ...process.env, TMPDIR: "/tmp" } });
  try {
    const page = await browser.newPage();
    await page.goto(process.env.BASE_URL + "/play/booth");
    const studio = page.locator('[data-testid="booth-studio"][data-hydrated="true"]');
    await studio.waitFor();
    await page.locator('[data-testid="stock-riso"]').click();
    await page.locator('[data-testid="stock-newsprint"]').click();
    const result = await page.evaluate(async () => {
      const root = document.querySelector('[data-testid="booth-studio"]');
      const canvas = document.querySelector('[data-testid="booth-viewfinder-canvas"]');
      const before = root.getAttribute("data-renderer-backend");
      canvas.dispatchEvent(new Event("webglcontextlost", { cancelable: true }));
      const immediate = root.getAttribute("data-renderer-backend");
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const committed = root.getAttribute("data-renderer-backend");
      const bytes = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height).data;
      let opaque = 0;
      for (let i = 3; i < bytes.length; i += 4) if (bytes[i]) opaque++;
      return { before, immediate, committed, opaque };
    });
    assert.equal(result.before, "webgl2");
    assert.equal(result.immediate, "webgl2", "native event update is deferred at dispatch");
    assert.equal(result.committed, "canvas2d", "actual fallback is observable after commit");
    assert.ok(result.opaque > 0);
    console.log(JSON.stringify({ kind: "upstream-booth-control", ...result, chrome: browser.version(),
      boundary: "actual Chrome/application/renderer; native context-loss event injected; sample portrait; no camera mock" }));
  } finally { await browser.close(); }
});
