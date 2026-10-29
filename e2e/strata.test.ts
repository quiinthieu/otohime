import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { chromium, type Browser, type BrowserContext } from "playwright-core";
import { collectBrowserErrors } from "./console-errors.ts";

const BASE = process.env.BASE_URL ?? "http://localhost:4000";
const tmp = mkdtempSync("/tmp/strata-e2e-");
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
  await page.locator("[data-strata-stage]").waitFor();
  return { page, errors };
}

for (const route of ["/strata", "/play/strata"]) {
  test(`${route} stacks the paper, inspects a week, and scrubs the year`, async () => {
    const { page, errors } = await open(route);
    assert.ok(await page.locator("[data-strata-stage] svg path").count() >= 6);
    const stage = page.locator("[data-strata-stage]");
    await stage.scrollIntoViewIfNeeded();
    const fresh = (await stage.boundingBox())!;
    await page.mouse.move(fresh.x + fresh.width * 0.08, fresh.y + fresh.height * 0.45);
    await page.waitForFunction(() => Number(document.querySelector("[data-strata-stage]")?.getAttribute("data-active-week")) <= 8);
    await page.mouse.move(fresh.x + fresh.width * 0.92, fresh.y + fresh.height * 0.45);
    await page.waitForFunction(() => Number(document.querySelector("[data-strata-stage]")?.getAttribute("data-active-week")) >= 40);
    assert.match(await page.locator("[data-strata-inspector]").innerText(), /Week/);
    await stage.focus();
    await page.keyboard.press("Home");
    await page.waitForFunction(() => document.querySelector("[data-strata-stage]")?.getAttribute("data-active-week") === "1");
    await page.keyboard.press("ArrowRight");
    await page.waitForFunction(() => document.querySelector("[data-strata-stage]")?.getAttribute("data-active-week") === "2");
    await page.keyboard.press("ArrowLeft");
    await page.waitForFunction(() => document.querySelector("[data-strata-stage]")?.getAttribute("data-active-week") === "1");
    assert.equal(await page.locator("[data-strata-inspector]").getAttribute("aria-live"), "polite");
    await page.locator("[data-strata-scrubber]").getByRole("button", { name: "2024" }).click();
    await page.waitForFunction(() => document.querySelector("[data-strata-stage]")?.getAttribute("data-year") === "2024");
    await page.locator("[data-strata-scrubber]").getByRole("button", { name: "2026" }).click();
    await page.waitForFunction(() => document.querySelector("[data-strata-stage]")?.getAttribute("data-year") === "2026");
    assert.equal(errors.unexpected.length, 0, errors.unexpected.join("\n"));
  });
}

test("paper strata holds still when motion is reduced", async () => {
  const { page, errors } = await open("/strata", true);
  await page.waitForFunction(() => document.querySelector("[data-strata-stage]")?.getAttribute("data-reduced-motion") === "true");
  assert.equal(errors.unexpected.length, 0, errors.unexpected.join("\n"));
});
