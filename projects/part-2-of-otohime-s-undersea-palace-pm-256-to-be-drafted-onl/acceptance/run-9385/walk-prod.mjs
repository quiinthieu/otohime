// Read-only acceptance walk of public production (pm-257 run-9385). No interception, no config override.
import { createRequire } from "node:module";
import { writeFileSync } from "node:fs";
import path from "node:path";
const [repo, OUT] = process.argv.slice(2);
const SITE = "https://otohime.dev";
const { chromium } = createRequire(path.join(repo, "package.json"))("playwright-core");
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rows = [];
const step = (r) => { rows.push(r); console.log(`${r.ok ? "PASS" : "FAIL"} [${r.viewport ?? "-"}] ${r.action} -> ${JSON.stringify(r.observed)}`); };

const health = await (await fetch(`${SITE}/api/health`)).json();
const direct = await fetch(`${SITE}/api/ghosts`);
const directBody = await direct.text();
const probe = await fetch(`${SITE}/api/ghosts?probe=1`);
const probeBody = await probe.text();
step({ start: "Public production", action: "GET /api/health, /api/ghosts, /api/ghosts?probe=1",
  observed: { health, ghosts: [direct.status, direct.headers.get("cache-control"), directBody.length], probe: [probe.status, probe.headers.get("cache-control"), probeBody] },
  ok: health.ok === true && direct.status === 404 && probe.status === 200 && probeBody.trim() === "null" });

const INIT = () => { window.__accSockets = 0; const N = window.WebSocket; window.WebSocket = class extends N { constructor(...a) { super(...a); window.__accSockets++; } }; };
const layer = (p) => p.evaluate(() => { const e = document.querySelector("[data-ghosts-state]"); return { state: e ? e.dataset.ghostsState : "absent", others: e ? Number(e.dataset.ghosts) : null, sockets: window.__accSockets, metaSha: document.querySelector('meta[name="build-sha"],meta[name="x-build-sha"]')?.content ?? null, overflowX: document.documentElement.scrollWidth > innerWidth }; });

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
for (const vp of [{ name: "desktop", width: 1366, height: 768 }, { name: "phone", width: 390, height: 844 }]) {
  const V = vp.name;
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
  await ctx.addInitScript(INIT);
  const page = await ctx.newPage();
  const errors = [], ghostReqs = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => m.type() === "error" && errors.push(`console: ${m.text()}`));
  page.on("request", (r) => r.url().includes("/api/ghosts") && ghostReqs.push(r.url().replace(SITE, "")));
  const res = await page.goto(`${SITE}/`, { waitUntil: "load" });
  await page.waitForFunction(() => document.querySelector("[data-ghosts-state]")?.dataset.ghostsState === "off", null, { timeout: 15000 }).catch(() => {});
  await sleep(1500);
  const home = await layer(page);
  await page.screenshot({ path: path.join(OUT, `prod-${V}-home.png`) });
  step({ viewport: V, start: "Fresh visitor, motion allowed", action: "Open Home", observed: { status: res.status(), layer: home, configRequests: [...ghostReqs] },
    ok: res.status() === 200 && home.state === "off" && home.sockets === 0 && !home.overflowX });

  const chip = page.locator("[data-pocket-ghosts]");
  await chip.scrollIntoViewIfNeeded();
  const before = { pressed: await chip.getAttribute("aria-pressed"), text: (await chip.textContent()).trim() };
  await chip.click();
  const after = { pressed: await chip.getAttribute("aria-pressed"), text: (await chip.textContent()).trim() };
  await page.reload({ waitUntil: "load" });
  await sleep(1500);
  const reloaded = { ...(await layer(page)), chip: (await page.locator("[data-pocket-ghosts]").textContent()).trim(), stored: await page.evaluate(() => localStorage.getItem("ghosts")) };
  step({ viewport: V, start: "Home, Ghosts on", action: "Press Pocket Ghosts chip, reload", observed: { before, after, reloaded },
    ok: before.pressed === "true" && after.pressed === "false" && reloaded.chip === "Ghosts off" && reloaded.stored === "hidden" && reloaded.sockets === 0 });

  ghostReqs.length = 0;
  const r2 = await page.goto(`${SITE}/ryugu`, { waitUntil: "load" });
  await sleep(2500);
  const palaceHidden = await layer(page);
  step({ viewport: V, start: "Ghosts hidden", action: "Open /ryugu", observed: { status: r2.status(), layer: palaceHidden, configRequests: [...ghostReqs] },
    ok: r2.status() === 200 && palaceHidden.state !== "on" && palaceHidden.sockets === 0 && ghostReqs.length === 0 });

  await page.goto(`${SITE}/`, { waitUntil: "load" });
  const chip2 = page.locator("[data-pocket-ghosts]");
  await chip2.scrollIntoViewIfNeeded();
  await chip2.click();
  ghostReqs.length = 0;
  await page.goto(`${SITE}/ryugu`, { waitUntil: "load" });
  await page.waitForFunction(() => document.querySelector("[data-ghosts-state]")?.dataset.ghostsState === "off", null, { timeout: 15000 }).catch(() => {});
  await sleep(1500);
  const palace = await layer(page);
  await page.screenshot({ path: path.join(OUT, `prod-${V}-ryugu.png`) });
  step({ viewport: V, start: "Ghosts re-enabled on Home", action: "Open /ryugu", observed: { layer: palace, configRequests: [...ghostReqs] },
    ok: palace.state === "off" && palace.sockets === 0 && !palace.overflowX });

  const rctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, reducedMotion: "reduce" });
  await rctx.addInitScript(INIT);
  const rp = await rctx.newPage();
  const rReqs = [], rErr = [];
  rp.on("request", (r) => r.url().includes("/api/ghosts") && rReqs.push(r.url()));
  rp.on("pageerror", (e) => rErr.push(e.message));
  for (const u of ["/", "/ryugu"]) { await rp.goto(`${SITE}${u}`, { waitUntil: "load" }); await sleep(2000); }
  const rl = await layer(rp);
  step({ viewport: V, start: "prefers-reduced-motion: reduce", action: "Open Home then /ryugu", observed: { layer: rl, configRequests: rReqs.length, pageErrors: rErr },
    ok: rl.state !== "on" && rl.sockets === 0 && rReqs.length === 0 && rErr.length === 0 });
  await rctx.close();
  step({ viewport: V, start: "Whole walk", action: "Collect page and console errors", observed: errors, ok: errors.length === 0 });
  await ctx.close();
}
await browser.close();
const h2 = await (await fetch(`${SITE}/api/health`)).json();
step({ start: "End of walk", action: "Re-read /api/health", observed: h2, ok: h2.sha === health.sha });
writeFileSync(path.join(OUT, "prod-result.json"), JSON.stringify({ at: new Date().toISOString(), rows }, null, 2));
const failed = rows.filter((r) => !r.ok).length;
console.log(`${rows.length - failed}/${rows.length} pass`);
