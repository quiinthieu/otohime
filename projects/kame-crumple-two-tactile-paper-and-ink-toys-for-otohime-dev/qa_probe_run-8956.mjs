import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';

const base = process.env.BASE_URL || 'https://otohime.dev';
const browser = await chromium.launch({ channel: 'chrome', env: { ...process.env, TMPDIR: '/tmp' } });
try {
  for (const route of ['/projects', '/notes']) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });
    await page.goto(base + route);
    const card = page.locator('[data-paper-id]').first();
    const button = card.getByRole('button', { name: 'Fetch back', exact: true });
    await button.waitFor({ state: 'attached', timeout: 15000 });
    await page.locator('[data-kame]').waitFor({ state: 'attached' });
    const before = await card.boundingBox();
    const hrefs = await card.locator('a[href]').evaluateAll(nodes => nodes.map(n => n.getAttribute('href')));
    const sourceText = () => card.evaluate(el => {
      const copy = el.cloneNode(true);
      copy.querySelectorAll('[aria-live]').forEach(n => n.remove());
      return copy.textContent;
    });
    const text = await sourceText();
    await page.evaluate(() => {
      window.qaSamples = [];
      const start = performance.now();
      const sample = () => {
        const proxy = document.querySelector('[data-fetch-proxy]');
        const turtle = document.querySelector('[data-kame]');
        const source = document.querySelector('[data-paper-id]');
        if (proxy && turtle && source) {
          const a = proxy.getBoundingClientRect(), b = turtle.getBoundingClientRect(), c = source.getBoundingClientRect();
          const distance = (x,y) => Math.hypot(x.left+x.width/2-y.left-y.width/2,x.top+x.height/2-y.top-y.height/2);
          window.qaSamples.push({ phase: proxy.getAttribute('data-phase'), turtle: distance(a,b), home: distance(a,c), ms: performance.now()-start });
        }
        requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    });
    await button.focus();
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => window.qaSamples?.some(s => s.phase === 'returned'), null, { timeout: 6500 });
    const samples = await page.evaluate(() => window.qaSamples);
    assert.ok(samples.some(s => s.phase === 'returning' && s.turtle <= 5), `${route}: turtle did not reach proxy`);
    assert.ok(samples.some(s => s.phase === 'returned' && s.turtle <= 5 && s.home <= 5 && s.ms < 5000), `${route}: return geometry or deadline failed`);
    await page.locator('[data-fetch-proxy]').waitFor({ state: 'detached' });
    const after = await card.boundingBox();
    for (const key of ['x','y','width','height']) assert.ok(Math.abs(before[key]-after[key]) <= 1, `${route}: ${key} changed`);
    assert.deepEqual(await card.locator('a[href]').evaluateAll(nodes => nodes.map(n => n.getAttribute('href'))), hrefs);
    assert.equal(await sourceText(), text);
    console.log(`${route}: returned with measured geometry in ${Math.ceil(samples.find(s => s.phase === 'returned').ms)}ms; source intact`);
    await page.close();
  }
  const reduced = await browser.newPage({ reducedMotion: 'reduce' });
  await reduced.goto(base + '/projects');
  const button = reduced.locator('[data-paper-id]').first().getByRole('button', { name: 'Fetch back', exact: true });
  await button.waitFor({ state: 'attached', timeout: 15000 });
  await button.focus();
  await reduced.keyboard.press('Enter');
  assert.equal(await reduced.locator('[data-fetch-proxy]').count(), 0, 'negative control: reduced motion must not animate a proxy');
  console.log('reduced motion: no proxy (negative control)');
  await reduced.close();
} finally { await browser.close(); }
