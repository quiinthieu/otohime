import assert from "node:assert/strict";
import { test } from "node:test";
import { launchBrowser } from "../scripts/probe-browser.mjs";
import { streamedLandingSettled } from "../scripts/probe-motion-dom.mjs";

test("landing waits for finite timed entries and streamed reveals, while scroll progress remains interactive", async () => {
  const browser = await launchBrowser({ log: () => {} });
  try {
    const page = await browser.newPage({ viewport: { width: 900, height: 600 } });
    await page.setContent(`<style>
      body { margin: 0; height: 2400px; }
      #scroll { margin-top: 200px; height: 400px; animation: scroll-ink 1s linear both; animation-timeline: view(); }
      @keyframes scroll-ink { from { opacity: .2; } to { opacity: 1; } }
    </style><div id="time">entry</div><div id="scroll">scrolling ink</div>`);
    await page.evaluate(() => { Object.assign(window, { __probe: { done: true } }); window.scrollTo(0, 100); });
    await page.waitForFunction(() => document.getAnimations().some(a => a.effect instanceof KeyframeEffect && a.effect.target === document.querySelector("#scroll") && !Number.isFinite(a.effect.getComputedTiming().endTime)));
    const legacy = await page.evaluate(() => document.getAnimations()
      .filter(a => a.effect?.getComputedTiming().endTime !== Infinity)
      .every(a => a.playState === "finished" || a.playState === "idle"));
    assert.equal(legacy, false, "the previous predicate hangs on a real scroll timeline");
    assert.equal(await page.evaluate(streamedLandingSettled), true);
    await page.evaluate(() => {
      const entry = document.querySelector("#time")!;
      entry.animate({ opacity: [.2, 1] }, { duration: 1000, fill: "both" }).pause();
      entry.animate({ transform: ["translateX(0)", "translateX(1px)"] }, { duration: 1000, iterations: Infinity });
    });
    assert.equal(await page.evaluate(streamedLandingSettled), false, "a paused finite entry still blocks settlement");
    await page.evaluate(() => { for (const a of document.getAnimations()) if (Number.isFinite(a.effect?.getComputedTiming().endTime)) a.finish(); });
    assert.equal(await page.evaluate(streamedLandingSettled), true, "infinite ambient motion does not block a completed entry");
    await page.evaluate(() => { const template = document.createElement("template"); template.id = "B:pending"; document.body.append(template); });
    assert.equal(await page.evaluate(streamedLandingSettled), false, "unrevealed Suspense remains a failure");
    await page.evaluate(() => { document.querySelector("template")!.remove(); Object.assign(document, { __reactViewTransition: {} }); });
    assert.equal(await page.evaluate(streamedLandingSettled), false, "a React transition in flight remains a failure");
    await page.evaluate(() => { Object.assign(document, { __reactViewTransition: null }); Object.assign(window, { __probe: { done: false } }); });
    assert.equal(await page.evaluate(streamedLandingSettled), false, "the document hop must complete");
  } finally { await browser.close(); }
});
