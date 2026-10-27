import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { launchBrowser } from '../../../../scripts/probe-browser.mjs';
const delivery = 'a6723c1b52f25ad9259c23eb33ebd9cafb01b788';
const repair = 'a958913b6a17f2cefda59882dfbdfcb0cd01e453';
const browser = await launchBrowser();
const result = {at:new Date().toISOString(),browser:browser.version(),delivery,repair,pages:[],boundary:'Read-only deployed Chrome path; dark configuration, no hosted transport asserted.'};
try {
  const context = await browser.newContext({viewport:{width:960,height:720},reducedMotion:'no-preference'});
  for (const room of ['/','/ryugu']) {
    const page = await context.newPage(),errors=[],sockets=[],assets=new Map();
    page.on('pageerror',e=>errors.push(String(e)));
    page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
    page.on('websocket',s=>sockets.push(s.url()));
    page.on('response',r=>{if(r.url().includes('/_next/static/')) assets.set(r.url(),r);});
    const response = await page.goto('https://otohime.dev'+room);
    assert.equal(response.status(),200);
    await page.waitForSelector('[data-ghosts-state="off"]');
    const sha = await page.locator('meta[name="build-sha"]').getAttribute('content');
    const layer = await page.locator('[data-ghosts-state]').evaluate(el=>{
      const c=el.querySelector('canvas');
      return {state:el.dataset.ghostsState,others:el.dataset.ghosts,draws:el.dataset.ghostsRipples,pixels:c.getContext('2d').getImageData(0,0,c.width,c.height).data.some((v,i)=>i%4===3&&v>0),events:getComputedStyle(c).pointerEvents};
    });
    assert.deepEqual(layer,{state:'off',others:'0',draws:'0',pixels:false,events:'none'});
    assert.deepEqual(errors,[]);assert.deepEqual(sockets,[]);
    const hashes=[];
    for(const [url] of assets){
      const r=await context.request.get(url),b=await r.body();
      assert.equal(r.status(),200);
      hashes.push({url,status:r.status(),sha256:createHash('sha256').update(b).digest('hex')});
    }
    result.pages.push({room,status:response.status(),sha,deliveryAncestorExit:spawnSync('git',['merge-base','--is-ancestor',delivery,sha]).status,repairAncestorExit:spawnSync('git',['merge-base','--is-ancestor',repair,sha]).status,layer,errors,sockets,assets:hashes});
    await page.close();
  }
  const health = await context.request.get('https://otohime.dev/api/health');
  result.health={status:health.status(),body:await health.json()};
  assert.equal(result.health.status,200);
  assert.equal(result.health.body.sha,result.pages[0].sha);
  assert.equal(result.pages[0].sha,result.pages[1].sha);
  result.darkUserPathPass=true;
}catch(error){result.error=String(error.stack??error);throw error;}
finally{writeFileSync(`${import.meta.dirname}/public-browser.json`,JSON.stringify(result,null,2)+'\n');await browser.close();}
