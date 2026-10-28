// Pure film-stock definitions, raw WebGL2 full-screen quad shaders, WebGL2 renderer with
// automatic webglcontextlost fallback, and deterministic Canvas 2D / RGBA ImageData kernels
// for the Ink Purikura Photobooth (/play/booth).

export type FilmStockId = "sumi-e" | "riso" | "newsprint";

export const FILM_STOCK_IDS: readonly FilmStockId[] = [
  "sumi-e",
  "riso",
  "newsprint",
] as const;

export interface FilmStockDefinition {
  readonly id: FilmStockId;
  readonly label: string;
  readonly subtitle: string;
  readonly description: string;
  readonly modeUniform: 0 | 1 | 2;
  readonly paperHex: string;
  readonly primaryInkHex: string;
  readonly secondaryInkHex?: string;
}

export const FILM_STOCKS: Readonly<Record<FilmStockId, FilmStockDefinition>> = Object.freeze({
  "sumi-e": Object.freeze({
    id: "sumi-e",
    label: "Sumi-e Wash",
    subtitle: "墨絵 · Washi & Carbon Ink",
    description: "Multi-band luminance ink wash thresholding with fibrous washi grain and brush-edge darkening.",
    modeUniform: 0,
    paperHex: "#f4eee1",
    primaryInkHex: "#181614",
  }),
  riso: Object.freeze({
    id: "riso",
    label: "Riso Two-Tone",
    subtitle: "孔版 · Berry & Teal Halftone",
    description: "Rotated two-colour halftone screens (fluorescent berry & teal indigo) with multiply blend and slight misregistration.",
    modeUniform: 1,
    paperHex: "#faf4e8",
    primaryInkHex: "#126e82",
    secondaryInkHex: "#e63472",
  }),
  newsprint: Object.freeze({
    id: "newsprint",
    label: "Newsprint 45°",
    subtitle: "新聞 · Rotary Dot Screen",
    description: "Single 45-degree smoothstepped halftone dot screen printed on warm grey newsprint stock.",
    modeUniform: 2,
    paperHex: "#e8e1d1",
    primaryInkHex: "#23211e",
  }),
});

export const FILM_STOCK_LIST: readonly FilmStockDefinition[] = Object.freeze(
  FILM_STOCK_IDS.map((id) => FILM_STOCKS[id]),
);

export function isFilmStockId(value: unknown): value is FilmStockId {
  return value === "sumi-e" || value === "riso" || value === "newsprint";
}

export interface PixelBuffer {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8ClampedArray;
}

export function createPixelBuffer(
  width: number,
  height: number,
  data?: Uint8ClampedArray,
): PixelBuffer {
  const w = Math.max(1, Math.floor(width));
  const h = Math.max(1, Math.floor(height));
  const buf = data ?? new Uint8ClampedArray(w * h * 4);
  if (typeof ImageData === "function") {
    try {
      const clamped = new Uint8ClampedArray(w * h * 4);
      clamped.set(buf.subarray(0, w * h * 4));
      return new ImageData(clamped, w, h);
    } catch {
      // Fallback for non-DOM environments
    }
  }
  return { width: w, height: h, data: buf };
}

