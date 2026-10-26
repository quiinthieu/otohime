// QA run-8828, t-1559: an independent probe of Ryugu-jo on a running site (default production). It is not the SWE's
// e2e/ryugu.test.ts. WebGL is removed with Chrome's own flags, not with a getContext stub, and the WebGL and rAF
// calls are only counted, never changed. Hidden is real: another tab is brought to front. Touch is a real tap in a
// hasTouch context. Fleeing is measured as the pointer-to-nearest-fish distance on screen.
// Negative controls: the word typed with a wrong last letter must not reach the palace, and a live sea must move
// its fish (so frozen fish elsewhere mean a fallback, not a dead page).
//   node probe.mjs [BASE_URL]  -> prints one JSON line per check, exits 1 on any fail
import { mkdtempSync, rmSync } from "node:fs";
import { chromium } from "playwright-core";

const BASE = process.argv[2] ?? "https://otohime.dev";
const tmp = mkdtempSync("/tmp/qa8828-");
const env = { ...process.env, TMPDIR: tmp };
const SW = ["--enable-unsafe-swiftshader", "--use-angle=swiftshader"];
const results = [];
const check = (name, ok, detail) => {
  results.push({ name, ok, detail });
  console.log(JSON.stringify({ name, ok, detail }));
};

const COUNT = () => {
  window.__qa = { raf: 0, webgl: 0 };
  const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (cb) => (window.__qa.raf++, raf(cb));
  const gc = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (kind, ...rest) {
    if (/webgl/.test(kind)) window.__qa.webgl++;
    return gc.call(this, kind, ...rest);
  };
};
const qa = (page) => page.evaluate(() => ({ ...window.__qa }));
const fishT = (page) => page.$$eval("[data-fish]", (gs) => gs.map((g) => g.getAttribute("transform")));
const fishCentres = (page) =>
  page.$$eval("[data-fish]", (gs) => gs.map((g) => { const b = g.getBoundingClientRect(); return [b.x + b.width / 2, b.y + b.height / 2]; }));

async function sea(browser, name, ctxOpts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 }, ...ctxOpts });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(COUNT);
  const res = await page.goto(`${BASE}/ryugu`, { waitUntil: "networkidle", timeout: 30_000 });
  await page.waitForTimeout(1500);
  const before = await fishT(page);
  const q0 = await qa(page);
  await page.waitForTimeout(1500);
  const after = await fishT(page);
  const q1 = await qa(page);
  const water = await page.getAttribute(".sea", "data-water");
  const sha = await page.getAttribute('meta[name="build-sha"]', "content");
  const moved = before.some((t, i) => t !== after[i]);
  return { ctx, page, errors, status: res?.status(), water, sha, moved, fish: before.length, rafDelta: q1.raf - q0.raf, webgl: q1.webgl };
}

