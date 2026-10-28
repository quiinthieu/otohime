import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { chromium, type Browser } from "playwright-core";

const BASE = process.env.BASE_URL ?? "http://localhost:4000";
let browser: Browser;
before(async () => { browser = await chromium.launch({ channel: "chrome" }); });
after(async () => { await browser?.close(); });

test("a slow oracle shows progress, and only the latest question prints", async () => {
  const context = await browser.newContext({ reducedMotion: "reduce" });
  const page = await context.newPage();
  let release!: () => void;
  const held = new Promise<void>((resolve) => { release = resolve; });
  try {
    await page.route("**/api/ask", async (route) => {
      if (route.request().method() === "GET") {
        return route.fulfill({ json: { enabled: true } });
      }
      const { question } = route.request().postDataJSON();
      if (question === "first") await held;
      await route.fulfill({ json: {
        mode: "llm", intent: "search", lines: [`Answer for ${question}.`], sources: [{ title: "Work", href: "/work" }],
      } });
    });
    await page.goto(BASE);
    await page.getByRole("button", { name: /Ask the console/ }).click();
    const input = page.locator("#ask-q");
    await input.fill("first");
    await input.press("Enter");
    await page.getByRole("status").filter({ hasText: "Consulting the ink" }).waitFor();
    assert.equal(await page.locator(".ask-out").getAttribute("aria-busy"), "true");
    await input.fill("second");
    await input.press("Enter");
    await page.waitForFunction(() => document.querySelector(".ask-said")?.textContent?.includes("Answer for second."));
    assert.equal(await page.locator(".ask-out").getAttribute("aria-busy"), "false");
    const firstResponse = page.waitForResponse((r) => r.request().method() === "POST" && r.request().postDataJSON()?.question === "first");
    release();
    await firstResponse;
    await page.waitForLoadState("networkidle");
    assert.ok((await page.locator(".ask-said").textContent())?.includes("Answer for second."));
    assert.ok(!(await page.locator(".ask-out").textContent())?.includes("Answer for first."));
    assert.equal(await page.locator('.ask-link').first().getAttribute("href"), "/work");
  } finally {
    release();
    await context.close();
  }
});
