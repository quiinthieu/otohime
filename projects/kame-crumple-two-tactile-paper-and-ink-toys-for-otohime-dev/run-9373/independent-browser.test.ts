import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { chromium, type Browser } from 'playwright-core';
import { BASE, launchTactileBrowser, ready } from '../../../e2e/tactile-helpers.ts';

let browser: Browser;
before(async () => { browser = await launchTactileBrowser(); });
after(async () => { await browser?.close(); });

test('fresh native pointer hit target, basket placement, and source recovery', async () => {
  const context = await browser.newContext({ viewport: { width: 1100, height: 800 }, reducedMotion: 'reduce' });
  try {
    const page = await context.newPage();
    await ready(page, '/notes');
    const card = page.locator('[data-paper-id]:not([data-paper-fetch-only])').first();
    const original = await card.evaluate(el => ({
      links: [...el.querySelectorAll('a')].map(a => [a.textContent, a.getAttribute('href')]),
      rect: el.getBoundingClientRect().toJSON(),
    }));
    const crumple = card.getByRole('button', { name: 'Crumple', exact: true });
    await crumple.click();
    await page.waitForFunction(() => document.querySelector('[data-crumple-state="ball"]'));
    const grip = page.getByRole('button', { name: 'Drag paper ball', exact: true });
    const box = await grip.boundingBox();
    assert.ok(box);
    const target = await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.closest('.paper-ball-grip') !== null,
      { x: box.x + box.width / 2, y: box.y + box.height / 2 });
    assert.equal(target, true, 'the first native pointer must reach the grip');
    await card.getByRole('button', { name: 'Toss to basket', exact: true }).click();
    assert.equal(await grip.getAttribute('data-ball-state'), 'basket');
    await page.getByRole('button', { name: 'Iron flat', exact: true }).click();
    assert.equal(await page.locator('.paper-ball-grip,.paper-fold-canvas,[data-crumple-paint]').count(), 0);
    assert.deepEqual(await card.evaluate(el => [...el.querySelectorAll('a')].map(a => [a.textContent, a.getAttribute('href')])), original.links);
    assert.equal(await card.evaluate(el => el.getBoundingClientRect().width), original.rect.width);
  } finally { await context.close(); }
});

test('real back navigation retains one paper mount', async () => {
  const bfcacheBrowser = await chromium.launch({ channel: 'chrome', ignoreDefaultArgs: ['--disable-back-forward-cache'] });
  try {
    const context = await bfcacheBrowser.newContext({ viewport: { width: 1100, height: 800 } });
    const page = await context.newPage();
    await ready(page, '/notes');
    await page.evaluate(() => window.addEventListener('pageshow', event =>
      sessionStorage.setItem('qa-pageshow-persisted', String(event.persisted))));
    await page.goto(`${BASE}/projects`, { waitUntil: 'commit' });
    await page.waitForURL('**/projects', { waitUntil: 'commit' });
    await page.goBack({ waitUntil: 'commit' });
    await page.waitForURL('**/notes', { waitUntil: 'commit' });
    await page.locator('.paper-iron').waitFor();
    console.log('bfcache persisted pageshow:', await page.evaluate(() => sessionStorage.getItem('qa-pageshow-persisted')));
    assert.equal(await page.locator('.paper-iron').count(), 1);
    assert.ok(await page.locator('[data-paper-id]').evaluateAll(els =>
      els.every(el => el.querySelectorAll(':scope > .paper-tools').length <= 1)));
    await context.close();
  } finally { await bfcacheBrowser.close(); }
});
