// The Ink Poster Press on /play in a real browser, against a running production server: the press's chunk comes
// only when its slot nears the screen and stays under 12 kB gzipped; a WebGL2 poster wets, dries and holds real ink
// on paper (pixels sampled from a screenshot); the layouts, Shuffle and ?s= set the poster; Export PNG downloads the
// dried 1080x1350 frame; a hidden tab stops the clock; reduced motion prints one dried frame and the press never asks
// for an animation frame (normal motion is the negative control: there it does); and without WebGL, or once the
// context is lost, the SVG ink filter shows the poster and Canvas2D exports it. Drives Chrome through playwright-core
// with SwiftShader allowed: CHROME_PATH if set, else the installed Google Chrome, else Playwright's own Chromium.
//   BASE_URL  the server (default http://localhost:4000)
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { gzipSync } from "node:zlib";
import { after, before, test } from "node:test";
import { chromium, type Browser, type BrowserContext, type BrowserContextOptions, type Page } from "playwright-core";
import sharp from "sharp";

const BASE = process.env.BASE_URL ?? "http://localhost:4000";
const MARKER = "// ink-press poster";
const CHUNK_LIMIT = 12 * 1024;
const PAPER = [242, 239, 231];

let browser: Browser;
const contexts: BrowserContext[] = [];

// Chrome puts its singleton socket under TMPDIR and aborts when that path passes the 108-byte socket limit
// (a deep per-job TMPDIR does): such a TMPDIR is swapped for a short one under /tmp, removed afterwards.
let shortTmp = "";
function browserEnv(): Record<string, string | undefined> {
  if (tmpdir().length <= 60) return process.env;
  shortTmp ||= mkdtempSync("/tmp/ip-e2e-");
  return { ...process.env, TMPDIR: shortTmp };
}

async function launch(): Promise<Browser> {
  const env = browserEnv();
  const args = ["--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"];
  if (process.env.CHROME_PATH) return chromium.launch({ executablePath: process.env.CHROME_PATH, env, args });
  try {
    return await chromium.launch({ channel: "chrome", env, args });
  } catch (chrome) {
    try {
      return await chromium.launch({ env, args });
    } catch {
      throw new Error(`e2e/ink-press.test.ts needs a browser: install Google Chrome or set CHROME_PATH (${String(chrome).split("\n")[0]})`);
    }
  }
}

before(async () => {
  browser = await launch();
});

after(async () => {
  for (const c of contexts) await c.close().catch(() => {});
  await browser?.close();
  if (shortTmp) rmSync(shortTmp, { recursive: true, force: true });
});

type Opened = { page: Page; scripts: Map<string, string>; errors: string[]; downloads: string };

// /play with every script body it fetched, its errors, and a log of each requestAnimationFrame call's stack
// (window.__raf), so a call can be traced to the chunk that made it.
async function open(query = "", options: BrowserContextOptions = {}, init?: () => void): Promise<Opened> {
  const context = await browser.newContext({ viewport: { width: 1280, height: 860 }, acceptDownloads: true, ...options });
  contexts.push(context);
  const page = await context.newPage();
  const scripts = new Map<string, string>();
  const errors: string[] = [];
  page.on("response", async (r) => {
    if (r.request().resourceType() !== "script") return;
    scripts.set(r.url(), await r.text().catch(() => ""));
  });
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(() => {
    const w = window as unknown as { __raf: string[] };
    w.__raf = [];
    const raf = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (cb) => {
      w.__raf.push(new Error().stack ?? "");
      return raf(cb);
    };
  });
  if (init) await page.addInitScript(init);
  const res = await page.goto(`${BASE}/play${query}`, { waitUntil: "networkidle" });
  assert.equal(res?.status(), 200, `/play${query}`);
  const downloads = mkdtempSync(path.join(shortTmp || tmpdir(), "ip-dl-"));
  return { page, scripts, errors, downloads };
}

const poster = (page: Page) => page.locator("[data-press=poster]");
// The press's own status line, beside its poster: the page holds other live regions (Kame's, in the site layout).
const pressStatus = (page: Page) => poster(page).locator("xpath=..").getByRole("status");
const data = (page: Page, key: string) => poster(page).getAttribute(`data-${key}`);

// Scroll the press into view and wait for its poster to dry.
async function dried(page: Page) {
  await page.locator("#press-heading").scrollIntoViewIfNeeded();
  await page.waitForSelector("[data-press=poster][data-state=dry]", { timeout: 20_000 });
}

const pressChunk = (scripts: Map<string, string>) => [...scripts].find(([, body]) => body.includes(MARKER));

