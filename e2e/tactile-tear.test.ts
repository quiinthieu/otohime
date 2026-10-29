import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import type { Browser } from "playwright-core";
import { BASE, launchTactileBrowser, ready, state, touchDrag, paperImports } from "./tactile-helpers.ts";
declare global {
  interface Window {
    __paperIdleStates: string[];
    __flushPaperIdle: () => void;
  }
}
let browser: Browser;
before(async()=>{browser=await launchTactileBrowser();});
after(async()=>{await browser?.close();});

test("server and no-JS baseline: all cards remain readable links without toy controls",async()=>{
  const context=await browser.newContext({javaScriptEnabled:false});
  try {
    const page=await context.newPage();
    for(const route of ["/projects","/notes"]) {
      const res=await page.goto(`${BASE}${route}`); assert.equal(res?.status(),200);
      assert.ok(await page.locator('[data-paper-id][data-tossable]').count()>0);
      assert.equal(await page.locator('[data-paper-controls],.paper-margin,.paper-corner').count(),0);
    }
    await page.goto(`${BASE}/projects`);
    const link=page.locator('.project-title').first(); const href=await link.getAttribute('href');
    await link.click(); assert.equal(new URL(page.url()).pathname,href);
  } finally {await context.close();}
});
test("keyboard peel/reset, real margin, stable geometry, session reload and route cleanup",async()=>{
  const context=await browser.newContext();
  try {
    const page=await context.newPage(); await ready(page);
    const card=page.locator('[data-paper-id]').first();
    const peel=card.getByRole('button',{name:'Peel corner',exact:true});
    await peel.focus(); const before=await card.boundingBox();
    await page.keyboard.press('Enter'); await state(page,'peeled');
    assert.ok(await card.locator('.paper-margin').isVisible());
    assert.ok((await card.locator('.paper-margin').innerText()).length>0);
    const after=await card.boundingBox(); assert.ok(before&&after);
    for(const key of ['x','y','width','height'] as const) assert.ok(Math.abs(before[key]-after[key])<=1,`stable ${key}: ${before[key]} → ${after[key]}`);
    const polygon=await card.locator('.paper-flap').evaluate(e=>getComputedStyle(e).clipPath); assert.match(polygon,/polygon/);
    await page.reload(); await page.locator('[data-paper-controls]').first().waitFor(); await state(page,'peeled');
    assert.equal(await card.locator('.paper-flap').evaluate(e=>getComputedStyle(e).clipPath),polygon);
    await card.getByRole('button',{name:'Reset',exact:true}).focus(); await page.keyboard.press('Space'); await state(page,'intact');
    await peel.focus(); await page.keyboard.press('Enter'); await state(page,'peeled');
    await page.getByRole('link',{name:'Notes',exact:true}).first().click();
    await page.waitForURL(`${BASE}/notes`); await page.locator('[data-paper-controls]').first().waitFor();
    await state(page,'intact');
    assert.equal(await page.evaluate(()=>sessionStorage.getItem('paper:v1:/projects')),null);
    await page.getByRole('link',{name:'Projects',exact:true}).first().click(); await page.locator('[data-paper-controls]').first().waitFor(); await state(page,'intact');
    // Negative control: ordinary card links navigate without a peel gesture.
    const href=await card.locator('.project-title').getAttribute('href'); await card.locator('.project-title').click();
    assert.equal(new URL(page.url()).pathname,href);
  } finally {await context.close();}
});
test("mouse peel, pointercancel, lost capture, Escape, blur and pagehide restore cosmetics",async()=>{
  const context=await browser.newContext();
  try {
    const page=await context.newPage(); await ready(page,'/notes');
    const card=page.locator('[data-paper-id]').first(), handle=card.getByRole('button',{name:'Drag corner',exact:true});
    const rect=await handle.boundingBox(); assert.ok(rect); assert.ok(rect.width>=44&&rect.height>=44);
    for(const cancel of ['pointercancel','lostpointercapture','Escape','blur']) {
      await page.mouse.move(rect.x+rect.width/2,rect.y+rect.height/2); await page.mouse.down();
      await page.mouse.move(rect.x-45,rect.y+70,{steps:5});
      assert.equal(await card.getAttribute('data-paper-state'),'peeling');
      await handle.dispatchEvent('pointercancel',{pointerId:99});
      assert.equal(await card.getAttribute('data-paper-state'),'peeling','a different pointer cannot cancel the owner');
      if(cancel==='Escape') await page.keyboard.press('Escape');
      else if(cancel==='blur') await page.evaluate(type=>window.dispatchEvent(new Event(type)),cancel);
      else await handle.dispatchEvent(cancel,{pointerId:1});
      await page.mouse.up(); await state(page,'intact');
    }
    await page.mouse.move(rect.x+22,rect.y+22); await page.mouse.down(); await page.mouse.move(rect.x-40,rect.y+65,{steps:5}); await page.mouse.up(); await state(page,'peeled');
    const saved=await page.evaluate(()=>sessionStorage.getItem('paper:v1:/notes'));
    await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true})));
    assert.equal(await page.locator('[data-paper-controls],[data-paper-active],[data-paper-state]').count(),0);
    assert.equal(await page.evaluate(()=>sessionStorage.getItem('paper:v1:/notes')),saved);
    await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true})));
    await state(page,'peeled');
    assert.equal(await card.locator('[data-paper-controls]').count(),1);
    await page.keyboard.press('Escape'); await state(page,'intact');
  } finally {await context.close();}
});
test("blocked storage and live reduced motion keep instant keyboard operations usable",async()=>{
  const context=await browser.newContext({reducedMotion:'reduce'});
  try {
    await context.addInitScript(()=>{Object.defineProperty(window,'sessionStorage',{get(){throw Error('blocked');}});});
    const page=await context.newPage(); await ready(page,'/notes'); const card=page.locator('[data-paper-id]').first();
    await card.hover();
    await card.getByRole('button',{name:'Peel corner',exact:true}).click(); await state(page,'peeled');
    assert.equal(await card.locator('.paper-flap').evaluate(e=>getComputedStyle(e).transitionDuration),'0s');
    await page.emulateMedia({reducedMotion:'no-preference'}); await page.emulateMedia({reducedMotion:'reduce'});
    await card.getByRole('button',{name:'Reset',exact:true}).click(); await state(page,'intact');
  } finally {await context.close();}
});
test("Save-Data loads paper only after explicit enabling",async()=>{
  const context=await browser.newContext();
  try {
    await context.addInitScript(()=>Object.defineProperty(navigator,'connection',{value:{saveData:true}}));
    const page=await context.newPage(); const imports=paperImports(page);
    await page.goto(`${BASE}/projects`);
    await page.getByRole('button',{name:'Enable paper corners'}).waitFor();
    assert.deepEqual(await imports(),[],'Save-Data must not download the renderer');
    assert.equal(await page.locator('[data-paper-controls]').count(),0);
    await page.getByRole('button',{name:'Enable paper corners'}).click(); await page.locator('[data-paper-controls]').first().waitFor();
    assert.ok((await imports()).length>0,'the on-demand action downloads the real renderer');
  } finally {await context.close();}
});
test("real touch outside the handle scrolls; deliberate corner touch peels; desk/stamps stay excluded",async()=>{
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  try {
    const page=await context.newPage(); await ready(page);
    const body=page.locator('[data-paper-id]').first();
    await body.scrollIntoViewIfNeeded(); const box=await body.boundingBox(); assert.ok(box);
    const x=box.x+box.width/2,y=box.y+Math.min(box.height/2,250);
    assert.equal(await page.evaluate(({x,y})=>!!document.elementFromPoint(x,y)?.closest('.paper-handle'),{x,y}),false);
    const scrollBefore=await page.evaluate(()=>scrollY);
    await touchDrag(page,x,y,0,-150);
    await page.waitForFunction(before=>scrollY>before+30,scrollBefore,{timeout:5000});
    assert.equal(await page.locator('[data-paper-state="peeled"]').count(),0);
    await page.evaluate(()=>scrollTo(0,0)); const handle=page.getByRole('button',{name:'Drag corner',exact:true}).first(); await handle.scrollIntoViewIfNeeded();
    const r=await handle.boundingBox(); assert.ok(r); await touchDrag(page,r.x+22,r.y+22,-45,55); await state(page,'peeled');
    await ready(page,'/notes');
    const note=page.locator('[data-paper-id]').first();
    assert.equal(await note.locator('.paper-actions').evaluate(e=>getComputedStyle(e).opacity),'0','intact touch cards keep the neighboring note clear');
    await note.getByRole('button',{name:'Drag corner',exact:true}).tap(); await state(page,'peeled');
    await note.getByRole('button',{name:'Reset',exact:true}).tap(); await state(page,'intact');
    for(const route of ['/desk','/play']) {
      await page.goto(`${BASE}${route}`); await page.waitForLoadState('load');
      assert.equal(await page.locator('[data-paper-controls]').count(),0);
    }
  } finally {await context.close();}
});


