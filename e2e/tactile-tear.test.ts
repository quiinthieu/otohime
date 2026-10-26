import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import type { Browser } from "playwright-core";
import { BASE, launchTactileBrowser, ready, state, touchDrag } from "./tactile-helpers.ts";
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
    const card=page.locator('[data-paper-id]').first(); const before=await card.boundingBox();
    const peel=card.getByRole('button',{name:'Peel corner',exact:true});
    await peel.focus(); await page.keyboard.press('Enter'); await state(page,'peeled');
    assert.ok(await card.locator('.paper-margin').isVisible());
    assert.ok((await card.locator('.paper-margin').innerText()).length>0);
    const after=await card.boundingBox(); assert.ok(before&&after); assert.ok(Math.abs(before.height-after.height)<=1 && Math.abs(before.width-after.width)<=1);
    const polygon=await card.locator('.paper-flap').evaluate(e=>getComputedStyle(e).clipPath); assert.match(polygon,/polygon/);
    await page.reload(); await page.locator('[data-paper-controls]').first().waitFor(); await state(page,'peeled');
    assert.equal(await card.locator('.paper-flap').evaluate(e=>getComputedStyle(e).clipPath),polygon);
    await card.getByRole('button',{name:'Reset',exact:true}).focus(); await page.keyboard.press('Space'); await state(page,'intact');
    await peel.focus(); await page.keyboard.press('Enter'); await state(page,'peeled');
    await page.getByRole('link',{name:'Notes',exact:true}).first().click(); await ready(page,'/notes');
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
    for(const cancel of ['pointercancel','lostpointercapture','Escape','blur','pagehide']) {
      await page.mouse.move(rect.x+rect.width/2,rect.y+rect.height/2); await page.mouse.down();
      await page.mouse.move(rect.x-45,rect.y+70,{steps:5});
      assert.equal(await card.getAttribute('data-paper-state'),'peeling');
      if(cancel==='Escape') await page.keyboard.press('Escape');
      else if(cancel==='blur'||cancel==='pagehide') await page.evaluate(type=>window.dispatchEvent(new Event(type)),cancel);
      else await handle.dispatchEvent(cancel,{pointerId:1});
      await page.mouse.up(); await state(page,'intact');
    }
    await page.mouse.move(rect.x+22,rect.y+22); await page.mouse.down(); await page.mouse.move(rect.x-40,rect.y+65,{steps:5}); await page.mouse.up(); await state(page,'peeled');
    await page.keyboard.press('Escape'); await state(page,'intact');
  } finally {await context.close();}
});
test("blocked storage and live reduced motion keep instant keyboard operations usable",async()=>{
  const context=await browser.newContext({reducedMotion:'reduce'});
  try {
    await context.addInitScript(()=>{Object.defineProperty(window,'sessionStorage',{get(){throw Error('blocked');}});});
    const page=await context.newPage(); await ready(page,'/notes'); const card=page.locator('[data-paper-id]').first();
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
    const page=await context.newPage(); await page.goto(`${BASE}/projects`);
    await page.getByRole('button',{name:'Enable paper corners'}).waitFor();
    assert.equal(await page.locator('[data-paper-controls]').count(),0);
    await page.getByRole('button',{name:'Enable paper corners'}).click(); await page.locator('[data-paper-controls]').first().waitFor();
  } finally {await context.close();}
});
test("real touch outside the handle scrolls; deliberate corner touch peels; desk/stamps stay excluded",async()=>{
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  try {
    const page=await context.newPage(); await ready(page);
    await touchDrag(page,180,650,0,-300);
    await page.waitForFunction(()=>scrollY>30);
    assert.equal(await page.locator('[data-paper-state="peeled"]').count(),0);
    await page.evaluate(()=>scrollTo(0,0)); const handle=page.getByRole('button',{name:'Drag corner',exact:true}).first(); await handle.scrollIntoViewIfNeeded();
    const r=await handle.boundingBox(); assert.ok(r); await touchDrag(page,r.x+22,r.y+22,-45,55); await state(page,'peeled');
    for(const route of ['/desk','/play']) {
      await page.goto(`${BASE}${route}`); await page.waitForLoadState('load');
      assert.equal(await page.locator('[data-paper-controls]').count(),0);
    }
  } finally {await context.close();}
});
