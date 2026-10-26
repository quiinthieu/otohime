// QA run-8834, t-1559: an independent probe of Ryugu-jo against a live server (default https://otohime.dev).
// It is written apart from e2e/ryugu.test.ts and shares none of its helpers. It counts requestAnimationFrame
// callbacks and WebGL context requests through an init script, and it fakes a hidden page by overriding
// document.hidden and visibilityState and then dispatching visibilitychange.
// Negative controls: typing "urashimx" must not go down; a lone "a" must not reach /ryugu; the live sea must run
// frames, so that zero frames under the fallbacks is not vacuous.
//   node probe.mjs [base]   exit 0 when every check holds, 1 otherwise. The probe kills itself after 150 s.
import { chromium } from "playwright-core";

const BASE = process.argv[2] ?? "https://otohime.dev";
setTimeout(() => { console.error("probe: hard timeout"); process.exit(2); }, 150_000).unref();

const ARGS = ["--enable-unsafe-swiftshader", "--use-angle=swiftshader"];
const results = [];
const check = (name, ok, detail) => { results.push({ name, ok: !!ok, detail }); };

const COUNTER = () => {
  window.__rafs = 0; window.__gl = 0;
  const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (cb) => raf((t) => { window.__rafs++; cb(t); });
  const gc = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (kind, ...rest) {
    if (/webgl/.test(String(kind))) window.__gl++;
    return gc.call(this, kind, ...rest);
  };
};

async function ctx(browser, opts = {}) {
  const c = await browser.newContext(opts);
  await c.addInitScript(COUNTER);
  const page = await c.newPage();
  page.errors = [];
  page.on("pageerror", (e) => page.errors.push(String(e)));
  return { c, page };
}
const path = (page) => new URL(page.url()).pathname;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function sea(page) {
  return page.evaluate(() => {
    const el = document.querySelector("[data-water]");
    const fish = [...document.querySelectorAll("[data-fish]")].map((f) => f.getAttribute("transform"));
    return { mode: el?.getAttribute("data-water") ?? null, rafs: window.__rafs, gl: window.__gl, fish };
  });
}

