// Ryugu-jo in a real browser, against a running production server: the three ways down (typing "urashima" at the
// top of Home, the Pocket console's Dive chip, the waterline under the footer), the palace's own stylesheet and
// nothing of the site's, a live sea with WebGL whose fish flee the pointer, and the still sea it falls back to with
// no WebGL, under reduced motion and while the page is hidden. Negative controls: a lone A on Home does open a
// page (so the word's taken a's are what keep it), and the live sea does swim (so a frozen fish means a fallback).
// Drives Chrome through playwright-core: CHROME_PATH if set, else the installed Google Chrome, else Playwright's
// own Chromium.
//   BASE_URL  the server (default http://localhost:4000)
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { after, before, test } from "node:test";
import { chromium, type Browser, type BrowserContext, type BrowserContextOptions, type Page } from "playwright-core";

const BASE = process.env.BASE_URL ?? "http://localhost:4000";

let browser: Browser;
const contexts: BrowserContext[] = [];

// Chrome puts its singleton socket under TMPDIR and aborts when that path passes the 108-byte socket limit
// (a deep per-job TMPDIR does): such a TMPDIR is swapped for a short one under /tmp, removed afterwards.
let shortTmp = "";
function browserEnv(): Record<string, string | undefined> {
  if (tmpdir().length <= 60) return process.env;
  shortTmp ||= mkdtempSync("/tmp/ry-e2e-");
  return { ...process.env, TMPDIR: shortTmp };
}

// Headless Chrome draws WebGL in software only when allowed to.
const ARGS = ["--enable-unsafe-swiftshader", "--use-angle=swiftshader"];

async function launch(): Promise<Browser> {
  const env = browserEnv();
  if (process.env.CHROME_PATH) return chromium.launch({ executablePath: process.env.CHROME_PATH, env, args: ARGS });
  try {
    return await chromium.launch({ channel: "chrome", env, args: ARGS });
  } catch (chrome) {
    try {
      return await chromium.launch({ env, args: ARGS });
    } catch {
      throw new Error(`e2e/ryugu.test.ts needs a browser: install Google Chrome or set CHROME_PATH (${String(chrome).split("\n")[0]})`);
    }
  }
}

before(async () => {
  browser = await launch();
});

after(async () => {
  for (const c of contexts) await c.close().catch(() => {});
  await browser?.close();
  if (shortTmp) rmSync(shortTmp, { recursive: true, force: true });
});

type Probe = { raf: number; webgl: number; hide: boolean };

// A page that counts requestAnimationFrame calls and WebGL context requests, can be told it is hidden, and can be
// made to have no WebGL at all.
async function open(path: string, options: BrowserContextOptions & { noWebgl?: boolean } = {}) {
  const { noWebgl = false, ...context } = options;
  // One page at a time: a live sea left open in an earlier test would share the software GPU with this one.
  for (const c of contexts.splice(0)) await c.close().catch(() => {});
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 }, ...context });
  contexts.push(ctx);
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript((noWebgl: boolean) => {
    const w = window as unknown as { __probe: Probe };
    w.__probe = { raf: 0, webgl: 0, hide: false };
    const raf = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (cb) => {
      w.__probe.raf++;
      return raf(cb);
    };
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, kind: string, ...rest: unknown[]) {
      if (/webgl/.test(kind)) {
        w.__probe.webgl++;
        if (noWebgl) return null;
      }
      return (getContext as (...a: unknown[]) => unknown).call(this, kind, ...rest);
    } as typeof getContext;
    const hidden = Object.getOwnPropertyDescriptor(Document.prototype, "hidden")!;
    Object.defineProperty(Document.prototype, "hidden", {
      configurable: true,
      get() {
        return w.__probe.hide || hidden.get!.call(this);
      },
    });
  }, noWebgl);
  const res = await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
  assert.equal(res?.status(), 200, path);
  return { page, errors };
}

const probe = (page: Page) => page.evaluate(() => ({ ...(window as unknown as { __probe: Probe }).__probe }));
const fish = (page: Page) => page.$$eval("[data-fish]", (gs) => gs.map((g) => g.getAttribute("transform")));
const water = (page: Page) => page.getAttribute(".sea", "data-water");
// Waits until more than n frames have been asked for. Software WebGL's frame rate swings with the host's load,
// so a live loop is judged by frames arriving within a bound, not by how many fit a fixed window.
const framesPast = (page: Page, n: number) =>
  page.waitForFunction((n) => (window as unknown as { __probe: Probe }).__probe.raf > n, n, { timeout: 5000 });
