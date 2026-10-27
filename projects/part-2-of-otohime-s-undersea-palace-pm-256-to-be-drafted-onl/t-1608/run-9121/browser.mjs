// Independent QA of the delivered production UI. No supplied browser proof is reused.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { openSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { startGhostsFake } from '../../../../scripts/ghosts-fake.mjs';
import { launchBrowser } from '../../../../scripts/probe-browser.mjs';

const out = import.meta.dirname;
const base = 'http://127.0.0.1:3217', disabled = 'http://127.0.0.1:3218';
const servers = [], results = [], errors = [], resourceErrors = [];
let browser, fake;
const observe = (name, detail) => { results.push({ name, ...detail }); console.log(name, JSON.stringify(detail)); };
const wait = ms => new Promise(r => setTimeout(r, ms));
async function start(port, endpoint) {
  const child = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', String(port)], {
    cwd: resolve('.'), stdio: ['ignore', openSync(`${out}/server-${port}.log`, 'w'), openSync(`${out}/server-${port}.err`, 'w')],
    env: { ...process.env, BETTER_AUTH_SECRET: 'qa-local-fixture-not-real-secret-0123456789abcdef', BETTER_AUTH_URL: `http://127.0.0.1:${port}`, GHOSTS_ENDPOINT: endpoint },
  });
  servers.push(child);
  for (let i = 0; i < 80; i++) {
    try { const r = await fetch(`http://127.0.0.1:${port}/api/ghosts`); if ([200, 404].includes(r.status)) return; } catch {}
    if (child.exitCode !== null) throw Error(`server exited ${child.exitCode}`);
    await wait(100);
  }
  throw Error('own Next server failed to start');
}
async function context({ motion = 'no-preference', noPaint = false } = {}) {
  const c = await browser.newContext({ viewport: { width: 960, height: 720 }, deviceScaleFactor: 2, reducedMotion: motion });
  await c.addInitScript(({ noPaint }) => {
    window.__inkQA = { sockets: [], draws: 0, arcs: 0, lines: 0 };
    const Original = window.WebSocket;
    window.WebSocket = class extends Original {
      constructor(url, ...args) {
        super(url, ...args);
        const record = { url: String(url), sent: [], closed: false, received: [] };
        window.__inkQA.sockets.push(record);
        this.addEventListener('close', e => { record.closed = true; record.code = e.code; });
        this.addEventListener('message', e => record.received.push(e.data));
        const send = this.send.bind(this);
        this.send = data => { record.sent.push({ at: performance.now(), data }); return send(data); };
      }
    };
    for (const name of ['clearRect', 'stroke', 'fill', 'arc', 'lineTo']) {
      const orig = CanvasRenderingContext2D.prototype[name];
      CanvasRenderingContext2D.prototype[name] = function (...args) {
        if (this.canvas.closest('[data-ghosts-state]')) {
          if (name === 'clearRect') window.__inkQA.draws++;
          if (name === 'arc') window.__inkQA.arcs++;
          if (name === 'lineTo') window.__inkQA.lines++;
          if (noPaint && ['stroke', 'fill'].includes(name)) return;
        }
        return orig.apply(this, args);
      };
    }
  }, { noPaint });
  const p = await c.newPage();
  p.on('pageerror', e => errors.push(String(e)));
  p.on('console', msg => { if (msg.type() === 'error') resourceErrors.push({ message: msg.text(), url: msg.location().url }); });
  return { c, p };
}
const layer = '[data-ghosts-state]';
async function state(p, value) { await p.waitForFunction(v => document.querySelector('[data-ghosts-state]')?.dataset.ghostsState === v, value); }
async function pixels(p) {
  return p.locator(`${layer} canvas`).evaluate(c => {
    const bytes = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let count = 0; for (let i = 3; i < bytes.length; i += 4) if (bytes[i]) count++;
    return count;
  });
}
async function until(p, fn) { await p.waitForFunction(fn, null, { timeout: 12000 }); }
const hasPixels = p => until(p, () => {
  const c = document.querySelector('[data-ghosts-state] canvas');
  return c && c.getContext('2d').getImageData(0, 0, c.width, c.height).data.some((v, i) => i % 4 === 3 && v > 0);
});

