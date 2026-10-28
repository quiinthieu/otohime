// Torn-paper 4-frame strip composer (~600x1800), seeded random polyline edge mask,
// red circular date hanko stamp (YYYY.MM.DD), 'otohime.dev' footer, and vector purikura
// decoration model (ink pen strokes, eraser, undo, clear, and draggable/scalable/rotatable stickers).

import {
  createPixelBuffer,
  FILM_STOCKS,
  type FilmStockId,
  type PixelBuffer,
} from "./film-stock.ts";

export const STRIP_WIDTH = 600;
export const STRIP_HEIGHT = 1800;
export const STRIP_FRAME_COUNT = 4;
export const STRIP_FOOTER_TEXT = "otohime.dev";
export const DEFAULT_STRIP_SEED = 0x70757269;

export interface Point2D {
  readonly x: number;
  readonly y: number;
}

export type InkColorId = "sumi" | "vermilion" | "indigo" | "gold";

export interface InkColorDefinition {
  readonly id: InkColorId;
  readonly label: string;
  readonly hex: string;
  readonly rgb: readonly [number, number, number];
}

export const INK_COLORS: Readonly<Record<InkColorId, InkColorDefinition>> = Object.freeze({
  sumi: Object.freeze({
    id: "sumi",
    label: "Sumi Black",
    hex: "#1a1816",
    rgb: Object.freeze([26, 24, 22] as const),
  }),
  vermilion: Object.freeze({
    id: "vermilion",
    label: "Shu Vermilion",
    hex: "#d23228",
    rgb: Object.freeze([210, 50, 40] as const),
  }),
  indigo: Object.freeze({
    id: "indigo",
    label: "Ai Indigo",
    hex: "#1e486e",
    rgb: Object.freeze([30, 72, 110] as const),
  }),
  gold: Object.freeze({
    id: "gold",
    label: "Kinpaku Gold",
    hex: "#c6922c",
    rgb: Object.freeze([198, 146, 44] as const),
  }),
});

export const INK_COLOR_IDS: readonly InkColorId[] = Object.freeze([
  "sumi",
  "vermilion",
  "indigo",
  "gold",
]);

export const BRUSH_WIDTHS = Object.freeze([3, 6, 12] as const);

export type StickerKind =
  | "star"
  | "heart"
  | "sparkle"
  | "hanko-cat"
  | "cloud"
  | "cherry"
  | "crown"
  | "peace";

export interface StickerDefinition {
  readonly kind: StickerKind;
  readonly label: string;
  readonly glyph: string;
  readonly defaultColor: InkColorId;
}

export const STICKER_CATALOG: readonly StickerDefinition[] = Object.freeze([
  Object.freeze({ kind: "star", label: "Star", glyph: "★", defaultColor: "gold" }),
  Object.freeze({ kind: "heart", label: "Heart", glyph: "♥", defaultColor: "vermilion" }),
  Object.freeze({ kind: "sparkle", label: "Sparkle", glyph: "✦", defaultColor: "gold" }),
  Object.freeze({ kind: "hanko-cat", label: "Neko Seal", glyph: "猫", defaultColor: "vermilion" }),
  Object.freeze({ kind: "cloud", label: "Ink Cloud", glyph: "☁", defaultColor: "indigo" }),
  Object.freeze({ kind: "cherry", label: "Sakura", glyph: "❀", defaultColor: "vermilion" }),
  Object.freeze({ kind: "crown", label: "Crown", glyph: "♛", defaultColor: "gold" }),
  Object.freeze({ kind: "peace", label: "Peace", glyph: "✌", defaultColor: "sumi" }),
]);

export interface PurikuraStroke {
  readonly id: string;
  readonly tool: "pen" | "eraser";
  readonly color: InkColorId;
  readonly width: number;
  readonly points: readonly Point2D[];
}

export interface PurikuraSticker {
  readonly id: string;
  readonly kind: StickerKind;
  readonly x: number;
  readonly y: number;
  readonly scale: number;
  readonly rotationRad: number;
  readonly color: InkColorId;
}

export interface DecorationSnapshot {
  readonly strokes: readonly PurikuraStroke[];
  readonly stickers: readonly PurikuraSticker[];
}

