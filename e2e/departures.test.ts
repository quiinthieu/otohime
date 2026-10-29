import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { chromium, type Browser, type BrowserContext, type BrowserContextOptions, type Page } from "playwright-core";
import { buildProjectDepartures, buildWorkDepartures, MAX_FLAP_STEPS, padFlapCell } from "../lib/departures.ts";
import { collectBrowserErrors } from "./console-errors.ts";

const BASE = process.env.BASE_URL ?? "http://localhost:4000";
const tmp = mkdtempSync("/tmp/departures-e2e-");
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
type Meter = { contexts: number; voices: { hz: number; at: number }[]; steps: number[]; glyphs: string[] };
async function open(route = "/work", options: BrowserContextOptions = {}) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: "no-preference", ...options });
  contexts.push(context);
  await context.addInitScript(() => {
    const meter = { contexts: 0, voices: [] as { hz: number; at: number }[], steps: [] as number[], glyphs: [] as string[] };
    Object.assign(window, { __departuresMeter: meter });
    // Observe real audio nodes, preserving oscillator construction, connections and scheduling.
    const Real = window.AudioContext;
    if (Real) window.AudioContext = class extends Real {
      constructor(options?: AudioContextOptions) { super(options); meter.contexts++; }
      createOscillator() {
        const oscillator = super.createOscillator(), start = oscillator.start;
        oscillator.start = function (...args) {
          meter.voices.push({ hz: oscillator.frequency.value, at: performance.now() });
          return start.apply(this, args);
        };
        return oscillator;
      }
    };
    new MutationObserver(() => {
      const row = document.querySelector('[data-testid="departures-row"]');
      if (!row) return;
      meter.steps.push(Number(row.getAttribute("data-flip-step")));
      meter.glyphs.push(row.querySelector(".departures-drums")?.textContent ?? "");
    }).observe(document, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ["data-flip-step"] });
  });
  const page = await context.newPage(), errors = collectBrowserErrors(BASE);
  page.on("pageerror", e => errors.pageError(e.message));
  page.on("console", msg => { if (msg.type() === "error") errors.console({ text: msg.text(), ...msg.location(), args: msg.args().length }); });
  page.on("response", res => errors.response({ url: res.url(), status: res.status(), method: res.request().method(), resourceType: res.request().resourceType() }));
  await page.goto(`${BASE}${route}`);
  await page.getByTestId("departures-board").waitFor();
  return { page, errors };
}
const meter = (page: Page) => page.evaluate(() => (window as unknown as { __departuresMeter: Meter }).__departuresMeter);
const resetMeter = (page: Page) => page.evaluate(() => {
  const meter = (window as unknown as { __departuresMeter: Meter }).__departuresMeter;
  meter.steps = []; meter.glyphs = []; meter.voices = [];
});
async function settled(page: Page) {
  await page.waitForFunction(() => [...document.querySelectorAll('[data-testid="departures-row"]')].every(row => row.getAttribute("data-flipping") === "false"));
}

for (const width of [1280, 390]) for (const kind of ["work", "projects"] as const) {
  test(`/${kind} at ${width}px serves the full semantic final timetable without JavaScript`, async () => {
    const { page, errors } = await open(`/${kind}`, { javaScriptEnabled: false, viewport: { width, height: 900 } });
    const board = page.getByTestId("departures-board"), table = board.getByRole("table");
    const expected = kind === "work" ? buildWorkDepartures() : buildProjectDepartures();
    assert.equal(await board.getAttribute("data-board-kind"), kind);
    assert.equal(await table.count(), 1);
    assert.match(await table.getByRole("caption").innerText(), /illustrative timetable/);
    assert.equal(await table.getByRole("columnheader").count(), 5);
    const rows = board.getByTestId("departures-row");
    assert.equal(await rows.count(), expected.length);
    for (const [i, entry] of expected.entries()) {
      const row = rows.nth(i);
      assert.equal(await row.getAttribute("data-row-status"), entry.status);
      assert.equal(await row.getByRole("rowheader").innerText(), entry.name);
      assert.equal(await row.getByRole("cell", { name: entry.status, exact: true }).count(), 1);
      for (const value of [entry.code, entry.schedule, entry.status]) assert.ok((await row.textContent())?.includes(value), value);
      assert.equal(await row.locator(".departures-drums").getAttribute("aria-hidden"), "true");
      assert.equal(await row.locator(".departures-drums").textContent(), padFlapCell(entry.status, 10));
      if (entry.href) assert.equal(await row.getByRole("link").getAttribute("href"), entry.href);
    }
    for (const status of ["ON TIME", "DELAYED", "BACKFILLING"]) assert.ok(await board.locator(`tr[data-row-status="${status}"]`).count());
    assert.equal(await board.getByTestId("departures-sound-toggle").getAttribute("aria-pressed"), "false");
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "table scroll stays inside the page on mobile");
    for (const button of await board.getByRole("button").all()) {
      assert.ok(await button.evaluate(node => parseFloat(getComputedStyle(node).minHeight) >= 44));
      // Fractional document coordinates can subtract to 43.999999px.
      assert.ok((await button.boundingBox())!.height >= 43.99);
    }
    await board.screenshot({ path: `/tmp/pm-301-t-1788-${kind}-${width}.png` });
    assert.deepEqual(errors.unexpected, []);
  });
}

