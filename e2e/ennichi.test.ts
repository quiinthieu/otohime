import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { chromium, type Browser, type BrowserContext, type BrowserContextOptions, type Page } from "playwright-core";
import { ENNICHI_MOTIFS } from "../lib/ennichi.ts";
import { collectBrowserErrors } from "./console-errors.ts";

const BASE = process.env.BASE_URL ?? "http://localhost:4000";
const tmp = mkdtempSync("/tmp/ennichi-e2e-");
let browser: Browser;
const contexts: BrowserContext[] = [];
const PLATES = ["cyan", "magenta", "yellow", "key"] as const;
const IDS = ENNICHI_MOTIFS.map((motif) => motif.id);

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

async function open(options: BrowserContextOptions = {}, route = "/play/ennichi") {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, ...options });
  contexts.push(context);
  const page = await context.newPage();
  const errors = collectBrowserErrors(BASE);
  page.on("pageerror", (error) => errors.pageError(error.message));
  page.on("console", (msg) => { if (msg.type() === "error") errors.console({ text: msg.text(), ...msg.location(), args: msg.args().length }); });
  page.on("response", (res) => errors.response({ url: res.url(), status: res.status(), method: res.request().method(), resourceType: res.request().resourceType() }));
  await page.goto(`${BASE}${route}`);
  return { page, context, errors };
}

async function ready(page: Page) {
  await page.getByTestId("ennichi-svg").waitFor();
  await page.waitForFunction(() => document.querySelector('[data-testid="ennichi-viewport"]')?.getAttribute("data-ready") === "true");
}

const num = async (page: Page, name: string) => Number(await page.getByTestId("ennichi-viewport").getAttribute(name));

for (const width of [1280, 390]) test(`/play discovers Ennichi Night at ${width}px`, async () => {
  const { page, errors } = await open({ viewport: { width, height: 900 } }, "/play");
  const link = page.getByTestId("play-ennichi-link");
  assert.equal(await link.getAttribute("href"), "/play/ennichi");
  await link.click();
  await page.waitForURL("**/play/ennichi");
  await ready(page);
  await page.waitForFunction(() => /Ennichi Night/.test(document.title));
  assert.match(await page.title(), /Ennichi Night/);
  const svg = page.getByTestId("ennichi-svg");
  for (const plate of PLATES) assert.equal(await svg.locator(`[data-plate="${plate}"]`).count(), 1, plate);
  assert.equal(await svg.locator("pattern").count(), 1);
  assert.equal(await svg.locator("image").count(), 0);
  assert.equal(await page.getByTestId("ennichi-viewport").evaluate((node) => getComputedStyle(node).touchAction), "none");
  const hit = (await page.getByTestId("ennichi-motif-kame-turtle").boundingBox())!;
  assert.ok(hit.width >= 44 && hit.height >= 44, `${hit.width}x${hit.height}`);
  for (const button of await page.locator(".ennichi-tools button").all()) {
    const box = (await button.boundingBox())!;
    assert.ok(box.height >= 44 && box.width >= 44);
  }
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
  const og = await page.locator('meta[property="og:image"]').getAttribute("content");
  assert.ok(og?.includes("/play/ennichi/opengraph-image"));
  const ogUrl = new URL(og!);
  const response = await page.request.get(new URL(ogUrl.pathname + ogUrl.search, BASE).href);
  assert.equal(response.status(), 200);
  assert.match(response.headers()["content-type"] ?? "", /image\/png/);
  await page.screenshot({ path: `/tmp/ennichi-${width}.png`, fullPage: true });
  assert.deepEqual(errors.unexpected, []);
});

