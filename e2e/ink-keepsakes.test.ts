import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright-core";
import sharp from "sharp";
import { COLLECTION_KEY, freshCollection, KONAMI } from "../lib/gashapon.ts";
import { FINDS } from "../content/stickers.ts";

const BASE = process.env.BASE_URL ?? "http://localhost:4286";
let browser: Browser;
const contexts: BrowserContext[] = [];
const work = mkdtempSync(join(tmpdir(), "ink-keepsakes-"));
const artifacts = process.env.INK_QA_DIR ?? work;
mkdirSync(artifacts, { recursive: true });
before(async () => {
  const opts = { headless: true, env: { ...process.env, TMPDIR: work } };
  if (process.env.CHROME_PATH) browser = await chromium.launch({ ...opts, executablePath: process.env.CHROME_PATH });
  else try { browser = await chromium.launch({ ...opts, channel: "chrome" }); } catch { browser = await chromium.launch(opts); }
});
after(async () => { for (const context of contexts) await context.close(); await browser?.close(); rmSync(work, { recursive: true, force: true }); });
async function open(options: { mobile?: boolean; reduce?: boolean; denied?: boolean; deterministic?: boolean; fixture?: boolean } = {}) {
  const context = await browser.newContext({ viewport: options.mobile ? { width: 390, height: 844 } : { width: 1366, height: 1000 }, reducedMotion: options.reduce ? "reduce" : "no-preference", acceptDownloads: true });
  contexts.push(context);
  await context.addInitScript(({ denied, deterministic, fixture, initial, key }) => {
    if (denied) { Storage.prototype.getItem = () => { throw new DOMException("Denied", "SecurityError"); }; Storage.prototype.setItem = () => { throw new DOMException("Denied", "SecurityError"); }; }
    if (deterministic) crypto.getRandomValues = <T extends ArrayBufferView | null>(array: T): T => { if (array instanceof Uint32Array) array.fill(0); return array; };
    if (fixture && !localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(initial));
    const tracker = { contexts: 0 };
    (window as unknown as { inkAudio: typeof tracker }).inkAudio = tracker;
    const Audio = window.AudioContext;
    if (Audio) window.AudioContext = class extends Audio { constructor(...args: ConstructorParameters<typeof Audio>) { super(...args); tracker.contexts++; } };
  }, { denied: !!options.denied, deterministic: !!options.deterministic, fixture: !!options.fixture, initial: { ...freshCollection(), coins: 5, owned: { "foil-moon": 1, [FINDS.notes]: 1 } }, key: COLLECTION_KEY });
  const page = await context.newPage();
  page.setDefaultNavigationTimeout(120000);
  const errors: string[] = [];
  page.on("pageerror", e => { if (!/Transition was skipped|ViewTransition/.test(e.message)) errors.push(e.message); });
  await page.emulateMedia({ colorScheme: "light" });
  return { page, context, errors };
}
async function collection(page: Page) { return page.evaluate(key => JSON.parse(localStorage.getItem(key)!), COLLECTION_KEY); }
async function png(page: Page, button: string, width: number, height: number) {
  const promise = page.waitForEvent("download", { timeout: 60000 }); await page.getByRole("button", { name: button, exact: true }).click();
  const download = await promise, path = join(work, download.suggestedFilename()); await download.saveAs(path);
  const bytes = readFileSync(path);
  assert.equal(bytes.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
  const metadata = await sharp(bytes).metadata(); assert.equal(metadata.width, width); assert.equal(metadata.height, height);
  const { data } = await sharp(bytes).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  let ink = 0, red = 0;
  for (let i = 0; i < data.length; i += 3) { if (data[i] < 110 && data[i + 1] < 110 && data[i + 2] < 110) ink++; if (data[i] > data[i + 1] * 1.5 && data[i] > data[i + 2] * 1.4) red++; }
  assert.ok(ink > 100, `PNG contains actual ink (${ink} pixels)`);
  return { red, bytes };
}

test("machine spends once per keyboard/drag turn, tracks duplicates, real odds and reloads; sound stays off", { timeout: 180000 }, async () => {
  const { page, errors } = await open({ deterministic: true });
  await page.goto(`${BASE}/play/gashapon`);
  await page.getByTestId("coin-count").filter({ hasText: "1" }).waitFor();
  const initial = Number(await page.getByTestId("stock-total").innerText());
  await page.getByRole("button", { name: "Insert paper coin" }).click();
  await page.getByRole("button", { name: "Turn crank clockwise" }).press("Enter");
  await page.getByRole("button", { name: "Crack open your capsule" }).click();
  assert.equal(Number(await page.getByTestId("stock-total").innerText()), initial - 1);
  assert.equal((await collection(page)).owned.spark, 1);
  await page.goto(`${BASE}/work`); await page.goto(`${BASE}/play/gashapon`);
  await page.getByRole("button", { name: "Insert paper coin" }).click();
  const crank = page.getByRole("button", { name: "Turn crank clockwise" });
  const b = (await crank.boundingBox())!, cx = b.x + b.width / 2, cy = b.y + b.height / 2, radius = b.width * .32;
  await page.mouse.move(cx + radius, cy); await page.mouse.down();
  for (let i = 1; i <= 36; i++) await page.mouse.move(cx + Math.cos(i / 36 * Math.PI * 2) * radius, cy + Math.sin(i / 36 * Math.PI * 2) * radius);
  await page.mouse.up(); await page.getByRole("button", { name: "Crack open your capsule" }).click();
  const state = await collection(page); assert.equal(state.owned.spark, 2); assert.equal(state.coins, 0);
  assert.ok((await page.locator(".gasha-reveal").innerText()).includes("duplicate"));
  assert.equal(Number(await page.getByTestId("stock-total").innerText()), initial - 2);
  const cells = await page.locator(".kuji-board tbody tr").allTextContents();
  assert.ok(cells.every(x => x.includes("%")));
  await page.reload(); await page.getByTestId("stock-total").filter({ hasText: String(initial - 2) }).waitFor();
  assert.deepEqual((await collection(page)).stock, state.stock);
  assert.equal(await page.evaluate(() => (window as unknown as { inkAudio: { contexts: number } }).inkAudio.contexts), 0);
  await page.screenshot({ path: join(artifacts, "gashapon-desktop.png"), fullPage: true });
  assert.deepEqual(errors, []);
});

test("four hidden finds are one-time, typing-safe, and persist across full loads", { timeout: 180000 }, async () => {
  const { page, errors } = await open();
  for (const [path, id] of [["/notes", FINDS.notes], ["/sketches", FINDS.sketches], ["/a-lost-ink-scrap", FINDS.lost]]) {
    await page.goto(`${BASE}${path}`);
    await page.getByTestId(`find-${id}`).getByRole("button").click();
    await page.reload(); await page.getByTestId(`find-${id}`).getByRole("button").waitFor();
    assert.equal(await page.getByTestId(`find-${id}`).getByRole("button").isDisabled(), true);
    assert.equal((await collection(page)).owned[id], 1);
  }
  await page.goto(`${BASE}/play/shodo`);
  await page.getByRole("textbox", { name: /Your seal/ }).focus();
  for (const key of KONAMI) await page.keyboard.press(key);
  assert.equal((await collection(page)).finds.includes(FINDS.konami), false);
  await page.getByRole("heading", { level: 1 }).click();
  for (const key of KONAMI) await page.keyboard.press(key);
  await page.getByRole("status").filter({ hasText: "Secret Kame found" }).waitFor();
  for (const key of KONAMI) await page.keyboard.press(key);
  assert.equal((await collection(page)).owned[FINDS.konami], 1);
  assert.equal((await collection(page)).finds.length, 4);
  assert.deepEqual(errors, []);
});

test("album supports pointer/keyboard placement, reload, shader fallback and nonblank PNG", { timeout: 180000 }, async () => {
  const { page, errors } = await open({ mobile: true, reduce: true, fixture: true });
  await page.goto(`${BASE}/play/gashapon/album`);
  await page.getByRole("button", { name: "Place Foil Moon", exact: true }).click();
  const placed = page.getByRole("button", { name: /^Foil Moon, copy/ });
  await placed.focus(); await placed.press("ArrowRight"); await placed.press("r");
  await placed.scrollIntoViewIfNeeded();
  const b = (await placed.boundingBox())!;
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2); await page.mouse.down(); await page.mouse.move(b.x + b.width / 2 + 40, b.y + b.height / 2 + 30, { steps: 5 }); await page.mouse.up();
  const state = await collection(page); assert.ok(state.album[0].x > .22, JSON.stringify({ album: state.album, bounds: b })); assert.equal(state.album[0].rotation, 10);
  await page.reload(); await placed.waitFor(); assert.deepEqual((await collection(page)).album, state.album);
  assert.equal(await page.locator(".holo-foil").evaluate(el => getComputedStyle(el).display), "none");
  await png(page, "Save album PNG", 1200, 900);
  await page.evaluate(() => Object.defineProperty(navigator, "canShare", { configurable: true, value: () => false }));
  await png(page, "Share album image", 1200, 900); // unsupported file share downloads
  // Exercise the file-sharing adapter without opening the operating system's share sheet.
  await page.evaluate(() => {
    Object.defineProperty(navigator, "canShare", { configurable: true, value: () => true });
    Object.defineProperty(navigator, "share", { configurable: true, value: async (data: ShareData) => {
      const file = data.files![0];
      (window as unknown as { sharedInkFile: { type: string; size: number; name: string } }).sharedInkFile = { type: file.type, size: file.size, name: file.name };
    } });
  });
  await page.getByRole("button", { name: "Share album image", exact: true }).click();
  await page.getByRole("status").filter({ hasText: "Shared your paper" }).waitFor();
  const shared = await page.evaluate(() => (window as unknown as { sharedInkFile: { type: string; size: number } }).sharedInkFile);
  assert.equal(shared.type, "image/png"); assert.ok(shared.size > 10000);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await page.screenshot({ path: join(artifacts, "album-mobile.png"), fullPage: true });
  assert.deepEqual(errors, []);
});

