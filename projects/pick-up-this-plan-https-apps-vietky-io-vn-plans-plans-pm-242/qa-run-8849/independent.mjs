// QA-owned observations, using real production HTTP, Chrome, CDP input and Postgres through e2e.mjs.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
import { test } from 'node:test';
const require = createRequire('/tmp/qa-8849-delivery/package.json');
const { chromium } = require('playwright-core');
const evidence = { fake: false, checks: [], errors: [], attempts: [] };
const base = process.env.BASE_URL;
const live = process.env.QA_LIVE === '1';

test('independent live HTTP, footer corruption, paused clock and touch drag audit', { timeout: 180000 }, async () => {
  const browser = await chromium.launch({ channel: 'chrome', env: { ...process.env, TMPDIR: '/tmp' } });
  try {
    evidence.browser = browser.version();
    evidence.live = live;
    evidence.health = await (await fetch(base + '/api/health')).json();
    const presence = await fetch(base + '/api/now-playing');
    assert.equal(presence.status, 200);
    assert.match(presence.headers.get('cache-control'), /no-store/);
    evidence.presence = await presence.json();
    const context = await browser.newContext({ viewport: { width: 1366, height: 900 } });
    const page = await context.newPage();
    page.on('pageerror', e => evidence.errors.push(e.message));
    assert.equal((await page.goto(base + '/projects', { waitUntil: 'networkidle' })).status(), 200);
    evidence.sha = await page.locator('meta[name="build-sha"]').getAttribute('content');
    assert.equal(evidence.sha, process.env.EXPECT_SHA);
    assert.equal(await page.locator('footer.end').count(), 1);
    const link = page.locator('footer.end [data-end-page="/work"]');
    const canonical = async () => assert.equal(await link.getAttribute('href'), '/work');
    await canonical();
    await link.evaluate(el => el.setAttribute('href', '/qa-corrupt'));
    await assert.rejects(canonical(), /qa-corrupt/);
    await link.evaluate(el => el.setAttribute('href', '/work'));
    await canonical();
    evidence.checks.push('canonical footer corruption detected, restored value passes');
    await link.click();
    await page.waitForURL(base + '/work', { waitUntil: 'networkidle' });
    assert.equal(await page.locator('main#main').count(), 1);
    evidence.checks.push('visitor follows footer Work link with one main landmark');
    if (!live) {
      await page.goto(base + '/projects', { waitUntil: 'networkidle' });
      await page.locator('[data-kame]').waitFor({ state: 'attached' });
      await page.clock.install();
      await page.clock.pauseAt(await page.evaluate(() => Date.now() + 100));
      await page.getByRole('button', { name: 'Hold to pet Kame', exact: true }).focus();
      await page.keyboard.down('Space');
      await page.clock.runFor(499);
      assert.notEqual(await page.locator('[data-kame]').getAttribute('data-state'), 'pet');
      await page.clock.runFor(1);
      assert.equal(await page.locator('[data-kame]').getAttribute('data-state'), 'pet');
      await page.keyboard.up('Space');
      await page.clock.resume();
      await page.keyboard.down('Space');
      await page.waitForTimeout(70);
      await page.clock.runFor(499);
      await assert.rejects(async () => assert.notEqual(await page.locator('[data-kame]').getAttribute('data-state'), 'pet'));
      await page.keyboard.up('Space');
      evidence.checks.push('paused hold is 499/500 ms; same not-pet assertion fails with flowing clock');
      for (const [index, blocked] of [false, true, false].entries()) {
        await page.evaluate(() => localStorage.removeItem('desk:v1'));
        await page.goto(base + '/desk', { waitUntil: 'networkidle' });
        await page.waitForFunction(() => [...document.querySelectorAll('.desk-item, .desk-bar button')].every(el => Object.keys(el).some(k => k.startsWith('__reactProps'))));
        const tape = page.locator('[data-desk-item="music"] .desk-tape');
        await tape.scrollIntoViewIfNeeded();
        const box = await tape.boundingBox();
        const events = [];
        const binding = `qaInput${index}`;
        await page.exposeFunction(binding, x => events.push(x));
        await page.evaluate(({ block, binding }) => {
          for (const type of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel']) document.addEventListener(type, e => window[binding]({ type, x: e.clientX, target: e.target.closest('[data-desk-item]')?.dataset.deskItem }), true);
          if (block) document.addEventListener('pointermove', e => e.stopImmediatePropagation(), true);
        }, { block: blocked, binding });
        const cdp = await context.newCDPSession(page);
        const x = box.x + box.width / 2, y = box.y + box.height / 2;
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] });
        for (let i = 1; i <= 10; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + i * 12, y, id: 1 }] });
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        await cdp.detach();
        const result = await page.evaluate(() => ({ x: parseFloat(document.querySelector('[data-desk-item="music"]').style.left) / 100, width: document.querySelector('.desk').getBoundingClientRect().width }));
        const check = async () => assert.ok(Math.abs(result.x - (0.3 + 120 / result.width)) < 0.00001, `touch drag: ${result.x}`);
        if (blocked) await assert.rejects(check());
        else await check();
        evidence.attempts.push({ blocked, result, events });
      }
      evidence.checks.push('real touch drag passes, blocked pointermove fails same displacement assertion, fresh page passes');
    }
    assert.deepEqual(evidence.errors, []);
    await context.close();
  } finally {
    await browser.close();
    writeFileSync(process.env.QA_OUTPUT, JSON.stringify(evidence, null, 2) + '\n');
  }
});
