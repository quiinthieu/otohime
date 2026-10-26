import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import { chromium, type Browser, type BrowserContext, type BrowserContextOptions, type Page } from "playwright-core";
import { projectStories } from "../content/project-stories.ts";
const BASE = process.env.BASE_URL ?? "http://localhost:4000";
let browser: Browser;
const contexts: BrowserContext[] = [];
const tmp = mkdtempSync('/tmp/kami-e2e-');
before(async () => {
  const env = {...process.env,TMPDIR:tmp};
  if (process.env.CHROME_PATH) browser = await chromium.launch({executablePath:process.env.CHROME_PATH,env});
  else {
    try { browser = await chromium.launch({channel:"chrome",env}); }
    catch { browser = await chromium.launch({env}); }
  }
});
after(async () => { for (const c of contexts) await c.close(); await browser?.close(); rmSync(tmp,{recursive:true,force:true}); });
async function open(options: BrowserContextOptions = {}, unsupported = false) {
  const context = await browser.newContext({viewport:{width:1366,height:768},...options}); contexts.push(context);
  await context.addInitScript(({unsupported}) => {
    if (unsupported) Object.defineProperty(Document.prototype,'startViewTransition',{value:undefined,configurable:true});
    const animations: string[] = [];
    Object.assign(window, {kamiAnimations: animations});
    if (!unsupported) {
      const start = document.startViewTransition.bind(document);
      document.startViewTransition = (...args: Parameters<typeof start>) => {
        const transition = start(...args);
        void transition.ready.then(() => {
          for (const a of document.getAnimations()) if (a instanceof CSSAnimation) animations.push(a.animationName);
        }, () => {});
        return transition;
      };
    }
    const connections = new Map<OscillatorNode, AudioContext>();
    const audio = {made:0, nodes:0, disconnected:0, maxLive:0,
      get live() { return [...connections.values()].filter(c=>c.state!=="closed").length; }
    };
    Object.assign(window,{kamiAudio:audio});
    const RealAudio = window.AudioContext;
    window.AudioContext = class extends RealAudio {
      constructor() { super(); audio.made++; }
      createOscillator() {
        const osc = super.createOscillator(); audio.nodes++;
        connections.set(osc,this); audio.maxLive = Math.max(audio.maxLive,audio.live);
        const disconnect = osc.disconnect.bind(osc);
        osc.disconnect = () => { if (connections.delete(osc)) audio.disconnected++; disconnect(); };
        return osc;
      }
    };
  },{unsupported});
  const page = await context.newPage();
  page.setDefaultTimeout(8000);
  const errors: string[] = [];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{ if(m.type()==='error') errors.push(m.text()); });
  return {page,context,errors};
}
const counter = (page:Page,n:number) => page.getByRole('status').filter({hasText:`Card ${n} of 3`}).waitFor();
const audioState = (page:Page) => page.evaluate(()=>(window as unknown as {kamiAudio:{made:number;nodes:number;live:number;disconnected:number;maxLive:number}}).kamiAudio);
async function activate(page:Page) {
  await page.getByRole('button',{name:'Theatre mode',exact:true}).click();
  await counter(page,1);
}

test('33 server-rendered readable cards and normal project links survive no JavaScript',async()=>{
  const {page} = await open({javaScriptEnabled:false}); await page.goto(`${BASE}/projects`);
  assert.equal(await page.locator('.kamishibai-stories ol > li').count(),33);
  assert.equal(await page.locator('.kamishibai-stories ol > li:visible').count(),33);
  for (const story of Object.values(projectStories)) {
    assert.equal(await page.locator(`.cartridges a.project-title[href="${story.href}"]`).count(),1);
    for (const card of story.cards) assert.ok(await page.getByText(card.caption,{exact:true}).isVisible());
  }
  await page.locator('.cartridges a[href="/rotor"]').click(); await page.waitForURL('**/rotor');
  assert.ok(await page.locator('h1').isVisible());
});

