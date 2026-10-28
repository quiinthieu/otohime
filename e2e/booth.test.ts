import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { after, before, test } from "node:test";
import {
  chromium,
  type Browser,
  type BrowserContext,
  type BrowserContextOptions,
  type Page,
} from "playwright-core";
import { dbToGain, MAX_DB } from "../lib/sound.ts";
import { collectBrowserErrors } from "./console-errors.ts";

if (
  !process.env.OTOHIME_E2E_SUBPROCESS &&
  process.argv.some(
    (arg) =>
      /(?:^|[\\/])playwright(?:\.js|-core)?$/i.test(arg) ||
      arg.includes("playwright/cli"),
  )
) {
  const args = process.env.BASE_URL
    ? [
        "--experimental-strip-types",
        "--disable-warning=ExperimentalWarning",
        "--disable-warning=MODULE_TYPELESS_PACKAGE_JSON",
        "--test",
        "e2e/booth.test.ts",
      ]
    : [
        "--experimental-strip-types",
        "--disable-warning=ExperimentalWarning",
        "--disable-warning=MODULE_TYPELESS_PACKAGE_JSON",
        "scripts/e2e.mjs",
        "--test",
        "e2e/booth.test.ts",
      ];
  const res = spawnSync(process.execPath, args, {
    stdio: "inherit",
    env: {
      ...process.env,
      OTOHIME_E2E_SUBPROCESS: "1",
      TMPDIR: process.env.TMPDIR || "/tmp",
    },
  });
  spawnSync("git", ["checkout", "--", "content/history.json"], {
    stdio: "ignore",
  });
  rmSync("test-results", { recursive: true, force: true });
  process.exit(res.status ?? 1);
}

const BASE = process.env.BASE_URL ?? "http://localhost:4000";
let browser: Browser;
const contexts: BrowserContext[] = [];
const tmp = mkdtempSync("/tmp/booth-e2e-");

before(async () => {
  const env = { ...process.env, TMPDIR: tmp };
  if (process.env.CHROME_PATH) {
    browser = await chromium.launch({
      executablePath: process.env.CHROME_PATH,
      env,
    });
  } else {
    try {
      browser = await chromium.launch({ channel: "chrome", env });
    } catch {
      browser = await chromium.launch({ env });
    }
  }
});

after(async () => {
  for (const c of contexts) await c.close();
  await browser?.close();
  rmSync(tmp, { recursive: true, force: true });
});

interface OpenBoothOptions extends BrowserContextOptions {
  cameraMode?: "fake" | "denied";
}