// Waits until a fish has left where it was: only the sea's own loop moves them.
const swamFrom = (page: Page, still: (string | null)[]) =>
  page.waitForFunction(
    (still) => [...document.querySelectorAll("[data-fish]")].some((g, i) => g.getAttribute("transform") !== still[i]),
    still,
    { timeout: 5000 },
  );
const settle = (page: Page) => page.waitForFunction(() => document.querySelector(".sea")?.getAttribute("data-water") !== "served");
const atPalace = (page: Page) => page.waitForURL(`${BASE}/ryugu`, { timeout: 10_000 });
// Home's console is hydrated once its chips answer: B Play swaps the readout.
async function home(page: Page) {
  await page.waitForSelector("section[aria-label='Pocket console'] [data-pocket-ryugu]");
  await page.waitForFunction(() => !!document.querySelector("section[aria-label='Pocket console'] .chip"));
  await page.waitForTimeout(300);
}

test("typing urashima at the top of Home goes down to the palace; a lone A opens the console's page instead", async () => {
  // negative control: A on its own is the console's, and opens the chosen page
  const control = await open("/");
  await home(control.page);
  await control.page.keyboard.press("a");
  await control.page.waitForURL((url) => url.pathname !== "/", { timeout: 5000 });
  assert.notEqual(new URL(control.page.url()).pathname, "/ryugu");

  const { page, errors } = await open("/");
  await home(page);
  // "ura": the word's first a is taken, so the console opens nothing
  await page.keyboard.type("ura", { delay: 30 });
  await page.waitForTimeout(600);
  assert.equal(new URL(page.url()).pathname, "/", "the word's a opened a console page");
  await page.keyboard.type("shima", { delay: 30 });
  await atPalace(page);
  assert.equal(await page.textContent("h1"), "Ryugu-jo");
  assert.deepEqual(errors, []);
});

test("typing urashima into a field types it, and goes nowhere", async () => {
  const { page } = await open("/sign-in");
  const field = page.locator("input").first();
  await field.click();
  await page.keyboard.type("urashima", { delay: 20 });
  await page.waitForTimeout(500);
  assert.equal(new URL(page.url()).pathname, "/sign-in");
  assert.equal(await field.inputValue(), "urashima");
});

test("Pocket: the console's Dive chip goes down to the palace", async () => {
  const { page, errors } = await open("/");
  await home(page);
  const chip = page.locator("section[aria-label='Pocket console'] a[data-pocket-ryugu]");
  assert.equal(await chip.getAttribute("href"), "/ryugu");
  assert.equal((await chip.textContent())?.trim(), "▽ Dive");
  await chip.click();
  await atPalace(page);
  assert.deepEqual(errors, []);
});

test("the waterline: the last thing below the footer links down to the palace, by touch as well", async () => {
  const { page, errors } = await open("/notes", { hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });
  await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
  const link = page.locator("footer.end [data-end-waterline] a[data-end-ryugu]");
  await link.waitFor({ state: "visible" });
  // nothing of the footer sits below the waterline
  const last = await page.evaluate(() => document.querySelector("footer.end")?.lastElementChild?.hasAttribute("data-end-waterline"));
  assert.equal(last, true);
  assert.match((await link.textContent()) ?? "", /Below the waterline/);
  await link.tap();
  await atPalace(page);
  assert.deepEqual(errors, []);
});

test("the palace loads its own stylesheet only: no Tailwind, no cartridge or machine styling", async () => {
  const { page } = await open("/ryugu");
  const sheets = await page.$$eval("link[rel=stylesheet]", (ls) => ls.map((l) => (l as HTMLLinkElement).href));
  assert.equal(sheets.length, 1, sheets.join(", "));
  const css = await (await page.request.get(sheets[0])).text();
  assert.match(css, /\.fish-body/);
  assert.doesNotMatch(css, /--tw-|\.machine\b|\.cartridge\b|\.chip\b/);
  assert.equal(await page.locator(".machine, .chip, footer.end").count(), 0);
  assert.equal(await page.getAttribute("meta[name=robots]", "content"), "noindex, nofollow");
});