test('theatre navigation is bounded, scoped and retains all projects and named page hops',async()=>{
  const {page,errors} = await open(); await page.goto(`${BASE}/projects`); await activate(page);
  await page.getByRole('button',{name:'Previous card',exact:true}).focus(); await page.keyboard.press('ArrowLeft'); await counter(page,1);
  const next = page.getByRole('button',{name:'Next card',exact:true});
  await next.focus(); await page.keyboard.press('ArrowRight'); await counter(page,2);
  assert.equal(await next.evaluate(e=>e===document.activeElement),true);
  await page.waitForFunction(()=>(window as unknown as {kamiAnimations:string[]}).kamiAnimations.some(n=>n.startsWith('kamishibai-')));
  await page.getByRole('button',{name:'Console sounds',exact:true}).focus();
  await page.keyboard.press('ArrowRight'); await counter(page,2); // Pocket/masthead is outside the scope.
  await next.focus();
  await next.press('ArrowRight'); await counter(page,3);
  assert.equal(await next.getAttribute('aria-disabled'),'true');
  await next.press('ArrowRight'); await counter(page,3);
  await next.press('ArrowLeft'); await counter(page,2);
  const select = page.getByRole('combobox',{name:'Project',exact:true});
  await select.focus(); await select.press('ArrowLeft'); await counter(page,2);
  // Inputs and dialogs inside the scope must keep their own arrow keys.
  await page.locator('.kamishibai-enhanced').evaluate(el=>{
    const input=document.createElement('input'); input.id='kami-negative-input';el.append(input);
    const dialog=document.createElement('div');dialog.setAttribute('role','dialog');
    dialog.innerHTML='<button id="kami-negative-dialog">Dialog control</button>';el.append(dialog);
  });
  for (const id of ['kami-negative-input','kami-negative-dialog']) {
    await page.locator(`#${id}`).focus(); await page.keyboard.press('ArrowRight'); await counter(page,2);
  }
  await page.locator('#kami-negative-input').evaluate(e=>e.remove());
  await page.locator('[role="dialog"]').filter({has:page.locator('#kami-negative-dialog')}).evaluate(e=>e.remove());
  for (const story of Object.values(projectStories)) {
    await select.selectOption(story.href); await counter(page,1);
    assert.ok(await page.getByRole('heading',{name:story.cards[0].title,exact:true}).isVisible());
    await next.click(); await counter(page,2); await next.click(); await counter(page,3);
    assert.equal(await page.getByRole('link',{name:`Visit ${story.title} →`,exact:true}).getAttribute('href'),story.href);
  }
  await page.getByRole('button',{name:'Read all cards',exact:true}).last().click();
  assert.equal(await page.locator('.kamishibai-stories ol > li:visible').count(),33);
  assert.equal(await page.getByRole('heading',{name:'All project story cards',exact:true}).evaluate(e=>e===document.activeElement),true);
  // Normal site page-in/out and cross-document project navigation.
  await page.locator('.cartridges a[href="/shore"]').click();await page.waitForURL('**/shore');
  await page.goBack();await page.waitForURL('**/projects');
  await page.getByRole('link',{name:'Work',exact:true}).first().click();await page.waitForURL('**/work');
  assert.deepEqual(errors.filter(e=>/duplicate|view.transition|kamishibai/i.test(e)),[]);
});

test('both Read all cards controls focus the committed list without an animation frame',async()=>{
  const {page} = await open(); await page.goto(`${BASE}/projects`);
  for (const control of ['stage','mode']) {
    await activate(page);
    // Hold application rAF callbacks: focus must follow the DOM commit, not a
    // frame that can run before it (or be delayed in a throttled tab).
    await page.evaluate(()=>{
      const original=window.requestAnimationFrame;
      window.requestAnimationFrame=()=>0;
      Object.assign(window,{restoreKamiFrames:()=>{window.requestAnimationFrame=original;}});
    });
    try {
      const buttons=page.getByRole('button',{name:'Read all cards',exact:true});
      await (control==='stage'?buttons.last():buttons.first()).click();
      await page.waitForFunction(()=>document.activeElement===document.querySelector('.kamishibai-list h2'),{},{polling:20});
      assert.equal(await page.locator('.kamishibai-stories ol > li:visible').count(),33);
    } finally {
      await page.evaluate(()=>(window as unknown as {restoreKamiFrames:()=>void}).restoreKamiFrames());
    }
  }
});