test("Shodo mouse and pressure input draw ink, dry/dip, undo, sign and export a real sheet", { timeout: 180000 }, async () => {
  const { page, errors } = await open({ mobile: true, reduce: true });
  const mutations: string[] = [];
  page.on("request", req => { if (["POST", "PUT", "PATCH"].includes(req.method())) mutations.push(req.url()); });
  await page.goto(`${BASE}/play/shodo`);
  const canvas = page.getByTestId("shodo-canvas"); await canvas.waitFor();
  await canvas.scrollIntoViewIfNeeded();
  const b = (await canvas.boundingBox())!;
  await page.mouse.move(b.x + b.width * .2, b.y + b.height * .3); await page.mouse.down(); await page.mouse.move(b.x + b.width * .8, b.y + b.height * .3, { steps: 25 }); await page.mouse.up();
  await page.getByRole("status").filter({ hasText: /1 brush strokes/ }).waitFor();
  const cdp = await page.context().newCDPSession(page);
  for (let s = 0; s < 6; s++) {
    const y = b.y + 30 + s * 25;
    await cdp.send("Input.dispatchMouseEvent", { type: "mousePressed", pointerType: "pen", button: "left", buttons: 1, x: b.x + 10, y, force: .8, clickCount: 1 });
    for (let i = 1; i <= 30; i++) await cdp.send("Input.dispatchMouseEvent", { type: "mouseMoved", pointerType: "pen", button: "left", buttons: 1, x: b.x + 10 + i / 30 * (b.width - 20), y, force: .8 - i / 50 });
    await cdp.send("Input.dispatchMouseEvent", { type: "mouseReleased", pointerType: "pen", button: "left", buttons: 0, x: b.x + b.width - 10, y, force: 0, clickCount: 1 });
  }
  await cdp.detach();
  assert.ok(parseInt(await page.getByTestId("ink-load").innerText()) < 20);
  await page.getByRole("button", { name: "Dip brush in ink" }).click(); assert.ok((await page.getByTestId("ink-load").innerText()).startsWith("100%"));
  await page.getByRole("button", { name: "Undo last stroke" }).click();
  await page.getByRole("textbox", { name: /Your seal/ }).fill("INK"); await page.getByRole("button", { name: "Press red seal" }).click();
  const saved = await png(page, "Save sheet PNG", 1200, 1320); assert.ok(saved.red > 500, "red seal is in exported image");
  assert.ok((await page.locator(".shodo-score").innerText()).includes("6 brush strokes"));
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  assert.deepEqual(mutations, []);
  await page.screenshot({ path: join(artifacts, "shodo-mobile.png"), fullPage: true });
  assert.deepEqual(errors, []);
});

