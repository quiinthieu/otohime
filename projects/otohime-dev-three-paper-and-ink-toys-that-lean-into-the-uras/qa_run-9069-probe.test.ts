import assert from "node:assert/strict";
import { test } from "node:test";
import { chromium } from "playwright-core";

const base = process.env.BASE_URL ?? "http://localhost:4000";

test("independent Bottle path and hostile pool control", async () => {
  const browser = await chromium.launch({ channel: "chrome" });
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(base);
    const pocket = page.locator('[data-bottle-entry="pocket"]');
    await pocket.focus();
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog", { name: "Message in a Bottle" });
    await dialog.locator("[data-bottle-id]").waitFor();
    assert.equal(context.pages().length, 1);
    const first = await dialog.locator("[data-bottle-id]").getAttribute("data-bottle-id");
    const visit = dialog.getByRole("link", { name: /^Visit / });
    assert.match((await visit.getAttribute("href"))!, /^https:\/\//);
    assert.equal(await visit.getAttribute("rel"), "noopener noreferrer");
    await dialog.getByRole("button", { name: "Another bottle" }).click();
    assert.notEqual(await dialog.locator("[data-bottle-id]").getAttribute("data-bottle-id"), first);
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => document.activeElement?.getAttribute("data-bottle-entry") === "pocket");
    assert.equal(await page.locator("dialog[open]").count(), 0);

    // A syntactically valid HTTP success containing an unsafe link must fall back to curated links.
    await context.route("**/api/bottles", route => route.fulfill({ json: {
      bottles: [{ id: "hostile", url: "javascript:alert(1)", title: "Bad", note: "Bad", kind: "site" }],
      degraded: false,
    } }));
    const footer = page.locator('[data-bottle-entry="footer"]');
    await footer.click();
    await dialog.locator("[data-bottle-id]").waitFor();
    assert.match((await dialog.getByRole("status").innerText()), /offline tide/i);
    assert.equal(await dialog.locator('[href^="javascript:"]').count(), 0);
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => document.activeElement?.getAttribute("data-bottle-entry") === "footer");
    assert.deepEqual(errors, []);
    await context.close();
  } finally {
    await browser.close();
  }
});

test("live reduced-motion switch cancels the running card animation", async () => {
  const browser = await chromium.launch({ channel: "chrome" });
  try {
    const context = await browser.newContext({ reducedMotion: "no-preference" });
    const page = await context.newPage();
    await page.goto(base);
    await page.locator('[data-bottle-entry="footer"]').click();
    const card = page.locator(".bottle-card");
    await card.waitFor();
    await page.evaluate(() => {
      (window as unknown as { motionChanges: number }).motionChanges = 0;
      matchMedia("(prefers-reduced-motion: reduce)").addEventListener("change", () => {
        (window as unknown as { motionChanges: number }).motionChanges++;
      });
    });
    await page.emulateMedia({ reducedMotion: "reduce" });
    const immediate = await card.evaluate(el => el.getAnimations().length);
    await page.waitForFunction(() => (window as unknown as { motionChanges: number }).motionChanges > 0);
    await page.waitForFunction(() => document.querySelector(".bottle-card")?.getAnimations().length === 0);
    const afterEvent = await card.evaluate(el => el.getAnimations().length);
    assert.equal(afterEvent, 0);
    console.log(JSON.stringify({ immediate, afterEvent, browser: browser.version() }));
    await context.close();
  } finally {
    await browser.close();
  }
});
