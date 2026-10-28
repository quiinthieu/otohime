import assert from "node:assert/strict";
import { test } from "node:test";
import {
  applyFilmStockKernel,
  applyNewsprintKernel,
  applyRisoKernel,
  applySumiEKernel,
  BOOTH_FRAGMENT_SHADER_SOURCE,
  BOOTH_VERTEX_SHADER_SOURCE,
  createFilmStockRenderer,
  FILM_STOCK_IDS,
  FILM_STOCK_SHADERS,
  FILM_STOCKS,
  isFilmStockId,
  type PixelBuffer,
  type RendererCanvasLike,
} from "./film-stock.ts";
import {
  generateSamplePortrait,
  generateSamplePortraitFrames,
} from "./sample-portrait.ts";
import {
  BOOTH_CAMERA_CONSTRAINTS,
  BOOTH_PRIVACY_COPY,
  createBoothCameraController,
  MAX_BOOTH_CAPTURES,
  type BoothCameraStream,
} from "./camera.ts";
import {
  addEraserStroke,
  addPenStroke,
  addSticker,
  BRUSH_WIDTHS,
  clearDecorations,
  composeStripBuffer,
  computeStripLayout,
  createDecorationState,
  createTornPaperPolygon,
  DEFAULT_STRIP_SEED,
  formatBoothDownloadFilename,
  formatHankoDate,
  INK_COLORS,
  isPointInPolygon,
  removeSticker,
  STICKER_CATALOG,
  STRIP_FRAME_COUNT,
  STRIP_HEIGHT,
  STRIP_WIDTH,
  undoDecoration,
  updateSticker,
} from "./strip.ts";

function bufferStats(buf: PixelBuffer) {
  let rSum = 0;
  let gSum = 0;
  let bSum = 0;
  let chromaSum = 0;
  let opaqueCount = 0;
  const lumas = new Float32Array(buf.width * buf.height);
  for (let i = 0, p = 0; i < buf.data.length; i += 4, p++) {
    const r = buf.data[i];
    const g = buf.data[i + 1];
    const b = buf.data[i + 2];
    const a = buf.data[i + 3];
    rSum += r;
    gSum += g;
    bSum += b;
    chromaSum += Math.abs(r - g) + Math.abs(g - b) + Math.abs(r - b);
    if (a === 255) opaqueCount++;
    lumas[p] = 0.299 * r + 0.587 * g + 0.114 * b;
  }
  const n = buf.width * buf.height;
  const meanLuma = lumas.reduce((acc, v) => acc + v, 0) / n;
  let variance = 0;
  for (let p = 0; p < n; p++) {
    const d = lumas[p] - meanLuma;
    variance += d * d;
  }
  return {
    meanR: rSum / n,
    meanG: gSum / n,
    meanB: bSum / n,
    meanChroma: chromaSum / n,
    stdLuma: Math.sqrt(variance / n),
    opaqueCount,
  };
}

function meanAbsDiff(a: PixelBuffer, b: PixelBuffer): number {
  assert.equal(a.data.length, b.data.length);
  let diff = 0;
  for (let i = 0; i < a.data.length; i++) {
    diff += Math.abs(a.data[i] - b.data[i]);
  }
  return diff / a.data.length;
}

