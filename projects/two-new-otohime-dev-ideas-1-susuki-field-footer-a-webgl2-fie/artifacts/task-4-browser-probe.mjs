// Local SWE preflight; run with Node's --experimental-strip-types and BASE_URL.
// This uses real Chrome/WebGL2 and locked app dependencies. It is not deployed QA.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { chromium } from "playwright-core";
import sharp from "sharp";
import { site } from "../../../content/site.ts";
import { buildShelfBooks, SHELF_ROW_GAP, SHELF_WIDTH, shelfRowCount } from "../../../lib/shelf.ts";

const base = process.env.BASE_URL;
assert.ok(base, "BASE_URL must name a locally running production server");
const browser = await chromium.launch({
  channel: "chrome", env: { ...process.env, TMPDIR: "/tmp" },
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
const books = buildShelfBooks(site.projectList, site.notes);
const results = { browser: browser.version(), node: process.version, build: readFileSync(new URL("../../../.next/BUILD_ID", import.meta.url), "utf8").trim(), checks: [] };
const check = (name, details) => { results.checks.push({ name, ...details }); console.log(`ok - ${name} ${JSON.stringify(details)}`); };
const shelfChunk = /objectHatching|THREE\.WebGLRenderer|\.shelfFrames/;

async function pageFor(options = {}, unavailable = false, saveData = false) {
  const page = await browser.newPage({ viewport: { width: 1366, height: 1000 }, ...options });
  const errors = [], chunks = [], pending = [], unread = [];
  let collecting = true;
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error" && /Ink Shelf|THREE|WebGL|shader/i.test(message.text())) errors.push(message.text());
  });
  page.on("response", (response) => {
    if (collecting && /\.js(?:\?|$)/.test(response.url())) pending.push(response.text().then((body) => {
      if (shelfChunk.test(body)) chunks.push(new URL(response.url()).pathname);
    }, (error) => unread.push({ url: response.url(), error: error.message })));
  });
  await page.addInitScript(({ unavailable, saveData }) => {
    if (saveData) Object.defineProperty(navigator, "connection", { value: { saveData: true } });
    const original = HTMLCanvasElement.prototype.getContext;
    window.__shelfProof = { shaderSources: [], compileErrors: [], draws: 0 };
    HTMLCanvasElement.prototype.getContext = function (type, ...args) {
      if (unavailable && /webgl/.test(type)) return null;
      const context = original.call(this, type, ...args);
      if (context && type === "webgl2" && this.closest(".ink-shelf")) {
        window.__shelfGL = context;
        const compile = context.compileShader.bind(context);
        context.compileShader = (shader) => {
          compile(shader);
          window.__shelfProof.shaderSources.push(context.getShaderSource(shader));
          if (!context.getShaderParameter(shader, context.COMPILE_STATUS)) window.__shelfProof.compileErrors.push(context.getShaderInfoLog(shader));
        };
        for (const key of ["drawArrays", "drawElements"]) {
          const draw = context[key].bind(context);
          context[key] = (...parameters) => { window.__shelfProof.draws++; return draw(...parameters); };
        }
      }
      return context;
    };
  }, { unavailable, saveData });
  return { page, errors, chunks, pending, unread, stopCollection: () => { collecting = false; } };
}

// Drive a fixed number of browser frames instead of sleeping for a soak.
const driveFrames = (page, count) => page.evaluate(async (count) => {
  for (let i = 0; i < count; i++) await new Promise(requestAnimationFrame);
}, count);

