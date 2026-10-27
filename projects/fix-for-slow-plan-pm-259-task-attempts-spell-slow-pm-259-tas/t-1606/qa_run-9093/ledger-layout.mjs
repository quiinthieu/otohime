import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
const base=process.env.BASE_URL??'http://localhost:4063';
const browser=await chromium.launch({channel:'chrome',env:{...process.env,TMPDIR:'/tmp'}});
try {
 for(let trial=1;trial<=4;trial++) {
  const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true});
  try {
   const page=await context.newPage();
   await page.addInitScript(()=>{
    window.qaLedgerFrames=[];
    const sample=()=>{
     const e=document.querySelector('.ledger-scroll'),svg=document.querySelector('.ledger-sheet');
     if(e&&svg) window.qaLedgerFrames.push({at:performance.now(),innerWidth,viewport:visualViewport?.width,scrollWidth:e.scrollWidth,clientWidth:e.clientWidth,svgWidth:svg.getBoundingClientRect().width,minWidth:getComputedStyle(svg).minWidth,fontSize:getComputedStyle(document.documentElement).fontSize});
     if(window.qaLedgerFrames.length<40) requestAnimationFrame(sample);
    };requestAnimationFrame(sample);
   });
   assert.equal((await page.goto(base+'/ledger',{waitUntil:'load'})).status(),200);
   await page.waitForFunction(()=>[document.querySelector('.ledger-cell'),document.querySelector('.ledger-press button')].every(e=>e&&Object.keys(e).some(k=>k.startsWith('__reactProps'))));
   const read=()=>page.evaluate(()=>{const e=document.querySelector('.ledger-scroll'),s=document.querySelector('.ledger-sheet');return {at:performance.now(),innerWidth,viewport:visualViewport?.width,pageOverflow:document.documentElement.scrollWidth-innerWidth,scrollWidth:e.scrollWidth,clientWidth:e.clientWidth,svgWidth:s.getBoundingClientRect().width,minWidth:getComputedStyle(s).minWidth,fontSize:getComputedStyle(document.documentElement).fontSize,frames:window.qaLedgerFrames};});
   const atHydration=await read();
   await page.evaluate(()=>new Promise(requestAnimationFrame));
   await page.evaluate(()=>new Promise(requestAnimationFrame));
   const afterFrames=await read();
   if(trial===4){
    assert.ok(afterFrames.scrollWidth>afterFrames.clientWidth);
    await page.locator('.ledger-sheet').evaluate(e=>e.style.minWidth='0px');
    const removedMinimum=await read();
    assert.equal(removedMinimum.scrollWidth>removedMinimum.clientWidth,false,'removing the sheet minimum must be rejected by the real scroll assertion');
    console.log(JSON.stringify({trial,negativeControl:'browser-only removal of 46rem minimum makes the exact scroll assertion false',before:afterFrames,after:removedMinimum}));
   }
   console.log(JSON.stringify({trial,base,atHydration,afterFrames,meaning:'bounded diagnostic, not an unchanged retry that clears the failed production suite'}));
  } finally {await context.close();}
 }
} finally {await browser.close();}
