import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { chromium, type Browser } from "playwright-core";

const base = process.env.BASE_URL ?? "http://localhost:4388";
const writable = ["localhost","127.0.0.1"].includes(new URL(base).hostname) || process.env.ALLOW_PAPER_MEND === "1";
let browser: Browser;
before(async () => { browser = await chromium.launch({ channel:"chrome", headless:true, args:["--mute-audio"] }); });
after(async () => { await browser?.close(); });
const traceArchive = JSON.parse(readFileSync(new URL("../content/seismo.json", import.meta.url), "utf8"));

test("rage-click repairs, persists through reload and appears in the shared gallery", { skip:!writable }, async () => {
  const context = await browser.newContext({ viewport:{width:1366,height:900} });
  const page = await context.newPage();
  page.setDefaultNavigationTimeout(120_000);
  const errors: string[] = [];
  page.on("pageerror", e => errors.push(e.message));
  await page.goto(`${base}/kintsugi`,{waitUntil:"domcontentloaded"});
  const card = page.locator('[data-kintsugi-id="demo:golden-paper"]');
  await card.locator("button").waitFor();
  await page.waitForFunction(() => document.querySelector('[data-paper-id="demo:golden-paper"]')?.getAttribute("data-paper-hydrated")==="true");
  const host = page.locator('[data-paper-id="demo:golden-paper"]');
  const box = await host.boundingBox(); assert.ok(box);
  const saved = page.waitForResponse(r => r.url().endsWith("/api/kintsugi") && r.request().method()==="POST");
  for (let i=0;i<4;i++) await page.mouse.click(box.x+24,box.y+box.height-24,{delay:10});
  const response = await saved;
  assert.equal(response.status(),201);
  await page.waitForFunction(() => document.querySelector('[data-kintsugi-id="demo:golden-paper"]')?.getAttribute("data-phase")==="rest");
  assert.ok(await card.locator("path").count()>=6);
  const seed = await page.evaluate(() => JSON.parse(localStorage.getItem("kintsugi:demo:golden-paper")!).at(-1).seed);
  await page.reload({waitUntil:"domcontentloaded"});
  await page.waitForFunction(() => document.querySelector('[data-kintsugi-id="demo:golden-paper"] path'));
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem("kintsugi:demo:golden-paper")!).at(-1).seed),seed);
  assert.ok(await page.locator(".kintsugi-gallery article").count()>0);
  const fresh = await browser.newContext();
  const freshPage = await fresh.newPage(); await freshPage.goto(`${base}/kintsugi`,{waitUntil:"domcontentloaded",timeout:120_000});
  await freshPage.waitForFunction(() => document.querySelector('[data-kintsugi-id="demo:golden-paper"] path'));
  assert.equal(errors.length,0,errors.join("\n"));
  await fresh.close(); await context.close();
});

test("Work trace scrubs by drag and keyboard, selects failure, exports a standalone SVG", async () => {
  const context = await browser.newContext({ viewport:{width:1366,height:900}, acceptDownloads:true, reducedMotion:"reduce" });
  const page = await context.newPage();
  page.setDefaultNavigationTimeout(120_000);
  const response = await page.request.get(`${base}/api/seismograph`);
  assert.equal(response.status(),200);
  const activity = await response.json();
  assert.ok(Array.isArray(activity.events) && activity.events.length>0);
  assert.ok(typeof activity.source==="string" && activity.source.length>0);
  await page.route("**/api/seismograph",route => route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({events:traceArchive.events,source:"Regression archive"})}));
  await page.goto(`${base}/work`,{waitUntil:"domcontentloaded"});
  await page.getByRole("heading",{name:"Ink Seismograph",exact:true}).waitFor();
  const chart = page.locator(".seismograph");
  await chart.scrollIntoViewIfNeeded();
  await page.waitForFunction(() => document.querySelector(".seismograph")?.getAttribute("data-playing")==="false");
  const latest = await chart.getAttribute("data-end");
  const slider = page.getByRole("slider",{name:"Scrub ink history"});
  await slider.focus(); await slider.press("End");
  const endPosition = await slider.inputValue();
  await page.waitForFunction(value => document.querySelector(".seismograph")?.getAttribute("data-end")===value,endPosition);
  const before = await chart.getAttribute("data-end");
  await slider.focus(); await slider.press("ArrowLeft");
  await page.waitForFunction(value => document.querySelector(".seismograph")?.getAttribute("data-end")!==value,before);
  assert.notEqual(await chart.getAttribute("data-end"),before);
  const svg = page.locator(".seismo-chart");
  await svg.evaluate(el => el.scrollIntoView({block:"center",behavior:"instant"}));
  const b = await svg.boundingBox(); assert.ok(b);
  const prior = await chart.getAttribute("data-end");
  await page.mouse.move(b.x+b.width*.5,b.y+30); await page.mouse.down(); await page.mouse.move(b.x+b.width*.65,b.y+30,{steps:5}); await page.mouse.up();
  await page.waitForFunction(value => document.querySelector(".seismograph")?.getAttribute("data-end")!==value,prior);
  assert.notEqual(await chart.getAttribute("data-end"),prior);
  await page.getByRole("button",{name:"Latest",exact:true}).click();
  await page.waitForFunction(value => document.querySelector(".seismograph")?.getAttribute("data-end")===value,latest);
  const failure = page.locator('[data-spike] [class="seismo-blot"]').first();
  await failure.locator("..").focus(); await page.keyboard.press("Enter");
  await page.waitForFunction(() => document.querySelector(".seismo-detail")?.textContent?.includes("Red ink"));
  assert.ok((await page.locator(".seismo-detail").innerText()).includes("Red ink"));
  const download = page.waitForEvent("download"); await page.getByRole("button",{name:"Tear off SVG"}).click();
  const file = await download; const path = await file.path(); assert.ok(path);
  const exported = readFileSync(path,"utf8"); assert.ok(exported.length>5000); assert.ok(exported.includes("<svg xmlns=")); assert.ok(!exported.includes("NaN"));
  await page.emulateMedia({media:"print"}); assert.equal(await page.locator(".seismo-controls").isVisible(),false);
  await context.close();
});