for (const kind of ["work", "projects"]) test(`/${kind} click, Enter and board fallback change real drums in at most 12 steps and settle`, async () => {
  const { page, errors } = await open(`/${kind}`);
  // Force the fallback path even on browsers with native scroll timelines.
  await page.addStyleTag({ content: ".departures-board .departures-drums { animation: none !important; }" });
  await page.clock.install();
  const row = page.getByTestId("departures-row").first(), button = row.getByTestId("departures-row-flip");
  const finalText = padFlapCell("ON TIME", 10);
  for (const input of ["click", "Enter", "all"]) {
    await resetMeter(page);
    if (input === "click") await button.click();
    else if (input === "Enter") { await button.focus(); await page.keyboard.press("Enter"); }
    else await page.getByTestId("departures-flip-all").click();
    assert.equal(await row.getAttribute("data-flipping"), "true");
    assert.notEqual(await row.locator(".departures-drums").textContent(), finalText);
    assert.match(await row.textContent() ?? "", /ON TIME/, "real status remains unchanged during decorative frames");
    await page.clock.runFor(1000); await settled(page);
    const observed = await meter(page), steps = [...new Set(observed.steps.filter(step => step > 0))];
    assert.ok(steps.length > 1 && steps.length <= MAX_FLAP_STEPS, `observed ${steps.length} steps`);
    assert.ok(Math.max(...steps) <= MAX_FLAP_STEPS);
    assert.ok(new Set(observed.glyphs).size > 2, "drum glyphs visibly change, not just an instrumentation counter");
    assert.equal(await row.locator(".departures-drums").textContent(), finalText);
    if (input === "all") for (const item of await page.getByTestId("departures-row").all()) {
      assert.ok(Number(await item.getAttribute("data-flip-step")) > 0);
      assert.equal(await item.locator(".departures-drums").textContent(), padFlapCell((await item.getAttribute("data-row-status"))!, 10));
    }
  }
  assert.equal((await meter(page)).contexts, 0, "muted flips never unlock audio");
  assert.deepEqual(errors.unexpected, []);
});

test("native scroll timeline turns drums; delayed hanko ink works on light and dark paper", async () => {
  const { page, errors } = await open();
  const drums = page.locator(".departures-drums").first();
  assert.equal(await page.evaluate(() => CSS.supports("animation-timeline", "view()")), true, "test browser must exercise native scroll support");
  assert.equal(await drums.evaluate(node => getComputedStyle(node).getPropertyValue("animation-timeline")), "--departures");
  const transforms = [];
  for (const offset of [0, 200, 400]) {
    await page.evaluate(offset => scrollTo(0, offset), offset);
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    transforms.push(await drums.evaluate(node => getComputedStyle(node).transform));
  }
  assert.ok(new Set(transforms).size > 1, `actual scrolling changes the drum transform: ${JSON.stringify(transforms)}`);
  const colors = [];
  for (const theme of ["light", "dark"]) {
    await page.evaluate(theme => { document.documentElement.dataset.theme = theme; }, theme);
    const delayed = await page.locator('[data-row-status="DELAYED"] .departures-drum').first().evaluate(node => {
      const style = getComputedStyle(node);
      return { background: style.backgroundColor, color: style.color, hinge: getComputedStyle(node, "::after").height };
    });
    assert.notEqual(delayed.background, delayed.color);
    assert.equal(delayed.hinge, "1px"); colors.push(delayed.background);
  }
  assert.notEqual(colors[0], colors[1], "hanko uses theme-aware vermilion ink");
  assert.deepEqual(errors.unexpected, []);
});