export const BOOTH_VERTEX_SHADER_SOURCE = `#version 300 es
precision highp float;
in vec2 a_position;
out vec2 v_uv;
uniform float u_mirror;

void main() {
  vec2 uv = a_position * 0.5 + 0.5;
  uv.y = 1.0 - uv.y;
  if (u_mirror > 0.5) {
    uv.x = 1.0 - uv.x;
  }
  v_uv = uv;
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

export const BOOTH_FRAGMENT_SHADER_SOURCE = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 outColor;

uniform sampler2D u_tex;
uniform vec2 u_resolution;
uniform int u_mode;
uniform float u_seed;

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031 + u_seed * 0.017);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float luma(vec3 c) {
  return dot(c, vec3(0.299, 0.587, 0.114));
}

float halftoneDot(vec2 fragCoord, float angleRad, float cellSize, float darkness) {
  float c = cos(angleRad);
  float s = sin(angleRad);
  mat2 rot = mat2(c, -s, s, c);
  vec2 grid = (rot * fragCoord) / cellSize;
  vec2 cell = fract(grid) - 0.5;
  float dist = length(cell);
  float radius = sqrt(clamp(darkness, 0.0, 1.0)) * 0.66;
  return 1.0 - smoothstep(radius - 0.08, radius + 0.08, dist);
}

void main() {
  vec2 px = 1.0 / max(u_resolution, vec2(1.0));
  vec2 fragCoord = v_uv * u_resolution;
  vec3 col = texture(u_tex, v_uv).rgb;
  float grain = (hash12(floor(fragCoord)) - 0.5);

  if (u_mode == 0) {
    // sumi-e ink wash: blurred neighborhood luma + gradient edge + multi-band thresholds + washi grain
    float l0 = luma(col);
    float lN = luma(texture(u_tex, v_uv + vec2(0.0, -px.y)).rgb);
    float lS = luma(texture(u_tex, v_uv + vec2(0.0, px.y)).rgb);
    float lE = luma(texture(u_tex, v_uv + vec2(px.x, 0.0)).rgb);
    float lW = luma(texture(u_tex, v_uv + vec2(-px.x, 0.0)).rgb);
    float avg = (l0 * 2.0 + lN + lS + lE + lW) / 6.0;
    float edge = abs(lE - lW) + abs(lS - lN);
    float fiber = (hash12(vec2(floor(fragCoord.x * 0.25), floor(fragCoord.y))) - 0.5) * 0.08;
    float tone = clamp(avg - edge * 0.45 + grain * 0.07 + fiber, 0.0, 1.0);

    vec3 inkDeep = vec3(0.086, 0.082, 0.075);
    vec3 inkMid = vec3(0.24, 0.224, 0.204);
    vec3 inkWash = vec3(0.49, 0.463, 0.427);
    vec3 inkMist = vec3(0.76, 0.725, 0.675);
    vec3 washi = vec3(0.957, 0.933, 0.882);

    vec3 result = mix(inkDeep, inkMid, smoothstep(0.16, 0.30, tone));
    result = mix(result, inkWash, smoothstep(0.32, 0.50, tone));
    result = mix(result, inkMist, smoothstep(0.52, 0.70, tone));
    result = mix(result, washi, smoothstep(0.72, 0.86, tone));
    outColor = vec4(clamp(result + grain * 0.02, 0.0, 1.0), 1.0);
  } else if (u_mode == 1) {
    // riso two-colour halftone: teal (15 deg) + berry pink (75 deg, misregistered) with multiply blend
    vec2 offsetUv = clamp(v_uv + vec2(2.2, -1.4) * px, 0.0, 1.0);
    vec3 colShift = texture(u_tex, offsetUv).rgb;
    float lumTeal = luma(col);
    float warmShift = clamp((colShift.r * 0.65 + (1.0 - colShift.b) * 0.35), 0.0, 1.0);
    float lumBerry = luma(colShift);

    float tealDark = clamp((1.0 - lumTeal) * 0.92, 0.0, 1.0);
    float berryDark = clamp((1.0 - lumBerry) * 0.58 + warmShift * 0.34, 0.0, 1.0);

    float dotTeal = halftoneDot(fragCoord, 0.261799, 6.0, tealDark);
    float dotBerry = halftoneDot(fragCoord + vec2(2.2, -1.4), 1.308997, 6.0, berryDark);

    vec3 paper = vec3(0.980, 0.957, 0.910);
    vec3 tealPlate = mix(vec3(1.0), vec3(0.071, 0.431, 0.510), dotTeal * 0.92);
    vec3 berryPlate = mix(vec3(1.0), vec3(0.902, 0.204, 0.447), dotBerry * 0.88);
    vec3 blended = paper * tealPlate * berryPlate + grain * 0.018;
    outColor = vec4(clamp(blended, 0.0, 1.0), 1.0);
  } else {
    // newsprint 45-degree dot screen on warm newsprint stock
    float lum = luma(col);
    float darkness = clamp((1.0 - lum) * 0.95 + grain * 0.04, 0.0, 1.0);
    float dotAmt = halftoneDot(fragCoord, 0.785398, 5.5, darkness);
    vec3 stock = vec3(0.910, 0.882, 0.820) + grain * 0.025;
    vec3 ink = vec3(0.137, 0.129, 0.118);
    outColor = vec4(clamp(mix(stock, ink, dotAmt), 0.0, 1.0), 1.0);
  }
}
`;