test("live refresh keeps the trace cursor inside the slider domain before keyboard scrubbing", async () => {
  const context = await browser.newContext({ viewport:{width:1366,height:900}, reducedMotion:"reduce" });
  try {
    const page = await context.newPage();
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const events = traceArchive.events.slice(0,2).map((event: object,index: number) => ({ ...event,id:`refresh-${index}`,
      at:new Date(Date.parse(traceArchive.generated)+(14+index)*24*3600_000).toISOString() }));
    await page.route("**/api/seismograph", async route => {
      await gate;
      await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({events,source:"Shifted regression archive"})});
    });
    await page.goto(`${base}/work`,{waitUntil:"domcontentloaded",timeout:120_000});
    await page.locator('.seismograph[data-playing="false"]').waitFor();
    const received = page.waitForResponse(response => new URL(response.url()).pathname==="/api/seismograph");
    release(); await received;
    await page.getByText(/Shifted regression archive/).waitFor();
    const chart = page.locator(".seismograph"), slider = page.getByRole("slider",{name:"Scrub ink history"});
    const cursor = Number(await chart.getAttribute("data-end"));
    assert.equal(cursor,Number(await slider.inputValue()),"rendered trace and browser range must use the same cursor after refresh");
    assert.ok(cursor>=Number(await slider.getAttribute("min")) && cursor<=Number(await slider.getAttribute("max")));
    await slider.focus(); await slider.press("ArrowRight");
    await page.waitForFunction(before => Number(document.querySelector(".seismograph")?.getAttribute("data-end"))>before,cursor);
  } finally { await context.close(); }
});

test("mobile reduced motion disables shake and preserves the static no-JS trace", async () => {
  const context = await browser.newContext({ viewport:{width:390,height:844}, reducedMotion:"reduce", hasTouch:true, isMobile:true });
  const page = await context.newPage();
  page.setDefaultNavigationTimeout(120_000); await page.goto(`${base}/kintsugi`,{waitUntil:"domcontentloaded"});
  await page.waitForFunction(() => document.querySelector('[data-paper-id="demo:golden-paper"]')?.getAttribute("data-paper-hydrated")==="true");
  await page.getByRole("button",{name:"Enable shake to mend"}).click();
  await page.getByRole("button",{name:"Shake is off with reduced motion"}).waitFor();
  await page.route("**/api/kintsugi",route => route.fulfill({status:503,contentType:"application/json",body:'{"cards":[],"available":false}'}));
  await page.getByRole("button",{name:"Mend this card in gold"}).first().click();
  await page.waitForFunction(() => document.querySelector('[data-kintsugi-id="demo:golden-paper"] path'));
  assert.equal(await page.locator(".kintsugi-shards").count(),0);
  await page.getByRole("status").filter({hasText:"Shared seams are temporarily unavailable"}).waitFor();
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth<=innerWidth));
  const nojs = await browser.newContext({javaScriptEnabled:false,viewport:{width:390,height:844}});
  const staticPage = await nojs.newPage(); await staticPage.goto(`${base}/work`,{waitUntil:"domcontentloaded",timeout:120_000});
  await staticPage.waitForLoadState("load");
  await staticPage.evaluate(async () => { await document.fonts.ready; });
  assert.ok((await staticPage.locator(".seismo-trace").getAttribute("d"))!.length>4000);
  assert.ok(await staticPage.locator(".seismo-events a").count()>10);
  assert.ok(await staticPage.evaluate(() => document.documentElement.scrollWidth<=innerWidth));
  await nojs.close(); await context.close();
});

test("motion permission gates shaking and a granted shake mends the visible card", async () => {
  const context = await browser.newContext({viewport:{width:1000,height:900}});
  await context.addInitScript(() => {
    Object.defineProperty(DeviceMotionEvent,"requestPermission",{configurable:true,value:async () => "granted"});
  });
  const page = await context.newPage();
  await page.route("**/api/kintsugi",route => route.fulfill({status:503,contentType:"application/json",body:'{"cards":[],"available":false}'}));
  await page.goto(`${base}/kintsugi`,{waitUntil:"domcontentloaded",timeout:120_000});
  await page.waitForFunction(() => document.querySelector('[data-paper-id="demo:golden-paper"]')?.getAttribute("data-paper-hydrated")==="true");
  const shake = () => page.evaluate(() => { const event = new Event("devicemotion"); Object.defineProperty(event,"acceleration",{value:{x:30,y:30,z:0}}); window.dispatchEvent(event); });
  await shake();
  assert.equal(await page.locator(".kintsugi-new").count(),0,"motion is ignored before permission");
  await page.getByRole("button",{name:"Enable shake to mend"}).click();
  await page.getByRole("button",{name:"Shake enabled"}).waitFor();
  await shake();
  await page.getByRole("status").filter({hasText:"Shared seams are temporarily unavailable"}).waitFor();
  assert.ok(await page.locator(".kintsugi-seams path").count()>=6);
  await context.close();
});
