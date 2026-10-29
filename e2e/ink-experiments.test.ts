import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { chromium, type Browser, type BrowserContext, type BrowserContextOptions, type Page } from "playwright-core";
import { poseFixture } from "../lib/fixtures/shadow-hands.ts";
import { HAND_WORKER } from "../components/shadows/hand-tracker.ts";
import { CREATURES, type Landmark } from "../lib/shadow-poses.ts";

const BASE = process.env.BASE_URL ?? "http://localhost:4000";
const temp = mkdtempSync("/tmp/ink-experiments-e2e-");
let browser: Browser;
type Probe = { calls: number; tracks: MediaStreamTrack[]; hands: Landmark[][] };
const contexts: BrowserContext[] = [];
before(async () => {
  browser = await chromium.launch({ ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : { channel: "chrome" }), headless: true, env: { ...process.env, TMPDIR: temp }, args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream", "--disable-gpu", "--mute-audio"] });
});
after(async () => { for (const c of contexts) await c.close(); await browser?.close(); rmSync(temp, { recursive: true, force: true }); });
async function open(path: string, options: BrowserContextOptions = {}) {
  const context = await browser.newContext(options); contexts.push(context);
  await context.addInitScript(() => {
    const probe: Probe = { calls: 0, tracks: [], hands: [] };
    Object.assign(window, { inkProbe: probe });
    const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = async constraints => { probe.calls++; const stream = await original(constraints); probe.tracks.push(...stream.getTracks()); return stream; };
  });
  const page = await context.newPage();
  const requests: { url: string; method: string }[] = [], errors: string[] = [];
  page.on("request", r => requests.push({ url: r.url(), method: r.method() }));
  page.on("pageerror", e => errors.push(e.message));
  await page.goto(`${BASE}${path}`);
  return { page, context, requests, errors };
}
const stage = (p: Page) => p.getByTestId("shadow-theatre");
const calls = (p: Page) => p.evaluate(() => (window as unknown as { inkProbe: Probe }).inkProbe.calls);
const tracksStopped = (p: Page) => p.waitForFunction(() => (window as unknown as { inkProbe: Probe }).inkProbe.tracks.every(t => t.readyState === "ended"));

test("ink bonsai seasons pruning regrowth and postcard are usable", async () => {
  const { page: p, requests, errors } = await open("/play/bonsai");
  const tree = p.getByTestId("bonsai"); await tree.waitFor();
  const count = await tree.locator("[data-branch]").count(); assert.ok(count > 100);
  const twig = tree.getByRole("button", { name: /Prune branch/ }).last();
  await twig.focus(); await p.keyboard.press("Enter");
  await p.waitForFunction(n => document.querySelectorAll("[data-branch]").length < n, count);
  await tree.getByRole("button", { name: "Regrow", exact: true }).click();
  assert.equal(await tree.locator("[data-branch]").count(), count);
  for (const s of ["spring", "summer", "autumn", "winter"]) {
    await tree.getByLabel("Tree season").selectOption(s);
    assert.equal(await tree.getAttribute("data-season"), s);
    if (s === "winter") assert.ok(await tree.locator(".bonsai-foliage path").count() > 0);
    else assert.ok(await tree.locator(".bonsai-foliage ellipse").count() > 0);
  }
  const downloaded = p.waitForEvent("download"); await tree.getByRole("button", { name: "Download postcard PNG" }).click();
  const download = await downloaded; const file = await download.path(); assert.ok(file);
  const bytes = readFileSync(file); assert.equal(bytes.subarray(1, 4).toString(), "PNG"); assert.ok(bytes.length > 10000);
  assert.equal(await calls(p), 0); assert.ok(!requests.some(r => /github\.com/.test(r.url)));
  assert.deepEqual(errors, []);
});

test("ink bonsai weekly images are deterministic and invalid weeks fail safely", async () => {
  const { page: p } = await open("/play/bonsai?week=invalid");
  await p.getByRole("alert").filter({ hasText: "not in this activity snapshot" }).waitFor();
  const imageURL = await p.getByRole("link", { name: "Weekly image ↗" }).getAttribute("href");
  const a = await p.request.get(`${BASE}${imageURL}`), b = await p.request.get(`${BASE}${imageURL}`);
  assert.equal(a.status(), 200); assert.equal(a.headers()["content-type"], "image/png");
  assert.deepEqual(await a.body(), await b.body());
  assert.equal((await p.request.get(`${BASE}/og/bonsai?week=2026-W99`)).status(), 400);
  assert.equal((await p.request.get(`${BASE}/og/bonsai?season=invalid`)).status(), 400);
});

test("ink experiments reduced motion keeps pruning and paper puppets static", async () => {
  const { page: p } = await open("/play/bonsai", { reducedMotion: "reduce", viewport: { width: 390, height: 844 } });
  await p.getByTestId("bonsai").waitFor();
  await p.getByRole("button", { name: /Prune branch/ }).last().evaluate((e: SVGGElement) => e.dispatchEvent(new MouseEvent("click", { bubbles: true })));
  assert.equal(await p.locator(".bonsai-falling").count(), 0);
  await p.goto(`${BASE}/play/shadows`); await p.getByTestId("paper-puppets").waitFor();
  assert.equal(await p.locator(".shadow-flame").evaluate(e => getComputedStyle(e).animationName), "none");
  assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  assert.equal(await calls(p), 0);
});

test("shadow puppets move by mouse touch and keyboard without camera consent", async () => {
  const { page: p, errors, requests } = await open("/play/shadows");
  await p.getByText("Your hands, your device", { exact: true }).waitFor();
  const puppet = p.getByRole("button", { name: "Move rabbit puppet" });
  await puppet.focus(); const parent = puppet.locator("..");
  const start = await parent.getAttribute("style"); await p.keyboard.press("ArrowRight");
  assert.notEqual(await parent.getAttribute("style"), start);
  const box = (await puppet.boundingBox())!;
  const before = await parent.getAttribute("style");
  await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await p.mouse.down(); await p.mouse.move(box.x + box.width / 2 + 45, box.y + box.height / 2 - 15, { steps: 5 }); await p.mouse.up();
  assert.notEqual(await parent.getAttribute("style"), before);
  assert.equal(await puppet.evaluate(e => getComputedStyle(e).touchAction), "none");
  const touch = await p.context().newCDPSession(p);
  const next = (await puppet.boundingBox())!; const touchBefore = await parent.getAttribute("style");
  await touch.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: next.x + next.width / 2, y: next.y + next.height / 2 }] });
  await touch.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: next.x + next.width / 2 + 30, y: next.y + next.height / 2 }] });
  await touch.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  assert.notEqual(await parent.getAttribute("style"), touchBefore);
  assert.equal(await calls(p), 0); assert.ok(!requests.some(r => r.url.includes("/vendor/hand-landmarker/")));
  assert.equal(await p.getByTestId("paper-puppets").getByRole("link", { name: "Notes ↗" }).count(), 2);
  assert.equal(await p.getByTestId("paper-puppets").getByRole("link", { name: "Projects ↗" }).count(), 2);
  await p.getByTestId("paper-puppets").getByRole("link", { name: "Notes ↗" }).first().click(); await p.waitForURL(`${BASE}/notes`);
  assert.deepEqual(errors, []);
});

