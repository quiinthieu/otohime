import assert from 'node:assert/strict';
import { before, after, test, type TestContext } from 'node:test';
import type { Browser, Page } from 'playwright-core';
import { launchTactileBrowser, ready, touchDrag } from './tactile-helpers.ts';
let browser: Browser;
before(async () => { browser = await launchTactileBrowser(); console.log(`Production browser: Chromium ${browser.version()}`); });
after(async () => { await browser?.close(); });
async function open(t: TestContext, touch = false, reduced = false) {
  const context = await browser.newContext({ viewport: { width: touch ? 390 : 1280, height: 860 }, hasTouch: touch, isMobile: touch, reducedMotion: reduced ? 'reduce' : 'no-preference' });
  t.after(() => context.close());
  const page = await context.newPage(); page.setDefaultTimeout(8000); await ready(page, '/notes'); return page;
}
const card = (p: Page, n = 0) => p.locator('[data-paper-id]:not([data-paper-fetch-only])').nth(n);
async function crumple(p: Page, n = 0) {
  const c = card(p, n); await c.getByRole('button', { name: 'Crumple', exact: true }).focus();
  await p.keyboard.press('Enter');
  await p.waitForFunction(id => document.querySelector(`[data-paper-id="${CSS.escape(id!)}"]`)?.getAttribute('data-crumple-state') === 'ball', await c.getAttribute('data-paper-id'));
  return c;
}
async function restored(p: Page) {
  assert.equal(await p.locator('[data-crumple-paint],.paper-fold-canvas,.paper-ball-grip,[data-fetch-proxy]').count(), 0);
  assert.equal(await p.locator('[data-paper-state="peeled"]').count(), 0);
  assert.equal(await p.locator('[data-toss-state]').count(), 0);
  assert.ok(await card(p).evaluate(el => [...el.children].filter(c => !c.hasAttribute('data-paper-controls')).every(c => getComputedStyle(c).opacity !== '0')));
}
async function settled(p: Page) {
  await p.waitForFunction(() => { const b = document.querySelector<HTMLElement>('.paper-ball-grip'); return b && ['basket', 'rest'].includes(b.dataset.ballState ?? ''); });
  assert.equal(await p.locator('.paper-ball-grip').getAttribute('data-simulating'), 'false');
  assert.ok(Number(await p.locator('.paper-ball-grip').getAttribute('data-active-ms')) <= 5000);
}

test('native captured pointer flick hits the measured basket; rim miss is an observable negative control and rAF sleeps', async t => {
  const p = await open(t);
  for (const rim of [false, true]) {
    await crumple(p);
    const grip = p.getByRole('button', { name: 'Drag paper ball', exact: true });
    await grip.scrollIntoViewIfNeeded(); const g = (await grip.boundingBox())!;
    await p.mouse.move(g.x + 22, g.y + 22); await p.mouse.down();
    await p.mouse.move(g.x + 25, g.y + 25);
    // The captured ball remains viewport-local while the footer comes into view.
    await p.locator('[data-paper-basket]').evaluate(el => el.scrollIntoView({ block: 'center' }));
    const b = (await p.locator('[data-paper-basket]').boundingBox())!;
    const x = rim ? b.x + 14 : b.x + b.width / 2, y = b.y - 45;
    await p.mouse.move(x, y, { steps: 6 });
    // Inject browser time directly for a deterministic release sample, not idle time.
    await p.clock.install(); await p.clock.runFor(32);
    await p.mouse.move(x, y + 3); await p.mouse.up();
    assert.equal(await grip.getAttribute('data-ball-state'), 'flying');
    await p.clock.runFor(5100); await settled(p);
    assert.equal(await grip.getAttribute('data-ball-state'), rim ? 'rest' : 'basket');
    if (rim) assert.ok(Number(await grip.getAttribute('data-rim-hits')) > 0);
    else await p.screenshot({ path: '/tmp/t1585-basket.png' });
    const position = await grip.boundingBox(); await p.clock.runFor(1000); assert.deepEqual(await grip.boundingBox(), position);
    await p.getByRole('button', { name: 'Iron flat', exact: true }).click(); await restored(p);
    await p.clock.resume();
  }
});

