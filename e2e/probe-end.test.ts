// Real production footer markup and the exact reader used by both probe-end paths.
import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { chromium, type Browser } from "playwright-core";
import { site } from "../content/site.ts";
import { endTitleText, inPage, VISIBLE_FOOTER } from "../scripts/probe-end-dom.mjs";

const BASE = process.env.BASE_URL ?? "http://localhost:4000";
let browser: Browser;
before(async () => {
  const env = { ...process.env, TMPDIR: "/tmp" };
  browser = await chromium.launch({ channel: "chrome", env });
});
after(async () => { await browser?.close(); });

for (const javaScriptEnabled of [true, false]) {
  test(`footer probe reads only the heading source (JavaScript ${javaScriptEnabled ? "on" : "off"})`, { timeout: 30_000 }, async () => {
    const context = await browser.newContext({ javaScriptEnabled });
    try {
      const page = await context.newPage();
      assert.equal((await page.goto(BASE, { waitUntil: "load" }))?.status(), 200);
      const heading = page.locator("footer.end h2#end-title");
      const readTitle = () => page.evaluate(inPage(endTitleText, javaScriptEnabled ? VISIBLE_FOOTER : 'document.querySelector("footer.end")'));
      assert.equal(await heading.locator(".riso-text > .riso-source").textContent(), site.end.title);
      assert.equal(await heading.locator('.riso-visual[aria-hidden="true"]').textContent(), site.end.title);
      assert.equal(await heading.textContent(), site.end.title.repeat(2), "the real nested Riso markup reproduces the old raw read");
      assert.equal(await readTitle(), site.end.title);

      // Correct decorative ink and an unrelated source must never mask a wrong heading source.
      await heading.locator(".riso-source").evaluate(el => { el.textContent = "Wrong title"; });
      await page.locator("footer.end").evaluate((footer, title) => {
        const decoy = document.createElement("span");
        decoy.className = "riso-source";
        decoy.textContent = title;
        footer.prepend(decoy);
      }, site.end.title);
      assert.equal(await readTitle(), "Wrong title");
      assert.notEqual(await readTitle(), site.end.title, "wrong source fails the probe's exact comparison");
      await heading.locator(".riso-source").evaluate(el => { el.textContent = ""; });
      assert.equal(await readTitle(), "", "an empty source cannot fall back to decorative ink");

      await heading.evaluate((el, title) => { el.textContent = `  ${title}  `; }, site.end.title);
      assert.equal(await readTitle(), site.end.title, "a plain heading still works");
      await heading.evaluate(el => el.remove());
      assert.equal(await readTitle(), null, "unrelated source text cannot replace a missing heading");
    } finally {
      await context.close();
    }
  });
}
