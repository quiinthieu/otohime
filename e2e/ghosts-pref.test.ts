// Focused t-1609 proof: real production components/Chrome/2D canvas, fake fan-out.
// Self-owned local server only; never reads or mutates a deployed environment.
import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";
import { after, before, test } from "node:test";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright-core";
import { startGhostsFake } from "../scripts/ghosts-fake.mjs";

let browser: Browser, server: ChildProcess, fake: Awaited<ReturnType<typeof startGhostsFake>>, base: string;
let serverExit: Promise<unknown>;
const contexts: BrowserContext[] = [];
let output = "";

before(async () => {
  const reservation = createServer().listen(0, "127.0.0.1");
  await once(reservation, "listening");
  const address = reservation.address();
  assert.ok(address && typeof address !== "string");
  base = `http://localhost:${address.port}`;
  await new Promise<void>(resolve => reservation.close(() => resolve()));
  fake = await startGhostsFake({ origins: base });
  server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--port", String(address.port)], {
    env: { ...process.env, GHOSTS_ENDPOINT: fake.url, BETTER_AUTH_URL: base,
      BETTER_AUTH_SECRET: "local-browser-fixture-not-a-real-secret-0123456789" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  serverExit = once(server, "exit");
  await new Promise<void>((resolve, reject) => {
    const deadline = setTimeout(() => reject(Error(`Next startup: ${output}`)), 15000);
    server.once("error", reject);
    server.once("exit", code => { clearTimeout(deadline); reject(Error(`Next exited ${code}: ${output}`)); });
    const read = (chunk: Buffer) => {
      output = (output + String(chunk)).slice(-6000);
      if (output.includes("Ready in")) { clearTimeout(deadline); resolve(); }
    };
    server.stdout!.on("data", read); server.stderr!.on("data", read);
  });
  const response = await fetch(`${base}/api/ghosts`);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).endpoint, fake.url, "real compiled route configured for owned fake");
  browser = await chromium.launch({ channel: "chrome", env: { ...process.env, TMPDIR: "/tmp" } });
  console.log(`real Chrome ${browser.version()}, production Next, local fake WebSocket`);
});

after(async () => {
  for (const context of contexts) await context.close();
  await browser?.close();
  if (server && server.exitCode === null) { server.kill("SIGTERM"); await serverExit; }
  await fake?.close();
});

type Probe = {
  configs: number; sockets: number; closes: number; sent: number; paints: number; clears: number;
  hidden: boolean; online: boolean; suppressPaint: boolean; ids: string[];
};
declare global { interface Window { __ghostPref: Probe } }

