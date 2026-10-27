import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const root=process.cwd();const require=createRequire(`${root}/package.json`);const {chromium}=require('playwright-core');
let src=readFileSync('scripts/probe-end.mjs','utf8');
if(process.env.CONTROL_OLD_CACHE==='1'){const start=src.indexOf('  const playerFrames =');const end=src.indexOf('  page.on("frameattached"',start);src=src.slice(0,start)+'  const playerFrames = new WeakMap();\n  const playerFrame = (frame) => {\n    if (!playerFrames.has(frame)) playerFrames.set(frame, verifyPlayerFrame(frame, recorded));\n    return playerFrames.get(frame);\n  };\n'+src.slice(end);}
const open=new Function('BASE_URL','errors','hydrationErrors','footerThirdPartyRequests','televisionRequests',`const DESKTOP={width:800,height:600};const PHONE={};${src.slice(src.indexOf('const PLAYER_HOST'),src.indexOf('const notFoundLoad'))} const notFoundLoad=()=>false;const youtubeNoise=()=>false;const installLoopCounters=()=>{};${src.slice(src.indexOf('async function open('),src.indexOf('// Resolves once no scroll event'))};return open;`)('http://probe.test',[],[],[],[]);
const browser=await chromium.launch({channel:'chrome',env:{...process.env,TMPDIR:'/tmp'}});
const net=[],tv=[];const {context,page}=await open(browser,{netSink:net,tvSink:tv,sink:[]});
try{
 await page.route('**/*',r=>r.fulfill({contentType:'text/html',body:'<main id="main"></main><footer></footer>'}));
 await page.goto('http://probe.test/music');
 const attached=page.waitForEvent('frameattached');
 await page.evaluate(()=>{const f=document.createElement('iframe');f.id='delayed';document.querySelector('main').append(f);});
 const frame=await attached;await frame.frameElement();
 // Round trip after attach: this proves the eager verification settled while src is blank.
 await page.evaluate(()=>document.querySelector('#delayed').src='https://www.youtube.com/embed/?probe=delayed-src');
 await frame.waitForURL('https://www.youtube.com/embed/**');
 await context.close();
 const data={boundary:'real Chrome and actual probe functions; intentional control replaces only the cache in memory; synthetic page and route-fulfilled embed, no external YouTube service',chrome:browser.version(),net,tv,intentional_old_cache:process.env.CONTROL_OLD_CACHE==='1',observed_defect:net.some(s=>s.includes('[frame unverified]')&&s.includes('delayed-src'))};
 assert.equal(data.observed_defect,data.intentional_old_cache,'old cache must fail attribution; repaired cache must pass');
 if(!data.intentional_old_cache)assert.ok(tv.some(line=>line.includes('[frame television]')&&line.includes('delayed-src')));
 writeFileSync(`projects/kame-crumple-two-tactile-paper-and-ink-toys-for-otohime-dev/run-9221/artifacts/frame-attribution-${process.env.CONTROL_OLD_CACHE==='1'?'red':'green'}.json`,JSON.stringify(data,null,2)+'\n');console.log(JSON.stringify(data));
}finally{await browser.close();}