test("zoom, wheel, arrow keys and reset stay inside the sheet", async () => {
  const { page, errors } = await open();
  await ready(page);
  const start = { scale: await num(page, "data-scale"), tx: await num(page, "data-tx"), ty: await num(page, "data-ty") };
  await page.getByTestId("ennichi-zoom-in").click();
  assert.ok(await num(page, "data-scale") > start.scale);
  await page.getByTestId("ennichi-zoom-in").click();
  const zoomed = await num(page, "data-tx");
  await page.getByTestId("ennichi-viewport").focus();
  await page.keyboard.press("ArrowRight");
  assert.ok(await num(page, "data-tx") < zoomed - 10);
  const box = (await page.getByTestId("ennichi-viewport").boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, -240);
  assert.ok(await num(page, "data-scale") > 1.5);
  await page.getByTestId("ennichi-zoom-reset").click();
  assert.equal(await num(page, "data-scale"), start.scale);
  assert.ok(Math.abs(await num(page, "data-tx") - start.tx) < 1);
  assert.ok(Math.abs(await num(page, "data-ty") - start.ty) < 1);
  assert.deepEqual(errors.unexpected, []);
});

test("dragging across a motif pans the print and does not mark it found", async () => {
  const { page, errors } = await open();
  await ready(page);
  await page.getByTestId("ennichi-zoom-in").click();
  await page.getByTestId("ennichi-zoom-in").click();
  const motif = page.getByTestId("ennichi-motif-tamatebako");
  assert.equal(await motif.getAttribute("data-found"), "false");
  const before = await num(page, "data-tx");
  const box = (await motif.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 - 90, box.y + box.height / 2, { steps: 8 });
  await page.mouse.up();
  assert.equal(await motif.getAttribute("data-found"), "false");
  assert.ok(await num(page, "data-tx") < before - 20);
  await motif.click();
  assert.equal(await motif.getAttribute("data-found"), "true");
  assert.equal(await page.getByTestId("ennichi-checklist").locator('[data-motif="tamatebako"]').getAttribute("data-found"), "true");
  assert.deepEqual(errors.unexpected, []);
});

test("hint lantern names a direction and a stall, then waits out its cooldown", async () => {
  const { page, errors } = await open();
  await ready(page);
  await page.getByTestId("ennichi-hint-btn").click();
  const status = page.getByTestId("ennichi-hint-status");
  await page.waitForFunction(() => /north|northeast|east|southeast|south|southwest|west|northwest|nearby/i.test(document.querySelector('[data-testid="ennichi-hint-status"]')?.textContent ?? ""));
  const clue = await status.innerText();
  assert.match(clue, /north|northeast|east|southeast|south|southwest|west|northwest|nearby/i);
  assert.match(clue, /goldfish|shrine|kitsune|shaved|apple|lantern|torii/i);
  assert.doesNotMatch(clue, /\d/);
  await page.getByTestId("ennichi-lantern-glow").waitFor();
  await page.getByTestId("ennichi-hint-btn").click();
  await page.waitForFunction(() => /warm|moment/i.test(document.querySelector('[data-testid="ennichi-hint-status"]')?.textContent ?? ""));
  assert.match(await status.innerText(), /warm|moment/i);
  assert.doesNotMatch(await status.innerText(), /\d/);
  assert.deepEqual(errors.unexpected, []);
});

test("pointer and keyboard finds unlock the stamp and survive a reload", async () => {
  const { page, errors } = await open();
  await ready(page);
  for (const id of IDS.slice(0, -1)) {
    await page.getByTestId(`ennichi-motif-${id}`).click();
    await page.waitForFunction((motifId) => document.querySelector(`[data-testid="ennichi-motif-${motifId}"]`)?.getAttribute("data-found") === "true", id);
    assert.match(await page.getByTestId(`ennichi-motif-${id}`).getAttribute("aria-label") ?? "", /^Found: /);
  }
  assert.equal(await page.getByTestId("ennichi-stamp-unlocked").count(), 0);
  const last = IDS.at(-1)!;
  const unfound = await page.getByTestId(`ennichi-motif-${last}`).getAttribute("aria-label");
  assert.doesNotMatch(unfound ?? "", /bell|turtle|box|crown|daruma|hanko|console/i);
  await page.getByTestId(`ennichi-motif-${last}`).focus();
  await page.keyboard.press("Enter");
  await page.getByTestId("ennichi-stamp-unlocked").waitFor();
  const saved = await page.evaluate(() => localStorage.getItem("ennichi:v1"));
  assert.match(saved ?? "", /"version":1/);
  for (const id of IDS) assert.match(saved ?? "", new RegExp(id));
  await page.reload();
  await ready(page);
  await page.getByTestId("ennichi-stamp-unlocked").waitFor();
  await page.getByTestId("ennichi-reset-btn").click();
  await page.waitForFunction(() => document.querySelector('[data-testid="ennichi-stamp-unlocked"]') === null);
  assert.equal(await page.getByTestId(`ennichi-motif-${last}`).getAttribute("data-found"), "false");
  assert.deepEqual(errors.unexpected, []);
});