async function open(options: OpenBoothOptions = {}) {
  const { cameraMode = "fake", ...contextOptions } = options;
  const context = await browser.newContext({
    viewport: { width: 1366, height: 768 },
    ...contextOptions,
  });
  contexts.push(context);

  await context.addInitScript(
    ({ mode }) => {
      const tracker = {
        cameraCalls: 0,
        tracksCreated: 0,
        tracksStopped: 0,
        activeTracks: 0,
        constraints: [] as unknown[],
        audioContexts: 0,
        oscillators: 0,
        maxGain: 0,
        printCalls: 0,
      };
      Object.assign(window, { __boothTracker: tracker });

      window.print = () => {
        tracker.printCalls++;
      };

      if (!navigator.mediaDevices) {
        Object.defineProperty(navigator, "mediaDevices", {
          configurable: true,
          value: {},
        });
      }

      navigator.mediaDevices.getUserMedia = async (constraints) => {
        tracker.cameraCalls++;
        tracker.constraints.push(constraints);
        if (mode === "denied") {
          throw new DOMException("Permission denied", "NotAllowedError");
        }
        const canvas = document.createElement("canvas");
        canvas.width = 320;
        canvas.height = 240;
        const ctx = canvas.getContext("2d")!;
        let tick = 0;
        const drawCard = () => {
          tick++;
          ctx.fillStyle = "#f2ebe0";
          ctx.fillRect(0, 0, 320, 240);
          ctx.fillStyle = "#d63850";
          ctx.beginPath();
          ctx.arc(160 + ((tick % 5) - 2) * 8, 110, 56, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#182838";
          ctx.fillRect(72, 168, 176, 52);
          ctx.fillStyle = "#faf6ee";
          ctx.fillRect(130, 86, 18, 18);
          ctx.fillRect(172, 86, 18, 18);
        };
        drawCard();
        const stream = canvas.captureStream(15);
        const timer = setInterval(drawCard, 60);
        for (const track of stream.getTracks()) {
          tracker.tracksCreated++;
          tracker.activeTracks++;
          const origStop = track.stop.bind(track);
          let stopped = false;
          track.stop = () => {
            if (!stopped) {
              stopped = true;
              tracker.tracksStopped++;
              tracker.activeTracks = Math.max(0, tracker.activeTracks - 1);
              clearInterval(timer);
            }
            origStop();
          };
        }
        return stream;
      };

      const RealAudioContext = window.AudioContext;
      if (typeof RealAudioContext === "function") {
        window.AudioContext = class extends RealAudioContext {
          constructor() {
            super();
            tracker.audioContexts++;
          }
          createOscillator() {
            tracker.oscillators++;
            return super.createOscillator();
          }
          createGain() {
            const g = super.createGain();
            const origSet = g.gain.setValueAtTime.bind(g.gain);
            const origRamp = g.gain.linearRampToValueAtTime.bind(g.gain);
            g.gain.setValueAtTime = (value: number, startTime: number) => {
              if (value > tracker.maxGain) tracker.maxGain = value;
              return origSet(value, startTime);
            };
            g.gain.linearRampToValueAtTime = (
              value: number,
              endTime: number,
            ) => {
              if (value > tracker.maxGain) tracker.maxGain = value;
              return origRamp(value, endTime);
            };
            return g;
          }
        };
      }
    },
    { mode: cameraMode },
  );

  const page = await context.newPage();
  page.setDefaultTimeout(15_000);
  const errors = collectBrowserErrors(BASE);
  const networkRequests: {
    url: string;
    method: string;
    resourceType: string;
    postData: string | null;
  }[] = [];

  page.on("request", (req) => {
    networkRequests.push({
      url: req.url(),
      method: req.method(),
      resourceType: req.resourceType(),
      postData: req.postData(),
    });
  });
  page.on("pageerror", (e) => errors.pageError(e.message));
  page.on("response", (response) =>
    errors.response({
      url: response.url(),
      status: response.status(),
      method: response.request().method(),
      resourceType: response.request().resourceType(),
    }),
  );
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    const loc = m.location();
    errors.console({
      text: m.text(),
      url: loc.url,
      line: loc.lineNumber,
      column: loc.columnNumber,
      args: m.args().length,
    });
  });

  return { page, context, errors, networkRequests };
}

function assertZeroImageUploads(
  networkRequests: {
    url: string;
    method: string;
    resourceType: string;
    postData: string | null;
  }[],
) {
  const uploads = networkRequests.filter(
    (r) =>
      r.method !== "GET" &&
      r.method !== "HEAD" &&
      (r.url.includes("booth") ||
        r.url.includes("upload") ||
        (r.postData &&
          (r.postData.includes("image/png") ||
            r.postData.includes("PNG") ||
            r.postData.length > 2048))),
  );
  assert.deepEqual(
    uploads,
    [],
    `Expected zero network image uploads, saw: ${JSON.stringify(uploads)}`,
  );
}

