"use client";

import {
  BOOTH_PRIVACY_COPY,
  createBoothCameraController,
  MAX_BOOTH_CAPTURES,
  type BoothCameraController,
  type BoothCameraStatus,
} from "@/lib/booth/camera";
import {
  applyFilmStockKernel,
  createFilmStockRenderer,
  FILM_STOCK_LIST,
  FILM_STOCKS,
  isFilmStockId,
  type FilmStockId,
  type FilmStockRenderer,
  type PixelBuffer,
} from "@/lib/booth/film-stock";
import {
  generateSamplePortraitFrames,
  SAMPLE_PORTRAIT_SEED,
} from "@/lib/booth/sample-portrait";
import {
  addEraserStroke,
  addPenStroke,
  addSticker,
  BRUSH_WIDTHS,
  clearDecorations,
  composeStripBuffer,
  computeStripLayout,
  createDecorationState,
  DEFAULT_STRIP_SEED,
  formatBoothDownloadFilename,
  formatHankoDate,
  INK_COLOR_IDS,
  INK_COLORS,
  removeSticker,
  STICKER_CATALOG,
  STRIP_FOOTER_TEXT,
  STRIP_HEIGHT,
  STRIP_WIDTH,
  undoDecoration,
  updateSticker,
  type InkColorId,
  type Point2D,
  type PurikuraDecorationState,
  type StickerKind,
} from "@/lib/booth/strip";
import {
  getServerSound,
  getSound,
  play,
  setSound,
  subscribeSound,
} from "@/lib/sound-client";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";

const REDUCED_QUERY = "(prefers-reduced-motion: reduce)";
const FRAME_W = 240;
const FRAME_H = 180;
const COUNTDOWN_STEP_MS = 95;
const SHUTTER_FLASH_MS = 95;

function subscribeReducedMotion(onChange: () => void): () => void {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return () => {};
  }
  const media = window.matchMedia(REDUCED_QUERY);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

function getReducedMotionSnapshot(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia(REDUCED_QUERY).matches;
}

function getServerReducedMotion(): boolean {
  return false;
}

function subscribeHydrated(): () => void {
  return () => {};
}

function getClientHydrated(): boolean {
  return true;
}

function getServerHydrated(): boolean {
  return false;
}

function writeBufferToCanvas(
  canvas: HTMLCanvasElement | null,
  buffer: PixelBuffer,
): void {
  if (!canvas) return;
  if (canvas.width !== buffer.width) canvas.width = buffer.width;
  if (canvas.height !== buffer.height) canvas.height = buffer.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const clamped = new Uint8ClampedArray(buffer.width * buffer.height * 4);
  clamped.set(buffer.data.subarray(0, clamped.length));
  const imgData = new ImageData(clamped, buffer.width, buffer.height);
  ctx.putImageData(imgData, 0, 0);
}

export interface BoothStudioProps {
  readonly initialDate?: string;
  readonly initialSeed?: number;
}

