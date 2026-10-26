// QA run-8828, t-1559, follow-up to probe.mjs. In headless Chrome, bringing another tab to front left the palace
// "visible", so that check proved nothing either way. Here the page is hidden for real by minimising its window
// through CDP (Browser.setWindowBounds), and a held finger is a real CDP touchStart on a fish.
//   node probe-hidden-touch.mjs [BASE_URL] [--headed]
import { mkdtempSync, rmSync } from "node:fs";
import { chromium } from "playwright-core";

const BASE = process.argv[2]?.startsWith("http") ? process.argv[2] : "https://otohime.dev";
const headless = !process.argv.includes("--headed");
const tmp = mkdtempSync("/tmp/qa8828h-");
const results = [];
const check = (name, ok, detail) => (results.push(ok), console.log(JSON.stringify({ name, ok, headless, detail })));
const COUNT = () => {
  window.__qa = { raf: 0 };
  const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (cb) => (window.__qa.raf++, raf(cb));
};
const raf = (p) => p.evaluate(() => window.__qa.raf);
// Fish centres on screen, keeping only those inside the viewport (a fish off screen cannot be touched).
const centres = (p) =>
  p.$$eval("[data-fish]", (gs) => gs.map((g) => { const b = g.getBoundingClientRect(); return [b.x + b.width / 2, b.y + b.height / 2]; }));
const inView = (p) => p.evaluate(() => [innerWidth, innerHeight]);

const browser = await chromium.launch({ channel: "chrome", headless, env: { ...process.env, TMPDIR: tmp }, args: ["--enable-unsafe-swiftshader", "--use-angle=swiftshader"],
  // Playwright keeps occluded/minimised pages "visible" with these; drop them so a minimised window is really hidden.
  ignoreDefaultArgs: ["--disable-backgrounding-occluded-windows", "--disable-renderer-backgrounding", "--disable-background-timer-throttling"] });
try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  const page = await ctx.newPage();
  await page.addInitScript(COUNT);
  await page.goto(`${BASE}/ryugu`, { waitUntil: "networkidle", timeout: 30_000 });
  await page.waitForTimeout(1200);
  const cdp = await ctx.newCDPSession(page);
  const { windowId } = await cdp.send("Browser.getWindowForTarget");
  const v0 = await raf(page);
  await page.waitForTimeout(800);
  const vis0 = await raf(page) - v0;
  await cdp.send("Browser.setWindowBounds", { windowId, bounds: { windowState: "minimized" } });
  await page.waitForTimeout(500);
  const state = await page.evaluate(() => ({ v: document.visibilityState, h: document.hidden }));
  const h0 = await raf(page);
  await page.waitForTimeout(1500);
  const hid = await raf(page) - h0;
  await cdp.send("Browser.setWindowBounds", { windowId, bounds: { windowState: "normal" } });
  await page.waitForTimeout(500);
  const r0 = await raf(page);
  await page.waitForTimeout(1500);
  const back = await raf(page) - r0;
  const ok = state.v === "hidden" && vis0 > 5 && hid === 0 && back > 5;
  check("hidden (minimised window): frames stop while hidden, resume when shown", ok, { visibilityState: state.v, framesVisible800ms: vis0, framesHidden1500ms: hid, framesShown1500ms: back });
  await ctx.close();

  // A held finger on a fish: touchStart, hold, measure, touchEnd.
  const tctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const tp = await tctx.newPage();
  await tp.goto(`${BASE}/ryugu`, { waitUntil: "networkidle", timeout: 30_000 });
  await tp.waitForTimeout(1200);
  const tc = await tctx.newCDPSession(tp);
  // Each trial picks the fish at the finger's point and measures how far the nearest fish is 1.2 s later.
  // Control: no finger, so only cruising moves it. Treatment: a held finger.
  const trial = async (touch) => {
    const all = await centres(tp);
    // Only a fish inside the viewport can be touched; wait for one to swim into the band if none is there.
    const [W, H] = await inView(tp);
    const inside = ([a, b]) => a > 20 && a < W - 20 && b > 20 && b < H - 20;
    let hit = all.find(inside);
    for (let i = 0; !hit && i < 20; i++) {
      await tp.waitForTimeout(250);
      hit = (await centres(tp)).find(inside);
    }
    if (!hit) throw new Error(`no fish inside the ${W}x${H} viewport: ${JSON.stringify(all.map((c) => c.map(Math.round)))}`);
    const [x, y] = hit;
    const near = async () => Math.min(...(await centres(tp)).map(([a, b]) => Math.hypot(a - x, b - y)));
    const d0 = await near();
    if (touch) await tc.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
    await tp.waitForTimeout(1200);
    const d1 = await near();
    if (touch) await tc.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await tp.waitForTimeout(800);
    return { at: [Math.round(x), Math.round(y)], before: Math.round(d0), after: Math.round(d1) };
  };
  const control = [await trial(false), await trial(false), await trial(false)];
  const touched = [await trial(true), await trial(true), await trial(true)];
  const maxControl = Math.max(...control.map((t) => t.after - t.before));
  const minTouched = Math.min(...touched.map((t) => t.after - t.before));
  check("touch: a held finger pushes fish away faster than cruising (control: no finger)", minTouched > maxControl + 20, { control, touched, maxControl, minTouched });
  await tctx.close();
} finally {
  await browser.close();
  rmSync(tmp, { recursive: true, force: true });
}
process.exit(results.every(Boolean) ? 0 : 1);
