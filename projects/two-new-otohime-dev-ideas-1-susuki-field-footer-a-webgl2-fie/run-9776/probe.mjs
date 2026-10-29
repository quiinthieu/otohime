// Independent deployed QA. Actual locked Playwright/Chrome/WebGL; no renderer fake.
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';

const base = 'https://otohime.dev';
const health = async () => { const r = await fetch(`${base}/api/health`); return {status:r.status, body:await r.json()}; };
const report = {startedAt:new Date().toISOString(), base, healthBefore:await health(), cases:[]};
const browser = await chromium.launch({channel:'chrome', args:['--enable-unsafe-swiftshader','--use-angle=swiftshader']});
report.browser = browser.version();
async function frames(page, count=90) {
  await page.evaluate(async n => { for(let i=0;i<n;i++) await new Promise(requestAnimationFrame); }, count);
}
async function instrument(context, noWebgl=false) {
  await context.addInitScript(disabled => {
    window.qaGL = [];
    const get = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(type, options) {
      if(disabled && /webgl/.test(type)) return null;
      const g = get.call(this,type,/webgl/.test(type)?{...options,preserveDrawingBuffer:true}:options);
      if(g && /webgl/.test(type) && !window.qaGL.some(r=>r.gl===g)) window.qaGL.push({gl:g,programs:[],targets:new Set(),draws:0});
      return g;
    };
    const p=WebGL2RenderingContext.prototype;
    const link=p.linkProgram;
    p.linkProgram=function(program) {
      const result=link.call(this,program), row=window.qaGL.find(r=>r.gl===this);
      row?.programs.push(program); return result;
    };
    const bind=p.bindFramebuffer;
    p.bindFramebuffer=function(target,buffer) { window.qaGL.find(r=>r.gl===this)?.targets.add(buffer); return bind.call(this,target,buffer); };
    for(const method of ['drawArrays','drawElements']) {
      const original=p[method]; p[method]=function(...args){const row=window.qaGL.find(r=>r.gl===this);if(row)row.draws++;return original.apply(this,args);};
    }
  },noWebgl);
}
async function pixels(page) {
  const state=await page.locator('.ink-shelf canvas').evaluate(c=>{
    const g=c.getContext('webgl2'), d=new Uint8Array(c.width*c.height*4);
    g.readPixels(0,0,c.width,c.height,g.RGBA,g.UNSIGNED_BYTE,d);
    let min=255,max=0,cyan=0;
    for(let i=0;i<d.length;i+=4){min=Math.min(min,d[i]);max=Math.max(max,d[i]);if(d[i]<100&&d[i+1]>140&&d[i+2]>140)cyan++;}
    return {min,max,cyan,bytes:Array.from(d),error:g.getError(),width:c.width,height:c.height,frames:c.dataset.shelfFrames};
  });
  const {bytes,...rest}=state;
  return {...rest,hash:createHash('sha256').update(Buffer.from(bytes)).digest('hex')};
}
try {
  for(const mode of process.env.QA_MODES?.split(',') || ['desktop','mobile-debug','no-webgl','reduced-motion','home','desktop-click']) {
    const mobile=mode==='mobile-debug';
    const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1366,height:1100},deviceScaleFactor:mobile?3:1,reducedMotion:mode==='reduced-motion'?'reduce':'no-preference'});
    await instrument(context,mode==='no-webgl');
    console.log(`Checking ${mode}`);
    const page=await context.newPage(), errors=[], responses=[], pending=[], captureErrors=[];
    page.on('pageerror',e=>errors.push(e.message));
    page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
    const capture=r=>{if(new URL(r.url()).pathname.endsWith('.js')) pending.push(r.body().then(b=>responses.push({url:r.url(),sha256:createHash('sha256').update(b).digest('hex'),shelf:/uNdvCutoff|data-hovered-book|shelfFrames/.test(b.toString()),three:/WebGLRenderer|THREE\.WebGL|react-three\/fiber/.test(b.toString())})).catch(e=>captureErrors.push({url:r.url(),message:e.message})));};
    page.on('response',capture);
    const route=mode==='home'?'/':mobile?'/shelf?outlineDebug=1&kd=2&kn=0.5&ndvCutoff=0.4':'/shelf';
    const response=await page.goto(base+route);assert.equal(response.status(),200);
    const sha=await page.locator('meta[name="build-sha"]').getAttribute('content');
    assert.equal(sha,report.healthBefore.body.sha);
    const result={mode,sha,http:response.status()};
    report.inProgress=result;
    if(mode==='home') {
      await page.locator('[data-end-mascot]').waitFor();await frames(page,30);
    } else {
      const links=page.locator('[data-testid="shelf-book-list"] a');
      assert.ok(await links.count()>=14);result.links=await links.count();
      if(mode==='no-webgl') {
        await frames(page,90);assert.equal(await page.locator('.ink-shelf').getAttribute('data-shelf-mode'),'flat');
        assert.equal(await page.locator('.ink-shelf canvas').count(),0);
        page.off('response',capture);await Promise.all(pending);assert.deepEqual(captureErrors,[]);
        await links.first().focus();await page.keyboard.press('Enter');await page.waitForURL(u=>u.pathname!=='/shelf');
        result.destination=new URL(page.url()).pathname;
      } else {
        await page.locator('.ink-shelf[data-shelf-mode="3d"]').waitFor();
        const canvas=page.locator('.ink-shelf canvas');await canvas.scrollIntoViewIfNeeded();await frames(page,90);
        result.render=await pixels(page);assert.ok(result.render.max-result.render.min>40);assert.equal(result.render.error,0);
        result.pipeline=await canvas.evaluate(c=>{
          const row=window.qaGL.find(r=>r.gl.canvas===c),g=row.gl;
          const programs=row.programs.filter(p=>g.isProgram(p)).map(p=>{
            const sources=g.getAttachedShaders(p).map(s=>g.getShaderSource(s)).join('\n');
            const uniforms={};for(const name of ['uKd','uKn','uNdvCutoff','uDebug','uDepthThreshold']){const loc=g.getUniformLocation(p,name);if(loc)uniforms[name]=g.getUniform(p,loc);}
            return {linked:g.getProgramParameter(p,g.LINK_STATUS),log:g.getProgramInfoLog(p),uniforms,sobel:sources.includes('depthX'),hatching:sources.includes('objectHatching'),grazing:sources.includes('ndv < uNdvCutoff')};
          });
          const debug=g.getExtension('WEBGL_debug_renderer_info');
          return {renderer:debug?g.getParameter(debug.UNMASKED_RENDERER_WEBGL):g.getParameter(g.RENDERER),programs,targets:row.targets.size,draws:row.draws,debug:c.dataset.outlineDebug,uniforms:c.dataset.outlineUniforms,dpr:c.width/c.getBoundingClientRect().width};
        });
        assert.ok(result.pipeline.programs.every(p=>p.linked));assert.ok(result.pipeline.targets>=3);
        assert.ok(result.pipeline.programs.some(p=>p.sobel));assert.ok(result.pipeline.programs.some(p=>p.hatching));assert.ok(result.pipeline.dpr<=1.501);
        if(mobile){assert.equal(result.pipeline.debug,'1');const u=result.pipeline.programs.find(p=>p.sobel).uniforms;assert.equal(u.uKd,2);assert.equal(u.uKn,.5);assert.ok(Math.abs(u.uNdvCutoff-.4)<1e-6);assert.ok(result.render.cyan>0);}
        await frames(page,90);const idle=Number(await canvas.getAttribute('data-shelf-frames'));await frames(page,90);assert.equal(Number(await canvas.getAttribute('data-shelf-frames')),idle);result.idleFrameDelta=0;
        const id=await links.first().getAttribute('data-book-id');await links.first().focus();await frames(page,180);assert.equal(await canvas.getAttribute('data-focused-book'),id);
        result.focusPixels=await pixels(page);assert.notEqual(result.focusPixels.hash,result.render.hash);
        await links.first().blur();await canvas.scrollIntoViewIfNeeded();await frames(page,90);
        if(mode==='desktop'||mode==='desktop-click') {
          const box=await canvas.boundingBox();let hover=null,point;
          for(let y=.15;y<.9&&!hover;y+=.15) for(let x=.08;x<.95&&!hover;x+=.07){point={x:box.x+box.width*x,y:box.y+box.height*y};await page.mouse.move(point.x,point.y);hover=await canvas.getAttribute('data-hovered-book');}
          assert.ok(hover,'real raycast must find a visible book');result.hover=hover;await frames(page,180);result.hoverPixels=await pixels(page);
          if(mode==='desktop-click') {
            const href=await links.evaluateAll((list,id)=>list.find(a=>a.dataset.bookId===id)?.getAttribute('href'),hover);assert.ok(href);
            page.off('response',capture);await Promise.all(pending);assert.deepEqual(captureErrors,[]);
            await page.mouse.click(point.x,point.y);await page.waitForURL(u=>u.pathname===href);
            result.destination=new URL(page.url()).pathname;assert.ok(await page.locator('h1').count());
          } else {
            await canvas.evaluate(c=>c.getContext('webgl2').getExtension('WEBGL_lose_context').loseContext());
            await page.locator('.ink-shelf[data-shelf-mode="flat"]').waitFor();await frames(page,30);
            assert.equal(await canvas.count(),0);result.contextLoss='real extension: flat; canvas removed';
          }
        }
        if(mode==='reduced-motion') {
          const before=await pixels(page),box=await canvas.boundingBox();await page.mouse.move(box.x+3,box.y+3);await frames(page,90);const after=await pixels(page);assert.equal(after.hash,before.hash);result.reducedMotion='stationary camera pixels';
        }
      }
    }
    page.off('response',capture);await Promise.all(pending);assert.deepEqual(captureErrors,[]);result.bundles=responses;
    if(mode==='home'||mode==='no-webgl')assert.ok(responses.every(r=>!r.shelf&&!r.three));
    assert.deepEqual(errors,[]);result.errors=errors;result.status='pass';report.cases.push(result);delete report.inProgress;console.log(`Passed ${mode}`);await context.close();
  }
  report.healthAfter=await health();assert.deepEqual(report.healthAfter,report.healthBefore);report.status='pass';
} catch(error){report.status='fail';report.error={message:error.message,stack:error.stack};process.exitCode=1;}
finally {await browser.close();writeFileSync(process.env.QA_OUTPUT||'/tmp/pm299-run9776/browser.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({status:report.status,cases:report.cases.map(c=>({mode:c.mode,status:c.status})),error:report.error}));}
