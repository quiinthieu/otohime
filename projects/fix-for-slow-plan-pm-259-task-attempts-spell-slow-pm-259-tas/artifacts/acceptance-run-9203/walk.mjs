import { createRequire } from "node:module";
const require = createRequire(process.argv[2] + "/package.json");
const { chromium } = require("playwright-core");
const BASE = "https://otohime.dev";
const out = { at: new Date().toISOString(), viewports: {} };
const browser = await chromium.launch({ channel: "chrome", headless: true });
async function ctx(viewport, touch) {
  const c = await browser.newContext({ viewport, hasTouch: touch, isMobile: touch, deviceScaleFactor: 1 });
  const p = await c.newPage();
  const log = { console: [], pageErrors: [], failed: [] };
  p.on("console", (m) => m.type() === "error" && log.console.push(`${m.text()} @ ${m.location().url}`));
  p.on("pageerror", (e) => log.pageErrors.push(String(e)));
  p.on("requestfailed", (r) => log.failed.push(`${r.url()} ${r.failure()?.errorText}`));
  return { c, p, log };
}
async function visit(p, path) {
  const r = await p.goto(BASE + path, { waitUntil: "load", timeout: 30000 });
  await p.waitForTimeout(800);
  return {
    path, status: r.status(),
    sha: await p.locator('meta[name="build-sha"]').getAttribute("content").catch(() => null),
    title: await p.title(),
    h1: (await p.locator("main h1").first().textContent({ timeout: 5000 }).catch(() => null))?.trim().slice(0, 80) ?? null,
    overflowX: await p.evaluate(() => document.documentElement.scrollWidth - innerWidth),
  };
}
async function tapeSwipe(p, id, dx) {
  const sel = `[data-desk-item="${id}"] .desk-tape`;
  await p.locator(sel).scrollIntoViewIfNeeded({ timeout: 5000 });
  await p.waitForTimeout(500);
  const c = await p.evaluate((s) => { const r = document.querySelector(s).getBoundingClientRect(); const x = r.x + r.width / 2, y = r.y + r.height / 2; const h = document.elementFromPoint(x, y); return { x, y, hitIsTape: h === document.querySelector(s) }; }, sel);
  const before = await p.locator(`[data-desk-item="${id}"]`).evaluate((el) => el.style.left);
  const cdp = await p.context().newCDPSession(p);
  const t = (type, x, y) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x, y, id: 1 }] });
  await t("touchStart", c.x, c.y);
  let sawDragging = false;
  for (let i = 1; i <= 10; i++) {
    await t("touchMove", c.x + (dx * i) / 10, c.y);
    await p.waitForTimeout(30);
    if (await p.locator(`[data-desk-item="${id}"][data-dragging]`).count()) sawDragging = true;
  }
  await t("touchEnd", c.x + dx, c.y);
  await cdp.detach();
  await p.waitForTimeout(500);
  const after = await p.locator(`[data-desk-item="${id}"]`).evaluate((el) => el.style.left);
  const stored = await p.evaluate(() => localStorage.getItem("desk:v1"));
  return { hitIsTape: c.hitIsTape, before, after, sawDragging, stored: stored ? stored.slice(0, 160) : null };
}
for (const [name, vp, touch] of [["1366x768", { width: 1366, height: 768 }, false], ["390x844", { width: 390, height: 844 }, true]]) {
  const { c, p, log } = await ctx(vp, touch);
  const pages = [];
  for (const path of ["/", "/desk", "/music", "/projects", "/notes", "/sketches", "/ledger", "/api/health"]) {
    try { pages.push(await visit(p, path)); } catch (e) { pages.push({ path, error: String(e).slice(0, 200) }); }
  }
  pages.find((x) => x.path === "/api/health").body = await p.evaluate(() => document.body.innerText.slice(0, 200));
  await p.goto(BASE + "/desk", { waitUntil: "load" });
  await p.evaluate(() => localStorage.removeItem("desk:v1"));
  await p.reload({ waitUntil: "load" });
  await p.waitForTimeout(1000);
  const swipe = await tapeSwipe(p, "music", 120);
  await p.reload({ waitUntil: "load" });
  await p.waitForTimeout(1000);
  swipe.afterReload = await p.locator('[data-desk-item="music"]').evaluate((el) => el.style.left);
  await p.screenshot({ path: `/tmp/acc/desk-${name}.png` });
  await p.evaluate(() => localStorage.removeItem("desk:v1"));
  out.viewports[name] = { pages, swipe, log };
  await c.close();
}
await browser.close();
console.log(JSON.stringify(out, null, 1));
