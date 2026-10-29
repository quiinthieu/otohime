import assert from "node:assert/strict";
import { test } from "node:test";
import { launchBrowser } from "./probe-browser.mjs";
import { landingSettled } from "./motion-settle.mjs";

test("motion landing waits for clock animations and reveals while allowing real scroll timelines", async () => {
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    await page.setContent(`<style>
      body { height: 3000px; }
      #scroll { margin-top: 200px; width: 100px; height: 200px; animation: ink linear both; animation-timeline: view(); }
      @keyframes ink { from { opacity: .3; } to { opacity: 1; } }
      </style><div id="scroll"></div><div id="clock"></div>`);
    await page.evaluate(() => { window.__probe = { done: true }; });
    await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
    const scroll = await page.evaluate(() => {
      const a = document.getElementById("scroll").getAnimations()[0];
      return { timeline: a.timeline.constructor.name, state: a.playState, original: document.getAnimations().filter(a => a.effect?.getComputedTiming().endTime !== Infinity).every(a => a.playState === "finished" || a.playState === "idle") };
    });
    assert.equal(scroll.timeline, "ViewTimeline");
    assert.equal(scroll.state, "running");
    assert.equal(scroll.original, false, "negative control reproduces the hosted predicate failure");
    assert.equal(await page.evaluate(landingSettled), true);
    await page.evaluate(() => { window.clock = document.getElementById("clock").animate([{ opacity: 0 }, { opacity: 1 }], { duration: 100000, fill: "both" }); });
    assert.equal(await page.evaluate(landingSettled), false, "unfinished clock animation must still block");
    await page.evaluate(() => window.clock.pause());
    assert.equal(await page.evaluate(landingSettled), false, "a paused clock is not finished");
    await page.evaluate(() => window.clock.finish());
    assert.equal(await page.evaluate(landingSettled), true);
    await page.evaluate(() => { document.body.insertAdjacentHTML("beforeend", '<template id="B:1"></template>'); });
    assert.equal(await page.evaluate(landingSettled), false, "unrevealed Suspense still blocks");
    await page.evaluate(() => { document.querySelector("template").remove(); document.__reactViewTransition = {}; });
    assert.equal(await page.evaluate(landingSettled), false, "React transition still blocks");
    await page.evaluate(() => { delete document.__reactViewTransition; window.__probe.done = false; });
    assert.equal(await page.evaluate(landingSettled), false, "unfinished cross-document hop still blocks");
  } finally { await browser.close(); }
});