test("renderer import waits for window load and the idle callback; server markup has no toy preload",async()=>{
  const context=await browser.newContext();
  try {
    await context.addInitScript(()=>{
      const callbacks=new Map<number,IdleRequestCallback>(); let next=0;
      const states: string[]=[];
      window.requestIdleCallback=callback=>{states.push(document.readyState);callbacks.set(++next,callback);return next;};
      window.cancelIdleCallback=id=>{callbacks.delete(id);};
      Object.assign(window,{__paperIdleStates:states,__flushPaperIdle:()=>{
        for(const [id,callback] of callbacks) {callbacks.delete(id);callback({didTimeout:false,timeRemaining:()=>50});}
      }});
    });
    const page=await context.newPage(); const imports=paperImports(page);
    const response=await page.goto(`${BASE}/projects`); assert.ok(response);
    const html=await response.text();
    await page.waitForFunction(()=>(window.__paperIdleStates.length>0));
    assert.deepEqual(await imports(),[]);
    assert.equal(await page.locator('[data-paper-controls]').count(),0);
    assert.deepEqual(await page.evaluate(()=>[...new Set(window.__paperIdleStates)]),['complete']);
    assert.equal(await page.evaluate(html=>new DOMParser().parseFromString(html,'text/html').querySelectorAll('[data-paper-controls],.paper-margin,.paper-enable').length,html),0);
    await page.evaluate(()=>window.__flushPaperIdle());
    await page.locator('[data-paper-controls]').first().waitFor();
    const urls=await imports(); assert.ok(urls.length>0);
    for(const url of urls) assert.ok(!html.includes(new URL(url).pathname),'renderer chunk absent from server preload and scripts');
  } finally {await context.close();}
});

