"use client";

// The Ink Poster Press on /play: a typed phrase printed as a poster in wet ink. lib/ink-press.ts decides the look from
// one seed (layout, tilt, inks, misregistration); this draws it. The type, the stamp's frame, the brush's swash and
// riso's block are painted by Canvas2D into a mask texture (type in red, block in green), and one WebGL2 fragment
// shader prints it: an fbm warp wobbles the mask, a blur whose reach grows while the ink is wet lowers the bleed
// threshold past the type's edge, and the paper's grain and each layout's texture (a stamp's patchy pressure, riso's
// two drums overprinted out of register, a dry brush's streaks) go on top. Fresh ink dries over DRY_MS and then the
// frame holds: no animation frame runs once it is dry, while the tab is hidden, or while the poster is off-screen.
// Under reduced motion the press prints one dried frame and never asks for an animation frame.
//
// Without WebGL2 (or once its context is lost) the poster is SVG under the site's ink filter (lib/ink-modes.ts), and
// the export is Canvas2D. Export PNG draws the dried frame at 1080x1350 and calls toBlob in the same task, so the
// drawing buffer is read before it can be cleared; then the canvas goes back to its display size.
//
// The figure reports itself for e2e/ink-press.test.ts: data-renderer is "webgl2" or "svg", data-state "wet" or "dry",
// data-frames the animation frames run so far, data-layout and data-seed the poster's. Loaded only by
// components/ink-press-loader.tsx.
import { createElement, useEffect, useId, useRef, useState } from "react";
import { appearanceTags } from "@/lib/appearance-client";
import { inkFilter, wrapSeed } from "@/lib/ink-modes";
import {
  DEFAULT_PHRASE,
  DRY_MS,
  EXPORT_H,
  EXPORT_W,
  LAYOUTS,
  LEADING,
  MAX_CHARS,
  PAPER,
  cleanPhrase,
  design,
  displaySize,
  fitText,
  fontFor,
  formatSeed,
  layoutOf,
  mulberry32,
  posterFilename,
  posterQuery,
  readQuery,
  rgb,
  setCase,
  shuffleSeed,
  stampFrame,
  typeBox,
  wetness,
  withLayout,
  type Design,
  type Layout,
} from "@/lib/ink-press";

// One triangle over the whole canvas. e2e/ink-press.test.ts finds the chunk by its first comment.
const VERTEX = `#version 300 es
// ink-press poster
in vec2 a_pos;
void main() {
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`;

