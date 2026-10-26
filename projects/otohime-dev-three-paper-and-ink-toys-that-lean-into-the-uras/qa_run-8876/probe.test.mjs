import assert from "node:assert/strict";
import { test } from "node:test";
import { chromium } from "playwright-core";

const base = process.env.BASE_URL;
assert.ok(base, "run through scripts/e2e.mjs");

test("independent paper view and native touch scroll control", async () => {
  const browser = await chromium.launch({
    channel: "chrome",
    env: { ...process.env, TMPDIR: "/tmp" },
  });
  try {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      hasTouch: true,
      isMobile: true,
    });
    const page = await context.newPage();
    const requests = [];
    page.on("request", (request) => requests.push(request.url()));
    await page.goto(`${base}/play`, { waitUntil: "networkidle" });
    const box = page.locator("[data-peep]");
    assert.equal(await box.count(), 1);
    assert.equal(await box.locator("[data-peep-layer]").count(), 4);
    assert.equal(await box.locator("[data-peep-controller]").count(), 0);
    await box.scrollIntoViewIfNeeded();
    await box.getByRole("button", { name: "Look inside" }).click();
    await box.locator("[data-peep-controller]").waitFor();
    const matrices = () =>
      box.locator("[data-peep-layer]").evaluateAll((layers) =>
        layers.map((layer) => layer.getAttribute("transform")),
      );
    const neutral = await matrices();
    await box.getByRole("button", { name: "Look right" }).click();
    await page.waitForFunction(
      () => document.querySelector("[data-peep]")?.getAttribute("data-moving") === "false",
    );
    const right = await matrices();
    assert.equal(new Set(right).size, 4, "all depths have distinct transforms");
    assert.notDeepEqual(right, neutral);

    const aperture = box.locator("[data-peep-aperture]");
    const rect = await aperture.boundingBox();
    assert.ok(rect);
    const state = () =>
      page.evaluate(() => ({
        y: scrollY,
        max: document.documentElement.scrollHeight - innerHeight,
        touchAction: getComputedStyle(document.querySelector("[data-peep-aperture]")).touchAction,
      }));
    const before = await state();
    assert.ok(before.max > before.y + 100, "room for an upward pan");
    const cdp = await context.newCDPSession(page);
    const x = rect.x + rect.width / 2;
    const pan = async (start, end) => {
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [{ x, y: rect.y + start * rect.height }],
      });
      for (let i = 1; i <= 6; i++)
        await cdp.send("Input.dispatchTouchEvent", {
          type: "touchMove",
          touchPoints: [{ x, y: rect.y + (start + ((end - start) * i) / 6) * rect.height }],
        });
      await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      await page.waitForTimeout(200);
      return state();
    };
    const up = await pan(0.8, 0.2);
    assert.ok(up.y > before.y, JSON.stringify({ before, up }));
    const down = await pan(0.2, 0.8);
    assert.ok(down.y < up.y, JSON.stringify({ up, down }));
    assert.equal(before.touchAction, "pan-y");

    await box.getByRole("button", { name: "Disable" }).click();
    assert.equal(await box.locator("[data-peep-controller]").count(), 0);
    assert.deepEqual(await matrices(), neutral);
    assert.equal(requests.some((url) => /mediapipe|face_landmarker|\.wasm/.test(url)), false);
    console.log(JSON.stringify({ before, up, down, neutral, right, requests: requests.length }));
    await context.close();
  } finally {
    await browser.close();
  }
});
