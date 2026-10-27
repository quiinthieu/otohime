// QA-only instrumentation: actual compiled Next, two Chrome processes, fake local fan-out.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { writeFileSync, openSync } from 'node:fs';
import { startGhostsFake } from '../../../../scripts/ghosts-fake.mjs';
import { launchBrowser } from '../../../../scripts/probe-browser.mjs';

const dir = import.meta.dirname;
const base = 'http://localhost:4328';
const fake = await startGhostsFake({ origins: base });
const ctl = fake.url.replace('ws:', 'http:').replace('/ghosts', '');
const results = { observedAt: new Date().toISOString(), boundary: 'Real production Next handler and canvas in two Chrome processes; local fake WebSocket fan-out. Synthetic pointers only.', cases: [] };
const browsers = [];
let server;
async function start(endpoint) {
  server = spawn(process.execPath, ['node_modules/next/dist/bin/next','start','--hostname','localhost','--port','4328'], {
    env: { ...process.env, GHOSTS_ENDPOINT: endpoint, BETTER_AUTH_URL: base, BETTER_AUTH_SECRET: 'ci-placeholder-not-a-real-secret-0123456789abcdef' },
    stdio: ['ignore', openSync(`${dir}/independent-server.log`,'a'), openSync(`${dir}/independent-server.err`,'a')],
  });
  await new Promise((resolve,reject) => {
    let attempts = 0;
    async function ready() {
      try { const response = await fetch(`${base}/api/ghosts`); if ([200,404].includes(response.status)) return resolve(); } catch {}
      if (++attempts >= 50 || server.exitCode !== null) return reject(new Error('Next did not start'));
      setTimeout(ready,100);
    }
    void ready();
  });
}
async function stop() { if (server && server.exitCode === null) { const end = once(server,'exit'); server.kill('SIGTERM'); await end; } }
async function control(path) { const r = await fetch(ctl + path, { method: 'POST' }); assert.equal(r.status,200); }
async function open(browser, room, options = {}, suppress = false) {
  const context = await browser.newContext({ viewport: { width: 960,height:720 }, deviceScaleFactor:2, reducedMotion:'no-preference', ...options });
  await context.addInitScript(({ suppress }) => {
    window.qaInk = { strokes:0, fills:0, arcs:0, paints:0 };
    for (const key of ['stroke','fill','arc','clearRect']) {
      const native = CanvasRenderingContext2D.prototype[key];
      CanvasRenderingContext2D.prototype[key] = function(...args) {
        const ghost = this.canvas.closest('[data-ghosts-state]');
        if (ghost) {
          if (key === 'stroke') window.qaInk.strokes++;
          if (key === 'fill') window.qaInk.fills++;
          if (key === 'arc') window.qaInk.arcs++;
          if (key === 'clearRect') window.qaInk.paints++;
          if (suppress && (key === 'stroke' || key === 'fill')) return;
        }
        return native.apply(this,args);
      };
    }
  }, { suppress });
  const page = await context.newPage();
  const errors = [], sockets = [], configs = [];
  page.on('pageerror', e=>errors.push(String(e)));
  page.on('console', m=>{ if(m.type()==='error') errors.push(m.text()); });
  page.on('websocket', socket=>sockets.push(socket.url()));
  page.on('response', r=>{if(r.url().includes('/api/ghosts')) configs.push({url:r.url(),status:r.status()});});
  assert.equal((await page.goto(base+room)).status(),200);
  await page.waitForSelector('[data-ghosts-state]');
  return {context,page,errors,sockets,configs};
}
async function state(p, value) { await p.waitForSelector(`[data-ghosts-state="${value}"]`); }
async function pixels(p, box) {
  return p.locator('[data-ghosts-state] canvas').evaluate((canvas,box) => {
    const ratio=canvas.width/innerWidth;
    const [x,y,w,h] = box ?? [0,0,innerWidth,innerHeight];
    const bytes=canvas.getContext('2d').getImageData(Math.round(x*ratio),Math.round(y*ratio),Math.max(1,Math.round(w*ratio)),Math.max(1,Math.round(h*ratio))).data;
    let count=0; for(let i=3;i<bytes.length;i+=4) if(bytes[i])count++;
    return count;
  },box);
}
async function waitInk(p) { await p.waitForFunction(()=>{
  const c=document.querySelector('[data-ghosts-state] canvas'); return c && c.getContext('2d').getImageData(0,0,c.width,c.height).data.some((v,i)=>i%4===3&&v>0);
}); }
async function member(p,n){await p.waitForSelector(`[data-ghosts="${n}"][data-ghosts-state="on"]`);}
async function drawCount(p){return Number(await p.locator('[data-ghosts-state]').getAttribute('data-ghosts-ripples'));}
try {
  await start(fake.url);
  for(let i=0;i<2;i++) browsers.push(await launchBrowser());
  results.browserVersions=browsers.map(b=>b.version());
  const response=await fetch(base+'/api/ghosts');
  assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');
  results.config=await response.json();assert.equal(results.config.endpoint,fake.url);
  const pairs = [];
  for(const room of ['/','/ryugu']) {
    const a=await open(browsers[0],room), b=await open(browsers[1],room);
    await member(a.page,1);await member(b.page,1);
    assert.equal(await pixels(b.page),0,'membership alone draws no marks');
    await a.page.mouse.move(220,330);await waitInk(b.page);
    assert.ok(await pixels(b.page,[205,310,35,40])>0,'tip is at normalized peer coordinates');
    for(const x of [255,290,325]) {await a.page.mouse.move(x,330);await a.page.waitForTimeout(110);}
    const trail=await pixels(b.page,[245,310,20,40]);assert.ok(trail>0,'previous point has visible trail');
    await b.page.waitForFunction(()=>window.qaInk.paints>1);
    await b.page.waitForTimeout(750);
    assert.equal(await pixels(b.page,[245,310,20,40]),0,'old trail fades');
    assert.ok(await pixels(b.page,[310,310,35,40])>0,'tip survives fading trail');
    const idlePaints=await b.page.evaluate(()=>window.qaInk.paints);
    await b.page.waitForTimeout(150);
    assert.equal(await b.page.evaluate(()=>window.qaInk.paints),idlePaints,'no animation frames while only a silent tip remains');
    const local=await drawCount(a.page),remote=await drawCount(b.page);
    await a.page.mouse.click(450,460);
    await a.page.waitForFunction(n=>Number(document.querySelector('[data-ghosts-state]').dataset.ghostsRipples)>n,local);
    await b.page.waitForFunction(n=>Number(document.querySelector('[data-ghosts-state]').dataset.ghostsRipples)>n,remote);
    assert.ok(await pixels(a.page,[410,420,80,80])>0,'local ripple actually paints');
    assert.ok(await pixels(b.page,[410,420,80,80])>0,'peer ripple actually paints');
    const geometry=await b.page.locator('[data-ghosts-state] canvas').evaluate(c=>{
      const r=c.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,width:c.width,height:c.height,events:getComputedStyle(c).pointerEvents,hidden:c.parentElement.getAttribute('aria-hidden'),live:c.parentElement.getAttribute('aria-live')};
    });
    assert.deepEqual(geometry,{x:0,y:0,w:960,h:720,width:1440,height:1080,events:'none',hidden:'true',live:null});
    await b.page.setViewportSize({width:800,height:600});
    await b.page.waitForFunction(()=>document.querySelector('[data-ghosts-state] canvas').width===1200);
    results.cases.push({room,peerPixels:true,trailPixels:trail,idlePaintsStable:true,localRipple:true,peerRipple:true,geometry,errors:[...a.errors,...b.errors]});
    assert.deepEqual([...a.errors,...b.errors],[]);
    pairs.push([a,b]);
  }
  // Home's new click must never affect either palace canvas.
  await pairs[1][1].page.waitForTimeout(750);
  const otherRoom=await drawCount(pairs[1][1].page);
  await pairs[0][0].page.mouse.click(600,520);
  await pairs[0][1].page.waitForFunction(()=>window.qaInk.arcs>0);
  assert.equal(await drawCount(pairs[1][1].page),otherRoom);
  results.cases.push({crossRoomIsolation:true});
  // A real Home control still navigates while ink is mounted.
  await pairs[0][0].page.locator('a[data-pocket-ryugu]').click();
  await pairs[0][0].page.waitForURL(base+'/ryugu');
  await member(pairs[0][1].page,0);
  results.cases.push({homeControlNavigation:true,leavePresence:true});
  for(const pair of pairs)for(const p of pair)await p.context.close();
  await control('/__reset');

  const reduced=await open(browsers[0],'/ryugu',{reducedMotion:'reduce'});
  await state(reduced.page,'off');assert.deepEqual(reduced.sockets,[]);assert.deepEqual(reduced.configs,[]);assert.equal(await pixels(reduced.page),0);
  await reduced.page.emulateMedia({reducedMotion:'no-preference'});await state(reduced.page,'on');
  await reduced.page.emulateMedia({reducedMotion:'reduce'});await state(reduced.page,'off');assert.equal(await pixels(reduced.page),0);
  results.cases.push({reducedInitial:true,reducedChange:true});await reduced.context.close();

  const offline=await open(browsers[0],'/');await state(offline.page,'on');
  await offline.context.setOffline(true);await state(offline.page,'off');assert.equal(await pixels(offline.page),0);
  await offline.context.setOffline(false);await state(offline.page,'on');
  await offline.page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});
  await state(offline.page,'off');assert.equal(await pixels(offline.page),0);
  await offline.page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:false});document.dispatchEvent(new Event('visibilitychange'));});
  await state(offline.page,'on');
  await offline.page.goto(base+'/articles');assert.equal(await offline.page.locator('[data-ghosts-state]').count(),0);
  results.cases.push({offlineCleanup:true,syntheticHiddenCleanup:true,unmount:true});await offline.context.close();

  // Deliberately remove native paint: transport and draw counters cannot certify visible output.
  const controlPage=await open(browsers[0],'/ryugu',{},true);await state(controlPage.page,'on');
  await controlPage.page.mouse.click(510,390);
  await controlPage.page.waitForFunction(()=>window.qaInk.arcs>0);
  let rejected=false;try{assert.ok(await pixels(controlPage.page)>0,'visible ink required');}catch{rejected=true;}
  assert.equal(rejected,true);results.cases.push({negativeControl:'suppress native stroke/fill',assertionRejected:rejected,pixels:await pixels(controlPage.page),drawCounter:await drawCount(controlPage.page)});
  await controlPage.context.close();await control('/__reset');
  for(const mode of ['full','flap']){
    await control('/__mode?m='+mode);
    const p=await open(browsers[0],'/');await state(p.page,'gone');
    assert.equal(p.sockets.length,mode==='full'?1:3);assert.equal(await pixels(p.page),0);
    results.cases.push({mode,attempts:p.sockets.length,quietPixels:true});await p.context.close();await control('/__reset');
  }
  await stop();await start('');
  const unset=await fetch(base+'/api/ghosts');assert.equal(unset.status,404);assert.equal(await unset.text(),'');assert.equal(unset.headers.get('cache-control'),'no-store');
  const p=await open(browsers[0],'/');await state(p.page,'off');assert.deepEqual(p.sockets,[]);assert.equal(await pixels(p.page),0);assert.deepEqual(p.errors,[]);
  results.cases.push({unset404:true,noStore:true,quietPage:true,probe:p.configs});await p.context.close();
  results.pass=true;
} catch(error) {results.error=String(error.stack??error);throw error;}
finally {writeFileSync(`${dir}/independent-results.json`,JSON.stringify(results,null,2)+'\n');for(const b of browsers)await b.close();await stop();await fake.close();}