const FRAGMENT = `#version 300 es
precision highp float;
uniform sampler2D u_mask;
uniform vec2 u_res;
uniform float u_wet;
uniform float u_time;
uniform float u_seed;
uniform float u_wobble;
uniform float u_bleed;
uniform int u_layout;
uniform vec2 u_shift;
uniform vec3 u_paper;
uniform vec3 u_ink;
uniform vec3 u_ink2;
out vec4 color;
float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) {
    v += a * noise(p);
    p = p * 2.03 + 17.1;
    a *= 0.5;
  }
  return v;
}
// The mask under a 3x3 blur r px wide: wider while wet, so the ink spreads past its edge.
float soft(vec2 uv, int ch, float r) {
  vec2 px = r / u_res;
  float s = 0.0;
  for (int y = -1; y <= 1; y++)
    for (int x = -1; x <= 1; x++) s += texture(u_mask, uv + vec2(float(x), float(y)) * px)[ch];
  return s / 9.0;
}
float inked(vec2 uv, int ch, vec2 q, float scale) {
  float m = soft(uv, ch, (1.0 + 9.0 * u_wet * u_bleed) * scale);
  float thr = 0.5 - 0.24 * u_wet * u_bleed + (fbm(q * 4.0 + 3.1) - 0.5) * 0.3;
  return smoothstep(thr - 0.05, thr + 0.05, m);
}
void main() {
  vec2 uv = vec2(gl_FragCoord.x, u_res.y - gl_FragCoord.y) / u_res;
  float scale = u_res.x / 1080.0;
  vec2 q = uv * vec2(u_res.x / u_res.y, 1.0) * 6.0 + u_seed;
  float t = u_time * 0.4;
  vec2 warp = vec2(fbm(q + t), fbm(q + 4.7 - t)) - 0.5;
  vec2 w = uv + warp * (0.002 + 0.014 * u_wet) * u_wobble;
  float cov = inked(w, 0, q, scale);
  float cov2 = 0.0;
  vec2 fibre = uv * vec2(u_res.x / u_res.y, 1.0);
  float g = fbm(fibre * 160.0 + u_seed) * 0.6 + hash(floor(gl_FragCoord.xy / scale)) * 0.4;
  if (u_layout == 0) {
    // a stamp: uneven pressure, and specks where the rubber missed the paper
    cov *= mix(0.55, 1.0, smoothstep(0.3, 0.62, fbm(fibre * 26.0 + u_seed)));
    cov *= step(0.14, hash(floor(gl_FragCoord.xy / (1.6 * scale)) + 0.5));
  } else if (u_layout == 1) {
    // riso: the block's drum out of register, both drums grainy, overprinted
    cov2 = inked(w + u_shift, 1, q + 9.0, scale) * (0.82 + 0.18 * hash(gl_FragCoord.xy + 7.0));
    cov *= 0.86 + 0.14 * hash(gl_FragCoord.xy);
  } else {
    // a dry brush: streaks along the stroke where the bristles ran out of ink
    float streak = fbm(vec2(uv.x * 3.0, uv.y * 140.0) + u_seed);
    cov *= smoothstep(0.22, 0.5, streak + 0.25 * soft(w, 0, 4.0 * scale));
  }
  cov *= 1.0 - g * 0.35;
  cov2 *= 1.0 - g * 0.35;
  vec3 paper = u_paper * (1.0 - g * 0.07);
  vec3 ink = mix(u_ink, u_ink * 0.78, u_wet * 0.6);
  vec3 col = paper * mix(vec3(1.0), u_ink2, cov2);
  col *= mix(vec3(1.0), ink / max(u_paper, vec3(0.01)), cov);
  color = vec4(col, 1.0);
}`;

const LABEL: Record<Layout, string> = { stamp: "Stamp", riso: "Riso", brush: "Brush" };

type Line = { text: string; y: number };
type Shapes = {
  w: number;
  h: number;
  font: string;
  size: number;
  lines: Line[];
  frame: { x: number; y: number; w: number; h: number; rule: number } | null;
  swash: { d: string; width: number } | null;
};

// The 2D context every layout is measured with; null where there is no canvas at all.
let ruler: CanvasRenderingContext2D | null | undefined;
function measureWith(layout: Layout): (line: string) => number {
  if (ruler === undefined) ruler = document.createElement("canvas").getContext("2d");
  const ctx = ruler;
  if (!ctx) return (line) => Array.from(line).length * 0.62;
  ctx.font = fontFor(layout, 100);
  return (line) => ctx.measureText(line).width / 100;
}

// Where the type, the stamp's frame and the brush's swash go on a w x h poster, relative to its centre (the type
// block turns about it by the design's tilt). Both painters and the SVG draw from this.
function shapes(d: Design, phrase: string, w: number, h: number): Shapes {
  const text = setCase(d.layout, phrase);
  const box = typeBox(d.layout, w, h);
  const fit = fitText(text, measureWith(d.layout), box);
  const lh = fit.size * LEADING;
  const lines = fit.lines.map((t, i) => ({ text: t, y: (i - (fit.lines.length - 1) / 2) * lh }));
  const f = d.layout === "stamp" ? stampFrame(w, h) : null;
  const frame = f ? { ...f, x: f.x - w / 2, y: f.y - h / 2 } : null;
  let swash: Shapes["swash"] = null;
  if (d.layout === "brush") {
    const y = (fit.lines.length / 2) * lh + fit.size * 0.1;
    const x0 = -box.w * 0.42;
    const x1 = box.w * 0.38;
    swash = { d: `M${x0} ${y + fit.size * 0.08}Q${(x0 + x1) / 2} ${y - fit.size * 0.18} ${x1} ${y}`, width: Math.max(4, fit.size * 0.14) };
  }
  return { w, h, font: fontFor(d.layout, fit.size), size: fit.size, lines, frame, swash };
}