test("muted negative control, shared opt-in and board-wide 60ms real clack throttle", async () => {
  const { page, errors } = await open(); await page.clock.install();
  await page.getByTestId("departures-flip-all").click(); await page.clock.runFor(1000); await settled(page);
  assert.deepEqual({ contexts: (await meter(page)).contexts, voices: (await meter(page)).voices }, { contexts: 0, voices: [] });
  const toggle = page.getByTestId("departures-sound-toggle");
  await toggle.click();
  assert.equal(await toggle.getAttribute("aria-pressed"), "true");
  assert.equal(await page.evaluate(() => localStorage.getItem("sound")), "on");
  await page.waitForFunction(() => (window as unknown as { __departuresMeter: Meter }).__departuresMeter.voices.length > 0);
  await resetMeter(page);
  // Rapid restart and simultaneous rows must not multiply clacks.
  await page.getByTestId("departures-flip-all").evaluate((button: HTMLButtonElement) => { for (let i = 0; i < 8; i++) button.click(); });
  await page.clock.runFor(1000); await settled(page);
  const heard = await meter(page);
  assert.equal(heard.contexts, 1);
  const clacks = heard.voices.filter(voice => [1640, 1730, 1820].includes(voice.hz));
  assert.ok(clacks.length > 1 && clacks.length <= MAX_FLAP_STEPS);
  assert.equal(heard.voices.length, clacks.length * 3, "only the three-note custom clack, no global press cue");
  for (let i = 1; i < clacks.length; i++) assert.ok(clacks[i].at - clacks[i - 1].at >= 60, "clacks at least 60ms apart");
  await page.getByTestId("departures-flip-all").click();
  await toggle.click(); const stopped = (await meter(page)).voices.length;
  await page.clock.runFor(1000);
  assert.equal((await meter(page)).voices.length, stopped, "muting cancels future clacks during a running flip");
  assert.deepEqual(errors.unexpected, []);
});

for (const kind of ["work", "projects"]) test(`/${kind} reduced motion has zero steps, animations or sound even after opt-in`, async () => {
  const { page, errors } = await open(`/${kind}`, { reducedMotion: "reduce", viewport: { width: 390, height: 844 } });
  const board = page.getByTestId("departures-board");
  await page.waitForFunction(() => document.querySelector('[data-testid="departures-board"]')?.getAttribute("data-reduced-motion") === "true");
  await page.clock.install();
  await board.getByTestId("departures-sound-toggle").click();
  assert.equal(await board.getByTestId("departures-sound-toggle").getAttribute("aria-pressed"), "true");
  await resetMeter(page);
  await board.getByTestId("departures-flip-all").click();
  await board.getByTestId("departures-row-flip").first().press("Enter");
  await page.clock.runFor(1000);
  for (const row of await board.getByTestId("departures-row").all()) {
    assert.equal(await row.getAttribute("data-flip-step"), "0");
    assert.equal(await row.getAttribute("data-flipping"), "false");
    assert.equal(await row.locator(".departures-drums").textContent(), padFlapCell((await row.getAttribute("data-row-status"))!, 10));
  }
  assert.ok((await meter(page)).steps.every(step => step === 0));
  assert.deepEqual({ contexts: (await meter(page)).contexts, voices: (await meter(page)).voices }, { contexts: 0, voices: [] });
  assert.ok(await board.locator(".departures-drums, .departures-leaf").evaluateAll(nodes => nodes.every(node => getComputedStyle(node).animationName === "none" && getComputedStyle(node).transitionDuration === "0s")));
  // Preference changes cancel a running flip and never resume it later.
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await board.getByTestId("departures-flip-all").click();
  assert.equal(await board.getByTestId("departures-row").first().getAttribute("data-flipping"), "true");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await settled(page); await resetMeter(page); await page.clock.runFor(1000);
  assert.deepEqual((await meter(page)).voices, []);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  assert.equal(await board.getByTestId("departures-row").first().getAttribute("data-flip-step"), "0");
  assert.deepEqual(errors.unexpected, []);
});