test("a damaged saved night comes back as a fresh sheet", async () => {
  const { page, errors } = await open();
  await ready(page);
  await page.evaluate(() => localStorage.setItem("ennichi:v1", "{not json"));
  await page.reload();
  await ready(page);
  await page.waitForFunction(() => {
    try { return JSON.parse(localStorage.getItem("ennichi:v1") ?? "").found.length === 0; }
    catch { return false; }
  });
  for (const id of IDS) assert.equal(await page.getByTestId(`ennichi-motif-${id}`).getAttribute("data-found"), "false");
  assert.equal(await page.getByTestId("ennichi-stamp-unlocked").count(), 0);
  const raw = await page.evaluate(() => localStorage.getItem("ennichi:v1"));
  assert.deepEqual(JSON.parse(raw ?? ""), { version: 1, found: [] });
  assert.deepEqual(errors.unexpected, []);
});

test("reduced motion keeps the plates registered and the lantern still", async () => {
  const { page, errors } = await open({ reducedMotion: "reduce" });
  await ready(page);
  assert.equal(await page.getByTestId("ennichi-scene").getAttribute("data-reduced-motion"), "true");
  for (const plate of PLATES) {
    const style = await page.locator(`[data-plate="${plate}"]`).evaluate((node) => {
      const computed = getComputedStyle(node);
      return { transform: computed.transform, animation: computed.animationName, transition: computed.transitionDuration };
    });
    assert.ok(style.transform === "none" || style.transform === "matrix(1, 0, 0, 1, 0, 0)", style.transform);
    assert.equal(style.animation, "none");
    assert.equal(style.transition, "0s");
  }
  await page.getByTestId("ennichi-hint-btn").click();
  const lantern = page.getByTestId("ennichi-lantern-glow");
  await lantern.waitFor();
  assert.equal(await lantern.evaluate((node) => getComputedStyle(node).animationName), "none");
  await page.getByTestId("ennichi-motif-daruma-doll").click();
  assert.equal(await page.getByTestId("ennichi-motif-daruma-doll").getAttribute("data-found"), "true");
  assert.deepEqual(errors.unexpected, []);
});

test("two fingers pinch the sheet larger", async () => {
  const { page, errors } = await open({ viewport: { width: 390, height: 844 }, hasTouch: true });
  await ready(page);
  const before = await num(page, "data-scale");
  await page.getByTestId("ennichi-viewport").evaluate((node) => {
    const rect = node.getBoundingClientRect();
    const fire = (type: string, id: number, x: number, y: number) => node.dispatchEvent(new PointerEvent(type, {
      bubbles: true, cancelable: true, pointerId: id, clientX: x, clientY: y, pointerType: "touch", isPrimary: id === 1,
    }));
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    fire("pointerdown", 1, cx - 24, cy);
    fire("pointerdown", 2, cx + 24, cy);
    fire("pointermove", 2, cx + 120, cy);
    fire("pointerup", 1, cx - 24, cy);
    fire("pointerup", 2, cx + 120, cy);
  });
  assert.ok(await num(page, "data-scale") > before + 0.2);
  assert.deepEqual(errors.unexpected, []);
});