test('unsupported transitions swap instantly and live reduced motion restores the whole list',async()=>{
  const {page} = await open({},true);await page.goto(`${BASE}/projects`);await activate(page);
  assert.equal(await page.evaluate(()=>typeof document.startViewTransition),'undefined');
  await page.getByRole('button',{name:'Next card',exact:true}).click();await counter(page,2);
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.locator('.kamishibai-enhanced').waitFor({state:'detached'});
  assert.equal(await page.locator('.kamishibai-stories ol > li:visible').count(),33);
  assert.ok(await page.getByRole('button',{name:'Theatre mode',exact:true}).isDisabled());
});

test('real shared audio starts deliberately, synchronizes mute, cancels rapid changes and all teardown paths',async()=>{
  const {page,errors} = await open();await page.goto(`${BASE}/projects`);await activate(page);
  assert.equal((await audioState(page)).made,0);
  await page.getByRole('button',{name:'Enable theatre sound',exact:true}).click();
  await page.waitForFunction(()=>(window as unknown as {kamiAudio:{live:number}}).kamiAudio.live>4);
  assert.equal((await audioState(page)).made,1);
  assert.equal(await page.getByRole('button',{name:'Console sounds',exact:true}).getAttribute('aria-pressed'),'true');
  let previous=(await audioState(page)).disconnected;
  for (let i=0;i<6;i++) {
    await page.getByRole('button',{name:i%2?'Previous card':'Next card',exact:true}).click();
  }
  assert.ok((await audioState(page)).disconnected>previous);
  assert.ok((await audioState(page)).maxLive<=32,'at most 30 theatre + 2 enable oscillators, each with one gain');
  await page.getByRole('button',{name:'Console sounds',exact:true}).click();
  assert.ok((await audioState(page)).live<=2,'mute immediately disconnects all theatre voice nodes');
  assert.ok(await page.getByRole('button',{name:'Enable theatre sound',exact:true}).isVisible());
  await page.waitForFunction(()=>(window as unknown as {kamiAudio:{live:number}}).kamiAudio.live===0);
  for (const path of ['list','hidden','pagehide','reduced','route']) {
    if (!await page.locator('.kamishibai-enhanced').count()) await activate(page);
    const mute = page.getByRole('button',{name:'Mute theatre sound',exact:true});
    if (await mute.count()) await mute.click();
    await page.getByRole('button',{name:'Enable theatre sound',exact:true}).click();
    await page.waitForFunction(()=>(window as unknown as {kamiAudio:{live:number}}).kamiAudio.live>4).catch(async()=>{throw new Error(path+': '+JSON.stringify(await audioState(page))+' '+errors.join(';'));});
    previous=(await audioState(page)).disconnected;
    if(path==='list') await page.getByRole('button',{name:'Read all cards',exact:true}).last().click();
    if(path==='hidden') await page.evaluate(()=>{Object.defineProperty(document,'visibilityState',{value:'hidden',configurable:true});document.dispatchEvent(new Event('visibilitychange'));});
    if(path==='pagehide') await page.evaluate(()=>window.dispatchEvent(new Event('pagehide')));
    if(path==='reduced') await page.emulateMedia({reducedMotion:'reduce'});
    if(path==='route') await page.getByRole('link',{name:'Work',exact:true}).first().click();
    await page.waitForFunction(()=>(window as unknown as {kamiAudio:{live:number}}).kamiAudio.live===0).catch(async()=>{throw new Error(path+' teardown: '+JSON.stringify(await audioState(page))+' '+errors.join(';'));});
    assert.ok((await audioState(page)).disconnected>previous,path);
    if(path==='hidden') await page.evaluate(()=>Object.defineProperty(document,'visibilityState',{value:'visible',configurable:true}));
    if(path==='reduced') { await page.emulateMedia({reducedMotion:'no-preference'});await page.locator('.kamishibai-enhanced').waitFor(); }
  }
  assert.deepEqual(errors.filter(e=>/duplicate|view.transition|kamishibai/i.test(e)),[]);
});

