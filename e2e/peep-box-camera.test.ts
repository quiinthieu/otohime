import assert from "node:assert/strict";
import { after, afterEach, before, test } from "node:test";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import {
  chromium,
  type Browser,
  type Page,
  type BrowserContext,
} from "playwright-core";
import { faceFixture } from "./peep-box-face-fixture.ts";
const BASE = process.env.BASE_URL ?? "http://localhost:4000";
const manifest = JSON.parse(
  readFileSync("content/peep-box-assets.json", "utf8"),
);
const workerURL = `/vendor/peep-box/${manifest.version}/head-worker.js`;
let browser: Browser;
let context: BrowserContext | undefined;
before(async () => {
  browser = await chromium.launch({
    ...(process.env.CHROME_PATH
      ? { executablePath: process.env.CHROME_PATH }
      : { channel: "chrome" }),
    env: { ...process.env, TMPDIR: "/tmp" },
  });
});
afterEach(async () => {
  await context?.close();
  context = undefined;
  assert.equal(browser.contexts().length, 0, "camera case released its browser context");
});
after(async () => { await browser?.close(); });
const box = (p: Page) => p.locator("[data-peep]");
async function activate(p: Page) {
  await p.goto(`${BASE}/play`);
  await box(p)
    .getByRole("button", { name: "Look inside", exact: true })
    .click();
  await p.waitForFunction(
    () =>
      document.querySelector("[data-peep]")?.getAttribute("data-running") ===
      "true",
  );
}
async function open(mode: "denied" | "pending" | "fake" | "real" = "fake") {
  // Each loop iteration owns one camera/page. Retaining earlier contexts can
  // starve later video.play()/worker initialization on a busy browser runner.
  await context?.close();
  const c = await browser.newContext({
    viewport: { width: 1366, height: 768 },
  });
  context = c;
  await c.addInitScript(
    ({ mode }) => {
      const w = window as unknown as {
        cameraCalls: number;
        tracks: MediaStreamTrack[];
        workers: number;
        terminated: number;
        frames: number;
        delegates: string[];
        constraints: MediaStreamConstraints[];
        resolveCamera: () => void;
      };
      Object.assign(w, {
        cameraCalls: 0,
        tracks: [],
        workers: 0,
        terminated: 0,
        frames: 0,
        delegates: [],
        constraints: [],
      });
      navigator.mediaDevices.getUserMedia = async (constraints) => {
        w.cameraCalls++;
        w.constraints.push(constraints!);
        if (mode === "denied")
          throw new DOMException("denied", "NotAllowedError");
        if (mode === "pending")
          await new Promise<void>((resolve) => {
            w.resolveCamera = resolve;
          });
        const canvas = document.createElement("canvas");
        canvas.width = 320;
        canvas.height = 240;
        canvas.getContext("2d")!.fillRect(0, 0, 320, 240);
        const stream = canvas.captureStream(15);
        // A real camera keeps producing frames. One paint before captureStream
        // leaves video.play() dependent on delivery of a single initial frame.
        const timer = setInterval(() => canvas.getContext("2d")!.fillRect(0, 0, 320, 240), 70);
        for (const track of stream.getTracks()) {
          const stop = track.stop.bind(track);
          track.stop = () => { clearInterval(timer); stop(); };
        }
        w.tracks.push(...stream.getTracks());
        return stream;
      };
      const RealWorker = window.Worker;
      if (mode === "real")
        window.Worker = new Proxy(RealWorker, {
          construct(target, args) {
            w.workers++;
            const worker = Reflect.construct(target, args);
            worker.addEventListener("message", ({ data }: MessageEvent) => {
              if (data.type === "ready") w.delegates.push(data.delegate);
            });
            const terminate = worker.terminate.bind(worker);
            worker.terminate = () => {
              w.terminated++;
              terminate();
            };
            return worker;
          },
        });
      else {
        class FakeWorker {
          onmessage: ((e: { data: unknown }) => void) | null = null;
          onerror: (() => void) | null = null;
          generation = 0;
          constructor() {
            w.workers++;
          }
          postMessage(m: {
            type: string;
            generation: number;
            bitmap?: ImageBitmap;
          }) {
            if (m.type === "init") {
              this.generation = m.generation;
              queueMicrotask(() =>
                this.onmessage?.({
                  data: { type: "ready", generation: m.generation },
                }),
              );
            }
            if (m.type === "frame") {
              w.frames++;
              m.bitmap?.close();
              queueMicrotask(() =>
                this.onmessage?.({
                  data: {
                    type: "pose",
                    generation: m.generation,
                    pose: { x: 80, y: 0, z: 600 },
                  },
                }),
              );
            }
          }
          terminate() {
            w.terminated++;
          }
        }
        window.Worker = FakeWorker as unknown as typeof Worker;
      }
    },
    { mode },
  );
  const p = await c.newPage();
  const requests: { url: string; method: string; body: string | null }[] = [];
  c.on("request", (r) =>
    requests.push({ url: r.url(), method: r.method(), body: r.postData() }),
  );
  return { c, p, requests };
}
async function stopped(p: Page) {
  await p.waitForFunction(() => {
    const w = window as unknown as {
      tracks: MediaStreamTrack[];
      terminated: number;
    };
    return w.tracks.every((t) => t.readyState === "ended");
  });
}
test("synthetic camera delivers continuing decoded frames and stops its tracks", { timeout: 10000 }, async () => {
  const previous = await open();
  const { p } = await open();
  assert.equal(previous.p.isClosed(), true, "the next fixture releases the previous page");
  assert.equal(browser.contexts().length, 1, "loop iterations cannot accumulate contexts");
  await p.goto(BASE + "/play");
  const frames = await p.evaluate(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    const video = document.createElement("video");
    video.muted = true;
    video.srcObject = stream;
    try {
      await video.play();
      return await new Promise<number>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("synthetic camera stopped delivering frames")), 2000);
        let frames = 0;
        const next = () => {
          if (++frames >= 3) { clearTimeout(timer); resolve(frames); }
          else video.requestVideoFrameCallback(next);
        };
        video.requestVideoFrameCallback(next);
      });
    } finally {
      stream.getTracks().forEach(track => track.stop());
      video.pause(); video.srcObject = null;
    }
  });
  assert.equal(frames, 3);
  await stopped(p);
});
test(
  "camera opt-in absence, denial and late permission cancellation (fake media/worker)",
  { timeout: 60000 },
  async () => {
    for (const mode of ["denied", "pending"] as const) {
      const { p, requests } = await open(mode);
      await activate(p);
      assert.equal(
        await p.evaluate(
          () => (window as unknown as { cameraCalls: number }).cameraCalls,
        ),
        0,
      );
      assert.equal(
        requests.some((r) => /vendor\/peep-box|mediapipe|\.wasm/.test(r.url)),
        false,
      );
      await box(p)
        .getByRole("button", { name: "Use my camera", exact: true })
        .click();
      if (mode === "pending") {
        await box(p)
          .getByRole("button", { name: "Turn camera off", exact: true })
          .click();
        await p.evaluate(() =>
          (window as unknown as { resolveCamera: () => void }).resolveCamera(),
        );
        await p.waitForFunction(
          () =>
            (window as unknown as { tracks: MediaStreamTrack[] }).tracks
              .length === 1,
        );
      } else
        await box(p)
          .getByRole("status")
          .filter({ hasText: /unavailable|not allowed/ })
          .waitFor();
      await stopped(p);
      assert.equal(
        await p.evaluate(
          () => (window as unknown as { workers: number }).workers,
        ),
        0,
      );
      assert.equal(
        requests.some((r) => /vendor\/peep-box|mediapipe|\.wasm/.test(r.url)),
        false,
      );
      await box(p)
        .getByRole("button", { name: "Look right", exact: true })
        .click();
      assert.equal(await box(p).getAttribute("data-source"), "pointer");
      assert.equal(
        await p.evaluate(
          () =>
            (window as unknown as { constraints: MediaStreamConstraints[] })
              .constraints[0].audio,
        ),
        false,
      );
    }
  },
);
test(
  "every lifecycle exit stops tracks and worker and never automatically resumes (fake inference)",
  { timeout: 120000 },
  async () => {
    for (const exit of [
      "off",
      "disable",
      "hidden",
      "offscreen",
      "pagehide",
      "route",
      "reduce",
      "revoke",
    ] as const) {
      console.log(`lifecycle control: ${exit}`);
      const { p } = await open();
      await activate(p);
      await box(p)
        .getByRole("button", { name: "Use my camera", exact: true })
        .click();
      await p.waitForFunction(
        () =>
          document.querySelector("[data-peep]")?.getAttribute("data-camera") ===
          "active",
      );
      await p.waitForFunction(
        () => (window as unknown as { frames: number }).frames > 0,
      );
      if (exit === "off")
        await box(p)
          .getByRole("button", { name: "Turn camera off", exact: true })
          .click();
      if (exit === "disable")
        await box(p)
          .getByRole("button", { name: "Disable", exact: true })
          .click();
      if (exit === "hidden")
        await p.evaluate(() => {
          Object.defineProperty(document, "hidden", {
            configurable: true,
            value: true,
          });
          document.dispatchEvent(new Event("visibilitychange"));
        });
      if (exit === "offscreen") await p.evaluate(() => scrollTo(0, 0));
      if (exit === "pagehide")
        await p.evaluate(() => dispatchEvent(new Event("pagehide")));
      if (exit === "route") {
        await p
          .getByRole("link", { name: "Projects", exact: true })
          .first()
          .evaluate((e: HTMLAnchorElement) => e.click());
        await box(p).waitFor({ state: "hidden" });
      }
      if (exit === "reduce") await p.emulateMedia({ reducedMotion: "reduce" });
      if (exit === "revoke")
        await p.evaluate(() =>
          (
            window as unknown as { tracks: MediaStreamTrack[] }
          ).tracks[0].dispatchEvent(new Event("ended")),
        );
      await stopped(p);
      assert.ok(
        await p.evaluate(
          () => (window as unknown as { terminated: number }).terminated > 0,
        ),
        exit,
      );
      const frames = await p.evaluate(
        () => (window as unknown as { frames: number }).frames,
      );
      if (exit === "hidden")
        await p.evaluate(() => {
          Object.defineProperty(document, "hidden", {
            configurable: true,
            value: false,
          });
          document.dispatchEvent(new Event("visibilitychange"));
        });
      if (exit === "offscreen") await box(p).scrollIntoViewIfNeeded();
      if (exit === "pagehide")
        await p.evaluate(() => dispatchEvent(new Event("pageshow")));
      if (exit === "reduce")
        await p.emulateMedia({ reducedMotion: "no-preference" });
      await p.waitForTimeout(120);
      assert.equal(
        await p.evaluate(
          () => (window as unknown as { frames: number }).frames,
        ),
        frames,
        exit,
      );
      assert.equal(
        await p.evaluate(
          () => (window as unknown as { cameraCalls: number }).cameraCalls,
        ),
        1,
        exit,
      );
    }
  },
);
test(
  "real production CPU worker: licensed pixels yield landmarks, translated pose, no-face recovery, no upload",
  { timeout: 120000 },
  async () => {
    const { p, requests } = await open("real");
    await activate(p);
    const fixture = await faceFixture();
    // Direct worker preflight bypasses GPU availability, while using exactly the deployed worker and assets.
    const results = await p.evaluate(
      async ({ workerURL, dataURL }) => {
        const worker = new Worker(workerURL);
        const receive = () =>
          new Promise<Record<string, unknown>>((resolve, reject) => {
            const timer = setTimeout(
              () => reject(new Error("worker timeout")),
              45000,
            );
            worker.onmessage = ({ data }) => {
              clearTimeout(timer);
              resolve(data);
            };
            worker.onerror = (e) => {
              clearTimeout(timer);
              reject(new Error(e.message));
            };
          });
        const initialized = receive();
        worker.postMessage({ type: "init", generation: 7, delegate: "CPU" });
        const ready = await initialized;
        if (ready.type !== "ready") throw new Error(JSON.stringify(ready));
        const image = new Image();
        image.src = dataURL;
        await image.decode();
        const canvas = document.createElement("canvas");
        canvas.width = 480;
        canvas.height = 400;
        const ctx = canvas.getContext("2d")!;
        const output: Record<string, unknown>[] = [];
        for (const shift of [0, 25, "no-face", 0]) {
          ctx.fillStyle = "#ddd";
          ctx.fillRect(0, 0, 480, 400);
          if (shift === "no-face")
            ctx.drawImage(image, 350, 350, 150, 150, 0, 0, 480, 400);
          else
            ctx.drawImage(image, 100, 0, 300, 300, Number(shift), 0, 400, 400);
          // Drive a 14Hz decoded video fixture through the worker's independent wall-clock cap.
          await new Promise((resolve) => setTimeout(resolve, 72));
          const bitmap = await createImageBitmap(canvas);
          const pending = receive();
          worker.postMessage(
            {
              type: "frame",
              generation: 7,
              time: performance.now() + output.length * 100,
              bitmap,
            },
            [bitmap],
          );
          output.push(await pending);
        }
        worker.postMessage({ type: "stop" });
        worker.terminate();
        return { ready, output };
      },
      { workerURL, dataURL: fixture.dataURL },
    );
    assert.equal(results.ready.delegate, "CPU");
    assert.ok(Number(results.output[0].count) > 400, JSON.stringify(results));
    assert.ok(Number(results.output[1].count) > 400, JSON.stringify(results));
    const a = results.output[0].pose as { x: number },
      b = results.output[1].pose as { x: number };
    assert.ok(Math.abs(a.x - b.x) > 20, JSON.stringify(results));
    assert.equal(results.output[2].count, 0, JSON.stringify(results));
    assert.equal(results.output[2].pose, null);
    assert.ok(Number(results.output[3].count) > 400);
    assert.ok(results.output.every((r) => !("faceLandmarks" in r)));
    // The same licensed pixels also drive the actual capture adapter, production worker
    // (GPU attempt / CPU fallback) and rendered off-axis layers. Only the camera hardware is synthetic.
    await p.evaluate(async (dataURL) => {
      const image = new Image();
      image.src = dataURL;
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = 480;
      canvas.height = 400;
      const ctx = canvas.getContext("2d")!;
      const w = window as unknown as {
        tracks: MediaStreamTrack[];
        paintFixture: (shift: number) => void;
        fixtureTimer: ReturnType<typeof setInterval>;
      };
      let currentShift = 0;
      const draw = () => {
        ctx.fillStyle = "#ddd";
        ctx.fillRect(0, 0, 480, 400);
        ctx.drawImage(image, 100, 0, 300, 300, currentShift, 0, 400, 400);
      };
      w.paintFixture = (shift) => {
        currentShift = shift;
        draw();
      };
      w.paintFixture(0);
      navigator.mediaDevices.getUserMedia = async (constraints) => {
        if (constraints?.audio !== false) throw new Error("audio_requested");
        const stream = canvas.captureStream(15);
        w.fixtureTimer = setInterval(draw, 70);
        w.tracks.push(...stream.getTracks());
        return stream;
      };
    }, fixture.dataURL);
    await box(p)
      .getByRole("button", { name: "Use my camera", exact: true })
      .click();
    await box(p)
      .getByRole("status")
      .filter({ hasText: "Gently move your head" })
      .waitFor({ timeout: 45000 });
    await p.waitForFunction(() => {
      const layer = document.querySelector<SVGGElement>("[data-peep-layer]");
      return (layer?.transform.baseVal.consolidate()?.matrix.e ?? 0) > 180;
    });
    const layer = box(p).locator("[data-peep-layer]").first();
    const first = await layer.evaluate(
      (e: SVGGElement) => e.transform.baseVal.consolidate()!.matrix.e,
    );
    for (const shift of [5, 10, 15, 20, 25]) {
      await p.evaluate(
        (shift) =>
          (
            window as unknown as { paintFixture: (x: number) => void }
          ).paintFixture(shift),
        shift,
      );
      await p.waitForTimeout(100);
    }
    await p.waitForFunction((first) => {
      const layer = document.querySelector<SVGGElement>("[data-peep-layer]");
      return (
        (layer?.transform.baseVal.consolidate()?.matrix.e ?? first) < first - 8
      );
    }, first);
    assert.equal(await box(p).getAttribute("data-source"), "camera");
    await box(p)
      .getByRole("button", { name: "Turn camera off", exact: true })
      .click();
    await stopped(p);
    await p.evaluate(() =>
      clearInterval(
        (window as unknown as { fixtureTimer: ReturnType<typeof setInterval> })
          .fixtureTimer,
      ),
    );

    assert.equal(
      requests.some(
        (r) =>
          r.method !== "GET" ||
          r.body !== null ||
          (/vendor\/peep-box/.test(r.url) &&
            new URL(r.url).origin !== new URL(BASE).origin),
      ),
      false,
      JSON.stringify(requests),
    );
    const response = await p.request.get(`${BASE}/play`);
    assert.equal(
      response.headers()["permissions-policy"],
      "camera=(self), microphone=()",
    );
    const workerResponse = await p.request.get(`${BASE}${workerURL}`);
    assert.equal(workerResponse.headers()["content-security-policy"],
      "default-src 'none'; script-src 'self' blob: 'wasm-unsafe-eval'; connect-src 'self' blob:; worker-src 'none'");
    const delegates = await p.evaluate(
      () => (window as unknown as { delegates: string[] }).delegates,
    );
    console.log(
      JSON.stringify({
        delegates,
        real: "locked CPU SDK/model/Wasm/production worker",
        fake: "media lifecycle only",
        browser: browser.version(),
        build: readFileSync(".next/BUILD_ID", "utf8").trim(),
        fixture: fixture.spec,
        workerSHA256: createHash("sha256")
          .update(readFileSync(`public${workerURL}`))
          .digest("hex"),
        lockSHA256: createHash("sha256")
          .update(readFileSync("package-lock.json"))
          .digest("hex"),
        assets: manifest,
        results,
      }),
    );
  },
);
test(
  "real worker/model failures preserve usable pointer mode (network corruption and worker error controls)",
  { timeout: 120000 },
  async () => {
    for (const failure of ["corrupt", "fetch", "worker"] as const) {
      const { p, c } = await open("real");
      if (failure === "worker")
        await c.route(`**${workerURL}`, (r) =>
          r.fulfill({
            contentType: "text/javascript",
            body: 'throw new Error("negative control")',
          }),
        );
      else
        await c.route("**/face_landmarker.task", (r) =>
          failure === "fetch"
            ? r.abort()
            : r.fulfill({
                contentType: "application/octet-stream",
                body: "corrupted",
              }),
        );
      await activate(p);
      await box(p)
        .getByRole("button", { name: "Use my camera", exact: true })
        .click();
      await box(p)
        .getByRole("status")
        .filter({ hasText: /unavailable/ })
        .waitFor({ timeout: 45000 });
      await stopped(p);
      await box(p)
        .getByRole("button", { name: "Look left", exact: true })
        .click();
      assert.equal(await box(p).getAttribute("data-source"), "pointer");
    }
  },
);

