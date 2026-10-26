import assert from 'node:assert/strict';
import { before, after, test, type TestContext } from 'node:test';
import type { Browser, BrowserContextOptions, Page } from 'playwright-core';
import { BASE, launchTactileBrowser, ready, touchDrag } from './tactile-helpers.ts';
let browser: Browser;
before(async()=>{browser=await launchTactileBrowser();});
after(async()=>{await browser?.close();});
async function open(t:TestContext, route='/projects', options:BrowserContextOptions={}) {
  const context=await browser.newContext({viewport:{width:1280,height:860},...options});
  t.after(()=>context.close()); const page=await context.newPage();
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));t.after(()=>assert.deepEqual(errors,[]));
  await ready(page,route);await page.locator('[data-kame]').waitFor({state:'attached'});
  page.setDefaultTimeout(5000);return page;
}
function sameRect(a:Awaited<ReturnType<ReturnType<Page['locator']>['boundingBox']>>,b:typeof a) {
  assert.ok(a&&b);for(const key of ['x','y','width','height'] as const) assert.ok(Math.abs(a[key]-b[key])<=1,`stable source ${key}: ${a[key]} → ${b[key]}`);
}

async function observe(page:Page) {
  await page.evaluate(()=>{
    type Sample={phase:string;distance:number;homeDistance:number;elapsed:number};
    const samples:Sample[]=[];Object.assign(window,{fetchSamples:samples});
    const start=performance.now();
    const read=()=>{
      const proxy=document.querySelector<HTMLElement>('[data-fetch-proxy]'); const turtle=document.querySelector('[data-kame]');
      const source=[...document.querySelectorAll<HTMLElement>('[data-paper-id]')].find(el=>el.dataset.paperId===proxy?.dataset.sourceId);
      if(!proxy||!turtle) return;
      const p=proxy.getBoundingClientRect(),k=turtle.getBoundingClientRect(),s=source?.getBoundingClientRect();
      samples.push({phase:proxy.dataset.phase??'',distance:Math.hypot(p.x+p.width/2-k.x-k.width/2,p.y+p.height/2-k.y-k.height/2),homeDistance:s?Math.hypot(p.x+p.width/2-(s.x+s.width/2),p.y+p.height/2-(s.y+s.height/2)):999,elapsed:performance.now()-start});
    };
    const observer=new MutationObserver(read); observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['data-phase']});
  });
}
async function completed(page:Page) {
  await page.waitForFunction(()=>(window as unknown as {fetchSamples:{phase:string}[]}).fetchSamples.some(s=>s.phase==='returned'),null,{timeout:6000});
  const samples=await page.evaluate(()=>(window as unknown as {fetchSamples:{phase:string;distance:number;homeDistance:number;elapsed:number}[]}).fetchSamples);
  const arrival=samples.find(s=>s.phase==='returning');const returned=samples.find(s=>s.phase==='returned');
  assert.ok(arrival&&arrival.distance<=4,`visible turtle actually reaches proxy: ${JSON.stringify(samples)}`);
  assert.ok(returned&&returned.distance<=4&&returned.homeDistance<=4,`turtle and proxy reach measured source: ${JSON.stringify(samples)}`);
  assert.ok(returned.elapsed<5000,'whole fetch finishes within five active seconds');
  await page.locator('[data-fetch-proxy]').waitFor({state:'detached'});
}

test('fetch controls register cards, noninteractive Lines wrappers and one lazy sticker',async(t)=>{
  const page=await open(t);
  const cards=page.locator('[data-paper-id]:not([data-paper-fetch-only])');
  assert.ok(await cards.count()>0);
  assert.equal(await cards.getByRole('button',{name:'Fetch back',exact:true}).count(),await cards.count());
  const grip=cards.first().getByRole('button',{name:'Drag paper',exact:true});await grip.waitFor({timeout:1500});
  const box=(await grip.boundingBox())!;assert.ok(box.width>=44&&box.height>=44);
  assert.ok(await page.locator('.end-lines li[data-paper-fetch-only]').count()>0);
  assert.equal(await page.locator('.paper-sticker[data-paper-id]').count(),1);
  assert.equal(await page.locator('[data-paper-fetch-only] .paper-peel').count(),0);
  assert.equal(await page.locator('a[data-paper-id],a[draggable="true"]').count(),0);
  const turtle=(await page.locator('[data-kame]').boundingBox())!;assert.ok(turtle.x>1200&&turtle.y>200,'initial sprite placed on edge');
});

