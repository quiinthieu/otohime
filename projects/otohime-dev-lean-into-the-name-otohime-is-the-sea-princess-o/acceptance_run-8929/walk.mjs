// Acceptance run-8929 (pm-256): independent user walk of Ryugu-jo on a live server at 1366x768 and 390x844.
// node walk.mjs [base] [shotsDir]  -> prints one JSON line per check; exit 0 if all hold.
import { chromium } from "playwright-core";
const BASE = process.argv[2] ?? "https://otohime.dev";
const SHOTS = process.argv[3] ?? "shots";
setTimeout(() => { console.error("walk: hard timeout"); process.exit(2); }, 240_000).unref();
const out = []; const check = (name, ok, detail) => { out.push({ name, ok: !!ok, detail }); console.log(JSON.stringify({ name, ok: !!ok, detail })); };
const INIT = () => { window.__f = 0; window.__gl = 0; const r = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (cb) => r((t) => { window.__f++; cb(t); });
  const g = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (k, ...a) { if (/webgl/.test(String(k))) window.__gl++; return g.call(this, k, ...a); }; };
const VP = { desk: { viewport: { width: 1366, height: 768 } }, phone: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 } };
const live = await chromium.launch({ channel: "chrome", args: ["--enable-unsafe-swiftshader", "--use-angle=swiftshader"] });
const nogl = await chromium.launch({ channel: "chrome", args: ["--disable-webgl", "--disable-3d-apis"] });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function open(b, vp, extra = {}) { const c = await b.newContext({ ...VP[vp], ...extra }); await c.addInitScript(INIT); const p = await c.newPage();
  p.errs = []; p.on("pageerror", (e) => p.errs.push(String(e))); p.on("console", (m) => { if (m.type() === "error") p.errs.push("console: " + m.text()); }); p.bad = [];
  p.on("response", (r) => { if (r.status() >= 400 && r.url().startsWith(BASE)) p.bad.push(r.status() + " " + r.url()); }); return { c, p }; }
const state = (p) => p.evaluate(() => ({ mode: document.querySelector("[data-water]")?.getAttribute("data-water"), fish: [...document.querySelectorAll("[data-fish]")].map((f) => f.getAttribute("transform")), f: window.__f, gl: window.__gl,
  sheets: [...document.querySelectorAll("link[rel=stylesheet]")].map((l) => new URL(l.href).pathname), footer: !!document.querySelector("[data-end-waterline],footer.end"), pocket: !!document.querySelector("[aria-label='Pocket console']"),
  robots: document.querySelector("meta[name=robots]")?.content, title: document.title, overflowX: document.documentElement.scrollWidth > innerWidth + 1 }));
