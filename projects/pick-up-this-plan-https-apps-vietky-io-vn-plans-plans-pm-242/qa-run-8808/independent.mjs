// Independent QA observations; run through the delivery's scripts/e2e.mjs --test <this absolute path>.
// QA_LIVE=1 uses read-only production checks. No credentials, mocks, or application imports.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { writeFileSync } from "node:fs";
import { test } from "node:test";

const require = createRequire(`${process.env.QA_DELIVERY_ROOT || process.cwd()}/package.json`);
const { chromium } = require("playwright-core");
const base = process.env.BASE_URL;
const live = process.env.QA_LIVE === "1";
const observed = { base, live, fake: false, checks: [], hops: [] };

test("independent HTTP, keyboard, locator negative control and root-layout navigation audit", { timeout: 180_000 }, async () => {
  let browser;
  try {
    const health = await fetch(`${base}/api/health`);
    assert.equal(health.status, 200);
    assert.equal((await health.json()).ok, true);
    const presence = await fetch(`${base}/api/now-playing`);
    assert.equal(presence.status, 200);
    assert.match(presence.headers.get("cache-control"), /no-store/);
    observed.presence = await presence.json();
    observed.checks.push("real health and no-store presence API");
    browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || "/usr/bin/google-chrome", env: { ...process.env, TMPDIR: "/tmp" }, args: ["--enable-unsafe-swiftshader", "--use-angle=swiftshader"] });
    observed.browser = browser.version();
    const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(`${base}/projects`, { waitUntil: "networkidle" });
    observed.sha = await page.locator('meta[name="build-sha"]').getAttribute("content");
    if (process.env.EXPECT_SHA) assert.equal(observed.sha, process.env.EXPECT_SHA);
    const footer = page.locator("footer.end");
    assert.equal(await footer.count(), 1);
    const links = await footer.locator("[data-end-page]").evaluateAll(elements => elements.map(a => a.getAttribute("href")));
    assert.ok(links.includes("/play") && links.includes("/work"));
    observed.footerPages = links;
    const checkPlay = async () => assert.equal(await footer.locator('[data-end-page="/play"]').getAttribute("href"), "/play");
    await checkPlay();
    await footer.locator('[data-end-page="/play"]').evaluate(a => a.setAttribute("href", "/qa-broken"));
    await assert.rejects(checkPlay(), /qa-broken/);
    await footer.locator('[data-end-page="/play"]').evaluate(a => a.setAttribute("href", "/play"));
    await checkPlay();
    observed.checks.push("canonical-link corruption is detected and restoration passes (DOM-only negative control)");
    if (!live) {
      assert.equal(await footer.locator("[data-end-waterline]").count(), 1);
      assert.equal(await footer.evaluate(el => el.lastElementChild.hasAttribute("data-end-waterline")), true);
      await footer.locator("[data-end-mascot]").focus();
      const tabStops = [];
      for (let i = 0; i < 40; i++) {
        const active = await page.evaluate(() => ({ href: document.activeElement?.getAttribute("href"), text: document.activeElement?.textContent?.trim().slice(0, 80), waterline: !!document.activeElement?.hasAttribute("data-end-ryugu") }));
        tabStops.push(active);
        if (active.waterline) break;
        await page.keyboard.press("Tab");
      }
      assert.equal(tabStops.at(-1).waterline, true, JSON.stringify(tabStops));
      for (const href of links) assert.ok(tabStops.some(stop => stop.href === href), href);
      observed.tabStops = tabStops;
      observed.checks.push("keyboard reaches all seven page links and the final waterline");
      await page.goto(`${base}/play`, { waitUntil: "networkidle" });
      await page.locator("#press-heading").scrollIntoViewIfNeeded();
      const poster = page.locator("[data-press=poster]");
      await poster.waitFor({ state: "visible", timeout: 20_000 });
      await assert.rejects(page.getByRole("status").textContent({ timeout: 3000 }), /strict mode violation/);
      const status = poster.locator("xpath=..").getByRole("status");
      assert.equal(await status.count(), 1);
      observed.pressStatus = await status.textContent();
      observed.globalStatusCount = await page.getByRole("status").count();
      observed.checks.push("old page-wide status locator fails; press-scoped locator resolves (real live-region negative control)");
    }
    observed.pageErrorsBeforeHops = errors.slice();
    assert.deepEqual(errors, []);
    await context.close();
    if (!live) {
      // Twelve explicit navigations, driven now; no timer, schedule, or soak is used as proof.
      for (let i = 0; i < 12; i++) {
        const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 } });
        const p = await ctx.newPage();
        const hopErrors = [];
        p.on("pageerror", error => hopErrors.push(error.message));
        const from = i % 2 ? "/work" : "/";
        await p.goto(`${base}${from}`, { waitUntil: "networkidle" });
        await p.keyboard.type("urashima", { delay: 30 });
        await p.waitForURL(`${base}/ryugu`, { waitUntil: "networkidle", timeout: 10_000 });
        assert.equal(await p.locator("h1").textContent(), "Ryugu-jo");
        observed.hops.push({ attempt: i + 1, from, errors: hopErrors });
        await ctx.close();
      }
      assert.deepEqual(observed.hops.flatMap(hop => hop.errors), [], "root-layout navigation emits an uncaught page error");
    }
  } finally {
    await browser?.close();
    if (process.env.QA_OUTPUT) writeFileSync(process.env.QA_OUTPUT, `${JSON.stringify(observed, null, 2)}\n`);
    console.log(JSON.stringify(observed));
  }
});
