import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chromium } from 'playwright-core';

// Independent QA: real context loss and JavaScript-disabled delivery, rather than
// reproducing the supplied getContext stub and requestAnimationFrame counter.
test('palace survives real GPU context loss; plain entry links work without JavaScript', async () => {
  const base = process.env.BASE_URL;
  assert.ok(base);
  const browser = await chromium.launch({ channel: 'chrome', env: { ...process.env, TMPDIR: '/tmp' }, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
  try {
    const live = await browser.newContext();
    const page = await live.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    assert.equal((await page.goto(`${base}/ryugu`)).status(), 200);
    await page.waitForFunction(() => document.querySelector('.sea')?.dataset.water === 'live');
    const gpu = await page.locator('canvas').evaluate(canvas => {
      const gl = canvas.getContext('webgl');
      const lose = gl?.getExtension('WEBGL_lose_context');
      if (!lose) throw new Error('Real context-loss extension unavailable');
      const renderer = gl.getParameter(gl.RENDERER);
      lose.loseContext();
      return renderer;
    });
    await page.waitForFunction(() => document.querySelector('.sea')?.dataset.water === 'static');
    assert.equal(await page.locator('.sea-water').evaluate(el => getComputedStyle(el).opacity), '0');
    assert.equal(await page.locator('.sea-still .caustic').count(), 1);
    const before = await page.locator('[data-fish]').evaluateAll(els => els.map(el => el.getAttribute('transform')));
    // A fixed rendering interval observes the response to our context-loss action.
    await page.waitForTimeout(250);
    assert.deepEqual(await page.locator('[data-fish]').evaluateAll(els => els.map(el => el.getAttribute('transform'))), before);
    assert.deepEqual(errors, []);
    await live.close();

    const staticContext = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 }, hasTouch: true });
    const staticPage = await staticContext.newPage();
    await staticPage.goto(`${base}/`);
    await staticPage.locator('[data-pocket-ryugu]').click();
    await staticPage.waitForURL(`${base}/ryugu`);
    assert.equal(await staticPage.locator('.sea').getAttribute('data-water'), 'served');
    assert.equal(await staticPage.locator('[data-fish]').count(), 9);
    assert.equal(await staticPage.locator('link[rel=stylesheet]').count(), 1);
    assert.equal(await staticPage.locator('h1').textContent(), 'Ryugu-jo');
    await staticPage.goto(`${base}/notes`);
    await staticPage.locator('[data-end-ryugu]').tap();
    await staticPage.waitForURL(`${base}/ryugu`);
    // Negative control: a nonexistent sibling must not be served as the palace.
    assert.equal((await staticPage.goto(`${base}/ryugu-qa-missing`)).status(), 404);
    await staticContext.close();
    console.log(JSON.stringify({ independent: 'pass', gpu, realContextLoss: 'static', noJavaScript: ['Pocket', 'footer'], negativeControl: 'nonexistent route returns 404' }));
  } finally {
    await browser.close();
  }
});
