// Acceptance walk (pm-257 run-9385): local production Next + actual Worker/DO in local workerd.
// Usage: node walk-local.mjs <repo> <appBase> <workerBase> <outDir>
import { createRequire } from "node:module";
import { writeFileSync } from "node:fs";
import path from "node:path";
import http from "node:http";

const [repo, APP, WORKER, OUT] = process.argv.slice(2);
const { chromium } = createRequire(path.join(repo, "package.json"))("playwright-core");
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const VIEWPORTS = [
  { name: "desktop", width: 1366, height: 768 },
  { name: "phone", width: 390, height: 844 },
];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const step = (row) => {
  results.push(row);
  console.log(`${row.ok ? "PASS" : "FAIL"} [${row.viewport ?? "-"}] ${row.action} -> ${JSON.stringify(row.observed)}`);
};

// Count WebSocket constructions in every page; never record frame contents.
const INIT = () => {
  window.__accSockets = 0;
  const Native = window.WebSocket;
  window.WebSocket = class extends Native {
    constructor(...a) {
      super(...a);
      window.__accSockets++;
    }
  };
};

async function open(browser, viewport, url, opts = {}) {
  const ctx = await browser.newContext({ viewport, reducedMotion: opts.reduced ? "reduce" : "no-preference", deviceScaleFactor: 1 });
  await ctx.addInitScript(INIT);
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => m.type() === "error" && errors.push(`console: ${m.text()}`));
  await page.goto(url, { waitUntil: "load" });
  return { ctx, page, errors };
}

const layer = (page) =>
  page.evaluate(() => {
    const el = document.querySelector("[data-ghosts-state]");
    return el
      ? { state: el.dataset.ghostsState, others: Number(el.dataset.ghosts), ripples: Number(el.dataset.ghostsRipples), label: el.textContent.trim(), sockets: window.__accSockets }
      : { state: "absent", sockets: window.__accSockets };
  });

const waitLayer = (page, fn, arg, timeout = 15000) =>
  page.waitForFunction(fn, arg, { timeout, polling: 50 }).then(() => true, () => false);

// Alpha pixels inside a CSS-pixel box on the ghost canvas (backing store scaled by canvas/client ratio).
const ink = (page, box) =>
  page.evaluate((b) => {
    const c = document.querySelector("[data-ghosts-state] canvas");
    if (!c || !c.width) return 0;
    const k = c.width / c.clientWidth;
    const x = Math.max(0, Math.round((b.x - b.r) * k)), y = Math.max(0, Math.round((b.y - b.r) * k));
    const w = Math.min(c.width - x, Math.round(2 * b.r * k)), h = Math.min(c.height - y, Math.round(2 * b.r * k));
    if (w <= 0 || h <= 0) return 0;
    const d = c.getContext("2d").getImageData(x, y, w, h).data;
    let n = 0;
    for (let i = 3; i < d.length; i += 4) if (d[i] > 8) n++;
    return n;
  }, box);
const inkAll = (page) => page.evaluate(() => {
  const c = document.querySelector("[data-ghosts-state] canvas");
  if (!c || !c.width) return 0;
  const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
  let n = 0;
  for (let i = 3; i < d.length; i += 4) if (d[i] > 8) n++;
  return n;
});

async function glide(page, from, to, steps = 12) {
  for (let i = 0; i <= steps; i++) {
    await page.mouse.move(from.x + ((to.x - from.x) * i) / steps, from.y + ((to.y - from.y) * i) / steps);
    await sleep(40);
  }
}

function rawUpgrade(origin, room = "/") {
  return new Promise((resolve) => {
    const u = new URL(`/ghosts?room=${encodeURIComponent(room)}`, WORKER);
    const req = http.request({
      host: u.hostname, port: u.port, path: u.pathname + u.search, method: "GET",
      headers: { Connection: "Upgrade", Upgrade: "websocket", "Sec-WebSocket-Version": "13", "Sec-WebSocket-Key": "dGhlIHNhbXBsZSBub25jZQ==", ...(origin ? { Origin: origin } : {}) },
    });
    req.on("upgrade", (res, socket) => { socket.destroy(); resolve(res.statusCode); });
    req.on("response", (res) => { res.resume(); resolve(res.statusCode); });
    req.on("error", (e) => resolve(`error ${e.code}`));
    req.end();
  });
}

