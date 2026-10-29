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

async function open(options: BrowserContextOptions = {}, route = "/", meter = false, clock = false) {
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
  if (clock) await page.clock.install();
  page.on("pageerror", (e) => errors.pageError(e.message));
  page.on("console", (msg) => { if (msg.type() === "error") errors.console({ text: msg.text(), ...msg.location(), args: msg.args().length }); });
  page.on("response", (res) => errors.response({ url: res.url(), status: res.status(), method: res.request().method(), resourceType: res.request().resourceType() }));
  const scripts: string[] = [];
  page.on("response", (res) => { if (res.request().resourceType() === "script") scripts.push(res.url()); });
  await page.goto(`${BASE}${route}`);
  await page.waitForFunction(() => document.body.dataset.shimiKeys === "ready");
  return { page, context, errors, scripts };
}

const canvas = (page: Page) => page.locator("[data-shimi-canvas]");
const meter = (page: Page) => page.evaluate(() => (window as unknown as { __shimiMeter: Meter }).__shimiMeter);
async function waitForNibble(page: Page) {
  // Walking to a word depends on distance, not a 12-second host deadline.
  // Advance the real animation in bounded one-second steps, retaining its rAFs.
  for (let second = 0; second < 60; second++) {
    if (Number(await canvas(page).getAttribute("data-shimi-nibbles")) > 0) return;
    await page.clock.runFor(1000);
  }
  assert.ok(Number(await canvas(page).getAttribute("data-shimi-nibbles")) > 0, "real swarm reaches visible text within one simulated minute");
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
  const prose = "main h1, main h2, main p";
  const beforeHome = await home.page.locator(prose).allTextContents();
  await home.page.locator("[data-pocket-shimi]").click();
  await canvas(home.page).waitFor();
  // The footer chip scrolls away from main's text; return to the visible food.
  await home.page.locator("main h1").scrollIntoViewIfNeeded();
  assert.equal(await canvas(home.page).getAttribute("aria-hidden"), "true");
  await waitForNibble(home.page);
  assert.deepEqual(await home.page.locator(prose).allTextContents(), beforeHome, "the consumed prose remains intact; toggle labels may change");
  await home.page.locator("[data-shimi-toggle]").click();
  await canvas(home.page).waitFor({ state: "detached" });

  const notes = await open({}, "/notes");
  const noteProse = "main h1, main [data-paper-id^='note:'] > h2, main [data-paper-id^='note:'] > p";
  const beforeNotes = await notes.page.locator(noteProse).allTextContents();
  await notes.page.keyboard.press("/");
  await notes.page.locator("dialog.pocket-terminal").waitFor({ state: "visible" });
  await notes.page.locator("#pt-in").fill("shimi on");
  await notes.page.keyboard.press("Enter");
  await canvas(notes.page).waitFor();
  assert.deepEqual(await notes.page.locator(noteProse).allTextContents(), beforeNotes);
  await notes.page.keyboard.press("Escape");
  await notes.page.keyboard.press("Escape");
  await canvas(notes.page).waitFor({ state: "detached" });

  const slug = await open({}, "/notes/backfills-are-a-feature", false, true);
  const slugProse = "main article h1, main article > p, main article > ul";
  const beforeSlug = await slug.page.locator(slugProse).allTextContents();
  await slug.page.keyboard.type("shimi");
  await canvas(slug.page).waitFor();
  assert.equal(new URL(slug.page.url()).pathname, "/notes/backfills-are-a-feature", "the word is not consumed by single-letter navigation");
  await waitForNibble(slug.page);
  assert.deepEqual(await slug.page.locator(slugProse).allTextContents(), beforeSlug);
  await slug.page.locator("[data-shimi-burp-trigger]").click();
  await slug.page.locator("[data-shimi-bubble]").waitFor();
  const burp = (await slug.page.locator("[data-shimi-bubble]").textContent()) ?? "";
  assert.ok(burp.split(/\s+/).length >= 4);
  const vocab = new Set<string>([...(beforeSlug.join(" ").toLowerCase().match(/[a-z0-9']+/g) ?? []), "little", "paper", "dreams", "taste", "of", "quiet", "ink"]);
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
  assert.equal(new URL(page.url()).pathname, "/notes/on-twos");
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
  // Sound-on plays its own 990Hz cue; measure the following bookworm chirps.
  await live.page.evaluate(() => {
    const probe = (window as unknown as { __shimiMeter: Meter }).__shimiMeter;
    probe.voices = 0; probe.frequencies = [];
  });
  await live.page.keyboard.type("shimi");
  await canvas(live.page).waitFor();
  await waitForNibble(live.page);
  await live.page.waitForFunction(() => (window as unknown as { __shimiMeter: Meter }).__shimiMeter.voices > 0, null, { timeout: 8_000 });
  const heard = await meter(live.page);
  assert.ok(heard.voices > 0 && heard.voices <= 24);
  assert.ok(heard.frequencies.every((hz) => hz >= 260 && hz <= 880));
  assert.deepEqual(errors.unexpected, []);
  assert.deepEqual(live.errors.unexpected, []);
});