// How much of an image is ink (far from the paper) and how much bare paper.
async function inkStats(png: Buffer) {
  const { data: px, info } = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  let ink = 0;
  let paper = 0;
  const n = info.width * info.height;
  for (let i = 0; i < px.length; i += 3) {
    const d = Math.abs(px[i] - PAPER[0]) + Math.abs(px[i + 1] - PAPER[1]) + Math.abs(px[i + 2] - PAPER[2]);
    if (d > 120) ink++;
    else if (d < 36) paper++;
  }
  return { width: info.width, height: info.height, ink: ink / n, paper: paper / n };
}

function assertInked(s: { ink: number; paper: number }, what: string) {
  assert.ok(s.ink > 0.01, `${what}: only ${(s.ink * 100).toFixed(2)}% ink, the poster is blank`);
  assert.ok(s.paper > 0.15, `${what}: only ${(s.paper * 100).toFixed(2)}% paper, the poster is flooded`);
}

async function exportPng(o: Opened): Promise<{ name: string; png: Buffer }> {
  const [download] = await Promise.all([o.page.waitForEvent("download"), o.page.getByRole("button", { name: "Export PNG" }).click()]);
  const file = path.join(o.downloads, download.suggestedFilename());
  await download.saveAs(file);
  return { name: download.suggestedFilename(), png: readFileSync(file) };
}

// The animation frames the press's own chunk asked for.
const pressFrames = (page: Page, chunk: string) =>
  page.evaluate((url) => (window as unknown as { __raf: string[] }).__raf.filter((s) => s.includes(url)).length, chunk);

test("the press loads lazily in a small chunk, prints a WebGL2 poster that wets, dries and holds real ink", async () => {
  const o = await open();
  const { page, scripts, errors } = o;
  assert.equal(pressChunk(scripts), undefined, "the press's chunk is not part of /play's first load");
  assert.equal(await page.locator("[data-press=waiting]").count(), 1, "the slot holds its blank sheet");
  await dried(page);
  const chunk = pressChunk(scripts);
  assert.ok(chunk, "scrolling to the slot fetched the press's chunk");
  const gz = gzipSync(chunk[1]).length;
  assert.ok(gz <= CHUNK_LIMIT, `the press chunk is ${gz} B gzipped, over ${CHUNK_LIMIT}`);
  assert.ok(![...scripts.values()].some((b) => b.includes(MARKER) && /WebGLRenderer|REVISION/.test(b)), "no three in the press");

  assert.equal(await data(page, "renderer"), "webgl2");
  assert.ok(Number(await data(page, "frames")) > 1, "normal motion runs the drying clock (the reduced-motion control)");
  assert.ok((await pressFrames(page, chunk[0])) > 1, "and the press's chunk asked for those frames");
  const canvas = poster(page).locator("canvas");
  assert.equal(await canvas.getAttribute("role"), "img");
  assert.match((await canvas.getAttribute("aria-label")) ?? "", /^Ink poster: “wet ink”, (stamp|riso|brush) layout$/);
  // the buffer is 4:5 at the device ratio, capped at 2
  const size = await canvas.evaluate((c: HTMLCanvasElement) => [c.width, c.height, c.getBoundingClientRect().width]);
  assert.equal(size[0], Math.round(size[2]));
  assert.equal(size[1], Math.round(size[0] * 1.25));
  assertInked(await inkStats(await canvas.screenshot()), "the dried WebGL poster");
  // once dry, the press asks for no more frames
  const settled = await pressFrames(page, chunk[0]);
  await page.waitForTimeout(400);
  assert.equal(await pressFrames(page, chunk[0]), settled, "a dried poster runs no animation frame");
  assert.equal(new URL(page.url()).search, "", "a plain visit keeps the bare address");
  assert.deepEqual(errors, []);
});

