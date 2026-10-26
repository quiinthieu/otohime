// Real production browser/renderer, with Playwright's elapsed/calendar fixtures (no app test hooks).
import assert from "node:assert/strict";
import { after, before, test, type TestContext } from "node:test";
import { chromium, type Browser, type BrowserContextOptions, type Page } from "playwright-core";

const BASE = process.env.BASE_URL ?? "http://localhost:4000";
let browser: Browser;
before(async () => {
  const options = { env: { ...process.env, TMPDIR: "/tmp" } };
  if (process.env.CHROME_PATH) browser = await chromium.launch({ ...options, executablePath: process.env.CHROME_PATH });
  else { try { browser = await chromium.launch({ ...options, channel: "chrome" }); } catch { browser = await chromium.launch(options); } }
});
after(async () => { await browser?.close(); });

async function open(t: TestContext, options: BrowserContextOptions = {}, init?: () => void, clock = false) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 860 }, timezoneId: "Asia/Tokyo", ...options });
  t.after(() => context.close());
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  t.after(() => assert.deepEqual(errors, [], "no browser exceptions"));
  if (init) await page.addInitScript(init);
  if (clock) await page.clock.install({ time: new Date("2026-10-26T12:00:00+09:00") });
  assert.equal((await page.goto(`${BASE}/projects`, { waitUntil: "load" }))?.status(), 200);
  return { page, context };
}
const state = (page: Page) => page.locator("[data-kame]").getAttribute("data-state");
const ready = (page: Page) => page.waitForSelector("[data-kame]", { state: "attached" });

test("server baseline has only an inert shell; no JS retains public links", async (t) => {
  const html = await (await fetch(`${BASE}/projects`)).text();
  assert.match(html, /id="kame-shell"/);
  assert.doesNotMatch(html, /<button[^>]*>Call Kame|data-kame=""|<input[^>]*aria-label="Kame name"/);
  const { page } = await open(t, { javaScriptEnabled: false });
  assert.equal(await page.locator("[data-kame]").count(), 0);
  assert.ok(await page.locator(".project-title[href]").count() > 0);
  assert.equal(await page.locator('[data-end-page="/notes"]').getAttribute("href"), "/notes");
});

test("swimming, accelerated 45s idle, Call, keyboard name, dismissal and shell persist", async (t) => {
  const { page } = await open(t, {}, undefined, true);
  await ready(page);
  assert.equal(await state(page), "swim");
  const initial = (await page.locator("[data-kame]").boundingBox())!;
  assert.ok(initial.x >= 1220 && initial.y > 250, "first paint places Kame along the page edge");
  assert.equal(await page.locator("[data-kame] svg").evaluate((svg) => svg.getAnimations().some((a) => a.playState === "running")), true, "edge swimming runs on CSS");
  await page.clock.fastForward(46_000);
  assert.equal(await state(page), "nap");
  assert.equal(await page.locator('[data-kame] svg circle').count(), 1, "sleep bubble is visible");
  await page.getByRole("button", { name: "Call Kame", exact: true }).click();
  assert.equal(await state(page), "follow");
  await page.mouse.move(300, 250); await page.clock.runFor(500);
  const box = await page.locator("[data-kame]").boundingBox();
  assert.ok(box && box.x < 1200, "called turtle follows away from the edge");
  const field = page.getByRole("textbox", { name: "Kame name" });
  await field.fill("  Mizu from the very long sea name  ");
  await field.press("Enter");
  assert.equal(await field.inputValue(), "Mizu from the very long");
  await page.getByRole("button", { name: "Hide Kame in shell" }).click();
  assert.equal(await state(page), "shell");
  assert.equal(await page.getByRole("button", { name: "Restore Kame from shell" }).evaluate((button) => document.activeElement === button), true);
  await page.clock.resume(); await page.reload({ waitUntil: "load" }); await ready(page);
  assert.equal(await state(page), "shell");
  assert.equal(await page.getByLabel("Kame name").inputValue(), "Mizu from the very long");
  await page.getByRole("button", { name: "Restore Kame from shell" }).click();
  assert.equal(await state(page), "swim");
  assert.equal(await page.getByRole("button", { name: "Call Kame", exact: true }).evaluate((button) => document.activeElement === button), true);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("kame:v1")!));
  assert.equal(saved.streak, 1); assert.equal(saved.dismissed, false);
  assert.deepEqual(Object.keys(saved).sort(), ["dismissed", "lastVisit", "name", "streak"]);
});

test("local calendar fixture increments once per day, friendly on day three and future-safe", async (t) => {
  const { page } = await open(t, {}, () => {
    if (!localStorage.getItem("kame:v1")) localStorage.setItem("kame:v1", JSON.stringify({ name: "Tama", lastVisit: "2026-10-25", streak: 2, dismissed: false }));
  }, true);
  await ready(page);
  assert.match(await page.getByRole("region", { name: "Kame companion" }).textContent() ?? "", /Tama · calm · day 3 · happy/);
  await page.reload({ waitUntil: "load" }); await ready(page);
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem("kame:v1")!).streak), 3);
  await page.evaluate(() => localStorage.setItem("kame:v1", JSON.stringify({ lastVisit: "2099-01-01", streak: 99 })));
  await page.reload({ waitUntil: "load" }); await ready(page);
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem("kame:v1")!).streak), 1);
});

