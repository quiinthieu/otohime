import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {chromium} from 'playwright-core';
const base=process.env.BASE_URL??'http://localhost:4027';
const browser=await chromium.launch({channel:'chrome',env:{...process.env,TMPDIR:'/tmp'}});
try{
 for(const width of [1366,390]){
  const context=await browser.newContext({viewport:{width,height:844},reducedMotion:'reduce',isMobile:width===390,hasTouch:width===390});
  try{
   const page=await context.newPage();await page.goto(base+'/projects',{waitUntil:'load'});await page.locator('.bottle-footer-entry').waitFor();await page.evaluate(()=>document.fonts.ready);
   const measure=()=>page.evaluate(()=>{const e=document.querySelector('.bottle-footer-entry'),b=e.getBoundingClientRect(),s=document.querySelector('.end-canvas').getBoundingClientRect();return {height:b.height,gap:s.top-b.bottom,left:b.left,right:b.right,style:getComputedStyle(e).insetBlockEnd};});
   const baseline=await measure();assert.ok(baseline.gap>=0);
   await page.locator('.bottle-footer-entry').evaluate(e=>e.style.fontSize='24px');const enlarged=await measure();assert.ok(enlarged.gap>=0);assert.ok(enlarged.height>baseline.height);
   await page.locator('.bottle-footer-entry').evaluate(e=>{e.style.insetBlockEnd='auto';e.style.insetBlockStart='-2.4rem';e.style.marginBlockEnd='0';});const old=await measure();assert.ok(old.gap<0,'old layout must fail under the same real font metrics');
   console.log(JSON.stringify({base,width,browser:browser.version(),head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),build:base.includes('localhost')?readFileSync('.next/BUILD_ID','utf8').trim():null,servedSha:await page.locator('meta[name="build-sha"]').getAttribute('content'),baseline,enlarged,old,meaning:'independent real production geometry; browser-only old-offset negative control'}));
  }finally{await context.close();}
 }
}finally{await browser.close();}
