import assert from "node:assert/strict";
import { test } from "node:test";
import { chromium } from "playwright-core";

test("independent real-browser appearance and hostile-storage control", async () => {
  const browser = await chromium.launch({ channel: "chrome", env: { ...process.env, TMPDIR: "/tmp" } });
  const context = await browser.newContext();
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`${process.env.BASE_URL}/ryugu`);
  await page.waitForFunction(() => window.otohimeAppearance);
  const house = await page.locator("#ryugu-caustic feTurbulence").getAttribute("baseFrequency");
  const applied = await page.evaluate(() => window.otohimeAppearance.applyLab({
    version: 1, printRun: "riso", settings: {
      turbulence: 0.07, displacement: 7, wobble: 0, grain: 0.05,
      plates: ["#123456", "#ff48b0", "#00a95c"], plateCount: 2,
      transitionMs: 300, hand: "ink", halftone: true,
    },
  }));
  assert.equal(applied.persisted, true);
  await page.waitForFunction(() => document.querySelector("#ryugu-caustic feTurbulence")?.getAttribute("baseFrequency") === "0.018 0.032");
  await page.goto(`${process.env.BASE_URL}/vinyl`);
  assert.equal(await page.locator("html").getAttribute("data-print-run"), "riso");
  assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor), "rgb(32, 30, 28)");
  await page.goto(`${process.env.BASE_URL}/ryugu`);
  await page.waitForFunction(() => window.otohimeAppearance);
  assert.equal(await page.locator("#ryugu-caustic feTurbulence").getAttribute("baseFrequency"), "0.018 0.032");
  await page.evaluate(() => window.otohimeAppearance.resetHouse());
  assert.equal(await page.locator("#ryugu-caustic feTurbulence").getAttribute("baseFrequency"), house);
  assert.equal(await page.locator("html").getAttribute("data-print-run"), null);
  assert.deepEqual(await page.evaluate(() => [localStorage.getItem("otohime:print-run:v1"), sessionStorage.getItem("otohime:ink-lab:v1")]), [null, null]);
  assert.deepEqual(errors, []);

  const hostile = await browser.newContext();
  await hostile.addInitScript(() => {
    localStorage.setItem("otohime:print-run:v1", '</style><script>window.__injected=1</script>');
    sessionStorage.setItem("otohime:ink-lab:v1", "v=1&r=riso&t=999999");
  });
  const bad = await hostile.newPage();
  await bad.goto(`${process.env.BASE_URL}/ryugu`);
  await bad.waitForFunction(() => window.otohimeAppearance);
  assert.equal(await bad.locator("html").getAttribute("data-print-run"), null);
  assert.equal(await bad.evaluate(() => window.__injected), undefined);
  assert.equal(await bad.locator("#ryugu-caustic feTurbulence").getAttribute("baseFrequency"), house);
  await hostile.close();
  await context.close();
  await browser.close();
});