test("/play/booth serves Permissions-Policy camera=(self), microphone=(), renders privacy notice, waits for opt-in before getUserMedia, runs 3-2-1 countdown with shutter clack, and stops camera tracks after 4th frame", async () => {
  const { page, errors, networkRequests } = await open({ cameraMode: "fake" });

  // Verify Permissions-Policy header on both /play and /play/booth
  const playRes = await page.goto(`${BASE}/play`);
  assert.equal(
    playRes?.headers()["permissions-policy"],
    "camera=(self), microphone=()",
  );

  const boothRes = await page.goto(`${BASE}/play/booth`);
  assert.equal(
    boothRes?.headers()["permissions-policy"],
    "camera=(self), microphone=()",
  );

  const studio = page.locator(
    '[data-testid="booth-studio"][data-hydrated="true"]',
  );
  await studio.waitFor({ state: "visible" });

  // Privacy notice is prominently shown and camera is NOT requested before opt-in click
  assert.equal(
    await page.locator('[data-testid="booth-privacy-notice"]').innerText(),
    "Your camera stays in this tab. Nothing is uploaded.",
  );
  assert.equal(await studio.getAttribute("data-camera-state"), "idle");

  let tracker = await page.evaluate(
    () =>
      (
        window as unknown as {
          __boothTracker: {
            cameraCalls: number;
            tracksCreated: number;
            tracksStopped: number;
            activeTracks: number;
            constraints: unknown[];
            audioContexts: number;
            oscillators: number;
            maxGain: number;
          };
        }
      ).__boothTracker,
  );
  assert.equal(
    tracker.cameraCalls,
    0,
    "getUserMedia must not be called before clicking Open camera",
  );
  assert.equal(
    tracker.audioContexts,
    0,
    "No AudioContext before user enables sound",
  );

  // Opt-in to camera
  await page.locator('[data-testid="booth-open-camera"]').click();
  await page.waitForFunction(
    () =>
      document
        .querySelector('[data-testid="booth-studio"]')
        ?.getAttribute("data-camera-state") === "streaming",
  );

  tracker = await page.evaluate(
    () =>
      (
        window as unknown as {
          __boothTracker: {
            cameraCalls: number;
            tracksCreated: number;
            tracksStopped: number;
            activeTracks: number;
            constraints: unknown[];
            audioContexts: number;
            oscillators: number;
            maxGain: number;
          };
        }
      ).__boothTracker,
  );
  assert.equal(tracker.cameraCalls, 1);
  assert.equal(tracker.activeTracks, 1);
  assert.deepEqual(tracker.constraints[0], {
    video: { facingMode: "user", width: { ideal: 960 } },
    audio: false,
  });

  // Enable sound toggle so the 4 shutter clacks + 1 hanko stamp play via WebAudio
  const soundToggle = page.locator('[data-testid="booth-sound-toggle"]');
  assert.equal(await soundToggle.getAttribute("aria-pressed"), "false");
  await soundToggle.click();
  assert.equal(await soundToggle.getAttribute("aria-pressed"), "true");

  // Run the 4-frame 3-2-1 capture sequence
  await page.locator('[data-testid="booth-capture-btn"]').click();

  // Wait for all 4 shots to finish and camera tracks to stop automatically on the 4th frame
  await page.waitForFunction(
    () =>
      document
        .querySelector('[data-testid="booth-studio"]')
        ?.getAttribute("data-camera-state") === "completed" &&
      document
        .querySelector('[data-testid="booth-studio"]')
        ?.getAttribute("data-capturing") === "false",
  );

  assert.equal(await studio.getAttribute("data-stream-active"), "false");
  assert.equal(await studio.getAttribute("data-shutter-count"), "4");
  assert.equal(
    await studio.getAttribute("data-countdown-log"),
    "3,2,1,shutter,3,2,1,shutter,3,2,1,shutter,3,2,1,shutter",
  );

  const liveStatus = page.locator('[data-testid="booth-live-status"]');
  assert.equal(await liveStatus.getAttribute("aria-live"), "polite");
  assert.match(
    await liveStatus.innerText(),
    /Captured 4 of 4 frames.*Camera tracks stopped/i,
  );

  tracker = await page.evaluate(
    () =>
      (
        window as unknown as {
          __boothTracker: {
            cameraCalls: number;
            tracksCreated: number;
            tracksStopped: number;
            activeTracks: number;
            constraints: unknown[];
            audioContexts: number;
            oscillators: number;
            maxGain: number;
          };
        }
      ).__boothTracker,
  );
  assert.equal(
    tracker.activeTracks,
    0,
    "All MediaStreamTracks must stop immediately after the 4th capture",
  );
  assert.equal(tracker.tracksStopped, tracker.tracksCreated);
  assert.equal(tracker.audioContexts, 1);
  assert.ok(
    tracker.oscillators >= 20,
    `Expected WebAudio shutter clack oscillators across 4 shots, got ${tracker.oscillators}`,
  );
  assert.ok(
    tracker.maxGain <= dbToGain(MAX_DB) + 1e-6,
    `Peak gain ${tracker.maxGain} exceeded MAX_DB (${MAX_DB} dB)`,
  );

  assertZeroImageUploads(networkRequests);
  assert.deepEqual(errors.unexpected, []);
});