export interface PurikuraDecorationState {
  readonly strokes: readonly PurikuraStroke[];
  readonly stickers: readonly PurikuraSticker[];
  readonly history: readonly DecorationSnapshot[];
  readonly nextId: number;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

export function formatHankoDate(input?: Date | number | string): string {
  if (typeof input === "string" && /^\d{4}[.-]\d{2}[.-]\d{2}$/.test(input.trim())) {
    return input.trim().replace(/-/g, ".");
  }
  const d =
    input instanceof Date
      ? input
      : typeof input === "number" || typeof input === "string"
        ? new Date(input)
        : new Date();
  const valid = Number.isFinite(d.getTime()) ? d : new Date(Date.UTC(2026, 9, 28));
  const yyyy = String(valid.getUTCFullYear()).padStart(4, "0");
  const mm = String(valid.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(valid.getUTCDate()).padStart(2, "0");
  return `${yyyy}.${mm}.${dd}`;
}

export function formatBoothDownloadFilename(input?: Date | number | string): string {
  const digits = formatHankoDate(input).replace(/\./g, "");
  return `otohime-booth-${digits}.png`;
}

/**
 * Generates a deterministic torn-paper perimeter polygon around a `width x height` strip.
 * Top and bottom edges have stronger serration teeth; left and right edges have subtle fibrous deckle.
 */
export function createTornPaperPolygon(
  width = STRIP_WIDTH,
  height = STRIP_HEIGHT,
  seed = DEFAULT_STRIP_SEED,
): readonly Point2D[] {
  const w = Math.max(64, Math.floor(width));
  const h = Math.max(64, Math.floor(height));
  const rand = mulberry32(seed);
  const points: Point2D[] = [];

  const marginX = Math.max(4, Math.round(w * 0.018));
  const marginY = Math.max(6, Math.round(h * 0.01));
  const topSteps = 28;
  const sideSteps = 56;

  // Top torn edge (left -> right)
  for (let i = 0; i <= topSteps; i++) {
    const t = i / topSteps;
    const x = marginX + t * (w - marginX * 2);
    const tooth = ((i & 1) === 0 ? 1 : -1) * (2.5 + rand() * 4.5);
    const jitter = (rand() - 0.5) * 4;
    const y = clamp(marginY + tooth + jitter, 1, marginY * 2.4);
    points.push(Object.freeze({ x: Number(x.toFixed(2)), y: Number(y.toFixed(2)) }));
  }

  // Right deckled edge (top -> bottom)
  for (let i = 1; i < sideSteps; i++) {
    const t = i / sideSteps;
    const y = marginY + t * (h - marginY * 2);
    const deckle = (rand() - 0.5) * 7 + Math.sin(t * Math.PI * 7) * 2;
    const x = clamp(w - marginX + deckle, w - marginX * 2.2, w - 1);
    points.push(Object.freeze({ x: Number(x.toFixed(2)), y: Number(y.toFixed(2)) }));
  }

  // Bottom torn edge (right -> left)
  for (let i = 0; i <= topSteps; i++) {
    const t = 1 - i / topSteps;
    const x = marginX + t * (w - marginX * 2);
    const tooth = ((i & 1) === 0 ? -1 : 1) * (3 + rand() * 5.5);
    const jitter = (rand() - 0.5) * 4.5;
    const y = clamp(h - marginY + tooth + jitter, h - marginY * 2.6, h - 1);
    points.push(Object.freeze({ x: Number(x.toFixed(2)), y: Number(y.toFixed(2)) }));
  }

  // Left deckled edge (bottom -> top)
  for (let i = 1; i < sideSteps; i++) {
    const t = 1 - i / sideSteps;
    const y = marginY + t * (h - marginY * 2);
    const deckle = (rand() - 0.5) * 7 + Math.cos(t * Math.PI * 6) * 2;
    const x = clamp(marginX + deckle, 1, marginX * 2.2);
    points.push(Object.freeze({ x: Number(x.toFixed(2)), y: Number(y.toFixed(2)) }));
  }

  return Object.freeze(points);
}

export function isPointInPolygon(
  x: number,
  y: number,
  polygon: readonly Point2D[],
): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;
    const intersect =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi + 1e-12) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export interface StripFramePlacement {
  readonly index: 0 | 1 | 2 | 3;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly tiltRad: number;
}

export interface HankoStampLayout {
  readonly cx: number;
  readonly cy: number;
  readonly radius: number;
  readonly dateText: string;
  readonly colorHex: string;
  readonly rgb: readonly [number, number, number];
}

export interface StripFooterLayout {
  readonly text: typeof STRIP_FOOTER_TEXT;
  readonly stockLabel: string;
  readonly x: number;
  readonly y: number;
}

export interface StripLayout {
  readonly width: number;
  readonly height: number;
  readonly seed: number;
  readonly polygon: readonly Point2D[];
  readonly frames: readonly StripFramePlacement[];
  readonly hanko: HankoStampLayout;
  readonly footer: StripFooterLayout;
}

export interface StripLayoutOptions {
  readonly width?: number;
  readonly height?: number;
  readonly seed?: number;
  readonly date?: Date | number | string;
  readonly stock?: FilmStockId;
}

export function computeStripLayout(options: StripLayoutOptions = {}): StripLayout {
  const width = Math.max(200, Math.floor(options.width ?? STRIP_WIDTH));
  const height = Math.max(600, Math.floor(options.height ?? STRIP_HEIGHT));
  const seed = options.seed ?? DEFAULT_STRIP_SEED;
  const stock = options.stock ?? "sumi-e";
  const polygon = createTornPaperPolygon(width, height, seed);
  const rand = mulberry32(seed ^ 0x46524d);

  const scaleX = width / STRIP_WIDTH;
  const scaleY = height / STRIP_HEIGHT;
  const frameW = Math.round(488 * scaleX);
  const frameH = Math.round(332 * scaleY);
  const frameX = Math.round((width - frameW) / 2);
  const topPad = Math.round(52 * scaleY);
  const gapY = Math.round(28 * scaleY);

  const baseSigns = [-1, 1, -1, 1] as const;
  const frames: StripFramePlacement[] = [];
  for (let i = 0; i < STRIP_FRAME_COUNT; i++) {
    const fy = topPad + i * (frameH + gapY);
    const tiltMag = 0.008 + rand() * 0.011; // ~0.45 to 1.1 deg
    const tiltRad = Number((baseSigns[i] * tiltMag).toFixed(5));
    frames.push(
      Object.freeze({
        index: i as 0 | 1 | 2 | 3,
        x: frameX,
        y: fy,
        width: frameW,
        height: frameH,
        tiltRad,
      }),
    );
  }

  const hanko: HankoStampLayout = Object.freeze({
    cx: Math.round(476 * scaleX),
    cy: Math.round(1646 * scaleY),
    radius: Math.max(18, Math.round(56 * Math.min(scaleX, scaleY))),
    dateText: formatHankoDate(options.date),
    colorHex: "#c82822",
    rgb: Object.freeze([200, 40, 34] as const),
  });

  const footer: StripFooterLayout = Object.freeze({
    text: STRIP_FOOTER_TEXT,
    stockLabel: FILM_STOCKS[stock].label,
    x: Math.round(58 * scaleX),
    y: Math.round(1642 * scaleY),
  });

  return Object.freeze({
    width,
    height,
    seed,
    polygon,
    frames: Object.freeze(frames),
    hanko,
    footer,
  });
}

// --- Vector Purikura Decoration State & Reducers ---

export function createDecorationState(): PurikuraDecorationState {
  return Object.freeze({
    strokes: Object.freeze([]),
    stickers: Object.freeze([]),
    history: Object.freeze([]),
    nextId: 1,
  });
}

function pushHistory(state: PurikuraDecorationState): readonly DecorationSnapshot[] {
  const snap: DecorationSnapshot = Object.freeze({
    strokes: state.strokes,
    stickers: state.stickers,
  });
  return Object.freeze([...state.history, snap]);
}

export function addPenStroke(
  state: PurikuraDecorationState,
  input: {
    readonly points: readonly Point2D[];
    readonly color?: InkColorId;
    readonly width?: number;
  },
): PurikuraDecorationState {
  if (!input.points || input.points.length === 0) return state;
  const color: InkColorId =
    input.color && input.color in INK_COLORS ? input.color : "sumi";
  const width = clamp(Number.isFinite(input.width) ? Number(input.width) : 6, 1, 36);
  const stroke: PurikuraStroke = Object.freeze({
    id: `stroke-${state.nextId}`,
    tool: "pen",
    color,
    width,
    points: Object.freeze(
      input.points.map((p) => Object.freeze({ x: Number(p.x), y: Number(p.y) })),
    ),
  });
  return Object.freeze({
    strokes: Object.freeze([...state.strokes, stroke]),
    stickers: state.stickers,
    history: pushHistory(state),
    nextId: state.nextId + 1,
  });
}

export function addEraserStroke(
  state: PurikuraDecorationState,
  input: {
    readonly points: readonly Point2D[];
    readonly width?: number;
  },
): PurikuraDecorationState {
  if (!input.points || input.points.length === 0) return state;
  const width = clamp(Number.isFinite(input.width) ? Number(input.width) : 16, 4, 64);
  const stroke: PurikuraStroke = Object.freeze({
    id: `stroke-${state.nextId}`,
    tool: "eraser",
    color: "sumi",
    width,
    points: Object.freeze(
      input.points.map((p) => Object.freeze({ x: Number(p.x), y: Number(p.y) })),
    ),
  });
  return Object.freeze({
    strokes: Object.freeze([...state.strokes, stroke]),
    stickers: state.stickers,
    history: pushHistory(state),
    nextId: state.nextId + 1,
  });
}

export function addSticker(
  state: PurikuraDecorationState,
  input: {
    readonly kind: StickerKind;
    readonly x: number;
    readonly y: number;
    readonly scale?: number;
    readonly rotationRad?: number;
    readonly color?: InkColorId;
  },
): PurikuraDecorationState {
  const def =
    STICKER_CATALOG.find((s) => s.kind === input.kind) ?? STICKER_CATALOG[0];
  const color =
    input.color && input.color in INK_COLORS ? input.color : def.defaultColor;
  const sticker: PurikuraSticker = Object.freeze({
    id: `sticker-${state.nextId}`,
    kind: def.kind,
    x: Number(input.x),
    y: Number(input.y),
    scale: clamp(Number.isFinite(input.scale) ? Number(input.scale) : 1, 0.25, 4),
    rotationRad: Number.isFinite(input.rotationRad) ? Number(input.rotationRad) : 0,
    color,
  });
  return Object.freeze({
    strokes: state.strokes,
    stickers: Object.freeze([...state.stickers, sticker]),
    history: pushHistory(state),
    nextId: state.nextId + 1,
  });
}

export function updateSticker(
  state: PurikuraDecorationState,
  stickerId: string,
  patch: {
    readonly x?: number;
    readonly y?: number;
    readonly scale?: number;
    readonly rotationRad?: number;
    readonly color?: InkColorId;
  },
): PurikuraDecorationState {
  const index = state.stickers.findIndex((s) => s.id === stickerId);
  if (index === -1) return state;
  const current = state.stickers[index];
  const updated: PurikuraSticker = Object.freeze({
    ...current,
    x: patch.x !== undefined && Number.isFinite(patch.x) ? Number(patch.x) : current.x,
    y: patch.y !== undefined && Number.isFinite(patch.y) ? Number(patch.y) : current.y,
    scale:
      patch.scale !== undefined && Number.isFinite(patch.scale)
        ? clamp(Number(patch.scale), 0.25, 4)
        : current.scale,
    rotationRad:
      patch.rotationRad !== undefined && Number.isFinite(patch.rotationRad)
        ? Number(patch.rotationRad)
        : current.rotationRad,
    color:
      patch.color && patch.color in INK_COLORS ? patch.color : current.color,
  });
  const nextStickers = [...state.stickers];
  nextStickers[index] = updated;
  return Object.freeze({
    strokes: state.strokes,
    stickers: Object.freeze(nextStickers),
    history: pushHistory(state),
    nextId: state.nextId,
  });
}

export function removeSticker(
  state: PurikuraDecorationState,
  stickerId: string,
): PurikuraDecorationState {
  const nextStickers = state.stickers.filter((s) => s.id !== stickerId);
  if (nextStickers.length === state.stickers.length) return state;
  return Object.freeze({
    strokes: state.strokes,
    stickers: Object.freeze(nextStickers),
    history: pushHistory(state),
    nextId: state.nextId,
  });
}

export function undoDecoration(
  state: PurikuraDecorationState,
): PurikuraDecorationState {
  if (state.history.length === 0) return state;
  const previous = state.history[state.history.length - 1];
  return Object.freeze({
    strokes: previous.strokes,
    stickers: previous.stickers,
    history: Object.freeze(state.history.slice(0, -1)),
    nextId: state.nextId,
  });
}

export function clearDecorations(
  state: PurikuraDecorationState,
): PurikuraDecorationState {
  if (state.strokes.length === 0 && state.stickers.length === 0) return state;
  return Object.freeze({
    strokes: Object.freeze([]),
    stickers: Object.freeze([]),
    history: pushHistory(state),
    nextId: state.nextId,
  });
}

// --- Crisp 5x7 Bitmap Font for pure PixelBuffer rendering of YYYY.MM.DD & otohime.dev ---

const GLYPHS_5X7: Readonly<Record<string, readonly number[]>> = {
  "0": [0b01110, 0b10001, 0b10011, 0b10101, 0b11001, 0b10001, 0b01110],
  "1": [0b00100, 0b01100, 0b00100, 0b00100, 0b00100, 0b00100, 0b01110],
  "2": [0b01110, 0b10001, 0b00001, 0b00110, 0b01000, 0b10000, 0b11111],
  "3": [0b11110, 0b00001, 0b00001, 0b01110, 0b00001, 0b00001, 0b11110],
  "4": [0b00010, 0b00110, 0b01010, 0b10010, 0b11111, 0b00010, 0b00010],
  "5": [0b11111, 0b10000, 0b11110, 0b00001, 0b00001, 0b10001, 0b01110],
  "6": [0b00110, 0b01000, 0b10000, 0b11110, 0b10001, 0b10001, 0b01110],
  "7": [0b11111, 0b00001, 0b00010, 0b00100, 0b01000, 0b01000, 0b01000],
  "8": [0b01110, 0b10001, 0b10001, 0b01110, 0b10001, 0b10001, 0b01110],
  "9": [0b01110, 0b10001, 0b10001, 0b01111, 0b00001, 0b00010, 0b01100],
  ".": [0b00000, 0b00000, 0b00000, 0b00000, 0b00000, 0b01100, 0b01100],
  "-": [0b00000, 0b00000, 0b00000, 0b11111, 0b00000, 0b00000, 0b00000],
  o: [0b00000, 0b00000, 0b01110, 0b10001, 0b10001, 0b10001, 0b01110],
  t: [0b01000, 0b01000, 0b11110, 0b01000, 0b01000, 0b01001, 0b00110],
  h: [0b10000, 0b10000, 0b11110, 0b10001, 0b10001, 0b10001, 0b10001],
  i: [0b00100, 0b00000, 0b01100, 0b00100, 0b00100, 0b00100, 0b01110],
  m: [0b00000, 0b00000, 0b11010, 0b10101, 0b10101, 0b10101, 0b10101],
  e: [0b00000, 0b00000, 0b01110, 0b10001, 0b11111, 0b10000, 0b01110],
  d: [0b00001, 0b00001, 0b01111, 0b10001, 0b10001, 0b10001, 0b01111],
  v: [0b00000, 0b00000, 0b10001, 0b10001, 0b10001, 0b01010, 0b00100],
  " ": [0b00000, 0b00000, 0b00000, 0b00000, 0b00000, 0b00000, 0b00000],
};

function measureBitmapTextWidth(
  text: string,
  scale: number,
  compactDot = false,
): number {
  if (text.length === 0) return 0;
  const s = Math.max(1, Math.round(scale));
  let total = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const glyphW = compactDot && ch === "." ? 2 * s : 5 * s;
    const gap = i < text.length - 1 ? 1 * s : 0;
    total += glyphW + gap;
  }
  return total;
}

