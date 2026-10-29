import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { launchBrowser } from "./probe-browser.mjs";
import { landingSettled } from "./probe-motion-state.mjs";

test("landing waits for clock animations and streams while scroll timelines may keep running", async () => {
  const browser = await launchBrowser({ options:{ headless:true, args:["--mute-audio"] } });
  try {
    const page = await browser.newPage();
    await page.setContent(`<style>body{height:3000px}@keyframes drum{from{transform:rotateX(-70deg)}to{transform:rotateX(0)}}#drum{margin-top:200px;height:300px;animation:drum 1s linear both;animation-timeline:view()}</style><div id="drum">Paper drum</div>`);
    await page.evaluate(() => { window.__probe={done:true}; });
    await page.waitForFunction(() => document.getAnimations().some(a => a.timeline instanceof ScrollTimeline && a.playState === "running"));
    assert.equal(await page.evaluate(landingSettled),true,"scroll progress does not block a completed navigation");
    await page.evaluate(() => { window.clock=document.querySelector("#drum").animate([{opacity:0},{opacity:1}],{duration:1000,fill:"forwards"}); window.clock.pause(); });
    assert.equal(await page.evaluate(landingSettled),false,"an unfinished clock animation still blocks");
    await page.evaluate(() => window.clock.finish());
    assert.equal(await page.evaluate(landingSettled),true);
    await page.evaluate(() => { const t=document.createElement("template");t.id="B:pending";document.body.append(t); });
    assert.equal(await page.evaluate(landingSettled),false,"an unrevealed stream still blocks");
    await page.evaluate(() => { document.querySelector("template").remove();document.__reactViewTransition={}; });
    assert.equal(await page.evaluate(landingSettled),false,"React's transition still blocks");
    await page.evaluate(() => { document.__reactViewTransition=null;window.__probe.done=false; });
    assert.equal(await page.evaluate(landingSettled),false,"the hop must finish");
    await page.evaluate(() => { window.__probe.done=true;document.querySelector("#drum").animate([{opacity:.9},{opacity:1}],{duration:1000,iterations:Infinity}); });
    assert.equal(await page.evaluate(landingSettled),true,"ambient clock loops retain the existing exclusion");
    assert.match(readFileSync(new URL("./probe-motion-signed-in.mjs",import.meta.url),"utf8"),/waitForFunction\(\s*landingSettled,/);
  } finally { await browser.close(); }
});