test("denied camera permission and explicit 'Use sample portrait' button fall back cleanly to procedural paper portrait and render the 600x1800 torn-paper strip", async () => {
  const { page, errors, networkRequests } = await open({
    cameraMode: "denied",
  });
  await page.goto(`${BASE}/play/booth`);

  const studio = page.locator(
    '[data-testid="booth-studio"][data-hydrated="true"]',
  );
  await studio.waitFor({ state: "visible" });

  // Clicking Open camera when permission is denied automatically switches to sample portrait
  await page.locator('[data-testid="booth-open-camera"]').click();
  await page.waitForFunction(
    () =>
      document
        .querySelector('[data-testid="booth-studio"]')
        ?.getAttribute("data-camera-state") === "sample",
  );
  assert.equal(
    await studio.getAttribute("data-fallback-reason"),
    "NotAllowedError",
  );
  assert.equal(await studio.getAttribute("data-stream-active"), "false");
  assert.match(
    await page.locator('[data-testid="booth-live-status"]').innerText(),
    /using sample paper portrait/i,
  );

  // Explicit 'Use sample portrait' button also sets sample mode cleanly
  await page.locator('[data-testid="booth-use-sample"]').click();
  assert.equal(await studio.getAttribute("data-camera-state"), "sample");
  assert.equal(
    await studio.getAttribute("data-fallback-reason"),
    "manual_sample",
  );

  // Inspect the 600x1800 torn-paper strip canvas geometry, transparent torn exterior, opaque interior, hanko date, and footer
  const stripMetrics = await page
    .locator('[data-testid="booth-strip-canvas"]')
    .evaluate((el) => {
      const canvas = el as HTMLCanvasElement;
      const ctx = canvas.getContext("2d")!;
      const topLeft = ctx.getImageData(0, 0, 1, 1).data;
      const center = ctx.getImageData(300, 900, 1, 1).data;
      return {
        width: canvas.width,
        height: canvas.height,
        hankoDate: canvas.getAttribute("data-hanko-date"),
        footerText: canvas.getAttribute("data-footer-text"),
        topLeftAlpha: topLeft[3],
        centerAlpha: center[3],
      };
    });

  assert.equal(stripMetrics.width, 600);
  assert.equal(stripMetrics.height, 1800);
  assert.match(stripMetrics.hankoDate ?? "", /^\d{4}\.\d{2}\.\d{2}$/);
  assert.equal(stripMetrics.footerText, "otohime.dev");
  assert.equal(
    stripMetrics.topLeftAlpha,
    0,
    "Corner outside torn-paper polygon mask is transparent",
  );
  assert.equal(
    stripMetrics.centerAlpha,
    255,
    "Interior of torn-paper strip is opaque",
  );

  assertZeroImageUploads(networkRequests);
  assert.deepEqual(errors.unexpected, []);
});

