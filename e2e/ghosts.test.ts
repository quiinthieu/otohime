// Real production Next + Chrome/2D pixels, bounded local fake transport. No hosted acceptance.
import assert from "node:assert/strict";
import { after, afterEach, before, test } from "node:test";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright-core";
import { collectBrowserErrors, type BrowserErrors } from "./console-errors.ts";

const base = process.env.BASE_URL!;
const fake = process.env.GHOSTS_FAKE_BASE!;
let browser: Browser;
let contexts: BrowserContext[] = [];
let errors: string[] = [];
let collectors: BrowserErrors[] = [];
type Probe = { sockets: number; paints: number; lines: number; arcs: number; clears: number; ids: string[]; hidden: boolean; online: boolean; moves: number[] };
declare global { interface Window { __inkProof: Probe } }
const state = (page: Page, value: string) => page.waitForSelector(`[data-ghosts-state="${value}"]`);
const count = (page: Page, n: number) => page.waitForSelector(`[data-ghosts="${n}"]`);
const probe = (page: Page) => page.evaluate(() => ({ ...window.__inkProof }));
const turns = (page: Page) => page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));

async function control(path: string, method = "GET") {
  const response = await fetch(fake + path, { method });
  assert.equal(response.status, 200, path);
  return response.json();
}
before(async () => {
  assert.ok(base && fake && process.env.GHOSTS_ENDPOINT, "run through scripts/e2e.mjs with an explicitly configured local fake");
  assert.ok(["127.0.0.1", "localhost"].includes(new URL(fake).hostname), "control endpoints must be local");
  assert.equal((await (await fetch(base + "/api/ghosts")).json()).endpoint, process.env.GHOSTS_ENDPOINT);
  await control("/__ready");
  await control("/__reset", "POST"); // Earlier full-suite files used the same long-lived fake.
  browser = await chromium.launch({ channel: "chrome", env: { ...process.env, TMPDIR: "/tmp" } });
  console.log(`Ghost proof: Chrome ${browser.version()}, real Next/canvas, fake fan-out; hosted execution unproven`);
});
afterEach(async () => {
  for (const ctx of contexts) await ctx.close();
  contexts = [];
  await control("/__reset", "POST");
  const unexpected = [...errors, ...collectors.flatMap(c => c.unexpected)];
  errors = []; collectors = [];
  assert.deepEqual(unexpected, [], "no uncaught page errors or application console spam");
});
after(async () => { await browser?.close(); });

