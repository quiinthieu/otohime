import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';

const base = 'https://otohime.dev';
const health = await (await fetch(`${base}/api/health`)).json();
const api = await (await fetch(`${base}/api/now-playing`)).json();
const browser = await chromium.launch({ channel: 'chrome' });
const result = { health, api, browser: browser.version(), contexts: [], assets: [] };
try {
  for (const javaScriptEnabled of [true, false]) {
    const context = await browser.newContext({ javaScriptEnabled, viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
    try {
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(String(error)));
      page.on('console', message => { if (message.type() === 'error') errors.push({ text: message.text(), location: message.location() }); });
      assert.equal((await page.goto(`${base}/music`, { waitUntil: 'networkidle' })).status(), 200);
      assert.equal(await page.locator('meta[name="build-sha"]').getAttribute('content'), health.sha);
      const shelf = page.locator('[data-now-playing]');
      assert.equal(await shelf.getAttribute('data-play-source'), 'none');
      assert.equal(await shelf.getAttribute('data-play-state'), 'off');
      assert.equal(api.play.source, null);
      assert.equal(api.play.state, 'off');
      assert.equal(api.game, null);
      assert.equal(await shelf.locator('.game-cart').getAttribute('data-face'), 'quiet');
      assert.ok((await shelf.locator('[data-label="game"]').textContent()).length > 0, 'static Playing fallback remains');
      assert.equal(await shelf.locator('.game-cart a').count(), 0);
      assert.equal(await shelf.locator('.tape a').getAttribute('href'), 'https://open.spotify.com/playlist/609w1YzsoSy1zuHmyBhYwu');
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      assert.deepEqual(errors, []);
      if (javaScriptEnabled) {
        const urls = await page.locator('script[src]').evaluateAll(nodes => nodes.map(n => n.src));
        for (const url of urls) {
          const response = await fetch(url);
          assert.equal(response.status, 200);
          const body = await response.text();
          assert.ok(!body.includes('api.lanyard.rest'), 'server adapter host stays out of client chunks');
          result.assets.push({ url, bytes: Buffer.byteLength(body), sha256: createHash('sha256').update(body).digest('hex') });
        }
      }
      result.contexts.push({ javaScriptEnabled, state: 'off', staticGame: await shelf.locator('[data-label="game"]').textContent(), errors });
    } finally { await context.close(); }
  }
  assert.deepEqual(await (await fetch(`${base}/api/health`)).json(), health, 'deployment stayed fixed during this walk');
  writeFileSync(`${import.meta.dirname}/deployed-browser.json`, JSON.stringify(result, null, 2) + '\n');
  console.log(`deployed ${health.sha}: two phone contexts pass; ${result.assets.length} asset hashes recorded`);
} finally { await browser.close(); }