function drawBitmapText(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  text: string,
  startX: number,
  startY: number,
  scale: number,
  rgb: readonly [number, number, number],
  options?: {
    readonly compactDot?: boolean;
    readonly clipCircle?: {
      readonly cx: number;
      readonly cy: number;
      readonly maxRadius: number;
    };
  },
): void {
  const s = Math.max(1, Math.round(scale));
  let cursorX = Math.round(startX);
  const baseY = Math.round(startY);
  const compactDot = options?.compactDot ?? false;
  const clip = options?.clipCircle;

  for (const ch of text) {
    const isCompactDot = compactDot && ch === ".";
    const rows = GLYPHS_5X7[ch] ?? GLYPHS_5X7[ch.toLowerCase()] ?? GLYPHS_5X7[" "];
    const colCount = isCompactDot ? 2 : 5;
    for (let ry = 0; ry < 7; ry++) {
      const rowBits = isCompactDot ? (ry >= 5 ? 0b11000 : 0) : rows[ry];
      for (let rx = 0; rx < colCount; rx++) {
        if ((rowBits & (1 << (4 - rx))) !== 0) {
          for (let dy = 0; dy < s; dy++) {
            const py = baseY + ry * s + dy;
            if (py < 0 || py >= height) continue;
            for (let dx = 0; dx < s; dx++) {
              const px = cursorX + rx * s + dx;
              if (px < 0 || px >= width) continue;
              if (
                clip &&
                Math.hypot(px - clip.cx, py - clip.cy) > clip.maxRadius
              ) {
                continue;
              }
              const idx = (py * width + px) * 4;
              if (data[idx + 3] === 0) continue;
              data[idx] = rgb[0];
              data[idx + 1] = rgb[1];
              data[idx + 2] = rgb[2];
            }
          }
        }
      }
    }
    cursorX += (colCount + 1) * s;
  }
}