async function walk(vp) {
  const V = vp.name;
  const vpSize = { width: vp.width, height: vp.height };
  // Separate Chrome processes for the two visitors, a third for the other room.
  const [bA, bB, bC] = await Promise.all([0, 1, 2].map(() => chromium.launch({ executablePath: CHROME, headless: true })));
  const A = await open(bA, vpSize, `${APP}/`);
  const B = await open(bB, vpSize, `${APP}/`);
  const C = await open(bC, vpSize, `${APP}/ryugu`);
  const both = await Promise.all([A, B].map((v) => waitLayer(v.page, () => { const e = document.querySelector("[data-ghosts-state]"); return e && e.dataset.ghostsState === "on" && e.dataset.ghosts === "1"; })));
  const cOn = await waitLayer(C.page, () => document.querySelector("[data-ghosts-state]")?.dataset.ghostsState === "on");
  const [la, lb, lc] = await Promise.all([A, B, C].map((v) => layer(v.page)));
  step({ viewport: V, start: "Two visitors on Home, one on /ryugu (3 Chrome processes)", action: "Load pages and let the idle loader connect",
    observed: { A: la, B: lb, C: lc }, ok: both.every(Boolean) && cOn && la.label === "1 here" && lb.label === "1 here" && lc.others === 0 && lc.label === "" });

  // Peer cursor and trail.
  const W = vp.width, H = vp.height;
  const p0 = { x: Math.round(W * 0.2), y: Math.round(H * 0.3) }, p1 = { x: Math.round(W * 0.7), y: Math.round(H * 0.45) };
  await glide(A.page, p0, p1);
  await sleep(250);
  const tipB = await ink(B.page, { ...p1, r: 24 });
  const pathB = await ink(B.page, { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2, r: 20 });
  const otherRoom = await inkAll(C.page);
  step({ viewport: V, start: "A and B connected on Home", action: "A moves the mouse across the page",
    observed: { peerTipPixels: tipB, peerTrailPixels: pathB, otherRoomPixels: otherRoom }, ok: tipB > 0 && pathB > 0 && otherRoom === 0 });

  await sleep(1500);
  const tipLater = await ink(B.page, { ...p1, r: 24 });
  const pathLater = await ink(B.page, { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2, r: 20 });
  step({ viewport: V, start: "Peer trail painted on B", action: "A stops; wait 1.5 s",
    observed: { tipPixels: tipLater, trailPixelsBefore: pathB, trailPixelsAfter: pathLater }, ok: tipLater > 0 && pathLater < pathB && pathLater === 0 });

  // Click ripple: local + peer.
  const q = { x: Math.round(W * 0.4), y: Math.round(H * 0.6) };
  const rippleA0 = (await layer(A.page)).ripples, rippleB0 = (await layer(B.page)).ripples;
  // Use an empty spot: dispatch a real mouse click; the overlay is pointer-events:none so it lands on the page.
  const hit = await A.page.evaluate(({ x, y }) => { const e = document.elementFromPoint(x, y); return e ? `${e.tagName.toLowerCase()}${e.closest("[data-ghosts-state]") ? " (overlay!)" : ""}` : null; }, q);
  await A.page.mouse.move(q.x, q.y);
  await A.page.mouse.down(); await A.page.mouse.up();
  await sleep(120);
  const localRing = await ink(A.page, { ...q, r: 40 });
  const peerRing = await ink(B.page, { ...q, r: 40 });
  const rippleA1 = (await layer(A.page)).ripples, rippleB1 = (await layer(B.page)).ripples;
  const cRipples = (await layer(C.page)).ripples;
  step({ viewport: V, start: "A and B connected", action: "A clicks an empty spot",
    observed: { elementUnderPointer: hit, localRipplePixels: localRing, peerRipplePixels: peerRing, rippleCounterA: [rippleA0, rippleA1], rippleCounterB: [rippleB0, rippleB1], otherRoomRipples: cRipples },
    ok: localRing > 0 && peerRing > 0 && rippleA1 > rippleA0 && rippleB1 > rippleB0 && cRipples === 0 && !String(hit).includes("overlay") });
  await sleep(1500);
  const ringLater = await ink(B.page, { ...q, r: 40 });
  step({ viewport: V, start: "Ripple painted", action: "Wait 1.5 s", observed: { peerRipplePixelsLater: ringLater, before: peerRing }, ok: ringLater < peerRing });

  // Controls under the overlay stay usable: the Pocket Ghosts chip is hit-tested as itself.
  const chip = B.page.locator("[data-pocket-ghosts]");
  await chip.scrollIntoViewIfNeeded();
  const chipHit = await chip.evaluate((el) => { const r = el.getBoundingClientRect(); const e = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return { self: el.contains(e), pressed: el.getAttribute("aria-pressed"), text: el.textContent.trim(), focusable: el.tabIndex >= 0 }; });
  await chip.click();
  const afterHide = await layer(B.page);
  const bInk = await inkAll(B.page);
  const aSeesLeave = await waitLayer(A.page, () => document.querySelector("[data-ghosts-state]")?.dataset.ghosts === "0", null, 5000);
  step({ viewport: V, start: "B on Home with ghosts on", action: "B presses Pocket 'Ghosts on' chip",
    observed: { chipBefore: chipHit, chipAfter: { pressed: await chip.getAttribute("aria-pressed"), text: (await chip.textContent()).trim() }, layer: afterHide, BcanvasPixels: bInk, AseesZeroOthers: aSeesLeave },
    ok: chipHit.self && chipHit.pressed === "true" && (await chip.getAttribute("aria-pressed")) === "false" && afterHide.state === "off" && bInk === 0 && aSeesLeave });

  // Persistence: reload and route change mount no socket.
  await B.page.reload({ waitUntil: "load" });
  await sleep(2500);
  const reloaded = await layer(B.page);
  await B.page.goto(`${APP}/ryugu`, { waitUntil: "load" });
  await sleep(2500);
  const palace = await layer(B.page);
  step({ viewport: V, start: "B hid ghosts", action: "Reload Home, then open /ryugu", observed: { homeAfterReload: reloaded, ryugu: palace, stored: await B.page.evaluate(() => localStorage.getItem("ghosts")) },
    ok: reloaded.sockets === 0 && reloaded.state !== "on" && palace.sockets === 0 && palace.state !== "on" });

  // Cross-tab: a /ryugu tab follows a Home toggle in another tab of the same browser.
  const tab2 = await B.ctx.newPage();
  await tab2.goto(`${APP}/`, { waitUntil: "load" });
  const chip2 = tab2.locator("[data-pocket-ghosts]");
  await chip2.scrollIntoViewIfNeeded();
  await chip2.click(); // ghosts on again
  const palaceOn = await waitLayer(B.page, () => document.querySelector("[data-ghosts-state]")?.dataset.ghostsState === "on");
  const homeOn = await waitLayer(tab2, () => document.querySelector("[data-ghosts-state]")?.dataset.ghostsState === "on");
  await chip2.click(); // off again from Home
  const palaceOff = await waitLayer(B.page, () => document.querySelector("[data-ghosts-state]")?.dataset.ghostsState === "off", null, 5000);
  const cSaw = await layer(C.page);
  step({ viewport: V, start: "B: /ryugu tab and Home tab, ghosts hidden", action: "Toggle Ghosts on, then off, from the Home tab",
    observed: { palaceTurnedOn: palaceOn, homeTurnedOn: homeOn, palaceTurnedOff: palaceOff, palaceLayer: await layer(B.page) }, ok: palaceOn && homeOn && palaceOff });
  await chip2.click(); // leave B visible again on Home tab
  await tab2.close();
  await B.page.goto(`${APP}/`, { waitUntil: "load" });
  await waitLayer(B.page, () => document.querySelector("[data-ghosts-state]")?.dataset.ghosts === "1");

  // Departure: B moves, A sees the tip, B leaves, A clears.
  const r0 = { x: Math.round(W * 0.6), y: Math.round(H * 0.25) };
  await glide(B.page, { x: r0.x - 60, y: r0.y }, r0, 6);
  await sleep(250);
  const beforeLeave = await ink(A.page, { ...r0, r: 24 });
  await B.ctx.close();
  const cleared = await waitLayer(A.page, () => document.querySelector("[data-ghosts-state]")?.dataset.ghosts === "0", null, 8000);
  await sleep(300);
  const afterLeave = await ink(A.page, { ...r0, r: 24 });
  const aLabel = (await layer(A.page)).label;
  step({ viewport: V, start: "B visible to A", action: "B moves, then closes the tab", observed: { tipBefore: beforeLeave, tipAfter: afterLeave, othersCleared: cleared, label: aLabel },
    ok: beforeLeave > 0 && afterLeave === 0 && cleared && aLabel === "" });

  // /ryugu room pair, isolated from Home.
  const E = await open(bB, vpSize, `${APP}/ryugu`);
  const pairOk = await waitLayer(C.page, () => document.querySelector("[data-ghosts-state]")?.dataset.ghosts === "1");
  await glide(E.page, p0, p1);
  await sleep(250);
  const palaceTip = await ink(C.page, { ...p1, r: 24 });
  const homeTip = await ink(A.page, { ...p1, r: 24 });
  step({ viewport: V, start: "Two visitors on /ryugu, one on Home", action: "Palace visitor moves", observed: { palacePair: pairOk, palacePeerPixels: palaceTip, homePixels: homeTip },
    ok: pairOk && palaceTip > 0 && homeTip === 0 });

  // Reduced motion: no config, no socket, no drawing; others don't see it.
  const R = await open(bB, vpSize, `${APP}/`, { reduced: true });
  await sleep(3000);
  const rl = await layer(R.page);
  const aOthers = (await layer(A.page)).others;
  step({ viewport: V, start: "Visitor with prefers-reduced-motion: reduce", action: "Open Home and wait 3 s", observed: { layer: rl, othersSeenByA: aOthers }, ok: rl.sockets === 0 && rl.state !== "on" && aOthers === 0 });

  // Offline: transport closes and ink clears; back online reconnects.
  await A.ctx.setOffline(true);
  await A.page.evaluate(() => window.dispatchEvent(new Event("offline")));
  const offline = await waitLayer(A.page, () => document.querySelector("[data-ghosts-state]")?.dataset.ghostsState !== "on", null, 5000);
  await A.ctx.setOffline(false);
  await A.page.evaluate(() => window.dispatchEvent(new Event("online")));
  const back = await waitLayer(A.page, () => document.querySelector("[data-ghosts-state]")?.dataset.ghostsState === "on", null, 8000);
  step({ viewport: V, start: "A connected", action: "Browser goes offline, then online", observed: { stoppedOffline: offline, reconnected: back, layer: await layer(A.page) }, ok: offline && back });

  // Negative control: suppress canvas painting on a fresh viewer; the same pixel check must reject it
  // even though the ripple counter still advances.
  const N = await open(bB, vpSize, `${APP}/`);
  await N.page.evaluate(() => { const P = CanvasRenderingContext2D.prototype; P.stroke = P.fill = function () {}; });
  await waitLayer(N.page, () => document.querySelector("[data-ghosts-state]")?.dataset.ghosts === "1");
  const n0 = (await layer(N.page)).ripples;
  await A.page.mouse.move(q.x, q.y); await A.page.mouse.down(); await A.page.mouse.up();
  await sleep(150);
  const nInk = await ink(N.page, { ...q, r: 40 });
  const n1 = (await layer(N.page)).ripples;
  step({ viewport: V, start: "Negative control: viewer with stroke/fill disabled", action: "A clicks", observed: { counter: [n0, n1], ripplePixels: nInk, pixelAssertionRejects: nInk === 0 }, ok: n1 > n0 && nInk === 0 });

  const errs = { A: A.errors, B: B.errors, C: C.errors, E: E.errors, R: R.errors, N: N.errors };
  const flat = Object.values(errs).flat().filter((e) => !/ERR_INTERNET_DISCONNECTED|net::ERR/.test(e));
  step({ viewport: V, start: "All contexts", action: "Collect page and console errors", observed: errs, ok: flat.length === 0 });

  await A.page.screenshot({ path: path.join(OUT, `local-${V}-home.png`) });
  await C.page.screenshot({ path: path.join(OUT, `local-${V}-ryugu.png`) });
  await Promise.all([bA, bB, bC].map((b) => b.close()));
}

// Denied-Origin negative control against the actual local Worker, with a positive control first.
const allowed = await rawUpgrade(new URL(APP).origin.replace("127.0.0.1", "localhost"));
const denied = await rawUpgrade("https://evil.example");
const lookalike = await rawUpgrade("https://otohime.dev.evil.example");
const none = await rawUpgrade(null);
const badRoom = await rawUpgrade(new URL(APP).origin, "/admin");
step({ start: "Actual Worker in local workerd, ALLOWED_ORIGINS=app origin", action: "Raw upgrades: allowed, denied, lookalike, missing Origin, unknown room",
  observed: { allowed, denied, lookalike, none, badRoom }, ok: allowed === 101 && denied === 403 && lookalike === 403 && none === 403 && badRoom === 404 });

for (const vp of VIEWPORTS) await walk(vp);
writeFileSync(path.join(OUT, "local-result.json"), JSON.stringify(results, null, 2));
const failed = results.filter((r) => !r.ok).length;
console.log(`${results.length - failed}/${results.length} pass`);
process.exit(failed ? 1 : 0);