test("keyboard hold threshold, focus loss, live reduced motion and Pocket pause", async (t) => {
  const { page } = await open(t, {}, undefined, true); await ready(page);
  // install() keeps time running during hydration. Freeze before key-down so
  // protocol time cannot turn the 499ms negative control into a 500ms hold.
  await page.clock.pauseAt(new Date("2026-10-26T13:00:00+09:00"));
  const pet = page.getByRole("button", { name: "Hold to pet Kame" });
  await pet.focus(); await page.keyboard.down("Space"); await page.clock.runFor(499);
  assert.notEqual(await state(page), "pet");
  await page.clock.runFor(1); assert.equal(await state(page), "pet");
  await page.keyboard.up("Space"); assert.equal(await state(page), "swim");
  // Measure the entire resumed hold on the flowing page clock. Host/protocol
  // delay and a second virtual advance cannot stand in for an elapsed hold.
  await page.clock.resume();
  await pet.focus();
  assert.equal(await pet.evaluate((button) => document.activeElement === button), true);
  await page.keyboard.down("Space");
  const started = await page.evaluate(() => Date.now());
  await page.waitForFunction((started) => Date.now() - started >= 600, started, { timeout: 5_000 });
  const elapsed = await page.evaluate(() => Date.now()) - started;
  assert.ok(elapsed >= 600, `resumed page clock advanced ${elapsed}ms`);
  assert.equal(await state(page), "pet", "the focused key remains held beyond the 500ms threshold");
  await page.keyboard.up("Space"); assert.equal(await state(page), "swim");
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 100));
  await page.keyboard.down("Enter"); await page.clock.runFor(500); assert.equal(await state(page), "pet");
  await page.getByLabel("Kame name").focus(); await page.keyboard.up("Enter"); assert.equal(await state(page), "swim");
  await page.getByLabel("Kame name").fill("k"); await page.getByLabel("Kame name").press("k"); assert.equal(await state(page), "swim", "typing k is not Call");
  await pet.focus(); await page.keyboard.press("Control+k");
  const dialog = page.locator("dialog[open]"); await dialog.waitFor();
  assert.equal(await state(page), "nap");
  assert.equal(await pet.isDisabled(), true);
  await page.keyboard.press("Escape"); await dialog.waitFor({ state: "hidden" });
  await pet.focus(); await page.keyboard.press("k"); assert.equal(await state(page), "follow");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.waitForFunction(() => document.querySelector("[data-kame]")?.getAttribute("data-state") === "nap");
  const fixed = await page.locator("[data-kame]").getAttribute("style");
  await page.getByRole("button", { name: "Call Kame", exact: true }).click(); await page.mouse.move(100, 100); await page.clock.runFor(500);
  assert.equal(await state(page), "nap"); assert.equal(await page.locator("[data-kame]").getAttribute("style"), fixed);
  assert.match(await page.getByRole("status").last().textContent() ?? "", /sleepy hello/);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.waitForFunction(() => document.querySelector("[data-kame]")?.getAttribute("data-state") === "swim");
});

test("blocked storage remains usable and Save-Data imports only on explicit enable", async (t) => {
  const { page } = await open(t, {}, () => {
    Object.defineProperty(navigator, "connection", { value: { saveData: true } });
    Object.defineProperty(window, "localStorage", { get() { throw new DOMException("blocked", "SecurityError"); } });
  });
  const enable = page.getByRole("button", { name: "Enable Kame companion" }); await enable.waitFor();
  assert.equal(await page.locator("[data-kame]").count(), 0);
  await enable.click(); await ready(page);
  await page.getByLabel("Kame name").fill("Sora"); await page.getByLabel("Kame name").press("Enter");
  await page.getByRole("button", { name: "Hide Kame in shell" }).click();
  await page.getByRole("button", { name: "Restore Kame from shell" }).click();
  assert.equal(await page.getByLabel("Kame name").inputValue(), "Sora");
});

test("390px real touch hold/cancel leaves navigation unobstructed and hidden tabs pause", async (t) => {
  const { page, context } = await open(t, { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }, undefined, true); await ready(page);
  const pet = page.getByRole("button", { name: "Hold to pet Kame" }); await pet.scrollIntoViewIfNeeded();
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "no horizontal overflow");
  const box = (await pet.boundingBox())!; assert.ok(box.height >= 44);
  const session = await context.newCDPSession(page);
  const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [point] });
  await page.clock.runFor(500); assert.equal(await state(page), "pet");
  await session.send("Input.dispatchTouchEvent", { type: "touchCancel", touchPoints: [] });
  assert.equal(await state(page), "swim");
  await page.evaluate(() => { Object.defineProperty(document, "hidden", { configurable: true, value: true }); document.dispatchEvent(new Event("visibilitychange")); });
  assert.equal(await state(page), "nap");
  const still = await page.locator("[data-kame]").getAttribute("style"); await page.clock.runFor(500);
  assert.equal(await page.locator("[data-kame]").getAttribute("style"), still);
  await page.evaluate(() => { Object.defineProperty(document, "hidden", { configurable: true, value: false }); document.dispatchEvent(new Event("visibilitychange")); });
  await page.locator('[data-end-page="/notes"]').click(); await page.waitForURL("**/notes");
  assert.equal(new URL(page.url()).pathname, "/notes", "ordinary footer navigation still works");
});

