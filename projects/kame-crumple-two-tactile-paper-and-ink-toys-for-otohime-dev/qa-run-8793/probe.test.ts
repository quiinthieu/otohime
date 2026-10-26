import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { chromium, type Browser } from "playwright-core";

const base = process.env.BASE_URL ?? "http://localhost:4000";
let browser: Browser;

before(async () => {
  const options = { env: { ...process.env, TMPDIR: "/tmp" } };
  try { browser = await chromium.launch({ ...options, channel: "chrome" }); }
  catch { browser = await chromium.launch(options); }
});
after(async () => { await browser?.close(); });

test("paper stays readable without JavaScript and desk remains outside discovery", async () => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  try {
    const page = await context.newPage();
    for (const route of ["/projects", "/notes"]) {
      assert.equal((await page.goto(`${base}${route}`))?.status(), 200);
      assert.ok(await page.locator("[data-paper-id][data-tossable]").count() > 0);
      assert.equal(await page.locator("[data-paper-controls]").count(), 0);
    }
    assert.equal((await page.goto(`${base}/desk`))?.status(), 200);
    assert.equal(await page.locator("[data-paper-id],[data-paper-controls]").count(), 0);
  } finally { await context.close(); }
});

test("keyboard peel exposes text without moving the source or changing its link", async () => {
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    assert.equal((await page.goto(`${base}/projects`, { waitUntil: "load" }))?.status(), 200);
    const card = page.locator("[data-paper-id]").first();
    await card.locator("[data-paper-controls]").waitFor();
    const box = await card.boundingBox();
    const link = card.locator("a[href]").first();
    const href = await link.getAttribute("href");
    await card.getByRole("button", { name: "Peel corner" }).focus();
    await page.keyboard.press("Enter");
    assert.equal(await card.getAttribute("data-paper-state"), "peeled");
    assert.ok((await card.locator(".paper-margin").innerText()).trim().length > 0);
    assert.equal(await link.getAttribute("href"), href);
    const peeled = await card.boundingBox();
    assert.ok(box && peeled);
    for (const axis of ["x", "y", "width", "height"] as const) assert.ok(Math.abs(box[axis] - peeled[axis]) <= 1, axis);
    await card.getByRole("button", { name: "Reset" }).focus();
    await page.keyboard.press("Enter");
    assert.equal(await card.getAttribute("data-paper-state"), "intact");
    assert.equal(await card.locator(".paper-margin").isVisible(), false);
  } finally { await context.close(); }
});
