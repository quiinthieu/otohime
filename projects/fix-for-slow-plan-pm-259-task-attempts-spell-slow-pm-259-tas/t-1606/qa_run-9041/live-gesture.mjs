// Independent QA path: no import of e2e/desk.test.ts or its swipe helper.
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { formatTrace, traceOf } from '../../../../scripts/e2e-gesture-trace.ts';

const base = process.env.BASE_URL ?? 'https://otohime.dev';
const browser = await chromium.launch({ channel: 'chrome', env: { ...process.env, TMPDIR: '/tmp' } });
const results = [];
try {
  for (const tablet of [false, false, false, true]) {
    const context = await browser.newContext({
      viewport: tablet ? { width: 1024, height: 1366 } : { width: 1366, height: 900 },
      hasTouch: tablet, isMobile: tablet,
    });
    const page = await context.newPage();
    await page.addInitScript(() => {
      window.qaEvents = [];
      for (const type of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel']) {
        document.addEventListener(type, e => {
          window.qaEvents.push({ type, t: e.timeStamp, x: e.clientX, y: e.clientY,
            pointerId: e.pointerId, pointerType: e.pointerType,
            target: e.target instanceof Element ? e.target.tagName.toLowerCase() + '.' + e.target.className : '',
            dragging: e.target instanceof Element && !!e.target.closest('[data-dragging]') });
          if (window.qaEvents.length > 40) window.qaEvents.shift();
        }, true);
      }
    });
    assert.equal((await page.goto(base + '/desk', { waitUntil: 'load' })).status(), 200);
    await page.waitForFunction(() => {
      const item = document.querySelector('[data-desk-item="music"]');
      return item && Object.keys(item).some(k => k.startsWith('__reactProps'));
    });
    const tape = page.locator('[data-desk-item="music"] .desk-tape');
    await tape.scrollIntoViewIfNeeded();
    const point = await tape.evaluate(async el => {
      const frame = () => new Promise(resolve => requestAnimationFrame(resolve));
      for (let i = 0; i < 120; i++) {
        const a = el.getBoundingClientRect().toJSON();
        await frame(); await frame();
        const b = el.getBoundingClientRect().toJSON();
        if (JSON.stringify(a) !== JSON.stringify(b)) continue;
        const x = b.x + b.width / 2, y = b.y + b.height / 2;
        if (document.elementFromPoint(x, y) === el) return { x, y };
      }
      throw new Error('tape did not settle at a hittable point');
    });
    const size = await page.locator('.desk').evaluate(el => el.getBoundingClientRect().width);
    const start = await page.locator('[data-desk-item="music"]').evaluate(el => parseFloat(el.style.left) / 100);
    const cdp = await context.newCDPSession(page);
    const send = (type, dx) => cdp.send('Input.dispatchTouchEvent', {
      type, touchPoints: type === 'touchEnd' ? [] : [{ x: point.x + dx, y: point.y, id: 1 }],
    });
    await send('touchStart', 0);
    await send('touchMove', 12);
    let negativeControl = null;
    if (tablet) {
      try {
        await page.locator('[data-desk-item="music"][data-dragging]').waitFor({ state: 'attached', timeout: 700 });
      } catch {
        negativeControl = formatTrace(traceOf(await page.evaluate(() => window.qaEvents)));
      }
      assert.ok(negativeControl?.includes('pointerdown') && negativeControl.includes('pointermove'),
        'requiring a tablet drag must fail with the real pointer trace');
    } else {
      await page.locator('[data-desk-item="music"][data-dragging]').waitFor({ state: 'attached', timeout: 5000 });
    }
    for (let dx = 24; dx <= 120; dx += 12) await send('touchMove', dx);
    await send('touchEnd', 120);
    await page.locator('[data-desk-item="music"][data-dragging]').waitFor({ state: 'detached' });
    await page.waitForFunction(({ start, size, tablet }) => {
      const x = parseFloat(document.querySelector('[data-desk-item="music"]').style.left) / 100;
      return Math.abs(x - (tablet ? start : start + 120 / size)) < 0.00001;
    }, { start, size, tablet }, { timeout: 5000 });
    const trace = traceOf(await page.evaluate(() => window.qaEvents));
    assert.ok(trace.records.some(e => e.type === 'pointerdown'));
    assert.ok(trace.records.some(e => ['pointerup', 'pointercancel'].includes(e.type)));
    await page.reload({ waitUntil: 'load' });
    await page.waitForFunction(({ start, size, tablet }) => {
      const x = parseFloat(document.querySelector('[data-desk-item="music"]').style.left) / 100;
      return Math.abs(x - (tablet ? start : start + 120 / size)) < 0.00001;
    }, { start, size, tablet }, { timeout: 5000 });
    results.push({ tablet, sha: await page.locator('meta[name="build-sha"]').getAttribute('content'),
      persistedAfterReload: true,
      width: size, start, final: await page.locator('[data-desk-item="music"]').evaluate(el => el.style.left),
      trace: formatTrace(trace), negativeControl });
    await context.close();
  }
  console.log(JSON.stringify({ base, browser: browser.version(), results }, null, 2));
} finally {
  await browser.close();
}