async function live(viewport, debug = false) {
  const { page, errors, chunks, pending, unread } = await pageFor({ viewport, deviceScaleFactor: viewport.width < 500 ? 3 : 1 });
  try {
    const response = await page.goto(`${base}/shelf${debug ? "?outlineDebug=1&kd=2&kn=0.7&ndvCutoff=0.3" : ""}`);
    assert.equal(response.status(), 200);
    await page.waitForSelector('[data-shelf-mode="3d"] canvas', { timeout: 60_000 });
    const canvas = page.locator(".ink-shelf canvas");
    await canvas.scrollIntoViewIfNeeded();
    const uniforms = JSON.parse(await canvas.getAttribute("data-outline-uniforms"));
    assert.equal(await canvas.getAttribute("data-outline-debug"), debug ? "1" : "0");
    assert.equal(uniforms.uKd, debug ? 2 : 1); assert.equal(uniforms.uKn, debug ? 0.7 : 1);
    assert.equal(uniforms.uNdvCutoff, debug ? 0.3 : 0.2);
    const proof = await page.evaluate(() => ({
      errors: window.__shelfProof.compileErrors, draws: window.__shelfProof.draws,
      object: window.__shelfProof.shaderSources.some((source) => source.includes("objectHatching")),
      normal: window.__shelfProof.shaderSources.some((source) => source.includes("abs(dot(N, V))")),
      composite: window.__shelfProof.shaderSources.some((source) => source.includes("float linearDepth")),
      glError: window.__shelfGL.getError(),
      dpr: document.querySelector(".ink-shelf canvas").width / document.querySelector(".ink-shelf canvas").clientWidth,
    }));
    assert.deepEqual(proof.errors, []); assert.equal(proof.glError, 0);
    assert.ok(proof.object && proof.normal && proof.composite && proof.draws > 10);
    assert.ok(proof.dpr >= 1 && proof.dpr <= 1.501);
    const png = await canvas.screenshot();
    if (process.env.PROBE_SHOTS) writeFileSync(`${process.env.PROBE_SHOTS}-${viewport.width}.png`, png);
    const { data, info } = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const colours = new Set(); let dark = 0, suppressed = 0;
    for (let i = 0; i < data.length; i += info.channels) {
      colours.add(`${data[i]},${data[i + 1]},${data[i + 2]}`);
      if (Math.max(data[i], data[i + 1], data[i + 2]) < 110) dark++;
      if (data[i + 2] > 220 && data[i] < 50 && data[i + 1] < 50) suppressed++;
    }
    assert.ok(colours.size > (debug ? 4 : 100), `nonblank rendered pixels: ${colours.size}`);
    assert.ok(dark > 100);
    if (debug) assert.ok(suppressed > 20, `grazing suppression blue pixels: ${suppressed}`);
    const link = page.locator('[data-testid="shelf-book-list"] a').first();
    await link.focus();
    await page.waitForFunction((id) => document.querySelector(".ink-shelf canvas").dataset.focusedBook === id, books[0].id);
    await driveFrames(page, 100);
    const settled = await canvas.getAttribute("data-shelf-frames");
    await driveFrames(page, 16);
    assert.equal(await canvas.getAttribute("data-shelf-frames"), settled, "stationary shelf renders zero idle frames");
    const focusPng = await canvas.screenshot();
    assert.notEqual(createHash("sha256").update(focusPng).digest("hex"), createHash("sha256").update(png).digest("hex"), "keyboard focus visibly changes rendered geometry/highlight");
    await link.blur();
    // Project a real book centre through the same low-FOV camera for an actual raycast.
    const rect = await canvas.boundingBox();
    const centreY = (2.4 - (shelfRowCount(books.length) - 1) * SHELF_ROW_GAP) / 2;
    const tan = Math.tan(28 * Math.PI / 360);
    const distance = Math.max(shelfRowCount(books.length) * SHELF_ROW_GAP / 2 / tan, (SHELF_WIDTH + 1) / 2 / tan / (rect.width / rect.height)) * 1.05;
    const angle = Math.atan(1 / distance), book = books[0];
    const depth = -Math.sin(angle) * (book.y - centreY - 1) + Math.cos(angle) * distance;
    await page.mouse.move(rect.x + rect.width / 2 + book.x / depth / tan * rect.height / 2, rect.y + rect.height / 2 - Math.cos(angle) * (book.y - centreY) / depth / tan * rect.height / 2);
    await page.waitForFunction((id) => document.querySelector(".ink-shelf canvas").dataset.hoveredBook === id, book.id);
    await page.getByRole("button", { name: "Notes", exact: true }).click();
    assert.equal(await page.locator('[data-testid="shelf-book-list"] li:not([hidden])').count(), books.filter((book) => book.kind === "note").length);
    await page.evaluate(() => window.__shelfGL.getExtension("WEBGL_lose_context").loseContext());
    await page.waitForSelector('[data-shelf-mode="flat"]');
    assert.equal(await page.locator(".ink-shelf canvas").count(), 0);
    assert.equal(await page.locator('[data-testid="shelf-book-list"]').evaluate((element) => getComputedStyle(element).opacity), "1");
    await Promise.all(pending);
    assert.deepEqual(errors, []); assert.deepEqual(unread, []); assert.ok(chunks.length > 0);
    check(`real WebGL2 ${viewport.width}px${debug ? " debug" : ""}: compile/pixels/focus/hover/idle/filter/context loss`, { proof, colours: colours.size, dark, suppressed, chunks, screenshotSha256: createHash("sha256").update(png).digest("hex") });
  } finally { await page.close(); }
}

try {
  await live({ width: 1366, height: 1000 });
  await live({ width: 390, height: 844 }, true);
  {
    const { page, errors } = await pageFor({ reducedMotion: "reduce" });
    try {
      await page.goto(`${base}/shelf`);
      await page.waitForSelector('[data-shelf-mode="3d"] canvas');
      const canvas = page.locator(".ink-shelf canvas");
      await canvas.scrollIntoViewIfNeeded();
      const rect = await canvas.boundingBox();
      await page.mouse.move(rect.x + rect.width * 0.9, rect.y + rect.height * 0.4);
      const before = await canvas.screenshot();
      await page.mouse.move(rect.x + rect.width * 0.8, rect.y + rect.height * 0.6);
      await driveFrames(page, 24);
      assert.equal(createHash("sha256").update(await canvas.screenshot()).digest("hex"), createHash("sha256").update(before).digest("hex"), "reduced motion keeps the camera stationary");
      assert.deepEqual(errors, []);
      check("reduced motion disables pointer parallax", { unchangedPixels: true, pageErrors: errors });
    } finally { await page.close(); }
  }
  for (const [name, unavailable, saveData, route] of [["no-WebGL negative control", true, false, "/shelf"], ["Save-Data negative control", false, true, "/shelf"], ["home bundle isolation", false, false, "/"]]) {
    const { page, errors, chunks, pending, unread, stopCollection } = await pageFor({}, unavailable, saveData);
    try {
      await page.goto(`${base}${route}`, { waitUntil: "networkidle" });
      await Promise.all(pending);
      stopCollection();
      if (unavailable || saveData) {
        await page.waitForSelector('[data-shelf-mode="flat"]');
        assert.equal(await page.locator(".ink-shelf canvas").count(), 0);
        assert.equal(await page.locator('[data-testid="shelf-book-list"] a').count(), books.length);
        await page.locator('[data-testid="shelf-book-list"] a').first().click();
        await page.waitForURL(`**${books[0].href}`);
      }
      await Promise.all(pending);
      assert.deepEqual(chunks, []); assert.deepEqual(errors, []); assert.deepEqual(unread, []);
      check(name, { shelfChunks: chunks.length, pageErrors: errors });
    } finally { await page.close(); }
  }
  console.log(JSON.stringify(results, null, 2));
} finally { await browser.close(); }
