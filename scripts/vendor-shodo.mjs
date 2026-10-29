// Curated KanjiVG source, pinned upstream; no runtime third-party fetches.
import { writeFile, mkdir } from "node:fs/promises";
import { chromium } from "playwright-core";
const revision = "70a0b7ae0c18ceb5cb358274b029cce0234a43bc";
const entries = [["06728", "木", "tree", "ki"], ["06c34", "水", "water", "mizu"], ["05c71", "山", "mountain", "yama"], ["065e5", "日", "sun / day", "hi"], ["06708", "月", "moon / month", "tsuki"]];
await mkdir("public/kanji", { recursive: true });
const browser = await chromium.launch({ channel: process.env.CHROME_PATH ? undefined : "chrome", executablePath: process.env.CHROME_PATH, headless: true });
try {
  const page = await browser.newPage();
  const kanji = [];
  for (const [id, character, meaning, reading] of entries) {
    const response = await fetch(`https://raw.githubusercontent.com/KanjiVG/kanjivg/${revision}/kanji/${id}.svg`);
    if (!response.ok) throw new Error(`KanjiVG ${id}: ${response.status}`);
    const svg = await response.text();
    await writeFile(`public/kanji/${id}.svg`, svg);
    const paths = [...svg.matchAll(/<path[^>]*\sd="([^"]+)"/g)].map(m => m[1]);
    const strokes = await page.evaluate(paths => paths.map(d => {
      const p = document.createElementNS("http://www.w3.org/2000/svg", "path"); p.setAttribute("d", d);
      const length = p.getTotalLength();
      return Array.from({ length: 40 }, (_, i) => { const v = p.getPointAtLength(length * i / 39); return { x: +v.x.toFixed(3), y: +v.y.toFixed(3) }; });
    }), paths);
    kanji.push({ id, character, meaning, reading, paths, strokes });
  }
  await writeFile("content/kanji-data.json", JSON.stringify({ revision, kanji }, null, 2) + "\n");
  const license = await fetch(`https://raw.githubusercontent.com/KanjiVG/kanjivg/${revision}/COPYING`);
  if (!license.ok) throw new Error("KanjiVG license unavailable");
  await writeFile("public/kanji/COPYING.txt", await license.text());
  console.log(`Bundled ${kanji.length} KanjiVG characters at ${revision}`);
} finally { await browser.close(); }
