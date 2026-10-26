// Acceptance walk for pm-248 run-8581 against the live site. Scratch file, not part of the repo.
import { chromium } from "playwright-core";

const BASE = "https://otohime.dev";
const WIDTHS = [
  { w: 1366, h: 768 },
  { w: 390, h: 844 },
];
const rows = [];
const results = [];
function rec(id, ok, detail) {
  results.push(ok);
  rows.push(`${ok ? "PASS" : "FAIL"} | ${id} | ${detail}`);
}

const browser = await chromium.launch();

for (const { w, h } of WIDTHS) {
  const tag = `[${w}x${h}]`;
  const errors = [];
  const askCalls = [];

  // 1. Anonymous visitor in Sydney, default motion.
  const ctx = await browser.newContext({
    viewport: { width: w, height: h },
    timezoneId: "Australia/Sydney",
    reducedMotion: "no-preference",
  });
  const page = await ctx.newPage();
  page.on("console", (m) => m.type() === "error" && errors.push(`console: ${m.text()}`));
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("response", (r) => r.status() >= 400 && errors.push(`http ${r.status()} ${r.request().method()} ${r.url()}`));
  page.on("request", (r) => r.url().includes("/api/ask") && askCalls.push(r.method() + " " + r.url()));

  const res = await page.goto(BASE + "/", { waitUntil: "load" });
  rec(`${tag} home status`, res.status() === 200, `status=${res.status()}`);
  const sha = await page.locator('meta[name="build-sha"]').getAttribute("content");
  rec(`${tag} home build-sha`, sha === "d8a9be17b0cc16d26c8f774d83ce118de874cdf2", `build-sha=${sha}`);

  const season = await page.locator("html").getAttribute("data-season");
  rec(`${tag} clock+zone season (Sydney, 26 Oct)`, season === "spring", `data-season=${season}`);

  const layer = await page.evaluate(() => {
    const s = document.querySelector("svg.season-layer");
    if (!s) return null;
    const cs = getComputedStyle(s);
    return {
      aria: s.getAttribute("aria-hidden"),
      pe: cs.pointerEvents,
      z: cs.zIndex,
      bits: s.querySelectorAll(".almanac-bit").length,
      total: s.querySelectorAll("*").length,
    };
  });
  rec(`${tag} ambient layer`, !!layer && layer.aria === "true" && layer.pe === "none" && layer.bits > 0 && layer.total <= 40,
    JSON.stringify(layer));

  // Season dial: pick winter with a click on its label.
  const dial = page.locator('[data-season-dial] input[type="radio"]');
  const dialCount = await dial.count();
  rec(`${tag} season dial radios`, dialCount === 5, `radios=${dialCount}`);
  // Folded (<40rem): only the picked stop shows and each tap on it turns to the next. Tap until winter.
  for (let i = 0; i < 8; i++) {
    if ((await page.locator("html").getAttribute("data-season")) === "winter") break;
    const winter = page.locator('[data-season-dial] label:has(input[value="winter"])').first();
    const winterIsHit = await winter.evaluate((l) => {
      const r = l.getBoundingClientRect();
      return document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)?.closest("label") === l;
    });
    if (winterIsHit) await winter.click();
    else await page.locator("[data-season-dial] label:has(input:checked)").first().click();
    await page.waitForTimeout(250);
  }
  const picked = await page.locator("html").getAttribute("data-season");
  rec(`${tag} dial pick winter`, picked === "winter", `data-season=${picked}`);
  await page.reload({ waitUntil: "load" });
  const after = await page.locator("html").getAttribute("data-season");
  const stored = await page.evaluate(() => localStorage.getItem("season"));
  rec(`${tag} dial pick persists across reload`, after === "winter" && stored === "winter", `data-season=${after} localStorage=${stored}`);
  await page.locator('[data-season-dial] input[value="auto"]').check({ force: true }).catch(() => {});
  await page.waitForTimeout(200);
  await page.evaluate(() => localStorage.removeItem("season"));

  // 2. Ask the Ink: open the console, ask a question, watch the answer.
  askCalls.length = 0;
  await page.getByText("Ask the console", { exact: false }).first().click();
  const dlg = page.locator("dialog.ask-console");
  await dlg.waitFor({ state: "visible", timeout: 15000 });
  const input = dlg.locator("input, textarea").first();
  await input.fill("what is your work");
  await input.press("Enter");
  await dlg.locator('a[href="/work"]').first().waitFor({ state: "attached", timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(500);
  const text = (await dlg.innerText()).replace(/\s+/g, " ");
  const answered = /WORK:/.test(text);
  rec(`${tag} ask: canned answer types out`, answered, `contains WORK: ${answered}; excerpt="${text.slice(0, 120)}"`);
  const citations = await dlg.locator("a[href]").evaluateAll((as) => as.map((a) => [a.textContent.trim(), a.getAttribute("href")]));
  rec(`${tag} ask: citations link to source page`, citations.some(([, href]) => href === "/work"), JSON.stringify(citations));
  rec(`${tag} ask: model endpoint /api/ask called by console`, askCalls.length > 0,
    `requests to /api/ask=${askCalls.length} ${askCalls.join(" ; ")}`);

  // Direct probe of the model endpoint from the same origin.
  const direct = await page.evaluate(async () => {
    const r = await fetch("/api/ask", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ question: "what is your work" }),
    });
    return r.status;
  });
  rec(`${tag} ask: POST /api/ask from origin`, direct === 200, `status=${direct}`);
  await page.keyboard.press("Escape");
  await ctx.close();

  // 3. 404 with JavaScript on.
  const ctx2 = await browser.newContext({ viewport: { width: w, height: h }, reducedMotion: "no-preference" });
  const p2 = await ctx2.newPage();
  const errs2 = [];
  p2.on("pageerror", (e) => errs2.push(e.message));
  const r404 = await p2.goto(BASE + "/acc-lost-probe-8581", { waitUntil: "load" });
  rec(`${tag} unknown path status`, r404.status() === 404, `status=${r404.status()}`);
  const sheetLinks = await p2.locator("a[href]").evaluateAll((as) =>
    as.map((a) => a.getAttribute("href")).filter((h) => ["/", "/work", "/projects", "/notes", "/play"].includes(h)));
  rec(`${tag} 404 five plain links`, new Set(sheetLinks).size === 5, `links=${JSON.stringify([...new Set(sheetLinks)])}`);
  const smooth = p2.getByRole("button", { name: /smooth it out/i });
  const hasSmooth = (await smooth.count()) > 0;
  rec(`${tag} 404 smooth island (JS on)`, hasSmooth, `button=${hasSmooth}`);
  let trail = [];
  for (let i = 0; i < 6 && (await smooth.count()) > 0 && (await smooth.isEnabled()); i++) {
    await smooth.click();
    trail.push((await p2.locator("body").innerText()).match(/(\d+% smooth\.|Flat again\. Pick a way back\.)/)?.[1] ?? "?");
  }
  rec(`${tag} 404 smooth to flat`, trail.at(-1) === "Flat again. Pick a way back.", `trail=${JSON.stringify(trail)}`);
  await ctx2.close();

  // 4. 404 with JavaScript disabled: links must navigate.
  const ctx3 = await browser.newContext({ viewport: { width: w, height: h }, javaScriptEnabled: false });
  const p3 = await ctx3.newPage();
  await p3.goto(BASE + "/acc-lost-probe-8581", { waitUntil: "load" });
  const nojsCodes = {};
  for (const path of ["/", "/work", "/projects", "/notes", "/play"]) {
    const r = await ctx3.request.get(BASE + path, { maxRedirects: 5 });
    nojsCodes[path] = r.status();
  }
  rec(`${tag} 404 no-JS links reachable`, Object.values(nojsCodes).every((c) => c === 200), JSON.stringify(nojsCodes));
  await ctx3.close();

  // 5. Reduced motion: flat sheet, no island, no running bits.
  const ctx4 = await browser.newContext({ viewport: { width: w, height: h }, reducedMotion: "reduce" });
  const p4 = await ctx4.newPage();
  await p4.goto(BASE + "/acc-lost-probe-8581", { waitUntil: "load" });
  const rmIsland = await p4.getByRole("button", { name: /smooth it out/i }).count();
  await p4.goto(BASE + "/", { waitUntil: "load" });
  const rmBits = await p4.evaluate(() => document.querySelectorAll(".season-layer .almanac-bit").length);
  rec(`${tag} reduced motion: no island, no layer bits`, rmIsland === 0 && rmBits === 0, `island=${rmIsland} layerBits=${rmBits}`);
  await ctx4.close();

  // 6. Overflow on home at this width.
  const ctx5 = await browser.newContext({ viewport: { width: w, height: h } });
  const p5 = await ctx5.newPage();
  await p5.goto(BASE + "/", { waitUntil: "load" });
  const overflow = await p5.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  rec(`${tag} home no horizontal overflow`, overflow <= 0, `overflow=${overflow}`);
  await ctx5.close();

  rec(`${tag} console/page errors (home, Ask, 404)`, errors.length === 0 && errs2.length === 0,
    JSON.stringify([...errors, ...errs2].slice(0, 5)));
}

await browser.close();
console.log(rows.join("\n"));
console.log(`SUMMARY ${results.filter(Boolean).length}/${results.length} pass`);