export const FILM_STOCK_SHADERS: Readonly<
  Record<FilmStockId, { readonly vertex: string; readonly fragment: string; readonly modeUniform: 0 | 1 | 2 }>
> = Object.freeze({
  "sumi-e": Object.freeze({
    vertex: BOOTH_VERTEX_SHADER_SOURCE,
    fragment: BOOTH_FRAGMENT_SHADER_SOURCE,
    modeUniform: 0,
  }),
  riso: Object.freeze({
    vertex: BOOTH_VERTEX_SHADER_SOURCE,
    fragment: BOOTH_FRAGMENT_SHADER_SOURCE,
    modeUniform: 1,
  }),
  newsprint: Object.freeze({
    vertex: BOOTH_VERTEX_SHADER_SOURCE,
    fragment: BOOTH_FRAGMENT_SHADER_SOURCE,
    modeUniform: 2,
  }),
});

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function clampByte(v: number): number {
  return v < 0 ? 0 : v > 255 ? 255 : Math.round(v);
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

function mix(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

// Deterministic coordinate hash in [0, 1)
function hash2d(x: number, y: number, seed: number): number {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(seed | 0, 1442695041)) >>> 0;
  h = (h ^ (h >>> 13)) >>> 0;
  h = Math.imul(h, 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function sampleHalftoneDot(
  x: number,
  y: number,
  cosA: number,
  sinA: number,
  cellSize: number,
  darkness: number,
): number {
  const gx = (x * cosA - y * sinA) / cellSize;
  const gy = (x * sinA + y * cosA) / cellSize;
  const cx = gx - Math.floor(gx) - 0.5;
  const cy = gy - Math.floor(gy) - 0.5;
  const dist = Math.hypot(cx, cy);
  const radius = Math.sqrt(clamp01(darkness)) * 0.66;
  return 1 - smoothstep(radius - 0.08, radius + 0.08, dist);
}

export interface FilmStockKernelOptions {
  readonly seed?: number;
  readonly mirror?: boolean;
  readonly cellSize?: number;
  readonly misregistrationPx?: readonly [number, number];
}

export function applySumiEKernel(
  input: PixelBuffer,
  options: FilmStockKernelOptions = {},
): PixelBuffer {
  const { width, height, data } = input;
  const seed = options.seed ?? 101;
  const mirror = options.mirror ?? false;
  const out = new Uint8ClampedArray(width * height * 4);

  // Precompute pixel luminance
  const lum = new Float32Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < height && x < width; x++) {
      // handled below
    }
  }
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const sx = mirror ? width - 1 - x : x;
      const idx = (y * width + sx) * 4;
      lum[y * width + x] = (0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2]) / 255;
    }
  }

  for (let y = 0; y < height; y++) {
    const yN = y > 0 ? y - 1 : y;
    const yS = y < height - 1 ? y + 1 : y;
    for (let x = 0; x < width; x++) {
      const xW = x > 0 ? x - 1 : x;
      const xE = x < width - 1 ? x + 1 : x;
      const l0 = lum[y * width + x];
      const lN = lum[yN * width + x];
      const lS = lum[yS * width + x];
      const lW = lum[y * width + xW];
      const lE = lum[y * width + xE];

      const avg = (l0 * 2 + lN + lS + lW + lE) / 6;
      const edge = Math.abs(lE - lW) + Math.abs(lS - lN);
      const grain = hash2d(x, y, seed) - 0.5;
      const fiber = (hash2d(x >> 2, y, seed ^ 0x55aa) - 0.5) * 0.08;
      const tone = clamp01(avg - edge * 0.45 + grain * 0.07 + fiber);

      const t1 = smoothstep(0.16, 0.30, tone);
      const t2 = smoothstep(0.32, 0.50, tone);
      const t3 = smoothstep(0.52, 0.70, tone);
      const t4 = smoothstep(0.72, 0.86, tone);

      let r = mix(22, 61, t1);
      let g = mix(21, 57, t1);
      let b = mix(19, 52, t1);

      r = mix(r, 125, t2);
      g = mix(g, 118, t2);
      b = mix(b, 109, t2);

      r = mix(r, 194, t3);
      g = mix(g, 185, t3);
      b = mix(b, 172, t3);

      r = mix(r, 244, t4);
      g = mix(g, 238, t4);
      b = mix(b, 225, t4);

      const dither = grain * 5;
      const outIdx = (y * width + x) * 4;
      out[outIdx] = clampByte(r + dither);
      out[outIdx + 1] = clampByte(g + dither);
      out[outIdx + 2] = clampByte(b + dither);
      out[outIdx + 3] = 255;
    }
  }

  return createPixelBuffer(width, height, out);
}

