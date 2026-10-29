// Independent QA: hold wind time constant to compare actual cursor-driven pixels.
// Real production imports, WebGL context, program, buffers, draws and input remain active.
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { createHash } from 'node:crypto';
const base = process.env.QA_BASE || 'https://otohime.dev';
const health = await fetch(`${base}/api/health`).then(async r => ({ status:r.status, body:await r.json() }));
const browser = await chromium.launch({ channel:'chrome' });
const report = { base, health, browser:browser.version(), cases:[] };
try {
  for (const route of ['/', '/projects']) {
    const context = await browser.newContext({ viewport:{width:1366,height:768} });
    await context.addInitScript(() => {
      const get = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function(type, options) {
        return get.call(this, type, type === 'webgl2' && this.hasAttribute('data-susuki-field') ? {...options,preserveDrawingBuffer:true} : options);
      };
      const original = WebGL2RenderingContext.prototype.uniform1f;
      // Cache uniform names by their actual returned location for frozen-time comparison.
      const locate=WebGL2RenderingContext.prototype.getUniformLocation;
      const names=new WeakMap();
      WebGL2RenderingContext.prototype.getUniformLocation=function(program,name){const loc=locate.call(this,program,name);if(loc)names.set(loc,name);return loc;};
      WebGL2RenderingContext.prototype.uniform1f=function(location,value){return original.call(this,location,this.canvas.hasAttribute?.('data-susuki-field') && names.get(location)==='uTime'?0:value);};
    });
    const page = await context.newPage();
    const errors=[]; page.on('pageerror',e=>errors.push(e.message));
    const response=await page.goto(`${base}${route}`);
    assert.equal(response.status(),200);
    const routeSha=(await response.text()).match(/name="build-sha" content="([^"]+)"/)?.[1];
    // Hydration signal is independent of the new island's presence.
    await page.locator('[data-end-mascot]').waitFor();
    await page.locator('footer.end').scrollIntoViewIfNeeded();
    await page.evaluate(async()=>{for(let i=0;i<12;i++)await new Promise(requestAnimationFrame);});
    const canvas=page.locator('[data-susuki-field]');
    if (!await canvas.count()) {
      report.cases.push({route,status:'missing-canvas',errors}); await context.close(); continue;
    }
    await canvas.scrollIntoViewIfNeeded();
    await page.waitForFunction(()=>Number(document.querySelector('[data-susuki-field]')?.dataset.rafTicks)>4);
    const pixels = async () => canvas.evaluate(c=>{
      const gl=c.getContext('webgl2'), p=gl.getParameter(gl.CURRENT_PROGRAM);
      const data=new Uint8Array(c.width*c.height*4); gl.readPixels(0,0,c.width,c.height,gl.RGBA,gl.UNSIGNED_BYTE,data);
      let ink=0;for(let i=3;i<data.length;i+=4)if(data[i]>8)ink++;
      return {ink,bytes:Array.from(data),time:gl.getUniform(p,gl.getUniformLocation(p,'uTime')),pointer:Array.from(gl.getUniform(p,gl.getUniformLocation(p,'uPointer'))),error:gl.getError()};
    });
    await page.evaluate(async()=>{for(let i=0;i<30;i++)await new Promise(requestAnimationFrame);});
    const before=await pixels(); assert.ok(before.ink>1000); assert.equal(before.time,0);assert.equal(before.error,0);
    const box=await canvas.boundingBox();
    await page.mouse.move(box.x+box.width*.53,box.y+box.height*.78);
    await page.evaluate(async()=>{for(let i=0;i<30;i++)await new Promise(requestAnimationFrame);});
    const after=await pixels(); assert.equal(after.time,0);
    let changed=0;for(let i=0;i<before.bytes.length;i++)if(before.bytes[i]!==after.bytes[i])changed++;
    assert.ok(changed>1000,`pointer must change actual frozen-wind pixels: ${changed}`);
    const tints=[];
    for(const season of ['spring','summer','autumn','winter']) {
      await page.evaluate(s=>document.documentElement.dataset.season=s,season);
      await page.waitForFunction(s=>document.querySelector('[data-susuki-field]').dataset.season===s,season);
      tints.push(await canvas.evaluate(c=>{const g=c.getContext('webgl2');return Array.from(g.getUniform(g.getParameter(g.CURRENT_PROGRAM),g.getUniformLocation(g.getParameter(g.CURRENT_PROGRAM),'uTint'))).join(',');}));
    }
    assert.equal(new Set(tints).size,4);
    const negative=await canvas.evaluate(c=>{const g=c.getContext('webgl2');g.clearColor(0,0,0,0);g.clear(g.COLOR_BUFFER_BIT);const d=new Uint8Array(c.width*c.height*4);g.readPixels(0,0,c.width,c.height,g.RGBA,g.UNSIGNED_BYTE,d);return d.some(v=>v!==0);});
    assert.equal(negative,false);
    const link=page.locator('[data-end-page="/work"]');await link.click();await page.waitForURL('**/work');assert.equal(new URL(page.url()).pathname,'/work');
    assert.deepEqual(errors,[]);
    report.cases.push({route,routeSha,status:'pass',ink:before.ink,changedBytes:changed,pointer:after.pointer,tints,negativeClear:'zero pixels',actualNavigation:'/work',frameSha256:createHash('sha256').update(Buffer.from(before.bytes)).digest('hex'),errors});
    await context.close();
  }
  console.log(JSON.stringify(report,null,2));
  assert.ok(report.cases.every(c=>c.status==='pass'),'required product canvas must exist on both deployed routes');
} finally {await browser.close();}