test('keyboard offscreen toss does not scroll; reduced motion places instantly, per-card Reset is isolated and Iron preserves footer and Kame memory', async t => {
  const p = await open(t, false, true);
  await p.getByRole('textbox', { name: 'Kame name' }).fill('Mizu');
  await p.getByRole('textbox', { name: 'Kame name' }).press('Enter');
  await p.getByRole('button', { name: 'Hide Kame in shell', exact: true }).click();
  const memory = await p.evaluate(() => localStorage.getItem('kame:v1'));
  assert.equal(JSON.parse(memory!).dismissed, true);
  const footer = await p.locator('footer').evaluate(el => [...el.querySelectorAll('a')].map(a => [a.textContent, a.getAttribute('href')]));
  const before = await card(p).evaluate(el => { const r = el.getBoundingClientRect(); return { width: r.width, height: r.height, y: r.y + scrollY }; });
  await card(p).getByRole('button', { name: 'Peel corner', exact: true }).focus(); await p.keyboard.press('Enter');
  const first = await crumple(p), second = await crumple(p, 1);
  const toss = first.getByRole('button', { name: 'Toss to basket', exact: true }); await toss.focus();
  const scroll = await p.evaluate(() => scrollY); await p.keyboard.press('Enter');
  const ball = p.locator(`.paper-ball-grip[data-source-id="${await first.getAttribute('data-paper-id')}"]`);
  assert.equal(await ball.getAttribute('data-ball-state'), 'basket');
  assert.equal(await ball.getAttribute('data-simulating'), 'false'); assert.equal(await p.evaluate(() => scrollY), scroll);
  await second.getByRole('button', { name: 'Reset', exact: true }).focus(); await p.keyboard.press('Enter');
  assert.equal(await first.getAttribute('data-crumple-paint'), 'true'); assert.equal(await second.getAttribute('data-crumple-paint'), null);
  await p.getByRole('button', { name: 'Iron flat', exact: true }).focus(); await p.keyboard.press('Enter'); await restored(p);
  assert.equal(await p.locator('.paper-iron-sweep').count(), 0);
  assert.equal(await p.evaluate(() => localStorage.getItem('kame:v1')), memory);
  assert.equal(await p.getByRole('textbox', { name: 'Kame name' }).inputValue(), 'Mizu');
  await p.getByRole('button', { name: 'Restore Kame from shell', exact: true }).click();
  assert.equal(await p.getByRole('button', { name: 'Hide Kame in shell', exact: true }).count(), 1);
  assert.deepEqual(await p.locator('footer').evaluate(el => [...el.querySelectorAll('a')].map(a => [a.textContent, a.getAttribute('href')])), footer);
  assert.deepEqual(await card(p).evaluate(el => { const r = el.getBoundingClientRect(); return { width: r.width, height: r.height, y: r.y + scrollY }; }), before);
  assert.equal(await p.locator('[data-end-waterline]').count(), 1); assert.equal(await p.locator('#kame-shell').count(), 1);
  await p.getByRole('link', { name: 'Projects', exact: true }).last().click(); await p.waitForURL('**/projects');
});

test('mobile real touch ball flick remains captured and bounded; cancellation restores focus and source', async t => {
  const p = await open(t, true); const c = await crumple(p);
  const grip = p.getByRole('button', { name: 'Drag paper ball', exact: true }); await grip.scrollIntoViewIfNeeded();
  const g = (await grip.boundingBox())!;
  await touchDrag(p, g.x + 22, g.y + 22, -90, 90);
  assert.equal(await grip.getAttribute('data-ball-state'), 'flying');
  await p.clock.install(); await p.clock.runFor(5100); await settled(p);
  await p.keyboard.press('Escape'); await restored(p);
  assert.equal(await c.getByRole('button', { name: 'Crumple', exact: true }).evaluate(el => document.activeElement === el), true);
});