test("film-stock switching ('sumi-e', 'riso', 'newsprint') updates live viewfinder and strip pixels distinctly and handles webglcontextlost", async () => {
  const { page, errors } = await open();
  await page.goto(`${BASE}/play/booth`);

  const studio = page.locator(
    '[data-testid="booth-studio"][data-hydrated="true"]',
  );
  await studio.waitFor({ state: "visible" });

  async function sampleViewfinderStats() {
    return page
      .locator('[data-testid="booth-viewfinder-canvas"]')
      .evaluate((el) => {
        const c = el as HTMLCanvasElement;
        const data = c.getContext("2d")!.getImageData(0, 0, c.width, c.height).data;
        let chroma = 0;
        let sum = 0;
        const step = 16;
        const samples: number[] = [];
        for (let i = 0; i < data.length; i += step) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          chroma += Math.abs(r - g) + Math.abs(g - b) + Math.abs(r - b);
          sum += r + g + b;
          samples.push(r, g, b);
        }
        return {
          meanChroma: chroma / (data.length / step),
          meanSum: sum / (data.length / step),
          samples,
        };
      });
  }

  function diffSamples(a: number[], b: number[]): number {
    let d = 0;
    for (let i = 0; i < a.length; i++) d += Math.abs(a[i] - b[i]);
    return d / a.length;
  }

  assert.equal(await studio.getAttribute("data-film-stock"), "sumi-e");
  const sumiStats = await sampleViewfinderStats();

  // Switch to Riso Two-Tone
  await page.locator('[data-testid="stock-riso"]').click();
  assert.equal(await studio.getAttribute("data-film-stock"), "riso");
  const risoStats = await sampleViewfinderStats();

  // Switch to Newsprint 45°
  await page.locator('[data-testid="stock-newsprint"]').click();
  assert.equal(await studio.getAttribute("data-film-stock"), "newsprint");
  const newsStats = await sampleViewfinderStats();

  assert.ok(
    diffSamples(sumiStats.samples, risoStats.samples) > 10,
    "sumi-e and riso viewfinder pixels differ significantly",
  );
  assert.ok(
    diffSamples(sumiStats.samples, newsStats.samples) > 8,
    "sumi-e and newsprint viewfinder pixels differ significantly",
  );
  assert.ok(
    diffSamples(risoStats.samples, newsStats.samples) > 12,
    "riso and newsprint viewfinder pixels differ significantly",
  );
  assert.ok(
    risoStats.meanChroma > sumiStats.meanChroma * 2.5,
    `Expected riso two-colour chroma (${risoStats.meanChroma}) > 2.5x sumi-e (${sumiStats.meanChroma})`,
  );

  // Negative control: dispatch webglcontextlost on viewfinder canvas -> falls back to canvas2d kernel without blanking
  await page.locator('[data-testid="booth-viewfinder-canvas"]').evaluate((el) => {
    const evt = new Event("webglcontextlost", { cancelable: true });
    el.dispatchEvent(evt);
  });
  assert.equal(await studio.getAttribute("data-renderer-backend"), "canvas2d");

  await page.locator('[data-testid="stock-sumi-e"]').click();
  const afterLossStats = await sampleViewfinderStats();
  assert.ok(
    afterLossStats.meanSum > 50,
    "Viewfinder remains non-blank after webglcontextlost fallback",
  );

  assert.deepEqual(errors.unexpected, []);
});