async function context({ reduced = false, suppressPaint = false, refusal = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1100, height: 820 }, reducedMotion: reduced ? "reduce" : "no-preference" });
  contexts.push(ctx);
  await ctx.addInitScript(({ suppressPaint }) => {
    const p: Probe = window.__inkProof = { sockets: 0, paints: 0, lines: 0, arcs: 0, clears: 0, ids: [], hidden: false, online: true, moves: [] };
    // Visibility/offline events are injected; sockets and rendering stay real.
    Object.defineProperty(document, "hidden", { get: () => p.hidden });
    Object.defineProperty(navigator, "onLine", { get: () => p.online });
    const Native = WebSocket;
    window.WebSocket = class extends Native {
      constructor(url: string | URL, protocols?: string | string[]) {
        super(url, protocols); p.sockets++;
        this.addEventListener("message", event => { const m = JSON.parse(event.data); if (m.t === "hi") p.ids.push(m.id); });
      }
      send(data: string | ArrayBufferLike | Blob | ArrayBufferView) {
        if (typeof data === "string" && JSON.parse(data).t === "m") p.moves.push(performance.now());
        super.send(data);
      }
    };
    for (const method of ["fill", "stroke", "lineTo", "arc", "clearRect"] as const) {
      const original = CanvasRenderingContext2D.prototype[method];
      Object.defineProperty(CanvasRenderingContext2D.prototype, method, { value: function(this: CanvasRenderingContext2D, ...args: unknown[]) {
        const ghost = !!this.canvas.closest("[data-ghosts-state]");
        if (ghost && suppressPaint && (method === "fill" || method === "stroke")) return;
        const result = Reflect.apply(original, this, args);
        if (ghost) {
          if (method === "fill" || method === "stroke") p.paints++;
          if (method === "lineTo") p.lines++;
          if (method === "arc") p.arcs++;
          if (method === "clearRect") p.clears++;
        }
        return result;
      } });
    }
  }, { suppressPaint });
  ctx.on("page", page => {
    const collector = collectBrowserErrors(base); collectors.push(collector);
    page.on("pageerror", error => collector.pageError(error.message));
    page.on("response", response => collector.response({ url: response.url(), status: response.status(),
      method: response.request().method(), resourceType: response.request().resourceType() }));
    page.on("console", msg => {
      if (!["error", "warning"].includes(msg.type())) {
        if (msg.args().length) errors.push(`${msg.type()}: ${msg.text()}`);
        return;
      }
      // Chrome's native upgrade failure is expected only in explicit refusal/flap cases.
      if (refusal && msg.args().length === 0 && /^WebSocket connection to 'ws:\/\/127\.0\.0\.1:\d+\/ghosts\?room=.*failed:/.test(msg.text())) return;
      // Browser-native performance/preload warnings have no JS arguments; application warnings do.
      if (msg.type() === "warning") { if (msg.args().length) errors.push(`warning: ${msg.text()}`); return; }
      const where = msg.location();
      collector.console({ text: msg.text(), url: where.url, line: where.lineNumber, column: where.columnNumber, args: msg.args().length });
    });
  });
  return ctx;
}
async function visit(ctx: BrowserContext, path = "/") {
  const page = await ctx.newPage();
  assert.equal((await page.goto(base + path))?.status(), 200);
  await page.waitForSelector("[data-ghosts-state]");
  return page;
}
// Independent of counters and method wrappers: sample alpha in the actual canvas backing store.
async function pixels(page: Page, box?: { x: number; y: number; w: number; h: number }) {
  return page.evaluate(box => {
    const c = document.querySelector<HTMLCanvasElement>("[data-ghosts-state] canvas");
    if (!c) return 0;
    const ratio = c.width / innerWidth;
    const rgba = c.getContext("2d")!.getImageData(box ? Math.round(box.x * ratio) : 0, box ? Math.round(box.y * ratio) : 0,
      box ? Math.round(box.w * ratio) : c.width, box ? Math.round(box.h * ratio) : c.height).data;
    let n = 0; for (let i = 3; i < rgba.length; i += 4) if (rgba[i]) n++;
    return n;
  }, box);
}
const assertInk = (n: number) => assert.ok(n > 0, "visible canvas ink pixels required");
async function ink(page: Page) {
  await page.waitForFunction(() => {
    const c = document.querySelector<HTMLCanvasElement>("[data-ghosts-state] canvas");
    return c && c.getContext("2d")!.getImageData(0, 0, c.width, c.height).data.some((v, i) => i % 4 === 3 && v > 0);
  });
  assertInk(await pixels(page));
}
async function clear(page: Page) {
  await page.waitForFunction(() => {
    const c = document.querySelector<HTMLCanvasElement>("[data-ghosts-state] canvas");
    return !c || !c.getContext("2d")!.getImageData(0, 0, c.width, c.height).data.some((v, i) => i % 4 === 3 && v > 0);
  });
}
async function click(page: Page) { await page.mouse.click(730, 330); await ink(page); }
async function noWork(page: Page) {
  const before = await probe(page);
  await page.mouse.move(770, 370); await page.mouse.click(770, 370); await turns(page);
  const after = await probe(page);
  assert.equal(after.sockets, before.sockets); assert.equal(after.paints, before.paints);
  assert.equal(await pixels(page), 0);
}

