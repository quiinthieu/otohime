import assert from "node:assert/strict";
import { test } from "node:test";
import { chromium } from "playwright-core";

const base = process.env.BASE_URL ?? "http://localhost:4000";

test("independent Theatre user path and no-JS negative control", async () => {
  const browser = await chromium.launch({ channel: "chrome" });
  try {
    const plain = await browser.newContext({ javaScriptEnabled: false });
    const plainPage = await plain.newPage();
    await plainPage.goto(`${base}/projects`);
    assert.equal(await plainPage.locator(".kamishibai-stories ol > li:visible").count(), 33);
    assert.equal(await plainPage.locator(".cartridges a.project-title").count(), 11);
    await plain.close();

    const interactive = await browser.newContext();
    const page = await interactive.newPage();
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(`${base}/projects`);
    await page.getByRole("button", { name: "Theatre mode", exact: true }).click();
    await page.getByRole("status").filter({ hasText: "Card 1 of 3" }).waitFor();

    // Arrow keys outside the paper stage must leave its card alone.
    await page.getByRole("button", { name: "Console sounds", exact: true }).focus();
    await page.keyboard.press("ArrowRight");
    assert.match(await page.getByRole("status").filter({ hasText: "Card 1 of 3" }).innerText(), /Card 1 of 3/);

    await page.getByRole("button", { name: "Next card", exact: true }).click();
    await page.getByRole("status").filter({ hasText: "Card 2 of 3" }).waitFor();
    assert.equal(await page.getByRole("button", { name: "Enable theatre sound", exact: true }).count(), 1);
    await page.getByRole("button", { name: "Enable theatre sound", exact: true }).click();
    assert.equal(await page.getByRole("button", { name: "Console sounds", exact: true }).getAttribute("aria-pressed"), "true");
    await page.getByRole("button", { name: "Mute theatre sound", exact: true }).click();
    assert.equal(await page.getByRole("button", { name: "Console sounds", exact: true }).getAttribute("aria-pressed"), "false");
    await page.getByRole("button", { name: "Read all cards", exact: true }).first().click();
    await page.waitForFunction(() => document.activeElement === document.querySelector(".kamishibai-list h2"));
    assert.equal(await page.locator(".kamishibai-stories ol > li:visible").count(), 33);
    assert.deepEqual(errors, []);
    await interactive.close();
  } finally {
    await browser.close();
  }
});
