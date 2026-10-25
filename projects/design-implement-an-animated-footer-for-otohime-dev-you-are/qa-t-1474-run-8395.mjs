// Independent QA driver: no imports from the delivery's browser probe.
// PW_PREFIX=/tmp/pw BASE_URL=http://localhost:4091 EXPECT_SHA=<sha> QA_OUT=/tmp/qa node <file>
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const { chromium } = createRequire(path.resolve(process.env.PW_PREFIX, 'package.json'))('playwright');
const base = process.env.BASE_URL;
const output = process.env.QA_OUT;
assert(base && output && process.env.EXPECT_SHA);
assert(!path.resolve(output).startsWith(process.cwd() + '/'), 'Keep visual artifacts outside git');
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
const observations = [];
const errors = [];
const seq = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
const footer = page => page.locator('footer.end:visible');
const record = (start, action, result) => observations.push({ start, action, result });
async function enter(page) {
  await footer(page).scrollIntoViewIfNeeded();
  await page.waitForFunction(() => [...document.querySelectorAll('footer.end')].some(e => e.checkVisibility() && e.dataset.seen === 'true'));
  await page.waitForTimeout(950);
}
async function state(page) {
  return page.evaluate(() => {
    const f = [...document.querySelectorAll('footer.end')].find(e => e.checkVisibility());
    const main = [...document.querySelectorAll('main#main')].find(e => e.checkVisibility());
    const s = f.querySelector('[data-end-stage]');
    return {
      sha: document.querySelector('meta[name="build-sha"]').content,
      count: [...document.querySelectorAll('footer.end')].filter(e => e.checkVisibility()).length,
      below: f.getBoundingClientRect().top >= main.getBoundingClientRect().bottom,
      overflow: document.documentElement.scrollWidth > innerWidth,
      pages: [...f.querySelectorAll('[data-end-page]')].map(a => a.getAttribute('href')),
      lines: f.querySelectorAll('[data-end-line]').length,
      readout: f.querySelector('[data-end-readout]').textContent,
      unlocked: s.dataset.unlocked,
      active: s.dataset.active ?? null,
      eyes: f.querySelector('[data-end-pupils]').style.transform,
      accent: s.style.getPropertyValue('--fig'),
      background: getComputedStyle(document.body).backgroundColor,
      raf: window.qaRaf ?? null,
      ticks: window.qaTicks ?? null,
    };
  });
}
function verify(s) {
  assert.equal(s.sha, process.env.EXPECT_SHA);
  assert.equal(s.count, 1);
  assert(s.below && !s.overflow);
  assert.equal(s.lines, 4);
  assert.deepEqual(s.pages, ['/work', '/play', '/notes', '/music', '/projects', '/sketches']);
}
try {
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const page = await context.newPage();
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(base + '/');
  await enter(page);
  verify(await state(page));
  await footer(page).screenshot({ path: path.join(output, 'home.png') });
  for (const dest of ['/work', '/projects']) {
    const before = await state(page);
    await footer(page).locator(`[data-end-page="${dest}"]`).click();
    await page.waitForURL(base + dest);
    await enter(page);
    const after = await state(page);
    verify(after);
    record(before, `Click footer ${dest}`, after);
    await footer(page).screenshot({ path: path.join(output, `${dest.slice(1)}.png`) });
  }
  // Local-only fixture tests actual keyboard events, including preserved defaults.
  if (new URL(base).hostname === 'localhost' || new URL(base).hostname === '127.0.0.1') {
    await footer(page).evaluate(f => { const t = document.createElement('textarea'); t.id = 'qa-field'; f.prepend(t); });
    await page.locator('#qa-field').focus();
    for (const key of seq) await page.keyboard.press(key);
    const negative = await state(page);
    assert.equal(negative.unlocked, 'false');
    assert.equal(await page.locator('#qa-field').inputValue(), 'ba');
    record('Locked; focused editable fixture', 'Type real Konami keys', negative);
    await page.locator('#qa-field').evaluate(e => e.remove());
  }
  await enter(page);
  await footer(page).locator('[data-end-mascot]').focus();
  await page.keyboard.press('x');
  for (const key of seq) await page.keyboard.press(key);
  await page.waitForFunction(() => [...document.querySelectorAll('[data-end-stage]')].some(e => e.checkVisibility() && e.dataset.unlocked === 'true'));
  assert.equal(new URL(page.url()).pathname, '/projects');
  assert.equal(await page.evaluate(() => localStorage.getItem('end:achievement')), '1');
  record('Locked', 'Real in-view keyboard sequence', await state(page));
  await page.reload(); await enter(page);
  assert.equal((await state(page)).unlocked, 'true');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForTimeout(100);
  const reduced = await state(page);
  assert.equal(reduced.active, null);
  assert.equal(reduced.eyes, 'translate(0px, 0px)');
  record('Restored badge', 'Activate reduced motion live', reduced);
  await footer(page).locator('[data-end-top]').focus();
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => scrollY <= 4 && document.activeElement.id === 'main');
  record('Footer focused', 'Enter on Back to top', await page.evaluate(() => ({ y: scrollY, focus: document.activeElement.id })));
  await context.close();

  for (const [name, width, height, touch] of [['desktop',1366,768,false], ['tablet',768,1024,false], ['mobile',390,844,true]]) {
    for (const colorScheme of ['light', 'dark']) {
      const c = await browser.newContext({ viewport: { width, height }, hasTouch: touch, isMobile: touch, colorScheme });
      const p = await c.newPage(); p.on('pageerror', e => errors.push(e.message));
      await p.goto(base + '/music'); await enter(p);
      if (touch) {
        await footer(p).locator('summary').focus(); await p.keyboard.press('Enter');
        assert(await footer(p).locator('details').evaluate(e => e.open));
      }
      for (const value of ['yellow', 'coral', 'mint', 'blue', 'pink']) {
        await footer(p).locator(`input[value="${value}"]`).check({ force: true });
        const s = await state(p); verify(s);
        record(`${name} ${colorScheme} Music`, `Select ${value}`, s);
      }
      if (touch) {
        const before = (await state(p)).readout;
        await footer(p).locator('[data-end-mascot]').tap(); await p.waitForTimeout(300);
        const after = await state(p);
        assert.notEqual(after.readout, before); assert.equal(after.eyes, 'translate(0px, 0px)');
        record('Touch mascot idle', 'Tap', after);
      }
      await footer(p).screenshot({ path: path.join(output, `${name}-${colorScheme}.png`) });
      await c.close();
    }
  }
  // Unfiltered instrumentation on /projects independently checks idle work.
  const c = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  await c.addInitScript(() => {
    window.qaRaf = 0; window.qaTicks = 0;
    const raf = window.requestAnimationFrame.bind(window), interval = window.setInterval.bind(window);
    window.requestAnimationFrame = cb => raf(ts => { window.qaRaf++; cb(ts); });
    window.setInterval = (cb, delay, ...args) => interval(() => { window.qaTicks++; cb(...args); }, delay);
  });
  const p = await c.newPage(); await p.goto(base + '/projects'); await enter(p);
  const before = await state(p); await p.waitForTimeout(700); const after = await state(p);
  assert.equal(after.raf, before.raf); assert.equal(after.ticks, before.ticks);
  record(before, '700 ms visible idle; no callback source exclusions', after);
  await c.close();
  assert.deepEqual(errors, []);
} finally {
  await writeFile(path.join(output, 'observations.json'), JSON.stringify({ base, browser: browser.version(), observations, errors }, null, 2));
  console.log(JSON.stringify({ base, browser: browser.version(), observations: observations.length, errors }));
  await browser.close();
}
