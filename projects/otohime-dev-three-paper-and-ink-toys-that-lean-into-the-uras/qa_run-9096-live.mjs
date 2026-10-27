import assert from "node:assert/strict";
import { chromium } from "playwright-core";

const base = process.env.BASE_URL ?? "https://otohime.dev";
const browser = await chromium.launch({ channel: "chrome", env: { ...process.env, TMPDIR: "/tmp" } });
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce", deviceScaleFactor: 2 });
  const page = await context.newPage();
  const errors = [];
  const bottleRequests = [];
  page.on("pageerror", e => errors.push(e.message));
  page.on("request", r => { if (new URL(r.url()).pathname === "/api/bottles") bottleRequests.push(r.url()); });
  await page.goto(base);
  await page.locator('[data-bottle-entry="pocket"]:enabled').waitFor();
  assert.equal(bottleRequests.length, 0);
  const ids = [];
  for (const entry of ["pocket", "footer"]) {
    const trigger = page.locator(`[data-bottle-entry="${entry}"]:visible`);
    await trigger.click();
    const dialog = page.getByRole("dialog", { name: "Message in a Bottle" });
    await dialog.locator("[data-bottle-id]").waitFor();
    ids.push(await dialog.locator("[data-bottle-id]").getAttribute("data-bottle-id"));
    const visit = dialog.getByRole("link", { name: /^Visit / });
    assert.match(await visit.getAttribute("href"), /^https:\/\//);
    assert.equal(await visit.getAttribute("target"), "_blank");
    assert.equal(await visit.getAttribute("rel"), "noopener noreferrer");
    assert.equal(context.pages().length, 1);
    assert.equal(await page.locator("dialog[open]").count(), 1);
    await page.keyboard.press("Escape");
    await page.waitForFunction(name => document.activeElement?.getAttribute("data-bottle-entry") === name, entry);
    assert.equal(await page.locator("dialog[open]").count(), 0);
  }
  assert.notEqual(ids[0], ids[1]);
  assert.equal(bottleRequests.length, 2);
  assert.deepEqual(errors, []);
  const footerBottle = page.locator('[data-bottle-entry="footer"]');
  const scene = page.locator('.end-canvas');
  const original = await footerBottle.boundingBox();
  const sceneBounds = await scene.boundingBox();
  const defaultGap = sceneBounds.y - original.y - original.height;
  await footerBottle.evaluate(node => { node.style.fontSize = "24px"; });
  const enlarged = await footerBottle.boundingBox();
  const enlargedGap = sceneBounds.y - enlarged.y - enlarged.height;
  assert.ok(defaultGap > 0 && enlargedGap < 0, "enlarged Bottle crosses the scene pointer area");
  const noJs = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
  const still = await noJs.newPage();
  await still.goto(base);
  assert.equal(await still.locator('footer.end').count(), 1);
  assert.match(await still.locator('footer.end').textContent(), /Bottle needs JavaScript/);
  await still.getByRole("link", { name: "Work", exact: true }).last().click();
  await still.waitForURL(/\/work\/?$/);
  console.log(JSON.stringify({ base, ids, bottleRequests: bottleRequests.length, pages: context.pages().length, errors, noJsWork: new URL(still.url()).pathname, defaultGap, enlargedGap }));
  await noJs.close();
  await context.close();
} finally { await browser.close(); }
