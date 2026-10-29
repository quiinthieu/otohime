import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { chromium, type Browser, type BrowserContext, type BrowserContextOptions, type Page } from "playwright-core";
import { collectBrowserErrors } from "./console-errors.ts";

const BASE = process.env.BASE_URL ?? "http://localhost:4000";
const tmp = mkdtempSync("/tmp/senko-e2e-");
let browser: Browser;
const contexts: BrowserContext[] = [];
before(async () => {
  const env = { ...process.env, TMPDIR: tmp };
  if (process.env.CHROME_PATH) browser = await chromium.launch({ executablePath: process.env.CHROME_PATH, env });
  else {
    try { browser = await chromium.launch({ channel: "chrome", env }); }
    catch { browser = await chromium.launch({ env }); }
  }
});
after(async () => {
  for (const context of contexts) await context.close();
  await browser?.close(); rmSync(tmp, { recursive: true, force: true });
});

type Meter = { contexts: number; voices: number; draws: number; frequencies: number[] };
async function open(options: BrowserContextOptions = {}, route = "/play/senko") {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, ...options });
  contexts.push(context);
  // Observe real rendering and audio nodes; no replacement model, renderer or audio runtime.
  await context.addInitScript(() => {
    const meter = { contexts: 0, voices: 0, draws: 0, frequencies: [] as number[] };
    Object.assign(window, { __senkoMeter: meter });
    const clear = CanvasRenderingContext2D.prototype.clearRect;
    CanvasRenderingContext2D.prototype.clearRect = function (...args) {
      if (this.canvas.dataset.testid === "senko-canvas") meter.draws++;
      return clear.apply(this, args);
    };
    const Real = window.AudioContext;
    if (Real) window.AudioContext = class extends Real {
      constructor(options?: AudioContextOptions) { super(options); meter.contexts++; }
      createOscillator() {
        const oscillator = super.createOscillator(), start = oscillator.start;
        oscillator.start = function (...args) {
          meter.voices++; meter.frequencies.push(oscillator.frequency.value);
          return start.apply(this, args);
        };
        return oscillator;
      }
    };
  });
  const page = await context.newPage(), errors = collectBrowserErrors(BASE);
  page.on("pageerror", (e) => errors.pageError(e.message));
  page.on("console", (msg) => { if (msg.type() === "error") errors.console({ text: msg.text(), ...msg.location(), args: msg.args().length }); });
  page.on("response", (res) => errors.response({ url: res.url(), status: res.status(), method: res.request().method(), resourceType: res.request().resourceType() }));
  await page.goto(`${BASE}${route}`);
  return { page, context, errors };
}
const canvas = (page: Page) => page.getByTestId("senko-canvas");
async function ready(page: Page) { await canvas(page).waitFor(); await page.waitForFunction(() => document.querySelector<HTMLCanvasElement>('[data-testid="senko-canvas"]')!.width > 1); }
async function stage(page: Page, value: string) {
  await page.waitForFunction((value) => document.querySelector('[data-testid="senko-canvas"]')?.getAttribute("data-stage") === value, value);
}
async function loop(page: Page, running: boolean) {
  await page.waitForFunction((value) => document.querySelector('[data-testid="senko-canvas"]')?.getAttribute("data-loop-running") === String(value), running);
}
const meter = (page: Page) => page.evaluate(() => (window as unknown as { __senkoMeter: Meter }).__senkoMeter);

for (const width of [1280, 390]) test(`/play discovers Senko at ${width}px; real canvas, touch layout and OG card`, async () => {
  const { page, errors } = await open({ viewport: { width, height: 900 }, deviceScaleFactor: 3 }, "/play");
  const link = page.getByTestId("play-senko-link");
  assert.equal(await link.getAttribute("href"), "/play/senko");
  await link.click(); await page.waitForURL("**/play/senko"); await ready(page);
  // Next can paint the island before its navigation updates the document head.
  await page.waitForFunction(() => /Senko Hanabi/.test(document.title));
  assert.match(await page.title(), /Senko Hanabi/);
  assert.equal(await page.getByTestId("senko-sound-toggle").getAttribute("aria-pressed"), "false");
  assert.equal(await page.getByTestId("senko-status").getAttribute("aria-live"), "polite");
  const paint = await canvas(page).evaluate((node: HTMLCanvasElement) => {
    const rect = node.getBoundingClientRect(), pixels = node.getContext("2d")!.getImageData(0, 0, node.width, node.height).data;
    let ink = 0; for (let i = 3; i < pixels.length; i += 4) if (pixels[i]) ink++;
    return { ink, width: node.width, height: node.height, cssWidth: rect.width, cssHeight: rect.height, touch: getComputedStyle(node).touchAction };
  });
  assert.ok(paint.ink > 100, "real renderer paints the stem while idle");
  assert.ok(paint.width <= Math.ceil(paint.cssWidth * 2) && paint.height <= Math.ceil(paint.cssHeight * 2));
  assert.equal(paint.touch, "none");
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  for (const button of await page.locator(".senko-island button").all()) assert.ok((await button.boundingBox())!.height >= 44);
  await page.getByTestId("senko-steady-btn").click(); await stage(page, "botan");
  assert.equal((await meter(page)).contexts, 0, "lighting cannot unlock muted audio");
  const og = await page.locator('meta[property="og:image"]').getAttribute("content");
  assert.ok(og?.includes("/play/senko/opengraph-image"));
  const ogPath = new URL(og!, BASE);
  const response = await page.request.get(new URL(ogPath.pathname + ogPath.search, BASE).href);
  assert.equal(response.status(), 200); assert.match(response.headers()["content-type"], /image\/png/);
  assert.ok((await response.body()).byteLength > 5000, "real Satori card renders");
  await page.getByTestId("senko-stage-matsuba").click();
  await page.waitForFunction(() => Number(document.querySelector('[data-testid="senko-canvas"]')?.getAttribute("data-particles")) > 8);
  await page.screenshot({ path: `/tmp/pm-301-t-1786-senko-${width}.png`, fullPage: true });
  assert.deepEqual(errors.unexpected, []);
});