// Paint the type block (type, frame, swash) in the current fill and stroke, turned about the poster's centre.
function paintType(ctx: CanvasRenderingContext2D, d: Design, s: Shapes, dx = 0, dy = 0) {
  ctx.save();
  ctx.translate(s.w / 2 + dx, s.h / 2 + dy);
  ctx.rotate(d.tilt);
  ctx.font = s.font;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (const line of s.lines) ctx.fillText(line.text, 0, line.y);
  if (s.frame) {
    const { x, y, w, h, rule } = s.frame;
    ctx.lineWidth = rule;
    ctx.strokeRect(x, y, w, h);
    ctx.lineWidth = rule * 0.45;
    ctx.strokeRect(x + rule * 1.6, y + rule * 1.6, w - rule * 3.2, h - rule * 3.2);
  }
  if (s.swash) {
    ctx.lineWidth = s.swash.width;
    ctx.lineCap = "round";
    ctx.stroke(new Path2D(s.swash.d));
  }
  ctx.restore();
}

// Riso's block: a disc or a bar, laid square to the sheet.
function paintBlock(ctx: CanvasRenderingContext2D, d: Design, w: number, h: number, dx = 0, dy = 0) {
  const { shape, x, y, r } = d.block;
  ctx.beginPath();
  if (shape === "disc") ctx.arc(x * w + dx, y * h + dy, r * w, 0, Math.PI * 2);
  else ctx.rect(dx, y * h - r * w * 0.45 + dy, w, r * w * 0.9);
  ctx.fill();
}

// The mask the shader prints from: black, the type block in red, riso's block in green.
function paintMask(ctx: CanvasRenderingContext2D, d: Design, phrase: string, w: number, h: number) {
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, w, h);
  ctx.globalCompositeOperation = "lighter";
  ctx.fillStyle = ctx.strokeStyle = "#f00";
  paintType(ctx, d, shapes(d, phrase, w, h));
  if (d.layout === "riso") {
    ctx.fillStyle = "#0f0";
    paintBlock(ctx, d, w, h);
  }
  ctx.globalCompositeOperation = "source-over";
}

// The dried poster in Canvas2D, for the export without WebGL: paper, the inks multiplied on, and a seeded grain.
function paintPrint(ctx: CanvasRenderingContext2D, d: Design, phrase: string, w: number, h: number) {
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, w, h);
  ctx.globalCompositeOperation = "multiply";
  if (d.layout === "riso") {
    ctx.fillStyle = d.ink2;
    paintBlock(ctx, d, w, h, -d.shift[0] * w, -d.shift[1] * h);
  }
  ctx.fillStyle = ctx.strokeStyle = d.ink;
  paintType(ctx, d, shapes(d, phrase, w, h));
  ctx.globalCompositeOperation = "source-over";
  const r = mulberry32(d.seed ^ 0x5eed);
  const n = Math.round((w * h) / 700);
  for (let i = 0; i < n; i++) {
    ctx.globalAlpha = 0.1 + r() * 0.25;
    ctx.fillStyle = r() < 0.6 ? PAPER : d.ink;
    ctx.fillRect(r() * w, r() * h, 1 + r() * 2, 1 + r() * 2);
  }
  ctx.globalAlpha = 1;
}

type Painter = { mask(source: HTMLCanvasElement): void; draw(d: Design, wet: number): void; dispose(): void };

function shader(gl: WebGL2RenderingContext, type: number, source: string) {
  const s = gl.createShader(type)!;
  gl.shaderSource(s, source);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? "shader");
  return s;
}

function webgl(gl: WebGL2RenderingContext): Painter {
  const program = gl.createProgram()!;
  gl.attachShader(program, shader(gl, gl.VERTEX_SHADER, VERTEX));
  gl.attachShader(program, shader(gl, gl.FRAGMENT_SHADER, FRAGMENT));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) ?? "link");
  gl.useProgram(program);
  const buffer = gl.createBuffer()!;
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const at = gl.getAttribLocation(program, "a_pos");
  gl.enableVertexAttribArray(at);
  gl.vertexAttribPointer(at, 2, gl.FLOAT, false, 0, 0);
  const texture = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const u = (name: string) => gl.getUniformLocation(program, name);
  const [res, wetAt, time, seed, wobble, bleed, layout, shift, paper, ink, ink2] = [
    "u_res", "u_wet", "u_time", "u_seed", "u_wobble", "u_bleed", "u_layout", "u_shift", "u_paper", "u_ink", "u_ink2",
  ].map(u);
  gl.uniform1i(u("u_mask"), 0);
  gl.uniform3f(paper, ...rgb(PAPER));
  return {
    mask(source) {
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    },
    draw(d, wet) {
      gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
      gl.uniform2f(res, gl.drawingBufferWidth, gl.drawingBufferHeight);
      gl.uniform1f(wetAt, wet);
      // the clock runs out as the ink dries, so the dried frame is one fixed picture
      gl.uniform1f(time, (DRY_MS / 1000) * (1 - wet));
      gl.uniform1f(seed, d.grain / 10);
      gl.uniform1f(wobble, d.wobble);
      gl.uniform1f(bleed, d.bleed);
      gl.uniform1i(layout, LAYOUTS.indexOf(d.layout));
      gl.uniform2f(shift, d.shift[0], d.shift[1]);
      gl.uniform3f(ink, ...rgb(d.ink));
      gl.uniform3f(ink2, ...rgb(d.ink2));
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    },
    dispose() {
      if (gl.isContextLost()) return;
      gl.deleteTexture(texture);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
    },
  };
}

