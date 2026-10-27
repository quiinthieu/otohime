// Print runs in a real browser, against a running production server: a stored run colors the first styled frame of the
// site and of every root layout with hydration held back; every run × theme × season on the main site; an applied Ink
// Lab snapshot that survives reload and full document hops between roots, changes the actual SVG filter attributes and
// paper, and resets to the exact house values; same-tab and cross-tab updates; denied and corrupt storage; pointer
// transparency, forced colors and reduced motion. Negative controls: House (unset) adds no attribute, property or
// layer to any root, and a page with no stored run keeps its own colors.
// Drives Chrome through playwright-core: CHROME_PATH if set, else the installed Google Chrome, else Playwright's
// own Chromium.
//   BASE_URL              the server (default http://localhost:4000)
//   APPEARANCE_EVIDENCE   a directory for the measurements (JSON) and screenshots; nothing is written without it
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { chromium, type Browser, type BrowserContext, type BrowserContextOptions, type Page } from "playwright-core";
import { APPEARANCE_ROOTS, ROOT_APPEARANCE, type AppearanceRootId } from "../lib/appearance-client.ts";
import { encodeLab, INK_LAB_KEY, labDefaults, normalizeLab, PRINT_RUN_KEY, type LabSnapshot } from "../lib/ink-lab.ts";
import { PRINT_RUN_IDS, PRINT_RUNS, type ColorScheme, type PrintRunId } from "../lib/print-runs.ts";

const BASE = process.env.BASE_URL ?? "http://localhost:4000";
const EVIDENCE = process.env.APPEARANCE_EVIDENCE ?? "";
const evidence: Record<string, unknown> = { base: BASE, started: new Date().toISOString() };

// One public route per root layout, and the global 404 (the site's sheets in a document of its own).
const ROUTES: Record<AppearanceRootId, string> = {
  site: "/", articles: "/articles", barometer: "/barometer", capsule: "/capsule", "design-system": "/design-system",
  elements: "/elements", orrery: "/orrery", planisphere: "/planisphere", rotor: "/rotor", ryugu: "/ryugu", shore: "/shore",
  structures: "/structures", vinyl: "/vinyl", zine: "/zine",
};
const NOT_FOUND = "/no-such-page-for-print-runs";
const DOCUMENTS: [AppearanceRootId, string][] = [...APPEARANCE_ROOTS.map((id) => [id, ROUTES[id]] as [AppearanceRootId, string]), ["site", NOT_FOUND]];

let browser: Browser;
const contexts: BrowserContext[] = [];

// Chrome puts its singleton socket under TMPDIR and aborts when that path passes the 108-byte socket limit.
let shortTmp = "";
function browserEnv(): Record<string, string | undefined> {
  if (tmpdir().length <= 60) return process.env;
  shortTmp ||= mkdtempSync("/tmp/pr-e2e-");
  return { ...process.env, TMPDIR: shortTmp };
}

async function launch(): Promise<Browser> {
  const env = browserEnv();
  if (process.env.CHROME_PATH) return chromium.launch({ executablePath: process.env.CHROME_PATH, env });
  try {
    return await chromium.launch({ channel: "chrome", env });
  } catch (chrome) {
    try {
      return await chromium.launch({ env });
    } catch {
      throw new Error(`e2e/print-runs.test.ts needs a browser: install Google Chrome or set CHROME_PATH (${String(chrome).split("\n")[0]})`);
    }
  }
}

before(async () => {
  browser = await launch();
  evidence.browser = browser.version();
});

after(async () => {
  for (const c of contexts) await c.close().catch(() => {});
  await browser?.close();
  if (shortTmp) rmSync(shortTmp, { recursive: true, force: true });
  if (EVIDENCE) {
    mkdirSync(EVIDENCE, { recursive: true });
    writeFileSync(join(EVIDENCE, "print-runs.json"), `${JSON.stringify({ ...evidence, finished: new Date().toISOString() }, null, 2)}\n`);
  }
});

type Opened = { ctx: BrowserContext; page: Page; errors: string[] };

