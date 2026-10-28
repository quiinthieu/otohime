// Standalone verifier for the Ink Purikura Photobooth engine (/play/booth):
// - Film-stock WebGL2 shaders + deterministic Canvas 2D ImageData kernels (sumi-e, riso, newsprint)
// - Seeded torn-paper 600x1800 strip composer with date hanko stamp (YYYY.MM.DD) and 'otohime.dev' footer
// - Vector purikura decoration model (ink pen strokes, eraser, stickers, undo, clear)
// - Procedural sample portrait generator + opt-in camera lifecycle controller (4th-shot & abort track cleanup)
// - WebAudio shutter-clack cue in lib/sound.ts (<= -18 dB cap, silent when muted)

import assert from "node:assert/strict";
import {
  applyFilmStockKernel,
  BOOTH_FRAGMENT_SHADER_SOURCE,
  BOOTH_VERTEX_SHADER_SOURCE,
  createFilmStockRenderer,
  FILM_STOCK_IDS,
  isFilmStockId,
} from "../lib/booth/film-stock.ts";
import {
  generateSamplePortrait,
  generateSamplePortraitFrames,
} from "../lib/booth/sample-portrait.ts";
import {
  BOOTH_CAMERA_CONSTRAINTS,
  BOOTH_PRIVACY_COPY,
  createBoothCameraController,
  MAX_BOOTH_CAPTURES,
} from "../lib/booth/camera.ts";
import {
  addEraserStroke,
  addPenStroke,
  addSticker,
  clearDecorations,
  composeStripBuffer,
  computeStripLayout,
  createDecorationState,
  createTornPaperPolygon,
  DEFAULT_STRIP_SEED,
  formatBoothDownloadFilename,
  formatHankoDate,
  STRIP_FRAME_COUNT,
  STRIP_HEIGHT,
  STRIP_WIDTH,
  undoDecoration,
  updateSticker,
} from "../lib/booth/strip.ts";
import {
  CUES,
  cueGain,
  dbToGain,
  MAX_DB,
  SHUTTER,
  shutterClackSamples,
} from "../lib/sound.ts";
import { play, setSound } from "../lib/sound-client.ts";

// 1. Verify shutter-clack cue in lib/sound.ts and mute negative control
assert.equal(CUES.shutter, SHUTTER);
assert.ok(cueGain(CUES.shutter) <= dbToGain(MAX_DB) + 1e-12, "Shutter cue must not exceed -18 dB");
const samples = shutterClackSamples();
assert.ok(samples.length > 0 && Math.max(...samples.map(Math.abs)) <= dbToGain(MAX_DB) + 1e-6);

let audioContextsCreated = 0;
Object.assign(globalThis, {
  AudioContext: class {
    constructor() {
      audioContextsCreated++;
    }
  },
  localStorage: { getItem: () => null, setItem: () => {} },
  addEventListener: () => {},
  removeEventListener: () => {},
});
setSound(false);
play("shutter");
assert.equal(audioContextsCreated, 0, "Negative control: muted shutter cue opens zero AudioContexts");

