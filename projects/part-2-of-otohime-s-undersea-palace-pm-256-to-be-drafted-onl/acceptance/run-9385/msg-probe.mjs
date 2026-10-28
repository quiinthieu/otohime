// Count peer move messages arriving at B and their spacing while A glides (synthetic scripted pointer only).
import { createRequire } from "node:module";
import path from "node:path";
const [repo, APP] = process.argv.slice(2);
const { chromium } = createRequire(path.join(repo, "package.json"))("playwright-core");
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const vp = { width: 1366, height: 768 };
const [bA, bB] = await Promise.all([0, 1].map(() => chromium.launch({ executablePath: CHROME, headless: true })));
const A = await (await bA.newContext({ viewport: vp })).newPage();
const cB = await bB.newContext({ viewport: vp });
await cB.addInitScript(() => {
  window.__rx = [];
  const N = window.WebSocket;
  window.WebSocket = class extends N { constructor(...a) { super(...a); this.addEventListener("message", (e) => { try { const m = JSON.parse(e.data); if (m.t === "m") window.__rx.push([Math.round(performance.now()), m.x.toFixed(3)]); } catch {} }); } };
});
const B = await cB.newPage();
await Promise.all([A.goto(`${APP}/`), B.goto(`${APP}/`)]);
for (const p of [A, B]) await p.waitForFunction(() => document.querySelector("[data-ghosts-state]")?.dataset.ghosts === "1", null, { timeout: 15000 });
const p0 = { x: 270, y: 230 }, p1 = { x: 950, y: 345 };
const t = Date.now();
for (let i = 0; i <= 30; i++) { await A.mouse.move(p0.x + ((p1.x - p0.x) * i) / 30, p0.y + ((p1.y - p0.y) * i) / 30); await sleep(33); }
const dur = Date.now() - t;
await sleep(200);
const rx = await B.evaluate(() => window.__rx);
console.log(JSON.stringify({ glideMs: dur, received: rx.length, gaps: rx.slice(1).map((r, i) => r[0] - rx[i][0]), xs: rx.map((r) => r[1]) }));
await bA.close(); await bB.close();
