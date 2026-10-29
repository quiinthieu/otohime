import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { chromium, type Browser, type BrowserContext, type BrowserContextOptions } from "playwright-core";
import { site } from "../content/site.ts";
import { processCrate } from "../lib/assembly.ts";

const BASE = process.env.BASE_URL ?? "http://localhost:4399";
let browser: Browser;
const contexts: BrowserContext[] = [];
before(async () => { browser = await chromium.launch({ channel: "chrome", headless: true }); });
after(async () => { for (const context of contexts) await context.close(); await browser?.close(); });
async function open(path: string, options: BrowserContextOptions = {}) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, ...options });
  contexts.push(context);
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(`${BASE}${path}`);
  return { page, context, errors };
}

test("Work scroll carries and stamps the crate through all five stations, in both directions", async () => {
  const { page, errors } = await open("/work");
  await page.waitForFunction(() => document.querySelector('[data-testid="assembly-line"]')?.getAttribute("data-motion") === "scroll");
  const transforms: string[] = [];
  for (const id of ["ingest", "clean", "transform", "load", "serve", "transform", "ingest"]) {
    await page.locator(`[data-assembly-station="${id}"]`).evaluate(node => { const rect = node.getBoundingClientRect(); window.scrollTo(0, window.scrollY + rect.top + rect.height / 2 - innerHeight * .72); });
    await page.waitForFunction(id => document.querySelector('[data-testid="assembly-line"]')?.getAttribute("data-active-station") === id, id);
    transforms.push((await page.getByTestId("assembly-crate").getAttribute("transform"))!);
  }
  assert.ok(new Set(transforms).size >= 5);
  assert.equal(await page.locator("[data-assembly-station] h3").count(), 5);
  await page.getByLabel("Drop your own crate", { exact: false }).fill("Zebra! 42");
  await page.getByRole("button", { name: "Run my crate" }).click();
  await page.waitForFunction(() => document.querySelector('[role="status"]')?.textContent?.includes("characters packed."));
  assert.match(await page.getByTestId("assembly-line").getByRole("status").innerText(), /7 characters packed/);
  assert.ok((await page.getByRole("list", { name: "Your crate receipt" }).innerText()).includes(processCrate("Zebra! 42").packed));
  await page.getByRole("button", { name: "Follow the scroll again" }).click();
  assert.equal(await page.getByRole("button", { name: "Follow the scroll again" }).count(), 0);
  assert.deepEqual(errors, []);
});

test("chart represents every note, shared tags, hover/focus titles, drag suppression and transition navigation", async () => {
  const { page, errors } = await open("/notes");
  await page.getByRole("link", { name: "Explore the Paper Star Chart" }).click();
  await page.waitForURL("**/notes/sky");
  assert.equal(await page.locator("[data-sky-star]").count(), site.notes.length);
  assert.equal(await page.locator("[data-sky-edge]").count(), 1);
  assert.equal(await page.locator('[data-sky-edge="animation"]').count(), 0, "an unrelated tag must not get a line");
  const star = page.locator('[data-sky-star="backfills-are-a-feature"]');
  await star.scrollIntoViewIfNeeded(); await star.hover();
  assert.equal(await star.locator("span").isVisible(), true);
  const box = (await star.boundingBox())!;
  await page.mouse.move(box.x + 24, box.y + 24); await page.mouse.down();
  await page.mouse.move(box.x - 110, box.y - 40, { steps: 10 }); await page.mouse.up();
  assert.equal(new URL(page.url()).pathname, "/notes/sky", "dragging a star cannot activate its link");
  const viewport = page.getByRole("region", { name: "Pannable celestial chart" });
  await viewport.focus(); await page.keyboard.press("ArrowRight");
  const offset = await viewport.evaluate(node => node.scrollLeft);
  assert.ok(offset > 0, "keyboard pans the actual viewport");
  await page.getByRole("button", { name: "Recenter chart" }).click();
  assert.ok(await viewport.evaluate(node => Math.abs(node.scrollLeft - (node.scrollWidth - node.clientWidth) / 2) <= 1));
  await page.evaluate(() => {
    const original = document.startViewTransition?.bind(document);
    if (!original) return;
    Object.assign(window, { __skyTransitions: 0 });
    document.startViewTransition = ((...args: Parameters<typeof original>) => { (window as unknown as { __skyTransitions: number }).__skyTransitions++; return original(...args); }) as typeof original;
  });
  await star.focus();
  assert.equal(await star.locator("span").isVisible(), true);
  await page.keyboard.press("Enter"); await page.waitForURL("**/notes/backfills-are-a-feature");
  assert.equal(await page.getByRole("heading", { name: "Backfills are a feature", exact: true }).count(), 1);
  if (await page.evaluate(() => typeof document.startViewTransition === "function")) {
    assert.ok(await page.evaluate(() => (window as unknown as { __skyTransitions: number }).__skyTransitions > 0), "note navigation runs a view transition");
  }
  await page.getByRole("link", { name: "Star chart" }).click(); await page.waitForURL("**/notes/sky");
  assert.deepEqual(errors, []);
});