test("two independent browsers on Home then Ryugu exchange anonymous cursors, trails and ripples at <=10Hz", { timeout: 60000 }, async () => {
  const a = await context(), b = await context();
  await a.addCookies([{ name: "better-auth.session_token", value: "synthetic-fixture-only", url: base, httpOnly: true, sameSite: "Lax" }]);
  let appCookiePresent = false;
  a.on("request", req => { if (req.url() === base + "/") void req.allHeaders().then(h => { appCookiePresent ||= !!h.cookie; }); });
  for (const room of ["/", "/ryugu"]) {
    const first = await visit(a, room), second = await visit(b, room);
    await state(first, "on"); await state(second, "on"); await count(first, 1); await count(second, 1);
    const ids = [(await probe(first)).ids[0], (await probe(second)).ids[0]];
    assert.match(ids[0], /^[0-9a-f-]{36}$/); assert.notEqual(ids[0], ids[1]);
    assert.equal(await pixels(second), 0, "membership alone paints nothing");
    await first.mouse.move(300, 270); await ink(second);
    // Drive a high-frequency pointer path now. The real client must throttle it.
    await first.evaluate(() => new Promise<void>(resolve => {
      const start = performance.now();
      function step() {
        const age = performance.now() - start;
        window.dispatchEvent(new PointerEvent("pointermove", { clientX: 300 + Math.min(age / 3, 400), clientY: 270 }));
        if (age < 1250) requestAnimationFrame(step); else resolve();
      }
      requestAnimationFrame(step);
    }));
    assert.ok((await probe(second)).lines > 0, "peer drew actual trail segments");
    const trail = await pixels(second, { x: 600, y: 265, w: 40, h: 12 });
    // That part of the path is now old: current tip is elsewhere and only the fading trail could paint here.
    await second.waitForFunction(() => {
      const c = document.querySelector<HTMLCanvasElement>("[data-ghosts-state] canvas")!; const r = c.width / innerWidth;
      return !c.getContext("2d")!.getImageData(600*r, 265*r, 40*r, 12*r).data.some((v, i) => i % 4 === 3 && v > 0);
    });
    assertInk(trail); // Tip is elsewhere: these pixels can only come from a trail.
    const times = (await probe(first)).moves;
    // The policy samples before serialization; the independent wrapper samples later at native send.
    // Processing jitter can shorten an adjacent interval, so measure the complete driven path's rate.
    assert.ok(times.length >= 5);
    const elapsed = times.at(-1)! - times[0];
    assert.ok((times.length - 1) * 100 <= elapsed + 20, `${room}: ${times.length} sends over ${elapsed}ms obey <=10Hz`);
    const before = (await probe(second)).arcs;
    await click(first); await second.waitForFunction(n => window.__inkProof.arcs > n, before); await ink(second);
    assert.ok(Number(await second.locator("[data-ghosts-ripples]").getAttribute("data-ghosts-ripples")) > 0);
    // Sample away from the retained brush tip: this ring must paint and then disappear.
    for (const visible of [true, false]) await second.waitForFunction(visible => {
      const c = document.querySelector<HTMLCanvasElement>("[data-ghosts-state] canvas")!; const r = c.width / innerWidth;
      const hasInk = c.getContext("2d")!.getImageData(738*r, 318*r, 22*r, 24*r).data.some((v, i) => i % 4 === 3 && v > 0);
      return hasInk === visible;
    }, visible, { timeout: 3000 });
    const entries = (await control("/__log")).entries;
    const moves = entries.filter((e: Record<string, unknown>) => e.kind === "frame" && e.room === room && e.t === "m");
    assert.ok(moves.length >= 5);
    for (const entry of moves) {
      assert.ok(Number.isFinite(entry.x) && entry.x >= 0 && entry.x <= 1 && Number.isFinite(entry.y) && entry.y >= 0 && entry.y <= 1);
    }
    // Network arrivals can bunch, so use each connection's elapsed interval with a two-frame jitter allowance.
    for (const conn of new Set(moves.map((e: { conn: number }) => e.conn))) {
      const own = moves.filter((e: { conn: number }) => e.conn === conn);
      assert.ok(own.length <= Math.floor((own.at(-1).at - own[0].at) / 100) + 2, "<=10Hz from bounded fake log");
    }
    for (const entry of entries.filter((e: { kind: string }) => e.kind === "join")) assert.equal(entry.headers.cookie, false, "app cookie absent at dedicated fake host");
    await second.close(); await count(first, 0); await first.close();
  }
  assert.equal(appCookiePresent, true, "synthetic application cookie was actually attached on app host");
  // Closing the page triggers the leave; await its asynchronous server-side close callback.
  let log = await control("/__log");
  for (let i = 0; i < 50 && log.entries.filter((e: { kind: string }) => e.kind === "leave").length < 4; i++) {
    await new Promise(resolve => setTimeout(resolve, 10)); log = await control("/__log");
  }
  assert.equal(log.dropped, 0, "bounded complete case log");
  assert.equal(log.entries.filter((e: { kind: string }) => e.kind === "join").length, 4);
  assert.equal(log.entries.filter((e: { kind: string }) => e.kind === "leave").length, 4);
});

test("room separation, peer departure clearing and lone local ripple decay have actual pixel evidence", { timeout: 30000 }, async () => {
  const home = await visit(await context()), palace = await visit(await context(), "/ryugu"), peer = await visit(await context(), "/ryugu");
  await Promise.all([state(home, "on"), state(palace, "on"), state(peer, "on")]);
  await count(home, 0); await count(palace, 1);
  await click(home); await turns(palace); assert.equal(await pixels(palace), 0);
  await home.clock.install(); await home.clock.runFor(800); await clear(home); // lone ripple expires, without a peer
  await palace.mouse.move(420, 300); await ink(peer); await turns(home); assert.equal(await pixels(home), 0);
  await palace.close(); await count(peer, 0); await clear(peer);
});