export function applyRisoKernel(
  input: PixelBuffer,
  options: FilmStockKernelOptions = {},
): PixelBuffer {
  const { width, height, data } = input;
  const seed = options.seed ?? 202;
  const mirror = options.mirror ?? false;
  const cellSize = Math.max(3, options.cellSize ?? 6);
  const [misX, misY] = options.misregistrationPx ?? [2, -1];
  const out = new Uint8ClampedArray(width * height * 4);

  const cosTeal = Math.cos((15 * Math.PI) / 180);
  const sinTeal = Math.sin((15 * Math.PI) / 180);
  const cosBerry = Math.cos((75 * Math.PI) / 180);
  const sinBerry = Math.sin((75 * Math.PI) / 180);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const sx = mirror ? width - 1 - x : x;
      const idx = (y * width + sx) * 4;
      const r0 = data[idx] / 255;
      const g0 = data[idx + 1] / 255;
      const b0 = data[idx + 2] / 255;
      const lumTeal = 0.299 * r0 + 0.587 * g0 + 0.114 * b0;

      // Misregistered sample for the fluorescent berry plate
      const bxRaw = Math.max(0, Math.min(width - 1, x + misX));
      const byRaw = Math.max(0, Math.min(height - 1, y + misY));
      const bsx = mirror ? width - 1 - bxRaw : bxRaw;
      const bIdx = (byRaw * width + bsx) * 4;
      const r1 = data[bIdx] / 255;
      const g1 = data[bIdx + 1] / 255;
      const b1 = data[bIdx + 2] / 255;
      const lumBerry = 0.299 * r1 + 0.587 * g1 + 0.114 * b1;
      const warmShift = clamp01(r1 * 0.65 + (1 - b1) * 0.35);

      const tealDark = clamp01((1 - lumTeal) * 0.92);
      const berryDark = clamp01((1 - lumBerry) * 0.58 + warmShift * 0.34);

      const dotTeal = sampleHalftoneDot(x, y, cosTeal, sinTeal, cellSize, tealDark);
      const dotBerry = sampleHalftoneDot(
        x + misX,
        y + misY,
        cosBerry,
        sinBerry,
        cellSize,
        berryDark,
      );

      // Multiply blend of Teal (#126e82) and Fluorescent Berry (#e63472) on Riso warm stock (#faf4e8)
      const tAmt = dotTeal * 0.92;
      const bAmt = dotBerry * 0.88;

      const tealR = mix(1, 18 / 255, tAmt);
      const tealG = mix(1, 110 / 255, tAmt);
      const tealB = mix(1, 130 / 255, tAmt);

      const berryR = mix(1, 230 / 255, bAmt);
      const berryG = mix(1, 52 / 255, bAmt);
      const berryB = mix(1, 114 / 255, bAmt);

      const grain = (hash2d(x, y, seed) - 0.5) * 4.5;
      const outIdx = (y * width + x) * 4;
      out[outIdx] = clampByte(250 * tealR * berryR + grain);
      out[outIdx + 1] = clampByte(244 * tealG * berryG + grain);
      out[outIdx + 2] = clampByte(232 * tealB * berryB + grain);
      out[outIdx + 3] = 255;
    }
  }

  return createPixelBuffer(width, height, out);
}