test("phone touch pans the chart; taps open each original note", async () => {
  const { page, context, errors } = await open("/notes/sky", { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const viewport = page.getByRole("region", { name: "Pannable celestial chart" });
  await page.waitForFunction(() => { const el = document.querySelector('[aria-label="Pannable celestial chart"]'); return el && Object.keys(el).some(key => key.startsWith("__reactProps$")); });
  await page.evaluate(() => {
    const events: unknown[] = [];
    Object.assign(window, { skyPointerEvents: events });
    for (const type of ["pointerdown", "pointerup", "pointercancel", "lostpointercapture", "click"]) {
      document.addEventListener(type, event => queueMicrotask(() => {
        const pointer = event as PointerEvent;
        events.push({ type, primary: pointer.isPrimary, button: pointer.button, pointer: pointer.pointerId,
          prevented: event.defaultPrevented, star: (event.target as Element)?.closest?.("[data-sky-star]")?.getAttribute("data-sky-star") });
      }), true);
    }
  });
  await viewport.scrollIntoViewIfNeeded();
  const rect = (await viewport.boundingBox())!;
  const session = await context.newCDPSession(page);
  const x = rect.x + rect.width * .8, y = rect.y + rect.height / 2;
  await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
  for (let i = 1; i <= 8; i++) {
    await session.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: x - i * 20, y }] });
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => resolve())));
  }
  await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await session.detach();
  await page.waitForFunction(() => document.querySelector('[aria-label="Pannable celestial chart"]')!.scrollLeft > 100);
  await page.waitForFunction(() => document.querySelector('[aria-label="Pannable celestial chart"]')!.getAttribute("data-dragging") === "false");
  assert.equal(new URL(page.url()).pathname, "/notes/sky");
  const draggedStar = page.locator('[data-sky-star="backfills-are-a-feature"]');
  await draggedStar.scrollIntoViewIfNeeded();
  const origin = (await draggedStar.boundingBox())!;
  const stroke = await context.newCDPSession(page);
  const point = { x: origin.x + origin.width / 2, y: origin.y + origin.height / 2 };
  await stroke.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [point] });
  await stroke.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: point.x + 80, y: point.y }] });
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => resolve())));
  await stroke.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => resolve())));
  await stroke.detach();
  assert.equal(new URL(page.url()).pathname, "/notes/sky", "a touch drag starting on a star cannot open its note");
  for (const note of site.notes) {
    const star = page.locator(`[data-sky-star="${note.slug}"]`);
    await star.tap();
    try { await page.waitForURL(`**/notes/${note.slug}`); }
    catch (error) {
      const state = await page.evaluate(() => ({ url: location.href,
        events: (window as unknown as { skyPointerEvents: unknown[] }).skyPointerEvents,
        scroll: document.querySelector('[aria-label="Pannable celestial chart"]')?.scrollLeft }));
      throw new Error(`Phone star ${note.slug}: ${JSON.stringify(state)}`, { cause: error });
    }
    assert.equal(await page.getByRole("heading", { name: note.title, exact: true }).count(), 1);
    await page.getByRole("link", { name: "Star chart" }).tap(); await page.waitForURL("**/notes/sky");
  }
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "no horizontal page overflow");
  assert.deepEqual(errors, []);
});

test("reduced motion shows a static factory and settles word crates immediately, including a live preference change", async () => {
  const { page, errors } = await open("/work", { viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  await page.waitForFunction(() => document.querySelector('[data-testid="assembly-line"]')?.getAttribute("data-motion") === "reduced");
  assert.equal(await page.getByTestId("assembly-crate-mobile").isVisible(), false);
  for (const station of await page.locator("[data-assembly-station]").all()) assert.equal(await station.isVisible(), true);
  await page.getByLabel("Drop your own crate", { exact: false }).fill("paper");
  await page.getByRole("button", { name: "Run my crate" }).click();
  assert.match(await page.getByTestId("assembly-line").getByRole("status").innerText(), /Serve:.*5 characters packed/);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.getByRole("button", { name: "Run my crate" }).click();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.waitForFunction(() => document.querySelector('[role="status"]')?.textContent?.includes("characters packed."));
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  assert.deepEqual(errors, []);
});

test("without JavaScript the factory guide, stars, note list and direct note URLs remain readable", async () => {
  const { page } = await open("/work", { javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
  assert.equal(await page.locator("[data-assembly-station]").count(), 5);
  assert.equal(await page.getByTestId("assembly-crate-mobile").isVisible(), false);
  await page.goto(`${BASE}/notes/sky`);
  assert.equal(await page.locator("[data-sky-star]").count(), site.notes.length);
  await page.locator('[data-sky-star="on-twos"]').click(); await page.waitForURL("**/notes/on-twos");
  assert.equal(await page.getByRole("heading", { name: "On twos", exact: true }).count(), 1);
  await page.getByRole("link", { name: "All notes" }).click(); await page.waitForURL("**/notes");
  assert.equal(await page.locator('h2 a[href^="/notes/"]').count(), site.notes.length);
});