test("pointer hold lights; natural elapsed time visits all four flowers and release extinguishes", async () => {
  const { page, errors } = await open(); await ready(page);
  await page.clock.install();
  await canvas(page).scrollIntoViewIfNeeded();
  const box = (await canvas(page).boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down();
  await stage(page, "lighting");
  for (const [advance, flower, title] of [[700, "botan", "peony"], [2700, "matsuba", "pine needles"], [3600, "yanagi", "willow"], [3600, "chiri-giku", "chrysanthemum"]] as const) {
    await page.clock.runFor(advance); await stage(page, flower);
    assert.match(await page.getByTestId("senko-status").innerText(), new RegExp(title, "i"));
    assert.ok(Number(await canvas(page).getAttribute("data-particles")) > 0);
  }
  await page.clock.runFor(3000); await stage(page, "out"); await loop(page, false); await page.mouse.up();
  await page.getByRole("button", { name: "New sparkler" }).click();
  const button = page.getByTestId("senko-hold-btn"); await button.focus();
  await page.keyboard.down("Enter"); await page.clock.runFor(700); await stage(page, "botan");
  await page.keyboard.up("Enter"); await stage(page, "out"); await loop(page, false);
  const holdBox = (await button.boundingBox())!;
  await page.mouse.move(holdBox.x + holdBox.width / 2, holdBox.y + holdBox.height / 2); await page.mouse.down();
  await page.clock.runFor(700); await stage(page, "botan");
  await page.mouse.up(); await stage(page, "out"); await loop(page, false);
  assert.equal((await meter(page)).voices, 0);
  assert.deepEqual(errors.unexpected, []);
});

test("pointer shake and Jolt hand drop the bead; latch and keyboard permit steady exploration", async () => {
  const { page, errors } = await open(); await ready(page);
  await canvas(page).scrollIntoViewIfNeeded();
  const box = (await canvas(page).boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down(); await stage(page, "botan");
  await page.mouse.move(box.x + box.width / 2 + 65, box.y + box.height / 2); await stage(page, "dropped"); await loop(page, false); await page.mouse.up();
  assert.match(await page.getByTestId("senko-status").innerText(), /ember dropped/i);
  for (const flower of ["botan", "matsuba", "yanagi", "chiri-giku"]) {
    await page.getByTestId(`senko-stage-${flower}`).click(); await stage(page, flower); await loop(page, true);
    assert.equal(await page.getByTestId("senko-steady-btn").getAttribute("aria-pressed"), "true");
    await page.getByTestId("senko-shake-btn").click(); await stage(page, "dropped"); await loop(page, false);
  }
  await page.getByRole("button", { name: "New sparkler" }).click();
  await page.getByTestId("senko-hold-btn").focus(); await page.keyboard.down("Space"); await stage(page, "botan");
  await page.mouse.move(box.x + 5, box.y + 5); await stage(page, "botan");
  await page.keyboard.up("Space"); await stage(page, "out");
  assert.deepEqual(errors.unexpected, []);
});

test("hidden and blur inputs stop actual canvas draws; cancellation and route cleanup stop the loop", async () => {
  const { page, errors } = await open(); await ready(page); await page.clock.install();
  await page.getByTestId("senko-stage-matsuba").click(); await page.clock.runFor(100);
  // Lifecycle events are injected explicitly; rendering, rAF and the controller remain real.
  for (const input of ["hidden", "blur"]) {
    await page.evaluate((input) => {
      if (input === "hidden") {
        Object.defineProperty(document, "hidden", { configurable: true, value: true }); document.dispatchEvent(new Event("visibilitychange"));
      } else window.dispatchEvent(new Event("blur"));
    }, input);
    await loop(page, false); const stopped = await meter(page), elapsed = await canvas(page).getAttribute("data-held-ms");
    await page.clock.runFor(1200);
    assert.equal((await meter(page)).draws, stopped.draws, "no hidden or blurred canvas work");
    assert.equal(await canvas(page).getAttribute("data-held-ms"), elapsed, "away time excluded");
    await page.evaluate((input) => {
      if (input === "hidden") { Reflect.deleteProperty(document, "hidden"); document.dispatchEvent(new Event("visibilitychange")); }
      else window.dispatchEvent(new Event("focus"));
    }, input);
    await loop(page, true); await page.clock.runFor(100);
    assert.ok((await meter(page)).draws > stopped.draws, "latch resumes active work");
  }
  await canvas(page).dispatchEvent("pointercancel"); await loop(page, false); await stage(page, "out");
  await page.getByTestId("senko-stage-yanagi").click(); await page.clock.runFor(100);
  await page.getByRole("link", { name: "Back to Play", exact: true }).click(); await page.waitForURL("**/play");
  // Next caches outgoing routes in React Activity: effects clean up while DOM stays hidden.
  await canvas(page).waitFor({ state: "hidden" }); await loop(page, false);
  const draws = (await meter(page)).draws; await page.clock.runFor(500); assert.equal((await meter(page)).draws, draws);
  await page.goBack(); await ready(page); await stage(page, "idle"); await loop(page, false);
  assert.equal(await page.getByTestId("senko-steady-btn").getAttribute("aria-pressed"), "false", "cached route restores a consistent new session");
  await page.getByTestId("senko-steady-btn").click(); await loop(page, true);
  assert.deepEqual(errors.unexpected, []);
});

test("audio stays silent by default; opt-in crackle uses one real shared context and stops when muted", async () => {
  const { page, errors } = await open(); await ready(page);
  await page.getByTestId("senko-stage-matsuba").click();
  await page.waitForFunction(() => Number(document.querySelector('[data-testid="senko-canvas"]')?.getAttribute("data-particles")) > 8);
  assert.deepEqual({ contexts: (await meter(page)).contexts, voices: (await meter(page)).voices }, { contexts: 0, voices: 0 });
  await page.getByTestId("senko-sound-toggle").click();
  await page.waitForFunction(() => (window as unknown as { __senkoMeter: Meter }).__senkoMeter.frequencies.some((hz) => hz >= 1100 && hz <= 1950));
  assert.equal((await meter(page)).contexts, 1, "reuses the context unlocked by the sound toggle");
  await page.getByTestId("senko-sound-toggle").click();
  const voices = (await meter(page)).voices;
  await page.clock.install(); await page.clock.runFor(600);
  assert.equal((await meter(page)).voices, voices, "muting prevents further scheduled notes");
  assert.deepEqual(errors.unexpected, []);
});

test("reduced motion stays playable with a still stem, fewer sparks and a deliberate drop control", async () => {
  const { page, errors } = await open({ reducedMotion: "reduce", viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }); await ready(page);
  await page.clock.install();
  assert.equal(await canvas(page).getAttribute("data-reduced-motion"), "true");
  await page.getByTestId("senko-stage-matsuba").click(); await page.clock.runFor(400);
  assert.equal(await canvas(page).getAttribute("data-tremor"), "0");
  const calmCount = Number(await canvas(page).getAttribute("data-particles")); assert.ok(calmCount > 0);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.getByTestId("senko-stage-matsuba").click(); await page.clock.runFor(400);
  assert.ok(Number(await canvas(page).getAttribute("data-particles")) > calmCount, "calm mode emits fewer sparks on the same elapsed clock");
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const flower of ["botan", "matsuba", "yanagi", "chiri-giku"]) {
    await page.getByTestId(`senko-stage-${flower}`).tap(); await page.clock.runFor(100); await stage(page, flower);
    assert.equal(await canvas(page).getAttribute("data-tremor"), "0");
  }
  await page.getByTestId("senko-shake-btn").tap(); await stage(page, "dropped"); await loop(page, false);
  await canvas(page).scrollIntoViewIfNeeded();
  const box = (await canvas(page).boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down();
  await page.clock.runFor(700); await stage(page, "botan");
  await page.mouse.move(box.x + box.width / 2 + 65, box.y + box.height / 2); await stage(page, "botan");
  await page.mouse.up(); await stage(page, "out"); await loop(page, false);
  assert.equal((await meter(page)).voices, 0); assert.deepEqual(errors.unexpected, []);
});
