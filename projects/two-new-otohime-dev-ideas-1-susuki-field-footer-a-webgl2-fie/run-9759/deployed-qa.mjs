// Independent QA: observes the production GPU and drives user actions without
// importing the SWE probe, its projection implementation or its summary.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright-core';
import sharp from 'sharp';

const base = process.env.BASE_URL || 'https://otohime.dev';
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const browser = await chromium.launch({ channel: 'chrome', env: { ...process.env, TMPDIR: '/tmp' }, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const frames = (page, count) => page.evaluate(async (n) => { for (let i=0; i<n; i++) await new Promise(requestAnimationFrame); }, count);
const results = { base, browser: browser.version(), node: process.version, observations: [] };
const log = (name, data) => { results.observations.push({ name, ...data }); console.log(JSON.stringify({ name, ...data })); };

async function open({ width=1280, mobile=false, debug=false, blocked=false, saveData=false, route='/shelf', reducedMotion='no-preference' }={}) {
  const page = await browser.newPage({ viewport: { width, height: 950 }, deviceScaleFactor: mobile ? 3 : 1, reducedMotion });
  const errors=[], consoleErrors=[], responses=[], pending=[], unread=[];let collecting=true;
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if(m.type()==='error')consoleErrors.push(m.text()); });
  page.on('response', response => {
    if(collecting && new URL(response.url()).pathname.endsWith('.js')) pending.push(response.body().then(body=>responses.push({path:new URL(response.url()).pathname,sha256:digest(body),shelf:/objectHatching|THREE\.WebGLRenderer|\.shelfFrames/.test(body.toString())}), e=>unread.push({url:response.url(),error:e.message})));
  });
  await page.addInitScript(({blocked,saveData}) => {
    if(saveData && navigator.connection) Object.defineProperty(navigator.connection,'saveData',{value:true,configurable:true});
    const original=HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext=function(type,...args) {
      if(blocked && /webgl/.test(type))return null;
      const gl=original.call(this,type,...args);
      if(gl && type==='webgl2' && this.closest('.ink-shelf') && !window.qaGPU) {
        window.qaGPU={gl,programs:[],draws:0,targets:new Set(),deletedTextures:0};
        const link=gl.linkProgram.bind(gl);
        gl.linkProgram=p=>{link(p);window.qaGPU.programs.push({p,sources:gl.getAttachedShaders(p).map(s=>gl.getShaderSource(s)),linked:gl.getProgramParameter(p,gl.LINK_STATUS),info:gl.getProgramInfoLog(p)});};
        for(const key of ['drawElements','drawArrays']) { const call=gl[key].bind(gl); gl[key]=(...a)=>{window.qaGPU.draws++;return call(...a);}; }
        const bind=gl.bindFramebuffer.bind(gl); gl.bindFramebuffer=(target,fbo)=>{if(fbo)window.qaGPU.targets.add(fbo);return bind(target,fbo);};
        const del=gl.deleteTexture.bind(gl); gl.deleteTexture=t=>{window.qaGPU.deletedTextures++;return del(t);};
      }
      return gl;
    };
  },{blocked,saveData});
  assert.equal((await page.goto(`${base}${route}${debug?'?outlineDebug=1&kd=2.5&kn=0.6&ndvCutoff=0.3':''}`,{waitUntil:'networkidle'})).status(),200);
  return {page,errors,consoleErrors,responses,pending,unread,stop:async()=>{await Promise.all(pending);collecting=false;assert.deepEqual(unread,[]);}};
}

async function pixels(canvas) {
  const png=await canvas.screenshot();
  const {data,info}=await sharp(png).removeAlpha().raw().toBuffer({resolveWithObject:true});
  let blue=0,dark=0; const colours=new Set();
  for(let i=0;i<data.length;i+=info.channels) {colours.add(`${data[i]},${data[i+1]},${data[i+2]}`); if(data[i+2]>220 && data[i]<50 && data[i+1]<50)blue++;if(Math.max(data[i],data[i+1],data[i+2])<110)dark++;}
  return {sha256:digest(png),colours:colours.size,dark,blue};
}

