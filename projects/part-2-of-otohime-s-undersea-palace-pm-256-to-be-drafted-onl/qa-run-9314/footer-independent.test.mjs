// QA observation independent of e2e/bottle-ui.test.ts. Actual Chrome/CSS geometry.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chromium } from 'playwright-core';
import { readFileSync } from 'node:fs';

test('independent footer band at 200% and wrong-padding negative control', async () => {
  const browser = await chromium.launch({ channel: 'chrome', env: { ...process.env, TMPDIR: '/tmp' } });
  try {
    const page = await browser.newPage({ viewport: { width: 768, height: 1024 }, reducedMotion: 'reduce' });
    assert.equal((await page.goto(process.env.BASE_URL + '/')).status(), 200);
    const button = page.locator('[data-bottle-entry="footer"]');
    await button.waitFor();
    await page.locator('footer.end').scrollIntoViewIfNeeded();
    const read = () => page.evaluate(() => {
      const root = parseFloat(getComputedStyle(document.documentElement).fontSize);
      const footer = document.querySelector('footer.end');
      const inner = document.querySelector('.end-inner');
      const scene = document.querySelector('.end-canvas');
      const bottle = document.querySelector('[data-bottle-entry="footer"]');
      return { root, padding: parseFloat(getComputedStyle(inner).paddingTop),
        border: parseFloat(getComputedStyle(footer).borderTopWidth) + parseFloat(getComputedStyle(footer, '::before').borderTopWidth),
        scene: scene.getBoundingClientRect().top - footer.getBoundingClientRect().top,
        sceneHeight: scene.getBoundingClientRect().height, footerHeight: footer.getBoundingClientRect().height,
        font: parseFloat(getComputedStyle(bottle).fontSize) };
    });
    const ready = () => page.waitForFunction(() => {
      const root = parseFloat(getComputedStyle(document.documentElement).fontSize);
      return Math.abs(parseFloat(getComputedStyle(document.querySelector('.end-inner')).paddingTop) - 3.75 * root) < 0.01;
    }, null, { timeout: 3000 });
    const assertBand = value => {
      assert.ok(Math.abs(value.padding - value.root * 3.75) < 0.01, 'actual dependent rem padding');
      assert.ok(Math.abs(value.scene - value.padding - value.border) <= 1, 'scene begins after the band and borders');
    };
    await ready(); const normal = await read(); assertBand(normal);
    await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
    await page.waitForFunction(root => parseFloat(getComputedStyle(document.documentElement).fontSize) === root * 2, normal.root);
    await ready(); const scaled = await read(); assertBand(scaled);
    await page.locator("footer.end").screenshot({ path: "/tmp/otohime-qa-9314/footer-200.png" });
    const comparisons = [];
    for (const font of [24, 32]) {
      await button.evaluate((el, px) => { el.style.fontSize = px + 'px'; }, font);
      await page.waitForFunction(px => parseFloat(getComputedStyle(document.querySelector('[data-bottle-entry="footer"]')).fontSize) === px, font);
      await ready(); const value = await read(); assertBand(value);
      for (const key of ['scene', 'sceneHeight', 'footerHeight']) assert.ok(Math.abs(value[key] - scaled[key]) <= 1, key + ': ' + JSON.stringify({ value, scaled }));
      comparisons.push(value);
    }
    await page.locator('.end-inner').evaluate(el => { el.style.paddingBlockStart = '2.5rem'; });
    await page.waitForFunction(() => Math.abs(parseFloat(getComputedStyle(document.querySelector('.end-inner')).paddingTop) - 2.5 * parseFloat(getComputedStyle(document.documentElement).fontSize)) < 0.01);
    const wrong = await read();
    assert.throws(() => assertBand(wrong), /actual dependent rem padding/);
    console.log(JSON.stringify({ kind: 'independent-footer', normal, scaled, comparisons, wrong,
      negativeControlRejected: true, buildId: readFileSync('.next/BUILD_ID', 'utf8').trim(), chrome: browser.version() }));
  } finally { await browser.close(); }
});
