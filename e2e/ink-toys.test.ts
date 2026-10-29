import assert from "node:assert/strict";
import { after, afterEach, before, test } from "node:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { chromium, type Browser, type BrowserContext, type BrowserContextOptions, type Page } from "playwright-core";
import sharp from "sharp";
import { collectBrowserErrors } from "./console-errors.ts";
import { decodePattern, encodePattern, demoPattern } from "../lib/loom.ts";

const BASE = process.env.BASE_URL ?? "http://localhost:4000";
const tmp = mkdtempSync("/tmp/ink-toys-e2e-");
let browser: Browser;
const contexts: BrowserContext[] = [];
before(async () => {
  const env = { ...process.env, TMPDIR: tmp }, args = ["--mute-audio"];
  if (process.env.CHROME_PATH) browser = await chromium.launch({ executablePath: process.env.CHROME_PATH, env, args });
  else { try { browser = await chromium.launch({ channel: "chrome", env, args }); } catch { browser = await chromium.launch({ env, args }); } }
});
afterEach(async () => { for (const context of contexts.splice(0)) await context.close(); });
after(async () => { await browser?.close(); rmSync(tmp, { recursive: true, force: true }); });
type Meter = { contexts: number; oscillators: number; buffers: number; peak: number };
async function open(route: string, options: BrowserContextOptions = {}, blockedStorage = false) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, ...options }); contexts.push(context);
  await context.addInitScript(({ blockedStorage }) => {
    if (blockedStorage) Object.defineProperty(window, "localStorage", { get() { throw Error("Storage denied"); } });
    const meter = { contexts: 0, oscillators: 0, buffers: 0, peak: 0 };
    Object.assign(window, { __inkMeter: meter });
    // Keep the user's clipboard untouched while testing the copy button's actual payload.
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async (text: string) => { Object.assign(window, { __inkCopied: text }); } } });
    const Real = window.AudioContext;
    if (Real) window.AudioContext = class extends Real {
      constructor(options?: AudioContextOptions) { super(options); meter.contexts++; }
      createOscillator() { const node = super.createOscillator(); const start = node.start; node.start = function(...args) { meter.oscillators++; return start.apply(this, args); }; return node; }
      createBufferSource() { const node = super.createBufferSource(); const start = node.start; node.start = function(...args) { meter.buffers++; return start.apply(this, args); }; return node; }
      createGain() {
        const gain = super.createGain(), connect = gain.connect.bind(gain);
        gain.connect = ((target: AudioNode | AudioParam, ...args: number[]) => {
          if (target === this.destination) {
            const analyser = this.createAnalyser(); analyser.fftSize = 512;
            analyser.connect(this.destination);
            const data = new Float32Array(512);
            const timer = setInterval(() => { analyser.getFloatTimeDomainData(data); for (const n of data) meter.peak = Math.max(meter.peak, Math.abs(n)); }, 10);
            setTimeout(() => clearInterval(timer), 15000);
            return connect(analyser);
          }
          return target instanceof AudioNode ? connect(target, ...args) : connect(target, ...args);
        }) as typeof gain.connect;
        return gain;
      }
    };
  }, { blockedStorage });
  const page = await context.newPage(), errors = collectBrowserErrors(BASE);
  page.on("pageerror", e => errors.pageError(e.message));
  page.on("console", msg => { if (msg.type() === "error") errors.console({ text: msg.text(), ...msg.location(), args: msg.args().length }); });
  page.on("response", res => errors.response({ url: res.url(), status: res.status(), method: res.request().method(), resourceType: res.request().resourceType() }));
  await page.goto(`${BASE}${route}`);
  return { page, context, errors };
}
const meter = (page: Page) => page.evaluate(() => (window as unknown as { __inkMeter: Meter }).__inkMeter);
const loom = (page: Page) => page.getByTestId("loom");
async function ready(page: Page) { await page.waitForFunction(() => { const button = document.querySelector<HTMLButtonElement>('[aria-label="Ink Loom sequencer"] button'); return button && !button.disabled; }); }
async function png(page: Page, name: string, width: number, height: number) {
  const pending = page.waitForEvent("download"); await page.getByRole("button", { name, exact: true }).click();
  const download = await pending; const path = await download.path(); assert.ok(path);
  const bytes = readFileSync(path), image = sharp(bytes), metadata = await image.metadata();
  assert.equal(metadata.format, "png"); assert.equal(metadata.width, width); assert.equal(metadata.height, height);
  const stats = await image.stats(); assert.ok(stats.channels.some(c => c.stdev > 10), "export contains real ink");
  return bytes;
}