async function context(options: { stored?: string; denied?: boolean; reduced?: boolean; suppressPaint?: boolean; initial?: "visibility" | "offline" } = {}) {
  const ctx = await browser.newContext({ hasTouch: true, viewport: { width: 1280, height: 860 },
    reducedMotion: options.reduced ? "reduce" : "no-preference" });
  contexts.push(ctx);
  await ctx.addInitScript(options => {
    if (options.stored !== undefined) localStorage.setItem("ghosts", options.stored);
    if (options.denied) Object.defineProperty(window, "localStorage", { get() { throw Error("storage denied by fixture"); } });
    const p: Probe = { configs: 0, sockets: 0, closes: 0, sent: 0, paints: 0, clears: 0,
      hidden: options.initial === "visibility", online: options.initial !== "offline", suppressPaint: !!options.suppressPaint, ids: [] };
    window.__ghostPref = p;
    Object.defineProperty(document, "hidden", { get: () => p.hidden });
    Object.defineProperty(navigator, "onLine", { get: () => p.online });
    const fetch = window.fetch.bind(window);
    window.fetch = (...args) => { if (String(args[0]).includes("/api/ghosts")) p.configs++; return fetch(...args); };
    const NativeSocket = window.WebSocket;
    window.WebSocket = class extends NativeSocket {
      constructor(url: string | URL, protocols?: string | string[]) {
        super(url, protocols); p.sockets++;
        this.addEventListener("message", event => { const msg = JSON.parse(event.data); if (msg.t === "hi") p.ids.push(msg.id); });
      }
      send(data: string | ArrayBufferLike | Blob | ArrayBufferView) { p.sent++; super.send(data); }
      close(code?: number, reason?: string) { p.closes++; super.close(code, reason); }
    };
    for (const method of ["stroke", "fill", "clearRect"] as const) {
      const original = CanvasRenderingContext2D.prototype[method];
      Object.defineProperty(CanvasRenderingContext2D.prototype, method, { value: function (this: CanvasRenderingContext2D, ...args: unknown[]) {
        const ghost = !!this.canvas.closest("[data-ghosts-state]");
        if (ghost && method !== "clearRect" && p.suppressPaint) return;
        const result = Reflect.apply(original, this, args);
        if (ghost) { if (method === "clearRect") p.clears++; else p.paints++; }
        return result;
      } });
    }
  }, options);
  return ctx;
}
const probe = (page: Page) => page.evaluate(() => ({ ...window.__ghostPref }));
const on = (page: Page) => page.waitForSelector('[data-ghosts-state="on"]');
const off = (page: Page) => page.waitForFunction(() => !document.querySelector('[data-ghosts-state]:not([data-ghosts-state="off"]):not([data-ghosts-state="gone"])'));
const ghost = (page: Page) => page.locator("[data-pocket-ghosts]");
async function visit(ctx: BrowserContext, path = "/") {
  const page = await ctx.newPage();
  page.on("pageerror", error => { throw error; });
  assert.equal((await page.goto(base + path))?.status(), 200);
  if (path === "/") await page.waitForFunction(() => document.querySelector("[data-pocket-ghosts]")?.getAttribute("aria-pressed") === "true");
  return page;
}
async function pixels(page: Page) {
  return page.evaluate(() => {
    const canvas = document.querySelector<HTMLCanvasElement>("[data-ghosts-state] canvas");
    if (!canvas) return 0;
    const rgba = canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height).data;
    let total = 0;
    for (let i = 3; i < rgba.length; i += 4) if (rgba[i]) total++;
    return total;
  });
}
async function draw(page: Page) {
  const before = (await probe(page)).paints;
  await page.evaluate(() => window.dispatchEvent(new PointerEvent("pointerdown", { clientX: 400, clientY: 300 })));
  await page.waitForFunction(n => window.__ghostPref.paints > n, before);
  assertInk(await pixels(page));
}
const assertInk = (count: number) => assert.ok(count > 0, "actual ink pixels, independent of data counters");
async function noWork(page: Page, baseline: Probe) {
  await page.evaluate(() => {
    window.dispatchEvent(new PointerEvent("pointerdown", { clientX: 400, clientY: 300 }));
    window.dispatchEvent(new PointerEvent("pointermove", { clientX: 450, clientY: 350 }));
  });
  // Drive rendering opportunities, without waiting for a soak or natural traffic.
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  const now = await probe(page);
  for (const key of ["sockets", "sent", "paints", "configs"] as const) assert.equal(now[key], baseline[key], key);
  assert.equal(await pixels(page), 0, "suppressed canvas is clear");
}

test("Pocket keyboard/touch opt-out clears ink synchronously and persists through reload and routes", { timeout: 45000 }, async () => {
  const ctx = await context(); const page = await visit(ctx); await on(page); await draw(page);
  const before = await probe(page);
  const immediate = await page.evaluate(() => {
    document.querySelector<HTMLButtonElement>("[data-pocket-ghosts]")!.click();
    return { ...window.__ghostPref, stored: localStorage.getItem("ghosts") };
  });
  assert.equal(immediate.closes, before.closes + 1); assert.ok(immediate.clears > before.clears);
  assert.equal(immediate.stored, "hidden"); await off(page);
  assert.equal(await ghost(page).getAttribute("aria-pressed"), "false");
  await noWork(page, await probe(page));
  for (const selector of ["[data-pocket-ryugu]", "[data-pocket-sea-sound]"]) assert.equal(await page.locator(selector).count(), 1);
  const pocket = page.getByRole("region", { name: "Pocket console" });
  assert.equal(await pocket.locator("[data-print-run-switch]").count(), 1);
  assert.equal(await pocket.locator('[data-bottle-entry="pocket"]').count(), 1);
  assert.equal(await page.getByRole("button", { name: "B Play", exact: true }).count(), 1);
  await page.reload(); await ghost(page).waitFor();
  // SSR also says off: prove hydration completed and drive the idle turn before asserting zero work.
  await page.getByRole("button", { name: "B Play", exact: true }).click();
  await page.getByRole("button", { name: "B Menu", exact: true }).click();
  await page.evaluate(() => new Promise<void>(resolve => requestIdleCallback(() => resolve(), { timeout: 2000 })));
  assert.equal(await ghost(page).getAttribute("aria-pressed"), "false");
  assert.equal((await probe(page)).configs, 0); assert.equal((await probe(page)).sockets, 0);
  await ghost(page).focus(); await ghost(page).press("Enter"); await on(page);
  assert.equal(await ghost(page).getAttribute("aria-pressed"), "true");
  await ghost(page).press("Space"); await off(page);
  await ghost(page).tap(); await on(page);
  assert.equal(await page.getByRole("button", { name: "B Play", exact: true }).count(), 1);
  await page.getByRole("button", { name: "B Play", exact: true }).click();
  assert.equal(await ghost(page).count(), 0, "ghost chip is menu-only");
  await page.getByRole("button", { name: "B Menu", exact: true }).click();
  await ghost(page).tap(); await off(page);
  await page.locator("[data-pocket-ryugu]").click(); await page.waitForURL(base + "/ryugu");
  await page.waitForFunction(() => {
    const sea = document.querySelector(".sea");
    return sea && sea.getAttribute("data-water") !== "served";
  });
  await page.evaluate(() => new Promise<void>(resolve => requestIdleCallback(() => resolve(), { timeout: 2000 })));
  assert.equal((await probe(page)).configs, 0); assert.equal((await probe(page)).sockets, 0);
  assert.equal(await ghost(page).count(), 0, "no Pocket in the palace");
  await ctx.close();
});