// A fresh context. hydrate: false aborts every script chunk, so what shows is the server's HTML, its sheets and the
// inline <head> scripts alone: the first styled frame, with no React to fix it up afterwards.
async function open(options: BrowserContextOptions & { hydrate?: boolean; storage?: Record<string, string>; session?: Record<string, string> } = {}): Promise<Opened> {
  const { hydrate = true, storage = {}, session = {}, ...context } = options;
  for (const c of contexts.splice(0)) await c.close().catch(() => {});
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 }, colorScheme: "light", reducedMotion: "no-preference", ...context });
  contexts.push(ctx);
  if (!hydrate) await ctx.route(/\/_next\/static\/chunks\/.*\.js/, (route) => route.abort());
  // Storage before the first document of the origin, the way a returning visitor's browser has it.
  await ctx.addInitScript(
    ({ storage, session }) => {
      if (sessionStorage.getItem("__seeded")) return;
      for (const [k, v] of Object.entries(storage)) localStorage.setItem(k, v);
      for (const [k, v] of Object.entries(session)) sessionStorage.setItem(k, v);
      sessionStorage.setItem("__seeded", "1");
    },
    { storage, session },
  );
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error" && /hydrat|did not match|Minified React error/i.test(m.text())) errors.push(`console: ${m.text()}`);
  });
  return { ctx, page, errors };
}

async function visit(page: Page, path: string) {
  const res = await page.goto(`${BASE}${path}`, { waitUntil: "load" });
  assert.ok(res, path);
  assert.equal(res.status(), path === NOT_FOUND ? 404 : 200, `${path}: status ${res.status()}`);
}

// The runtime is mounted once window.otohimeAppearance exists.
const hydrated = (page: Page) => page.waitForFunction(() => "otohimeAppearance" in window, null, { timeout: 30_000 });

type Look = {
  printRun: string | null; inkLab: string | null; halftone: string | null; season: string | null; theme: string | null;
  props: Record<string, string>; aliases: Record<string, string>; htmlBg: string; bodyBg: string; layer: { content: string; opacity: string; pointer: string; display: string };
};

async function look(page: Page, root: AppearanceRootId): Promise<Look> {
  const names = [...new Set(Object.values(ROOT_APPEARANCE[root].aliases).flat())];
  return page.evaluate((names) => {
    const html = document.documentElement;
    const cs = getComputedStyle(html);
    const before = getComputedStyle(html, "::before");
    const props: Record<string, string> = {};
    for (let i = 0; i < html.style.length; i++) props[html.style[i]] = html.style.getPropertyValue(html.style[i]);
    return {
      printRun: html.getAttribute("data-print-run"), inkLab: html.getAttribute("data-ink-lab"), halftone: html.getAttribute("data-ap-halftone"),
      season: html.getAttribute("data-season"), theme: html.getAttribute("data-theme"), props,
      aliases: Object.fromEntries(names.map((n) => [n, cs.getPropertyValue(n).trim()])),
      htmlBg: cs.backgroundColor, bodyBg: getComputedStyle(document.body).backgroundColor,
      layer: { content: before.content, opacity: before.opacity, pointer: before.pointerEvents, display: before.display },
    };
  }, names);
}

const rgb = (hex: string) => `rgb(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(", ")})`;

// The colors a run gives a root, in the scheme that root shows under the context's light OS and no pinned theme.
function expected(root: AppearanceRootId, run: PrintRunId, theme: ColorScheme = "light") {
  const preset = PRINT_RUNS[run];
  const mode = ROOT_APPEARANCE[root].scheme;
  const scheme: ColorScheme = preset.colorScheme === "dark" ? "dark" : mode === "both" ? theme : mode;
  const colors = preset.colors![scheme];
  const out: Record<string, string> = {};
  for (const [key, names] of Object.entries(ROOT_APPEARANCE[root].aliases)) for (const n of names) out[n] = colors[key as "ink"];
  return { out, paper: colors.paper };
}

// The source and live values of the document's tagged filter primitives.
const filters = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll("[data-ap-frequency],[data-ap-scale],[data-ap-seed]")].map((el) => ({
      id: el.closest("filter")?.id ?? "",
      frequency: [el.getAttribute("data-ap-frequency"), el.getAttribute("baseFrequency")],
      scale: [el.getAttribute("data-ap-scale"), el.getAttribute("scale")],
      seed: [el.getAttribute("data-ap-seed"), el.getAttribute("seed")],
    })),
  );

const times = (source: string | null, k: number, digits: number) =>
  source === null ? null : source.split(/\s+/).map((n) => String(Math.round(Number(n) * k * 10 ** digits) / 10 ** digits)).join(" ");