test("shadow camera denial and model failure leave usable paper puppets", async () => {
  for (const failure of ["permission", "model"]) {
    const { page: p } = await open("/play/shadows"); await stage(p).waitFor();
    if (failure === "permission") await p.evaluate(() => { navigator.mediaDevices.getUserMedia = async () => { throw new DOMException("denied", "NotAllowedError"); }; });
    else await p.route("**/vendor/hand-landmarker/**", route => route.fulfill({ status: 404, body: "Unavailable" }));
    await p.getByRole("button", { name: "Enable camera", exact: true }).click();
    await p.getByRole("status").filter({ hasText: /unavailable|declined|could not start/ }).waitFor({ timeout: 40000 });
    await p.getByTestId("paper-puppets").waitFor();
    await tracksStopped(p);
    await p.getByRole("button", { name: "Move deer puppet" }).focus(); await p.keyboard.press("ArrowLeft");
  }
});

test("shadow real local model constructs on CPU and detects without outbound requests", async () => {
  const { page: p, requests } = await open("/play/shadows");
  const result = await p.evaluate(async workerURL => {
    const worker = new Worker(workerURL);
    try {
      return await new Promise<{ delegate: string; frames: number }>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("worker preflight timeout")), 35000);
        let delegate = "";
        worker.onerror = e => { clearTimeout(timer); reject(new Error(e.message)); };
        worker.onmessage = async ({ data }) => {
          if (data.type === "error") { clearTimeout(timer); reject(new Error(data.error)); }
          if (data.type === "ready") {
            delegate = data.delegate; const canvas = document.createElement("canvas"); canvas.width = 640; canvas.height = 480;
            canvas.getContext("2d")!.fillRect(0, 0, 640, 480);
            const bitmap = await createImageBitmap(canvas); worker.postMessage({ type: "frame", bitmap, time: performance.now() }, [bitmap]);
          }
          if (data.type === "hands") { clearTimeout(timer); resolve({ delegate, frames: 1 }); }
        };
        worker.postMessage({ type: "init", delegate: "CPU" });
      });
    } finally { worker.terminate(); }
  }, HAND_WORKER);
  assert.deepEqual(result, { delegate: "CPU", frames: 1 });
  assert.ok(requests.some(r => r.url.endsWith("hand_landmarker.task")));
  assert.ok(requests.filter(r => r.url.includes("/vendor/hand-landmarker/")).every(r => r.url.startsWith(BASE) && r.method === "GET"));
  assert.equal(await calls(p), 0);
});