// 2. Verify film-stock definitions, WebGL2 shaders, and distinct non-blank pixel outputs
assert.deepEqual(FILM_STOCK_IDS, ["sumi-e", "riso", "newsprint"]);
assert.equal(isFilmStockId("sumi-e"), true);
assert.equal(isFilmStockId("invalid-stock"), false, "Negative control: unknown film stock rejected");
assert.match(BOOTH_VERTEX_SHADER_SOURCE, /#version 300 es/);
assert.match(BOOTH_FRAGMENT_SHADER_SOURCE, /#version 300 es/);

const portrait = generateSamplePortrait({ width: 160, height: 120, poseIndex: 0 });
const outputs = Object.fromEntries(
  FILM_STOCK_IDS.map((id) => [id, applyFilmStockKernel(portrait, id, { seed: 101 })]),
);

for (const id of FILM_STOCK_IDS) {
  const buf = outputs[id];
  assert.equal(buf.width, 160);
  assert.equal(buf.height, 120);
  assert.deepEqual(
    buf.data,
    applyFilmStockKernel(portrait, id, { seed: 101 }).data,
    `${id} kernel must be deterministic`,
  );
  let minL = 255;
  let maxL = 0;
  for (let i = 0; i < buf.data.length; i += 4) {
    const l = 0.299 * buf.data[i] + 0.587 * buf.data[i + 1] + 0.114 * buf.data[i + 2];
    if (l < minL) minL = l;
    if (l > maxL) maxL = l;
    assert.equal(buf.data[i + 3], 255);
  }
  assert.ok(maxL - minL > 120, `${id} output must be non-blank with wide tonal range`);
}

function pairDiff(a, b) {
  let sum = 0;
  for (let i = 0; i < a.data.length; i++) sum += Math.abs(a.data[i] - b.data[i]);
  return sum / a.data.length;
}
assert.ok(pairDiff(outputs["sumi-e"], outputs.riso) > 18, "sumi-e vs riso must be distinct");
assert.ok(pairDiff(outputs["sumi-e"], outputs.newsprint) > 12, "sumi-e vs newsprint must be distinct");
assert.ok(pairDiff(outputs.riso, outputs.newsprint) > 20, "riso vs newsprint must be distinct");

// Verify WebGL2 renderer fallback on context loss
const renderer = createFilmStockRenderer(null);
assert.equal(renderer.backend, "canvas2d");
assert.deepEqual(
  renderer.render(portrait, "sumi-e", { seed: 101 }).data,
  outputs["sumi-e"].data,
);

// 3. Verify seeded torn-paper mask determinism and 600x1800 4-frame strip layout
const poly1 = createTornPaperPolygon(STRIP_WIDTH, STRIP_HEIGHT, DEFAULT_STRIP_SEED);
const poly2 = createTornPaperPolygon(STRIP_WIDTH, STRIP_HEIGHT, DEFAULT_STRIP_SEED);
const poly3 = createTornPaperPolygon(STRIP_WIDTH, STRIP_HEIGHT, DEFAULT_STRIP_SEED + 1);
assert.deepEqual(poly1, poly2, "Torn-paper polygon must be deterministic for same seed");
assert.notDeepEqual(poly1, poly3, "Torn-paper polygon must vary across seeds");

const layout = computeStripLayout({ seed: DEFAULT_STRIP_SEED, date: "2026-10-28", stock: "sumi-e" });
assert.equal(layout.width, 600);
assert.equal(layout.height, 1800);
assert.equal(layout.frames.length, STRIP_FRAME_COUNT);
assert.equal(layout.hanko.dateText, "2026.10.28");
assert.equal(layout.footer.text, "otohime.dev");
assert.equal(formatHankoDate("2026-10-28"), "2026.10.28");
assert.equal(formatBoothDownloadFilename("2026-10-28"), "otohime-booth-20261028.png");

// 4. Verify vector stroke/sticker undo/clear invariants and full 600x1800 strip composition
let dec = createDecorationState();
dec = addPenStroke(dec, {
  color: "vermilion",
  width: 6,
  points: [
    { x: 100, y: 120 },
    { x: 240, y: 180 },
  ],
});
dec = addSticker(dec, { kind: "star", x: 300, y: 400, scale: 1.5, rotationRad: 0.2, color: "gold" });
dec = updateSticker(dec, dec.stickers[0].id, { x: 320, y: 420, scale: 2.0, rotationRad: -0.4 });
dec = addEraserStroke(dec, {
  width: 12,
  points: [
    { x: 150, y: 140 },
    { x: 180, y: 160 },
  ],
});
assert.equal(dec.strokes.length, 2);
assert.equal(dec.stickers.length, 1);

dec = undoDecoration(dec);
assert.equal(dec.strokes.length, 1, "Undo removes eraser stroke");
dec = undoDecoration(dec);
assert.equal(dec.stickers[0].x, 300, "Undo restores sticker prior position");

const cleared = clearDecorations(dec);
assert.equal(cleared.strokes.length, 0);
assert.equal(cleared.stickers.length, 0);
const restored = undoDecoration(cleared);
assert.equal(restored.strokes.length, 1);
assert.equal(restored.stickers.length, 1);

const fourFrames = generateSamplePortraitFrames(4, { width: 120, height: 90 }).map((f) =>
  applyFilmStockKernel(f, "sumi-e"),
);
const fullStrip = composeStripBuffer(fourFrames, {
  width: STRIP_WIDTH,
  height: STRIP_HEIGHT,
  seed: DEFAULT_STRIP_SEED,
  date: "2026-10-28",
  stock: "sumi-e",
  decorations: restored,
});
assert.equal(fullStrip.width, 600);
assert.equal(fullStrip.height, 1800);
assert.equal(fullStrip.data[3], 0, "Corner outside torn-paper polygon is transparent");
assert.equal(fullStrip.data[(900 * 600 + 300) * 4 + 3], 255, "Interior of strip is opaque");

// Verify hanko date text stays strictly inside inner stamp ring (d <= hanko.radius * 0.72)
{
  const { hanko } = layout;
  let topRowCount = 0;
  let bottomRowCount = 0;
  let maxDateDist = 0;
  let gapSpillCount = 0;
  let outsideSpillCount = 0;

  for (let py = hanko.cy - hanko.radius - 24; py <= hanko.cy + hanko.radius + 24; py++) {
    for (let px = hanko.cx - hanko.radius - 40; px <= hanko.cx + hanko.radius + 40; px++) {
      const idx = (py * fullStrip.width + px) * 4;
      const isHankoRed =
        fullStrip.data[idx] === hanko.rgb[0] &&
        fullStrip.data[idx + 1] === hanko.rgb[1] &&
        fullStrip.data[idx + 2] === hanko.rgb[2];
      if (!isHankoRed) continue;
      const dy = py - hanko.cy;
      const d = Math.hypot(px - hanko.cx, dy);
      if (d < hanko.radius * 0.70 && Math.abs(dy) <= 16) {
        maxDateDist = Math.max(maxDateDist, d);
        if (dy < 0) topRowCount += 1;
        if (dy > 0) bottomRowCount += 1;
      }
      if (d > hanko.radius * 0.74 && d < hanko.radius * 0.84) {
        gapSpillCount += 1;
      }
      if (d > hanko.radius) {
        outsideSpillCount += 1;
      }
    }
  }

  assert.ok(topRowCount > 0, "Hanko YYYY row must render inside inner ring");
  assert.ok(bottomRowCount > 0, "Hanko MM.DD row must render inside inner ring");
  assert.ok(
    maxDateDist <= hanko.radius * 0.72,
    `Hanko date glyphs must stay within d <= ${hanko.radius * 0.72}, got ${maxDateDist.toFixed(2)}`,
  );
  assert.equal(gapSpillCount, 0, "Zero hanko pixels in ring gap (0.74 < d/R < 0.84)");
  assert.equal(outsideSpillCount, 0, "Zero hanko pixels outside hanko radius (d > R)");
}

// 5. Verify camera track cleanup on 4th shot and abort
assert.equal(BOOTH_PRIVACY_COPY, "Your camera stays in this tab. Nothing is uploaded.");
let stoppedCount = 0;
let gumCount = 0;
const abortController = new AbortController();
const cam = createBoothCameraController({
  isSecureContext: () => true,
  signal: abortController.signal,
  getUserMedia: async (constraints) => {
    assert.deepEqual(constraints, BOOTH_CAMERA_CONSTRAINTS);
    gumCount++;
    return {
      getTracks: () => [
        {
          stop() {
            stoppedCount++;
          },
        },
      ],
    };
  },
});

assert.equal(gumCount, 0, "Opt-in camera must not call getUserMedia before openCamera()");
await cam.openCamera();
assert.equal(gumCount, 1);
assert.equal(cam.status.state, "streaming");

for (let i = 1; i <= MAX_BOOTH_CAPTURES; i++) {
  cam.captureShot({ width: 96, height: 72 });
  if (i < MAX_BOOTH_CAPTURES) {
    assert.equal(stoppedCount, 0);
  } else {
    assert.equal(stoppedCount, 1, "Camera track must stop immediately after 4th shot");
    assert.equal(cam.status.state, "completed");
    assert.equal(cam.status.streamActive, false);
  }
}

await cam.openCamera();
assert.equal(cam.status.streamActive, true);
abortController.abort();
assert.equal(stoppedCount, 2, "Camera track must stop immediately on abort");
assert.equal(cam.status.streamActive, false);

console.log(
  "ok - Booth film-stock shaders/kernels (sumi-e, riso, newsprint), 600x1800 torn-paper strip composer, vector purikura model, camera controller, and shutter cue verified.",
);