test('keyboard fetch measures arrival and return without moving source text, hrefs or geometry on both routes',async(t)=>{
  const page=await open(t);
  for(const route of ['/projects','/notes']) {
    await ready(page,route);await page.locator('[data-kame]').waitFor({state:'attached'});
    const card=page.locator('[data-paper-id]').first();const fetch=card.getByRole('button',{name:'Fetch back',exact:true});await fetch.focus();
    const before=await card.boundingBox();const text=await card.evaluate(el=>[...el.children].filter(c=>!c.hasAttribute('data-paper-controls')).map(c=>c.textContent).join(''));
    const hrefs=await card.locator('a').evaluateAll(as=>as.map(a=>a.getAttribute('href')));
    await observe(page);await page.keyboard.press('Enter');await completed(page);
    sameRect(await card.boundingBox(),before);
    assert.deepEqual(await card.locator('a').evaluateAll(as=>as.map(a=>a.getAttribute('href'))),hrefs);
    assert.equal(await card.evaluate(el=>[...el.children].filter(c=>!c.hasAttribute('data-paper-controls')).map(c=>c.textContent).join('')),text);
  }
});

test('mouse grip toss, exact click suppression, text selection and native link navigation',async(t)=>{
  const page=await open(t);const card=page.locator('[data-paper-id]').first();const grip=card.getByRole('button',{name:'Drag paper',exact:true});
  await grip.focus();const r=(await grip.boundingBox())!;await observe(page);
  await page.mouse.move(r.x+22,r.y+22);await page.mouse.down();await page.mouse.move(r.x-140,r.y+80,{steps:8});await page.mouse.up();await completed(page);
  assert.equal(new URL(page.url()).pathname,'/projects');
  // A later real grip activation must work; no sticky suppression token.
  await observe(page);await grip.click();await completed(page);
  const paragraph=card.locator('.cartridge-note');
  await paragraph.evaluate(el=>{const range=document.createRange();range.selectNodeContents(el);const s=getSelection()!;s.removeAllRanges();s.addRange(range);});
  assert.ok((await page.evaluate(()=>getSelection()?.toString()))?.length);
  assert.equal(await page.locator('[data-fetch-proxy]').count(),0);
  await page.evaluate(()=>getSelection()?.removeAllRanges());
  const link=card.locator('a.project-title');const href=await link.getAttribute('href');await link.click();assert.equal(new URL(page.url()).pathname,href);
});