test("unset appearance adds nothing to any root: no attribute, inline property or layer (the house look)", async () => {
  const house: Record<string, unknown> = {};
  for (const [root, path] of DOCUMENTS) {
    const { page, errors } = await open();
    await visit(page, path);
    await hydrated(page);
    const l = await look(page, root);
    assert.equal(l.printRun, null, path);
    assert.equal(l.inkLab, null, path);
    assert.deepEqual(Object.keys(l.props).filter((p) => p.startsWith("--ap-")), [], `${path}: no inline appearance property`);
    assert.equal(l.layer.content, "none", `${path}: no texture layer`);
    assert.equal(await page.locator(`style[data-appearance="${root}"]`).count(), 1, `${path}: its own generated aliases`);
    assert.equal(await page.locator("style[data-appearance]").count(), 1, `${path}: and no other root's`);
    const tagged = await filters(page);
    for (const f of tagged) {
      if (f.frequency[0] !== null) assert.equal(f.frequency[1], f.frequency[0], `${path} ${f.id}: house frequency`);
      if (f.scale[0] !== null) assert.equal(f.scale[1], f.scale[0], `${path} ${f.id}: house scale`);
    }
    assert.deepEqual(errors, [], path);
    house[path] = { aliases: l.aliases, htmlBg: l.htmlBg, bodyBg: l.bodyBg, tagged: tagged.length };
  }
  evidence.house = house;
});

test("a stored run colors the first styled frame of every root layout, with hydration held back", async () => {
  const frames: Record<string, unknown> = {};
  for (const run of ["riso", "indigo"] as const) {
    const { page } = await open({ hydrate: false, storage: { [PRINT_RUN_KEY]: run } });
    for (const [root, path] of DOCUMENTS) {
      await visit(page, path);
      assert.equal(await page.evaluate(() => "otohimeAppearance" in window), false, "no script chunk ran");
      const l = await look(page, root);
      const { out, paper } = expected(root, run);
      assert.equal(l.printRun, run, `${path} ${run}`);
      assert.deepEqual(l.aliases, out, `${path} ${run}: the root's own tokens carry the run`);
      assert.equal(l.props["--ap-grain"], String(PRINT_RUNS[run].grain));
      if (ROOT_APPEARANCE[root].texture) {
        assert.equal(l.htmlBg, rgb(paper), `${path} ${run}: the paper under the texture`);
        assert.equal(l.layer.content, '""');
        assert.equal(l.layer.opacity, String(PRINT_RUNS[run].grain));
        assert.equal(l.layer.pointer, "none");
      } else assert.equal(l.layer.content, "none", `${path}: no layer where the page paints over it`);
      frames[`${run} ${path}`] = { aliases: l.aliases, htmlBg: l.htmlBg, layer: l.layer };
      if (EVIDENCE) {
        mkdirSync(EVIDENCE, { recursive: true });
        await page.screenshot({ path: join(EVIDENCE, `first-frame-${run}${path === "/" ? "-home" : path.replace(/\//g, "-")}.png`) });
      }
    }
  }
  evidence.firstFrames = frames;
});

test("evidence: every root hydrated under each colored run", async () => {
  for (const run of ["sumi", "riso", "indigo"] as const) {
    const { page, errors } = await open({ storage: { [PRINT_RUN_KEY]: run } });
    for (const [root, path] of DOCUMENTS) {
      await visit(page, path);
      await hydrated(page);
      const assertRun = async () => assert.equal((await look(page, root)).printRun, run, path);
      await assertRun();
      if (path === "/") {
        // Real DOM negative control: the same observer must reject a wrong run.
        // Restore it before visiting the remaining roots; no app hooks or fake browser.
        await page.evaluate(() => document.documentElement.setAttribute("data-print-run", "house"));
        try { await assert.rejects(assertRun, { name: "AssertionError" }); }
        finally { await page.evaluate((run) => document.documentElement.setAttribute("data-print-run", run), run); }
        await assertRun();
      }
      if (EVIDENCE) {
        mkdirSync(EVIDENCE, { recursive: true });
        await page.screenshot({ path: join(EVIDENCE, `hydrated-${run}${path === "/" ? "-home" : path.replace(/\//g, "-")}.png`) });
      }
    }
    assert.deepEqual(errors, []);
  }
});

