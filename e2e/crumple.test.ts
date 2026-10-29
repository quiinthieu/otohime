import assert from 'node:assert/strict';
import { before, after, test, type TestContext } from 'node:test';
import type { Browser, BrowserContextOptions, Locator, Page } from 'playwright-core';
import { launchTactileBrowser, ready, paperImports, touchDrag } from './tactile-helpers.ts';

let browser: Browser;
before(async () => { browser = await launchTactileBrowser(); });
after(async () => { await browser?.close(); });
async function open(t: TestContext, route = '/projects', options: BrowserContextOptions = {}) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 860 }, ...options });
  t.after(() => context.close());
  const page = await context.newPage(); page.setDefaultTimeout(6000);
  await ready(page, route); return page;
}
const cards = (page: Page) => page.locator('[data-paper-id]:not([data-paper-fetch-only])');
async function ball(card: Locator) {
  await card.locator('[data-paper-controls] canvas').waitFor();
  await card.page().waitForFunction(id => document.querySelector(`[data-paper-id="${CSS.escape(id!)}"]`)?.getAttribute('data-crumple-state') === 'ball', await card.getAttribute('data-paper-id'));
  const paint = await card.locator('canvas').evaluate((canvas: HTMLCanvasElement) => {
    const pixels = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data;
    let ink = 0, transparent = 0; const colors = new Set<string>();
    for (let i = 0; i < pixels.length; i += 4) {
      if (pixels[i + 3]) { ink++; colors.add(`${pixels[i]},${pixels[i + 1]},${pixels[i + 2]}`); } else transparent++;
    }
    const rect = canvas.getBoundingClientRect();
    return { ink, transparent, colors: colors.size, width: canvas.width, height: canvas.height, cssWidth: rect.width, cssHeight: rect.height };
  });
  assert.ok(paint.ink > 300, 'real Canvas contains painted paper');
  assert.ok(paint.transparent > paint.ink, 'fold converges to a compact ball');
  assert.ok(paint.colors > 3, 'paper triangles contain ink creases and shading');
  assert.ok(paint.width <= Math.ceil(paint.cssWidth * 2) && paint.height <= Math.ceil(paint.cssHeight * 2), 'DPR capped at two');
}
async function source(card: Locator) {
  return card.evaluate(el => ({
    children: [...el.children].filter(c => !c.hasAttribute('data-paper-controls')).map(c => c.textContent),
    links: [...el.querySelectorAll('a')].map(a => [a.textContent, a.getAttribute('href')]),
    semantics: [...el.querySelectorAll('*')].filter(c => !c.closest('[data-paper-controls]')).map(c => ({
      tag: c.tagName, hidden: c.hasAttribute('hidden'), inert: c.hasAttribute('inert'), ariaHidden: c.getAttribute('aria-hidden'),
      display: getComputedStyle(c).display, visibility: getComputedStyle(c).visibility,
    })),
    rect: (() => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; })(),
  }));
}
async function clickCard(card: Locator, name: string) {
  const button = card.getByRole('button', { name, exact: true });
  await button.focus(); await button.click();
}
// No focus(), hover(), locator click auto-wait or DOM click can prepare this path.
async function pointerClick(button: Locator) {
  const page = button.page();
  await page.mouse.move(0, page.viewportSize()!.height - 1);
  await page.evaluate(() => { if (document.activeElement instanceof HTMLElement) document.activeElement.blur(); });
  await button.scrollIntoViewIfNeeded();
  const hit = () => button.evaluate(el => {
    const r = el.getBoundingClientRect(), x = r.x + r.width / 2, y = r.y + r.height / 2;
    const top = document.elementFromPoint(x, y);
    return { self: top === el, target: top?.outerHTML.slice(0, 200), x, y };
  });
  assert.equal(await button.evaluate(el => document.activeElement === el), false, 'control has no prior focus');
  let centre = await hit();
  assert.equal(centre.self, true, `resting control centre must be reachable: ${JSON.stringify(centre)}`);
  await page.mouse.move(centre.x, centre.y);
  centre = await hit();
  assert.equal(centre.self, true, `native pointer centre must be the control: ${JSON.stringify(centre)}`);
  assert.equal(await button.evaluate(el => getComputedStyle(el.closest('.paper-actions')!).opacity), '1', 'initial pointer entry exposes the shelf');
  await page.mouse.click(centre.x, centre.y);
}
async function documentSource(card: Locator) {
  const snapshot = await source(card);
  const scroll = await card.page().evaluate(() => ({ x: scrollX, y: scrollY }));
  snapshot.rect.x += scroll.x; snapshot.rect.y += scroll.y;
  return snapshot;
}
async function intact(card: Locator) {
  assert.equal(await card.locator('canvas').count(), 0);
  assert.equal(await card.getAttribute('data-crumple-paint'), null);
  assert.ok(await card.evaluate(el => [...el.children].filter(c => !c.hasAttribute('data-paper-controls')).every(c => getComputedStyle(c).opacity !== '0')));
}
async function linkSnapshot(link: Locator) {
  // The existing project peek opens on focus, adding aria-expanded. Compare
  // name/destination/content independently of that legitimate disclosure state.
  return (await link.ariaSnapshot()).replace(' [expanded]:', ':');
}
async function accessibleLink(link: Locator, snapshot: string, focused = false) {
  assert.deepEqual(await linkSnapshot(link), snapshot, 'link keeps its accessible name and destination');
  if (focused) assert.equal(await link.evaluate(el => document.activeElement === el), true, 'source link receives restored focus');
}
async function sourceLinkSnapshot(card: Locator, link: Locator) {
  assert.equal(await link.and(card.getByRole('link')).count(), 1, 'source link remains in the accessibility tree');
  const snapshot = await link.ariaSnapshot();
  assert.match(snapshot, /^- link .+/m, 'source link has an accessible name');
  return snapshot;
}
async function restoredLink(card: Locator, link: Locator, original: string) {
  await intact(card);
  assert.equal(await sourceLinkSnapshot(card, link), original, 'source link accessible snapshot survives restore');
}
async function focusLink(link: Locator) {
  await link.evaluate((a: HTMLAnchorElement) => a.focus());
  // Project links also open a keyboard Peek after its index arrives. Compare
  // the same focused state on both sides rather than racing aria-expanded.
  if (await link.getAttribute('data-peek')) {
    await link.page().waitForFunction(el => el?.getAttribute('aria-expanded') === 'true', await link.elementHandle());
  }
}