const path = (p) => new URL(p.url()).pathname;
try {
  for (const vp of ["desk", "phone"]) {
    // 1 keyboard (desk only meaningful; phone has hardware keyboard rarely, still run on desk)
    if (vp === "desk") {
      const { c, p } = await open(live, vp); await p.goto(BASE + "/", { waitUntil: "load" }); await sleep(800);
      await p.keyboard.type("urashimx", { delay: 70 }); await sleep(1500);
      check(`${vp}: negative control 'urashimx' stays on /`, path(p) === "/", p.url());
      await p.goto(BASE + "/", { waitUntil: "load" }); await sleep(800);
      await p.keyboard.type("urashima", { delay: 70 }); await p.waitForURL("**/ryugu", { timeout: 10000 }).catch(() => {});
      check(`${vp}: typing urashima on / reaches /ryugu`, path(p) === "/ryugu", p.url()); await c.close();
    }
    // 2 Pocket Dive chip
    { const { c, p } = await open(live, vp); await p.goto(BASE + "/", { waitUntil: "load" });
      const chip = p.locator("section[aria-label='Pocket console'] a[data-pocket-ryugu]");
      await chip.waitFor({ timeout: 10000 }).catch(() => {}); await chip.scrollIntoViewIfNeeded().catch(() => {});
      await p.screenshot({ path: `${SHOTS}/${vp}-pocket.png` });
      const txt = await chip.innerText().catch(() => null);
      if (vp === "phone") await chip.tap().catch((e) => p.errs.push("tap " + e)); else await chip.click().catch((e) => p.errs.push("click " + e));
      await p.waitForURL("**/ryugu", { timeout: 10000 }).catch(() => {});
      check(`${vp}: Pocket chip '${txt}' reaches /ryugu`, path(p) === "/ryugu", p.url()); await c.close(); }
    // 3 footer waterline
    { const { c, p } = await open(live, vp); await p.goto(BASE + "/notes", { waitUntil: "load" });
      await p.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight)); await sleep(1200);
      const link = p.locator("a[data-end-ryugu]"); await link.scrollIntoViewIfNeeded().catch(() => {});
      const txt = await link.innerText().catch(() => null); await p.screenshot({ path: `${SHOTS}/${vp}-waterline.png` });
      if (vp === "phone") await link.tap().catch((e) => p.errs.push("tap " + e)); else await link.click().catch((e) => p.errs.push("click " + e));
      await p.waitForURL("**/ryugu", { timeout: 10000 }).catch(() => {});
      check(`${vp}: footer waterline '${txt}' reaches /ryugu`, path(p) === "/ryugu", p.url()); await c.close(); }
    // 4 live palace
    { const { c, p } = await open(live, vp); const res = await p.goto(BASE + "/ryugu", { waitUntil: "load" }); await sleep(1500);
      const a = await state(p);
      if (vp === "phone") await p.touchscreen.tap(195, 420); else { await p.mouse.move(683, 384); await p.mouse.move(700, 400, { steps: 10 }); }
      await sleep(2500); const b = await state(p); await p.screenshot({ path: `${SHOTS}/${vp}-palace-live.png` });
      const moved = a.fish.filter((t, i) => t !== b.fish[i]).length;
      check(`${vp}: /ryugu ${res.status()} live sea runs`, res.status() === 200 && b.mode === "live" && b.gl >= 1 && b.f - a.f >= 20, { mode: b.mode, gl: b.gl, frames: b.f - a.f });
      check(`${vp}: ink fish move/flee`, moved > 0, { fish: b.fish.length, moved });
      // Criterion: no cartridge/Tailwind CSS leaks in. pm-268 (fd99b92) adds the shared print-run sheet to every root layout; it styles no class.
      const css = await Promise.all(b.sheets.map((h) => p.request.get(BASE + h).then((r) => r.text())));
      const leak = css.filter((t) => /--tw-|\.machine\b|\.cartridge\b|\.chip\b|\.btn\b/.test(t)).length;
      const classSheets = css.filter((t) => /\.[a-z][\w-]*\s*[{,]/i.test(t)).length;
      check(`${vp}: isolated (no Tailwind/cartridge rules, one class-styling sheet, no footer, no Pocket, noindex)`, leak === 0 && classSheets === 1 && !b.footer && !b.pocket && /noindex/.test(b.robots ?? ""), { sheets: b.sheets, leak, classSheets, robots: b.robots, title: b.title });
      check(`${vp}: no horizontal overflow`, !b.overflowX, null);
      // hidden pauses
      await p.evaluate(() => { Object.defineProperty(document, "hidden", { configurable: true, get: () => true }); Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" }); document.dispatchEvent(new Event("visibilitychange")); });
      await sleep(300); const h0 = await p.evaluate(() => window.__f); await sleep(1500); const h1 = await p.evaluate(() => window.__f);
      await p.evaluate(() => { Object.defineProperty(document, "hidden", { configurable: true, get: () => false }); Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "visible" }); document.dispatchEvent(new Event("visibilitychange")); });
      await sleep(1500); const h2 = await p.evaluate(() => window.__f);
      check(`${vp}: hidden page stops frames, resumes when visible`, h1 - h0 <= 1 && h2 - h1 >= 10, { hidden: h1 - h0, resumed: h2 - h1 });
      check(`${vp}: no page errors / 4xx on live palace`, p.errs.length === 0 && p.bad.length === 0, { errs: p.errs, bad: p.bad }); await c.close(); }
    // 5 no WebGL
    { const { c, p } = await open(nogl, vp); await p.goto(BASE + "/ryugu", { waitUntil: "load" }); await sleep(2500); const s = await state(p); await p.screenshot({ path: `${SHOTS}/${vp}-palace-nowebgl.png` });
      const s2 = await state(p); await sleep(1000); const s3 = await state(p);
      check(`${vp}: no WebGL -> static scene, fish drawn, no frames loop`, s.mode === "static" && s.fish.length > 0 && s3.f - s2.f <= 2 && p.errs.length === 0, { mode: s.mode, fish: s.fish.length, frames: s3.f - s2.f, errs: p.errs }); await c.close(); }
    // 6 reduced motion
    { const { c, p } = await open(live, vp, { reducedMotion: "reduce" }); await p.goto(BASE + "/ryugu", { waitUntil: "load" }); await sleep(2000); const s = await state(p); await sleep(1000); const s2 = await state(p);
      await p.screenshot({ path: `${SHOTS}/${vp}-palace-reduced.png` });
      check(`${vp}: reduced motion -> still, no GL, no frames`, s.mode === "still" && s2.gl === 0 && s2.f - s.f <= 1 && s.fish.length > 0, { mode: s.mode, gl: s2.gl, frames: s2.f - s.f }); await c.close(); }
    // 7 keyboard way back out
    { const { c, p } = await open(live, vp); await p.goto(BASE + "/ryugu", { waitUntil: "load" }); await p.keyboard.press("Tab"); const f = await p.evaluate(() => ({ tag: document.activeElement?.tagName, href: document.activeElement?.getAttribute("href"), txt: document.activeElement?.textContent?.trim() }));
      await p.keyboard.press("Enter"); await p.waitForURL((u) => new URL(u).pathname === "/", { timeout: 10000 }).catch(() => {});
      check(`${vp}: first Tab focuses a way back up, Enter returns to /`, f.tag === "A" && path(p) === "/", { focus: f, url: p.url() }); await c.close(); }
  }
} finally { await live.close(); await nogl.close(); }
const bad = out.filter((r) => !r.ok); console.log(`walk: ${out.length - bad.length}/${out.length} hold`); process.exit(bad.length ? 1 : 0);