test("secret foil runs its real shader and retains readable art after WebGL context loss", { timeout: 180000 }, async () => {
  const { page, errors } = await open({ fixture: true });
  await page.goto(`${BASE}/play/gashapon/album`);
  await page.getByRole("button", { name: "Place Foil Moon", exact: true }).click();
  const foil = page.locator(".holo-foil"); await foil.scrollIntoViewIfNeeded();
  await page.waitForFunction(() => {
    const canvas = document.querySelector<HTMLCanvasElement>(".holo-foil");
    const gl = canvas?.getContext("webgl"); return !!gl?.getParameter(gl.CURRENT_PROGRAM);
  });
  const painted = await foil.evaluate(el => {
    const canvas = el as HTMLCanvasElement, gl = canvas.getContext("webgl")!;
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    const pixel = new Uint8Array(4); gl.readPixels(80, 80, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
    return [...pixel];
  });
  assert.ok(painted.some(Boolean), "foil fragment shader produced pixels");
  await foil.evaluate(el => (el as HTMLCanvasElement).getContext("webgl")!.getExtension("WEBGL_lose_context")?.loseContext());
  assert.equal(await page.getByRole("button", { name: /^Foil Moon, copy/ }).isVisible(), true);
  await png(page, "Save album PNG", 1200, 900);
  assert.deepEqual(errors, []);
});

test("denied/corrupt storage and reduced motion leave both toys usable", { timeout: 180000 }, async () => {
  const { page, errors } = await open({ denied: true, reduce: true });
  await page.goto(`${BASE}/play/gashapon`);
  await page.getByRole("button", { name: "Insert paper coin" }).click(); await page.getByRole("button", { name: "Turn crank clockwise" }).press("Space");
  await page.locator(".sticker-display").waitFor();
  assert.equal(await page.getByRole("button", { name: "Crack open your capsule" }).count(), 0);
  await page.getByRole("link", { name: "Open sticker book" }).click();
  await page.locator(".sticker-shelf button").first().click(); await png(page, "Save album PNG", 1200, 900);
  await page.getByRole("status").filter({ hasText: "Storage is unavailable" }).first().waitFor();
  const next = await open({ reduce: true });
  await next.page.goto(`${BASE}/play/gashapon`);
  await next.page.evaluate(key => localStorage.setItem(key, "{broken"), COLLECTION_KEY); await next.page.reload();
  await next.page.getByRole("button", { name: "Insert paper coin" }).click(); await next.page.getByRole("button", { name: "Turn crank clockwise" }).press("Enter");
  await next.page.locator(".sticker-display").waitFor(); assert.ok((await collection(next.page)).last);
  assert.deepEqual(errors, []); assert.deepEqual(next.errors, []);
});