try {
  const health=await (await fetch(`${base}/api/health`)).json(); assert.equal(health.ok,true);log('initial-health',health);
  for(const mobile of [false,true]) {
    const p=await open({width:mobile?390:1280,mobile,debug:mobile});const {page}=p;
    try {
      await page.waitForSelector('[data-shelf-mode="3d"] canvas');
      const canvas=page.locator('.ink-shelf canvas');await canvas.scrollIntoViewIfNeeded();
      const gpu=await page.evaluate(()=>{
        const q=window.qaGPU,gl=q.gl;const composite=q.programs.find(p=>p.sources.some(s=>s.includes('float linearDepth')));
        const renderer=gl.getExtension('WEBGL_debug_renderer_info');
        return {renderer:renderer?gl.getParameter(renderer.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),draws:q.draws,targets:q.targets.size,programs:q.programs.map(p=>({linked:p.linked,info:p.info,hatch:p.sources.some(s=>s.includes('objectHatching')),normal:p.sources.some(s=>s.includes('abs(dot(N, V))')),composite:p===composite})),uniforms:Object.fromEntries(['uKd','uKn','uNdvCutoff','uDebug'].map(n=>[n,gl.getUniform(composite.p,gl.getUniformLocation(composite.p,n))])),error:gl.getError(),dpr:gl.canvas.width/gl.canvas.clientWidth};
      });
      assert.equal(gpu.error,0);assert.ok(gpu.targets>=2 && gpu.draws>10);assert.ok(gpu.programs.every(p=>p.linked));
      for(const name of ['hatch','normal','composite'])assert.ok(gpu.programs.some(p=>p[name]));
      assert.ok(gpu.dpr<=1.501);assert.equal(gpu.uniforms.uKd,mobile?2.5:1);assert.equal(gpu.uniforms.uDebug,mobile?1:0);
      const before=await pixels(canvas);assert.ok(before.colours>(mobile?4:100));assert.ok(before.dark>100);if(mobile)assert.ok(before.blue>20);
      const link=page.locator('#shelf-books a').first(),id=await link.getAttribute('data-book-id');
      await link.focus();await page.waitForFunction(id=>document.querySelector('.ink-shelf canvas').dataset.focusedBook===id,id);
      await frames(page,120);const focused=await pixels(canvas);assert.notEqual(focused.sha256,before.sha256);
      const idle=await canvas.getAttribute('data-shelf-frames');await frames(page,25);assert.equal(await canvas.getAttribute('data-shelf-frames'),idle);
      await page.keyboard.press('Tab');assert.notEqual(await page.evaluate(()=>document.activeElement?.getAttribute('data-book-id')),id);
      await page.getByRole('button',{name:'Notes',exact:true}).click();assert.equal(await page.locator('#shelf-books li:not([hidden])').count(),3);
      await page.getByRole('button',{name:'All',exact:true}).click();assert.equal(await page.locator('#shelf-books li:not([hidden])').count(),14);
      await canvas.scrollIntoViewIfNeeded();
      const bounds=await canvas.boundingBox();let hit=null;
      // Search screen space rather than sharing the renderer's camera math.
      for(let row=1;row<10 && !hit;row++) for(let col=1;col<22 && !hit;col++) {
        await page.mouse.move(bounds.x+bounds.width*col/22,bounds.y+bounds.height*row/10);
        await frames(page,1);const book=await canvas.getAttribute('data-hovered-book');if(book)hit={book,x:bounds.x+bounds.width*col/22,y:bounds.y+bounds.height*row/10};
      }
      assert.ok(hit,'real raycast hit');await frames(page,110);
      const hovered=await canvas.getAttribute('data-shelf-frames');await frames(page,20);assert.equal(await canvas.getAttribute('data-shelf-frames'),hovered);
      const href=await page.locator(`#shelf-books a[data-book-id="${hit.book}"]`).getAttribute('href');
      await p.stop();await page.mouse.click(hit.x,hit.y);await page.waitForURL(url=>url.pathname===href);assert.equal(new URL(page.url()).pathname,href);
      await page.goto(`${base}/shelf`);await page.waitForSelector('[data-shelf-mode="3d"] canvas');
      await page.evaluate(()=>{window.qaGPU=null;document.querySelector('.ink-shelf canvas').getContext('webgl2').getExtension('WEBGL_lose_context').loseContext();});
      await page.waitForSelector('[data-shelf-mode="flat"]');assert.equal(await page.locator('.ink-shelf canvas').count(),0);
      assert.equal(await page.locator('#shelf-books').evaluate(el=>getComputedStyle(el).opacity),'1');
      const fallback=page.locator('#shelf-books a').first();const target=await fallback.getAttribute('href');await fallback.focus();await page.keyboard.press('Enter');await page.waitForURL(url=>url.pathname===target);
      await Promise.all(p.pending);assert.deepEqual(p.errors,[]);assert.deepEqual(p.unread,[]);
      log(mobile?'mobile-real-gpu':'desktop-real-gpu',{gpu,before,focused,idle,hoverIdle:hovered,hit,clickedHref:href,fallbackHref:target,chunks:p.responses.filter(r=>r.shelf),pageErrors:p.errors,consoleErrors:p.consoleErrors});
    }finally {await page.close();}
  }
  for(const options of [{blocked:true},{saveData:true},{route:'/'}]) {
    const p=await open(options);try {
      await p.stop();if(options.route!=='/') {
        await p.page.waitForSelector('[data-shelf-mode="flat"]');assert.equal(await p.page.locator('.ink-shelf canvas').count(),0);assert.equal(await p.page.locator('#shelf-books a').count(),14);
        const a=p.page.locator('#shelf-books a').last(),href=await a.getAttribute('href');await a.focus();await p.page.keyboard.press('Enter');await p.page.waitForURL(url=>url.pathname===href);
      }
      await Promise.all(p.pending);assert.deepEqual(p.unread,[]);assert.deepEqual(p.errors,[]);assert.deepEqual(p.responses.filter(r=>r.shelf),[]);
      log('isolation-negative-control',{options,shelfChunks:0,pageErrors:p.errors,consoleErrors:p.consoleErrors});
    }finally{await p.page.close();}
  }
  const p=await open({reducedMotion:'reduce'});try {
    await p.page.waitForSelector('[data-shelf-mode="3d"] canvas');const c=p.page.locator('.ink-shelf canvas');await c.scrollIntoViewIfNeeded();const b=await c.boundingBox();
    await p.page.mouse.move(b.x+b.width*.95,b.y+b.height*.9);await frames(p.page,5);const a=await pixels(c);
    await p.page.mouse.move(b.x+b.width*.9,b.y+b.height*.95);await frames(p.page,15);const z=await pixels(c);assert.equal(a.sha256,z.sha256);log('reduced-motion',{unchanged:true,sha256:a.sha256});
  }finally{await p.page.close();}
  log('final-health',await(await fetch(`${base}/api/health`)).json());console.log(JSON.stringify(results,null,2));
}finally {await browser.close();}
