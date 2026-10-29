import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { chromium, type Browser, type BrowserContext } from "playwright-core";
import { collectBrowserErrors } from "./console-errors.ts";

const BASE = process.env.BASE_URL ?? "http://localhost:4000";
const tmp = mkdtempSync("/tmp/mould-veins-e2e-");
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

for (const route of ["/work", "/projects"]) {
  test(`${route} grows sumi veins from its nodes`, async () => {
    const { page, errors } = await open(route);
    const figure = page.locator("[data-mould-veins]");
    await figure.waitFor();
    await page.waitForFunction(() => Number(document.querySelector("[data-mould-veins]")?.getAttribute("data-node-count")) >= 4);
    assert.ok(await page.locator("[data-mould-node]").count() >= 4);
    const before = await figure.getAttribute("data-mould-basis");
    await page.locator("[data-mould-basis-toggle]").click();
    await page.waitForFunction((basis) => document.querySelector("[data-mould-veins]")?.getAttribute("data-mould-basis") !== basis, before);
    assert.equal(await page.locator('a[href="/play/mould"]').count() > 0, true);
    assert.equal(await page.locator('a[href="/strata"]').count() > 0, true);
    assert.equal(errors.unexpected.length, 0, errors.unexpected.join("\n"));
  });
}

test("work and project veins hold still when motion is reduced", async () => {
  for (const route of ["/work", "/projects"]) {
    const { page, errors } = await open(route, true);
    await page.locator("[data-mould-veins]").waitFor();
    await page.waitForFunction(() => document.querySelector("[data-mould-veins]")?.getAttribute("data-reduced-motion") === "true");
    assert.equal(errors.unexpected.length, 0, errors.unexpected.join("\n"));
  }
});