test('enabling paper immediately releases the cartridge stacking context', async t => {
  const page = await open(t);
  const card = cards(page).first();
  const hit = await card.evaluate(el => {
    const button = el.querySelector<HTMLButtonElement>('.paper-crumple')!;
    const r = button.getBoundingClientRect();
    scrollTo(0, scrollY + r.y + r.height / 2 - 32);
    // Replay the idle adapter's opt-in after the base cartridge has painted.
    el.removeAttribute('data-paper-active');
    getComputedStyle(el).translate;
    for (const animation of el.getAnimations()) animation.finish();
    getComputedStyle(el).translate;
    el.setAttribute('data-paper-active', 'true');
    const translate = getComputedStyle(el).translate;
    const b = button.getBoundingClientRect();
    return { translate, reachable: document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2) === button };
  });
  assert.equal(hit.translate, 'none', 'opt-in must not interpolate a stacking context');
  assert.equal(hit.reachable, true, 'paper controls immediately clear the sticky header');
});

for (const width of [1280, 720]) for (const route of ['/projects', '/notes']) {
  test(`fresh native controls reach real Canvas at ${width}px on ${route}`, async t => {
    const page = await open(t, route, { viewport: { width, height: 860 } });
    const count = await cards(page).count();
    for (let i = 0; i < count; i++) {
      const card = cards(page).nth(i);
      t.diagnostic(`native controls: ${await card.getAttribute('data-paper-id')}`);
      if (i === 0) {
        // A sticky masthead must not recapture an exposed action on scroll.
        await card.getByRole('button', { name: 'Crumple', exact: true }).evaluate(el => {
          const r = el.getBoundingClientRect();
          scrollTo(0, scrollY + r.y + r.height / 2 - 32);
        });
      }
      const original = await documentSource(card);
      await pointerClick(card.getByRole('button', { name: 'Crumple', exact: true }));
      await ball(card);
      assert.deepEqual(await documentSource(card), original);
      await pointerClick(card.getByRole('button', { name: 'Read card', exact: true }));
      await intact(card);
      await pointerClick(card.getByRole('button', { name: 'Crumple', exact: true }));
      await ball(card);
      await pointerClick(card.getByRole('button', { name: 'Reset', exact: true }));
      await intact(card);
      assert.deepEqual(await documentSource(card), original);
      const link = card.locator('a').first();
      // A previous row's controls may cover part of a title. Its native link
      // must still receive a real click everywhere sampled outside those tools.
      await link.scrollIntoViewIfNeeded();
      const point = await link.evaluate(el => {
        const r = el.closest('[data-paper-id]')!.getBoundingClientRect();
        for (let y = Math.max(70, r.y + 8); y < Math.min(innerHeight, r.bottom) - 8; y += 8) {
          for (let x = r.x + 8; x < r.right - 8; x += 8) {
            const hit = document.elementFromPoint(x, y);
            if (hit === el || el.contains(hit)) return { x, y };
          }
        }
        return null;
      });
      assert.ok(point, 'source link keeps an uncovered native hit target');
      await link.evaluate(el => el.addEventListener('click', e => {
        e.preventDefault(); el.setAttribute('data-native-link-click', 'true');
      }, { once: true }));
      await page.mouse.click(point.x, point.y);
      assert.equal(await link.getAttribute('data-native-link-click'), 'true');
      await link.evaluate(el => el.removeAttribute('data-native-link-click'));
    }
  });
}

