import assert from "node:assert/strict";
import { chromium } from "playwright-core";

// Fixed against the three notes as published before t-1620, independent of site.ts.
const notes = [
  ["backfills-are-a-feature", "2026-10-12", "Backfills are a feature", "Two years of events, replayed in an afternoon, because the jobs were idempotent from day one.", ["data-engineering", "backfills", "idempotency"]],
  ["on-twos", "2026-09-28", "On twos", "The figures here animate at twelve frames a second, like hand-drawn film. Smoother looked worse.", ["animation", "hand-drawn"]],
  ["the-contract-caught-it", "2026-09-03", "The contract caught it", "A data contract stopped a breaking change before anyone opened a dashboard. First time. Worth it.", ["data-engineering", "data-contracts"]],
];

const base = new URL(process.env.BASE_URL ?? "http://localhost:4325");
const expectedSha = process.env.EXPECT_SHA;
const browser = await chromium.launch({ headless: true });
try {
  for (const [profile, options] of [
    ["desktop", { viewport: { width: 1280, height: 800 } }],
    ["mobile-reduced-motion", { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: "reduce" }],
    ["no-js", { viewport: { width: 1280, height: 800 }, javaScriptEnabled: false }],
  ]) {
    const context = await browser.newContext(options);
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const list = await page.goto(new URL("/notes", base).href);
    assert.equal(list.status(), 200, `${profile}: list status`);
    if (expectedSha) assert.equal(await page.locator('meta[name="build-sha"]').getAttribute("content"), expectedSha, `${profile}: build identity`);
    assert.equal(await page.locator("main ol > li").count(), 3, `${profile}: note count`);
    for (const [index, [slug, date, title, body, tags]] of notes.entries()) {
      const item = page.locator("main ol > li").filter({ hasText: title });
      assert.equal(await item.count(), 1, `${profile}: ${title} listed once`);
      assert.equal(await item.locator("time").getAttribute("datetime"), date);
      assert.equal(await item.locator("p.text-muted").textContent(), body);
      const link = item.getByRole("link", { name: title, exact: true });
      assert.equal(await link.getAttribute("href"), `/notes/${slug}`);
      if (index === 0 && profile === "desktop") {
        await link.focus();
        await page.keyboard.press("Enter");
      } else await link.click();
      await page.waitForURL(new URL(`/notes/${slug}`, base).href);
      const article = page.locator("article").filter({ has: page.getByRole("heading", { name: title, exact: true }) });
      await article.waitFor({ state: "visible" });
      assert.equal(await article.locator("h1 .riso-source").textContent(), title);
      assert.equal(await article.locator("time").getAttribute("datetime"), date);
      assert.equal(await article.locator(":scope > p").textContent(), body);
      assert.deepEqual(await article.getByRole("list", { name: "Tags" }).locator("li").allTextContents(), tags.map((tag) => `#${tag}`));
      await page.waitForFunction((expected) => document.title === expected, `${title} · Otohime`);
      assert.equal(await page.title(), `${title} · Otohime`);
      assert.equal(await page.locator('meta[name="description"]').getAttribute("content"), body);
      await page.getByRole("link", { name: "All notes" }).click();
      await page.waitForURL(new URL("/notes", base).href);
      const direct = await page.goto(new URL(`/notes/${slug}`, base).href);
      assert.equal(direct.status(), 200);
      assert.equal(await page.locator("article > p").textContent(), body);
      await page.goto(new URL("/notes", base).href);
    }
    // A reserved-like slug must never resolve to another note.
    const missing = await page.goto(new URL("/notes/constructor", base).href);
    assert.equal(await page.locator("article").count(), 0, `${profile}: unknown slug did not open a note`);
    assert.match(await page.locator('meta[name="robots"]').first().getAttribute("content"), /noindex/);
    if (profile !== "no-js") assert.equal(await page.getByRole("heading", { name: "This page got lost" }).count(), 1);
    else assert.equal(missing.status(), 404);
    assert.deepEqual(errors, [], `${profile}: runtime errors`);
    console.log(`${profile}: three exact notes, links, details, tags, back navigation, and unknown-slug control passed`);
    await context.close();
  }
} finally {
  await browser.close();
}
