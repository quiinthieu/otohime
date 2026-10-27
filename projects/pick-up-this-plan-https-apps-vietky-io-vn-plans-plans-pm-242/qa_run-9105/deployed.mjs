import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';

const base = 'https://otohime.dev';
const browser = await chromium.launch({ channel: 'chrome' });
const evidence = { base, browser: browser.version(), walks: [] };
try {
  const health = await fetch(`${base}/api/health`);
  assert.equal(health.status, 200);
  evidence.health = await health.json();
  const api = await fetch(`${base}/api/now-playing`);
  assert.equal(api.status, 200);
  evidence.api = await api.json();
  assert.equal(evidence.api.music.state, 'off');
  assert.equal(evidence.api.track, null);
  for (const javaScriptEnabled of [true, false]) {
    const context = await browser.newContext({ javaScriptEnabled, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(String(e)));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    const response = await page.goto(`${base}/music`, { waitUntil: 'networkidle' });
    assert.equal(response.status(), 200);
    const sha = await page.locator('meta[name="build-sha"]').getAttribute('content');
    assert.equal(sha, evidence.health.sha);
    const shelf = page.locator('[data-now-playing]');
    assert.equal(await shelf.count(), 1);
    assert.equal(await shelf.getAttribute('data-music-state'), 'off');
    assert.equal(await shelf.locator('.tape').getAttribute('data-face'), 'quiet');
    assert.equal(await shelf.locator('.tape[data-spin]').count(), 0);
    assert.equal(await shelf.locator('[data-now-playing-credit] time').count(), 0);
    assert.match(await shelf.innerText(), /Spotify/);
    assert.match(await shelf.innerText(), /Steam/);
    const href = await shelf.locator('.tape .np-link').getAttribute('href');
    assert.match(href, /^https:\/\/open\.spotify\.com\/playlist\//);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    if (javaScriptEnabled) {
      await shelf.locator('.tape .np-link').focus();
      assert.equal(await shelf.locator('.tape .np-link').evaluate(e => document.activeElement === e), true);
      // Independent negative control: the observed off face cannot certify a live fixture.
      await assert.rejects(async () => assert.equal(await shelf.getAttribute('data-music-state'), 'fixture'));
      evidence.negativeControl = 'off production face rejected as fixture';
    }
    assert.deepEqual(errors, []);
    evidence.walks.push({ javaScriptEnabled, sha, status: response.status(), quiet: true, safePlaylist: href, errors });
    await context.close();
  }
  console.log(JSON.stringify(evidence, null, 2));
} finally { await browser.close(); }