function drawCapsuleSegment(
  buf: Uint8ClampedArray,
  width: number,
  height: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  radius: number,
  rgba: readonly [number, number, number, number],
): void {
  const r = Math.max(0.75, radius);
  const minX = Math.max(0, Math.floor(Math.min(x0, x1) - r - 1));
  const maxX = Math.min(width - 1, Math.ceil(Math.max(x0, x1) + r + 1));
  const minY = Math.max(0, Math.floor(Math.min(y0, y1) - r - 1));
  const maxY = Math.min(height - 1, Math.ceil(Math.max(y0, y1) + r + 1));

  const dx = x1 - x0;
  const dy = y1 - y0;
  const lenSq = dx * dx + dy * dy;

  for (let py = minY; py <= maxY; py++) {
    for (let px = minX; px <= maxX; px++) {
      const t =
        lenSq > 1e-6
          ? clamp(((px - x0) * dx + (py - y0) * dy) / lenSq, 0, 1)
          : 0;
      const projX = x0 + t * dx;
      const projY = y0 + t * dy;
      const dist = Math.hypot(px - projX, py - projY);
      if (dist <= r) {
        const idx = (py * width + px) * 4;
        buf[idx] = rgba[0];
        buf[idx + 1] = rgba[1];
        buf[idx + 2] = rgba[2];
        buf[idx + 3] = rgba[3];
      }
    }
  }
}