test("every run, theme and season on the main site before hydration: the run's colors, the season kept underneath", async () => {
  const seasons = readFileSync(join(import.meta.dirname, "../app/(site)/seasons.css"), "utf8");
  // The season's own --paper, light-dark(light, dark), as the browser resolves it for the scheme in force.
  const tint = (season: string, scheme: ColorScheme) => {
    const pair = seasons.match(new RegExp(`data-season="${season}"\\]\\s*\\{\\s*--paper:\\s*light-dark\\((#[0-9a-f]{6}),\\s*(#[0-9a-f]{6})\\);`));
    assert.ok(pair, season);
    return scheme === "light" ? pair[1] : pair[2];
  };
  const seen: Record<string, string> = {};
  for (const [theme, os] of [["light", "light"], ["dark", "light"], ["", "dark"]] as const) {
    for (const season of ["spring", "summer", "autumn", "winter"]) {
      for (const run of PRINT_RUN_IDS) {
        const storage: Record<string, string> = { season, [PRINT_RUN_KEY]: run };
        if (theme) storage.theme = theme;
        const { page } = await open({ hydrate: false, colorScheme: os, storage });
        await visit(page, "/");
        const l = await look(page, "site");
        assert.equal(l.season, season, "the season stays pinned underneath");
        const scheme = (theme || os) as ColorScheme;
        if (run === "house") {
          assert.equal(l.printRun, null);
          assert.equal(l.aliases["--paper"], tint(season, scheme), `house ${season} ${scheme}: the season's own tint`);
          assert.equal(l.bodyBg, rgb(tint(season, scheme)), "painted by the site's own body rule");
        } else {
          const { out } = expected("site", run, scheme);
          assert.equal(l.printRun, run);
          assert.deepEqual(l.aliases, out, `${run} ${theme || `os-${os}`} ${season}`);
        }
        seen[`${run} ${theme || `os-${os}`} ${season}`] = `${l.aliases["--paper"]} / ${l.aliases["--ink"]}`;
      }
    }
  }
  assert.equal(Object.keys(seen).length, 48);
  evidence.combinations = seen;
});

const LAB: LabSnapshot = normalizeLab({
  version: 1, printRun: "riso",
  settings: { turbulence: 0.07, displacement: 7, wobble: 0, grain: 0.05, plates: ["#123456", "#ff48b0", "#00a95c"], plateCount: 2, transitionMs: 300, hand: "ink", halftone: true },
});

test("an applied Lab survives reload and full hops across roots, changes the SVG filters and paper, and resets exactly", async () => {
  const { page, errors } = await open();
  const pages = ["/projects", "/notes", "/play", "/ledger", "/music"];
  let start = "";
  let houseFilters: Awaited<ReturnType<typeof filters>> = [];
  for (const p of pages) {
    await visit(page, p);
    await hydrated(page);
    houseFilters = await filters(page);
    if (houseFilters.some((f) => f.frequency[0] !== null && f.scale[0] === null) && houseFilters.some((f) => f.scale[0] !== null)) {
      start = p;
      break;
    }
  }
  assert.ok(start, "a site page with tagged ink filters");
  const houseLook = await look(page, "site");
  const applied = await page.evaluate((lab) => (window as unknown as { otohimeAppearance: { applyLab(l: unknown): { persisted: boolean } } }).otohimeAppearance.applyLab(lab), LAB);
  assert.equal(applied.persisted, true);
  assert.equal(await page.evaluate((k) => sessionStorage.getItem(k), INK_LAB_KEY), encodeLab(LAB));
  // Lab values are multiples of the ink hand: t 0.07 / 0.035 = 2, d 7 / 3.5 = 2.
  const check = async (path: string, root: AppearanceRootId) => {
    const l = await look(page, root);
    assert.equal(l.printRun, "riso", path);
    assert.equal(l.inkLab, "", path);
    assert.equal(l.halftone, "", path);
    assert.equal(l.props["--ap-grain"], "0.05");
    assert.equal(l.props["--ap-plate-1"], "#123456");
    assert.equal(l.props["--ap-plate-count"], "2");
    assert.deepEqual(l.aliases, expected(root, "riso").out, `${path}: the Lab's run colors the paper`);
    if (ROOT_APPEARANCE[root].texture) assert.equal(l.layer.opacity, "0.05");
    const live = await filters(page);
    for (const f of live) {
      if (f.frequency[0] !== null) assert.equal(f.frequency[1], times(f.frequency[0], 2, 5), `${path} ${f.id} frequency`);
      if (f.scale[0] !== null) assert.equal(f.scale[1], times(f.scale[0], 2, 2), `${path} ${f.id} scale`);
      if (f.seed[0] !== null) assert.equal(f.seed[1], f.seed[0], `${path} ${f.id}: the source seed`);
    }
    return live;
  };
  const changed = await check(start, "site");
  assert.ok(changed.length > 0);
  assert.notDeepEqual(changed.map((f) => f.frequency[1]), houseFilters.map((f) => f.frequency[1]), "the actual attributes moved");
  await page.reload({ waitUntil: "load" });
  await hydrated(page);
  await check(`${start} reloaded`, "site");
  const hops: Record<string, unknown> = {};
  for (const [root, path] of [["ryugu", "/ryugu"], ["site", NOT_FOUND], ["shore", "/shore"], ["vinyl", "/vinyl"], ["site", "/music"]] as const) {
    await visit(page, path);
    await hydrated(page);
    const live = await check(path, root);
    if (path === "/ryugu") assert.ok(live.some((f) => f.id === "ryugu-caustic" && f.frequency[1] === "0.018 0.032"), "the sea's caustic");
    if (path === NOT_FOUND) assert.ok(live.some((f) => f.id === "lost-crumple" && f.scale[1] === "28"), "the 404's crumple");
    hops[path] = live;
  }
  evidence.labHops = hops;
  if (EVIDENCE) await page.screenshot({ path: join(EVIDENCE, "lab-applied-music.png") });
  await visit(page, start);
  await hydrated(page);
  const reset = await page.evaluate(() => (window as unknown as { otohimeAppearance: { resetHouse(): { persisted: boolean } } }).otohimeAppearance.resetHouse());
  assert.equal(reset.persisted, true);
  const after = await look(page, "site");
  assert.deepEqual({ ...after, layer: after.layer.content }, { ...houseLook, layer: houseLook.layer.content }, "reset restores the house look exactly");
  assert.deepEqual(await filters(page), houseFilters, "and every filter attribute's source text");
  assert.deepEqual(await page.evaluate(([a, b]) => [localStorage.getItem(a), sessionStorage.getItem(b)], [PRINT_RUN_KEY, INK_LAB_KEY]), [null, null]);
  await page.reload({ waitUntil: "load" });
  assert.equal((await look(page, "site")).printRun, null, "and stays reset");
  assert.deepEqual(errors, []);
});

