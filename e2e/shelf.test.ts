// Ink Shelf in a real browser: crawlable books, sumi-e canvas, book-to-page view
// transitions, reduced motion, the flat fallback, and no Three.js on the home page.
import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { chromium, type Browser, type BrowserContext, type BrowserContextOptions, type Page } from "playwright-core";
import { collectBrowserErrors } from "./console-errors.ts";

const base = process.env.BASE_URL ?? "http://localhost:4000";
let browser: Browser;
const contexts: BrowserContext[] = [];

before(async () => {
  const env = { ...process.env, TMPDIR: "/tmp" };
  browser = await chromium.launch({ executablePath: process.env.CHROME_PATH, channel: process.env.CHROME_PATH ? undefined : "chrome", env })
    .catch(() => chromium.launch({ env }));
});
after(async () => {
  for (const context of contexts) await context.close().catch(() => {});
  await browser?.close();
});

type VtRecord = { name: string; left: number; top: number; width: number; height: number; testid: string };
declare global {
  interface Window { __shelfProof?: { pixels: number } }
}

function instrument(disableWebgl: boolean) {
  const proof = { pixels: 0 };
  window.__shelfProof = proof;
  const sample = function (this: WebGL2RenderingContext | WebGLRenderingContext) {
    const canvas = this.canvas;
    if (!(canvas instanceof HTMLCanvasElement) || !canvas.closest(".ink-shelf")) return;
    if (this.getParameter(this.FRAMEBUFFER_BINDING)) return;
    const pixel = new Uint8Array(4);
    const width = this.drawingBufferWidth, height = this.drawingBufferHeight;
    if (width < 2 || height < 2) return;
    this.readPixels(Math.floor(width / 2), Math.floor(height / 2), 1, 1, this.RGBA, this.UNSIGNED_BYTE, pixel);
    if (Math.max(...pixel) > 8) proof.pixels++;
  };
  for (const prototype of [WebGL2RenderingContext.prototype, WebGLRenderingContext.prototype]) {
    for (const name of ["drawArrays", "drawElements"] as const) {
      const original = prototype[name] as ((...args: unknown[]) => void) | undefined;
      if (!original) continue;
      prototype[name] = function (this: WebGL2RenderingContext, ...args: unknown[]) {
        const result = original.apply(this, args);
        try { sample.call(this); } catch { /* a lost context is the fallback test's job */ }
        return result;
      } as typeof original;
    }
  }
  const start = Document.prototype.startViewTransition;
  Document.prototype.startViewTransition = function (callback) {
    const active = document.querySelector<HTMLElement>("[data-vt-active]");
    const rect = active?.getBoundingClientRect();
    const record: VtRecord = {
      name: active ? getComputedStyle(active).viewTransitionName : "",
      left: rect?.left ?? 0, top: rect?.top ?? 0, width: rect?.width ?? 0, height: rect?.height ?? 0,
      testid: active?.dataset.testid ?? active?.dataset.bookId ?? "",
    };
    console.info(`SHELF_VT ${JSON.stringify(record)}`);
    return start.call(this, callback);
  };
  if (!disableWebgl) return;
  const get = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...args: unknown[]) {
    if (type === "webgl" || type === "webgl2") return null;
    return Reflect.apply(get, this, [type, ...args]);
  } as typeof get;
}

async function open(options: BrowserContextOptions = {}, disableWebgl = false) {
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 }, reducedMotion: "no-preference", ...options });
  contexts.push(context);
  await context.addInitScript(instrument, disableWebgl);
  const page = await context.newPage();
  page.setDefaultTimeout(15_000);
  const errors = collectBrowserErrors(base);
  const transitions: VtRecord[] = [];
  page.on("pageerror", (error) => errors.pageError(error.message));
  page.on("console", (message) => {
    if (message.text().startsWith("SHELF_VT ")) transitions.push(JSON.parse(message.text().slice("SHELF_VT ".length)) as VtRecord);
    if (message.type() === "error") {
      const location = message.location();
      errors.console({ text: message.text(), url: location.url, line: location.lineNumber, column: location.columnNumber, args: message.args().length });
    }
  });
  page.on("response", (response) => errors.response({
    url: response.url(), status: response.status(), method: response.request().method(), resourceType: response.request().resourceType(),
  }));
  return { context, page, errors, transitions };
}

async function shelf(page: Page, search = "") {
  const response = await page.goto(`${base}/shelf${search}`);
  assert.equal(response?.status(), 200);
  await page.locator("[data-testid=shelf-book-list] a").first().waitFor();
}

