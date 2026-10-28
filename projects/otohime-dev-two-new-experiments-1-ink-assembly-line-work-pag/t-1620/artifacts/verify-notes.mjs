// Checkout-only verification against the real locked Next/React production build.
// Run with Node's --experimental-strip-types and BASE_URL pointing at next start.
import assert from "node:assert/strict";
import { chromium } from "playwright-core";
import { site } from "../../../../content/site.ts";
import { stableSurfaceId } from "../../../../lib/tactile.ts";

const base = new URL(process.env.BASE_URL ?? "http://localhost:4316");
assert.ok(["localhost", "127.0.0.1"].includes(base.hostname), "checkout verification uses a local server");
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  for (const profile of [
    { name: "desktop", viewport: { width: 1366, height: 900 } },
    { name: "phone-reduced-motion", viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: "reduce" },
    { name: "no-javascript", viewport: { width: 1366, height: 900 }, javaScriptEnabled: false },
  ]) {
    const { name, ...options } = profile;
    const context = await browser.newContext(options);
    const page = await context.newPage();
    page.setDefaultTimeout(10_000);
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    for (const [index, note] of site.notes.entries()) {
      const listResponse = await page.goto(new URL("/notes", base).href);
      assert.equal(listResponse.status(), 200);
      const sheets = page.locator("main ol > li[data-paper-id]");
      assert.equal(await sheets.count(), 3);
      for (const [i, original] of site.notes.entries()) {
        const sheet = sheets.nth(i);
        assert.equal(await sheet.locator("time").textContent(), original.date);
        assert.equal(await sheet.locator("h2 .riso-source").textContent(), original.title);
        assert.equal(await sheet.locator("p").textContent(), original.body);
        assert.equal(await sheet.getAttribute("data-paper-id"), stableSurfaceId("note", original.date));
        assert.equal(await sheet.getAttribute("data-tossable"), "true");
      }
      const link = page.getByRole("link", { name: note.title, exact: true });
      assert.equal(await link.getAttribute("href"), `/notes/${note.slug}`);
      await link.scrollIntoViewIfNeeded();
      const bounds = await link.boundingBox();
      assert.ok(bounds && bounds.x >= 0 && bounds.x + bounds.width <= profile.viewport.width);
      if (index === 0 && name === "desktop") {
        await link.focus();
        await page.keyboard.press("Enter");
      } else await link.click();
      await page.waitForURL(new URL(`/notes/${note.slug}`, base).href);
      const title = page.locator("article h1 .riso-source");
      await title.waitFor({ state: "visible" });
      assert.equal(await title.textContent(), note.title);
      assert.equal(await page.locator("article time").getAttribute("datetime"), note.date);
      assert.equal(await page.locator("article > p").textContent(), note.body);
      assert.deepEqual(await page.getByRole("list", { name: "Tags", exact: true }).locator("li").allTextContents(), note.tags.map((tag) => `#${tag}`));
      assert.equal(await page.title(), `${note.title} · Otohime`);
      assert.equal(await page.locator('meta[name="description"]').getAttribute("content"), note.body);
      const back = page.getByRole("link", { name: "All notes" });
      await back.click();
      await page.waitForURL(new URL("/notes", base).href);
      assert.equal(await page.locator("main ol > li[data-paper-id]").count(), 3);

      // Direct addresses also work, independently of a client-side navigation.
      const direct = await page.goto(new URL(`/notes/${note.slug}`, base).href);
      assert.equal(direct.status(), 200);
      assert.equal(await page.locator("article > p").textContent(), note.body);
    }
    // Negative controls must show the existing not-found UI, never another note.
    for (const slug of ["missing-note", "constructor"]) {
      const response = await page.goto(new URL(`/notes/${slug}`, base).href);
      if (options.javaScriptEnabled !== false) {
        await page.getByRole("heading", { name: "This page got lost", exact: true }).waitFor({ state: "visible" });
      } else {
        // Existing Next root-boundary limitation (app/global-not-found.tsx):
        // resource notFound errors return an empty error shell without JS.
        assert.equal(response.status(), 404);
        console.log(`${name}: unknown ${slug} has the existing blank Next error shell; UI requires JS`);
      }
      assert.equal(await page.locator("article").count(), 0);
      assert.match(await page.locator('meta[name="robots"]').first().getAttribute("content"), /noindex/);
      // Cache Components can flush the shared shell before notFound; record its status.
      console.log(`${name}: unknown ${slug} rendered not-found/noindex (HTTP ${response.status()})`);
    }
    assert.deepEqual(errors, [], `${name}: no browser runtime errors`);
    console.log(`${name}: exact copy, all links, direct URLs, metadata, tags, paper surfaces and back links passed`);
    await context.close();
  }
} finally {
  await browser.close();
}
