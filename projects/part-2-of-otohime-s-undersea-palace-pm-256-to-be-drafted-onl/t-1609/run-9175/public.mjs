// Read-only public path; no route interception and no configuration changes.
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {writeFileSync} from 'node:fs';
import {chromium} from 'playwright-core';
const delivery='cce131daf5c5648830ffe50a7d756e8adc490d73';
const browser=await chromium.launch({channel:'chrome',env:{...process.env,TMPDIR:'/tmp'}});
const result={at:new Date().toISOString(),browser:browser.version(),delivery,pages:[],api:[]};
try{
  const ctx=await browser.newContext({viewport:{width:1000,height:740},reducedMotion:'no-preference'});
  for(const path of ['/api/health','/api/ghosts','/api/ghosts?probe=1']){
    const r=await ctx.request.get('https://otohime.dev'+path);
    result.api.push({path,status:r.status(),cache:r.headers()['cache-control'],body:await r.text()});
  }
  result.deployed=JSON.parse(result.api[0].body).sha;
  result.deliveryAncestorExit=spawnSync('git',['merge-base','--is-ancestor',delivery,result.deployed]).status;
  for(const path of ['/','/ryugu']){
    const p=await ctx.newPage(),errors=[],sockets=[],assets=[];
    p.on('pageerror',e=>errors.push(String(e)));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
    p.on('websocket',s=>sockets.push(s.url()));
    const pending=[];
    p.on('response',r=>{if(r.url().includes('/_next/static/'))pending.push(r.body().then(b=>assets.push({url:r.url(),sha256:createHash('sha256').update(b).digest('hex')})).catch(()=>{}));});
    const response=await p.goto('https://otohime.dev'+path);assert.equal(response.status(),200);
    await p.waitForSelector('[data-ghosts-state="off"]');
    const state=await p.locator('[data-ghosts-state]').evaluate(el=>{const c=el.querySelector('canvas');return {state:el.dataset.ghostsState,pixels:c.getContext('2d').getImageData(0,0,c.width,c.height).data.some((v,i)=>i%4===3&&v>0)};});
    assert.deepEqual(state,{state:'off',pixels:false});assert.deepEqual(sockets,[]);assert.deepEqual(errors,[]);
    const sha=await p.locator('meta[name="build-sha"]').getAttribute('content');assert.equal(sha,result.deployed);
    const chip=await p.locator('[data-pocket-ghosts]').count();
    await Promise.all(pending);result.pages.push({path,status:response.status(),sha,chip,state,errors,sockets,assets});await p.close();
  }
  result.darkPathPass=true;
}catch(e){result.error=String(e.stack??e);throw e;}
finally{writeFileSync(`${import.meta.dirname}/public-results.json`,JSON.stringify(result,null,2)+'\n');await browser.close();}
console.log(JSON.stringify({...result,pages:result.pages.map(({assets,...p})=>({...p,assetCount:assets.length}))},null,2));
