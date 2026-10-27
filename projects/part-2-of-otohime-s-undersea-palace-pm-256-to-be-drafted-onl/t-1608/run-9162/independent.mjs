// QA probe, separate from the delivered tests and earlier proof scripts.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { openSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { startGhostsFake } from '../../../../scripts/ghosts-fake.mjs';
import { launchBrowser } from '../../../../scripts/probe-browser.mjs';

const port = await new Promise(resolve => {
  const s = createServer().listen(0, '127.0.0.1', () => {
    const p = s.address().port; s.close(() => resolve(p));
  });
});
const base = `http://localhost:${port}`;
const fake = await startGhostsFake({ origins: base });
const ctl = fake.url.replace('ws:', 'http:').replace('/ghosts', '');
const result = { at: new Date().toISOString(), boundary: 'Real compiled Next, native canvas, two Chrome processes; fake local WebSocket relay; scripted input. No hosted Worker.', cases: [] };
const browsers = [];
let server;
async function start(endpoint) {
  server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', 'localhost', '--port', String(port)], {
    env: { ...process.env, GHOSTS_ENDPOINT: endpoint, BETTER_AUTH_URL: base, BETTER_AUTH_SECRET: 'qa-fixture-placeholder-0123456789abcdef' },
    stdio: ['ignore', openSync(`${import.meta.dirname}/server.log`, 'a'), openSync(`${import.meta.dirname}/server.err`, 'a')],
  });
  // Readiness of the process this probe just started, bounded to five seconds.
  for (let i = 0; i < 50; i++) {
    try { const r = await fetch(base + '/api/ghosts'); if ([200,404].includes(r.status)) return; } catch {}
    assert.equal(server.exitCode, null, 'Next must remain alive');
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('Next startup failed');
}
async function stop() {
  if (server?.exitCode === null) { const end = once(server, 'exit'); server.kill('SIGTERM'); await end; }
}
async function control(path) { assert.equal((await fetch(ctl + path, { method: 'POST' })).status, 200); }
async function open(browser, room, options = {}, fallback = false) {
  const context = await browser.newContext({ viewport: { width: 960, height: 720 }, deviceScaleFactor: 2, reducedMotion: 'no-preference', ...options });
  await context.addInitScript(({ fallback }) => {
    window.qaGhost = { drop: false, suppressed: 0, clears: 0, lastClear: 0 };
    if (fallback) { delete window.requestIdleCallback; delete window.cancelIdleCallback; }
    const send = WebSocket.prototype.send;
    WebSocket.prototype.send = function(data) {
      if (window.qaGhost.drop && /\/ghosts\?/.test(this.url)) { window.qaGhost.suppressed++; return; }
      return send.call(this, data);
    };
    const clear = CanvasRenderingContext2D.prototype.clearRect;
    CanvasRenderingContext2D.prototype.clearRect = function(...args) {
      if (this.canvas.closest('[data-ghosts-state]')) {
        window.qaGhost.clears++; window.qaGhost.lastClear = performance.now();
      }
      return clear.apply(this, args);
    };
  }, { fallback });
  const page = await context.newPage(), errors = [], sockets = [], configs = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('websocket', s => sockets.push(s.url()));
  page.on('response', r => { if (new URL(r.url()).pathname === '/api/ghosts') configs.push(r.status()); });
  assert.equal((await page.goto(base + room)).status(), 200);
  await page.waitForSelector('[data-ghosts-state]');
  return { page, context, errors, sockets, configs };
}
async function state(p, s, n) {
  await p.waitForSelector(`[data-ghosts-state="${s}"]${n === undefined ? '' : `[data-ghosts="${n}"]`}`);
}
async function ink(p, box = [0,0,960,720]) {
  return p.locator('[data-ghosts-state] canvas').evaluate((c, b) => {
    const r = c.width / innerWidth;
    const d = c.getContext('2d').getImageData(...b.map((n,i) => Math.max(i > 1 ? 1 : 0, Math.round(n*r)))).data;
    let pixels = 0; for (let i=3;i<d.length;i+=4) if (d[i]) pixels++;
    return pixels;
  }, box);
}
async function inkAt(p, box, present) {
  await p.waitForFunction(({box, present}) => {
    const c = document.querySelector('[data-ghosts-state] canvas'), r = c.width / innerWidth;
    const data = c.getContext('2d').getImageData(...box.map((v,i) => Math.max(i > 1 ? 1 : 0, Math.round(v*r)))).data;
    return data.some((v,i) => i%4 === 3 && v > 0) === present;
  }, {box, present});
}
async function frames(p, count = 8) {
  await p.evaluate(count => new Promise(resolve => { const next = () => --count ? requestAnimationFrame(next) : resolve(); requestAnimationFrame(next); }), count);
}
try {
  await start(fake.url);
  const config = await fetch(base + '/api/ghosts');
  assert.equal(config.status, 200); assert.equal(config.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await config.json(), { endpoint: fake.url, rooms: ['/','/ryugu'] });
  browsers.push(await launchBrowser(), await launchBrowser());
  result.browserVersions = browsers.map(b => b.version());
  for (const room of ['/','/ryugu']) {
    const a = await open(browsers[0], room), b = await open(browsers[1], room, {}, true);
    const isolated = await open(browsers[0], room === '/' ? '/ryugu' : '/');
    await state(a.page, 'on', 1); await state(b.page, 'on', 1); await state(isolated.page, 'on', 0);
    assert.equal(await ink(b.page), 0, 'membership alone must remain blank');
    // Negative control: local clicks can draw while the outgoing event is intentionally lost.
    await a.page.evaluate(() => { window.qaGhost.drop = true; });
    await a.page.mouse.click(600, 480);
    await inkAt(a.page, [565,445,70,70], true);
    await frames(b.page);
    assert.ok(await a.page.evaluate(() => window.qaGhost.suppressed) > 0);
    const remotePixels = await ink(b.page);
    let rejected = false;
    try { assert.ok(remotePixels > 0, 'peer-visible output required'); } catch { rejected = true; }
    assert.equal(rejected, true);
    const localCounter = await a.page.locator('[data-ghosts-state]').getAttribute('data-ghosts-ripples');
    assert.ok(Number(localCounter) > 0);
    result.cases.push({ room, negativeControl: 'drop actual outgoing socket frames', peerAssertionRejected: rejected, remotePixels, localCounter });
    await a.page.evaluate(() => { window.qaGhost.drop = false; });
    await a.page.mouse.move(250, 330); await inkAt(b.page, [235,315,30,30], true);
    await a.page.waitForTimeout(110); // Exercise the declared 100ms movement boundary.
    await a.page.mouse.move(360, 330); await inkAt(b.page, [345,315,30,30], true);
    assert.ok(await ink(b.page, [235,315,30,30]) > 0, 'previous tip forms a real trail');
    await inkAt(b.page, [235,315,30,30], false);
    assert.ok(await ink(b.page, [345,315,30,30]) > 0, 'stationary tip remains after its trail');
    // The newer point has its own animation lifetime; observe actual idle drawing.
    await b.page.waitForFunction(() => performance.now() - window.qaGhost.lastClear > 120);
    const before = await b.page.evaluate(() => window.qaGhost.clears);
    await frames(b.page, 20);
    assert.equal(await b.page.evaluate(() => window.qaGhost.clears), before, 'ghost drawing sleeps with a stationary tip');
    await a.page.mouse.click(460, 490);
    await inkAt(a.page, [425,455,70,70], true); await inkAt(b.page, [425,455,70,70], true);
    assert.equal(await ink(isolated.page), 0, 'the other room receives no mark');
    const geometry = await b.page.locator('[data-ghosts-state] canvas').evaluate(c => {
      const r = c.getBoundingClientRect(); return {x:r.x,y:r.y,w:r.width,h:r.height,width:c.width,height:c.height,events:getComputedStyle(c).pointerEvents,hidden:c.parentElement.getAttribute('aria-hidden'),live:c.parentElement.getAttribute('aria-live')};
    });
    assert.deepEqual(geometry, {x:0,y:0,w:960,h:720,width:1440,height:1080,events:'none',hidden:'true',live:null});
    await b.page.setViewportSize({width:800,height:600});
    await b.page.waitForFunction(() => document.querySelector('[data-ghosts-state] canvas').width === 1200);
    const link = a.page.locator(room === '/' ? 'a[data-pocket-ryugu]' : 'a[data-surface]');
    await link.click(); await a.page.waitForURL(base + (room === '/' ? '/ryugu' : '/'));
    await state(b.page, 'on', 0);
    assert.deepEqual([...a.errors,...b.errors,...isolated.errors], []);
    result.cases.push({room,peerTip:true,fadingTrail:true,idleDrawingStopped:true,localAndPeerRipplePixels:true,roomIsolation:true,geometry,resizedDprCap:true,controlNavigated:true,errors:[]});
    for (const c of [a,b,isolated]) await c.context.close();
    await control('/__reset');
  }
  for (const room of ['/','/ryugu']) {
    const p = await open(browsers[0], room, {reducedMotion:'reduce'});
    await state(p.page,'off'); await frames(p.page);
    assert.deepEqual(p.sockets,[]); assert.deepEqual(p.configs,[]); assert.equal(await ink(p.page),0);
    await p.page.emulateMedia({reducedMotion:'no-preference'}); await state(p.page,'on');
    await p.page.mouse.click(510,460); await inkAt(p.page,[475,425,70,70],true);
    await p.page.emulateMedia({reducedMotion:'reduce'}); await state(p.page,'off');
    assert.equal(await ink(p.page),0,'dynamic reduced motion clears native pixels');
    await p.page.emulateMedia({reducedMotion:'no-preference'}); await state(p.page,'on');
    await p.context.setOffline(true); await state(p.page,'off'); assert.equal(await ink(p.page),0);
    await p.context.setOffline(false); await state(p.page,'on');
    await p.page.evaluate(() => { Object.defineProperty(document,'hidden',{configurable:true,value:true}); document.dispatchEvent(new Event('visibilitychange')); });
    await state(p.page,'off'); assert.equal(await ink(p.page),0);
    await p.page.goto(base+'/articles'); assert.equal(await p.page.locator('[data-ghosts-state]').count(),0);
    assert.deepEqual(p.errors,[]);
    result.cases.push({room,initialReducedNoFetchOrSocket:true,dynamicReducedClears:true,onlineReconnect:true,offlineClears:true,syntheticHiddenClears:true,unmount:true});
    await p.context.close(); await control('/__reset');
  }
  for (const mode of ['full','flap']) {
    await control('/__mode?m='+mode);
    const p = await open(browsers[0], '/ryugu'); await state(p.page,'gone');
    assert.equal(p.sockets.length, mode === 'full' ? 1 : 3); assert.equal(await ink(p.page),0);
    result.cases.push({mode,attempts:p.sockets.length,noInk:true});
    await p.context.close(); await control('/__reset');
  }
  for (const endpoint of ['', 'wss://bad.example/ghosts?unexpected=1']) {
    await stop(); await start(endpoint);
    for (const [path,status,body] of [['/api/ghosts',404,''],['/api/ghosts?probe=1',200,'null']]) {
      const r = await fetch(base+path); assert.equal(r.status,status); assert.equal(await r.text(),body); assert.equal(r.headers.get('cache-control'),'no-store');
    }
    const p=await open(browsers[0],'/'); await state(p.page,'off'); await frames(p.page);
    assert.deepEqual(p.sockets,[]); assert.deepEqual(p.errors,[]); assert.equal(await ink(p.page),0);
    result.cases.push({config:endpoint?'malformed':'unset',direct404:true,probeNull:true,noStore:true,noSocketOrInk:true});
    await p.context.close();
  }
  result.pass = true;
} catch (error) { result.error=String(error.stack ?? error); throw error; }
finally {
  writeFileSync(`${import.meta.dirname}/independent-results.json`, JSON.stringify(result,null,2)+'\n');
  for (const b of browsers) await b.close(); await stop(); await fake.close();
}