function rasterizeSticker(
  buf: Uint8ClampedArray,
  width: number,
  height: number,
  sticker: PurikuraSticker,
  scaleFactor = 1,
): void {
  const rgb = INK_COLORS[sticker.color]?.rgb ?? INK_COLORS.vermilion.rgb;
  const baseRadius = Math.max(8, 26 * sticker.scale * scaleFactor);
  const cosR = Math.cos(-sticker.rotationRad);
  const sinR = Math.sin(-sticker.rotationRad);

  const minX = Math.max(0, Math.floor(sticker.x - baseRadius * 1.35));
  const maxX = Math.min(width - 1, Math.ceil(sticker.x + baseRadius * 1.35));
  const minY = Math.max(0, Math.floor(sticker.y - baseRadius * 1.35));
  const maxY = Math.min(height - 1, Math.ceil(sticker.y + baseRadius * 1.35));

  for (let py = minY; py <= maxY; py++) {
    for (let px = minX; px <= maxX; px++) {
      const dx = (px - sticker.x) / baseRadius;
      const dy = (py - sticker.y) / baseRadius;
      const lx = dx * cosR - dy * sinR;
      const ly = dx * sinR + dy * cosR;
      const r = Math.hypot(lx, ly);

      let inside = false;
      let isBorder = false;

      if (sticker.kind === "star" || sticker.kind === "sparkle") {
        const spikes = sticker.kind === "star" ? 5 : 4;
        const angle = Math.atan2(ly, lx);
        const wave = Math.cos(angle * spikes) * 0.34 + 0.62;
        inside = r <= wave;
        isBorder = inside && r >= wave - 0.14;
      } else if (sticker.kind === "heart") {
        // Implicit heart curve
        const hx = lx * 1.25;
        const hy = -ly * 1.25 + 0.18;
        const a = hx * hx + hy * hy - 0.55;
        const val = a * a * a - hx * hx * hy * hy * hy;
        inside = val <= 0;
        isBorder = inside && val >= -0.04;
      } else {
        // Circular stamp / badge sticker
        inside = r <= 0.88;
        isBorder = inside && (r >= 0.72 || (r >= 0.28 && r <= 0.38));
      }

      if (inside) {
        const idx = (py * width + px) * 4;
        if (isBorder) {
          buf[idx] = 252;
          buf[idx + 1] = 248;
          buf[idx + 2] = 238;
          buf[idx + 3] = 255;
        } else {
          buf[idx] = rgb[0];
          buf[idx + 1] = rgb[1];
          buf[idx + 2] = rgb[2];
          buf[idx + 3] = 255;
        }
      }
    }
  }
}

