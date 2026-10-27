// Runs the Footer Chromium probe's own heading expressions (scripts/probe-end-dom.mjs) in real Chrome against
// RisoText-shaped footers styled by the real components/riso-heading.css.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { after, before, test } from "node:test";
import { site } from "../content/site.ts";
import { endTitleBounds, endTitleText, inPage, settleEndTitle, VISIBLE_FOOTER } from "./probe-end-dom.mjs";
import { launchBrowser } from "./probe-browser.mjs";

const css = readFileSync(resolve(import.meta.dirname, "../components/riso-heading.css"), "utf8");
const TITLE = site.end.title;
const esc = (s) => s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll("'", "&#x27;");

// Mirrors RisoText: one plain source, then aria-hidden word/character plates whose ::before/::after carry the copy.
function riso(source, { visual = TITLE, state = "settled", sourceClass = "riso-source " } = {}) {
  const words = visual.split(/(\s+)/).map((w) =>
    /^\s+$/.test(w) || !w
      ? w
      : `<span class="riso-word">${[...w].map((c, i) => `<span class="riso-char" data-char="${esc(c)}" style="--riso-x2:1px;--riso-y2:0px;--riso-x3:-1px;--riso-y3:1px;--riso-delay:${i * 20}ms"><span class="riso-anchor">${esc(c)}</span></span>`).join("")}</span>`,
  );
  return `<span class="riso-text" data-riso-state="${state}"><span class="${sourceClass}">${esc(source)}</span><span class="riso-visual" aria-hidden="true">${words.join("")}</span></span>`;
}
const footer = (heading, { width = 600, font = 32 } = {}) =>
  `<!doctype html><style>${css} body{margin:0;font:${font}px/1.2 sans-serif} .end-copy{width:${width}px;margin:20px}</style>` +
  `<footer class="end"><div class="end-copy">${heading}</div></footer>`;

let browser;
before(async () => {
  // Chrome's profile sockets live under TMPDIR; deep lease paths exceed the socket path limit.
  if ((process.env.TMPDIR ?? "").length > 48) process.env.TMPDIR = "/tmp";
  browser = await launchBrowser({ log: () => {} });
});
after(() => browser?.close());

async function inChrome(html, fn) {
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  try {
    await page.setContent(html);
    return await fn(page);
  } finally {
    await page.close();
  }
}
const title = (html, expr = VISIBLE_FOOTER) => inChrome(html, (page) => page.evaluate(inPage(endTitleText, expr)));

test("probe title: the plain Riso source inside h2#end-title, never the decorative plates", async () => {
  const h2 = (inner, id = "end-title") => footer(`<h2 id="${id}" class="end-title"><span class="end-title-text">${inner}</span></h2>`);
  assert.equal(await title(h2(riso(TITLE))), TITLE);
  // The probe's no-JS footer expression reads the same heading.
  assert.equal(await title(h2(riso(TITLE)), `document.querySelector("footer.end")`), TITLE);
  assert.equal(await title(h2(riso(TITLE, { sourceClass: "plain riso-source footer-copy" }))), TITLE);
  assert.equal(await title(h2(riso(TITLE, { visual: "decorative ink" }))), TITLE);
  assert.equal(await title(h2(esc(TITLE))), TITLE, "a plain heading keeps its own text");
  // The old whole-heading textContent is the defect this replaces: it repeats the title.
  const whole = await inChrome(h2(riso(TITLE)), (page) => page.evaluate(() => document.querySelector("h2#end-title").textContent.trim()));
  assert.equal(whole, `${TITLE}${TITLE}`);

  // Negative controls: none of these may read as the canonical title.
  assert.equal(await title(h2(riso("Wrong accessible source"))), "Wrong accessible source");
  assert.notEqual(await title(h2(riso(`${TITLE} extra`))), TITLE);
  assert.equal(await title(h2(riso(TITLE), "another-title")), null);
  assert.notEqual(await title(h2(riso(TITLE, { sourceClass: "riso-source-imitation" }))), TITLE);
  assert.notEqual(await title(footer(`<span class="riso-source">${esc(TITLE)}</span><h2 id="end-title">${riso("Wrong source")}</h2>`)), TITLE);
  assert.notEqual(await title(h2(riso("Wrong") + riso(TITLE))), TITLE, "two sources cannot pick the convenient one");
});

