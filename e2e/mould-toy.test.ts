import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { chromium, type Browser, type BrowserContext } from "playwright-core";
import { collectBrowserErrors } from "./console-errors.ts";

const BASE = process.env.BASE_URL ?? "http://localhost:4000";
const tmp = mkdtempSync("/tmp/mould-toy-e2e-");
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
  await browser?.close();
  rmSync(tmp, { recursive: true, force: true });
});

async function open(route: string, reduced = false) {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    reducedMotion: reduced ? "reduce" : "no-preference",
  });
  contexts.push(context);
  const page = await context.newPage();
  const errors = collectBrowserErrors(BASE);
  page.on("pageerror", (error) => errors.pageError(error.message));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.console({ text: msg.text(), ...msg.location(), args: msg.args().length });
  });
  page.on("response", (res) => errors.response({
    url: res.url(),
    status: res.status(),
    method: res.request().method(),
    resourceType: res.request().resourceType(),
  }));
  const response = await page.goto(`${BASE}${route}`, { waitUntil: "load" });
  assert.equal(response?.status(), 200, route);
  return { page, errors };
}

test("/play links to the mould and the strata", async () => {
  const { page, errors } = await open("/play");
  assert.equal(await page.getByTestId("play-mould-link").getAttribute("href"), "/play/mould");
  assert.equal(await page.getByTestId("play-strata-link").getAttribute("href"), "/strata");
  assert.equal(errors.unexpected.length, 0, errors.unexpected.join("\n"));
});

test("/play/mould drops food, repels, and resets the dish", async () => {
  const { page, errors } = await open("/play/mould");
  const canvas = page.locator("[data-mould-canvas]");
  await canvas.waitFor();
  await page.waitForFunction(() => {
    const node = document.querySelector("[data-mould-canvas]");
    return node?.getAttribute("data-renderer") === "webgl2" || node?.getAttribute("data-renderer") === "canvas2d";
  });
  await page.waitForFunction(() => Number(document.querySelector("[data-mould-canvas]")?.getAttribute("data-food-count")) > 0);
  const start = Number(await canvas.getAttribute("data-food-count"));
  const box = (await canvas.boundingBox())!;
  await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.42);
  await page.waitForFunction((count) => Number(document.querySelector("[data-mould-canvas]")?.getAttribute("data-food-count")) > count, start);
  await page.getByRole("button", { name: "Repel" }).click();
  assert.equal(await canvas.getAttribute("data-mould-tool"), "repel");
  await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.4);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.6);
  await page.mouse.up();
  await page.locator("[data-mould-reset]").click();
  await page.waitForFunction((count) => Number(document.querySelector("[data-mould-canvas]")?.getAttribute("data-food-count")) === count, start);
  assert.equal(errors.unexpected.length, 0, errors.unexpected.join("\n"));
});

test("the mould holds still when motion is reduced", async () => {
  const { page, errors } = await open("/play/mould", true);
  await page.locator("[data-mould-canvas]").waitFor();
  await page.waitForFunction(() => document.querySelector("[data-mould-canvas]")?.getAttribute("data-reduced-motion") === "true");
  assert.equal(errors.unexpected.length, 0, errors.unexpected.join("\n"));
});
