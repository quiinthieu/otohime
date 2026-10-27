import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';

const base = 'https://otohime.dev';
const health = async () => {
  const response = await fetch(`${base}/api/health`);
  assert.equal(response.status, 200);
  return (await response.json()).sha;
};

const before = await health();
const browser = await chromium.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  env: { ...process.env, TMPDIR: '/tmp' },
});
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(base, { waitUntil: 'load' });
  const group = page.getByRole('region', { name: 'Pocket console' }).getByRole('group', { name: 'Print run' });
  await group.waitFor({ state: 'visible' });
  assert.deepEqual(await group.getByRole('radio').evaluateAll(radios => radios.map(radio => radio.closest('label')?.textContent?.trim())),
    ['House', 'Sumi black', 'Riso pink + mint', 'Indigo night']);

  await group.getByText('Riso pink + mint', { exact: true }).click();
  await page.waitForFunction(() => document.documentElement.dataset.printRun === 'riso');
  assert.equal(await page.evaluate(() => localStorage.getItem('otohime:print-run:v1')), 'riso');
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => document.documentElement.dataset.printRun === 'riso');
  assert.equal(await group.getByRole('radio', { name: 'Riso pink + mint' }).isChecked(), true);

  await group.getByRole('radio', { name: 'Riso pink + mint' }).focus();
  await page.keyboard.press('Control+k');
  const dialog = page.getByRole('dialog', { name: 'Pocket terminal' });
  await dialog.waitFor({ state: 'visible' });
  const prompt = page.locator('#pt-in');
  const command = async line => { await prompt.fill(line); await prompt.press('Enter'); };
  await command('print run');
  assert.match(await dialog.getByRole('log').textContent(), /Riso pink \+ mint \(riso\)/);
  await command('print run nonsense');
  assert.equal(await page.evaluate(() => localStorage.getItem('otohime:print-run:v1')), 'riso');
  assert.equal(await group.getByRole('radio', { name: 'Riso pink + mint' }).isChecked(), true);
  await command('print run sumi');
  await page.waitForFunction(() => document.documentElement.dataset.printRun === 'sumi');
  assert.equal(await group.getByRole('radio', { name: 'Sumi black' }).isChecked(), true);
  await dialog.getByRole('group', { name: 'Print run' }).getByText('Indigo night', { exact: true }).click();
  await page.waitForFunction(() => document.documentElement.dataset.printRun === 'indigo');
  assert.equal(await group.getByRole('radio', { name: 'Indigo night' }).isChecked(), true);
  await page.keyboard.press('Escape');
  assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('value')), 'riso');
  assert.deepEqual(errors, []);
  const after = await health();
  assert.equal(after, before);
  console.log(JSON.stringify({ pass: true, deployed_sha: after, chrome: await browser.version(), checks: 12,
    negative_control: 'invalid command leaves persisted Riso choice unchanged' }));
  await context.close();
} finally {
  await browser.close();
}
