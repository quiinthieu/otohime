import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chromium } from 'playwright-core';

const base = process.env.BASE_URL;
if (!base) throw new Error('BASE_URL is required');

test('independent paper action and failed Canvas control', async () => {
  const browser = await chromium.launch({ channel: 'chrome', env: { ...process.env, TMPDIR: '/tmp' } });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });
    await page.goto(`${base}/projects`);
    const card = page.locator('[data-paper-id]:not([data-paper-fetch-only])').first();
    const action = card.getByRole('button', { name: 'Crumple', exact: true });
    await action.waitFor();
    const link = card.locator('a').first();
    const href = await link.getAttribute('href');
    let blockedPointer = false;
    try { await action.click({ timeout: 2500 }); }
    catch (error) { blockedPointer = /intercepts pointer events/.test(String(error)); }
    assert.ok(blockedPointer, 'first project Crumple pointer click is intercepted without prior keyboard focus');
    await action.focus();
    const before = await card.boundingBox();
    await action.click();
    await card.locator('canvas').waitFor();
    await page.waitForFunction(() => document.querySelector('[data-paper-id]:not([data-paper-fetch-only])')?.getAttribute('data-crumple-state') === 'ball');
    const pixels = await card.locator('canvas').evaluate((c: HTMLCanvasElement) => {
      const data = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
      let opaque = 0; for (let i = 3; i < data.length; i += 4) if (data[i]) opaque++;
      return opaque;
    });
    assert.ok(pixels > 300);
    assert.deepEqual(await card.boundingBox(), before);
    assert.equal(await link.getAttribute('href'), href);
    await link.evaluate((a: HTMLAnchorElement) => a.focus());
    assert.equal(await card.locator('canvas').count(), 0);

    const blocked = await browser.newPage({ viewport: { width: 1280, height: 860 } });
    await blocked.addInitScript(() => {
      const original = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, ...args) {
        if (this.classList.contains('paper-fold-canvas')) return null;
        return original.apply(this, args as Parameters<typeof original>);
      } as typeof original;
    });
    await blocked.goto(`${base}/notes`);
    const note = blocked.locator('[data-paper-id]:not([data-paper-fetch-only])').first();
    await note.getByRole('button', { name: 'Crumple', exact: true }).focus();
    await blocked.keyboard.press('Enter');
    await note.locator('[data-paper-message]').getByText(/unavailable/).waitFor();
    assert.equal(await note.locator('canvas').count(), 0);
    assert.ok((await note.innerText()).length > 20);
    assert.equal(await note.evaluate(el => [...el.children].filter(c => !c.hasAttribute('data-paper-controls')).every(c => getComputedStyle(c).opacity !== '0')), true);
    await note.getByRole('button', { name: 'Read card', exact: true }).focus();
    await blocked.keyboard.press('Enter');
    await note.getByRole('button', { name: 'Reset', exact: true }).focus();
    await blocked.keyboard.press('Enter');
  } finally { await browser.close(); }
});
