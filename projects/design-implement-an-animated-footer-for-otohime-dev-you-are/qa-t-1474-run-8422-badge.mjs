// Independent real-key badge timing check; PW_PREFIX, BASE_URL, EXPECT_SHA, QA_BADGE_OUT required.
import {createRequire} from 'node:module';
import {writeFile} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const {chromium}=createRequire(path.resolve(process.env.PW_PREFIX,'package.json'))('playwright');
const browser=await chromium.launch();
const rows=[];
const seq=['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','B','A'];
const base=process.env.BASE_URL;
assert(base && process.env.EXPECT_SHA && process.env.QA_BADGE_OUT);
assert(!path.resolve(process.env.QA_BADGE_OUT).startsWith(process.cwd()+'/'));
const snap=async p=>p.locator('footer.end:visible').evaluate(f=>{const b=f.querySelector('[data-end-badge]'),s=getComputedStyle(b),r=b.getBoundingClientRect();return {sha:document.querySelector('meta[name="build-sha"]').content,unlocked:b.dataset.unlocked,opacity:s.opacity,visibility:s.visibility,hidden:document.hidden,y:r.y,animations:b.getAnimations().map(a=>({state:a.playState,time:a.currentTime,duration:a.effect.getTiming().duration}))}});
try{
 for(let i=0;i<3;i++){
  const c=await browser.newContext({viewport:{width:1366,height:768}}),p=await c.newPage();
  await p.goto(base+'/projects');await p.locator('[data-end-mascot]').scrollIntoViewIfNeeded();
  await p.waitForTimeout(1000);await p.locator('[data-end-mascot]').focus();
  for(const k of [...seq.slice(0,8),'x','b','a'])await p.keyboard.press(k);
  await p.keyboard.press('ArrowUp');for(const k of seq)await p.keyboard.press(k);
  const immediate=await snap(p);await p.waitForTimeout(250);const after250=await snap(p);
  await p.waitForFunction(()=>{const b=document.querySelector('[data-end-badge]'),s=getComputedStyle(b);return b.dataset.unlocked==='true'&&s.visibility==='visible'&&+s.opacity>=.99},null,{timeout:3000});
  const settled=await snap(p);assert.equal(settled.sha,process.env.EXPECT_SHA);
  rows.push({i,immediate,after250,settled});await c.close();
 }
}finally{await writeFile(process.env.QA_BADGE_OUT,JSON.stringify({browser:browser.version(),rows},null,2));console.log(JSON.stringify(rows));await browser.close()}
