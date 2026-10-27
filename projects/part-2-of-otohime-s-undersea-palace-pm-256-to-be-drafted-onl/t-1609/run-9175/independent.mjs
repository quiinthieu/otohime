// Independent QA: native browser storage, wire events and canvas pixels.
// Only the self-owned relay is fake. Does not configure any deployed environment.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {createServer} from 'node:net';
import {writeFileSync} from 'node:fs';
import {chromium} from 'playwright-core';
import {startGhostsFake} from '../../../../scripts/ghosts-fake.mjs';

const result={at:new Date().toISOString(),cases:[],errors:[]};
const reservation=createServer().listen(0,'127.0.0.1');
await once(reservation,'listening'); const port=reservation.address().port;
await new Promise(r=>reservation.close(r));
const base=`http://localhost:${port}`,fake=await startGhostsFake({origins:base});
const server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--port',String(port)],{
  env:{...process.env,GHOSTS_ENDPOINT:fake.url,BETTER_AUTH_URL:base,BETTER_AUTH_SECRET:'qa-local-fixture-only-not-a-secret-0123456789'},stdio:['ignore','pipe','pipe']});
const ended=once(server,'exit'); let logs='';
const browsers=[];
try {
  await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(Error(logs)),15000);
    const read=b=>{logs+=b;if(logs.includes('Ready in')){clearTimeout(timer);resolve();}};
    server.stdout.on('data',read);server.stderr.on('data',read);server.once('error',reject);
  });
  const config=await fetch(base+'/api/ghosts');assert.equal(config.status,200);
  assert.equal((await config.json()).endpoint,fake.url);assert.match(config.headers.get('cache-control'),/no-store/);
  for(let i=0;i<2;i++)browsers.push(await chromium.launch({channel:'chrome',env:{...process.env,TMPDIR:'/tmp'}}));
  result.browser=browsers[0].version();result.realProcesses=2;
  async function context(browser,blocked=false){
    const ctx=await browser.newContext({viewport:{width:1000,height:740},reducedMotion:'no-preference'});
    await ctx.addInitScript(blocked=>{
      window.qa={sockets:0,closes:0,sent:0,ids:[],paints:0,clears:0,configs:0,storage:0};
      const add=window.addEventListener.bind(window);
      if(blocked)window.addEventListener=(type,...args)=>{if(type!=='storage')add(type,...args);};
      add('storage',()=>window.qa.storage++);
      const original=window.WebSocket;
      window.WebSocket=class extends original{
        constructor(...args){super(...args);window.qa.sockets++;this.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.t==='hi')window.qa.ids.push(m.id);});}
        close(...args){window.qa.closes++;return super.close(...args);}
        send(...args){window.qa.sent++;return super.send(...args);}
      };
      const fetch=window.fetch.bind(window);
      window.fetch=(...args)=>{if(String(args[0]).includes('/api/ghosts'))window.qa.configs++;return fetch(...args);};
      for(const method of ['fill','stroke','clearRect']){
        const original=CanvasRenderingContext2D.prototype[method];
        CanvasRenderingContext2D.prototype[method]=function(...args){
          if(this.canvas.closest('[data-ghosts-state]'))window.qa[method==='clearRect'?'clears':'paints']++;
          return Reflect.apply(original,this,args);
        };
      }
    },blocked);
    return ctx;
  }
  async function page(ctx,path){
    const p=await ctx.newPage();p.on('pageerror',e=>result.errors.push(String(e)));
    p.on('console',m=>{if(m.type()==='error')result.errors.push(m.text());});
    assert.equal((await p.goto(base+path)).status(),200);return p;
  }
  const state=async(p,s)=>p.waitForSelector(`[data-ghosts-state="${s}"]`);
  const stats=p=>p.evaluate(()=>({...window.qa}));
  const pixels=p=>p.evaluate(()=>{
    const c=document.querySelector('[data-ghosts-state] canvas');if(!c)return 0;
    return c.getContext('2d').getImageData(0,0,c.width,c.height).data.filter((v,i)=>i%4===3&&v>0).length;
  });
  const frames=p=>p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  const quiet=async p=>{
    const before=await stats(p);await p.mouse.move(370,240);await p.mouse.click(390,260);await frames(p);
    const after=await stats(p);for(const k of ['paints','sent','configs','sockets'])assert.equal(after[k],before[k],k);
    assert.equal(await pixels(p),0);return after;
  };
  const shared=await context(browsers[0]),peerctx=await context(browsers[1]);
  const home=await page(shared,'/'),palace=await page(shared,'/ryugu'),peer=await page(peerctx,'/');
  for(const p of [home,palace,peer])await state(p,'on');
  await home.mouse.move(400,320);await home.mouse.click(410,330);
  await peer.waitForFunction(()=>Number(document.querySelector('[data-ghosts-state]')?.dataset.ghostsRipples)>0);
  assert.ok(await pixels(peer)>0);result.cases.push({name:'native peer pixels across two Chrome processes',pass:true,pixels:await pixels(peer)});
  await palace.mouse.click(400,320);
  await palace.waitForFunction(()=>Number(document.querySelector('[data-ghosts-state]')?.dataset.ghostsRipples)>0);
  assert.ok(await pixels(palace)>0);
  const before=await stats(home);
  const sync=await home.evaluate(()=>{document.querySelector('[data-pocket-ghosts]').click();return {...window.qa,stored:localStorage.getItem('ghosts')};});
  assert.equal(sync.closes,before.closes+1);assert.ok(sync.clears>before.clears);assert.equal(sync.stored,'hidden');
  await state(home,'off');await state(palace,'off');await quiet(home);await quiet(palace);
  result.cases.push({name:'synchronous Home close/clear and native cross-tab palace suppression',pass:true,sync,palace:await stats(palace)});
  await palace.reload();
  // Establish hydration using a palace control rather than SSR-only state.
  await palace.waitForFunction(()=>document.querySelector('.sea')?.getAttribute('data-water')!=='served');
  await palace.evaluate(()=>new Promise(r=>requestIdleCallback(r,{timeout:2000})));await frames(palace);
  assert.equal((await stats(palace)).configs,0);assert.equal((await stats(palace)).sockets,0);
  result.cases.push({name:'hidden preference survives full palace reload before config fetch',pass:true,stats:await stats(palace)});
  await home.locator('[data-pocket-ghosts]').press('Enter');await state(home,'on');await state(palace,'on');
  assert.equal((await stats(home)).sockets,2);assert.notEqual((await stats(home)).ids[0],(await stats(home)).ids[1]);
  // Native clear from another tab exercises key=null and closes active transports.
  await peerctx.close();await home.evaluate(()=>localStorage.clear());
  await home.locator('[data-pocket-ghosts]').press('Space');await state(home,'off');await state(palace,'off');
  await home.evaluate(()=>localStorage.clear());
  // Same-document writes do not generate a storage event. Other tabs must resume.
  await state(palace,'on');assert.equal((await stats(palace)).sockets,2);
  result.cases.push({name:'native storage clear from other tab restores palace eligibility',pass:true,stats:await stats(palace)});
  await shared.close();

  for(const kind of ['motion','offline']){
    const ctx=await context(browsers[0]),p=await page(ctx,'/ryugu');await state(p,'on');await p.mouse.click(380,280);
    if(kind==='motion')await p.emulateMedia({reducedMotion:'reduce'});else await ctx.setOffline(true);
    await state(p,'off');await quiet(p);
    if(kind==='motion')await p.emulateMedia({reducedMotion:'no-preference'});else await ctx.setOffline(false);
    await state(p,'on');const s=await stats(p);assert.equal(s.sockets,2);assert.notEqual(s.ids[0],s.ids[1]);
    result.cases.push({name:`${kind} closes and clears, then reconnects once`,pass:true,stats:s});await ctx.close();
  }
  // Negative control: native storage events arrive but application listeners are blocked.
  const negative=await context(browsers[0],true),h=await page(negative,'/'),r=await page(negative,'/ryugu');
  await state(h,'on');await state(r,'on');await r.mouse.move(400,320);
  await h.locator('[data-pocket-ghosts]').click();await state(h,'off');
  await r.waitForFunction(()=>window.qa.storage>0);await frames(r);
  const negativeState=await r.locator('[data-ghosts-state]').getAttribute('data-ghosts-state');
  assert.throws(()=>assert.equal(negativeState,'off'),/Expected values/);
  assert.equal(negativeState,'on');assert.equal((await stats(r)).closes,0);
  result.cases.push({name:'blocked storage-listener negative control rejects normal cross-tab assertion',pass:true,observed:negativeState,stats:await stats(r)});
  await negative.close();assert.deepEqual(result.errors,[]);result.pass=true;
}catch(error){result.error=String(error.stack??error);throw error;}
finally{
  for(const b of browsers)await b.close();if(server.exitCode===null){server.kill('SIGTERM');await ended;}
  await fake.close();writeFileSync(`${import.meta.dirname}/independent-results.json`,JSON.stringify(result,null,2)+'\n');
  writeFileSync(`${import.meta.dirname}/independent-server.log`,logs);
}
console.log(JSON.stringify(result,null,2));