test('keyboard folds real ink on both routes, retains accessible source/geometry, and Read, focus and Reset restore synchronously', async t => {
  const page = await open(t, '/projects', { deviceScaleFactor: 3 });
  for (const route of ['/projects', '/notes']) {
    await ready(page, route); const card = cards(page).first();
    const crumple = card.getByRole('button', { name: 'Crumple', exact: true });
    await crumple.focus(); const original = await source(card);
    const originalNodes = await card.locator(':scope > :not(.paper-tools)').all();
    const accessible = await Promise.all(originalNodes.map(node => node.ariaSnapshot()));
    assert.ok(accessible.some(snapshot => snapshot.length > 10), 'original source has accessible content');
    await page.keyboard.press('Enter'); await ball(card);
    assert.deepEqual(await source(card), original);
    assert.ok(await card.evaluate(el => [...el.children].filter(c => !c.hasAttribute('data-paper-controls')).every(c => getComputedStyle(c).opacity === '0')));
    assert.deepEqual(await Promise.all(originalNodes.map(node => node.ariaSnapshot())), accessible, 'source prose and names remain in accessible tree');
    const controls = card.locator('.paper-actions');
    assert.equal(await controls.evaluate(el => getComputedStyle(el).opacity), '1');
    const box = (await card.boundingBox())!, controlBox = (await controls.boundingBox())!;
    assert.ok(controlBox.y >= box.y + box.height - 1 || controlBox.y + controlBox.height <= box.y + 1, 'controls are outside the animated source');
    await card.getByRole('button', { name: 'Read card', exact: true }).evaluate((b: HTMLButtonElement) => b.focus());
    await intact(card); assert.deepEqual(await source(card), original);
    await crumple.focus(); await page.keyboard.press('Space'); await ball(card);
    await card.getByRole('button', { name: 'Reset', exact: true }).evaluate((b: HTMLButtonElement) => b.focus());
    await intact(card); assert.equal(await card.getAttribute('data-paper-state'), 'intact');
    if (await card.locator('a').count()) {
      // Keep the same DOM locator throughout; Riso decorative innerText is
      // deliberately unrelated to the link's accessible name.
      const link = card.locator('a[href]').first();
      const originalLink = await linkSnapshot(link);
      assert.match(originalLink, /- link "[^"\n]*\S[^"\n]*"/, 'original link has a nonempty accessible name');
      await focusLink(link);
      const focusedLink = await sourceLinkSnapshot(card, link);
      await crumple.focus(); await page.keyboard.press('Enter'); await ball(card);
      await accessibleLink(link, originalLink);
      await focusLink(link); await intact(card);
      await accessibleLink(link, originalLink, true);
      await restoredLink(card, link, focusedLink);
      if (route === '/notes') {
        await t.test('negative control: a missing accessible name fails the link assertion', async () => {
          await link.evaluate(el => el.setAttribute('aria-hidden', 'true'));
          try {
            await assert.rejects(() => accessibleLink(link, originalLink, true), /link keeps its accessible name/);
          } finally {
            await link.evaluate(el => el.removeAttribute('aria-hidden'));
          }
        });
        await t.test('negative control: missing focus restoration fails the link assertion', async () => {
          await link.evaluate((a: HTMLAnchorElement) => a.blur());
          try {
            await assert.rejects(() => accessibleLink(link, originalLink, true), /source link receives restored focus/);
          } finally {
            await link.evaluate((a: HTMLAnchorElement) => a.focus());
          }
        });
        await accessibleLink(link, originalLink, true);
      }
    }
    await crumple.focus(); await page.keyboard.press('Enter'); await ball(card);
    await clickCard(card, 'Read card'); await intact(card);
    await clickCard(card, 'Peel corner');
    await crumple.click(); await ball(card); assert.equal(await card.getAttribute('data-paper-state'), 'intact', 'fold clears the shared peel lifecycle');
    await clickCard(card, 'Reset'); await intact(card);
  }
});

