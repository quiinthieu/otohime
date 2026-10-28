import { chromium, type Browser, type Page } from "playwright-core";
export const BASE = process.env.BASE_URL ?? "http://localhost:4000";
export async function launchTactileBrowser(): Promise<Browser> {
  const env = { ...process.env, TMPDIR: "/tmp" };
  if (process.env.CHROME_PATH) return chromium.launch({executablePath:process.env.CHROME_PATH,env});
  try { return await chromium.launch({channel:"chrome",env}); }
  catch { return chromium.launch({env}); }
}
export async function ready(page: Page, route="/projects") {
  await page.goto(`${BASE}${route}`);
  await page.locator('[data-paper-id] [data-paper-controls]').first().waitFor({timeout:15000});
}
export async function state(page: Page, expected: string) {
  await page.waitForFunction(s => document.querySelector('[data-paper-id]')?.getAttribute('data-paper-state')===s, expected, {timeout:5000});
}
export async function touchDrag(page: Page, x: number, y: number, dx: number, dy: number) {
  const cdp=await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
  for(let i=1;i<=6;i++) {
    await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+dx*i/6,y:y+dy*i/6}]});
    await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>resolve())));
  }
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await cdp.detach();
}

/** Observe real production renderer bytes rather than inferring loading from UI. */
export function paperImports(page: Page, marker = 'paper-tools') {
  const urls: string[]=[];
  const responses: Promise<void>[]=[];
  page.on('response',response=>{
    if(response.request().resourceType()==='script') responses.push((async()=>{
      const body=await response.text();
      if(body.includes(marker)) urls.push(response.url());
    })());
  });
  return async()=>{await Promise.all(responses);return [...urls];};
}