test("same-origin tabs propagate Home opt-out into Ryugu and reconnect once with fresh anonymous identity", { timeout: 30000 }, async () => {
  const ctx = await context(); const home = await visit(ctx); const palace = await visit(ctx, "/ryugu");
  await on(home); await on(palace); await draw(palace);
  const first = await probe(palace);
  await ghost(home).click(); await off(home); await off(palace);
  assert.equal((await probe(palace)).closes, 1); await noWork(palace, await probe(palace));
  await ghost(home).click(); await on(home); await on(palace);
  const fresh = await probe(palace);
  assert.equal(fresh.sockets, 2); assert.notEqual(fresh.ids[1], first.ids[0]);
  await ctx.close();
});

test("dynamic preference, reduced motion, visibility and offline controls stop work and preserve the three-attempt session budget", { timeout: 45000 }, async () => {
  for (const kind of ["preference", "motion", "visibility", "offline"] as const) {
    const ctx = await context({ reduced: kind === "motion", initial: kind === "visibility" || kind === "offline" ? kind : undefined });
    const page = await visit(ctx, kind === "preference" ? "/" : "/ryugu");
    const change = async (suppressed: boolean) => {
      if (kind === "preference") await ghost(page).tap();
      else if (kind === "motion") await page.emulateMedia({ reducedMotion: suppressed ? "reduce" : "no-preference" });
      else await page.evaluate(({ kind, suppressed }) => {
        if (kind === "visibility") { window.__ghostPref.hidden = suppressed; document.dispatchEvent(new Event("visibilitychange")); }
        else { window.__ghostPref.online = !suppressed; window.dispatchEvent(new Event(suppressed ? "offline" : "online")); }
      }, { kind, suppressed });
    };
    if (kind !== "preference") {
      // Drive the idle loader to completion; initial suppression precedes any config fetch.
      await page.waitForSelector("[data-ghosts-state]");
      assert.equal((await probe(page)).configs, 0); assert.equal((await probe(page)).sockets, 0);
      await change(false);
    }
    await on(page); await draw(page);
    for (let attempt = 1; attempt <= 3; attempt++) {
      await change(true); await off(page);
      assert.equal((await probe(page)).closes, attempt); await noWork(page, await probe(page));
      await change(false);
      if (attempt < 3) await on(page);
    }
    await page.waitForSelector('[data-ghosts-state="gone"]');
    assert.equal((await probe(page)).sockets, 3); assert.equal((await probe(page)).configs, 3);
    await ctx.close();
  }
});

test("corrupt and denied storage leave the Pocket switch usable; disabled painting fails pixel evidence", { timeout: 30000 }, async () => {
  for (const options of [{ stored: "corrupt" }, { denied: true }]) {
    const ctx = await context(options); const page = await visit(ctx); await on(page);
    await ghost(page).tap(); await off(page); await noWork(page, await probe(page));
    await ghost(page).tap(); await on(page); assert.equal((await probe(page)).sockets, 2);
    await ctx.close();
  }
  const ctx = await context({ suppressPaint: true }); const page = await visit(ctx, "/ryugu"); await on(page);
  await page.evaluate(() => window.dispatchEvent(new PointerEvent("pointerdown", { clientX: 400, clientY: 300 })));
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => resolve())));
  const count = await pixels(page);
  assert.throws(() => assertInk(count), /actual ink pixels/, "negative control: the same pixel assertion rejects disabled painting");
  assert.equal((await probe(page)).paints, 0);
  await ctx.close();
});