test("same-tab changes apply at once; another tab's run reaches this one and clears its stale Lab", async () => {
  const { ctx, page: a, errors } = await open();
  await visit(a, "/");
  await hydrated(a);
  const b = await ctx.newPage();
  b.on("pageerror", (e) => errors.push(e.message));
  await visit(b, "/shore");
  await hydrated(b);
  await a.evaluate(() => (window as unknown as { otohimeAppearance: { setPrintRun(id: string): unknown } }).otohimeAppearance.setPrintRun("indigo"));
  assert.equal(await a.getAttribute("html", "data-print-run"), "indigo", "same tab, no reload");
  await b.waitForFunction(() => document.documentElement.getAttribute("data-print-run") === "indigo");
  assert.deepEqual((await look(b, "shore")).aliases, expected("shore", "indigo").out, "the other tab, another root");
  await b.evaluate((lab) => (window as unknown as { otohimeAppearance: { applyLab(l: unknown): unknown } }).otohimeAppearance.applyLab(lab), labDefaults("sumi"));
  assert.equal(await b.getAttribute("html", "data-print-run"), "sumi");
  assert.equal(await a.getAttribute("html", "data-print-run"), "indigo", "a Lab is this tab's session only");
  await a.evaluate(() => (window as unknown as { otohimeAppearance: { setPrintRun(id: string): unknown } }).otohimeAppearance.setPrintRun("riso"));
  await b.waitForFunction(() => document.documentElement.getAttribute("data-print-run") === "riso" && !document.documentElement.hasAttribute("data-ink-lab"));
  assert.equal(await b.evaluate((k) => sessionStorage.getItem(k), INK_LAB_KEY), null, "the stale Lab left the other tab's session");
  await a.evaluate(() => (window as unknown as { otohimeAppearance: { resetHouse(): unknown } }).otohimeAppearance.resetHouse());
  await b.waitForFunction(() => !document.documentElement.hasAttribute("data-print-run"));
  assert.deepEqual(errors, []);
});