for (const width of [1280, 390]) test(`Play discovery, stamping, share restore and score PNG at ${width}px`, async () => {
  const { page, errors } = await open("/play", { viewport: { width, height: 900 }, hasTouch: width === 390 });
  assert.equal(await page.getByTestId("play-hanko-link").getAttribute("href"), "/play/hanko");
  await page.getByTestId("play-loom-link").click(); await page.waitForURL("**/play/loom*"); await ready(page);
  assert.equal(await page.getByRole("button", { name: /, step / }).count(), 128);
  assert.ok((await loom(page).locator('tbody button').first().boundingBox())!.height >= 44, "paper grid styles loaded");
  const cell = page.getByRole("button", { name: "Paper · soft, step 16", exact: true });
  await cell.focus(); await page.keyboard.press("Space"); assert.equal(await cell.getAttribute("aria-pressed"), "true");
  const tempo = page.getByRole("slider", { name: "Tempo" }); await tempo.fill("132");
  await page.getByRole("slider", { name: "Swing" }).fill("35");
  await page.getByRole("button", { name: "Copy loop link ↗", exact: true }).click();
  const shared = await page.evaluate(() => (window as unknown as { __inkCopied: string }).__inkCopied);
  assert.equal(new URL(shared).hash, encodePattern({ tempo: 132, swing: 35, rows: [0, 0, 0, 0, 0, 0, 0, 32768] }));
  await page.reload(); await ready(page); assert.equal(await cell.getAttribute("aria-pressed"), "true");
  assert.equal(await tempo.inputValue(), "132");
  await png(page, "Press to print ↓", 1440, 850);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "only the score scrolls, not the page");
  assert.equal((await meter(page)).contexts, 0, "editing and exporting never unlock audio");
  await page.screenshot({ path: `/tmp/pm285-loom-${width}.png` });
  assert.deepEqual(errors.unexpected, []);
});

test("silent playback, real synth and noise signal, mute, hide and route cancellation", async () => {
  const { page, errors } = await open(`/play/loom${encodePattern({ ...demoPattern(), rows: Array(8).fill(65535) })}`); await ready(page);
  await loom(page).getByRole("button", { name: "Play", exact: true }).click();
  await page.waitForFunction(() => Number(document.querySelector('[data-testid="loom"]')?.getAttribute("data-step")) >= 1);
  assert.equal((await meter(page)).contexts, 0);
  await loom(page).getByRole("button", { name: "Sound off", exact: true }).click();
  assert.equal((await meter(page)).contexts, 0, "enabling the toy's switch is silent until Play");
  await loom(page).getByRole("button", { name: "Play", exact: true }).click();
  await page.waitForFunction(() => { const m = (window as unknown as { __inkMeter: Meter }).__inkMeter; return m.oscillators >= 4 && m.buffers >= 4 && m.peak > .001; });
  assert.equal((await meter(page)).contexts, 1, "all eight voices share the site's one context");
  await loom(page).getByRole("button", { name: "Sound on", exact: true }).click();
  const stopped = await meter(page); await page.waitForTimeout(250);
  assert.deepEqual(await meter(page), stopped, "mute cancels sources and future scheduling");
  await loom(page).getByRole("button", { name: "Sound off", exact: true }).click();
  await loom(page).getByRole("button", { name: "Play", exact: true }).click();
  await page.evaluate(() => { Object.defineProperty(document, "hidden", { configurable: true, value: true }); document.dispatchEvent(new Event("visibilitychange")); });
  await page.waitForFunction(() => document.querySelector('[data-testid="loom"]')?.getAttribute("data-playing") === "false");
  const hidden = await meter(page); await page.waitForTimeout(250); assert.deepEqual(await meter(page), hidden);
  await page.evaluate(() => { Reflect.deleteProperty(document, "hidden"); document.dispatchEvent(new Event("visibilitychange")); });
  await loom(page).getByRole("button", { name: "Play", exact: true }).click();
  await page.getByRole("link", { name: "Back to Play", exact: false }).click(); await page.waitForURL("**/play");
  await loom(page).waitFor({ state: "hidden" });
  const away = await meter(page); await page.waitForTimeout(250); assert.deepEqual(await meter(page), away);
  await page.goBack(); await ready(page); assert.equal(await loom(page).getAttribute("data-playing"), "false");
  assert.deepEqual(errors.unexpected, []);
});