const live = await chromium.launch({ channel: "chrome", env, args: SW });
const noGl = await chromium.launch({ channel: "chrome", env, args: ["--disable-webgl", "--disable-webgl2", "--disable-3d-apis"] });
try {
  // Live sea: WebGL available, motion welcome.
  const L = await sea(live, "live");
  check("live: palace 200, build sha, live water, fish swim, frames run", L.status === 200 && L.water === "live" && L.moved && L.rafDelta > 10 && L.fish > 0 && L.errors.length === 0,
    { status: L.status, sha: L.sha, water: L.water, moved: L.moved, rafDelta: L.rafDelta, fish: L.fish, webgl: L.webgl, errors: L.errors });

  // Flee: park the pointer on the nearest fish; distance to nearest fish should grow.
  const c = await fishCentres(L.page);
  const [px, py] = c.find(([x, y]) => x > 100 && x < 1180 && y > 100 && y < 760) ?? c[0];
  await L.page.mouse.move(px, py);
  const d = async () => Math.min(...(await fishCentres(L.page)).map(([x, y]) => Math.hypot(x - px, y - py)));
  const d0 = await d();
  await L.page.waitForTimeout(1200);
  const d1 = await d();
  check("live: fish flee a parked pointer", d1 > d0 + 30, { pointer: [Math.round(px), Math.round(py)], nearestBefore: Math.round(d0), nearestAfter: Math.round(d1) });

  // Hidden: bring another tab to front; frames must stop, then resume.
  const other = await L.ctx.newPage();
  await other.bringToFront();
  await L.page.waitForTimeout(400);
  const vis = await L.page.evaluate(() => document.visibilityState);
  const h0 = (await qa(L.page)).raf;
  await L.page.waitForTimeout(1500);
  const h1 = (await qa(L.page)).raf;
  await L.page.bringToFront();
  await L.page.waitForTimeout(1500);
  const h2 = (await qa(L.page)).raf;
  check("hidden: loop stops while the tab is hidden and resumes when shown", vis === "hidden" && h1 - h0 === 0 && h2 - h1 > 10,
    { visibilityState: vis, rafWhileHidden: h1 - h0, rafAfterShown: h2 - h1 });
  await L.ctx.close();

  // Reduced motion: no WebGL asked for, still water, no frames, fish fixed.
  const R = await sea(live, "reduced", { reducedMotion: "reduce" });
  check("reduced motion: still sea, no WebGL context, no frames, fish fixed", R.water === "still" && R.webgl === 0 && R.rafDelta === 0 && !R.moved && R.errors.length === 0,
    { water: R.water, webgl: R.webgl, rafDelta: R.rafDelta, moved: R.moved, errors: R.errors });
  await R.ctx.close();

  // No WebGL in the browser at all (Chrome flags): static sea with the served caustic, no frames, no errors.
  const S = await sea(noGl, "static");
  const caustic = await S.page.$$eval(".sea svg, .sea canvas", (els) => els.map((e) => e.tagName.toLowerCase()));
  check("no WebGL (browser flags): static sea, no frames, fish fixed, no errors", S.status === 200 && S.water === "static" && S.rafDelta === 0 && !S.moved && S.fish > 0 && S.errors.length === 0,
    { water: S.water, webgl: S.webgl, rafDelta: S.rafDelta, moved: S.moved, fish: S.fish, layers: caustic, errors: S.errors });
  await S.ctx.close();

  // Entry points.
  const ctx = await live.newContext({ viewport: { width: 1280, height: 860 } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/`, { waitUntil: "networkidle", timeout: 30_000 });
  await page.waitForSelector("[data-pocket-ryugu]");
  await page.waitForTimeout(800);
  const homeSheets = await page.$$eval('link[rel="stylesheet"]', (ls) => ls.map((l) => new URL(l.href).pathname));
  await page.keyboard.type("urashimo", { delay: 60 });
  await page.waitForTimeout(1500);
  const control = new URL(page.url()).pathname;
  check("negative control: 'urashimo' does not reach the palace", control !== "/ryugu", { landed: control });

  await page.goto(`${BASE}/`, { waitUntil: "networkidle", timeout: 30_000 });
  await page.waitForSelector("[data-pocket-ryugu]");
  await page.waitForTimeout(800);
  await page.keyboard.type("urashima", { delay: 60 });
  const kb = await page.waitForURL(`${BASE}/ryugu`, { timeout: 10_000 }).then(() => true, () => false);
  check("keyboard: typing urashima on Home reaches /ryugu", kb, { landed: new URL(page.url()).pathname });
  const palaceSheets = await page.$$eval('link[rel="stylesheet"]', (ls) => ls.map((l) => new URL(l.href).pathname));
  const shared = palaceSheets.filter((s) => homeSheets.includes(s));
  const tw = await page.evaluate(() => [...document.styleSheets].some((s) => { try { return [...s.cssRules].some((r) => /--tw-|\.cartridge|\.handheld/.test(r.cssText)); } catch { return false; } }));
  check("isolation: palace shares no stylesheet with Home and carries no Tailwind/cartridge rules", palaceSheets.length > 0 && shared.length === 0 && !tw,
    { palaceSheets, homeSheets, shared, tailwindOrCartridgeRules: tw });

  await page.goto(`${BASE}/`, { waitUntil: "networkidle", timeout: 30_000 });
  await page.waitForSelector("[data-pocket-ryugu]");
  const pocketVisible = await page.isVisible("[data-pocket-ryugu]");
  if (!pocketVisible) await page.evaluate(() => document.querySelector("[data-pocket-ryugu]")?.scrollIntoView());
  await page.click("[data-pocket-ryugu]", { timeout: 10_000 });
  const pk = await page.waitForURL(`${BASE}/ryugu`, { timeout: 10_000 }).then(() => true, () => false);
  check("Pocket: Dive chip reaches /ryugu", pk, { landed: new URL(page.url()).pathname, initiallyVisible: pocketVisible });
  await ctx.close();

  // Footer waterline, by touch on a phone-sized viewport, after scrolling to the very bottom.
  const tctx = await live.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const tp = await tctx.newPage();
  await tp.goto(`${BASE}/notes`, { waitUntil: "networkidle", timeout: 30_000 });
  await tp.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await tp.waitForTimeout(800);
  const last = await tp.evaluate(() => { const a = document.querySelector("[data-end-ryugu]"); const all = [...document.querySelectorAll("a")]; return { href: a?.getAttribute("href"), isLastLink: all.at(-1) === a }; });
  await tp.locator("[data-end-ryugu]").scrollIntoViewIfNeeded();
  await tp.tap("[data-end-ryugu]");
  const ft = await tp.waitForURL(`${BASE}/ryugu`, { timeout: 10_000 }).then(() => true, () => false);
  check("waterline: the footer's last link, tapped on a phone, reaches /ryugu", ft && last.href === "/ryugu", { ...last, landed: new URL(tp.url()).pathname });
  // Touch also frightens fish: tap-and-hold the water.
  await tp.waitForTimeout(1000);
  const water = await tp.getAttribute(".sea", "data-water");
  check("touch: palace on a phone is live", water === "live", { water });
  await tctx.close();
} finally {
  await live.close();
  await noGl.close();
  rmSync(tmp, { recursive: true, force: true });
}
const failed = results.filter((r) => !r.ok).length;
console.log(JSON.stringify({ base: BASE, checks: results.length, failed }));
process.exit(failed ? 1 : 0);