test('flight/fold/fetch recovery handles Escape, modal, hidden, motion, removal, route and page lifecycle without duplicate mounts', async t => {
  const p = await open(t);
  for (const interruption of ['escape', 'modal', 'hidden', 'motion', 'remove', 'route', 'pagehide']) {
    await p.emulateMedia({ reducedMotion: 'no-preference' }); await ready(p, '/notes');
    const c = await crumple(p);
    await c.getByRole('button', { name: 'Toss to basket', exact: true }).focus(); await p.keyboard.press('Enter');
    await p.evaluate(mode => {
      if (mode === 'escape') document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      if (mode === 'modal') { const d = document.createElement('dialog'); d.open = true; document.body.append(d); }
      if (mode === 'hidden') { Object.defineProperty(document, 'hidden', { configurable: true, value: true }); document.dispatchEvent(new Event('visibilitychange')); }
      if (mode === 'remove') document.querySelector('[data-crumple-paint]')?.remove();
      if (mode === 'pagehide') window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true }));
    }, interruption);
    if (interruption === 'motion') await p.emulateMedia({ reducedMotion: 'reduce' });
    if (interruption === 'route') { await p.getByRole('link', { name: 'Projects', exact: true }).first().click(); await p.waitForURL('**/projects'); }
    await p.waitForFunction(() => !document.querySelector('[data-crumple-paint],.paper-ball-grip,.paper-fold-canvas,[data-fetch-proxy]'));
    if (interruption === 'pagehide') {
      await p.evaluate(() => { window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })); window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })); });
      await p.locator('.paper-iron').waitFor();
      assert.equal(await p.locator('.paper-iron').count(), 1);
      assert.ok(await p.locator('[data-paper-id]').evaluateAll(els => els.every(el => el.querySelectorAll(':scope > .paper-tools').length <= 1)));
    }
  }
});


test('keyboard Toss places offscreen basket without scrolling at ordinary motion and Iron cancels a real fetch proxy', async t => {
  const p = await open(t); const c = await crumple(p);
  await c.getByRole('button', { name: 'Toss to basket', exact: true }).focus();
  const y = await p.evaluate(() => scrollY); await p.keyboard.press('Enter');
  assert.equal(await p.locator('.paper-ball-grip').getAttribute('data-ball-state'), 'basket');
  assert.equal(await p.evaluate(() => scrollY), y);
  await c.getByRole('button', { name: 'Reset', exact: true }).focus(); await p.keyboard.press('Enter'); await restored(p);
  await c.getByRole('button', { name: 'Fetch back', exact: true }).focus(); await p.keyboard.press('Enter');
  await p.locator('[data-fetch-proxy]').waitFor();
  await card(p, 1).getByRole('button', { name: 'Reset', exact: true }).evaluate((b: HTMLButtonElement) => b.click());
  assert.equal(await p.locator('[data-fetch-proxy]').count(), 1, 'per-card reset preserves another source fetch');
  await p.getByRole('button', { name: 'Iron flat', exact: true }).evaluate((b: HTMLButtonElement) => b.click());
  await restored(p);
  assert.equal(await p.locator('.paper-iron-sweep').count(), 1);
  await p.clock.install(); await p.clock.runFor(500);
  await p.locator('.paper-iron-sweep').waitFor({ state: 'detached' });
  // Cancel during the fold, without waiting for completion.
  await c.getByRole('button', { name: 'Crumple', exact: true }).evaluate((b: HTMLButtonElement) => b.click());
  await c.locator('canvas').waitFor();
  await p.getByRole('button', { name: 'Iron flat', exact: true }).evaluate((b: HTMLButtonElement) => b.click());
  await restored(p); await p.clock.runFor(1000); await restored(p);
});