// The poster as SVG under the site's ink filter: what shows without WebGL2.
function PressSvg({ d, phrase, label }: { d: Design; phrase: string; label: string }) {
  const id = `press${useId().replace(/[^\w-]/g, "")}`;
  const s = shapes(d, phrase, EXPORT_W, EXPORT_H);
  const ink = { fill: d.ink, stroke: d.ink };
  const { block } = d;
  return (
    <svg viewBox={`0 0 ${EXPORT_W} ${EXPORT_H}`} role="img" aria-label={label} className="block h-full w-full">
      <filter id={id} x="-5%" y="-5%" width="110%" height="110%">
        {inkFilter("ink", wrapSeed(d.seed), 3 + 5 * d.wobble).map((p, i) =>
          p.tag === "feMerge" ? (
            <feMerge key={i}>
              {p.nodes.map((node) => (
                <feMergeNode key={node} in={node} />
              ))}
            </feMerge>
          ) : (
            createElement(p.tag, { key: i, ...p.attrs, ...appearanceTags(p) })
          ),
        )}
      </filter>
      <rect width={EXPORT_W} height={EXPORT_H} fill={PAPER} />
      <g filter={`url(#${id})`} style={{ mixBlendMode: "multiply" }}>
        {d.layout === "riso" &&
          (block.shape === "disc" ? (
            <circle cx={block.x * EXPORT_W - d.shift[0] * EXPORT_W} cy={block.y * EXPORT_H - d.shift[1] * EXPORT_H} r={block.r * EXPORT_W} fill={d.ink2} />
          ) : (
            <rect x={-d.shift[0] * EXPORT_W} y={block.y * EXPORT_H - block.r * EXPORT_W * 0.45 - d.shift[1] * EXPORT_H} width={EXPORT_W} height={block.r * EXPORT_W * 0.9} fill={d.ink2} />
          ))}
        <g transform={`translate(${EXPORT_W / 2} ${EXPORT_H / 2}) rotate(${(d.tilt * 180) / Math.PI})`} style={{ mixBlendMode: "multiply" }}>
          {s.lines.map((line, i) => (
            <text key={i} x={0} y={line.y} textAnchor="middle" dominantBaseline="central" fill={d.ink} style={{ font: s.font }}>
              {line.text}
            </text>
          ))}
          {s.frame && (
            <>
              <rect x={s.frame.x} y={s.frame.y} width={s.frame.w} height={s.frame.h} fill="none" stroke={ink.stroke} strokeWidth={s.frame.rule} />
              <rect
                x={s.frame.x + s.frame.rule * 1.6}
                y={s.frame.y + s.frame.rule * 1.6}
                width={s.frame.w - s.frame.rule * 3.2}
                height={s.frame.h - s.frame.rule * 3.2}
                fill="none"
                stroke={ink.stroke}
                strokeWidth={s.frame.rule * 0.45}
              />
            </>
          )}
          {s.swash && <path d={s.swash.d} fill="none" stroke={ink.stroke} strokeWidth={s.swash.width} strokeLinecap="round" />}
        </g>
      </g>
    </svg>
  );
}

const randomSeed = () => crypto.getRandomValues(new Uint32Array(1))[0];

type Api = { print(d: Design, phrase: string): void; save(d: Design, phrase: string, done: (blob: Blob | null) => void): void };