test("with WebGL and motion welcome, the sea is live: the water draws, the fish swim and flee the pointer", async () => {
  const { page, errors } = await open("/ryugu");
  await settle(page);
  assert.equal(await water(page), "live");
  const served = await fish(page);
  const before = (await probe(page)).raf;
  await framesPast(page, before + 15).catch(() => {});
  const ran = (await probe(page)).raf - before;
  assert.ok(ran > 15, `the loop runs: ${ran} frames`);
  assert.notDeepEqual(await fish(page), served, "negative control: a live fish moves");

  // the pointer just beside the first fish: it flees, getting further away than it was
  const box = await page.locator("[data-fish]").first().boundingBox();
  assert.ok(box);
  const at = { x: box.x + box.width / 2 - 30, y: box.y + box.height / 2 };
  const centre = async () => {
    const b = (await page.locator("[data-fish]").first().boundingBox())!;
    return Math.hypot(b.x + b.width / 2 - at.x, b.y + b.height / 2 - at.y);
  };
  const start = await centre();
  for (let i = 0; i < 12; i++) {
    await page.mouse.move(at.x, at.y + (i % 2));
    await page.waitForTimeout(40);
  }
  assert.ok((await centre()) > start + 25, `the fish did not flee: ${start} -> ${await centre()}`);
  assert.deepEqual(errors, []);
});

test("while the page is hidden the loop stops, and it comes back when the page is seen again", async () => {
  const { page } = await open("/ryugu");
  await settle(page);
  await page.waitForTimeout(200);
  await page.evaluate(() => {
    (window as unknown as { __probe: Probe }).__probe.hide = true;
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.waitForTimeout(100);
  const paused = await probe(page);
  const still = await fish(page);
  await page.waitForTimeout(600);
  assert.ok((await probe(page)).raf - paused.raf <= 1, "frames ran while hidden");
  assert.deepEqual(await fish(page), still, "the fish swam while hidden");
  await page.evaluate(() => {
    (window as unknown as { __probe: Probe }).__probe.hide = false;
    document.dispatchEvent(new Event("visibilitychange"));
  });
  // the probe counts every caller's frames, so the sea's own loop is the fish swimming again
  await swamFrom(page, still).catch(() => {});
  await framesPast(page, paused.raf + 5).catch(() => {});
  assert.notDeepEqual(await fish(page), still, "the fish did not swim again");
  assert.ok((await probe(page)).raf - paused.raf > 5, "the loop did not come back");
});

test("without WebGL the sea is static: the served caustic and fish, and no frame runs", async () => {
  const { page, errors } = await open("/ryugu", { noWebgl: true });
  await settle(page);
  assert.equal(await water(page), "static");
  assert.equal((await probe(page)).webgl, 1, "WebGL was asked for once");
  const served = await fish(page);
  const before = (await probe(page)).raf;
  await page.waitForTimeout(700);
  assert.deepEqual(await fish(page), served);
  assert.ok((await probe(page)).raf - before <= 2, `${(await probe(page)).raf - before} frames`);
  assert.equal(await page.locator(".sea-still .caustic").count(), 1);
  assert.equal(await page.locator(".sea-water").evaluate((c) => getComputedStyle(c).opacity), "0");
  // a pointer frightens nobody on a static sea
  await page.mouse.move(640, 300);
  await page.waitForTimeout(200);
  assert.deepEqual(await fish(page), served);
  assert.deepEqual(errors, []);
});

test("under reduced motion the sea is still, asks for no WebGL at all, and the way down does not animate", async () => {
  const { page, errors } = await open("/ryugu", { reducedMotion: "reduce" });
  await settle(page);
  assert.equal(await water(page), "still");
  const { webgl } = await probe(page);
  assert.equal(webgl, 0, "a WebGL context was asked for under reduced motion");
  const served = await fish(page);
  await page.waitForTimeout(600);
  assert.deepEqual(await fish(page), served);
  assert.equal(await page.locator(".surface").evaluate((s) => getComputedStyle(s).animationName), "none");
  // motion welcome again: the sea comes alive without a reload
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.waitForFunction(() => document.querySelector(".sea")?.getAttribute("data-water") === "live");
  assert.deepEqual(errors, []);
});