test("purikura ink pen strokes, stickers, transform controls, undo, clear, PNG magic-byte download, and @media print 5x15cm layout", async () => {
  const { page, errors, networkRequests } = await open();
  await page.goto(`${BASE}/play/booth`);

  const studio = page.locator(
    '[data-testid="booth-studio"][data-hydrated="true"]',
  );
  await studio.waitFor({ state: "visible" });

  async function getStripChecksum(): Promise<number> {
    return page
      .locator('[data-testid="booth-strip-canvas"]')
      .evaluate((el) => {
        const c = el as HTMLCanvasElement;
        const data = c.getContext("2d")!.getImageData(0, 0, c.width, c.height).data;
        let hash = 2166136261;
        for (let i = 0; i < data.length; i += 64) {
          hash ^= data[i];
          hash = Math.imul(hash, 16777619) >>> 0;
        }
        return hash >>> 0;
      });
  }

  const baseChecksum = await getStripChecksum();
  assert.equal(await studio.getAttribute("data-stroke-count"), "0");
  assert.equal(await studio.getAttribute("data-sticker-count"), "0");

  // 1) Select indigo ink + 12px brush and draw a stroke on the strip canvas
  await page.locator('[data-testid="ink-color-indigo"]').click();
  await page.locator('[data-testid="brush-width-12"]').click();

  const stripCanvas = page.locator('[data-testid="booth-strip-canvas"]');
  await stripCanvas.evaluate((el) => el.scrollIntoView({ block: "center" }));
  const box = await stripCanvas.boundingBox();
  assert.ok(box, "strip canvas has bounding box");
  await page.mouse.move(box.x + box.width * 0.25, box.y + box.height * 0.45);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.75, box.y + box.height * 0.5, {
    steps: 5,
  });
  await page.mouse.up();

  assert.equal(await studio.getAttribute("data-stroke-count"), "1");
  const afterStrokeChecksum = await getStripChecksum();
  assert.notEqual(
    afterStrokeChecksum,
    baseChecksum,
    "Pen stroke visibly alters the 600x1800 strip canvas pixels",
  );

  // 2) Add a heart sticker, then transform (move, scale, rotate) it
  await page.locator('[data-testid="add-sticker-heart"]').click();
  assert.equal(await studio.getAttribute("data-sticker-count"), "1");
  const afterStickerChecksum = await getStripChecksum();
  assert.notEqual(
    afterStickerChecksum,
    afterStrokeChecksum,
    "Adding sticker alters the 600x1800 strip canvas pixels",
  );

  await page.locator('[data-testid="sticker-scale-up"]').click();
  await page.locator('[data-testid="sticker-rotate-right"]').click();
  const afterTransformChecksum = await getStripChecksum();
  assert.notEqual(afterTransformChecksum, afterStickerChecksum);

  // 3) Undo twice (reverts rotate & scale), then Undo sticker placement, then Undo pen stroke -> back to baseChecksum
  const undoBtn = page.locator('[data-testid="booth-undo"]');
  await undoBtn.click();
  await undoBtn.click();
  assert.equal(await getStripChecksum(), afterStickerChecksum);

  await undoBtn.click();
  assert.equal(await studio.getAttribute("data-sticker-count"), "0");
  assert.equal(await getStripChecksum(), afterStrokeChecksum);

  await undoBtn.click();
  assert.equal(await studio.getAttribute("data-stroke-count"), "0");
  assert.equal(
    await getStripChecksum(),
    baseChecksum,
    "Undoing all decorations restores exact initial strip pixels",
  );

  // 4) Add flourish stroke + star sticker so exported PNG contains purikura decorations
  await page.locator('[data-testid="booth-draw-flourish"]').click();
  await page.locator('[data-testid="add-sticker-star"]').click();
  assert.equal(await studio.getAttribute("data-stroke-count"), "1");
  assert.equal(await studio.getAttribute("data-sticker-count"), "1");

  // 5) Download PNG and verify magic bytes + IHDR 600x1800 dimensions
  const downloadPromise = page.waitForEvent("download");
  await page.locator('[data-testid="booth-download-png"]').click();
  const download = await downloadPromise;

  const suggestedName = download.suggestedFilename();
  assert.match(suggestedName, /^otohime-booth-\d{8}\.png$/);

  const downloadPath = await download.path();
  assert.ok(downloadPath, "Download saved to local path");
  const pngBytes = readFileSync(downloadPath);

  // PNG 8-byte magic header: 89 50 4E 47 0D 0A 1A 0A
  assert.deepEqual(
    [...pngBytes.subarray(0, 8)],
    [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
    "Downloaded file starts with valid PNG magic bytes",
  );
  // IHDR chunk width (bytes 16..19) = 600, height (bytes 20..23) = 1800
  const pngWidth = pngBytes.readUInt32BE(16);
  const pngHeight = pngBytes.readUInt32BE(20);
  assert.equal(pngWidth, 600);
  assert.equal(pngHeight, 1800);

  // 6) Verify Print strip button and @media print ~5x15cm stylesheet
  await page.locator('[data-testid="booth-print-strip"]').click();
  assert.equal(await studio.getAttribute("data-print-count"), "1");

  await page.emulateMedia({ media: "print" });
  const printLayout = await page.evaluate(() => {
    const status = document.querySelector<HTMLElement>(
      '[data-testid="booth-status-bar"]',
    )!;
    const vfPanel = document.querySelector<HTMLElement>(
      ".booth-viewfinder-panel",
    )!;
    const stripCanvasEl = document.querySelector<HTMLElement>(
      '[data-testid="booth-strip-canvas"]',
    )!;
    const rect = stripCanvasEl.getBoundingClientRect();
    return {
      statusDisplay: getComputedStyle(status).display,
      vfDisplay: getComputedStyle(vfPanel).display,
      stripWidthPx: rect.width,
      stripHeightPx: rect.height,
    };
  });
  assert.equal(
    printLayout.statusDisplay,
    "none",
    "UI status bar hidden in @media print",
  );
  assert.equal(
    printLayout.vfDisplay,
    "none",
    "Viewfinder panel hidden in @media print",
  );
  // 5cm at 96dpi is ~188.98px; 15cm at 96dpi is ~566.93px
  assert.ok(
    printLayout.stripWidthPx >= 175 && printLayout.stripWidthPx <= 205,
    `Expected ~5cm (~189px) print width, got ${printLayout.stripWidthPx}`,
  );
  assert.ok(
    printLayout.stripHeightPx >= 530 && printLayout.stripHeightPx <= 600,
    `Expected ~15cm (~567px) print height, got ${printLayout.stripHeightPx}`,
  );
  await page.emulateMedia({ media: "screen" });

  // 7) Clear doodles button removes strokes and stickers
  await page.locator('[data-testid="booth-clear"]').click();
  assert.equal(await studio.getAttribute("data-stroke-count"), "0");
  assert.equal(await studio.getAttribute("data-sticker-count"), "0");

  assertZeroImageUploads(networkRequests);
  assert.deepEqual(errors.unexpected, []);
});

