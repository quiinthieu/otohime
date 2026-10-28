// Independent, read-only hosted fallback observation. No synthetic network or sockets.
import assert from "node:assert/strict";
import { launchBrowser } from "../../../../scripts/probe-browser.mjs";

const base = process.argv[2] || "https://otohime.dev";
const browser = await launchBrowser({ log: () => {}, options: { env: { ...process.env, TMPDIR: "/tmp" } } });
const observations = [], errors = [], sockets = [];
try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: "no-preference" });
  const page = await context.newPage();
  page.on("pageerror", error => errors.push(error.message));
  page.on("websocket", socket => sockets.push(socket.url()));
  const configPromise = page.waitForResponse(r => r.url().endsWith("/api/ghosts?probe=1"), { timeout: 15000 });
  assert.equal((await page.goto(base, { waitUntil: "domcontentloaded" })).status(), 200);
  await page.locator("main h1").first().waitFor({ state: "visible" });
  const config = await configPromise;
  assert.equal(config.status(), 200); assert.equal(await config.json(), null);
  await page.waitForFunction(() => document.querySelector("[data-ghosts-state]")?.getAttribute("data-ghosts-state") === "off");
  const toggle = page.locator("[data-pocket-ghosts]");
  await toggle.waitFor({ state: "visible" });
  assert.equal(await toggle.getAttribute("aria-pressed"), "true");
  await toggle.click();
  await page.waitForFunction(() => localStorage.getItem("ghosts") === "hidden");
  observations.push({ path: "/", status: 200, config: null, fallback: "off", pocket: "hidden" });
  assert.equal((await page.goto(`${base}/ryugu`, { waitUntil: "domcontentloaded" })).status(), 200);
  await page.locator("main h1").first().waitFor({ state: "visible" });
  assert.equal(await page.evaluate(() => localStorage.getItem("ghosts")), "hidden");
  observations.push({ path: "/ryugu", status: 200, pocket: "hidden" });
  await page.goto(base, { waitUntil: "domcontentloaded" });
  await toggle.waitFor({ state: "visible" });
  assert.equal(await toggle.getAttribute("aria-pressed"), "false");
  await toggle.click();
  await page.waitForFunction(() => localStorage.getItem("ghosts") === null);
  observations.push({ path: "/", pocket: "restored-on" });
  await context.close();
  const reduced = await browser.newContext({ reducedMotion: "reduce" });
  const reducedPage = await reduced.newPage();
  let reducedConfigReads = 0;
  reducedPage.on("pageerror", error => errors.push(error.message));
  reducedPage.on("websocket", socket => sockets.push(socket.url()));
  reducedPage.on("request", r => { if (r.url().includes("/api/ghosts")) reducedConfigReads++; });
  await reducedPage.goto(`${base}/ryugu`, { waitUntil: "domcontentloaded" });
  await reducedPage.waitForSelector("[data-ghosts-state='off']", { state: "attached" });
  assert.equal(reducedConfigReads, 0);
  observations.push({ path: "/ryugu", reducedMotion: "off", configReads: reducedConfigReads });
  assert.deepEqual(errors, []); assert.deepEqual(sockets, []);
  const health = await (await reducedPage.request.get(`${base}/api/health`)).json();
  console.log(JSON.stringify({ browser: browser.version(), health, observations, pageErrors: errors, webSockets: sockets.length,
    boundary: "Real hosted Chrome fallback and browser-local preference only; no fan-out, Worker identity or product delivery established" }, null, 2));
  await reduced.close();
} finally { await browser.close(); }
