import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chromium } from 'playwright-core';

const base = process.env.BASE_URL;
if (!base) throw new Error('BASE_URL is required');

test('fresh project action hit target and real fold rendering', async () => {
  const browser = await chromium.launch({ channel: 'chrome', env: { ...process.env, TMPDIR: '/tmp' } });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });
    await page.goto(`${base}/projects`);
    const card = page.locator('[data-paper-id]:not([data-paper-fetch-only])').first();
    const button = card.getByRole('button', { name: 'Crumple', exact: true });
    await button.waitFor();
    const hit = await button.evaluate(el => {
      const r = el.getBoundingClientRect();
      const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      return { target: top?.tagName, text: top?.textContent?.trim().slice(0, 60), self: top === el || el.contains(top) };
    });
    console.log(`fresh center hit: ${JSON.stringify(hit)}`);
    assert.equal(hit.self, false, `fresh Crumple center is obstructed: ${JSON.stringify(hit)}`);
    await button.focus();
    const box = await card.boundingBox();
    const href = await card.locator('a').first().getAttribute('href');
    await page.keyboard.press('Enter');
    const canvas = card.locator('canvas');
    await canvas.waitFor();
    await page.waitForFunction(() => document.querySelector('[data-paper-id]:not([data-paper-fetch-only])')?.getAttribute('data-crumple-state') === 'ball');
    const painted = await canvas.evaluate((el: HTMLCanvasElement) => {
      const data = el.getContext('2d')!.getImageData(0, 0, el.width, el.height).data;
      let n = 0; for (let i = 3; i < data.length; i += 4) if (data[i]) n++;
      return n;
    });
    console.log(`real Canvas opaque pixels: ${painted}`);
    assert.ok(painted > 300, `painted pixels: ${painted}`);
    assert.deepEqual(await card.boundingBox(), box);
    assert.equal(await card.locator('a').first().getAttribute('href'), href);
    await card.locator('a').first().evaluate((el: HTMLAnchorElement) => el.focus());
    assert.equal(await canvas.count(), 0);

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
    assert.ok(await note.evaluate(el => [...el.children].filter(c => !c.hasAttribute('data-paper-controls')).every(c => getComputedStyle(c).opacity !== '0')));
  } finally { await browser.close(); }
});