test("probe bounds: measured after the one-shot ink lands, from the visible glyphs", async () => {
  const html = footer(`<h2 id="end-title" class="end-title">${riso(TITLE, { state: "settled" })}</h2>`);
  const settled = await inChrome(html, (page) => page.evaluate(inPage(endTitleBounds, VISIBLE_FOOTER, 1366)));
  assert.equal(settled.ok, true, JSON.stringify(settled));
  assert.ok(settled.text.lines >= 1 && settled.text.right > settled.text.left, JSON.stringify(settled));

  // A printed heading animates its plates; settleEndTitle waits for that finite entry and reports none pending.
  const printed = await inChrome(
    footer(`<h2 id="end-title" class="end-title">${riso(TITLE, { state: "ready" })}</h2>`),
    async (page) => {
      const waiting = page.evaluate(inPage(settleEndTitle, VISIBLE_FOOTER, 3000));
      await page.evaluate(() => {
        document.querySelector(".riso-text").dataset.risoState = "printed";
      });
      const running = await page.evaluate(() => document.querySelector("h2").getAnimations({ subtree: true }).length);
      return { settle: await waiting, running, bounds: await page.evaluate(inPage(endTitleBounds, VISIBLE_FOOTER, 1366)) };
    },
  );
  assert.ok(printed.running > 0, "the fixture really animates the plates");
  // Frozen at its first frame, the plates hang 12px past the line ends and the heading scrolls: decorative ink,
  // reported as plateOverflow, while the glyphs that carry the text stay inside. The old scrollWidth check failed here.
  const midFlight = await inChrome(
    footer(`<h2 id="end-title" class="end-title">${riso(TITLE, { state: "printed" })}</h2>`),
    (page) =>
      page.evaluate((expr) => {
        for (const a of document.querySelector("h2").getAnimations({ subtree: true })) a.pause();
        return eval(expr);
      }, inPage(endTitleBounds, VISIBLE_FOOTER, 1366)),
  );
  assert.equal(midFlight.noScroll, false, JSON.stringify(midFlight));
  assert.equal(midFlight.textInside, true, "the visible glyphs themselves never left the heading");
  assert.ok(midFlight.plateOverflow > 0 && midFlight.ok === true, JSON.stringify(midFlight));
  assert.equal(printed.settle.pending, 0, JSON.stringify(printed));
  assert.equal(printed.bounds.ok, true, JSON.stringify(printed));

  // Negative controls: real overflow still fails, with metrics, whether it scrolls or spills past the viewport.
  const narrow = await inChrome(
    footer(`<h2 id="end-title" class="end-title" style="white-space:nowrap">Averyveryverylongunbreakabletitle</h2>`, { width: 120 }),
    (page) => page.evaluate(inPage(endTitleBounds, VISIBLE_FOOTER, 1366)),
  );
  assert.equal(narrow.ok, false, JSON.stringify(narrow));
  assert.ok(narrow.scrollWidth > narrow.clientWidth, JSON.stringify(narrow));
  const offscreen = await inChrome(
    footer(`<h2 id="end-title" class="end-title" style="margin-left:-200px">${esc(TITLE)}</h2>`),
    (page) => page.evaluate(inPage(endTitleBounds, VISIBLE_FOOTER, 1366)),
  );
  assert.equal(offscreen.ok, false, JSON.stringify(offscreen));
  assert.equal(offscreen.textInside, false);
  // The same for a Riso heading: decorative slack never excuses glyphs that leave the viewport or the heading.
  const risoOffscreen = await inChrome(
    footer(`<h2 id="end-title" class="end-title" style="margin-left:-200px">${riso(TITLE)}</h2>`),
    (page) => page.evaluate(inPage(endTitleBounds, VISIBLE_FOOTER, 1366)),
  );
  assert.equal(risoOffscreen.ok, false, JSON.stringify(risoOffscreen));
  const risoSpill = await inChrome(
    footer(`<style>.riso-word{max-width:none}.riso-text{white-space:nowrap}</style><h2 id="end-title" class="end-title" style="width:80px">${riso("Averyveryverylongunbreakabletitle")}</h2>`),
    (page) => page.evaluate(inPage(endTitleBounds, VISIBLE_FOOTER, 1366)),
  );
  assert.equal(risoSpill.ok, false, JSON.stringify(risoSpill));
  assert.equal(risoSpill.textInside, false, JSON.stringify(risoSpill));
  const missing = await inChrome(footer(`<h2 id="other">${esc(TITLE)}</h2>`), (page) => page.evaluate(inPage(endTitleBounds, VISIBLE_FOOTER, 1366)));
  assert.deepEqual(missing, { ok: false, reason: "missing h2#end-title" });
});