test('continuous mouse path across the title and its open Peek reaches a visible Fetch back',async(t)=>{
  const page=await open(t);const card=page.locator('[data-paper-id^="project:"]').first();
  const back=card.getByRole('button',{name:'Fetch back',exact:true});const link=card.locator('a.project-title');
  const before=(await card.boundingBox())!;const href=await link.getAttribute('href');
  // Dwell on the stretched title link until its real Peek fan opens under the pointer.
  const start={x:before.x+before.width/2,y:before.y+before.height/2};
  await page.mouse.move(before.x-20,start.y);await page.mouse.move(start.x,start.y,{steps:6});
  const fan=page.locator('.peek-layer[data-state="open"]');await fan.waitFor({state:'visible'});
  // Visiting the open fan and returning to the card must re-measure; no mutation marks that return.
  let f=(await fan.boundingBox())!;await page.mouse.move(f.x+f.width/2,f.y+f.height/2,{steps:4});
  await page.mouse.move(start.x,start.y,{steps:4});await fan.waitFor({state:'visible'});
  f=(await fan.boundingBox())!;const target=(await back.boundingBox())!;
  assert.ok(target.x>=f.x+f.width||target.x+target.width<=f.x||target.y>=f.y+f.height||target.y+target.height<=f.y,`open fan ${JSON.stringify(f)} leaves Fetch back ${JSON.stringify(target)} clear`);
  const end={x:target.x+target.width/2,y:target.y+target.height/2};const hits:string[]=[];
  for(let i=1;i<=12;i++) {
    await page.mouse.move(start.x+(end.x-start.x)*i/12,start.y+(end.y-start.y)*i/12);
    hits.push(await page.evaluate(({x,y})=>{const e=document.elementFromPoint(x,y);return e?.closest('.peek-layer')?'peek':e?.closest('.paper-fetch')?'fetch':e?.closest('a.project-title')||e?.closest('[data-paper-id]')?'card':String(e?.className);},{x:start.x+(end.x-start.x)*i/12,y:start.y+(end.y-start.y)*i/12}));
  }
  assert.ok(!hits.includes('peek'),`pointer path never lands on Peek: ${hits}`);assert.equal(hits.at(-1),'fetch');
  assert.equal(await back.evaluate(el=>getComputedStyle(el.parentElement!).opacity),'1');
  await observe(page);await page.mouse.down();await page.mouse.up();await completed(page);
  assert.equal(new URL(page.url()).pathname,'/projects');assert.equal(await link.getAttribute('href'),href);
  await page.mouse.move(5,5);await page.waitForFunction(()=>!document.querySelector('[data-paper-actions]'));
  await card.evaluate(el=>Promise.all(el.getAnimations({subtree:true}).map(a=>a.finished.catch(()=>{}))));sameRect(await card.boundingBox(),before);
});

test('real mobile CDP grip fetch and card-body scrolling negative control',async(t)=>{
  const page=await open(t,'/notes',{viewport:{width:390,height:844},hasTouch:true,isMobile:true});
  const card=page.locator('[data-paper-id]').first();const grip=card.getByRole('button',{name:'Drag paper',exact:true});await grip.scrollIntoViewIfNeeded();
  const r=(await grip.boundingBox())!;await observe(page);await touchDrag(page,r.x+22,r.y+22,-100,45);await completed(page);
  await page.evaluate(()=>scrollTo(0,0));const before=await page.evaluate(()=>scrollY);const body=(await card.boundingBox())!;
  await touchDrag(page,body.x+body.width/2,Math.min(650,body.y+body.height/2),0,-160);
  await page.waitForFunction(y=>scrollY>y+30,before);
  assert.equal(await page.locator('[data-fetch-proxy]').count(),0);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
});

test('chips and sticker perform real fetch while links and source dimensions stay intact',async(t)=>{
  const page=await open(t);
  for(const selector of ['.end-lines li[data-paper-id]','.paper-sticker']) {
    const source=page.locator(selector).first();const button=source.getByRole('button',{name:'Fetch back',exact:true});await button.focus();
    await page.locator('.end[data-seen="true"]').waitFor();
    await source.evaluate(async el=>{for(let p:Element|null=el;p;p=p.parentElement) await Promise.all(p.getAnimations().filter(a=>Number.isFinite(a.effect?.getComputedTiming().endTime)).map(a=>a.finished.catch(()=>{})));});
    const before=await source.boundingBox();await observe(page);await page.keyboard.press('Enter');await completed(page);sameRect(await source.boundingBox(),before);
  }
  const chip=page.locator('[data-end-line]').first();assert.ok(await chip.getAttribute('href'));assert.ok(await chip.innerText());
});