test('Notes RisoText link restores its accessible snapshot; hidden-link and changed-name controls fail the same helper', async t => {
  const page = await open(t, '/notes');
  const card = cards(page).first(), link = card.locator('h2 a').first();
  assert.equal(await link.locator('.riso-source').count(), 1, 'real Notes title uses RisoText');
  assert.equal(await link.locator('.riso-visual[aria-hidden="true"]').count(), 1, 'decorative ink is excluded from the accessible name');
  await focusLink(link);
  const original = await sourceLinkSnapshot(card, link);
  // The historical oracle confuses decorative visual text with the AT name.
  assert.equal(await card.getByRole('link', { name: await link.innerText(), exact: true }).count(), 0, 'historical innerText matcher rejects the intact Riso link');
  await clickCard(card, 'Crumple'); await ball(card);
  await focusLink(link);
  await restoredLink(card, link, original);

  await clickCard(card, 'Crumple'); await ball(card);
  await link.evaluate(el => el.setAttribute('hidden', ''));
  await clickCard(card, 'Read card');
  await assert.rejects(() => restoredLink(card, link, original), /source link remains in the accessibility tree/);
  await link.evaluate(el => el.removeAttribute('hidden'));
  await restoredLink(card, link, original);

  await link.evaluate(el => el.setAttribute('aria-label', 'Changed source name'));
  await assert.rejects(() => restoredLink(card, link, original), /source link accessible snapshot survives restore/);
  await link.evaluate(el => el.removeAttribute('aria-label'));
  await restoredLink(card, link, original);
  t.diagnostic(`Notes link accessibility before/after restore: ${original}`);
});

test('stationary real mouse and touch grips fold at the shared hold; touch body scrolling and corner peeling never crumple', async t => {
  const page = await open(t, '/notes'); const card = cards(page).first();
  const grip = card.getByRole('button', { name: 'Drag paper', exact: true });
  await grip.focus(); let r = (await grip.boundingBox())!;
  await page.mouse.move(r.x + 22, r.y + 22); await page.mouse.down(); await ball(card); await page.mouse.up();
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  assert.equal(await card.locator('canvas').count(), 1, 'release after a long hold cannot trigger Fetch back');
  assert.equal(await page.locator('[data-fetch-proxy]').count(), 0);
  await clickCard(card, 'Reset');
  // Only the host's actual blank padding can hold; prose descendants keep selection.
  const blank = await card.evaluate(el => {
    const b = el.getBoundingClientRect();
    for (let y = b.y + 4; y < b.bottom - 4; y += 8) for (let x = b.x + 8; x < b.right - 40; x += 20) if (document.elementFromPoint(x, y) === el) return { x, y };
    return null;
  });
  assert.ok(blank, 'real blank paper exists');
  await page.mouse.move(blank.x, blank.y); await page.mouse.down(); await ball(card); await page.mouse.up();
  await clickCard(card, 'Reset');
  r = (await grip.boundingBox())!;
  await page.mouse.move(r.x + 22, r.y + 22); await page.mouse.down();
  await card.locator('canvas').waitFor();
  await grip.dispatchEvent('pointercancel', { pointerId: 1 }); await page.mouse.up(); await intact(card);

  const touch = await open(t, '/notes', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const note = cards(touch).first(), touchGrip = note.getByRole('button', { name: 'Drag paper', exact: true });
  await touchGrip.scrollIntoViewIfNeeded(); r = (await touchGrip.boundingBox())!;
  const cdp = await touch.context().newCDPSession(touch);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: r.x + 22, y: r.y + 22 }] });
  await ball(note);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await cdp.detach();
  await note.getByRole('button', { name: 'Reset', exact: true }).tap(); await intact(note);
  await touch.evaluate(() => scrollTo(0, 0));
  const b = (await note.boundingBox())!, scroll = await touch.evaluate(() => scrollY);
  await touchDrag(touch, b.x + b.width / 2, b.y + b.height / 2, 0, -160);
  await touch.waitForFunction(y => scrollY > y + 30, scroll);
  await intact(note);
  await touch.evaluate(() => scrollTo(0, 0));
  const corner = note.getByRole('button', { name: 'Drag corner', exact: true }); await corner.scrollIntoViewIfNeeded();
  r = (await corner.boundingBox())!; await touchDrag(touch, r.x + 22, r.y + 22, -45, 55);
  assert.equal(await note.getAttribute('data-paper-state'), 'peeled'); await intact(note);
});