test('production stage is truly lazy and stays within 40KiB gzip on desktop, touch and 200% zoom',async()=>{
  for (const viewport of [{width:1366,height:768},{width:390,height:844},{width:683,height:384}]) {
    const {page,errors} = await open({viewport,hasTouch:viewport.width===390,deviceScaleFactor:viewport.width===683?2:1});
    const scripts=new Map<string,Buffer>();const tasks:Promise<void>[]=[];
    page.on('response',response=>{
      if(/\/_next\/static\/.*\.(js|css)(\?|$)/.test(response.url())) tasks.push(response.body().then(b=>{scripts.set(response.url(),b);},()=>{}));
    });
    await page.goto(`${BASE}/projects`);await page.getByRole('button',{name:'Theatre mode',exact:true}).waitFor({state:'visible'});
    await page.waitForLoadState('networkidle');
    await Promise.all(tasks);
    const initial=new Set(scripts.keys());
    assert.ok(![...scripts.values()].some(b=>b.includes('Time beside the sea')),'story controller/data not in initial JS');
    await activate(page);await Promise.all(tasks);
    const incremental=[...scripts].filter(([url])=>!initial.has(url));
    assert.ok(incremental.some(([,b])=>b.includes('Time beside the sea')),'real stage chunk fetched after activation');
    // Conservative bound: all post-entry resources (including project-link prefetches),
    // the full loader route chunk and the complete feature stylesheet. Shared initial runtime excluded.
    const owned=[...scripts].filter(([url,b])=>!initial.has(url)||b.includes('Setting the paper stage')||b.includes('.kamishibai-wood'));
    const gzip=owned.reduce((sum,[,b])=>sum+gzipSync(b).length,0);
    assert.ok(gzip<=40*1024,`incremental theatre ${gzip} gzip: ${owned.map(([url,b])=>new URL(url).pathname+"="+gzipSync(b).length).join(",")}`);
    console.log(JSON.stringify({viewport,browser:browser.version(),gzip,chunks:owned.map(([url,b])=>({path:new URL(url).pathname,gzip:gzipSync(b).length,sha256:createHash('sha256').update(b).digest('hex')}))}));
    assert.ok(await page.getByRole('button',{name:'Next card',exact:true}).isVisible());
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'no horizontal overflow at zoom/touch');
    if (viewport.width===390) await page.getByRole('button',{name:'Next card',exact:true}).tap();
    else await page.getByRole('button',{name:'Next card',exact:true}).click();
    await counter(page,2);
    await page.getByRole('link',{name:'Visit Shore →',exact:true}).click();await page.waitForURL('**/shore');
    assert.deepEqual(errors.filter(e=>/duplicate|view.transition|kamishibai/i.test(e)),[]);
  }
});


test('initial reduced motion keeps the full print and never loads the stage',async()=>{
  const {page}=await open({reducedMotion:'reduce'});
  await page.goto(`${BASE}/projects`);
  assert.equal(await page.locator('.kamishibai-stories ol > li:visible').count(),33);
  assert.ok(await page.getByRole('button',{name:'Theatre mode',exact:true}).isDisabled());
  assert.equal((await audioState(page)).made,0);
  assert.equal(await page.locator('.kamishibai-enhanced').count(),0);
});
