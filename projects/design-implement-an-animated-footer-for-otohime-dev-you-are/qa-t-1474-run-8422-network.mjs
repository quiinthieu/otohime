// Independent read-only attribution control for the existing Music television.
// PW_PREFIX=/tmp/pw BASE_URL=https://otohime.dev QA_NET_OUT=/tmp/network.json node <file>
import assert from "node:assert/strict";
import {createRequire} from "node:module";
import {writeFile} from "node:fs/promises";
import path from "node:path";
const {chromium}=createRequire(path.resolve(process.env.PW_PREFIX,"package.json"))("playwright");
const base=process.env.BASE_URL;
const output=process.env.QA_NET_OUT;
assert(base && output && !path.resolve(output).startsWith(process.cwd()+"/"));
const browser=await chromium.launch();
const runs=[];
try {
 for(const blockPlayer of [false,true]) {
  const context=await browser.newContext({viewport:{width:1366,height:768}});
  const page=await context.newPage();
  const requests=[];
  if(blockPlayer) await page.route("https://www.youtube.com/iframe_api",route=>route.abort());
  page.on("request",r=>{
   const u=new URL(r.url());
   if(!["http:","https:"].includes(u.protocol)||u.origin===new URL(base).origin)return;
   let frame="unavailable";try{frame=r.frame().url()}catch{}
   requests.push({host:u.hostname,path:u.pathname,type:r.resourceType(),frame});
  });
  await page.goto(base+"/music");
  await page.locator("footer.end").scrollIntoViewIfNeeded();
  await page.waitForTimeout(5000);
  const data=await page.evaluate(()=>({sha:document.querySelector('meta[name="build-sha"]').content,footer:document.querySelectorAll('footer.end').length,iframes:[...document.querySelectorAll('iframe')].map(e=>new URL(e.src).origin)}));
  const ads=requests.filter(r=>r.host.endsWith(".doubleclick.net"));
  runs.push({blockPlayer,...data,requests,ads});
  await context.close();
 }
 assert.equal(runs[0].footer,1);assert.equal(runs[1].footer,1);
 assert(runs[0].ads.length>0,"Real player must reproduce the reported request");
 assert.equal(runs[1].ads.length,0,"Blocking only the existing player API must remove ads requests");
 console.log(JSON.stringify({browser:browser.version(),runs:runs.map(r=>({blockPlayer:r.blockPlayer,sha:r.sha,ads:r.ads.length,iframes:r.iframes}))}));
}finally{await writeFile(output,JSON.stringify({browser:browser.version(),runs},null,2));await browser.close()}