test('renderer chunk loads only on first action; blocked import is a negative control with readable source and working recovery', async t => {
  const page = await open(t); const imports = paperImports(page, 'paper-fold-canvas');
  assert.deepEqual(await imports(), []);
  const card = cards(page).first(); await clickCard(card, 'Crumple'); await ball(card);
  const urls = await imports(); assert.ok(urls.length > 0, 'the action downloads an independently split renderer');
  const context = await browser.newContext(); t.after(() => context.close());
  const blocked = await context.newPage(); let rejected = 0;
  for (const url of urls) await blocked.route(url, route => { rejected++; return route.abort(); });
  await ready(blocked); const paper = cards(blocked).first();
  await clickCard(paper, 'Crumple');
  await blocked.waitForFunction(() => document.querySelector('[data-paper-message]')?.textContent?.includes('unavailable'));
  assert.ok(rejected > 0, 'actual renderer request blocked'); await intact(paper);
  await clickCard(paper, 'Read card');
  await clickCard(paper, 'Reset'); await intact(paper);

  // An import held in flight is released explicitly; no timer/soak proves this race.
  const delayedContext = await browser.newContext(); t.after(() => delayedContext.close());
  const delayed = await delayedContext.newPage();
  let release = () => {};
  const gate = new Promise<void>(resolve => { release = resolve; });
  t.after(() => release());
  for (const url of urls) await delayed.route(url, async route => { await gate; await route.continue(); });
  await ready(delayed); const pending = cards(delayed).first(); const loaded = paperImports(delayed, 'paper-fold-canvas');
  const requested = delayed.waitForRequest(request => urls.includes(request.url()), { timeout: 6000 });
  await clickCard(pending, 'Crumple'); await requested;
  await clickCard(pending, 'Read card'); await intact(pending);
  const delivered = delayed.waitForResponse(response => urls.includes(response.url())); release(); await delivered;
  assert.ok((await loaded()).length > 0, 'the delayed real module eventually loads');
  await delayed.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  await intact(pending);
});

test('null Canvas, thrown paint and context loss restore immediately; real renderer works again after recovery', async t => {
  const page = await open(t); const card = cards(page).first();
  for (const failure of ['null', 'paint', 'lost']) {
    await page.evaluate(mode => {
      const original = HTMLCanvasElement.prototype.getContext;
      const fill = CanvasRenderingContext2D.prototype.fill;
      Object.assign(window, { restoreCanvas: () => { HTMLCanvasElement.prototype.getContext = original; CanvasRenderingContext2D.prototype.fill = fill; } });
      if (mode === 'null') HTMLCanvasElement.prototype.getContext = (() => null) as typeof original;
      if (mode === 'paint') CanvasRenderingContext2D.prototype.fill = () => { throw new Error('blocked paint'); };
    }, failure);
    await clickCard(card, 'Crumple');
    if (failure === 'lost') { await ball(card); await card.locator('canvas').dispatchEvent('contextlost'); }
    await page.waitForFunction(() => document.querySelector('[data-paper-message]')?.textContent?.includes('unavailable'));
    await intact(card);
    await page.evaluate(() => (window as unknown as { restoreCanvas: () => void }).restoreCanvas());
    await clickCard(card, 'Crumple'); await ball(card);
    await clickCard(card, 'Reset'); await intact(card);
  }
});