export default function InkPress() {
  const id = useId();
  const [start] = useState(() => readQuery(location.search));
  const [raw, setRaw] = useState(start.phrase ?? DEFAULT_PHRASE);
  const [seed, setSeed] = useState(() => start.seed ?? randomSeed());
  const [renderer, setRenderer] = useState<"webgl2" | "svg">("webgl2");
  const [status, setStatus] = useState("");
  const figure = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const api = useRef<Api | null>(null);
  // the address changes only once the visitor has set something, so a plain visit to /play keeps its bare URL
  const touched = useRef(start.seed !== null || start.phrase !== null);

  const phrase = cleanPhrase(raw) || DEFAULT_PHRASE;
  const d = design(seed);
  const label = `Ink poster: “${phrase}”, ${LABEL[d.layout].toLowerCase()} layout`;

  // The WebGL2 press: one context for the canvas's life, a mask canvas beside it, and the drying clock.
  useEffect(() => {
    if (renderer !== "webgl2") return;
    const canvas = canvasRef.current;
    const box = figure.current;
    if (!canvas || !box) return;
    const gl = canvas.getContext("webgl2", { antialias: false, premultipliedAlpha: false, powerPreference: "low-power" });
    const maskCanvas = document.createElement("canvas");
    const maskCtx = maskCanvas.getContext("2d");
    let painter: Painter;
    try {
      if (!gl || !maskCtx) throw new Error("no webgl2");
      painter = webgl(gl);
    } catch {
      setRenderer("svg");
      return;
    }
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    let current: { d: Design; phrase: string } | null = null;
    let elapsed = DRY_MS;
    let raf = 0;
    let last = 0;
    let frames = 0;
    let inView = true;
    let gone = false;

    const running = () => !gone && !document.hidden && inView && !reduced.matches && wetness(elapsed) > 0;
    const mark = () => {
      box.dataset.state = wetness(elapsed) > 0 ? "wet" : "dry";
      box.dataset.frames = String(frames);
    };
    const remask = (w: number, h: number) => {
      if (!current) return;
      maskCanvas.width = w;
      maskCanvas.height = h;
      paintMask(maskCtx!, current.d, current.phrase, w, h);
      painter.mask(maskCanvas);
    };
    const draw = () => {
      if (current && !gone) painter.draw(current.d, wetness(elapsed));
      mark();
    };
    const frame = (now: number) => {
      raf = 0;
      if (last) elapsed += Math.min(100, now - last);
      last = now;
      frames++;
      draw();
      if (running()) raf = requestAnimationFrame(frame);
      else last = 0;
    };
    const kick = () => {
      if (!raf && running()) raf = requestAnimationFrame(frame);
    };
    const halt = () => {
      cancelAnimationFrame(raf);
      raf = 0;
      last = 0;
    };

    // Size the buffer to the box at the device ratio (at most 2), and remask at that size.
    const fit = () => {
      const { w, h } = displaySize(canvas.getBoundingClientRect().width, devicePixelRatio);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      remask(w, h);
    };

    api.current = {
      print(d, phrase) {
        current = { d, phrase };
        halt();
        // reduced motion prints the dried frame at once and runs no clock
        elapsed = reduced.matches ? DRY_MS : 0;
        fit();
        draw();
        kick();
      },
      save(d, phrase, done) {
        if (gone) return done(null);
        const keep = current;
        current = { d, phrase };
        canvas.width = EXPORT_W;
        canvas.height = EXPORT_H;
        remask(EXPORT_W, EXPORT_H);
        painter.draw(d, 0);
        // the same task as the draw: the buffer is still the dried frame when toBlob reads it
        canvas.toBlob(done, "image/png");
        current = keep;
        fit();
        draw();
      },
    };

    const onMotion = () => {
      if (reduced.matches) {
        halt();
        elapsed = DRY_MS;
        draw();
      } else kick();
    };
    const onVisibility = () => (document.hidden ? halt() : kick());
    const seen = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      if (inView) kick();
      else halt();
    });
    seen.observe(box);
    let width = canvas.getBoundingClientRect().width;
    const resize = new ResizeObserver(() => {
      const next = canvas.getBoundingClientRect().width;
      if (Math.abs(next - width) < 0.5) return;
      width = next;
      fit();
      draw();
    });
    resize.observe(box);
    const onLost = (e: Event) => {
      e.preventDefault();
      gone = true;
      halt();
      setRenderer("svg");
    };
    reduced.addEventListener("change", onMotion);
    document.addEventListener("visibilitychange", onVisibility);
    canvas.addEventListener("webglcontextlost", onLost);
    box.dataset.renderer = "webgl2";
    mark();

    return () => {
      gone = true;
      halt();
      api.current = null;
      seen.disconnect();
      resize.disconnect();
      reduced.removeEventListener("change", onMotion);
      document.removeEventListener("visibilitychange", onVisibility);
      canvas.removeEventListener("webglcontextlost", onLost);
      painter.dispose();
    };
  }, [renderer]);

  // A new phrase or seed is fresh ink.
  useEffect(() => {
    if (renderer === "webgl2") api.current?.print(design(seed), phrase);
    else if (figure.current) {
      figure.current.dataset.renderer = "svg";
      figure.current.dataset.state = "dry";
      figure.current.dataset.frames = "0";
    }
  }, [renderer, seed, phrase]);

  // The poster's address, a moment after the last keystroke.
  useEffect(() => {
    if (!touched.current) return;
    const t = setTimeout(() => {
      const next = posterQuery(raw.trim() ? phrase : "", seed);
      if (location.search !== next) history.replaceState(null, "", `${location.pathname}${next}${location.hash}`);
    }, 300);
    return () => clearTimeout(t);
  }, [raw, phrase, seed]);

  const exportPng = () => {
    const d = design(seed);
    const name = posterFilename(phrase, seed);
    const done = (blob: Blob | null) => {
      if (!blob) return setStatus("The press jammed: no PNG this time.");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setStatus(`Pulled ${name}`);
    };
    if (renderer === "webgl2" && api.current) return api.current.save(d, phrase, done);
    const sheet = document.createElement("canvas");
    sheet.width = EXPORT_W;
    sheet.height = EXPORT_H;
    const ctx = sheet.getContext("2d");
    if (!ctx) return done(null);
    paintPrint(ctx, d, phrase, EXPORT_W, EXPORT_H);
    sheet.toBlob(done, "image/png");
  };

  const count = Array.from(raw).length;
  return (
    <div className="grid items-start gap-6 md:grid-cols-[minmax(0,24rem)_1fr]">
      <figure
        ref={figure}
        className="aspect-[4/5] w-full overflow-hidden border border-ink bg-[#f2efe7]"
        data-press="poster"
        data-renderer={renderer}
        data-state="wet"
        data-frames="0"
        data-layout={d.layout}
        data-seed={formatSeed(seed)}
      >
        {renderer === "webgl2" ? (
          <canvas ref={canvasRef} role="img" aria-label={label} className="block h-full w-full" />
        ) : (
          <PressSvg d={d} phrase={phrase} label={label} />
        )}
      </figure>
      <form className="grid gap-4" onSubmit={(e) => e.preventDefault()}>
        <div className="grid gap-1">
          <label htmlFor={`${id}-phrase`} className="label">
            Phrase
          </label>
          <input
            id={`${id}-phrase`}
            className="field"
            value={raw}
            maxLength={MAX_CHARS * 2}
            autoComplete="off"
            spellCheck={false}
            aria-describedby={`${id}-left`}
            onChange={(e) => {
              touched.current = true;
              setRaw(Array.from(e.target.value).slice(0, MAX_CHARS).join(""));
            }}
          />
          <p id={`${id}-left`} className="hint">
            {count}/{MAX_CHARS} characters
          </p>
        </div>
        <div role="group" aria-label="Layout" className="flex flex-wrap gap-2">
          {LAYOUTS.map((l) => (
            <button key={l} type="button" className="chip" aria-pressed={layoutOf(seed) === l} onClick={() => {
                touched.current = true;
                setSeed((s) => withLayout(s, l));
              }}>
              {LABEL[l]}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className="btn" onClick={() => {
              touched.current = true;
              setSeed((s) => shuffleSeed(s, Math.random()));
            }}>
            Shuffle
          </button>
          <button type="button" className="btn btn-primary" onClick={exportPng}>
            Export PNG
          </button>
        </div>
        <p role="status" className="text-muted">
          {status}
        </p>
      </form>
    </div>
  );
}
