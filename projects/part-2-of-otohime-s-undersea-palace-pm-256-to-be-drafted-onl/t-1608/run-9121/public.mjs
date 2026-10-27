import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { launchBrowser } from '../../../../scripts/probe-browser.mjs';

const browser = await launchBrowser();
const results = { observedAt: new Date().toISOString(), browser: browser.version(), pages: [], errors: [], boundary: 'Real read-only public application; configured hosted Worker execution is successor scope.' };
try {
  const context = await browser.newContext({ viewport: { width: 960, height: 720 }, reducedMotion: 'no-preference' });
  for (const room of ['/', '/ryugu']) {
    const page = await context.newPage();
    page.on('pageerror', e => results.errors.push(String(e)));
    const sockets = []; page.on('websocket', ws => sockets.push(ws.url()));
    const response = await page.goto('https://otohime.dev' + room);
    assert.equal(response.status(), 200);
    const sha = await page.locator('meta[name="build-sha"]').getAttribute('content');
    const ancestor = spawnSync('git', ['merge-base', '--is-ancestor', 'ebbb06d09e6030f6a56b323247e879efdb76fcb6', sha]);
    const identity = { room, status: response.status(), sha, deliveryAncestorExit: ancestor.status };
    results.pages.push(identity);
    if (ancestor.status !== 0) {
      identity.layer = { present: await page.locator('[data-ghosts-state]').count() };
      identity.sockets = sockets;
      await page.close();
      continue;
    }
    await page.waitForSelector('[data-ghosts-state="off"]');
    const layer = await page.locator('[data-ghosts-state]').evaluate(el => {
      const c = el.querySelector('canvas'), bytes = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      return { state: el.dataset.ghostsState, count: el.dataset.ghosts, rippleDraws: el.dataset.ghostsRipples, pixels: bytes.filter((v, i) => i % 4 === 3 && v > 0).length, events: getComputedStyle(el).pointerEvents, overflow: document.documentElement.scrollWidth > window.innerWidth };
    });
    Object.assign(identity, { layer, sockets });
    assert.deepEqual(layer, { state: 'off', count: '0', rippleDraws: '0', pixels: 0, events: 'none', overflow: false });
    assert.deepEqual(sockets, []);
    await page.close();
  }
  const health = await context.request.get('https://otohime.dev/api/health');
  results.health = { status: health.status(), body: await health.json() };
  assert.equal(health.status(), 200); assert.equal(results.health.body.ok, true);
  assert.equal(results.health.body.sha, results.pages[0].sha);
  const config = await context.request.get('https://otohime.dev/api/ghosts');
  const configBody = await config.text();
  results.config = { status: config.status(), cacheControl: config.headers()['cache-control'], bodyEmpty: configBody === '', bytes: Buffer.byteLength(configBody) };
  assert.deepEqual(results.errors, []);
  console.log(JSON.stringify(results, null, 2));
  assert.ok(results.pages.every(p => p.deliveryAncestorExit === 0), 'required delivery is not deployed');
  assert.equal(results.config.status, 404); assert.equal(results.config.cacheControl, 'no-store'); assert.equal(results.config.bodyEmpty, true);
} finally {
  writeFileSync(`${import.meta.dirname}/public-results.json`, JSON.stringify(results, null, 2) + '\n');
  await browser.close();
}