test('Escape, blur, hidden page, resize, modal, motion, dismissal and removed sources cancel immediately',async(t)=>{
  const page=await open(t);
  for(const action of ['escape','blur','hidden','resize','modal','motion','dismiss','remove']) {
    t.diagnostic(`cancel path: ${action}`);
    await page.waitForFunction(()=>{const k=document.querySelector<HTMLElement>('[data-kame]');return k&&!k.hidden&&k.dataset.motion==='on';});
    const card=page.locator('[data-paper-id]').first();const fetch=card.getByRole('button',{name:'Fetch back',exact:true});await fetch.focus();await page.keyboard.press('Enter');
    await page.locator('[data-fetch-proxy]').waitFor();
    if(action==='escape') await page.keyboard.press('Escape');
    if(action==='blur') await page.evaluate(()=>window.dispatchEvent(new Event('blur')));
    if(action==='hidden') await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});
    if(action==='resize') await page.setViewportSize({width:1270,height:860});
    if(action==='modal') await page.keyboard.press('Control+k');
    if(action==='motion') await page.emulateMedia({reducedMotion:'reduce'});
    if(action==='dismiss') await page.locator('[data-kame-action="hide"]').evaluate(el=>(el as HTMLButtonElement).click());
    if(action==='remove') await card.evaluate(el=>el.remove());
    await page.locator('[data-fetch-proxy]').waitFor({state:'detached',timeout:1000});
    if(action==='hidden') await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:false});document.dispatchEvent(new Event('visibilitychange'));});
    if(action==='modal') await page.keyboard.press('Escape');
    if(action==='motion') await page.emulateMedia({reducedMotion:'no-preference'});
    if(action==='dismiss') await page.locator('[data-kame-action="restore"]').evaluate(el=>(el as HTMLButtonElement).click());
  }
});

test('pointer cancellation and capture loss release the shared owner; reduced motion and rejection restore instantly',async(t)=>{
  const page=await open(t);const card=page.locator('[data-paper-id]').first();const grip=card.getByRole('button',{name:'Drag paper',exact:true});
  for(const reason of ['pointercancel','lostpointercapture']) {
    const r=(await grip.boundingBox())!;await page.mouse.move(r.x+22,r.y+22);await page.mouse.down();await page.mouse.move(r.x-40,r.y+30);
    await page.locator('[data-fetch-proxy]').waitFor();
    await grip.evaluate((el,type)=>el.dispatchEvent(new PointerEvent(type,{pointerId:1,bubbles:true})),reason);await page.mouse.up();
    assert.equal(await page.locator('[data-fetch-proxy]').count(),0);
  }
  await page.emulateMedia({reducedMotion:'reduce'});await grip.click();assert.equal(await page.locator('[data-fetch-proxy]').count(),0);
  assert.match(await card.locator('[data-paper-message]').textContent()??'',/back|rest/i);
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.locator('[data-kame-action="hide"]').evaluate(el=>(el as HTMLButtonElement).click());await grip.click();assert.equal(await page.locator('[data-fetch-proxy]').count(),0);
  assert.match(await card.locator('[data-paper-message]').textContent()??'',/back|unavailable/i);
});

test('unreachable real turtle is a negative control: timeout cancels instead of claiming returned',async(t)=>{
  const page=await open(t);await page.addStyleTag({content:'[data-kame]{transform:translate3d(0px,80px,0)!important}'});
  const card=page.locator('[data-paper-id]').first();await card.getByRole('button',{name:'Fetch back',exact:true}).focus();
  await page.clock.install();await page.keyboard.press('Enter');await page.clock.runFor(5100);
  assert.equal(await page.locator('[data-fetch-proxy]').count(),0);assert.notEqual(await card.getAttribute('data-fetch-state'),'returned');
  assert.match(await card.locator('[data-paper-message]').textContent()??'',/back|cancel|reach/i);
});

test('Save-Data keeps toys unloaded, paper-only fetch rejects, explicit Kame enable permits measured completion',async(t)=>{
  const context=await browser.newContext({viewport:{width:1280,height:860}});t.after(()=>context.close());
  await context.addInitScript(()=>{Object.defineProperty(navigator,'connection',{value:{saveData:true}});});
  const page=await context.newPage();await page.goto(`${BASE}/notes`);
  await page.getByRole('button',{name:'Enable paper corners',exact:true}).waitFor();
  assert.equal(await page.locator('[data-paper-controls],[data-kame],.paper-sticker').count(),0);
  await page.getByRole('button',{name:'Enable paper corners',exact:true}).click();
  const card=page.locator('[data-paper-id]').first();const fetch=card.getByRole('button',{name:'Fetch back',exact:true});await fetch.focus();await page.keyboard.press('Enter');
  assert.equal(await page.locator('[data-fetch-proxy]').count(),0);assert.match(await card.locator('[data-paper-message]').textContent()??'',/back/);
  await page.getByRole('button',{name:'Enable Kame companion',exact:true}).click();await page.locator('[data-kame]').waitFor();
  await fetch.focus();await observe(page);await page.keyboard.press('Enter');await completed(page);
});

