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
  await page.waitForFunction(s => document.querySelector('[data-paper-id]')?.getAttribute('data-paper-state')===s, expected);
}
export async function touchDrag(page: Page, x: number, y: number, dx: number, dy: number) {
  const cdp=await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
  for(let i=1;i<=6;i++) await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+dx*i/6,y:y+dy*i/6}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await cdp.detach();
}