test('reduced motion is instant static paint; eight slots cap balls and ninth source remains readable', async t => {
  const page = await open(t, '/projects', { reducedMotion: 'reduce' });
  assert.ok(await cards(page).count() >= 9, 'nine real opted-in project cards available');
  for (let i = 0; i < 8; i++) {
    const card = cards(page).nth(i);
    await card.getByRole('button', { name: 'Crumple', exact: true }).evaluate((b: HTMLButtonElement) => b.click()); await ball(card);
  }
  assert.equal(await page.locator('canvas.paper-fold-canvas').count(), 8);
  const ninth = cards(page).nth(8), original = await source(ninth);
  await ninth.getByRole('button', { name: 'Crumple', exact: true }).evaluate((b: HTMLButtonElement) => b.click());
  await intact(ninth); assert.deepEqual(await source(ninth), original);
  assert.match(await ninth.locator('[data-paper-message]').innerText(), /Eight paper balls/);
  await cards(page).first().getByRole('button', { name: 'Read card', exact: true }).evaluate((b: HTMLButtonElement) => b.click());
  await ninth.getByRole('button', { name: 'Crumple', exact: true }).evaluate((b: HTMLButtonElement) => b.click()); await ball(ninth);
  const pixels = await ninth.locator('canvas').evaluate((c: HTMLCanvasElement) => c.toDataURL());
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  assert.equal(await ninth.locator('canvas').evaluate((c: HTMLCanvasElement) => c.toDataURL()), pixels);
  await page.keyboard.press('Escape'); assert.equal(await page.locator('.paper-fold-canvas').count(), 0);
});

test('fold cancellation handles Escape, blur, hide, resize, modal, motion, removal and route departure without a late proxy', async t => {
  const page = await open(t);
  for (const action of ['escape', 'blur', 'hide', 'resize', 'modal', 'motion', 'remove', 'route']) {
    t.diagnostic(`fold cancellation: ${action}`);
    await ready(page); const card = cards(page).first();
    await clickCard(card, 'Crumple');
    await card.locator('canvas').waitFor();
    await page.evaluate(action => {
      if (action === 'escape') document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      if (action === 'blur' || action === 'resize') window.dispatchEvent(new Event(action));
      if (action === 'hide') { Object.defineProperty(document, 'hidden', { configurable: true, value: true }); document.dispatchEvent(new Event('visibilitychange')); }
      if (action === 'modal') { const dialog = document.createElement('dialog'); dialog.open = true; document.body.append(dialog); }
      if (action === 'remove') document.querySelector('[data-paper-id]')?.remove();
    }, action);
    if (action === 'motion') await page.emulateMedia({ reducedMotion: 'reduce' });
    if (action === 'route') { await page.getByRole('link', { name: 'Notes', exact: true }).first().click(); await page.waitForURL('**/notes'); }
    await page.waitForFunction(() => !document.querySelector('.paper-fold-canvas,[data-crumple-paint]'));
    if (action !== 'route' && action !== 'remove') await intact(card);
    if (action === 'remove') assert.equal(await card.getAttribute('data-crumple-paint'), null, 'remaining cards are readable');
  }
});

test('pointer cancellation and native text/context menus retain readable content and permit the next action', async t => {
  const page = await open(t, '/notes'); const card = cards(page).first();
  const grip = card.getByRole('button', { name: 'Drag paper', exact: true }); await grip.focus();
  for (const cancel of ['pointercancel', 'lostpointercapture', 'contextmenu']) {
    const r = (await grip.boundingBox())!;
    await page.mouse.move(r.x + 22, r.y + 22); await page.mouse.down();
    assert.equal(await grip.dispatchEvent(cancel, { pointerId: 1 }), undefined);
    await page.mouse.up(); await intact(card);
    await clickCard(card, 'Crumple'); await ball(card);
    await clickCard(card, 'Read card'); await intact(card);
  }
  const p = card.locator('p').first(); await p.scrollIntoViewIfNeeded();
  const r = await p.evaluate(el => { const range = document.createRange(); range.selectNodeContents(el); const b = range.getClientRects()[0]; return { x: b.x, y: b.y, width: b.width, height: b.height }; });
  await page.mouse.move(r.x + 4, r.y + r.height / 2); await page.mouse.down(); await page.mouse.move(r.x + 160, r.y + r.height / 2, { steps: 8 }); await page.mouse.up();
  assert.ok((await page.evaluate(() => getSelection()?.toString()))?.length, 'native prose selection survives');
  await intact(card);
  assert.equal(await p.evaluate(el => !el.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }))), false, 'browser context menu is not prevented');
});