test("film-stock definitions and WebGL2 shader sources cover sumi-e, riso, and newsprint", () => {
  assert.deepEqual(FILM_STOCK_IDS, ["sumi-e", "riso", "newsprint"]);
  for (const id of FILM_STOCK_IDS) {
    assert.equal(isFilmStockId(id), true);
    assert.ok(FILM_STOCKS[id].label.length > 0);
    assert.equal(FILM_STOCK_SHADERS[id].vertex, BOOTH_VERTEX_SHADER_SOURCE);
    assert.equal(FILM_STOCK_SHADERS[id].fragment, BOOTH_FRAGMENT_SHADER_SOURCE);
  }
  assert.equal(isFilmStockId("sepia"), false);
  assert.equal(isFilmStockId(null), false);

  assert.match(BOOTH_VERTEX_SHADER_SOURCE, /#version 300 es/);
  assert.match(BOOTH_FRAGMENT_SHADER_SOURCE, /#version 300 es/);
  assert.match(BOOTH_FRAGMENT_SHADER_SOURCE, /uniform sampler2D u_tex/);
  assert.match(BOOTH_FRAGMENT_SHADER_SOURCE, /u_mode == 0/);
  assert.match(BOOTH_FRAGMENT_SHADER_SOURCE, /u_mode == 1/);
});

test("sumi-e, riso, and newsprint kernels produce deterministic, non-blank, and mutually distinct pixel outputs", () => {
  const portrait = generateSamplePortrait({ width: 120, height: 90, poseIndex: 0 });
  const portraitStats = bufferStats(portrait);
  assert.equal(portraitStats.opaqueCount, 120 * 90);
  assert.ok(portraitStats.stdLuma > 25, "sample portrait has strong tonal contrast");

  const sumiA = applySumiEKernel(portrait, { seed: 42 });
  const sumiB = applyFilmStockKernel(portrait, "sumi-e", { seed: 42 });
  assert.deepEqual(sumiA.data, sumiB.data, "sumi-e kernel is deterministic");

  const risoA = applyRisoKernel(portrait, { seed: 42 });
  const risoB = applyFilmStockKernel(portrait, "riso", { seed: 42 });
  assert.deepEqual(risoA.data, risoB.data, "riso kernel is deterministic");

  const newsA = applyNewsprintKernel(portrait, { seed: 42 });
  const newsB = applyFilmStockKernel(portrait, "newsprint", { seed: 42 });
  assert.deepEqual(newsA.data, newsB.data, "newsprint kernel is deterministic");

  const sumiStats = bufferStats(sumiA);
  const risoStats = bufferStats(risoA);
  const newsStats = bufferStats(newsA);

  for (const [name, st] of [
    ["sumi-e", sumiStats],
    ["riso", risoStats],
    ["newsprint", newsStats],
  ] as const) {
    assert.equal(st.opaqueCount, 120 * 90, `${name} is fully opaque`);
    assert.ok(st.stdLuma > 30, `${name} is non-blank (stdLuma=${st.stdLuma.toFixed(2)})`);
  }

  // Riso two-colour (teal + fluorescent berry) has substantially higher colour chroma than sumi-e or newsprint
  assert.ok(
    risoStats.meanChroma > sumiStats.meanChroma * 3,
    `riso chroma (${risoStats.meanChroma.toFixed(1)}) > 3x sumi-e (${sumiStats.meanChroma.toFixed(1)})`,
  );
  assert.ok(
    risoStats.meanChroma > newsStats.meanChroma * 3,
    `riso chroma (${risoStats.meanChroma.toFixed(1)}) > 3x newsprint (${newsStats.meanChroma.toFixed(1)})`,
  );

  // Pairwise pixel differences between all three film stocks are substantial
  assert.ok(meanAbsDiff(sumiA, risoA) > 18, "sumi-e and riso differ significantly");
  assert.ok(meanAbsDiff(sumiA, newsA) > 12, "sumi-e and newsprint differ significantly");
  assert.ok(meanAbsDiff(risoA, newsA) > 20, "riso and newsprint differ significantly");
});

test("WebGL2 quad renderer handles webglcontextlost and falls back to deterministic Canvas 2D kernels", () => {
  const portrait = generateSamplePortrait({ width: 64, height: 48, poseIndex: 1 });
  let lostCount = 0;
  const lostHandlers: ((event: { preventDefault?: () => void }) => void)[] = [];
  let prevented = false;

  const mockWebGL2 = {
    VERTEX_SHADER: 0x8b31,
    FRAGMENT_SHADER: 0x8b30,
    COMPILE_STATUS: 0x8b81,
    LINK_STATUS: 0x8b82,
    ARRAY_BUFFER: 0x8892,
    STATIC_DRAW: 0x88e4,
    FLOAT: 0x1406,
    TRIANGLE_STRIP: 0x0005,
    TEXTURE_2D: 0x0de1,
    TEXTURE0: 0x84c0,
    RGBA: 0x1908,
    UNSIGNED_BYTE: 0x1401,
    TEXTURE_WRAP_S: 0x2802,
    TEXTURE_WRAP_T: 0x2803,
    TEXTURE_MIN_FILTER: 0x2801,
    TEXTURE_MAG_FILTER: 0x2800,
    CLAMP_TO_EDGE: 0x812f,
    LINEAR: 0x2601,
    createShader: () => ({}),
    shaderSource: () => {},
    compileShader: () => {},
    getShaderParameter: () => true,
    deleteShader: () => {},
    createProgram: () => ({}),
    attachShader: () => {},
    linkProgram: () => {},
    getProgramParameter: () => true,
    useProgram: () => {},
    deleteProgram: () => {},
    createBuffer: () => ({}),
    bindBuffer: () => {},
    bufferData: () => {},
    deleteBuffer: () => {},
    getAttribLocation: () => 0,
    enableVertexAttribArray: () => {},
    vertexAttribPointer: () => {},
    createTexture: () => ({}),
    activeTexture: () => {},
    bindTexture: () => {},
    texParameteri: () => {},
    texImage2D: () => {},
    deleteTexture: () => {},
    getUniformLocation: () => ({}),
    uniform1i: () => {},
    uniform1f: () => {},
    uniform2f: () => {},
    viewport: () => {},
    drawArrays: () => {},
    readPixels: (
      _x: number,
      _y: number,
      w: number,
      h: number,
      _fmt: number,
      _type: number,
      dst: Uint8Array,
    ) => {
      dst.fill(128, 0, w * h * 4);
    },
    isContextLost: () => false,
  };

  const mockCanvas: RendererCanvasLike = {
    width: 64,
    height: 48,
    getContext: (id: string) => (id === "webgl2" ? mockWebGL2 : null),
    addEventListener: (type, fn) => {
      if (type === "webglcontextlost") lostHandlers.push(fn);
    },
    removeEventListener: (type, fn) => {
      if (type === "webglcontextlost") {
        const idx = lostHandlers.indexOf(fn);
        if (idx !== -1) lostHandlers.splice(idx, 1);
      }
    },
  };

  const renderer = createFilmStockRenderer(mockCanvas, {
    onContextLost: () => {
      lostCount++;
    },
  });
  assert.equal(renderer.backend, "webgl2");
  assert.equal(renderer.contextLost, false);

  // Trigger webglcontextlost event
  assert.equal(lostHandlers.length, 1, "registered webglcontextlost listener");
  lostHandlers[0]({
    preventDefault: () => {
      prevented = true;
    },
  });
  assert.equal(prevented, true);
  assert.equal(lostCount, 1);
  assert.equal(renderer.contextLost, true);
  assert.equal(renderer.backend, "canvas2d");

  const fallbackOut = renderer.render(portrait, "riso", { seed: 77 });
  const expectedOut = applyFilmStockKernel(portrait, "riso", { seed: 77 });
  assert.deepEqual(fallbackOut.data, expectedOut.data, "falls back cleanly to Canvas 2D kernel");

  renderer.dispose();
  assert.equal(lostHandlers.length, 0, "removes listener on dispose");
});

test("sample portrait generator produces 4 deterministic, expressive poses", () => {
  const framesA = generateSamplePortraitFrames(4, { width: 96, height: 72 });
  const framesB = generateSamplePortraitFrames(4, { width: 96, height: 72 });
  assert.equal(framesA.length, 4);
  for (let i = 0; i < 4; i++) {
    assert.deepEqual(framesA[i].data, framesB[i].data, `pose ${i} is deterministic`);
    if (i > 0) {
      assert.ok(
        meanAbsDiff(framesA[0], framesA[i]) > 1.5,
        `pose ${i} differs visibly from pose 0`,
      );
    }
  }
});

test("opt-in camera controller starts only on openCamera, stops tracks on 4th capture, close, hide, and abort, and falls back when denied", async () => {
  assert.equal(
    BOOTH_PRIVACY_COPY,
    "Your camera stays in this tab. Nothing is uploaded.",
  );
  assert.deepEqual(BOOTH_CAMERA_CONSTRAINTS, {
    video: { facingMode: "user", width: { ideal: 960 } },
    audio: false,
  });

  let mediaCalls = 0;
  let tracksStopped = 0;
  let lastConstraints: unknown = null;
  const docListeners = new Map<string, () => void>();
  const docMock = {
    hidden: false,
    visibilityState: "visible",
    addEventListener: (type: string, fn: () => void) => {
      docListeners.set(type, fn);
    },
    removeEventListener: (type: string) => {
      docListeners.delete(type);
    },
  };

  const makeStream = (): BoothCameraStream => ({
    getTracks: () => [
      {
        stop: () => {
          tracksStopped++;
        },
      },
    ],
  });

  const controller = createBoothCameraController({
    isSecureContext: () => true,
    getUserMedia: async (c) => {
      mediaCalls++;
      lastConstraints = c;
      return makeStream();
    },
    documentTarget: docMock,
  });

  // 1. Must be idle and never call getUserMedia before user action
  assert.equal(controller.status.state, "idle");
  assert.equal(mediaCalls, 0);

  // 2. User opens camera -> requests exact constraints
  const opened = await controller.openCamera();
  assert.equal(mediaCalls, 1);
  assert.deepEqual(lastConstraints, BOOTH_CAMERA_CONSTRAINTS);
  assert.equal(opened.state, "streaming");
  assert.equal(opened.streamActive, true);

  // 3. Take 4 captures -> tracks stay open for shots 1..3 and stop immediately on shot 4
  for (let shot = 1; shot <= MAX_BOOTH_CAPTURES; shot++) {
    const frame = controller.captureShot({ width: 80, height: 60 });
    assert.equal(frame.width, 80);
    assert.equal(frame.height, 60);
    if (shot < MAX_BOOTH_CAPTURES) {
      assert.equal(controller.status.state, "streaming");
      assert.equal(controller.status.streamActive, true);
      assert.equal(tracksStopped, 0, `track still running after shot ${shot}`);
    } else {
      assert.equal(controller.status.state, "completed");
      assert.equal(controller.status.streamActive, false);
      assert.equal(tracksStopped, 1, "track stopped immediately on 4th capture");
    }
  }
  assert.equal(controller.capturedFrames.length, 4);

  // 4. Visibility hidden stops active stream tracks
  await controller.openCamera();
  assert.equal(controller.status.streamActive, true);
  docMock.hidden = true;
  docMock.visibilityState = "hidden";
  docListeners.get("visibilitychange")?.();
  assert.equal(tracksStopped, 2, "visibilitychange hidden stopped stream tracks");
  assert.equal(controller.status.streamActive, false);
  docMock.hidden = false;
  docMock.visibilityState = "visible";

  // 5. Close during pending getUserMedia stops late tracks immediately
  let resolvePending!: (s: BoothCameraStream) => void;
  const pendingController = createBoothCameraController({
    isSecureContext: () => true,
    getUserMedia: () =>
      new Promise<BoothCameraStream>((r) => {
        resolvePending = r;
      }),
  });
  const pendingOpen = pendingController.openCamera();
  assert.equal(pendingController.status.state, "requesting");
  pendingController.close();
  resolvePending(makeStream());
  await pendingOpen;
  assert.equal(tracksStopped, 3, "late stream tracks stopped after close()");
  assert.equal(pendingController.status.state, "idle");

  // 6. AbortSignal stops active camera tracks
  const abortCtrl = new AbortController();
  const abortable = createBoothCameraController({
    isSecureContext: () => true,
    getUserMedia: async () => makeStream(),
    signal: abortCtrl.signal,
  });
  await abortable.openCamera();
  assert.equal(abortable.status.streamActive, true);
  abortCtrl.abort();
  assert.equal(tracksStopped, 4, "abort signal stopped active camera tracks");
  assert.equal(abortable.status.streamActive, false);

  // 7. Denied permission falls back to sample portrait and still captures 4 frames
  const deniedController = createBoothCameraController({
    isSecureContext: () => true,
    getUserMedia: async () => {
      const err = new Error("Permission denied");
      err.name = "NotAllowedError";
      throw err;
    },
  });
  const fallbackStatus = await deniedController.openCamera();
  assert.equal(fallbackStatus.state, "sample");
  assert.equal(fallbackStatus.fallbackReason, "NotAllowedError");
  assert.equal(fallbackStatus.streamActive, false);
  for (let i = 0; i < 4; i++) {
    deniedController.captureShot({ width: 64, height: 48 });
  }
  assert.equal(deniedController.capturedFrames.length, 4);
  assert.equal(deniedController.status.state, "completed");
});

test("torn-paper polygon mask is seeded-deterministic and 4-frame strip layout matches 600x1800 geometry", () => {
  const polyA = createTornPaperPolygon(STRIP_WIDTH, STRIP_HEIGHT, DEFAULT_STRIP_SEED);
  const polyB = createTornPaperPolygon(STRIP_WIDTH, STRIP_HEIGHT, DEFAULT_STRIP_SEED);
  const polyC = createTornPaperPolygon(STRIP_WIDTH, STRIP_HEIGHT, DEFAULT_STRIP_SEED + 99);

  assert.deepEqual(polyA, polyB, "same seed produces identical torn-paper polygon");
  assert.notDeepEqual(polyA, polyC, "different seed produces distinct torn-paper polygon");
  assert.ok(polyA.length >= 160, "polygon has dense serrated edge vertices");

  for (const pt of polyA) {
    assert.ok(pt.x >= 0 && pt.x <= STRIP_WIDTH);
    assert.ok(pt.y >= 0 && pt.y <= STRIP_HEIGHT);
  }
  assert.equal(isPointInPolygon(STRIP_WIDTH / 2, STRIP_HEIGHT / 2, polyA), true);
  assert.equal(isPointInPolygon(0, 0, polyA), false);

  assert.equal(formatHankoDate("2026-10-28"), "2026.10.28");
  assert.equal(formatHankoDate(Date.UTC(2026, 9, 28)), "2026.10.28");
  assert.equal(formatBoothDownloadFilename("2026-10-28"), "otohime-booth-20261028.png");

  const layout = computeStripLayout({
    seed: DEFAULT_STRIP_SEED,
    date: "2026-10-28",
    stock: "riso",
  });
  assert.equal(layout.width, 600);
  assert.equal(layout.height, 1800);
  assert.equal(layout.frames.length, STRIP_FRAME_COUNT);
  for (let i = 0; i < STRIP_FRAME_COUNT; i++) {
    const f = layout.frames[i];
    assert.equal(f.index, i);
    assert.ok(f.tiltRad !== 0 && Math.abs(f.tiltRad) <= 0.03, "subtle frame tilt");
    if (i > 0) {
      assert.ok(f.y > layout.frames[i - 1].y + layout.frames[i - 1].height);
    }
  }
  assert.equal(layout.hanko.dateText, "2026.10.28");
  assert.equal(layout.hanko.colorHex, "#c82822");
  assert.equal(layout.footer.text, "otohime.dev");
});

test("vector purikura decoration model preserves stroke/sticker undo and clear invariants and renders onto strip", () => {
  assert.deepEqual(BRUSH_WIDTHS, [3, 6, 12]);
  assert.ok(STICKER_CATALOG.length >= 6);
  assert.ok(INK_COLORS.sumi && INK_COLORS.vermilion && INK_COLORS.indigo && INK_COLORS.gold);

  let state = createDecorationState();
  assert.equal(state.strokes.length, 0);
  assert.equal(state.stickers.length, 0);

  // Add pen stroke
  state = addPenStroke(state, {
    color: "vermilion",
    width: 12,
    points: [
      { x: 60, y: 80 },
      { x: 140, y: 120 },
    ],
  });
  assert.equal(state.strokes.length, 1);
  assert.equal(state.history.length, 1);

  // Add sticker
  state = addSticker(state, {
    kind: "heart",
    x: 100,
    y: 220,
    scale: 1.4,
    rotationRad: 0.25,
    color: "vermilion",
  });
  assert.equal(state.stickers.length, 1);
  const stickerId = state.stickers[0].id;

  // Drag, scale, and rotate sticker
  state = updateSticker(state, stickerId, {
    x: 115,
    y: 235,
    scale: 1.8,
    rotationRad: -0.35,
    color: "gold",
  });
  assert.equal(state.stickers[0].x, 115);
  assert.equal(state.stickers[0].scale, 1.8);
  assert.equal(state.stickers[0].rotationRad, -0.35);
  assert.equal(state.stickers[0].color, "gold");

  // Add eraser stroke
  state = addEraserStroke(state, {
    width: 18,
    points: [
      { x: 90, y: 90 },
      { x: 110, y: 110 },
    ],
  });
  assert.equal(state.strokes.length, 2);
  assert.equal(state.strokes[1].tool, "eraser");

  // Undo eraser stroke -> back to 1 stroke + transformed sticker
  state = undoDecoration(state);
  assert.equal(state.strokes.length, 1);
  assert.equal(state.stickers[0].x, 115);

  // Undo sticker transform -> back to initial sticker placement
  state = undoDecoration(state);
  assert.equal(state.stickers[0].x, 100);
  assert.equal(state.stickers[0].color, "vermilion");

  // Clear all decorations -> 0 strokes, 0 stickers
  state = clearDecorations(state);
  assert.equal(state.strokes.length, 0);
  assert.equal(state.stickers.length, 0);

  // Undo clear -> restores the stroke and sticker!
  state = undoDecoration(state);
  assert.equal(state.strokes.length, 1);
  assert.equal(state.stickers.length, 1);

  // Remove sticker explicitly
  state = removeSticker(state, stickerId);
  assert.equal(state.stickers.length, 0);

  // Compose a strip buffer at 200x600 scale to verify torn-paper transparency, 4 frames, hanko, footer, and doodles
  const sampleFrames = generateSamplePortraitFrames(4, { width: 80, height: 60 }).map(
    (f) => applyFilmStockKernel(f, "sumi-e"),
  );
  const baseStrip = composeStripBuffer(sampleFrames, {
    width: 200,
    height: 600,
    seed: DEFAULT_STRIP_SEED,
    date: "2026-10-28",
    stock: "sumi-e",
  });
  assert.equal(baseStrip.width, 200);
  assert.equal(baseStrip.height, 600);
  // Corner (0,0) outside torn-paper polygon is transparent (alpha = 0)
  assert.equal(baseStrip.data[3], 0, "top-left corner outside torn mask is transparent");
  // Center of strip is opaque (alpha = 255)
  const centerIdx = (300 * 200 + 100) * 4;
  assert.equal(baseStrip.data[centerIdx + 3], 255, "interior of strip is opaque");

  // Compose with decorations and verify doodles alter strip pixels while erased doodles revert
  let decoratedState = createDecorationState();
  decoratedState = addPenStroke(decoratedState, {
    color: "vermilion",
    width: 16,
    points: [
      { x: 40, y: 100 },
      { x: 160, y: 100 },
    ],
  });
  decoratedState = addSticker(decoratedState, {
    kind: "star",
    x: 100,
    y: 300,
    scale: 1.5,
    color: "gold",
  });

  const decoratedStrip = composeStripBuffer(sampleFrames, {
    width: 200,
    height: 600,
    seed: DEFAULT_STRIP_SEED,
    date: "2026-10-28",
    stock: "sumi-e",
    decorations: decoratedState,
  });
  assert.ok(
    meanAbsDiff(baseStrip, decoratedStrip) > 0.25,
    "decorations visibly render onto the composed strip",
  );
});
