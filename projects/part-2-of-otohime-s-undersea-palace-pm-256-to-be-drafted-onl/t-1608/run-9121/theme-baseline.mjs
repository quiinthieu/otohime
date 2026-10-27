// Attribute the supplemental overlapping-control observation on the actual deployed pre-delivery UI.
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { launchBrowser } from '../../../../scripts/probe-browser.mjs';
const browser = await launchBrowser();
const result = { url: 'https://otohime.dev/', errors: [], action: 'synthetic double activation of the actual theme button in one event turn; native ViewTransitions' };
try {
  const page = await browser.newPage();
  page.on('pageerror', e => result.errors.push(String(e)));
  await page.goto(result.url);
  result.sha = await page.locator('meta[name="build-sha"]').getAttribute('content');
  await page.waitForFunction(() => {
    const el = document.querySelector('.theme-toggle');
    return el && Object.keys(el).some(k => k.startsWith('__reactProps$')) && !document.documentElement.matches(':active-view-transition');
  });
  result.ghostLayers = await page.locator('[data-ghosts-state]').count();
  await page.locator('.theme-toggle').evaluate(el => { el.click(); el.click(); });
  await page.waitForFunction(() => !document.documentElement.matches(':active-view-transition'));
  await page.waitForTimeout(150);
  assert.ok(result.errors.some(e => /Transition was skipped/.test(e)));
  console.log(JSON.stringify(result, null, 2));
} finally {
  writeFileSync(`${import.meta.dirname}/theme-baseline.json`, JSON.stringify(result, null, 2) + '\n');
  await browser.close();
}