export interface ComposeStripOptions extends StripLayoutOptions {
  readonly decorations?: PurikuraDecorationState;
}

/**
 * Composes 4 captured frames onto a vertical torn-paper strip (~600x1800 default) with:
 * - Seeded random polyline edge mask (alpha = 0 outside torn polygon, warm washi inside)
 * - 4 slightly tilted frames with dark ink mat framing
 * - Red circular date hanko stamp formatted YYYY.MM.DD
 * - 'otohime.dev' footer
 * - Vector purikura decoration layer (pen strokes, eraser, and stickers)
 */
export function composeStripBuffer(
  frames: readonly PixelBuffer[],
  options: ComposeStripOptions = {},
): PixelBuffer {
  const layout = computeStripLayout(options);
  const { width, height, polygon, hanko, footer } = layout;
  const scaleFactor = Math.min(width / STRIP_WIDTH, height / STRIP_HEIGHT);
  const out = new Uint8ClampedArray(width * height * 4);

  // Precompute horizontal scanline bounds [leftX, rightX] of the torn-paper polygon for fast clipping
  const leftBound = new Int32Array(height);
  const rightBound = new Int32Array(height);
  for (let y = 0; y < height; y++) {
    const xs: number[] = [];
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const p1 = polygon[i];
      const p2 = polygon[j];
      if ((p1.y <= y && p2.y > y) || (p2.y <= y && p1.y > y)) {
        const x = p1.x + ((y - p1.y) * (p2.x - p1.x)) / (p2.y - p1.y);
        xs.push(x);
      }
    }
    if (xs.length >= 2) {
      xs.sort((a, b) => a - b);
      leftBound[y] = Math.max(0, Math.ceil(xs[0]));
      rightBound[y] = Math.min(width - 1, Math.floor(xs[xs.length - 1]));
    } else {
      leftBound[y] = width;
      rightBound[y] = -1;
    }
  }

  // 1. Fill warm washi paper inside the torn-paper polygon mask (outside remains transparent alpha = 0)
  for (let y = 0; y < height; y++) {
    const xl = leftBound[y];
    const xr = rightBound[y];
    if (xl > xr) continue;
    for (let x = xl; x <= xr; x++) {
      const edgeDist = Math.min(x - xl, xr - x, y, height - 1 - y);
      const fiber = (((x * 37 + y * 13 + layout.seed) & 15) - 7.5) * 0.45;
      const borderShade = edgeDist < 4 ? (4 - edgeDist) * 8 : 0;
      const idx = (y * width + x) * 4;
      out[idx] = Math.max(0, Math.min(255, Math.round(246 + fiber - borderShade)));
      out[idx + 1] = Math.max(0, Math.min(255, Math.round(240 + fiber - borderShade)));
      out[idx + 2] = Math.max(0, Math.min(255, Math.round(227 + fiber - borderShade)));
      out[idx + 3] = 255;
    }
  }

  // 2. Blit the 4 captured frames into their tilted frame slots
  const borderPad = Math.max(2, Math.round(6 * scaleFactor));
  for (const slot of layout.frames) {
    const src = frames[slot.index] ?? frames[0];
    if (!src) continue;
    const cx = slot.x + slot.width * 0.5;
    const cy = slot.y + slot.height * 0.5;
    const cosT = Math.cos(-slot.tiltRad);
    const sinT = Math.sin(-slot.tiltRad);
    const halfW = slot.width * 0.5 + borderPad;
    const halfH = slot.height * 0.5 + borderPad;
    const innerW = slot.width * 0.5;
    const innerH = slot.height * 0.5;

    const minY = Math.max(0, Math.floor(cy - halfH - 12));
    const maxY = Math.min(height - 1, Math.ceil(cy + halfH + 12));
    const minX = Math.max(0, Math.floor(cx - halfW - 12));
    const maxX = Math.min(width - 1, Math.ceil(cx + halfW + 12));

    for (let py = minY; py <= maxY; py++) {
      const xl = leftBound[py];
      const xr = rightBound[py];
      for (let px = minX; px <= maxX; px++) {
        if (px < xl || px > xr) continue;
        const dx = px - cx;
        const dy = py - cy;
        const lx = dx * cosT - dy * sinT;
        const ly = dx * sinT + dy * cosT;
        if (Math.abs(lx) <= innerW && Math.abs(ly) <= innerH) {
          const u = clamp((lx + innerW) / slot.width, 0, 0.999999);
          const v = clamp((ly + innerH) / slot.height, 0, 0.999999);
          const sx = Math.floor(u * src.width);
          const sy = Math.floor(v * src.height);
          const sIdx = (sy * src.width + sx) * 4;
          const dIdx = (py * width + px) * 4;
          out[dIdx] = src.data[sIdx];
          out[dIdx + 1] = src.data[sIdx + 1];
          out[dIdx + 2] = src.data[sIdx + 2];
          out[dIdx + 3] = 255;
        } else if (Math.abs(lx) <= halfW && Math.abs(ly) <= halfH) {
          // Dark sumi photo frame border
          const dIdx = (py * width + px) * 4;
          out[dIdx] = 28;
          out[dIdx + 1] = 26;
          out[dIdx + 2] = 24;
          out[dIdx + 3] = 255;
        }
      }
    }
  }

  // 3. Draw red circular date hanko stamp (YYYY.MM.DD)
  const hR = hanko.radius;
  const hMinX = Math.max(0, Math.floor(hanko.cx - hR - 2));
  const hMaxX = Math.min(width - 1, Math.ceil(hanko.cx + hR + 2));
  const hMinY = Math.max(0, Math.floor(hanko.cy - hR - 2));
  const hMaxY = Math.min(height - 1, Math.ceil(hanko.cy + hR + 2));

  for (let py = hMinY; py <= hMaxY; py++) {
    const xl = leftBound[py];
    const xr = rightBound[py];
    for (let px = hMinX; px <= hMaxX; px++) {
      if (px < xl || px > xr) continue;
      const dx = px - hanko.cx;
      const dy = py - hanko.cy;
      const d = Math.hypot(dx, dy);
      const outerRing = d >= hR * 0.85 && d <= hR;
      const innerRing = d >= hR * 0.70 && d <= hR * 0.74;
      const bars =
        d <= hR * 0.66 &&
        Math.abs(dx) <= hR * 0.48 &&
        (Math.abs(dy + hR * 0.38) <= Math.max(1, hR * 0.028) ||
          Math.abs(dy - hR * 0.38) <= Math.max(1, hR * 0.028));
      // Subtle ink distress grain so it reads like a real hand-pressed vermilion seal
      const sealGrain = ((px * 19 + py * 31) & 7) !== 0;
      if ((outerRing || innerRing || bars) && sealGrain) {
        const idx = (py * width + px) * 4;
        out[idx] = hanko.rgb[0];
        out[idx + 1] = hanko.rgb[1];
        out[idx + 2] = hanko.rgb[2];
      }
    }
  }

  // Render YYYY.MM.DD text stacked inside the inner hanko circle (d <= hR * 0.72)
  const dotIdx = hanko.dateText.indexOf(".");
  const yearLine =
    dotIdx > 0 ? hanko.dateText.slice(0, dotIdx) : hanko.dateText.slice(0, 4);
  const monthDayLine =
    dotIdx > 0 ? hanko.dateText.slice(dotIdx + 1) : hanko.dateText.slice(4);
  const dateScale = hR * 0.66 >= 31 ? 2 : 1;
  const maxInnerDateRadius = hR * 0.72;
  const clipCircle = {
    cx: hanko.cx,
    cy: hanko.cy,
    maxRadius: maxInnerDateRadius,
  };
  const yearWidth = measureBitmapTextWidth(yearLine, dateScale, true);
  const monthDayWidth = measureBitmapTextWidth(monthDayLine, dateScale, true);

  drawBitmapText(
    out,
    width,
    height,
    yearLine,
    hanko.cx - yearWidth * 0.5,
    hanko.cy - 8 * dateScale,
    dateScale,
    hanko.rgb,
    { compactDot: true, clipCircle },
  );
  drawBitmapText(
    out,
    width,
    height,
    monthDayLine,
    hanko.cx - monthDayWidth * 0.5,
    hanko.cy + 1 * dateScale,
    dateScale,
    hanko.rgb,
    { compactDot: true, clipCircle },
  );

  // 4. Draw 'otohime.dev' footer text in sumi ink
  const footerScale = Math.max(1, Math.round(scaleFactor * 2.5));
  drawBitmapText(
    out,
    width,
    height,
    footer.text,
    footer.x,
    footer.y,
    footerScale,
    INK_COLORS.sumi.rgb,
  );

  // 5. Composite the vector purikura decoration layer (strokes, eraser, stickers)
  const decorations = options.decorations;
  if (
    decorations &&
    (decorations.strokes.length > 0 || decorations.stickers.length > 0)
  ) {
    const doodleBuf = new Uint8ClampedArray(width * height * 4);
    for (const stroke of decorations.strokes) {
      const rgba: readonly [number, number, number, number] =
        stroke.tool === "eraser"
          ? [0, 0, 0, 0]
          : [...(INK_COLORS[stroke.color]?.rgb ?? INK_COLORS.sumi.rgb), 255];
      const radius = Math.max(1, (stroke.width * scaleFactor) / 2);
      if (stroke.points.length === 1) {
        const p = stroke.points[0];
        drawCapsuleSegment(doodleBuf, width, height, p.x, p.y, p.x, p.y, radius, rgba);
      } else {
        for (let i = 1; i < stroke.points.length; i++) {
          const p0 = stroke.points[i - 1];
          const p1 = stroke.points[i];
          drawCapsuleSegment(
            doodleBuf,
            width,
            height,
            p0.x,
            p0.y,
            p1.x,
            p1.y,
            radius,
            rgba,
          );
        }
      }
    }

    for (const sticker of decorations.stickers) {
      rasterizeSticker(doodleBuf, width, height, sticker, scaleFactor);
    }

    // Alpha-composite doodleBuf onto the strip inside the torn-paper polygon
    for (let y = 0; y < height; y++) {
      const xl = leftBound[y];
      const xr = rightBound[y];
      if (xl > xr) continue;
      for (let x = xl; x <= xr; x++) {
        const idx = (y * width + x) * 4;
        const a = doodleBuf[idx + 3];
        if (a > 0) {
          out[idx] = doodleBuf[idx];
          out[idx + 1] = doodleBuf[idx + 1];
          out[idx + 2] = doodleBuf[idx + 2];
          out[idx + 3] = 255;
        }
      }
    }
  }

  return createPixelBuffer(width, height, out);
}