test("typing, the layouts and Shuffle set the poster, ?s= carries it, and Export PNG pulls the dried 1080x1350 frame", async () => {
  const o = await open();
  const { page, errors } = o;
  await dried(page);
  const field = page.getByLabel("Phrase");
  await field.fill("the broken dag runs at dawn, twice");
  assert.equal(await field.inputValue(), "the broken dag runs at d", "the field holds 24 characters");
  await field.fill("the broken dag");
  for (const layout of ["stamp", "riso", "brush"] as const) {
    const chip = page.getByRole("button", { name: layout[0].toUpperCase() + layout.slice(1), exact: true });
    await chip.click();
    assert.equal(await data(page, "layout"), layout);
    assert.equal(await chip.getAttribute("aria-pressed"), "true");
    await page.waitForSelector("[data-press=poster][data-state=dry]", { timeout: 20_000 });
    assertInked(await inkStats(await poster(page).locator("canvas").screenshot()), `the ${layout} poster`);
  }
  await page.getByRole("button", { name: "Riso", exact: true }).click();
  const before = await data(page, "seed");
  await page.getByRole("button", { name: "Shuffle" }).click();
  const seed = await data(page, "seed");
  assert.notEqual(seed, before, "Shuffle drew a new seed");
  await page.waitForFunction((s) => new URL(location.href).searchParams.get("s") === s, seed);
  assert.equal(new URL(page.url()).searchParams.get("t"), "the broken dag");

  await page.waitForSelector("[data-press=poster][data-state=dry]", { timeout: 20_000 });
  const layout = await data(page, "layout");
  const { name, png } = await exportPng(o);
  assert.equal(name, `ink-press-the-broken-dag-${layout}-${seed}.png`);
  const stats = await inkStats(png);
  assert.deepEqual([stats.width, stats.height], [1080, 1350]);
  assertInked(stats, "the exported PNG");
  assert.match((await pressStatus(page).textContent()) ?? "", new RegExp(`Pulled ${name.replace(/\./g, "\\.")}`));

  // the address opens the same poster
  const again = await open(`?s=${seed}&t=${encodeURIComponent("the broken dag")}`);
  await dried(again.page);
  assert.equal(await data(again.page, "seed"), seed);
  assert.equal(await data(again.page, "layout"), layout);
  assert.equal(await again.page.getByLabel("Phrase").inputValue(), "the broken dag");
  assert.deepEqual(errors, []);
  assert.deepEqual(again.errors, []);
});

test("a hidden tab stops the drying clock and showing it again finishes the drying", async () => {
  const { page, errors } = await open();
  await dried(page);
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.getByLabel("Phrase").fill("the lake");
  const frames = Number(await data(page, "frames"));
  await page.waitForTimeout(500);
  assert.equal(await data(page, "state"), "wet", "fresh ink stays wet while the tab is hidden");
  assert.equal(Number(await data(page, "frames")), frames, "no frame runs while the tab is hidden");
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, get: () => false });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.waitForSelector("[data-press=poster][data-state=dry]", { timeout: 20_000 });
  assert.ok(Number(await data(page, "frames")) > frames);
  assert.deepEqual(errors, []);
});

test("reduced motion prints one dried frame and the press never asks for an animation frame", async () => {
  const o = await open("", { reducedMotion: "reduce" });
  const { page, scripts, errors } = o;
  await dried(page);
  const chunk = pressChunk(scripts);
  assert.ok(chunk);
  assert.equal(await data(page, "renderer"), "webgl2");
  assertInked(await inkStats(await poster(page).locator("canvas").screenshot()), "the reduced-motion poster");
  await page.getByLabel("Phrase").fill("the warehouse");
  await page.getByRole("button", { name: "Shuffle" }).click();
  await page.waitForTimeout(300);
  assert.equal(await data(page, "state"), "dry", "fresh ink is dry at once");
  assert.equal(await data(page, "frames"), "0");
  assert.equal(await pressFrames(page, chunk[0]), 0, "the press's chunk asked for no animation frame");
  assertInked(await inkStats(await poster(page).locator("canvas").screenshot()), "the reprinted reduced-motion poster");
  const { png } = await exportPng(o);
  assertInked(await inkStats(png), "the reduced-motion export");
  assert.deepEqual(errors, []);
});

test("without WebGL the SVG ink filter shows the poster and Canvas2D exports it", async () => {
  const o = await open("?s=00000004&t=no%20gl", {}, () => {
    const get = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, kind: string, ...rest: unknown[]) {
      if (kind === "webgl2" || kind === "webgl") return null;
      return (get as (...a: unknown[]) => unknown).call(this, kind, ...rest);
    } as typeof get;
  });
  const { page, errors } = o;
  await dried(page);
  assert.equal(await data(page, "renderer"), "svg");
  assert.equal(await data(page, "layout"), "riso");
  const svg = poster(page).locator("svg[role=img]");
  assert.equal(await svg.count(), 1);
  assert.ok((await svg.locator("filter feTurbulence").count()) >= 2, "the poster is drawn through the site's ink filter");
  assertInked(await inkStats(await svg.screenshot()), "the SVG poster");
  const { name, png } = await exportPng(o);
  assert.equal(name, "ink-press-no-gl-riso-00000004.png");
  const stats = await inkStats(png);
  assert.deepEqual([stats.width, stats.height], [1080, 1350]);
  assertInked(stats, "the Canvas2D export");
  assert.deepEqual(errors, []);
});

test("a lost WebGL context hands the poster to the SVG fallback", async () => {
  const { page, errors } = await open();
  await dried(page);
  await poster(page)
    .locator("canvas")
    .evaluate((c: HTMLCanvasElement) => c.getContext("webgl2")?.getExtension("WEBGL_lose_context")?.loseContext());
  await page.waitForSelector("[data-press=poster][data-renderer=svg] svg[role=img]");
  assertInked(await inkStats(await poster(page).locator("svg[role=img]").screenshot()), "the poster after the context went");
  assert.deepEqual(errors, []);
});
