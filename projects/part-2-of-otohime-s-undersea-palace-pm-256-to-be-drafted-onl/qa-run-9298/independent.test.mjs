// Independent QA: real local workerd + real Chrome; no imports from the supplied browser proof.
import assert from "node:assert/strict";
import { test } from "node:test";
import { request } from "node:http";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { chromium } from "playwright-core";
import { fingerprint } from "../../../ghosts/worker/scripts/fingerprint.mjs";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const requireWorker = createRequire(resolve(root, "ghosts/worker/package.json"));
const { unstable_startWorker } = requireWorker("wrangler");
const base = process.env.BASE_URL;
assert.ok(base, "run through scripts/e2e.mjs");
const alpha = async page => page.evaluate(() => {
  const c = document.querySelector("[data-ghosts-state] canvas");
  if (!c) return 0;
  const bytes = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
  let n = 0;
  for (let i = 3; i < bytes.length; i += 4) n += bytes[i] > 0 ? 1 : 0;
  return n;
});
const expectInk = n => assert.ok(n > 0, "independent peer canvas must contain ink");
const waitInk = page => page.waitForFunction(() => {
  const c = document.querySelector("[data-ghosts-state] canvas");
  return c && c.getContext("2d").getImageData(0, 0, c.width, c.height).data.some((v, i) => i % 4 === 3 && v > 0);
}, null, { timeout: 3000 });
const state = (page, n) => page.locator('[data-ghosts="' + n + '"][data-ghosts-state="on"]').waitFor();

function refusedOrigin(url) {
  return new Promise((resolve, reject) => {
    const req = request(new URL("/ghosts?room=%2F", url), { headers: {
      Origin: "https://denied.invalid", Connection: "Upgrade", Upgrade: "websocket",
      "Sec-WebSocket-Version": "13", "Sec-WebSocket-Key": "cWEtbmVnYXRpdmUtY29udA==",
    } }, response => { response.resume(); resolve(response.statusCode); });
    req.on("upgrade", (_response, socket) => { socket.destroy(); reject(new Error("denied Origin upgraded")); });
    req.on("error", reject);
    req.setTimeout(3000, () => req.destroy(new Error("denied-Origin probe timed out")));
    req.end();
  });
}

test("independent real Worker browser fan-out and blocked-delivery negative control", { timeout: 45000 }, async () => {
  const build = fingerprint();
  let runtime, browser;
  const errors = [];
  try {
    runtime = await unstable_startWorker({
      config: resolve(root, "ghosts/worker/wrangler.jsonc"),
      // Only the local origin binding changes. Source, lock, date, DO and adapter remain real.
      bindings: { ALLOWED_ORIGINS: { type: "plain_text", value: base } },
      build: { define: { __GHOSTS_FINGERPRINT__: JSON.stringify(build.fingerprint) } },
      dev: { server: { hostname: "127.0.0.1", port: 0 }, inspector: false, persist: false, watch: false, logLevel: "none" },
    });
    await runtime.ready;
    const worker = String(await runtime.url);
    const endpoint = new URL("/ghosts", worker).href.replace(/^http/, "ws");
    const version = await (await fetch(new URL("/version", worker))).json();
    assert.equal(version.fingerprint, build.fingerprint);
    assert.equal(await refusedOrigin(worker), 403);
    assert.equal((await fetch(new URL("/__log", worker))).status, 404);
    browser = await chromium.launch({ channel: "chrome", env: { ...process.env, TMPDIR: "/tmp" } });
    let dropped = 0, observedDrop;
    const dropReceipt = new Promise(resolve => { observedDrop = resolve; });
    const contexts = [];
    const open = async (room, blocked = false) => {
      const context = await browser.newContext({ reducedMotion: "no-preference", viewport: { width: 1040, height: 800 } });
      contexts.push(context);
      await context.route("**/api/ghosts*", route => route.fulfill({
        status: 200, contentType: "application/json", body: JSON.stringify({ endpoint, rooms: ["/", "/ryugu"] }),
      }));
      if (blocked) await context.routeWebSocket(endpoint + "?*", route => {
        const server = route.connectToServer();
        server.onMessage(message => {
          const event = JSON.parse(String(message));
          if (event.t === "m" || event.t === "c") { dropped++; observedDrop(); }
          else route.send(message);
        });
      });
      const page = await context.newPage();
      page.on("pageerror", e => errors.push(e.message));
      page.on("console", message => {
        if (message.type() === "error" && message.args().length) errors.push(message.text());
      });
      assert.equal((await page.goto(base + room)).status(), 200);
      await page.locator('[data-ghosts-state="on"]').waitFor();
      return page;
    };
    const sender = await open("/ryugu"), receiver = await open("/ryugu"), other = await open("/");
    await state(sender, 1); await state(receiver, 1); await state(other, 0);
    assert.equal(await alpha(receiver), 0);
    await sender.mouse.move(540, 280); await waitInk(receiver);
    const positivePixels = await alpha(receiver);
    expectInk(positivePixels);
    assert.equal(await alpha(other), 0, "Home receives no Ryugu ink");
    const blocked = await open("/ryugu", true);
    await state(blocked, 2);
    await sender.mouse.click(680, 360);
    await Promise.race([dropReceipt, new Promise((_, reject) => {
      const timer = setTimeout(() => reject(new Error("no actual frame reached negative-control proxy")), 3000);
      timer.unref();
    })]);
    assert.ok(dropped > 0, "real runtime delivered frames to the blocking proxy");
    const negativePixels = await alpha(blocked);
    assert.throws(() => expectInk(negativePixels), /independent peer canvas must contain ink/);
    assert.equal(negativePixels, 0);
    await sender.close(); await blocked.close(); await state(receiver, 0);
    await receiver.waitForFunction(() => {
      const c = document.querySelector("[data-ghosts-state] canvas");
      return !c || !c.getContext("2d").getImageData(0, 0, c.width, c.height).data.some((v, i) => i % 4 === 3 && v > 0);
    });
    assert.equal(await alpha(receiver), 0);
    // A second positive path exercises Home against the real adapter as well.
    const homeSender = await open("/");
    await state(homeSender, 1); await state(other, 1);
    await homeSender.mouse.move(430, 270); await waitInk(other);
    const homePixels = await alpha(other);
    expectInk(homePixels);
    await homeSender.close(); await state(other, 0);
    await other.waitForFunction(() => {
      const c = document.querySelector("[data-ghosts-state] canvas");
      return !c || !c.getContext("2d").getImageData(0, 0, c.width, c.height).data.some((v, i) => i % 4 === 3 && v > 0);
    });
    assert.equal(await alpha(other), 0);
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ kind: "independent-qa", chrome: browser.version(), worker: version,
      effectiveOrigin: base,
      effectiveConfigurationFingerprint: createHash("sha256").update(JSON.stringify({
        workerFingerprint: build.fingerprint, allowedOrigins: base, local: true, persist: false,
      })).digest("hex"),
      positivePixels, homePixels, negativePixels, dropped, deniedOrigin: 403, roomSeparation: true, leaveClears: true,
      boundary: "local workerd; injected app config and local Origin binding; no fake fan-out or canvas instrumentation; negative control drops real server frames" }));
    for (const context of contexts) await context.close();
  } finally {
    await browser?.close();
    await runtime?.dispose();
  }
});