export function applyNewsprintKernel(
  input: PixelBuffer,
  options: FilmStockKernelOptions = {},
): PixelBuffer {
  const { width, height, data } = input;
  const seed = options.seed ?? 303;
  const mirror = options.mirror ?? false;
  const cellSize = Math.max(3, options.cellSize ?? 5.5);
  const out = new Uint8ClampedArray(width * height * 4);

  const cos45 = Math.SQRT1_2;
  const sin45 = Math.SQRT1_2;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const sx = mirror ? width - 1 - x : x;
      const idx = (y * width + sx) * 4;
      const lum = (0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2]) / 255;
      const grain = hash2d(x, y, seed) - 0.5;
      const darkness = clamp01((1 - lum) * 0.95 + grain * 0.04);
      const dotAmt = sampleHalftoneDot(x, y, cos45, sin45, cellSize, darkness);

      // Warm newsprint stock (#e8e1d1) -> rotary press ink (#23211e)
      const paperGrain = grain * 6;
      const r = mix(232 + paperGrain, 35, dotAmt);
      const g = mix(225 + paperGrain, 33, dotAmt);
      const b = mix(209 + paperGrain, 30, dotAmt);

      const outIdx = (y * width + x) * 4;
      out[outIdx] = clampByte(r);
      out[outIdx + 1] = clampByte(g);
      out[outIdx + 2] = clampByte(b);
      out[outIdx + 3] = 255;
    }
  }

  return createPixelBuffer(width, height, out);
}

export function applyFilmStockKernel(
  input: PixelBuffer,
  stock: FilmStockId,
  options: FilmStockKernelOptions = {},
): PixelBuffer {
  switch (stock) {
    case "sumi-e":
      return applySumiEKernel(input, options);
    case "riso":
      return applyRisoKernel(input, options);
    case "newsprint":
      return applyNewsprintKernel(input, options);
  }
}

export interface FilmStockRendererOptions {
  readonly preferCanvas2D?: boolean;
  readonly onContextLost?: () => void;
}

export interface FilmStockRenderer {
  readonly backend: "webgl2" | "canvas2d";
  readonly contextLost: boolean;
  render(
    source: PixelBuffer,
    stock: FilmStockId,
    options?: FilmStockKernelOptions,
  ): PixelBuffer;
  forceContextLoss(): void;
  dispose(): void;
}

//Minimal structural interface so Node tests can supply a mock canvas or real HTMLCanvasElement
export interface RendererCanvasLike {
  width: number;
  height: number;
  getContext(contextId: string, options?: unknown): unknown;
  addEventListener?(
    type: string,
    listener: (event: { preventDefault?: () => void }) => void,
    options?: unknown,
  ): void;
  removeEventListener?(
    type: string,
    listener: (event: { preventDefault?: () => void }) => void,
  ): void;
}