test("shadow opt in camera stops on Stop visibility and route exit", async () => {
  const { page: p, errors } = await open("/play/shadows");
  assert.equal(await calls(p), 0);
  const start = async () => { await p.getByRole("button", { name: "Enable camera", exact: true }).click(); await p.locator('[data-testid="shadow-theatre"][data-mode="camera"]').waitFor({ timeout: 40000 }); };
  await start(); assert.equal(await calls(p), 1);
  await p.getByRole("button", { name: "Stop camera", exact: true }).click(); await tracksStopped(p);
  await start();
  await p.evaluate(() => { Object.defineProperty(document, "hidden", { configurable: true, value: true }); document.dispatchEvent(new Event("visibilitychange")); });
  await tracksStopped(p);
  await p.evaluate(() => Object.defineProperty(document, "hidden", { configurable: true, value: false }));
  await start();
  await p.getByRole("link", { name: "Projects", exact: true }).last().evaluate((e: HTMLAnchorElement) => e.click());
  await p.waitForURL(`${BASE}/projects`); await stage(p).waitFor({ state: "hidden" }); await tracksStopped(p);
  assert.deepEqual(errors, []);
});

test("shadow four fixture poses carry working links through the camera stage", async () => {
  const { page: p, context } = await open("/play/shadows");
  await context.addInitScript(() => {
    const Original = window.Worker;
    window.Worker = class {
      onmessage: ((e: MessageEvent) => void) | null = null;
      onerror: Worker["onerror"] = null;
      constructor(url: string | URL, options?: WorkerOptions) { if (!String(url).includes("hand-worker.js")) return new Original(url, options); }
      postMessage(data: { type: string; bitmap?: ImageBitmap }) {
        data.bitmap?.close();
        setTimeout(() => this.onmessage?.({ data: data.type === "init" ? { type: "ready", delegate: "fixture" } : { type: "hands", hands: (window as unknown as { inkProbe: Probe }).inkProbe.hands } } as MessageEvent), 0);
      }
      terminate() { this.onmessage = null; }
    } as unknown as typeof Worker;
  });
  await p.reload(); await stage(p).waitFor();
  await p.getByRole("button", { name: "Enable camera", exact: true }).click();
  for (const pose of CREATURES) {
    await p.evaluate(hands => { (window as unknown as { inkProbe: Probe }).inkProbe.hands = hands; }, poseFixture(pose));
    await p.locator(`[data-testid="shadow-theatre"][data-pose="${pose}"]`).waitFor({ timeout: 6000 });
    const link = p.getByRole("link", { name: `${pose} carries ${pose === "dog" || pose === "deer" ? "Projects" : "Notes"}` });
    assert.equal(await link.getAttribute("href"), pose === "dog" || pose === "deer" ? "/projects" : "/notes");
  }
  await p.getByRole("button", { name: "Stop camera", exact: true }).click(); await tracksStopped(p);
});