test("existing desktop desk and stamp gestures keep their own controls",async()=>{
  const context=await browser.newContext({viewport:{width:1366,height:900},reducedMotion:'reduce'});
  try {
    const page=await context.newPage(); await page.goto(`${BASE}/desk`);
    const link=page.locator('[data-desk-item="music"] .desk-link');
    await page.waitForFunction(()=>Object.keys(document.querySelector('.desk-bar button')??{}).some(k=>k.startsWith('__reactProps')));
    await link.scrollIntoViewIfNeeded(); const before=await link.boundingBox(); assert.ok(before);
    await page.mouse.move(before.x+before.width/2,before.y+before.height/2); await page.mouse.down();
    await page.mouse.move(before.x+before.width/2+90,before.y+before.height/2+30,{steps:10}); await page.mouse.up();
    const after=await link.boundingBox(); assert.ok(after); assert.ok(after.x-before.x>30,'the desk drag still moves its item');
    assert.equal(new URL(page.url()).pathname,'/desk');
    assert.equal(await page.locator('[data-paper-controls]').count(),0);
    await page.goto(`${BASE}/play`); await page.getByRole('button',{name:'Stamp it',exact:true}).click();
    const block=page.locator('.stamp-block').first(); await block.waitFor(); await block.scrollIntoViewIfNeeded();
    const start=await block.boundingBox(); assert.ok(start);
    await page.mouse.move(start.x+start.width/2,start.y+start.height/2); await page.mouse.down();
    await page.mouse.move(start.x+start.width/2+45,start.y+start.height/2+25,{steps:8}); await page.mouse.up();
    assert.ok(Number(await page.locator('.stamp-board').getAttribute('data-marks'))>0,'the stamp drag still inks the board');
    assert.equal(await page.locator('[data-paper-controls]').count(),0);
  } finally {await context.close();}
});