test(
  "Off while the real model download is pending cancels the worker and late response",
  { timeout: 60000 },
  async () => {
    const { p, c } = await open("real");
    let arrived!: () => void, release!: () => void;
    const requested = new Promise<void>((resolve) => {
      arrived = resolve;
    });
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    await c.route("**/face_landmarker.task", async (route) => {
      arrived();
      await held;
      try {
        await route.fulfill({
          path: `public/vendor/peep-box/${manifest.version}/face_landmarker.task`,
        });
      } catch {
        /* terminated workers can cancel the response before fulfilment */
      }
    });
    await activate(p);
    await box(p)
      .getByRole("button", { name: "Use my camera", exact: true })
      .click();
    await requested;
    assert.equal(await box(p).getAttribute("data-camera"), "loading");
    await box(p)
      .getByRole("button", { name: "Turn camera off", exact: true })
      .click();
    await stopped(p);
    release();
    await box(p)
      .getByRole("button", { name: "Look right", exact: true })
      .click();
    assert.equal(await box(p).getAttribute("data-source"), "pointer");
    assert.equal(await box(p).getAttribute("data-camera"), "idle");
    assert.equal(
      await p.evaluate(
        () => (window as unknown as { terminated: number }).terminated,
      ),
      1,
    );
  },
);

test(
  "missing camera and initial reduced motion retain a static/pointer view without assets",
  { timeout: 60000 },
  async () => {
    const { p, c, requests } = await open("real");
    await c.addInitScript(() =>
      Object.defineProperty(navigator, "mediaDevices", {
        configurable: true,
        value: undefined,
      }),
    );
    await activate(p);
    await box(p)
      .getByRole("button", { name: "Use my camera", exact: true })
      .click();
    await box(p)
      .getByRole("status")
      .filter({ hasText: /unavailable/ })
      .waitFor();
    assert.equal(
      requests.some((r) => /vendor\/peep-box|mediapipe|\.wasm/.test(r.url)),
      false,
    );
    await p.emulateMedia({ reducedMotion: "reduce" });
    await box(p)
      .getByText("Motion is reduced. Enjoy the still paper scene.")
      .waitFor();
    assert.equal(
      await box(p)
        .getByRole("button", { name: "Use my camera", exact: true })
        .count(),
      0,
    );
    assert.equal(
      await p.evaluate(
        () => (window as unknown as { cameraCalls: number }).cameraCalls,
      ),
      0,
    );
  },
);