const browser = await chromium.launch({ channel: "chrome", args: ARGS });
const noGL = await chromium.launch({ channel: "chrome", args: ["--disable-webgl", "--disable-3d-apis", "--disable-gpu"] });
try {
  // 1. keyboard: urashima on Home
  {
    const { c, page } = await ctx(browser);
    await page.goto(`${BASE}/`, { waitUntil: "load" });
    await page.locator("body").click({ position: { x: 5, y: 5 } }).catch(() => {});
    await page.keyboard.type("urashima", { delay: 60 });
    await page.waitForURL("**/ryugu", { timeout: 10_000 }).catch(() => {});
    check("keyboard: urashima on / reaches /ryugu", path(page) === "/ryugu", page.url());
    await c.close();
  }
  // negative control: a near-miss word must not go down
  {
    const { c, page } = await ctx(browser);
    await page.goto(`${BASE}/`, { waitUntil: "load" });
    await page.locator("body").click({ position: { x: 5, y: 5 } }).catch(() => {});
    await page.keyboard.type("urashimx", { delay: 60 });
    await sleep(1500);
    check("negative: urashimx does not reach /ryugu", path(page) !== "/ryugu", page.url());
    await c.close();
  }
  // 2. Pocket Dive chip
  {
    const { c, page } = await ctx(browser);
    await page.goto(`${BASE}/`, { waitUntil: "load" });
    const chip = page.locator("a[data-pocket-ryugu]").first();
    const href = await chip.getAttribute("href");
    await chip.click();
    await page.waitForURL("**/ryugu", { timeout: 10_000 }).catch(() => {});
    check("pocket: Dive chip reaches /ryugu", href === "/ryugu" && path(page) === "/ryugu", `${href} -> ${page.url()}`);
    await c.close();
  }
  // 3. below-waterline footer, by touch on a phone viewport
  {
    const { c, page } = await ctx(browser, { hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });
    await page.goto(`${BASE}/notes`, { waitUntil: "load", timeout: 30_000 });
    await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
    const link = page.locator("a[data-end-ryugu]").first();
    await link.waitFor({ state: "visible", timeout: 10_000 });
    await link.tap();
    await page.waitForURL("**/ryugu", { timeout: 10_000 }).catch(() => {});
    check("footer: waterline tap reaches /ryugu", path(page) === "/ryugu", page.url());
    // isolation: the palace document carries none of the site's chrome or Tailwind
    const iso = await page.evaluate(() => ({
      sheets: [...document.styleSheets].map((s) => s.href).filter(Boolean),
      tw: [...document.styleSheets].some((s) => { try { return [...s.cssRules].some((r) => /--tw-|tailwind/.test(r.cssText)); } catch { return false; } }),
      // the site's own chrome; the palace has a <header> of its own, so a bare header is not a leak
      chrome: !!document.querySelector("footer.end, section[aria-label='Pocket console'], [data-end-waterline]"),
    }));
    check("isolation: no Tailwind rules and no site footer/Pocket on /ryugu", !iso.tw && !iso.chrome, JSON.stringify(iso));
    const site = await (await c.newPage()).goto(`${BASE}/`).then(async (r) => (await r.text()).match(/\/_next\/static\/[^"]+\.css/g) ?? []);
    const shared = iso.sheets.filter((h) => site.some((x) => h.endsWith(x)));
    check("isolation: /ryugu shares no stylesheet with / (and / has sheets)", site.length > 0 && shared.length === 0, `site=${site.length} shared=${shared.length}`);
    check("footer path: no page errors", page.errors.length === 0, page.errors.join(" | "));
    await c.close();
  }
  // 4. live sea with WebGL: frames run and the fish move (the positive baseline the fallbacks are measured against)
  let live;
  {
    const { c, page } = await ctx(browser);
    await page.goto(`${BASE}/ryugu`, { waitUntil: "load" });
    await sleep(1500);
    const a = await sea(page);
    await page.mouse.move(400, 300); await sleep(300); await page.mouse.move(420, 320);
    await sleep(1000);
    const b = await sea(page);
    live = b;
    check("live: data-water=live with WebGL", b.mode === "live", JSON.stringify({ mode: b.mode, gl: b.gl }));
    check("live: frames run (>=20 in 2.8s)", b.rafs >= 20, `rafs=${b.rafs}`);
    check("live: fish move", JSON.stringify(a.fish) !== JSON.stringify(b.fish), `fish=${b.fish.length}`);
    // hidden: frames stop, and resume when visible again
    await page.evaluate(() => {
      Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
      Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await sleep(300);
    const h0 = (await sea(page)).rafs; await sleep(1200); const h1 = (await sea(page)).rafs;
    check("hidden: no frames while document.hidden", h1 - h0 <= 1, `delta=${h1 - h0}`);
    await page.evaluate(() => {
      Object.defineProperty(document, "hidden", { configurable: true, get: () => false });
      Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "visible" });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await sleep(1000);
    const v = (await sea(page)).rafs;
    check("visible again: frames resume", v - h1 >= 10, `delta=${v - h1}`);
    check("live: no page errors", page.errors.length === 0, page.errors.join(" | "));
    await c.close();
  }
  // 5. no WebGL: static scene, no frames
  {
    const { c, page } = await ctx(noGL);
    await page.goto(`${BASE}/ryugu`, { waitUntil: "load" });
    await sleep(2000);
    const s = await sea(page);
    check("no-WebGL: data-water=static, fish served", s.mode === "static" && s.fish.length > 0, JSON.stringify({ mode: s.mode, fish: s.fish.length, gl: s.gl }));
    check("no-WebGL: no animation frames (live baseline ran)", s.rafs <= 2 && live.rafs >= 20, `rafs=${s.rafs} live=${live.rafs}`);
    check("no-WebGL: no page errors", page.errors.length === 0, page.errors.join(" | "));
    await c.close();
  }
  // 6. reduced motion: still, no WebGL requested, no frames
  {
    const { c, page } = await ctx(browser, { reducedMotion: "reduce" });
    await page.goto(`${BASE}/ryugu`, { waitUntil: "load" });
    await sleep(2000);
    const s = await sea(page);
    check("reduced motion: data-water=still, no WebGL context requested", s.mode === "still" && s.gl === 0, JSON.stringify({ mode: s.mode, gl: s.gl }));
    check("reduced motion: no animation frames", s.rafs <= 2, `rafs=${s.rafs}`);
    await c.close();
  }
} finally {
  await browser.close(); await noGL.close();
}
for (const r of results) console.log(`${r.ok ? "ok  " : "FAIL"} ${r.name}  [${r.detail}]`);
const failed = results.filter((r) => !r.ok).length;
console.log(`${results.length - failed}/${results.length} checks hold against ${BASE}`);
process.exit(failed ? 1 : 0);