interface WebGL2Like {
  readonly VERTEX_SHADER: number;
  readonly FRAGMENT_SHADER: number;
  readonly COMPILE_STATUS: number;
  readonly LINK_STATUS: number;
  readonly ARRAY_BUFFER: number;
  readonly STATIC_DRAW: number;
  readonly FLOAT: number;
  readonly TRIANGLE_STRIP: number;
  readonly TEXTURE_2D: number;
  readonly TEXTURE0: number;
  readonly RGBA: number;
  readonly UNSIGNED_BYTE: number;
  readonly TEXTURE_WRAP_S: number;
  readonly TEXTURE_WRAP_T: number;
  readonly TEXTURE_MIN_FILTER: number;
  readonly TEXTURE_MAG_FILTER: number;
  readonly CLAMP_TO_EDGE: number;
  readonly LINEAR: number;
  createShader(type: number): unknown;
  shaderSource(shader: unknown, source: string): void;
  compileShader(shader: unknown): void;
  getShaderParameter(shader: unknown, pname: number): unknown;
  deleteShader(shader: unknown): void;
  createProgram(): unknown;
  attachShader(program: unknown, shader: unknown): void;
  linkProgram(program: unknown): void;
  getProgramParameter(program: unknown, pname: number): unknown;
  useProgram(program: unknown): void;
  deleteProgram(program: unknown): void;
  createBuffer(): unknown;
  bindBuffer(target: number, buffer: unknown): void;
  bufferData(target: number, data: Float32Array, usage: number): void;
  deleteBuffer(buffer: unknown): void;
  getAttribLocation(program: unknown, name: string): number;
  enableVertexAttribArray(index: number): void;
  vertexAttribPointer(
    index: number,
    size: number,
    type: number,
    normalized: boolean,
    stride: number,
    offset: number,
  ): void;
  createTexture(): unknown;
  activeTexture(texture: number): void;
  bindTexture(target: number, texture: unknown): void;
  texParameteri(target: number, pname: number, param: number): void;
  texImage2D(
    target: number,
    level: number,
    internalformat: number,
    width: number,
    height: number,
    border: number,
    format: number,
    type: number,
    pixels: Uint8ClampedArray,
  ): void;
  deleteTexture(texture: unknown): void;
  getUniformLocation(program: unknown, name: string): unknown;
  uniform1i(location: unknown, v: number): void;
  uniform1f(location: unknown, v: number): void;
  uniform2f(location: unknown, x: number, y: number): void;
  viewport(x: number, y: number, width: number, height: number): void;
  drawArrays(mode: number, first: number, count: number): void;
  readPixels(
    x: number,
    y: number,
    width: number,
    height: number,
    format: number,
    type: number,
    pixels: Uint8Array,
  ): void;
  isContextLost?(): boolean;
}