test('native prose selection, wrong-pointer cancellation, route departure and pagehide keep sources recoverable',async(t)=>{
  const page=await open(t,'/notes');const card=page.locator('[data-paper-id]').first();
  const prose=card.locator('p').first();
  const textBox=await prose.evaluate(el=>{const r=document.createRange();r.setStart(el.firstChild!,0);r.setEnd(el.firstChild!,Math.min(12,el.firstChild!.textContent!.length));const b=r.getBoundingClientRect();return {x:b.x,y:b.y,width:b.width,height:b.height};});
  await page.mouse.move(textBox.x+1,textBox.y+textBox.height/2);await page.mouse.down();await page.mouse.move(textBox.x+textBox.width-1,textBox.y+textBox.height/2,{steps:6});await page.mouse.up();
  assert.ok((await page.evaluate(()=>getSelection()?.toString()))?.length);
  assert.equal(await page.locator('[data-fetch-proxy]').count(),0);await page.evaluate(()=>getSelection()?.removeAllRanges());
  const grip=card.getByRole('button',{name:'Drag paper',exact:true});await grip.focus();const r=(await grip.boundingBox())!;
  await page.mouse.move(r.x+22,r.y+22);await page.mouse.down();await page.mouse.move(r.x-60,r.y+60);
  await grip.evaluate(el=>el.dispatchEvent(new PointerEvent('pointercancel',{pointerId:999,bubbles:true})));
  assert.equal(await page.locator('[data-fetch-proxy]').count(),1,'wrong pointer cannot cancel owner');await page.keyboard.press('Escape');await page.mouse.up();
  assert.equal(await page.locator('[data-fetch-proxy]').count(),0);
  const back=card.getByRole('button',{name:'Fetch back',exact:true});await back.focus();await page.keyboard.press('Enter');await page.locator('[data-fetch-proxy]').waitFor();
  await page.evaluate(()=>window.dispatchEvent(new Event('pagehide')));
  assert.equal(await page.locator('[data-fetch-proxy],[data-paper-controls],.paper-sticker').count(),0);
  await page.evaluate(()=>window.dispatchEvent(new Event('pageshow')));await page.locator('[data-paper-controls]').first().waitFor();
  await back.focus();await page.keyboard.press('Enter');await page.locator('[data-fetch-proxy]').waitFor();
  await page.locator('[data-end-page="/projects"]').click();await page.waitForURL('**/projects');
  assert.equal(await page.locator('[data-fetch-proxy]').count(),0);
  await page.locator('[data-paper-id^="project:"] [data-paper-controls]').first().waitFor();
  await page.locator('.paper-sticker [data-paper-controls]').waitFor();
  assert.equal(await page.locator('.paper-sticker').count(),1,'one adapter after departure');
});

test('peeled mobile cards keep all fetch actions clear of the real margin note',async(t)=>{
  const page=await open(t,'/projects',{viewport:{width:390,height:844},hasTouch:true,isMobile:true});
  const card=page.locator('[data-paper-id]').first();await card.getByRole('button',{name:'Peel corner',exact:true}).focus();await page.keyboard.press('Enter');
  const note=(await card.locator('.paper-margin').boundingBox())!;
  const buttons=await card.locator('.paper-actions button').evaluateAll(bs=>bs.map(b=>b.getBoundingClientRect().bottom));
  assert.ok(note.y>=Math.max(...buttons)-1,'margin starts below every wrapped action');
  const back=card.getByRole('button',{name:'Fetch back',exact:true});await back.focus();await observe(page);await page.keyboard.press('Enter');await completed(page);
});
