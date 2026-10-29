// Runs the Footer Chromium probe's own heading expressions (scripts/probe-end-dom.mjs) in real Chrome against
// RisoText-shaped footers styled by the real components/riso-heading.css.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { after, before, test } from "node:test";
import { site } from "../content/site.ts";
import { endSvgStructure, endTitleBounds, endTitleText, inPage, settleEndTitle, settleEndEntrance, VISIBLE_FOOTER } from "./probe-end-dom.mjs";
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

test("probe entrance: waits for delayed real animation starts and rejects missing or replayed entries", async () => {
  const html = `<style>@keyframes enter{from{opacity:.1}to{opacity:1}} .entry{animation:enter .05s both} .late{animation-name:none}</style>
    <footer class="end" data-seen="true"><div data-end-stage data-active="true"></div>
    <i class="end-cloud"></i><i class="end-star"></i><i class="end-lamp"></i><i class="end-packet"></i>
    ${Array.from({ length: 6 }, (_, i) => `<span class="entry ${i === 5 ? "late" : ""}">ink</span>`).join("")}</footer>`;
  await inChrome(html.replaceAll('class="entry ', 'class="pending '), async (page) => {
    await page.evaluate(() => {
      window.__endEntranceStarts = 0;
      addEventListener("animationstart", () => window.__endEntranceStarts++);
      document.querySelectorAll(".pending").forEach((el) => el.classList.replace("pending", "entry"));
    });
    await page.waitForFunction(() => window.__endEntranceStarts === 5);
    await page.waitForTimeout(950);
    assert.equal(await page.evaluate(() => window.__endEntranceStarts), 5, "the former fixed checkpoint misses the sixth start");
    const missing = await page.evaluate(inPage(settleEndEntrance, VISIBLE_FOOTER, 100));
    assert.equal(missing.starts, 5, "a missing animation remains a failure after the bound");
    await page.evaluate(() => { setTimeout(() => document.querySelector(".late").classList.remove("late"), 80); });
    const settled = await page.evaluate(inPage(settleEndEntrance, VISIBLE_FOOTER, 3000));
    assert.equal(settled.starts, 6);
    assert.equal(settled.seen, "true");
    assert.equal(settled.active, "true");
    assert.ok(settled.playStates.every((s) => s === "running"));
    await page.evaluate(() => { document.querySelector(".end-cloud").style.animationPlayState = "paused"; });
    const paused = await page.evaluate(inPage(settleEndEntrance, VISIBLE_FOOTER, 100));
    assert.ok(paused.playStates.includes("paused"), "paused ambient motion remains a failure");
    await page.evaluate(() => {
      document.querySelector(".end-cloud").style.animationPlayState = "running";
      const entry = document.querySelector(".entry");
      entry.style.animationName = "none";
      entry.getBoundingClientRect();
      entry.style.animationName = "enter";
    });
    await page.waitForFunction(() => window.__endEntranceStarts === 7);
    const replayed = await page.evaluate(inPage(settleEndEntrance, VISIBLE_FOOTER, 100));
    assert.equal(replayed.starts, 7, "a real replay must not settle as six");
  });
});

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


test("probe SVG inventory: one accessible basket, three original hidden layers and the exact wave, with no-JS negatives", async () => {
  const ink = '<svg class="figure end-svg end-ink" aria-hidden="true"></svg>';
  const sky = '<svg class="figure end-svg end-sky" aria-hidden="true"></svg>';
  const basket = '<svg data-paper-basket="" class="paper-basket" role="img" aria-label="Wastepaper basket"></svg>';
  const wave = '<svg class="end-wave" viewBox="0 0 1000 16" preserveAspectRatio="none" aria-hidden="true"><path d="M0 8Q25 0 50 8T100 8T150 8T200 8T250 8T300 8T350 8T400 8T450 8T500 8T550 8T600 8T650 8T700 8T750 8T800 8T850 8T900 8T950 8T1000 8V16H0Z" /></svg>';
  const html = `<footer class="end"><div class="end-ground-wrap">${ink}</div><div class="end-console-wrap">${ink}</div>${sky}<div data-paper-basket-slot>${basket}</div><div data-end-waterline>${wave}</div></footer>`;
  for (const javaScriptEnabled of [true, false]) {
    const context = await browser.newContext({ javaScriptEnabled });
    try {
      const page = await context.newPage();
      const read = () => page.evaluate(inPage(endSvgStructure, 'document.querySelector("footer.end")'));
      await page.setContent(html);
      assert.equal((await read()).ok, true);
      const invalid = [
        html.replace(basket, ''), html.replace('aria-label="Wastepaper basket"', ''), html.replace(basket, basket + basket),
        html.replace('role="img"', 'role="presentation"'), html.replace('class="paper-basket"', 'class="paper-basket" aria-hidden="true"'),
        html.replace(ink, ''), html.replace('aria-hidden="true"', ''), html.replace(sky, ink),
        html.replace('end-ground-wrap', 'unrelated'), html.replace(sky, sky + '<svg aria-hidden="true"></svg>'),
        html.replace(wave, ''), html.replace(wave, wave + wave), html.replace('end-wave', 'wrong-wave'),
        html.replace('1000 16', '1000 20'), html.replace('M0 8Q25', 'M0 9Q25'),
        html.replace(wave, wave.replace('aria-hidden="true"', '')),
      ];
      for (const broken of invalid) {
        await page.setContent(broken);
        const result = await read();
        assert.equal(result.ok, false, JSON.stringify({ javaScriptEnabled, result, broken }));
      }
    } finally { await context.close(); }
  }
});