test("invalid hashes and absent audio keep Loom usable in reduced motion", async () => {
  const { page, errors } = await open("/play/loom#t=900&s=999&p=bad", { reducedMotion: "reduce", viewport: { width: 390, height: 844 } }, true);
  await ready(page); assert.equal(await loom(page).locator('[aria-pressed="true"]').count(), 0);
  await page.evaluate(() => { Object.defineProperty(window, "AudioContext", { configurable: true, value: undefined }); });
  await loom(page).getByRole("button", { name: "Try a pattern", exact: true }).click();
  await loom(page).getByRole("button", { name: "Sound off", exact: true }).click();
  await loom(page).getByRole("button", { name: "Play", exact: true }).click();
  await page.waitForFunction(() => Number(document.querySelector('[data-testid="loom"]')?.getAttribute("data-step")) >= 0);
  const blot = loom(page).locator('[aria-pressed="true"] svg').first();
  assert.equal(await blot.evaluate(el => getComputedStyle(el).filter), "none");
  assert.equal(await blot.evaluate(el => getComputedStyle(el).animationName), "none");
  await loom(page).getByRole("button", { name: "Stop", exact: true }).click();
  await loom(page).getByRole("button", { name: "Clear", exact: true }).click();
  await page.waitForFunction(() => location.hash.startsWith("#t=108&s=0&p=0000"));
  assert.deepEqual(decodePattern(new URL(page.url()).hash)?.rows, Array(8).fill(0));
  assert.deepEqual(errors.unexpected, []);
});