test("initial/change reduced motion, hide/reload and same-context storage propagation stop upgrades and painting", { timeout: 40000 }, async () => {
  const reduced = await context({ reduced: true }), page = await visit(reduced, "/ryugu");
  await state(page, "off"); await noWork(page); assert.equal((await probe(page)).sockets, 0);
  await page.emulateMedia({ reducedMotion: "no-preference" }); await state(page, "on"); await click(page);
  await page.emulateMedia({ reducedMotion: "reduce" }); await state(page, "off"); await noWork(page);
  const ctx = await context(), home = await visit(ctx), palace = await visit(ctx, "/ryugu");
  await state(home, "on"); await state(palace, "on"); await click(palace);
  await home.locator("[data-pocket-ghosts]").click(); await state(home, "off"); await state(palace, "off"); await noWork(palace);
  await home.reload(); await home.locator("[data-pocket-ghosts]").waitFor();
  assert.equal(await home.locator("[data-pocket-ghosts]").getAttribute("aria-pressed"), "false");
  await home.evaluate(() => new Promise<void>(r => requestIdleCallback(() => r()))); assert.equal((await probe(home)).sockets, 0);
  await home.locator("[data-pocket-ghosts]").click(); await state(home, "on"); await state(palace, "on");
  assert.notEqual((await probe(palace)).ids[0], (await probe(palace)).ids[1]);
});

test("hidden and offline cleanup close membership, clear ink and resume without resetting session budget", { timeout: 35000 }, async () => {
  const ctx = await context(), page = await visit(ctx, "/ryugu"), peer = await visit(await context(), "/ryugu");
  await state(page, "on"); await state(peer, "on");
  for (const kind of ["hidden", "online"] as const) {
    await click(page); await ink(peer);
    await page.evaluate(kind => {
      window.__inkProof[kind] = kind === "hidden";
      (kind === "hidden" ? document : window).dispatchEvent(new Event(kind === "hidden" ? "visibilitychange" : "offline"));
    }, kind);
    await state(page, "off"); await count(peer, 0); await clear(peer); await noWork(page);
    await page.evaluate(kind => {
      window.__inkProof[kind] = kind !== "hidden";
      (kind === "hidden" ? document : window).dispatchEvent(new Event(kind === "hidden" ? "visibilitychange" : "online"));
    }, kind);
    await state(page, "on"); await count(peer, 1);
  }
  assert.equal((await probe(page)).sockets, 3);
});

for (const mode of ["refuse", "full", "flap"]) test(`${mode} terminates with bounded retries and cannot be revived by lifecycle toggles`, { timeout: 25000 }, async () => {
  await control(`/__mode?m=${mode}`, "POST");
  const page = await visit(await context({ refusal: true }), "/ryugu");
  await state(page, "gone");
  assert.equal((await probe(page)).sockets, mode === "full" ? 1 : 3); await noWork(page);
  await page.emulateMedia({ reducedMotion: "reduce" }); await page.emulateMedia({ reducedMotion: "no-preference" }); await turns(page);
  assert.equal((await probe(page)).sockets, mode === "full" ? 1 : 3);
  const log = await control("/__log"); assert.equal(log.dropped, 0);
  const attempts = log.entries.filter((e: { kind: string }) => e.kind === (mode === "refuse" ? "refused" : "join"));
  assert.equal(attempts.length, mode === "full" ? 0 : 3);
});

test("unset config 404/off is quiet and disabled real painting fails the same visual assertion", { timeout: 25000 }, async () => {
  const ctx = await context();
  await ctx.route("**/api/ghosts*", route => route.fulfill(route.request().url().includes("probe=1")
    ? { status: 200, contentType: "application/json", body: "null" } : { status: 404, body: "" }));
  const page = await visit(ctx, "/ryugu"); await state(page, "off"); await noWork(page);
  assert.equal(await page.evaluate(async () => (await fetch("/api/ghosts")).status), 404);
  // The existing error collector pairs only this exact native diagnostic with its observed optional 404 response.
  const negative = await visit(await context({ suppressPaint: true }), "/ryugu"); await state(negative, "on");
  await negative.mouse.click(730, 330); await turns(negative);
  assert.ok(Number(await negative.locator("[data-ghosts-ripples]").getAttribute("data-ghosts-ripples")) > 0, "counter alone still advances");
  const suppressedPixels = await pixels(negative);
  assert.throws(() => assertInk(suppressedPixels), /visible canvas ink/, "negative control rejects disabled real painting even with a positive data counter");
  assert.equal(await pixels(negative), 0); assert.equal((await probe(negative)).paints, 0);
});