async function live(page: Page) {
  await page.locator(".ink-shelf[data-shelf-mode='3d'] canvas").waitFor();
  await page.waitForFunction(() => (window.__shelfProof?.pixels ?? 0) > 0);
}

async function aim(page: Page, prefix: string) {
  const canvas = page.locator(".ink-shelf canvas");
  await canvas.scrollIntoViewIfNeeded();
  const box = await canvas.boundingBox();
  assert.ok(box && box.width > 8 && box.height > 8, "shelf canvas has a box");
  await page.mouse.move(box.x + 2, box.y + 2);
  for (const row of [0.36, 0.5, 0.64, 0.78]) {
    for (let step = 1; step < 30; step++) {
      const x = box.x + box.width * step / 30, y = box.y + box.height * row;
      await page.mouse.move(x, y);
      const id = await page.evaluate(async () => {
        await new Promise((frame) => requestAnimationFrame(() => requestAnimationFrame(frame)));
        return document.querySelector<HTMLElement>(".ink-shelf canvas")?.dataset.hoveredBook ?? "";
      });
      if (id.startsWith(prefix)) return { id, x, y };
    }
  }
  assert.fail(`no ${prefix} volume under the pointer`);
}

async function headingNamed(page: Page, name: string) {
  await page.waitForFunction((expected) =>
    [...document.querySelectorAll("h1")].some((el) => getComputedStyle(el).viewTransitionName === expected), name);
}

test("projects links to the shelf", async () => {
  const { page, errors } = await open();
  try {
    const response = await page.goto(`${base}/projects`);
    assert.equal(response?.status(), 200);
    await page.getByTestId("projects-shelf-link").click();
    await page.waitForURL("**/shelf");
    assert.equal(new URL(page.url()).pathname, "/shelf");
    assert.deepEqual(errors.unexpected, []);
  } finally { await page.context().close(); }
});

for (const viewport of [{ width: 1366, height: 768 }, { width: 390, height: 844 }] as const) {
  test(`shelf renders crawlable books and a non-blank sumi canvas at ${viewport.width}x${viewport.height}`, async () => {
    const { page, errors } = await open({ viewport, isMobile: viewport.width < 400, hasTouch: viewport.width < 400 });
    try {
      await shelf(page);
      const hrefs = await page.locator("[data-testid=shelf-book-list] a").evaluateAll((els) => els.map((el) => el.getAttribute("href")));
      assert.ok(hrefs.some((href) => href?.startsWith("/notes/")), "notes are crawlable links");
      assert.ok(hrefs.some((href) => href && !href.startsWith("/notes/")), "projects are crawlable links");
      await live(page);
      const link = page.locator("[data-testid=shelf-book-list] a").first();
      const id = await link.getAttribute("data-book-id");
      await link.focus();
      await page.waitForFunction((book) => document.querySelector(".ink-shelf")?.getAttribute("data-focused-book") === book, id);
      await page.waitForFunction((book) => document.querySelector<HTMLElement>(".ink-shelf canvas")?.dataset.focusedBook === book, id);
      const hovered = await aim(page, "project-");
      assert.ok(hovered.id.startsWith("project-") || hovered.id.startsWith("note-"));
      assert.deepEqual(errors.unexpected, []);
    } finally { await page.context().close(); }
  });
}

test("clicking a book starts a view transition from its projected rect to the heading", async () => {
  const { page, errors, transitions } = await open();
  try {
    await shelf(page);
    await live(page);
    for (const prefix of ["note-", "project-"]) {
      if (!page.url().endsWith("/shelf")) await shelf(page);
      await live(page);
      const aimed = await aim(page, prefix);
      const href = await page.locator(`a[data-book-id="${aimed.id}"]`).getAttribute("href");
      assert.ok(href);
      const before = transitions.length;
      await page.mouse.click(aimed.x, aimed.y);
      await page.waitForURL((url) => url.pathname === new URL(href, base).pathname);
      const until = Date.now() + 2000;
      while (transitions.length <= before && Date.now() < until) await page.waitForTimeout(50);
      const record = transitions[before];
      assert.ok(record, "document.startViewTransition ran");
      assert.equal(record.name, aimed.id);
      assert.equal(record.testid, "shelf-transition-proxy");
      assert.ok(record.width > 4 && record.height > 4);
      assert.ok(aimed.x >= record.left - 4 && aimed.x <= record.left + record.width + 4, "proxy covers the book");
      assert.ok(aimed.y >= record.top - 4 && aimed.y <= record.top + record.height + 4);
      await headingNamed(page, aimed.id);
    }
    assert.deepEqual(errors.unexpected, []);
  } finally { await page.context().close(); }
});