for (const shape of ["Square", "Round"]) test(`Hanko ${shape}: deterministic carving, complete SVG/PNG and saved signatures`, async () => {
  const { page, errors } = await open("/play/hanko", { viewport: { width: shape === "Square" ? 1280 : 390, height: 900 } });
  const name = page.getByRole("textbox", { name: "Name to carve" });
  await name.fill("Billie乙姫"); await page.getByRole("radio", { name: shape, exact: true }).check();
  const impression = page.getByTestId("hanko-impression");
  const carving = await impression.locator("svg > path").getAttribute("d");
  await page.getByRole("button", { name: "Press your seal ↓", exact: true }).click();
  assert.equal((await meter(page)).contexts, 0);
  assert.equal(await impression.getAttribute("data-pressed"), "true");
  const pending = page.waitForEvent("download"); await page.getByRole("button", { name: "Download SVG", exact: true }).click();
  const download = await pending, bytes = readFileSync((await download.path())!);
  assert.equal(download.suggestedFilename(), "hanko-seal.svg");
  assert.match(bytes.toString(), /Billie乙姫/); assert.match(bytes.toString(), /<mask/);
  const rendered = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let filled = 0; for (let i = 3; i < rendered.data.length; i += 4) if (rendered.data[i] > 100) filled++;
  assert.ok(filled > 100000 && filled < 600000, "SVG renders ink and transparent carving");
  const pngBytes = await png(page, "Download PNG", 1200, 1200);
  assert.equal((await sharp(pngBytes).metadata()).hasAlpha, true);
  await page.goto(`${BASE}/notes`);
  const signatures = page.locator('[data-hanko-signature] [data-hanko-name]');
  await page.waitForFunction(() => { const seals = [...document.querySelectorAll('[data-hanko-signature] [data-hanko-name]')]; return seals.length === 2 && seals.every(el => el.getAttribute("data-hanko-name") === "Billie乙姫"); });
  assert.equal(await signatures.count(), 2);
  for (const sig of await signatures.all()) assert.equal(await sig.getAttribute("data-hanko-name"), "Billie乙姫");
  await page.reload(); await page.waitForFunction(() => document.querySelector('[data-hanko-signature] [data-hanko-name]')?.getAttribute("data-hanko-name") === "Billie乙姫");
  const note = page.locator('main a[href^="/notes/"]').first();
  await note.click(); await page.waitForURL("**/notes/*");
  await page.waitForFunction(() => { const seals = [...document.querySelectorAll('[data-hanko-signature] [data-hanko-name]')].filter(el => el.checkVisibility()); return seals.length === 2 && seals.every(el => el.getAttribute("data-hanko-name") === "Billie乙姫"); });
  await page.goto(`${BASE}/play/hanko`); await name.fill("Billie乙姫"); await page.getByRole("radio", { name: shape, exact: true }).check();
  assert.equal(await impression.locator("svg > path").getAttribute("d"), carving);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.screenshot({ path: `/tmp/pm285-hanko-${shape}.png` });
  assert.deepEqual(errors.unexpected, []);
});

test("Hanko handles blocked storage and hostile input, reduced motion and dark paper", async () => {
  const { page, errors } = await open("/play/hanko", { reducedMotion: "reduce", colorScheme: "dark", viewport: { width: 390, height: 844 } }, true);
  await page.getByRole("textbox", { name: "Name to carve" }).fill('<&"乙姫');
  await page.getByRole("button", { name: "Press your seal ↓", exact: true }).click();
  assert.match(await page.getByRole("status").filter({ hasText: "Storage is unavailable" }).innerText(), /still download/);
  assert.equal(await page.getByTestId("hanko-impression").evaluate(el => getComputedStyle(el).animationName), "none");
  await png(page, "Download PNG", 1200, 1200);
  await page.goto(`${BASE}/notes`);
  await page.waitForFunction(() => document.querySelector('[data-hanko-signature] [data-hanko-name]')?.getAttribute("data-hanko-name") === "乙姫");
  assert.deepEqual(errors.unexpected, []);
});

test("Hanko's thunk starts only on an opted-in press and reuses the shared context", async () => {
  const { page, errors } = await open("/play/hanko");
  await page.getByRole("textbox", { name: "Name to carve" }).fill("乙姫");
  await page.getByRole("button", { name: "Sound off", exact: true }).click();
  assert.equal((await meter(page)).contexts, 0);
  await page.getByRole("button", { name: "Press your seal ↓", exact: true }).click();
  await page.waitForFunction(() => (window as unknown as { __inkMeter: Meter }).__inkMeter.peak > .001);
  assert.equal((await meter(page)).contexts, 1);
  await page.getByRole("button", { name: "Press your seal ↓", exact: true }).click();
  assert.equal((await meter(page)).contexts, 1);
  await page.getByRole("button", { name: "Sound on", exact: true }).click();
  const voices = (await meter(page)).oscillators;
  await page.getByRole("button", { name: "Press your seal ↓", exact: true }).click();
  assert.equal((await meter(page)).oscillators, voices);
  assert.deepEqual(errors.unexpected, []);
});
