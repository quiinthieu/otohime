import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(`${process.cwd()}/package.json`);
const { chromium } = require('playwright-core');
const browser = await chromium.launch({channel:'chrome',env:{...process.env,TMPDIR:'/tmp'}});
try {
  const context = await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true,reducedMotion:'reduce'});
  const page = await context.newPage();
  const errors=[];
  page.on('pageerror', e=>errors.push(e.message));
  const base = process.env.BASE_URL ?? 'http://localhost:4027';
  assert.equal((await page.goto(`${base}/ledger`,{waitUntil:'load'})).status(),200);
  await page.locator('.ledger-scroll').waitFor({state:'visible'});
  await page.evaluate(()=>document.fonts.ready);
  const measure=()=>page.evaluate(()=>{
    const frame=document.querySelector('.ledger-scroll');
    const sheet=document.querySelector('.ledger-sheet');
    return {client:frame.clientWidth,scroll:frame.scrollWidth,sheet:sheet.getBoundingClientRect().width,min:getComputedStyle(sheet).minWidth,page:document.documentElement.scrollWidth,viewport:innerWidth};
  });
  const original=await measure();
  assert.ok(original.scroll>original.client,JSON.stringify(original));
  assert.ok(original.page<=original.viewport,JSON.stringify(original));
  await page.locator('.ledger-scroll').evaluate(el=>{el.scrollLeft=200;});
  const moved=await page.locator('.ledger-scroll').evaluate(el=>el.scrollLeft);
  assert.ok(moved>0,'actual scroller accepts movement');
  const style=await page.addStyleTag({content:'.ledger-sheet { min-width:0 !important; }'});
  const negative=await measure();
  assert.equal(negative.scroll,negative.client,JSON.stringify(negative));
  assert.throws(()=>assert.ok(negative.scroll>negative.client,'sheet must overflow'),/sheet must overflow/);
  await page.locator('.ledger-scroll').evaluate(el=>{el.scrollLeft=200;});
  assert.equal(await page.locator('.ledger-scroll').evaluate(el=>el.scrollLeft),0);
  await style.evaluate(el=>el.remove());
  assert.ok((await measure()).scroll>original.client);
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({base,browser:browser.version(),build:await page.locator('meta[name="build-sha"]').getAttribute('content'),original,moved,negative,negativeControl:'missing minimum rejects overflow and cannot scroll',errors}));
  await context.close();
} finally {await browser.close();}
