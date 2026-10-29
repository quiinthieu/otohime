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

async function open(options: BrowserContextOptions = {}, route = "/", meter = false, virtual = false) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, ...options });
  contexts.push(context);
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
  if (virtual) await page.clock.install({ time: new Date("2026-10-29T12:00:00Z") });
  page.on("pageerror", (e) => errors.pageError(e.message));
  page.on("console", (msg) => { if (msg.type() === "error") errors.console({ text: msg.text(), ...msg.location(), args: msg.args().length }); });
  page.on("response", (res) => errors.response({ url: res.url(), status: res.status(), method: res.request().method(), resourceType: res.request().resourceType() }));
  const scripts: string[] = [];
  page.on("response", (res) => { if (res.request().resourceType() === "script") scripts.push(res.url()); });
  await page.goto(`${BASE}${route}`);
  await page.locator('[data-shimi-ready="true"]').waitFor({ state: "attached" });
  // Crumple hydrates its controls separately. Capture the DOM text baseline
  // after those real controls arrive, rather than attributing them to Shimi.
  if (route === "/notes") await page.waitForFunction(() => {
    const cards = [...document.querySelectorAll("main [data-paper-id]")];
    return cards.length > 0 && cards.every(card => card.querySelector("[data-paper-controls]"));
  });
  return { page, context, errors, scripts };
}

const canvas = (page: Page) => page.locator("[data-shimi-canvas]");
const meter = (page: Page) => page.evaluate(() => (window as unknown as { __shimiMeter: Meter }).__shimiMeter);
const pageText = (page: Page) => page.locator("main").evaluate(main => {
  const copy = main.cloneNode(true) as Element;
  // Toggle labels and selected options are live UI state; compare the complete
  // article copy, links and headings rather than those interactive labels.
  copy.querySelectorAll("button,select,output").forEach(control => control.remove());
  return copy.textContent;
});

async function crawlToText(page: Page) {
  await page.clock.pauseAt(new Date("2026-10-29T13:00:00Z"));
  // At 18px/s a creature can cross this viewport in under 90s. Advance real
  // renderer frames in small slices so a four-second nibble cannot be missed.
  for (let step = 0; step < 180; step++) {
    await page.clock.runFor(500);
    if (Number(await canvas(page).getAttribute("data-shimi-nibbles")) > 0) return;
  }
  assert.fail("Shimi did not reach visible text within 90 seconds of browser time");
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
  const home = await open({}, "/", false, true);
  await home.page.locator("[data-pocket-shimi]").waitFor();
  const beforeHome = await pageText(home.page);
  await home.page.locator("[data-pocket-shimi]").click();
  await canvas(home.page).waitFor();
  assert.equal(await canvas(home.page).getAttribute("aria-hidden"), "true");
  await crawlToText(home.page);
  assert.equal(await home.page.locator("[data-pocket-shimi]").getAttribute("aria-pressed"), "true");
  assert.equal(await pageText(home.page), beforeHome);
  await home.page.locator("[data-shimi-toggle]").click();
  await canvas(home.page).waitFor({ state: "detached" });

  const notes = await open({}, "/notes");
  const beforeNotes = await pageText(notes.page);
  await notes.page.keyboard.press("/");
  await notes.page.locator("dialog.pocket-terminal").waitFor({ state: "visible" });
  await notes.page.locator("#pt-in").fill("shimi on");
  await notes.page.keyboard.press("Enter");
  await canvas(notes.page).waitFor();
  assert.equal(await pageText(notes.page), beforeNotes);
  await notes.page.keyboard.press("Escape");
  await notes.page.keyboard.press("Escape");
  await canvas(notes.page).waitFor({ state: "detached" });

  const slug = await open({}, "/notes/backfills-are-a-feature", false, true);
  const beforeSlug = await pageText(slug.page);
  await slug.page.keyboard.type("shimi");
  await canvas(slug.page).waitFor();
  await crawlToText(slug.page);
  assert.equal(await pageText(slug.page), beforeSlug);
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
  const { page, errors } = await open({ reducedMotion: "reduce" }, "/notes/on-twos", true);
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
  await live.page.locator(".sound-toggle").click();
  await live.page.waitForFunction(() => (window as unknown as { __shimiMeter: Meter }).__shimiMeter.voices >= 2);
  await live.page.evaluate(() => {
    const probe = (window as unknown as { __shimiMeter: Meter }).__shimiMeter;
    probe.voices = 0; probe.frequencies = []; // Measure chirps after the sound switch's confirmation cue.
  });
  await live.page.keyboard.type("shimi");
  await canvas(live.page).waitFor();
  await crawlToText(live.page);
  await live.page.waitForFunction(() => (window as unknown as { __shimiMeter: Meter }).__shimiMeter.voices > 0, null, { timeout: 8_000 });
  const heard = await meter(live.page);
  assert.ok(heard.voices > 0 && heard.voices <= 24);
  assert.ok(heard.frequencies.every((hz) => hz >= 260 && hz <= 880));
  assert.deepEqual(errors.unexpected, []);
  assert.deepEqual(live.errors.unexpected, []);
});