test("prefers-reduced-motion suppresses ink-flash keyframe animations while keeping the 3-2-1 countdown and static click indicator", async () => {
  const { page, errors } = await open({ reducedMotion: "reduce" });
  await page.goto(`${BASE}/play/booth`);

  const studio = page.locator(
    '[data-testid="booth-studio"][data-hydrated="true"]',
  );
  await studio.waitFor({ state: "visible" });
  assert.equal(await studio.getAttribute("data-reduced-motion"), "true");

  const staticIndicator = page.locator(
    '[data-testid="booth-static-click-indicator"]',
  );
  await staticIndicator.waitFor({ state: "visible" });

  const flashStyles = await page
    .locator('[data-testid="booth-ink-flash"]')
    .evaluate((el) => ({
      animationName: getComputedStyle(el).animationName,
      transitionDuration: getComputedStyle(el).transitionDuration,
      runningAnimations: el.getAnimations({ subtree: true }).length,
    }));
  assert.equal(flashStyles.animationName, "none");
  assert.equal(flashStyles.runningAnimations, 0);

  // Run 4-shot capture under reduced motion and verify 3-2-1 countdown still runs with 0 animations
  await page.locator('[data-testid="booth-capture-btn"]').click();
  await page.waitForFunction(
    () =>
      document
        .querySelector('[data-testid="booth-studio"]')
        ?.getAttribute("data-shutter-count") === "4" &&
      document
        .querySelector('[data-testid="booth-studio"]')
        ?.getAttribute("data-capturing") === "false",
  );

  assert.equal(
    await studio.getAttribute("data-countdown-log"),
    "3,2,1,shutter,3,2,1,shutter,3,2,1,shutter,3,2,1,shutter",
  );
  assert.match(await staticIndicator.innerText(), /SHUTTER · 4 CLACKS/);

  const totalRunningAnimations = await studio.evaluate(
    (el) => el.getAnimations({ subtree: true }).length,
  );
  assert.equal(totalRunningAnimations, 0);
  assert.deepEqual(errors.unexpected, []);
});

