// Independent diagnostic: real deployed imports/rendering with controlled network capability objects.
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';

const base = process.env.QA_BASE || 'https://otohime.dev';
const browser = await chromium.launch({ channel: 'chrome' });
const health = await fetch(`${base}/api/health?qa=run-9749-save-data`).then(r => r.json());
const report = { base, health, browser: browser.version(), cases: [] };
try {
  for (const eventTarget of [false, true]) {
    const context = await browser.newContext();
    await context.addInitScript(withEvents => {
      const connection = withEvents ? Object.assign(new EventTarget(), { saveData: true }) : { saveData: true };
      Object.defineProperty(navigator, 'connection', { value: connection });
    }, eventTarget);
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    const crash = eventTarget ? null : page.waitForEvent('console', {
      predicate: m => m.type() === 'error' && /addEventListener.*not a function/.test(m.text()),
    });
    assert.equal((await page.goto(base)).status(), 200);
    if (eventTarget) {
      await page.locator('[data-susuki-field][data-mode="static"]').waitFor({ state: 'attached' });
      await page.evaluate(async () => { for (let i = 0; i < 12; i++) await new Promise(requestAnimationFrame); });
      assert.deepEqual(errors, [], 'full EventTarget is the control');
      assert.equal(await page.locator('footer.end').count(), 1);
    } else {
      await crash;
      await page.waitForFunction(() => !document.querySelector('footer.end'));
      assert.ok(errors.some(e => /addEventListener.*not a function/.test(e)), JSON.stringify(errors));
    }
    report.cases.push({ eventTarget, errors, footerCount: await page.locator('footer.end').count(),
      outcome: eventTarget ? 'control passes' : 'delivery defect reproduced' });
    await context.close();
  }
  console.log(JSON.stringify(report, null, 2));
} finally { await browser.close(); }
