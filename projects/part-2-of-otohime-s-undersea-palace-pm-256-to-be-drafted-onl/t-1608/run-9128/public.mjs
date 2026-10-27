import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { launchBrowser } from '../../../../scripts/probe-browser.mjs';
const delivery='a958913b6a17f2cefda59882dfbdfcb0cd01e453';
const browser=await launchBrowser();
const results={observedAt:new Date().toISOString(),delivery,browser:browser.version(),pages:[],boundary:'Real read-only public site. Hosted fan-out stays unproven while disabled.'};
try {
  const context=await browser.newContext({viewport:{width:960,height:720}});
  for(const room of ['/','/ryugu']){
    const page=await context.newPage();const errors=[],sockets=[],assets=new Set();
    page.on('pageerror',e=>errors.push(String(e)));
    page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
    page.on('websocket',ws=>sockets.push(ws.url()));
    page.on('response',r=>{if(r.url().startsWith('https://otohime.dev/_next/static/'))assets.add(r.url());});
    const response=await page.goto('https://otohime.dev'+room);
    const sha=await page.locator('meta[name="build-sha"]').getAttribute('content');
    const ancestor=spawnSync('git',['merge-base','--is-ancestor',delivery,sha]);
    const result={room,status:response.status(),sha,deliveryAncestorExit:ancestor.status,errors,sockets};results.pages.push(result);
    assert.equal(result.status,200);
    if(await page.locator('[data-ghosts-state]').count() || ancestor.status===0){
      await page.waitForSelector('[data-ghosts-state="off"]');
      result.layer=await page.locator('[data-ghosts-state]').evaluate(el=>{
        const c=el.querySelector('canvas'),data=c.getContext('2d').getImageData(0,0,c.width,c.height).data;
        return {state:el.dataset.ghostsState,count:el.dataset.ghosts,draws:el.dataset.ghostsRipples,ink:data.some((v,i)=>i%4===3&&v>0),events:getComputedStyle(el).pointerEvents};
      });
      assert.deepEqual(result.layer,{state:'off',count:'0',draws:'0',ink:false,events:'none'});
    }
    result.assets=[];
    for(const url of [...assets].sort()){
      const asset=await context.request.get(url),body=await asset.body();
      assert.equal(asset.status(),200);
      result.assets.push({url,status:asset.status(),bytes:body.length,sha256:createHash('sha256').update(body).digest('hex')});
    }
    result.assetFingerprint=createHash('sha256').update(result.assets.map(a=>a.url+'\0'+a.sha256+'\n').join('')).digest('hex');
    assert.deepEqual(errors,[]);assert.deepEqual(sockets,[]);await page.close();
  }
  for(const path of ['/api/health','/api/ghosts','/api/ghosts?probe=1']){
    const r=await context.request.get('https://otohime.dev'+path),body=await r.text();
    results[path]={status:r.status(),cacheControl:r.headers()['cache-control'],body:body.length<500?body:'omitted HTML '+body.length+' bytes'};
  }
  assert.equal(results['/api/health'].status,200);
  results.deliveryDeployed=results.pages.every(p=>p.deliveryAncestorExit===0);
  if(results.deliveryDeployed){
    assert.deepEqual(results['/api/ghosts'],{status:404,cacheControl:'no-store',body:''});
    assert.deepEqual(results['/api/ghosts?probe=1'],{status:200,cacheControl:'no-store',body:'null'});
    assert.equal(JSON.parse(results['/api/health'].body).sha,results.pages[0].sha);
  }
  console.log(JSON.stringify(results,null,2));
}catch(error){results.error=String(error.stack??error);throw error;}
finally{writeFileSync(`${import.meta.dirname}/public-results.json`,JSON.stringify(results,null,2)+'\n');await browser.close();}
