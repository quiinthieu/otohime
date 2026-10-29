import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { chromium, type Browser, type BrowserContext, type BrowserContextOptions, type Page } from "playwright-core";
import { collectBrowserErrors } from "./console-errors.ts";

const BASE = process.env.BASE_URL ?? "http://localhost:4000";
const tmp = mkdtempSync("/tmp/shimi-e2e-");
let browser: Browser;
const contexts: BrowserContext[] = [];
type Meter = { frames: number; voices: number; frequencies: number[] };

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
  await browser?.close();
  rmSync(tmp, { recursive: true, force: true });
});

async function open(options: BrowserContextOptions = {}, route = "/", meter = false, keyboard = false) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, ...options });
  contexts.push(context);
  if (keyboard) await context.addInitScript(() => {
    if (!sessionStorage.getItem("shimi-keyboard-fixture")) {
      localStorage.setItem("shimi", "on");
      sessionStorage.setItem("shimi-keyboard-fixture", "ready");
    }
  });
  if (meter) {
    await context.addInitScript(() => {
      const probe = { frames: 0, voices: 0, frequencies: [] as number[] };
      Object.assign(window, { __shimiMeter: probe });
      const clear = CanvasRenderingContext2D.prototype.clearRect;
      CanvasRenderingContext2D.prototype.clearRect = function (...args) {
        if (this.canvas.hasAttribute("data-shimi-canvas")) probe.frames++;
        return clear.apply(this, args);
      };
      const Real = window.AudioContext;
      if (Real) window.AudioContext = class extends Real {
        constructor(options?: AudioContextOptions) { super(options); }
        createOscillator() {
          const oscillator = super.createOscillator(), start = oscillator.start;
          oscillator.start = function (...args) {
            probe.voices++;
            probe.frequencies.push(oscillator.frequency.value);
            return start.apply(this, args);
          };
          return oscillator;
        }
      };
    });
  }
  const page = await context.newPage(), errors = collectBrowserErrors(BASE);
  page.on("pageerror", (e) => errors.pageError(e.message));
  page.on("console", (msg) => { if (msg.type() === "error") errors.console({ text: msg.text(), ...msg.location(), args: msg.args().length }); });
  page.on("response", (res) => errors.response({ url: res.url(), status: res.status(), method: res.request().method(), resourceType: res.request().resourceType() }));
  const scripts: string[] = [];
  page.on("response", (res) => { if (res.request().resourceType() === "script") scripts.push(res.url()); });
  await page.goto(`${BASE}${route}`);
  return { page, context, errors, scripts };
}

const canvas = (page: Page) => page.locator("[data-shimi-canvas]");
const meter = (page: Page) => page.evaluate(() => (window as unknown as { __shimiMeter: Meter }).__shimiMeter);
const mainText = (page: Page) => page.locator("main").evaluate((main) => {
  const copy = main.cloneNode(true) as Element;
  // The activation chip intentionally changes its own label; all crawlable page text must stay intact.
  copy.querySelectorAll("[data-pocket-shimi]").forEach((chip) => chip.remove());
  return copy.textContent;
});

// Turning off the persisted-on fixture acknowledges the lazy loader and its keyboard effect.
// Page load alone does not acknowledge hydration, so typing immediately can lose the summon sequence.
async function keyboardReady(page: Page) {
  await canvas(page).waitFor();
  await page.locator("[data-shimi-toggle]").click();
  await canvas(page).waitFor({ state: "detached" });
}

async function nibble(page: Page) {
  // Creatures walk at 18–36px/s to visible words. Advance real frame callbacks instead of assuming
  // that a distant random target will be reached in 12 wall-clock seconds on every viewport/runner.
  await page.clock.install();
  for (let seconds = 0; seconds < 120; seconds++) {
    await page.clock.runFor(1000);
    if (Number(await canvas(page).getAttribute("data-shimi-nibbles")) > 0) return;
  }
  assert.fail("live Shimi did not nibble within 120 simulated seconds");
}

test("Shimi Bookworms stay off by default on Home and Notes", async () => {
  for (const route of ["/", "/notes"]) {
    const { page, errors, scripts } = await open({}, route);
    assert.equal(await canvas(page).count(), 0);
    assert.equal(await page.locator("[data-shimi-pill]").count(), 0);
    assert.ok(!scripts.some((url) => /\/shimi\/canvas/.test(url)));
    assert.deepEqual(errors.unexpected, []);
  }
});