export function BoothStudio({
  initialDate = "2026-10-28",
  initialSeed = DEFAULT_STRIP_SEED,
}: BoothStudioProps) {
  const soundOn = useSyncExternalStore(
    subscribeSound,
    getSound,
    getServerSound,
  );
  const reducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotionSnapshot,
    getServerReducedMotion,
  );
  const hydrated = useSyncExternalStore(
    subscribeHydrated,
    getClientHydrated,
    getServerHydrated,
  );

  const [filmStock, setFilmStock] = useState<FilmStockId>("sumi-e");
  const [cameraStatus, setCameraStatus] = useState<BoothCameraStatus>({
    state: "idle",
    generation: 0,
    capturedCount: 0,
    streamActive: false,
    fallbackReason: null,
  });

  // 4 raw portrait frames (defaulting to the 4 sample portrait poses so the strip is immediately interactive)
  const [rawFrames, setRawFrames] = useState<readonly PixelBuffer[]>(() =>
    generateSamplePortraitFrames(MAX_BOOTH_CAPTURES, {
      width: FRAME_W,
      height: FRAME_H,
      seed: SAMPLE_PORTRAIT_SEED,
    }),
  );

  // Countdown & shutter state
  const [isCapturing, setIsCapturing] = useState(false);
  const [countdownNumber, setCountdownNumber] = useState<3 | 2 | 1 | null>(
    null,
  );
  const [activeShotIndex, setActiveShotIndex] = useState<number>(0);
  const [isFlashing, setIsFlashing] = useState(false);
  const [flashCount, setFlashCount] = useState(0);
  const [shutterCount, setShutterCount] = useState(0);
  const [countdownLog, setCountdownLog] = useState<string>("");
  const [liveStatus, setLiveStatus] = useState<string>(
    "Ready. Open your camera or use the sample paper portrait to shoot a 4-frame strip.",
  );

  // Purikura doodle & sticker state
  const [decorations, setDecorations] = useState<PurikuraDecorationState>(() =>
    createDecorationState(),
  );
  const [activeTool, setActiveTool] = useState<"pen" | "eraser">("pen");
  const [inkColor, setInkColor] = useState<InkColorId>("vermilion");
  const [brushWidth, setBrushWidth] = useState<number>(6);
  const [selectedStickerId, setSelectedStickerId] = useState<string | null>(
    null,
  );
  const [contextLost, setContextLost] = useState(false);
  const rendererBackend: "webgl2" | "canvas2d" =
    !hydrated || contextLost ? "canvas2d" : "webgl2";
  const [downloadCount, setDownloadCount] = useState(0);
  const [lastDownloadName, setLastDownloadName] = useState<string>("");
  const [printCount, setPrintCount] = useState(0);

  const viewfinderCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const stripCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const videoScratchCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<FilmStockRenderer | null>(null);
  const controllerRef = useRef<BoothCameraController | null>(null);
  const captureRunIdRef = useRef(0);

  // Pointer drawing state on the strip canvas
  const drawingPointsRef = useRef<Point2D[] | null>(null);
  const draggingStickerRef = useRef<{
    id: string;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
    moved: boolean;
  } | null>(null);

  const hankoDate = useMemo(() => formatHankoDate(initialDate), [initialDate]);
  const downloadFilename = useMemo(
    () => formatBoothDownloadFilename(initialDate),
    [initialDate],
  );
  const stripLayout = useMemo(
    () =>
      computeStripLayout({
        width: STRIP_WIDTH,
        height: STRIP_HEIGHT,
        seed: initialSeed,
        date: initialDate,
        stock: filmStock,
      }),
    [initialSeed, initialDate, filmStock],
  );

  // Read a video frame from the hidden <video> element if playing, or fall back to procedural sample portrait
  const readLiveVideoFrame = useCallback(
    (width: number, height: number): PixelBuffer | null => {
      const video = videoRef.current;
      if (
        !video ||
        video.readyState < 2 ||
        video.videoWidth <= 0 ||
        video.videoHeight <= 0
      ) {
        return null;
      }
      if (!videoScratchCanvasRef.current && typeof document !== "undefined") {
        videoScratchCanvasRef.current = document.createElement("canvas");
      }
      const scratch = videoScratchCanvasRef.current;
      if (!scratch) return null;
      scratch.width = width;
      scratch.height = height;
      const ctx = scratch.getContext("2d");
      if (!ctx) return null;
      try {
        ctx.drawImage(video, 0, 0, width, height);
        const img = ctx.getImageData(0, 0, width, height);
        // Check whether the video stream has non-uniform content; if it is a solid blank canvas, blend with sample pose
        let minL = 255;
        let maxL = 0;
        for (let i = 0; i < img.data.length; i += 32) {
          const lum =
            0.299 * img.data[i] +
            0.587 * img.data[i + 1] +
            0.114 * img.data[i + 2];
          if (lum < minL) minL = lum;
          if (lum > maxL) maxL = lum;
        }
        if (maxL - minL >= 8) {
          return img;
        }
      } catch {
        // fall through to procedural portrait
      }
      return null;
    },
    [],
  );

  // Initialize WebGL2 / Canvas2D renderer and opt-in camera controller on mount
  useEffect(() => {
    const runIdRef = captureRunIdRef;
    const glCanvas =
      typeof document !== "undefined" ? document.createElement("canvas") : null;
    const renderer = createFilmStockRenderer(glCanvas, {
      onContextLost: () => {
        setContextLost(true);
      },
    });
    rendererRef.current = renderer;

    // Forward webglcontextlost dispatched on the visible viewfinder canvas to the renderer
    const vf = viewfinderCanvasRef.current;
    const onVfContextLost = (e: Event) => {
      e.preventDefault();
      renderer.forceContextLoss();
    };
    vf?.addEventListener("webglcontextlost", onVfContextLost);

    const controller = createBoothCameraController(
      {
        readStreamFrame: (_stream, w, h) => readLiveVideoFrame(w, h),
      },
      (nextStatus) => {
        setCameraStatus(nextStatus);
        if (!nextStatus.streamActive && videoRef.current) {
          videoRef.current.pause();
          videoRef.current.srcObject = null;
        }
      },
    );
    controllerRef.current = controller;

    return () => {
      runIdRef.current++;
      vf?.removeEventListener("webglcontextlost", onVfContextLost);
      controller.unmount();
      renderer.dispose();
    };
  }, [readLiveVideoFrame]);

  // Filtered 4 frames using the active film stock
  const filteredFrames = useMemo(
    () =>
      rawFrames.map((raw, idx) =>
        applyFilmStockKernel(raw, filmStock, {
          seed: 101 + idx,
          mirror: cameraStatus.state === "streaming",
        }),
      ),
    [rawFrames, filmStock, cameraStatus.state],
  );

  // Composed 600x1800 strip buffer
  const composedStrip = useMemo(
    () =>
      composeStripBuffer(filteredFrames, {
        width: STRIP_WIDTH,
        height: STRIP_HEIGHT,
        seed: initialSeed,
        date: initialDate,
        stock: filmStock,
        decorations,
      }),
    [filteredFrames, initialSeed, initialDate, filmStock, decorations],
  );

  // Paint viewfinder canvas whenever rawFrames, filmStock, or activeShotIndex changes
  useEffect(() => {
    const previewIdx =
      activeShotIndex >= 0 && activeShotIndex < rawFrames.length
        ? activeShotIndex
        : 0;
    const rawPreview = rawFrames[previewIdx] ?? rawFrames[0];
    if (!rawPreview) return;
    const renderer = rendererRef.current;
    const previewBuf = renderer
      ? renderer.render(rawPreview, filmStock, {
          seed: 101 + previewIdx,
          mirror: cameraStatus.state === "streaming",
        })
      : filteredFrames[previewIdx] ?? filteredFrames[0];
    if (previewBuf) {
      writeBufferToCanvas(viewfinderCanvasRef.current, previewBuf);
    }
  }, [rawFrames, filteredFrames, filmStock, activeShotIndex, cameraStatus.state, contextLost]);

  // Live viewfinder animation tick while camera is actively streaming
  useEffect(() => {
    if (cameraStatus.state !== "streaming" || !cameraStatus.streamActive) {
      return;
    }
    let rafId = 0;
    let lastTick = 0;
    const tick = (now: number) => {
      if (now - lastTick >= 80) {
        lastTick = now;
        const ctrl = controllerRef.current;
        const renderer = rendererRef.current;
        if (ctrl && renderer) {
          const raw = ctrl.readPreviewFrame(FRAME_W, FRAME_H);
          const filtered = renderer.render(raw, filmStock, {
            seed: 101,
            mirror: true,
          });
          writeBufferToCanvas(viewfinderCanvasRef.current, filtered);
        }
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [cameraStatus.state, cameraStatus.streamActive, filmStock]);

  // Paint 600x1800 torn-paper strip canvas whenever composedStrip changes
  useEffect(() => {
    writeBufferToCanvas(stripCanvasRef.current, composedStrip);
  }, [composedStrip]);

  const handleOpenCamera = async () => {
    const ctrl = controllerRef.current;
    if (!ctrl) return;
    setLiveStatus("Requesting camera permission (local to this tab)...");
    const status = await ctrl.openCamera();
    if (status.state === "streaming" && ctrl.stream) {
      const video = videoRef.current;
      if (video && typeof MediaStream !== "undefined" && ctrl.stream instanceof MediaStream) {
        video.srcObject = ctrl.stream;
        await Promise.race([
          video.play().catch(() => {}),
          new Promise((r) => setTimeout(r, 120)),
        ]);
      }
      setLiveStatus(
        "Camera open in this tab. Press “Take 4 photos” to start the 3-2-1 countdown.",
      );
    } else if (status.state === "sample") {
      const sampleFrames = generateSamplePortraitFrames(MAX_BOOTH_CAPTURES, {
        width: FRAME_W,
        height: FRAME_H,
        seed: SAMPLE_PORTRAIT_SEED,
      });
      setRawFrames(sampleFrames);
      setLiveStatus(
        `Camera unavailable (${status.fallbackReason ?? "fallback"}) — using sample paper portrait.`,
      );
    }
  };

  const handleCloseCamera = () => {
    captureRunIdRef.current++;
    setIsCapturing(false);
    setCountdownNumber(null);
    setIsFlashing(false);
    controllerRef.current?.close();
    setLiveStatus("Camera closed and tracks stopped.");
  };

  const handleUseSamplePortrait = () => {
    captureRunIdRef.current++;
    setIsCapturing(false);
    setCountdownNumber(null);
    setIsFlashing(false);
    const ctrl = controllerRef.current;
    ctrl?.useSamplePortrait("manual_sample");
    const sampleFrames = generateSamplePortraitFrames(MAX_BOOTH_CAPTURES, {
      width: FRAME_W,
      height: FRAME_H,
      seed: SAMPLE_PORTRAIT_SEED,
    });
    setRawFrames(sampleFrames);
    setLiveStatus(
      "Using procedural sample paper portrait. Press “Take 4 photos” or doodle directly on the strip.",
    );
  };

  const handleSelectFilmStock = (nextStock: FilmStockId) => {
    if (!isFilmStockId(nextStock)) return;
    setFilmStock(nextStock);
    play("move");
    setLiveStatus(
      `Switched film stock to ${FILM_STOCKS[nextStock].label} (${FILM_STOCKS[nextStock].subtitle}).`,
    );
  };

  // Run the 3-2-1 countdown and capture 4 sequential frames
  const handleStartCapture = async () => {
    const ctrl = controllerRef.current;
    if (!ctrl || isCapturing) return;

    const runId = ++captureRunIdRef.current;
    setIsCapturing(true);
    const logTokens: string[] = [];

    if (ctrl.status.state === "completed") {
      ctrl.resetSession();
    }
    if (ctrl.status.state === "idle") {
      ctrl.useSamplePortrait("auto_sample");
    }

    const sleep = (ms: number) =>
      new Promise<void>((resolve) => setTimeout(resolve, ms));

    const capturedRawList: PixelBuffer[] = [...rawFrames];

    for (let shot = 0; shot < MAX_BOOTH_CAPTURES; shot++) {
      if (captureRunIdRef.current !== runId) return;
      setActiveShotIndex(shot);

      for (const count of [3, 2, 1] as const) {
        if (captureRunIdRef.current !== runId) return;
        setCountdownNumber(count);
        logTokens.push(String(count));
        setCountdownLog(logTokens.join(","));
        setLiveStatus(`Shot ${shot + 1} of ${MAX_BOOTH_CAPTURES} — ${count}...`);
        await sleep(COUNTDOWN_STEP_MS);
      }

      if (captureRunIdRef.current !== runId) return;
      setCountdownNumber(null);
      setIsFlashing(true);
      setFlashCount((c) => c + 1);
      setShutterCount((c) => c + 1);
      logTokens.push("shutter");
      setCountdownLog(logTokens.join(","));

      // Synthesised WebAudio shutter clack (respects sound toggle & -18 dB cap)
      play("shutter");

      const frame = ctrl.captureShot({ width: FRAME_W, height: FRAME_H });
      capturedRawList[shot] = frame;
      setRawFrames([...capturedRawList]);
      setLiveStatus(
        `Shot ${shot + 1} of ${MAX_BOOTH_CAPTURES} — Shutter clack! Frame ${shot + 1} captured.`,
      );

      await sleep(SHUTTER_FLASH_MS);
      if (captureRunIdRef.current !== runId) return;
      setIsFlashing(false);
    }

    if (captureRunIdRef.current !== runId) return;
    setIsCapturing(false);
    setCountdownNumber(null);
    setActiveShotIndex(0);
    play("stamp");
    setLiveStatus(
      `Captured 4 of 4 frames on ${FILM_STOCKS[filmStock].label} torn-paper strip. Camera tracks stopped.`,
    );
  };

  // Map pointer event on strip canvas to [0..600, 0..1800] strip coordinates
  const clientToStripPoint = (
    clientX: number,
    clientY: number,
  ): Point2D | null => {
    const canvas = stripCanvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    const x = Math.max(
      0,
      Math.min(STRIP_WIDTH, ((clientX - rect.left) / rect.width) * STRIP_WIDTH),
    );
    const y = Math.max(
      0,
      Math.min(
        STRIP_HEIGHT,
        ((clientY - rect.top) / rect.height) * STRIP_HEIGHT,
      ),
    );
    return { x: Math.round(x), y: Math.round(y) };
  };

  const handleStripPointerDown = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const pt = clientToStripPoint(e.clientX, e.clientY);
    if (!pt) return;
    try {
      e.currentTarget.setPointerCapture?.(e.pointerId);
    } catch {
      // Synthetic pointer events may not register an active pointerId
    }
    drawingPointsRef.current = [pt];
  };

  const handleStripPointerMove = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!drawingPointsRef.current) return;
    const pt = clientToStripPoint(e.clientX, e.clientY);
    if (!pt) return;
    const pts = drawingPointsRef.current;
    const last = pts[pts.length - 1];
    if (!last || Math.hypot(pt.x - last.x, pt.y - last.y) >= 3) {
      pts.push(pt);
    }
  };

  const commitActiveStroke = () => {
    const pts = drawingPointsRef.current;
    drawingPointsRef.current = null;
    if (!pts || pts.length === 0) return;
    const finalPoints =
      pts.length === 1
        ? [
            pts[0],
            {
              x: Math.min(STRIP_WIDTH - 20, pts[0].x + 36),
              y: Math.min(STRIP_HEIGHT - 20, pts[0].y + 18),
            },
          ]
        : pts;
    setDecorations((prev) =>
      activeTool === "eraser"
        ? addEraserStroke(prev, {
            points: finalPoints,
            width: Math.max(12, brushWidth * 2),
          })
        : addPenStroke(prev, {
            points: finalPoints,
            color: inkColor,
            width: brushWidth,
          }),
    );
    setLiveStatus(
      activeTool === "eraser"
        ? "Erased doodle stroke on strip."
        : `Drew ${INK_COLORS[inkColor].label} (${brushWidth}px) pen stroke on strip.`,
    );
  };

  const handleStripKeyDown = (e: ReactKeyboardEvent<HTMLCanvasElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleAddSampleStroke();
    } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
      e.preventDefault();
      handleUndo();
    }
  };

  const handleAddSampleStroke = () => {
    const idx = decorations.strokes.length;
    const yBase = 160 + ((idx * 180) % 1200);
    const pts: Point2D[] = [
      { x: 90, y: yBase },
      { x: 240, y: yBase - 28 },
      { x: 420, y: yBase + 22 },
      { x: 510, y: yBase - 12 },
    ];
    setDecorations((prev) =>
      activeTool === "eraser"
        ? addEraserStroke(prev, {
            points: pts,
            width: Math.max(14, brushWidth * 2),
          })
        : addPenStroke(prev, {
            points: pts,
            color: inkColor,
            width: brushWidth,
          }),
    );
    setLiveStatus(
      activeTool === "eraser"
        ? "Applied eraser stroke across strip."
        : `Drew ${INK_COLORS[inkColor].label} (${brushWidth}px) brush flourish on strip.`,
    );
  };

  const handleAddSticker = (kind: StickerKind) => {
    const count = decorations.stickers.length;
    const x = 140 + ((count * 95) % 320);
    const y = 220 + ((count * 240) % 1250);
    setDecorations((prev) => {
      const next = addSticker(prev, {
        kind,
        x,
        y,
        scale: 1.25,
        rotationRad: 0,
        color: inkColor,
      });
      const added = next.stickers[next.stickers.length - 1];
      if (added) setSelectedStickerId(added.id);
      return next;
    });
    play("stamp");
    const label =
      STICKER_CATALOG.find((s) => s.kind === kind)?.label ?? kind;
    setLiveStatus(`Placed ${label} sticker on strip.`);
  };

  const activeSticker = useMemo(
    () =>
      decorations.stickers.find((s) => s.id === selectedStickerId) ??
      decorations.stickers[decorations.stickers.length - 1] ??
      null,
    [decorations.stickers, selectedStickerId],
  );

  const handleTransformActiveSticker = (patch: {
    dx?: number;
    dy?: number;
    dScale?: number;
    dRot?: number;
  }) => {
    if (!activeSticker) return;
    setDecorations((prev) =>
      updateSticker(prev, activeSticker.id, {
        x: Math.max(
          40,
          Math.min(STRIP_WIDTH - 40, activeSticker.x + (patch.dx ?? 0)),
        ),
        y: Math.max(
          40,
          Math.min(STRIP_HEIGHT - 40, activeSticker.y + (patch.dy ?? 0)),
        ),
        scale: Math.max(
          0.4,
          Math.min(3.5, Number((activeSticker.scale + (patch.dScale ?? 0)).toFixed(2))),
        ),
        rotationRad: Number(
          (activeSticker.rotationRad + (patch.dRot ?? 0)).toFixed(3),
        ),
      }),
    );
  };

  const handleRemoveActiveSticker = () => {
    if (!activeSticker) return;
    setDecorations((prev) => removeSticker(prev, activeSticker.id));
    setLiveStatus("Removed selected sticker.");
  };

  const handleStickerPointerDown = (
    e: ReactPointerEvent<HTMLButtonElement>,
    stickerId: string,
    origX: number,
    origY: number,
  ) => {
    e.stopPropagation();
    setSelectedStickerId(stickerId);
    try {
      e.currentTarget.setPointerCapture?.(e.pointerId);
    } catch {
      // Synthetic pointer events may not register an active pointerId
    }
    draggingStickerRef.current = {
      id: stickerId,
      startX: e.clientX,
      startY: e.clientY,
      origX,
      origY,
      moved: false,
    };
  };

  const handleStickerPointerMove = (
    e: ReactPointerEvent<HTMLButtonElement>,
  ) => {
    const drag = draggingStickerRef.current;
    if (!drag) return;
    const canvas = stripCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const dx = ((e.clientX - drag.startX) / rect.width) * STRIP_WIDTH;
    const dy = ((e.clientY - drag.startY) / rect.height) * STRIP_HEIGHT;
    if (Math.hypot(dx, dy) >= 2) {
      drag.moved = true;
    }
  };

  const handleStickerPointerUp = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = draggingStickerRef.current;
    draggingStickerRef.current = null;
    if (!drag || !drag.moved) return;
    const canvas = stripCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const dx = ((e.clientX - drag.startX) / rect.width) * STRIP_WIDTH;
    const dy = ((e.clientY - drag.startY) / rect.height) * STRIP_HEIGHT;
    const nx = Math.round(
      Math.max(36, Math.min(STRIP_WIDTH - 36, drag.origX + dx)),
    );
    const ny = Math.round(
      Math.max(36, Math.min(STRIP_HEIGHT - 36, drag.origY + dy)),
    );
    setDecorations((prev) =>
      updateSticker(prev, drag.id, {
        x: nx,
        y: ny,
      }),
    );
    setLiveStatus(`Moved sticker to (${nx}, ${ny}).`);
  };

  const handleUndo = () => {
    setDecorations((prev) => undoDecoration(prev));
    setLiveStatus("Undid last purikura decoration.");
  };

  const handleClear = () => {
    setDecorations((prev) => clearDecorations(prev));
    setLiveStatus("Cleared all purikura doodles and stickers.");
  };

  const handleDownloadPng = () => {
    const canvas = stripCanvasRef.current;
    if (!canvas) return;
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = downloadFilename;
      anchor.style.display = "none";
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      setTimeout(() => URL.revokeObjectURL(url), 2500);
      setDownloadCount((c) => c + 1);
      setLastDownloadName(downloadFilename);
      setLiveStatus(`Downloaded ${downloadFilename} (${STRIP_WIDTH}×${STRIP_HEIGHT} PNG).`);
    }, "image/png");
  };

  const handlePrintStrip = () => {
    setPrintCount((c) => c + 1);
    setLiveStatus("Printing ~5×15cm torn-paper photo strip.");
    if (typeof window !== "undefined" && typeof window.print === "function") {
      window.print();
    }
  };

  return (
    <div
      className="booth-root"
      data-testid="booth-studio"
      data-hydrated={hydrated ? "true" : "false"}
      data-film-stock={filmStock}
      data-camera-state={cameraStatus.state}
      data-stream-active={cameraStatus.streamActive ? "true" : "false"}
      data-fallback-reason={cameraStatus.fallbackReason ?? ""}
      data-capturing={isCapturing ? "true" : "false"}
      data-shot-count={String(
        cameraStatus.capturedCount > 0 ? cameraStatus.capturedCount : MAX_BOOTH_CAPTURES,
      )}
      data-shutter-count={String(shutterCount)}
      data-flash-count={String(flashCount)}
      data-countdown-log={countdownLog}
      data-reduced-motion={reducedMotion ? "true" : "false"}
      data-renderer-backend={rendererBackend}
      data-stroke-count={String(decorations.strokes.length)}
      data-sticker-count={String(decorations.stickers.length)}
      data-history-count={String(decorations.history.length)}
      data-download-count={String(downloadCount)}
      data-last-download={lastDownloadName}
      data-print-count={String(printCount)}
    >
      {/* Sticky Status & Privacy Bar */}
      <div
        className="booth-status-bar"
        data-testid="booth-status-bar"
        role="region"
        aria-label="Photobooth privacy and status"
      >
        <div className="booth-status-copy">
          <p
            className="booth-privacy-notice"
            data-testid="booth-privacy-notice"
          >
            <span className="booth-privacy-dot" aria-hidden="true" />
            {BOOTH_PRIVACY_COPY}
          </p>
          <p
            className="booth-live-status"
            data-testid="booth-live-status"
            aria-live="polite"
          >
            {liveStatus}
          </p>
        </div>

        <div className="booth-status-actions">
          <button
            type="button"
            className="btn btn-sm"
            data-testid="booth-sound-toggle"
            aria-pressed={soundOn}
            onClick={() => setSound(!soundOn)}
          >
            {soundOn ? "Sound: On" : "Sound: Off"}
          </button>
          <button
            type="button"
            className="btn btn-sm btn-primary"
            data-testid="booth-capture-btn"
            disabled={isCapturing}
            onClick={handleStartCapture}
          >
            {isCapturing ? "Shooting 3-2-1…" : "Take 4 photos"}
          </button>
        </div>
      </div>

      <div className="booth-workbench">
        {/* Left Column: Viewfinder, Camera Opt-In, Film Stocks, and Purikura Doodle Palette */}
        <section
          className="booth-panel booth-viewfinder-panel"
          aria-labelledby="booth-viewfinder-heading"
        >
          <div className="booth-panel-header">
            <h2 id="booth-viewfinder-heading" className="caption">
              1 · Booth Viewfinder &amp; Film Stock
            </h2>
            <span className="caption" data-testid="booth-source-label">
              {cameraStatus.state === "streaming"
                ? "Live camera (local)"
                : "Sample paper portrait"}
            </span>
          </div>

          <div
            className="booth-viewfinder-stage"
            data-testid="booth-viewfinder-stage"
          >
            <video
              ref={videoRef}
              className="booth-hidden-video"
              muted
              playsInline
              aria-hidden="true"
            />
            <canvas
              ref={viewfinderCanvasRef}
              width={FRAME_W}
              height={FRAME_H}
              className="booth-viewfinder-canvas"
              data-testid="booth-viewfinder-canvas"
              aria-label={`Live viewfinder rendered in ${FILM_STOCKS[filmStock].label}`}
            />

            <div className="booth-hud-bar">
              <span className="booth-badge" data-testid="booth-stock-badge">
                {FILM_STOCKS[filmStock].label}
              </span>
              <span className="booth-badge" data-testid="booth-frame-counter">
                {isCapturing
                  ? `Shot ${activeShotIndex + 1} / ${MAX_BOOTH_CAPTURES}`
                  : `${MAX_BOOTH_CAPTURES} / ${MAX_BOOTH_CAPTURES} frames`}
              </span>
            </div>

            {countdownNumber !== null && (
              <div
                className="booth-countdown-overlay"
                data-testid="booth-countdown"
                data-count={String(countdownNumber)}
              >
                <span className="booth-countdown-number">
                  {countdownNumber}
                </span>
              </div>
            )}

            <div
              className="booth-ink-flash"
              data-testid="booth-ink-flash"
              data-active={isFlashing ? "true" : "false"}
              data-reduced-motion={reducedMotion ? "true" : "false"}
              aria-hidden="true"
            />

            {(reducedMotion || isFlashing || shutterCount > 0) && (
              <div
                className="booth-static-click-indicator"
                data-testid="booth-static-click-indicator"
                data-active={isFlashing ? "true" : "false"}
              >
                {isFlashing
                  ? `CLICK · SHOT ${activeShotIndex + 1}/4`
                  : shutterCount > 0
                    ? `SHUTTER · ${shutterCount} CLACKS`
                    : "REDUCED MOTION · STATIC SHUTTER"}
              </div>
            )}
          </div>

          {/* Camera Opt-In & Sample Fallback Buttons */}
          <div className="booth-action-row">
            <button
              type="button"
              className="btn"
              data-testid="booth-open-camera"
              aria-pressed={cameraStatus.state === "streaming"}
              disabled={isCapturing}
              onClick={handleOpenCamera}
            >
              Open camera
            </button>
            <button
              type="button"
              className="btn"
              data-testid="booth-use-sample"
              aria-pressed={cameraStatus.state === "sample"}
              disabled={isCapturing}
              onClick={handleUseSamplePortrait}
            >
              Use sample portrait
            </button>
            {cameraStatus.streamActive && (
              <button
                type="button"
                className="btn btn-sm"
                data-testid="booth-close-camera"
                onClick={handleCloseCamera}
              >
                Close camera
              </button>
            )}
          </div>

          {/* Film Stock Selector */}
          <div>
            <span className="label">Film stock (live shader / kernel)</span>
            <div
              className="booth-stock-grid"
              role="group"
              aria-label="Film stock"
            >
              {FILM_STOCK_LIST.map((stock) => (
                <button
                  key={stock.id}
                  type="button"
                  className="booth-stock-btn"
                  data-testid={`stock-${stock.id}`}
                  aria-pressed={filmStock === stock.id}
                  onClick={() => handleSelectFilmStock(stock.id)}
                >
                  <span className="booth-stock-title">
                    <span
                      className="booth-stock-swatch"
                      style={{ background: stock.primaryInkHex }}
                      aria-hidden="true"
                    />
                    {stock.label}
                  </span>
                  <span className="booth-stock-sub">{stock.subtitle}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Purikura Pen & Stickers */}
          <div
            className="booth-doodle-controls"
            data-testid="booth-doodle-controls"
          >
            <div className="booth-panel-header">
              <span className="caption">2 · Purikura Ink Pen &amp; Stickers</span>
              <div className="booth-control-group">
                <button
                  type="button"
                  className="btn btn-sm"
                  data-testid="booth-undo"
                  disabled={decorations.history.length === 0}
                  onClick={handleUndo}
                >
                  Undo
                </button>
                <button
                  type="button"
                  className="btn btn-sm"
                  data-testid="booth-clear"
                  disabled={
                    decorations.strokes.length === 0 &&
                    decorations.stickers.length === 0
                  }
                  onClick={handleClear}
                >
                  Clear doodles
                </button>
              </div>
            </div>

            {/* Tool & Brush Width */}
            <div className="booth-control-group" role="group" aria-label="Drawing tool and width">
              <button
                type="button"
                className="btn btn-sm booth-tool-btn"
                data-testid="tool-pen"
                aria-pressed={activeTool === "pen"}
                onClick={() => setActiveTool("pen")}
              >
                Ink pen
              </button>
              <button
                type="button"
                className="btn btn-sm booth-tool-btn"
                data-testid="tool-eraser"
                aria-pressed={activeTool === "eraser"}
                onClick={() => setActiveTool("eraser")}
              >
                Eraser
              </button>
              {BRUSH_WIDTHS.map((w) => (
                <button
                  key={w}
                  type="button"
                  className="btn btn-sm booth-width-btn"
                  data-testid={`brush-width-${w}`}
                  aria-pressed={brushWidth === w}
                  onClick={() => setBrushWidth(w)}
                >
                  {w}px
                </button>
              ))}
              <button
                type="button"
                className="btn btn-sm"
                data-testid="booth-draw-flourish"
                onClick={handleAddSampleStroke}
              >
                Draw brush stroke
              </button>
            </div>

            {/* Ink Colours */}
            <div
              className="booth-control-group"
              role="group"
              aria-label="Ink colour"
            >
              {INK_COLOR_IDS.map((cid) => {
                const c = INK_COLORS[cid];
                return (
                  <button
                    key={cid}
                    type="button"
                    className="booth-color-btn"
                    data-testid={`ink-color-${cid}`}
                    aria-pressed={inkColor === cid}
                    onClick={() => {
                      setInkColor(cid);
                      setActiveTool("pen");
                    }}
                  >
                    <span
                      className="booth-color-dot"
                      style={{ background: c.hex }}
                      aria-hidden="true"
                    />
                    {c.label}
                  </button>
                );
              })}
            </div>

            {/* Sticker Catalog */}
            <div>
              <span className="label">Stamp a purikura sticker</span>
              <div className="booth-sticker-grid">
                {STICKER_CATALOG.map((st) => (
                  <button
                    key={st.kind}
                    type="button"
                    className="booth-sticker-btn"
                    data-testid={`add-sticker-${st.kind}`}
                    onClick={() => handleAddSticker(st.kind)}
                  >
                    <span aria-hidden="true">{st.glyph}</span>
                    <span>{st.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Active Sticker Transform Controls */}
            {activeSticker && (
              <div
                className="booth-control-group"
                data-testid="booth-sticker-transform-bar"
                 data-active-sticker-id={activeSticker.id}
              >
                <span className="caption">
                  Sticker ({activeSticker.kind}):
                </span>
                <button
                  type="button"
                  className="btn btn-sm"
                  data-testid="sticker-nudge-right"
                  onClick={() => handleTransformActiveSticker({ dx: 24, dy: -12 })}
                >
                  Move ↗
                </button>
                <button
                  type="button"
                  className="btn btn-sm"
                  data-testid="sticker-scale-up"
                  onClick={() => handleTransformActiveSticker({ dScale: 0.25 })}
                >
                  Scale +
                </button>
                <button
                  type="button"
                  className="btn btn-sm"
                  data-testid="sticker-scale-down"
                  onClick={() => handleTransformActiveSticker({ dScale: -0.25 })}
                >
                  Scale −
                </button>
                <button
                  type="button"
                  className="btn btn-sm"
                  data-testid="sticker-rotate-right"
                  onClick={() => handleTransformActiveSticker({ dRot: 0.35 })}
                >
                  Rotate ↻
                </button>
                <button
                  type="button"
                  className="btn btn-sm"
                  data-testid="sticker-remove"
                  onClick={handleRemoveActiveSticker}
                >
                  Remove sticker
                </button>
              </div>
            )}
          </div>
        </section>

        {/* Right Column: Assembled 600x1800 Torn-Paper 4-Frame Strip, Hanko Stamp, Export & Print */}
        <section
          className="booth-panel booth-strip-panel"
          aria-labelledby="booth-strip-heading"
        >
          <div className="booth-panel-header booth-no-print">
            <h2 id="booth-strip-heading" className="caption">
              3 · Torn-Paper 4-Frame Strip ({STRIP_WIDTH}×{STRIP_HEIGHT})
            </h2>
            <span className="caption" data-testid="booth-hanko-date">
              印 · {hankoDate} · {STRIP_FOOTER_TEXT}
            </span>
          </div>

          <div className="booth-strip-stage-wrap">
            <div className="booth-strip-stage" data-testid="booth-strip-stage">
              <canvas
                ref={stripCanvasRef}
                width={STRIP_WIDTH}
                height={STRIP_HEIGHT}
                tabIndex={0}
                className="booth-strip-canvas"
                data-testid="booth-strip-canvas"
                data-hanko-date={hankoDate}
                data-footer-text={STRIP_FOOTER_TEXT}
                aria-label={`Assembled 4-frame torn-paper photo strip stamped ${hankoDate} with ${STRIP_FOOTER_TEXT} footer. Drag pointer or press Space to draw purikura ink strokes.`}
                onPointerDown={handleStripPointerDown}
                onPointerMove={handleStripPointerMove}
                onPointerUp={commitActiveStroke}
                onPointerCancel={commitActiveStroke}
                onKeyDown={handleStripKeyDown}
              />

              {/* Interactive Sticker Drag Handles over the Strip */}
              <div
                className="booth-sticker-overlay-layer"
                data-testid="booth-sticker-layer"
              >
                {decorations.stickers.map((st) => (
                  <button
                    key={st.id}
                    type="button"
                    className="booth-sticker-handle"
                    data-testid={`sticker-handle-${st.id}`}
                    data-sticker-kind={st.kind}
                    data-selected={
                      activeSticker?.id === st.id ? "true" : "false"
                    }
                    style={{
                      left: `${(st.x / STRIP_WIDTH) * 100}%`,
                      top: `${(st.y / STRIP_HEIGHT) * 100}%`,
                    }}
                    aria-label={`${st.kind} sticker at (${st.x}, ${st.y})`}
                    onPointerDown={(e) =>
                      handleStickerPointerDown(e, st.id, st.x, st.y)
                    }
                    onPointerMove={handleStickerPointerMove}
                    onPointerUp={handleStickerPointerUp}
                  >
                    {st.kind}
                  </button>
                ))}
              </div>
            </div>

            <div
              className="booth-strip-meta booth-no-print"
              data-testid="booth-strip-meta"
            >
              <span>
                Hanko seal:{" "}
                <strong data-testid="booth-hanko-readout">
                  {stripLayout.hanko.dateText}
                </strong>
              </span>
              <span>
                Footer:{" "}
                <strong data-testid="booth-footer-readout">
                  {stripLayout.footer.text}
                </strong>
              </span>
            </div>

            <div
              className="booth-action-row booth-strip-export-bar"
              data-testid="booth-export-bar"
            >
              <button
                type="button"
                className="btn btn-primary"
                data-testid="booth-download-png"
                onClick={handleDownloadPng}
              >
                Download PNG ({downloadFilename})
              </button>
              <button
                type="button"
                className="btn"
                data-testid="booth-print-strip"
                onClick={handlePrintStrip}
              >
                Print strip (~5×15cm)
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
