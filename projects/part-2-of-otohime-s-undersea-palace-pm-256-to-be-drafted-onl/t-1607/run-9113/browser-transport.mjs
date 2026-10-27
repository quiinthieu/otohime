// Transport-only browser proof. No product canvas/preferences are present in t-1607.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
const root=new URL('../../../../',import.meta.url);
const require=createRequire(new URL('package.json',root));
const {chromium}=require('playwright-core');
const {startGhostsFake}=await import(new URL('scripts/ghosts-fake.mjs',root));
const server=createServer((_,res)=>res.end('<!doctype html><title>Ghost transport QA</title>'));
server.listen(0,'0.0.0.0');await once(server,'listening');
const port=server.address().port;
const origin=`http://127.0.0.1:${port}`;
let fake,browser;
try{
  fake=await startGhostsFake({origins:origin});
  browser=await chromium.launch({channel:'chrome',headless:true});
  const contexts=await Promise.all([0,1,2].map(()=>browser.newContext()));
  const pages=await Promise.all(contexts.map(c=>c.newPage()));
  for(let i=0;i<pages.length;i++){
    await pages[i].goto(origin);
    await pages[i].evaluate(({endpoint,room})=>{
      globalThis.received=[];
      globalThis.socket=new WebSocket(`${endpoint}/ghosts?room=${encodeURIComponent(room)}`);
      socket.onmessage=e=>received.push(JSON.parse(e.data));
    },{endpoint:fake.base.replace(/^http/,'ws'),room:i===2?'/ryugu':'/'});
    await pages[i].waitForFunction(()=>received.some(m=>m.t==='hi'));
  }
  const aId=await pages[0].evaluate(()=>received.find(m=>m.t==='hi').id);
  await pages[0].evaluate(()=>socket.send('{"t":"m","x":0.25,"y":0.75}'));
  await pages[1].waitForFunction(()=>received.some(m=>m.t==='m'));
  assert.deepEqual(await pages[1].evaluate(()=>received.find(m=>m.t==='m')),{t:'m',id:aId,x:0.25,y:0.75});
  await pages[1].evaluate(()=>socket.send('{"t":"c","x":0.8,"y":0.2}'));
  await pages[0].waitForFunction(()=>received.some(m=>m.t==='c'));
  assert.equal(await pages[2].evaluate(()=>received.some(m=>m.t==='m'||m.t==='c')),false);
  assert.equal(await pages[0].evaluate(()=>received.some(m=>m.t==='m')),false);
  assert.equal(await pages[1].evaluate(()=>received.some(m=>m.t==='c')),false);
  const badPage=await contexts[2].newPage();
  await badPage.goto(`http://localhost:${port}`);
  const rejected=await badPage.evaluate(endpoint=>new Promise(resolve=>{
    const ws=new WebSocket(`${endpoint}/ghosts?room=%2F`);
    ws.onopen=()=>{ws.close();resolve(false);};
    ws.onerror=()=>resolve(true);
  }),fake.base.replace(/^http/,'ws'));
  assert.equal(rejected,true);
  const log=fake.log().entries;
  const joins=log.filter(x=>x.kind==='join');
  assert.equal(joins.length,3);
  assert.ok(joins.every(x=>!x.headers.cookie));
  const evidence={browser:browser.version(),real:'three isolated Chrome contexts, real browser WebSocket',fake:'local dependency-free fan-out server; synthetic page only',clients:3,rooms:['/','/ryugu'],move:true,click:true,noEcho:true,roomIsolation:true,badOriginRejected:rejected,cookieHeadersPresent:false,productCanvasTested:false};
  writeFileSync(new URL('browser-transport.json',import.meta.url),JSON.stringify(evidence,null,2)+'\n');
  console.log(JSON.stringify(evidence));
}finally{
  await browser?.close();
  await fake?.close();
  await new Promise(resolve=>server.close(resolve));
}