async function assertStrictlyInViewport(
  page: Page,
  testId: string,
  viewportHeight: number,
  viewportWidth: number,
) {
  const rect = await page.locator(`[data-testid="${testId}"]`).evaluate((el) => {
    const r = el.getBoundingClientRect();
    return {
      top: r.top,
      bottom: r.bottom,
      left: r.left,
      right: r.right,
      width: r.width,
      height: r.height,
    };
  });
  assert.ok(
    rect.width > 0 && rect.height > 0,
    `Expected ${testId} to have positive dimensions, got ${JSON.stringify(rect)}`,
  );
  assert.ok(
    rect.top >= 0 && rect.bottom <= viewportHeight,
    `Expected ${testId} vertical bounds inside [0, ${viewportHeight}], got top=${rect.top}, bottom=${rect.bottom}`,
  );
  assert.ok(
    rect.left >= 0 && rect.right <= viewportWidth,
    `Expected ${testId} horizontal bounds inside [0, ${viewportWidth}], got left=${rect.left}, right=${rect.right}`,
  );
}

test("390x844 mobile and 1366x768 desktop viewports suppress .rise transform and keep sticky status controls strictly in viewport without horizontal overflow", async () => {
  // 1) 390x844 mobile viewport
  const { page: mobilePage, errors: mobileErrors } = await open({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  await mobilePage.goto(`${BASE}/play/booth`);

  const mobileStudio = mobilePage.locator(
    '[data-testid="booth-studio"][data-hydrated="true"]',
  );
  await mobileStudio.waitFor({ state: "visible" });

  const mobileRiseStyles = await mobilePage.evaluate(() => {
    const rise = document.querySelector(".rise:has(.booth-root)")!;
    const cs = getComputedStyle(rise);
    return {
      transform: cs.transform,
      translate: cs.translate,
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
    };
  });
  assert.equal(mobileRiseStyles.transform, "none");
  assert.equal(mobileRiseStyles.translate, "none");
  assert.ok(
    mobileRiseStyles.scrollWidth <= mobileRiseStyles.innerWidth,
    `Expected zero horizontal overflow on 390x844 mobile, got scrollWidth=${mobileRiseStyles.scrollWidth} > innerWidth=${mobileRiseStyles.innerWidth}`,
  );

  // Scroll down to the export bar at the bottom of the mobile page and verify sticky status bar remains strictly inside [0, 844]
  await mobilePage
    .locator('[data-testid="booth-export-bar"]')
    .scrollIntoViewIfNeeded();
  await assertStrictlyInViewport(mobilePage, "booth-status-bar", 844, 390);
  await assertStrictlyInViewport(mobilePage, "booth-capture-btn", 844, 390);
  await assertStrictlyInViewport(mobilePage, "booth-export-bar", 844, 390);
  assert.deepEqual(mobileErrors.unexpected, []);

  // 2) 1366x768 desktop viewport
  const { page: desktopPage, errors: desktopErrors } = await open({
    viewport: { width: 1366, height: 768 },
  });
  await desktopPage.goto(`${BASE}/play/booth`);

  const desktopStudio = desktopPage.locator(
    '[data-testid="booth-studio"][data-hydrated="true"]',
  );
  await desktopStudio.waitFor({ state: "visible" });

  await desktopPage
    .locator('[data-testid="booth-export-bar"]')
    .scrollIntoViewIfNeeded();
  await assertStrictlyInViewport(desktopPage, "booth-status-bar", 768, 1366);
  await assertStrictlyInViewport(desktopPage, "booth-capture-btn", 768, 1366);
  await assertStrictlyInViewport(desktopPage, "booth-export-bar", 768, 1366);
  assert.deepEqual(desktopErrors.unexpected, []);
});