test("denied storage boots House and works for the page only; corrupt and hostile values are ignored", async () => {
  {
    const { page, errors } = await open();
    await page.addInitScript(() => {
      for (const name of ["localStorage", "sessionStorage"]) {
        Object.defineProperty(window, name, { configurable: true, get() { throw new DOMException("denied", "SecurityError"); } });
      }
    });
    await visit(page, "/");
    await hydrated(page);
    assert.equal((await look(page, "site")).printRun, null);
    const result = await page.evaluate(() => (window as unknown as { otohimeAppearance: { setPrintRun(id: string): { persisted: boolean; failedKeys: string[] } } }).otohimeAppearance.setPrintRun("riso"));
    assert.equal(result.persisted, false, "says it did not persist");
    assert.equal((await look(page, "site")).printRun, "riso", "but the page shows it");
    await page.reload({ waitUntil: "load" });
    assert.equal((await look(page, "site")).printRun, null, "and a reload cannot keep it");
    assert.deepEqual(errors, []);
  }
  {
    const hostile = "v=1&r=riso&t=0.04&d=4&w=0&g=0.06&p=ff0000;}html{display:none}&n=3&m=420&h=ink&o=1</style><script>window.__owned=1</script>";
    const { page, errors } = await open({ storage: { [PRINT_RUN_KEY]: "</style><script>window.__owned=1</script>" }, session: { [INK_LAB_KEY]: hostile } });
    await visit(page, "/");
    await hydrated(page);
    const l = await look(page, "site");
    assert.equal(l.printRun, null);
    assert.equal(l.inkLab, null);
    assert.equal(await page.evaluate(() => (window as unknown as { __owned?: number }).__owned), undefined);
    assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).display), "block");
    assert.deepEqual(errors, []);
  }
});

test("the layer never takes input, forced colors drop it, and reduced motion stops the seed clock", async () => {
  const wobbly = encodeLab(normalizeLab({ ...LAB, settings: { ...LAB.settings, wobble: 6 } }));
  const seeds = async (page: Page) => (await filters(page)).filter((f) => f.seed[0] !== null).map((f) => f.seed[1]);
  {
    const { page, errors } = await open({ session: { [INK_LAB_KEY]: wobbly } });
    let path = "";
    for (const p of ["/projects", "/notes", "/play"]) {
      await visit(page, p);
      await hydrated(page);
      if ((await seeds(page)).length) {
        path = p;
        break;
      }
    }
    assert.ok(path, "a page with tagged line work");
    // Positive control: with motion allowed the one clock re-seeds the line work.
    const first = await seeds(page);
    await page.waitForFunction((first) => {
      const now = [...document.querySelectorAll("[data-ap-seed]")].map((el) => el.getAttribute("seed"));
      return now.some((s, i) => s !== first[i]);
    }, first, { timeout: 5000 });
    // Input passes through: the topmost element at a masthead link's centre is the link, and a click follows it.
    const link = page.locator('header a[href^="/"]:visible').first();
    const box = (await link.boundingBox())!;
    const hit = await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.closest("a")?.getAttribute("href") ?? null, [box.x + box.width / 2, box.y + box.height / 2]);
    const href = await link.getAttribute("href");
    assert.equal(hit, href);
    assert.equal((await look(page, "site")).layer.pointer, "none");
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForURL((url) => url.pathname === new URL(href!, BASE).pathname);
    assert.deepEqual(errors, []);
  }
  {
    const { page, errors } = await open({ reducedMotion: "reduce", session: { [INK_LAB_KEY]: wobbly } });
    let path = "";
    for (const p of ["/projects", "/notes", "/play"]) {
      await visit(page, p);
      await hydrated(page);
      if ((await seeds(page)).length) {
        path = p;
        break;
      }
    }
    assert.ok(path);
    const sources = (await filters(page)).filter((f) => f.seed[0] !== null).map((f) => f.seed[0]);
    await page.waitForTimeout(1200);
    assert.deepEqual(await seeds(page), sources, "reduced motion: the source seeds, unmoved");
    // The Lab asked for 300ms; reduced motion wins over its inline value (Chrome may print zero as 0s).
    assert.match(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--ap-transition").trim()), /^0m?s$/);
    assert.deepEqual(errors, []);
  }
  {
    const { page, errors } = await open({ forcedColors: "active", storage: { [PRINT_RUN_KEY]: "riso" }, session: { [INK_LAB_KEY]: wobbly } });
    for (const path of ["/", "/shore"]) {
      await visit(page, path);
      await hydrated(page);
      const l = await look(page, path === "/" ? "site" : "shore");
      assert.equal(l.layer.content, "none", `${path}: no decorative layer in forced colors`);
    }
    assert.deepEqual(errors, []);
  }
});
