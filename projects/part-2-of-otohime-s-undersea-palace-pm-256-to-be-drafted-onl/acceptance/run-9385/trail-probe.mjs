// Focused trail check at 1366x768: sample the peer canvas immediately and over time along the driven path.
import { createRequire } from "node:module";
import { writeFileSync } from "node:fs";
import path from "node:path";
const [repo, APP, OUT] = process.argv.slice(2);
const { chromium } = createRequire(path.join(repo, "package.json"))("playwright-core");
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const out = [];
for (const vp of [{ width: 1366, height: 768 }, { width: 390, height: 844 }]) {
  const [bA, bB] = await Promise.all([0, 1].map(() => chromium.launch({ executablePath: CHROME, headless: true })));
  const A = await (await bA.newContext({ viewport: vp })).newPage();
  const B = await (await bB.newContext({ viewport: vp })).newPage();
  await Promise.all([A.goto(`${APP}/`), B.goto(`${APP}/`)]);
  for (const p of [A, B]) await p.waitForFunction(() => document.querySelector("[data-ghosts-state]")?.dataset.ghosts === "1", null, { timeout: 15000 });
  const p0 = { x: vp.width * 0.2, y: vp.height * 0.3 }, p1 = { x: vp.width * 0.7, y: vp.height * 0.45 };
  // Bands along the path (excluding the last 8% where the tip sits): fraction of path -> pixel count.
  const bands = () => B.evaluate(({ p0, p1 }) => {
    const c = document.querySelector("[data-ghosts-state] canvas");
    const k = c.width / c.clientWidth;
    const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
    const res = {};
    for (const f of [0.1, 0.3, 0.5, 0.7, 0.85]) {
      const cx = (p0.x + (p1.x - p0.x) * f) * k, cy = (p0.y + (p1.y - p0.y) * f) * k, r = 14 * k;
      let n = 0;
      for (let y = Math.max(0, Math.round(cy - r)); y < Math.min(c.height, cy + r); y++)
        for (let x = Math.max(0, Math.round(cx - r)); x < Math.min(c.width, cx + r); x++) if (d[(y * c.width + x) * 4 + 3] > 8) n++;
      res[f] = n;
    }
    return res;
  }, { p0, p1 });
  const steps = 30;
  for (let i = 0; i <= steps; i++) { await A.mouse.move(p0.x + ((p1.x - p0.x) * i) / steps, p0.y + ((p1.y - p0.y) * i) / steps); await sleep(33); }
  const t0 = await bands();
  await B.screenshot({ path: path.join(OUT, `trail-${vp.width}.png`) });
  await sleep(400); const t400 = await bands();
  await sleep(800); const t1200 = await bands();
  out.push({ viewport: `${vp.width}x${vp.height}`, immediately: t0, after400ms: t400, after1200ms: t1200 });
  console.log(JSON.stringify(out.at(-1)));
  await bA.close(); await bB.close();
}
writeFileSync(path.join(OUT, "trail-result.json"), JSON.stringify(out, null, 2));