test("Pocket chip, terminal, and typing shimi summon overlay nibbles without mutating DOM text", async () => {
  const home = await open({}, "/");
  await home.page.locator("[data-pocket-shimi]").waitFor();
  const beforeHome = await mainText(home.page);
  await home.page.locator("[data-pocket-shimi]").click();
  await canvas(home.page).waitFor();
  assert.equal(await canvas(home.page).getAttribute("aria-hidden"), "true");
  assert.equal(await home.page.locator("[data-pocket-shimi]").getAttribute("aria-pressed"), "true");
  await nibble(home.page);
  assert.equal(await mainText(home.page), beforeHome);
  await home.page.locator("[data-shimi-toggle]").click();
  await canvas(home.page).waitFor({ state: "detached" });

  const notes = await open({}, "/notes", false, true);
  await keyboardReady(notes.page);
  const beforeNotes = await mainText(notes.page);
  await notes.page.keyboard.press("/");
  await notes.page.locator("dialog.pocket-terminal").waitFor({ state: "visible" });
  await notes.page.locator("#pt-in").fill("shimi on");
  await notes.page.keyboard.press("Enter");
  await canvas(notes.page).waitFor();
  assert.equal(await mainText(notes.page), beforeNotes);
  await notes.page.keyboard.press("Escape");
  await notes.page.keyboard.press("Escape");
  await canvas(notes.page).waitFor({ state: "detached" });

  const slug = await open({}, "/notes/backfills-are-a-feature", false, true);
  await keyboardReady(slug.page);
  const beforeSlug = await mainText(slug.page);
  await slug.page.keyboard.type("shimi");
  await canvas(slug.page).waitFor();
  await nibble(slug.page);
  assert.equal(await mainText(slug.page), beforeSlug);
  await slug.page.locator("[data-shimi-burp-trigger]").click();
  await slug.page.locator("[data-shimi-bubble]").waitFor();
  const burp = (await slug.page.locator("[data-shimi-bubble]").textContent()) ?? "";
  assert.ok(burp.split(/\s+/).length >= 4);
  const vocab = new Set<string>([...((beforeSlug ?? "").toLowerCase().match(/[a-z0-9']+/g) ?? []), "little", "paper", "dreams", "taste", "of", "quiet", "ink"]);
  assert.ok(burp.toLowerCase().split(/\s+/).some((word) => vocab.has(word.replace(/[^a-z0-9']/g, ""))));
  await slug.page.mouse.move(24, 24);
  await slug.page.keyboard.press("Escape");
  await canvas(slug.page).waitFor({ state: "detached" });
  await slug.page.reload();
  assert.equal(await canvas(slug.page).count(), 0);
  assert.deepEqual(home.errors.unexpected, []);
  assert.deepEqual(notes.errors.unexpected, []);
  assert.deepEqual(slug.errors.unexpected, []);
});

test("reduced motion stays static with button-only burps; muted sound schedules no chirps", async () => {
  const { page, errors } = await open({ reducedMotion: "reduce" }, "/notes/on-twos", true, true);
  await keyboardReady(page);
  await page.keyboard.type("shimi");
  await canvas(page).waitFor();
  assert.equal(await canvas(page).getAttribute("data-shimi-mode"), "static");
  const before = (await meter(page)).frames;
  await page.waitForTimeout(400);
  const after = (await meter(page)).frames;
  assert.ok(after - before < 8, `static mode kept rAF quiet: ${after - before}`);
  assert.equal(await page.locator("[data-shimi-bubble]").count(), 0);
  await page.locator("[data-shimi-burp-trigger]").click();
  await page.locator("[data-shimi-bubble]").waitFor();
  assert.equal((await meter(page)).voices, 0);
  await page.locator(".sound-toggle").click();
  await page.waitForTimeout(800);
  const live = await open({}, "/notes/the-contract-caught-it", true, true);
  await keyboardReady(live.page);
  await live.page.locator(".sound-toggle").click();
  await live.page.waitForFunction(() => (window as unknown as { __shimiMeter: Meter }).__shimiMeter.voices > 0);
  await live.page.evaluate(() => {
    const probe = (window as unknown as { __shimiMeter: Meter }).__shimiMeter;
    probe.voices = 0;
    probe.frequencies = [];
  });
  await live.page.keyboard.type("shimi");
  await canvas(live.page).waitFor();
  await nibble(live.page);
  await live.page.waitForFunction(() => (window as unknown as { __shimiMeter: Meter }).__shimiMeter.voices > 0, null, { timeout: 8_000 });
  const heard = await meter(live.page);
  assert.ok(heard.voices > 0 && heard.voices <= 24);
  assert.ok(heard.frequencies.every((hz) => hz >= 260 && hz <= 880));
  assert.deepEqual(errors.unexpected, []);
  assert.deepEqual(live.errors.unexpected, []);
});