test("reduced motion skips the view transition and the hover spring", async () => {
  const { page, errors, transitions } = await open({ reducedMotion: "reduce" });
  try {
    await shelf(page);
    await live(page);
    const aimed = await aim(page, "note-");
    const settled = await page.locator(".ink-shelf canvas").evaluate((canvas) => Number((canvas as HTMLCanvasElement).dataset.shelfFrames));
    await page.evaluate(async () => { for (let i = 0; i < 6; i++) await new Promise(requestAnimationFrame); });
    const later = await page.locator(".ink-shelf canvas").evaluate((canvas) => Number((canvas as HTMLCanvasElement).dataset.shelfFrames));
    assert.ok(later - settled < 3, `hover spring kept drawing (${settled} → ${later})`);
    const href = await page.locator(`a[data-book-id="${aimed.id}"]`).getAttribute("href");
    await page.locator(`a[data-book-id="${aimed.id}"]`).focus();
    await page.keyboard.press("Enter");
    await page.waitForURL((url) => url.pathname === new URL(href!, base).pathname);
    assert.equal(transitions.length, 0);
    assert.deepEqual(errors.unexpected, []);
  } finally { await page.context().close(); }
});

test("without WebGL the flat shelf stays linked and still transitions", async () => {
  const { page, errors, transitions } = await open({}, true);
  try {
    await shelf(page);
    await page.locator(".ink-shelf[data-shelf-mode='flat']").waitFor();
    assert.equal(await page.locator(".ink-shelf canvas").count(), 0);
    const link = page.locator("a[href^='/notes/']").first();
    const id = await link.getAttribute("data-book-id");
    const href = await link.getAttribute("href");
    await link.click();
    await page.waitForURL((url) => url.pathname === new URL(href!, base).pathname);
    assert.equal(transitions.length, 1);
    assert.equal(transitions[0].name, id);
    assert.equal(transitions[0].testid, id);
    await headingNamed(page, id!);
    assert.deepEqual(errors.unexpected, []);
  } finally { await page.context().close(); }
});

test("outline debug uniforms reach the linked program", async () => {
  const { page, errors } = await open();
  try {
    await shelf(page, "?outlineDebug=1&kd=2&kn=0.5&ndvCutoff=0.4");
    await live(page);
    const uniforms = JSON.parse(await page.locator(".ink-shelf canvas").getAttribute("data-outline-uniforms") ?? "{}") as Record<string, number>;
    assert.equal(await page.locator(".ink-shelf canvas").getAttribute("data-outline-debug"), "1");
    assert.equal(uniforms.uKd, 2);
    assert.equal(uniforms.uKn, 0.5);
    assert.ok(Math.abs(uniforms.uNdvCutoff - 0.4) < 1e-6);
    assert.equal(uniforms.uDebug, 1);
    const ratio = await page.locator(".ink-shelf canvas").evaluate((canvas) => (canvas as HTMLCanvasElement).width / canvas.clientWidth);
    assert.ok(ratio <= 1.5);
    assert.deepEqual(errors.unexpected, []);
  } finally { await page.context().close(); }
});

test("the home page does not load the shelf renderer", async () => {
  const { page, errors } = await open();
  const bodies: string[] = [];
  page.on("response", async (response) => {
    if (response.request().resourceType() !== "script" || !response.ok()) return;
    try { bodies.push(await response.text()); } catch { /* a cancelled script is not a loaded chunk */ }
  });
  try {
    assert.equal((await page.goto(base))?.status(), 200);
    await page.locator("canvas[data-susuki-field]").waitFor({ state: "attached" });
    await page.waitForLoadState("load");
    assert.equal(bodies.filter((body) => body.includes("uNdvCutoff")).length, 0);
    assert.deepEqual(errors.unexpected, []);
  } finally { await page.context().close(); }
});

test("a lost WebGL context falls back to the flat shelf", async () => {
  const { page, errors } = await open();
  try {
    await shelf(page);
    await live(page);
    await page.evaluate(() => {
      const canvas = document.querySelector<HTMLCanvasElement>(".ink-shelf canvas")!;
      const gl = canvas.getContext("webgl2");
      gl?.getExtension("WEBGL_lose_context")?.loseContext();
    });
    await page.locator(".ink-shelf[data-shelf-mode='flat']").waitFor();
    assert.equal(await page.locator(".ink-shelf canvas").count(), 0);
    assert.ok(await page.locator("[data-testid=shelf-book-list] a").count() > 0);
    assert.deepEqual(errors.unexpected, []);
  } finally { await page.context().close(); }
});
