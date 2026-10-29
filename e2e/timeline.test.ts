import assert from "node:assert/strict";
import { test } from "node:test";
import { open, shot, noOverflow } from "./paper-experiments-helpers.ts";

test("timeline turns with keys and scroll; tabs and detail wheel work", { timeout: 60000 }, async () => {
  const { page, context, errors } = await open("/timeline");
  try {
    const book = page.getByRole("region", { name: "Career archive, 2018 to 2026" });
    await page.locator('.timeline-book[data-enhanced="true"]').waitFor();
    await book.focus(); await page.keyboard.press("Home");
    assert.equal(await page.locator('.book-spreads > li[data-active="true"] h2').textContent(), "2018");
    await page.keyboard.press("ArrowRight");
    assert.equal(await page.locator('.book-spreads > li[data-active="true"] h2').textContent(), "2019");
    await book.hover(); await page.mouse.wheel(0, 140);
    await page.waitForFunction(() => document.querySelector('.book-spreads > li[data-active="true"] h2')?.textContent === "2020");
    await page.keyboard.press("End");
    await page.getByRole("button", { name: "Pull the archive tab" }).click();
    await page.getByRole("link", { name: "Shore", exact: true }).waitFor();
    const wheel = page.getByLabel("Detail wheel"); await wheel.focus(); await page.keyboard.press("End");
    assert.match(await page.locator(".book-wheel p:visible").innerText(), /adoption year is unrecorded/);
    await shot(page, "timeline-desktop");
    assert.deepEqual(errors.unexpected, []);
  } finally { await context.close(); }
});

test("timeline stays flat without JS and under reduced motion, and fits a phone", { timeout: 60000 }, async () => {
  for (const options of [{ reduced: true, phone: true }, { js: false, phone: true }]) {
    const { page, context, errors } = await open("/timeline", options);
    try {
      assert.equal(await page.locator(".book-spreads > li:visible").count(), 9);
      assert.ok(await noOverflow(page));
      assert.match(await page.locator(".book-spreads").innerText(), /No dated career details/);
      if (options.reduced) await shot(page, "timeline-phone-reduced");
      assert.deepEqual(errors.unexpected, []);
    } finally { await context.close(); }
  }
});
