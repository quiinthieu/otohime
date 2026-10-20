// QA probe for pm-203/t-1163 (run-6833): a finger dragging the Planisphere disc a quarter turn.
// Usage (scratch dir with playwright installed): BASE=https://otohime.dev node qa-t-1163-touch-probe.mjs
// Passes when a 90° touch drag on a phone turns the hour by 6 h, the page does not pan and no pointercancel fires.
import { chromium } from "playwright";
const BASE = process.env.BASE ?? "https://otohime.dev";
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
const p = await ctx.newPage();
await p.goto(`${BASE}/planisphere?city=tokyo&date=2026-10-20&hour=21`, { waitUntil: "networkidle" });
await p.waitForSelector("[data-actions] button");
await p.evaluate(() => scrollTo(0, 120));
await p.evaluate(() => { window.__ev = {}; for (const t of ["pointermove", "pointerup", "pointercancel"]) document.addEventListener(t, () => (window.__ev[t] = (window.__ev[t] ?? 0) + 1), true); });
const cdp = await ctx.newCDPSession(p);
const c = await p.evaluate(() => { const r = document.querySelector(".frame-face").getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, r: r.width / 2 }; });
const at = (deg) => ({ x: c.x + c.r * 0.45 * Math.cos((deg * Math.PI) / 180), y: c.y + c.r * 0.45 * Math.sin((deg * Math.PI) / 180) });
const y0 = await p.evaluate(() => scrollY);
await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [at(0)] });
for (let i = 1; i <= 45; i++) { await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [at((90 * i) / 45)] }); await p.waitForTimeout(16); }
await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
await p.waitForTimeout(300);
const [hour, y1, ev] = await p.evaluate(() => [document.querySelector("[data-disc]").getAttribute("aria-valuetext"), scrollY, window.__ev]);
await b.close();
const pass = hour === "15:00" && y1 === y0 && !ev.pointercancel;
console.log(`${pass ? "ok" : "not ok"} - touch quarter turn: 21:00 → ${hour}, scrollY ${y0} → ${y1}, ${JSON.stringify(ev)}`);
process.exit(pass ? 0 : 1);