try {
  fake = await startGhostsFake({ origins: [base, disabled], logCap: 3000 });
  await start(3217, fake.url); await start(3218, '');
  browser = await launchBrowser();
  observe('identity', { browser: browser.version(), node: process.version, build: readFileSync('.next/BUILD_ID', 'utf8'), endpoint: fake.url });
  const configured = await fetch(`${base}/api/ghosts`);
  assert.equal(configured.status, 200); assert.equal(configured.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await configured.json(), { endpoint: fake.url, rooms: ['/', '/ryugu'] });
  const off = await fetch(`${disabled}/api/ghosts`);
  assert.equal(off.status, 404); assert.equal(off.headers.get('cache-control'), 'no-store'); assert.equal(await off.text(), '');
  observe('real-runtime-route', { configured: 200, unset: 404, noStore: true, sameBuildDifferentRuntime: true });

  for (const room of ['/', '/ryugu']) {
    fake.reset();
    const a = await context(), b = await context(), other = await context();
    await a.p.goto(base + room); await b.p.goto(base + room);
    await other.p.goto(base + (room === '/' ? '/ryugu' : '/'));
    await Promise.all([state(a.p, 'on'), state(b.p, 'on'), state(other.p, 'on')]);
    await until(b.p, () => document.querySelector('[data-ghosts-state]').dataset.ghosts === '1');
    assert.equal(await b.p.locator(`${layer} span`).textContent(), '1 here');
    assert.equal(await other.p.locator(`${layer} span`).count(), 0);
    for (const p of [a.p, b.p]) {
      const geometry = await p.locator(layer).evaluate(el => {
        const r = el.getBoundingClientRect(), c = el.querySelector('canvas');
        return { x: r.x, y: r.y, w: r.width, h: r.height, pixelsW: c.width, pixelsH: c.height, events: getComputedStyle(el).pointerEvents, hidden: el.getAttribute('aria-hidden'), focusable: el.querySelectorAll('a,button,input,[tabindex]').length };
      });
      assert.deepEqual(geometry, { x: 0, y: 0, w: 960, h: 720, pixelsW: 1440, pixelsH: 1080, events: 'none', hidden: 'true', focusable: 0 });
    }
    await a.p.mouse.move(150, 280);
    await a.p.mouse.move(430, 400, { steps: 16 });
    await hasPixels(b.p);
    await until(b.p, () => window.__inkQA.lines > 0);
    const trailPixels = await pixels(b.p);
    assert.equal(await pixels(other.p), 0, 'other room must not draw peer');
    await a.p.mouse.click(780, 600);
    await Promise.all([until(a.p, () => window.__inkQA.arcs > 0), until(b.p, () => window.__inkQA.arcs > 0)]);
    const local = await pixels(a.p), remote = await pixels(b.p);
    assert.ok(local > 0 && remote > 0);
    await until(b.p, () => {
      const s = document.querySelector('[data-ghosts-state]');
      return Number(s.dataset.ghostsRipples) > 0;
    });
    // Wait for event-driven fading to stop, then inspect for an idle painter.
    await b.p.waitForTimeout(850);
    const draws = await b.p.evaluate(() => window.__inkQA.draws);
    await b.p.waitForTimeout(180);
    assert.equal(await b.p.evaluate(() => window.__inkQA.draws), draws);
    const tip = await pixels(b.p); assert.ok(tip > 0 && tip < remote);
    await b.p.setViewportSize({ width: 800, height: 600 });
    await until(b.p, () => document.querySelector('[data-ghosts-state] canvas').width === 1200);
    assert.equal(await b.p.locator(`${layer} canvas`).evaluate(c => c.height), 900);
    // A real media change closes the real browser socket and clears the canvas.
    await a.p.emulateMedia({ reducedMotion: 'reduce' }); await state(a.p, 'off');
    assert.equal(await pixels(a.p), 0);
    await until(a.p, () => window.__inkQA.sockets.every(s => s.closed));
    await until(b.p, () => document.querySelector('[data-ghosts-state]').dataset.ghosts === '0');
    await until(b.p, () => {
      const c = document.querySelector('[data-ghosts-state] canvas');
      return !c.getContext('2d').getImageData(0, 0, c.width, c.height).data.some((v, i) => i % 4 === 3 && v > 0);
    });
    assert.equal(await pixels(b.p), 0, 'departure removes tip');
    // Controls receive pointer and keyboard input through the decorative overlay.
    const button = room === '/' ? b.p.getByRole('button', { name: /theme/i }).first() : b.p.locator('button').first();
    await button.click();
    await b.p.waitForFunction(() => !document.documentElement.matches(':active-view-transition'));
    await button.focus(); await b.p.keyboard.press('Space');
    await b.p.waitForFunction(() => !document.documentElement.matches(':active-view-transition'));
    assert.equal(await button.evaluate(el => el === document.activeElement), true);
    const sends = await a.p.evaluate(() => window.__inkQA.sockets.flatMap(s => s.sent).map(x => ({ at: x.at, ...JSON.parse(x.data) })).filter(x => x.t === 'm'));
    assert.ok(sends.length >= 2);
    assert.ok(sends.every(m => m.x >= 0 && m.x <= 1 && m.y >= 0 && m.y <= 1));
    for (let i = 1; i < sends.length; i++) assert.ok(sends[i].at - sends[i - 1].at >= 99);
    observe(`room ${room}`, { trailPixels, localRipplePixels: local, remoteRipplePixels: remote, tipPixelsAfterFade: tip, idlePaintStable: true, crossRoomPixels: 0, reducedMotionCloses: true, usableControls: true, moves: sends.length });
    await Promise.all([a.c.close(), b.c.close(), other.c.close()]);
  }

  fake.reset();
  const neg = await context({ noPaint: true }); await neg.p.goto(base); await state(neg.p, 'on');
  await neg.p.mouse.click(780, 600); await until(neg.p, () => window.__inkQA.arcs > 0);
  const suppressedPixels = await pixels(neg.p);
  let rejected = false; try { assert.ok(suppressedPixels > 0, 'visible ink required'); } catch { rejected = true; }
  assert.ok(rejected); observe('negative-control-no-paint', { actualPaintOpsSuppressed: true, arcs: await neg.p.evaluate(() => window.__inkQA.arcs), pixels: suppressedPixels, visibleInkAssertionRejected: rejected });
  await neg.c.close();

  for (const room of ['/', '/ryugu']) {
    const reduced = await context({ motion: 'reduce' }); await reduced.p.goto(base + room); await state(reduced.p, 'off');
    await reduced.p.mouse.click(780, 600);
    assert.equal(await pixels(reduced.p), 0); assert.equal(await reduced.p.evaluate(() => window.__inkQA.sockets.length), 0);
    await reduced.c.close();
    const unset = await context();
    const configReply = unset.p.waitForResponse(r => new URL(r.url()).pathname === '/api/ghosts');
    await unset.p.goto(disabled + room); assert.equal((await configReply).status(), 404); await state(unset.p, 'off');
    await unset.p.mouse.click(780, 600); assert.equal(await pixels(unset.p), 0); assert.equal(await unset.p.evaluate(() => window.__inkQA.sockets.length), 0);
    await unset.c.close();
    observe(`quiet ${room}`, { initialReduced: 'off/zero sockets/zero pixels', unset: 'off/zero sockets/zero pixels' });
  }

  fake.reset(); fake.setMode('full');
  const full = await context(); await full.p.goto(base); await state(full.p, 'gone');
  assert.equal(await full.p.evaluate(() => window.__inkQA.sockets.length), 1); assert.equal(await pixels(full.p), 0);
  await full.c.close(); observe('full', { attempts: 1, state: 'gone', pixels: 0 });
  fake.reset(); fake.setMode('refuse');
  const lost = await context(); await lost.p.goto(base); await state(lost.p, 'gone');
  const retry = await lost.p.evaluate(() => window.__inkQA.sockets);
  assert.equal(retry.length, 3); assert.equal(await pixels(lost.p), 0);
  await lost.c.close(); observe('retryable-refusal', { attempts: retry.length, state: 'gone', pixels: 0 });

  fake.reset();
  const disconnected = await context(); await disconnected.p.goto(base); await state(disconnected.p, 'on');
  await disconnected.p.mouse.click(780, 600); await hasPixels(disconnected.p);
  fake.reset(); fake.setMode('refuse');
  await state(disconnected.p, 'gone');
  assert.equal(await disconnected.p.evaluate(() => window.__inkQA.sockets.length), 3);
  assert.equal(await pixels(disconnected.p), 0);
  await disconnected.c.close(); observe('connection-lost-after-paint', { attempts: 3, state: 'gone', pixels: 0 });

  fake.reset();
  const offline = await context(); await offline.p.goto(base); await state(offline.p, 'on');
  await offline.c.setOffline(true); await state(offline.p, 'off');
  assert.equal(await pixels(offline.p), 0); await until(offline.p, () => window.__inkQA.sockets.every(s => s.closed));
  await offline.c.setOffline(false); await state(offline.p, 'on');
  // Test the actual visibility listener with a synthetic document eligibility transition.
  await offline.p.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: true }); document.dispatchEvent(new Event('visibilitychange')); });
  await state(offline.p, 'off'); assert.equal(await pixels(offline.p), 0);
  await until(offline.p, () => window.__inkQA.sockets.every(s => s.closed));
  await offline.c.close(); observe('cleanup', { realOffline: true, realOnlineResume: true, syntheticHidden: true });
  assert.deepEqual(errors, []);
  observe('page-errors', { errors });
} finally {
  writeFileSync(`${out}/browser-results.json`, JSON.stringify({ results, errors, resourceErrors, boundary: 'Real locked Next production server, Chrome, canvas and browser WebSockets; local fake fan-out; hidden transition synthetic; no hosted Worker claim.' }, null, 2) + '\n');
  await browser?.close(); await fake?.close();
  for (const child of servers) child.kill('SIGTERM');
}
