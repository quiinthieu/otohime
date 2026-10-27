// QA uses neither the delivered swipe helper nor its instrumentation/trace formatter.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(`${process.cwd()}/package.json`);
const { chromium } = require('playwright-core');
const base = process.env.BASE_URL ?? 'https://otohime.dev';
const browser = await chromium.launch({ channel: 'chrome', env: { ...process.env, TMPDIR: '/tmp' } });
console.log(JSON.stringify({ base, browser: browser.version(), node: process.version, playwright: require('playwright-core/package.json').version }));
try {
  for (const mode of ['wide-1', 'wide-2', 'wide-3', 'tablet', 'narrow', 'missed-tape']) {
    const stacked = mode === 'tablet' || mode === 'narrow';
    const context = await browser.newContext({ viewport: { width: mode === 'tablet' ? 1024 : mode === 'narrow' ? 600 : 1366, height: 1366 }, hasTouch: mode === 'tablet', isMobile: mode === 'tablet', reducedMotion: 'reduce' });
    try {
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.addInitScript(() => {
        window.qaEvents = [];
        for (const type of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel']) document.addEventListener(type, e => {
          window.qaEvents.push({ type, x: e.clientX, y: e.clientY, target: e.target.className });
          if (window.qaEvents.length > 40) window.qaEvents.shift();
        }, true);
      });
      assert.equal((await page.goto(`${base}/desk`, { waitUntil: 'load' })).status(), 200);
      const build = await page.locator('meta[name="build-sha"]').getAttribute('content');
      await page.waitForFunction(() => [...document.querySelectorAll('.desk-item, .desk-bar button')].every(el => Object.keys(el).some(k => k.startsWith('__reactProps'))));
      const tape = page.locator('[data-desk-item="music"] .desk-tape');
      await tape.scrollIntoViewIfNeeded();
      const geometry = await tape.evaluate(async el => {
        await document.fonts.ready;
        let previous = '';
        for (let i = 0; i < 120; i++) {
          await new Promise(requestAnimationFrame);
          const rect = el.getBoundingClientRect();
          const key = JSON.stringify(rect.toJSON());
          if (previous === key) {
            const x = rect.x + rect.width / 2, y = rect.y + rect.height / 2;
            return { x, y, hit: document.elementFromPoint(x, y) === el, target: document.elementFromPoint(x, y)?.outerHTML.slice(0,400), width: document.querySelector('.desk').getBoundingClientRect().width };
          }
          previous = key;
        }
        throw Error('tape geometry never settled');
      });
      assert.equal(geometry.hit, true, JSON.stringify({ mode, geometry }));
      const initial = await page.locator('[data-desk-item="music"]').evaluate(el => parseFloat(el.style.left));
      const cdp = await context.newCDPSession(page);
      const missed = mode === 'missed-tape';
      const x = missed ? 5 : geometry.x, y = missed ? 5 : geometry.y;
      const touch = (type, dx = 0) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x: x + dx, y, id: 1 }] });
      await touch('touchStart');
      await touch('touchMove', 12);
      if (!stacked && !missed) await page.locator('[data-desk-item="music"][data-dragging]').waitFor({ state: 'attached', timeout: 5000 });
      for (let dx = 24; dx <= 120; dx += 12) await touch('touchMove', dx);
      await touch('touchEnd');
      await cdp.detach();
      await page.locator('[data-desk-item="music"][data-dragging]').waitFor({ state: 'detached', timeout: 5000 });
      const result = await page.evaluate(() => ({ raw: localStorage.getItem('desk:v1'), left: parseFloat(document.querySelector('[data-desk-item="music"]').style.left), events: window.qaEvents }));
      if (stacked || missed) {
        assert.equal(result.raw, null, JSON.stringify(result));
        assert.equal(result.left, initial);
        // Mutation control: applying the positive drag expectation here must fail.
        assert.throws(() => assert.ok(Math.abs(result.left - initial - 120 / geometry.width * 100) < 0.01, 'expected 120px committed drag'), /expected 120px/);
      } else {
        assert.ok(Math.abs(result.left - initial - 120 / geometry.width * 100) < 0.01, JSON.stringify(result));
        assert.ok(result.raw);
        await page.reload({ waitUntil: 'load' });
        await page.waitForFunction(value => localStorage.getItem('desk:v1') === value && parseFloat(document.querySelector('[data-desk-item="music"]').style.left) !== 30, result.raw);
        assert.equal(await page.locator('[data-desk-item="music"]').evaluate(el => parseFloat(el.style.left)), result.left);
      }
      assert.deepEqual(errors, []);
      console.log(JSON.stringify({ mode, build, geometry, initial, ...result, negativeControl: stacked || missed ? 'positive drag assertion rejected' : null }));
    } finally { await context.close(); }
  }
} finally { await browser.close(); }