test("real shared Web Audio purr is sound-gated and disconnected on release and toggle-off", async (t) => {
  const { page } = await open(t, {}, () => {
    // Wrap real Web Audio nodes, retaining actual oscillator/context construction and playback.
    const trace: { hz: number; disconnected: boolean; stops: number }[] = [];
    Object.assign(window, { kameAudioTrace: trace });
    const create = AudioContext.prototype.createOscillator;
    AudioContext.prototype.createOscillator = function () {
      const oscillator = create.call(this);
      const item = { hz: 0, disconnected: false, stops: 0 }; trace.push(item);
      const start = oscillator.start.bind(oscillator); const stop = oscillator.stop.bind(oscillator); const disconnect = oscillator.disconnect.bind(oscillator);
      oscillator.start = (...args) => { item.hz = oscillator.frequency.value; start(...args); };
      oscillator.stop = (...args) => { item.stops++; stop(...args); };
      oscillator.disconnect = () => { item.disconnected = true; disconnect(); };
      return oscillator;
    };
  }, true); await ready(page);
  const pet = page.getByRole("button", { name: "Hold to pet Kame" }); await pet.focus();
  await page.keyboard.down("Space"); await page.clock.runFor(500); await page.keyboard.up("Space");
  const trace = () => page.evaluate(() => (window as unknown as { kameAudioTrace: { hz: number; disconnected: boolean; stops: number }[] }).kameAudioTrace.filter((v) => v.hz === 147 || v.hz === 165));
  assert.deepEqual(await trace(), [], "off never creates a purr oscillator");
  const toggle = page.locator(".sound-toggle").first(); await toggle.click();
  await pet.focus(); await page.keyboard.down("Space"); await page.clock.runFor(500);
  assert.equal((await trace()).length, 3, "quiet triangle purr uses real oscillators");
  await page.keyboard.up("Space"); assert.ok((await trace()).every((v) => v.disconnected && v.stops >= 2));
  await pet.focus(); await page.keyboard.down("Space"); await page.clock.runFor(500);
  await toggle.click(); await page.keyboard.up("Space");
  assert.ok((await trace()).every((v) => v.disconnected));
});

test("optional renderer is requested only after load and an idle callback; reduced motion starts asleep", async (t) => {
  const { page } = await open(t, { reducedMotion: "reduce" }, () => {
    const jobs = new Map<number, IdleRequestCallback>(); let id = 0;
    Object.assign(window, { kameIdleJobs: jobs, kameIdleReady: [] });
    window.requestIdleCallback = (callback) => {
      (window as unknown as { kameIdleReady: string[] }).kameIdleReady.push(document.readyState);
      jobs.set(++id, callback); return id;
    };
    window.cancelIdleCallback = (key) => { jobs.delete(key); };
  });
  await page.waitForFunction(() => (window as unknown as { kameIdleJobs: Map<number, IdleRequestCallback> }).kameIdleJobs.size > 0);
  assert.equal(await page.locator("[data-kame]").count(), 0, "idle gate has not released the renderer");
  assert.ok((await page.evaluate(() => (window as unknown as { kameIdleReady: string[] }).kameIdleReady)).every((value) => value === "complete"));
  await page.evaluate(() => {
    const jobs = (window as unknown as { kameIdleJobs: Map<number, IdleRequestCallback> }).kameIdleJobs;
    for (const callback of jobs.values()) callback({ didTimeout: false, timeRemaining: () => 50 }); jobs.clear();
  });
  await ready(page); assert.equal(await state(page), "nap");
  assert.equal(await page.locator("[data-kame]").getAttribute("data-motion"), "still");
  const corner = (await page.locator("[data-kame]").boundingBox())!;
  assert.equal(corner.x, 1280 - 48);
  assert.equal(corner.y, 860 - 72, "reduced-motion first paint is in the sleeping corner");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForFunction(() => document.querySelector("[data-kame]")?.getBoundingClientRect().x === innerWidth - 48);
  const resized = (await page.locator("[data-kame]").boundingBox())!;
  assert.equal(resized.y, 844 - 72, "sleeping corner follows viewport changes without animation");
  const pet = page.getByRole("button", { name: "Hold to pet Kame" });
  await page.clock.install();
  await pet.focus(); await page.keyboard.down("Space");
  // Drive the timer with a fixture rather than waiting for the hold.
  await page.clock.fastForward(500); await page.keyboard.up("Space");
  assert.equal(await state(page), "nap");
  assert.match(await page.getByRole("status").last().textContent() ?? "", /enjoys the gentle pet/);
});