export function createFilmStockRenderer(
  canvas?: RendererCanvasLike | null,
  options: FilmStockRendererOptions = {},
): FilmStockRenderer {
  let contextLost = false;
  let gl: WebGL2Like | null = null;
  let program: unknown = null;
  let quadBuffer: unknown = null;
  let texture: unknown = null;

  const onContextLost = (event: { preventDefault?: () => void }) => {
    event?.preventDefault?.();
    contextLost = true;
    gl = null;
    options.onContextLost?.();
  };

  if (canvas?.addEventListener) {
    canvas.addEventListener("webglcontextlost", onContextLost);
  }

  if (canvas && !options.preferCanvas2D) {
    try {
      const candidate = canvas.getContext("webgl2", {
        preserveDrawingBuffer: true,
        antialias: false,
      }) as WebGL2Like | null;
      if (candidate && typeof candidate.createShader === "function") {
        const vs = candidate.createShader(candidate.VERTEX_SHADER);
        const fs = candidate.createShader(candidate.FRAGMENT_SHADER);
        if (vs && fs) {
          candidate.shaderSource(vs, BOOTH_VERTEX_SHADER_SOURCE);
          candidate.compileShader(vs);
          candidate.shaderSource(fs, BOOTH_FRAGMENT_SHADER_SOURCE);
          candidate.compileShader(fs);
          const vsOk = Boolean(candidate.getShaderParameter(vs, candidate.COMPILE_STATUS));
          const fsOk = Boolean(candidate.getShaderParameter(fs, candidate.COMPILE_STATUS));
          if (vsOk && fsOk) {
            const prog = candidate.createProgram();
            if (prog) {
              candidate.attachShader(prog, vs);
              candidate.attachShader(prog, fs);
              candidate.linkProgram(prog);
              if (candidate.getProgramParameter(prog, candidate.LINK_STATUS)) {
                gl = candidate;
                program = prog;
                quadBuffer = candidate.createBuffer();
                candidate.bindBuffer(candidate.ARRAY_BUFFER, quadBuffer);
                candidate.bufferData(
                  candidate.ARRAY_BUFFER,
                  new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
                  candidate.STATIC_DRAW,
                );
                texture = candidate.createTexture();
              }
            }
          }
          candidate.deleteShader(vs);
          candidate.deleteShader(fs);
        }
      }
    } catch {
      gl = null;
    }
  }

  return {
    get backend() {
      return gl && !contextLost ? "webgl2" : "canvas2d";
    },
    get contextLost() {
      return contextLost;
    },
    render(
      source: PixelBuffer,
      stock: FilmStockId,
      kernelOptions: FilmStockKernelOptions = {},
    ): PixelBuffer {
      if (gl && !contextLost && program && quadBuffer && texture && canvas) {
        try {
          if (gl.isContextLost?.()) {
            onContextLost({});
            return applyFilmStockKernel(source, stock, kernelOptions);
          }
          const { width, height } = source;
          canvas.width = width;
          canvas.height = height;
          gl.viewport(0, 0, width, height);
          gl.useProgram(program);

          gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
          const posLoc = gl.getAttribLocation(program, "a_position");
          gl.enableVertexAttribArray(posLoc);
          gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

          gl.activeTexture(gl.TEXTURE0);
          gl.bindTexture(gl.TEXTURE_2D, texture);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
          gl.texImage2D(
            gl.TEXTURE_2D,
            0,
            gl.RGBA,
            width,
            height,
            0,
            gl.RGBA,
            gl.UNSIGNED_BYTE,
            source.data,
          );

          gl.uniform1i(gl.getUniformLocation(program, "u_tex"), 0);
          gl.uniform2f(gl.getUniformLocation(program, "u_resolution"), width, height);
          gl.uniform1i(
            gl.getUniformLocation(program, "u_mode"),
            FILM_STOCKS[stock].modeUniform,
          );
          gl.uniform1f(
            gl.getUniformLocation(program, "u_seed"),
            kernelOptions.seed ?? 101,
          );
          gl.uniform1f(
            gl.getUniformLocation(program, "u_mirror"),
            kernelOptions.mirror ? 1 : 0,
          );

          gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

          const raw = new Uint8Array(width * height * 4);
          gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, raw);
          // Check if readPixels returned a non-blank frame; if WebGL readback is all zeros (e.g. headless stub), fall back to deterministic kernel
          let nonZero = false;
          for (let i = 0; i < raw.length; i += 16) {
            if (raw[i] !== 0 || raw[i + 1] !== 0 || raw[i + 2] !== 0) {
              nonZero = true;
              break;
            }
          }
          if (nonZero) {
            // Flip rows from WebGL bottom-up origin to top-down ImageData origin
            const flipped = new Uint8ClampedArray(width * height * 4);
            const rowBytes = width * 4;
            for (let y = 0; y < height; y++) {
              const srcOffset = (height - 1 - y) * rowBytes;
              const dstOffset = y * rowBytes;
              flipped.set(raw.subarray(srcOffset, srcOffset + rowBytes), dstOffset);
            }
            return createPixelBuffer(width, height, flipped);
          }
        } catch {
          onContextLost({});
        }
      }
      return applyFilmStockKernel(source, stock, kernelOptions);
    },
    forceContextLoss() {
      onContextLost({});
    },
    dispose() {
      if (canvas?.removeEventListener) {
        canvas.removeEventListener("webglcontextlost", onContextLost);
      }
      if (gl) {
        try {
          if (texture) gl.deleteTexture(texture);
          if (quadBuffer) gl.deleteBuffer(quadBuffer);
          if (program) gl.deleteProgram(program);
        } catch {
          // ignore cleanup errors on lost context
        }
      }
      gl = null;
      program = null;
      quadBuffer = null;
      texture = null;
    },
  };
}
