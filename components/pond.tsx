"use client";

// The live Suminagashi Pond: the marble model (lib/marble.ts) on a canvas, drawn fresh after every batch of ops.
// WebGL2 fills each ink ring with the stencil even-odd trick (a triangle fan inverts the stencil, a cover quad paints
// where it is set and clears it), bottom drop first; without WebGL2 a Canvas2D fallback fills the same rings with
// "evenodd". A lost WebGL context hands back to the still print (onLost). Loaded only by components/pond-loader.tsx.
//
// Pointer input is gathered (coalesced events included, pointer captured) and turned into ops once per animation
// frame, so a fast drag is one batch, not dozens. Drip drops ink, Comb rakes the whole pond along the drag, Blow
// swirls the water round the pointer. The keyboard has the same reach: a reticle moved with the arrow keys and Space,
// plus Random drip and Comb across buttons.
//
// The canvas reports itself for scripts/probe-pond.sh: data-renderer is "webgl2" or "2d", data-drops and data-verts
// are the model's counts, data-state is "loading", "ready" or "full" (the last op was refused at a cap).
//
// Prints (lib/pond-print.ts): Pull a print lowers a paper sheet over the water, redraws the engine's Marble in
// Canvas2D at 2400x1800 with the seed's grain and downloads it as suminagashi-<seed>.png. Set as background keeps a
// 1280x960 JPEG in localStorage and sets --pond-print at once; the root layout's head script sets it on later loads.
//
// Water sound (lib/sound-client.ts): with site sound on, a click on the pond (or Space / Enter on it) starts quiet
// looped water; it stops when the pond leaves view or unmounts, and the client stops it on hidden and pagehide. The
// pond's controls carry data-own-sound, so components/press-sound.tsx adds no press cue on top.
import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { INK_HEX, POND_H, POND_W, WATER, pondRecipe } from "@/components/pond-static";
import { applyOp, createMarble, replay, uForHalf, type Ink, type Marble, type Op, type Refusal } from "@/lib/marble";
import {
  BG_H,
  BG_QUALITY,
  BG_W,
  PRINT_H,
  PRINT_W,
  STORAGE_KEY,
  grain,
  parseStoredPrint,
  printFrame,
  printName,
  printSeed,
  printUrl,
} from "@/lib/pond-print";
import { startWater, stopWater } from "@/lib/sound-client";

type Tool = "drip" | "comb" | "blow";

const TOOLS: { id: Tool; label: string }[] = [
  { id: "drip", label: "Drip" },
  { id: "comb", label: "Comb" },
  { id: "blow", label: "Blow" },
];

const INKS: { id: Ink; label: string }[] = [
  { id: "sumi", label: "Sumi" },
  { id: "shade", label: "Ai" },
  { id: "coral", label: "Bengara" },
  { id: "clear", label: "Clear water" },
];

const DRIP_R = 18; // model px: a pointer's drop
const DRIP_GAP = 1.6; // of DRIP_R: how far a held drag travels before the next drop falls
const COMB_SPACING = 40; // model px between the comb's tines
const COMB_HALF = 6; // model px over which a tine's pull halves
const BLOW_HALF = 36; // model px over which a blow's swirl halves
const BLOW_TURN = 1 / 90; // rad per model px of drag
const SEG = 6; // model px of drag per comb or blow op
const MAX_SEGS = 4; // ops per stroke per frame; the rest of the drag joins the last
const MAX_PULL = 40; // model px a single comb op may pull
const STEP = 10; // model px per arrow key, four times that with Shift
const KEY_PULL = 16; // model px a Space comb pulls
const KEY_TURN = 0.35; // rad a Space blow turns

// A filled ring per drop. scripts/probe-pond.mjs finds the chunk by the first comment.
const VERTEX = `#version 300 es
// suminagashi pond fill
in vec2 a_pos;
uniform vec2 u_size;
void main() {
  vec2 p = a_pos / u_size * 2.0 - 1.0;
  gl_Position = vec4(p.x, -p.y, 0.0, 1.0);
}`;

const FRAGMENT = `#version 300 es
precision mediump float;
uniform vec4 u_color;
out vec4 color;
void main() {
  color = u_color;
}`;

type Painter = {
  /** Draw the pond onto the whole drawing buffer. */
  draw(m: Marble): void;
  dispose(): void;
};

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255) as [number, number, number];

// A drop's box on the pond, or null when it lies wholly off it.
function bounds(pts: number[]): [number, number, number, number] | null {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (let i = 0; i < pts.length; i += 2) {
    if (pts[i] < x0) x0 = pts[i];
    if (pts[i] > x1) x1 = pts[i];
    if (pts[i + 1] < y0) y0 = pts[i + 1];
    if (pts[i + 1] > y1) y1 = pts[i + 1];
  }
  x0 = Math.max(0, x0);
  y0 = Math.max(0, y0);
  x1 = Math.min(POND_W, x1);
  y1 = Math.min(POND_H, y1);
  return x1 > x0 && y1 > y0 ? [x0, y0, x1, y1] : null;
}

function shader(gl: WebGL2RenderingContext, type: number, source: string) {
  const s = gl.createShader(type)!;
  gl.shaderSource(s, source);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? "shader");
  return s;
}

function webgl(gl: WebGL2RenderingContext): Painter {
  if (gl.getContextAttributes()?.stencil !== true) throw new Error("no stencil");
  const program = gl.createProgram()!;
  gl.attachShader(program, shader(gl, gl.VERTEX_SHADER, VERTEX));
  gl.attachShader(program, shader(gl, gl.FRAGMENT_SHADER, FRAGMENT));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) ?? "link");
  gl.useProgram(program);
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  const at = gl.getAttribLocation(program, "a_pos");
  gl.enableVertexAttribArray(at);
  gl.vertexAttribPointer(at, 2, gl.FLOAT, false, 0, 0);
  const size = gl.getUniformLocation(program, "u_size");
  const color = gl.getUniformLocation(program, "u_color");
  const water = rgb(WATER);
  const inks = Object.fromEntries(Object.entries(INK_HEX).map(([k, v]) => [k, rgb(v)])) as Record<Ink, [number, number, number]>;
  let data = new Float32Array(0);
  return {
    draw(m) {
      // Each drop on the pond: its ring as a fan, then its box as a 4-vertex strip.
      const runs: { ink: Ink; at: number; n: number }[] = [];
      let total = 0;
      const boxes = m.drops.map((d) => bounds(d.pts));
      m.drops.forEach((d, i) => boxes[i] && (total += d.pts.length / 2 + 4));
      if (data.length < total * 2) data = new Float32Array(Math.max(total * 2, data.length * 2));
      let v = 0;
      m.drops.forEach((d, i) => {
        const box = boxes[i];
        if (!box) return;
        data.set(d.pts, v * 2);
        runs.push({ ink: d.ink, at: v, n: d.pts.length / 2 });
        v += d.pts.length / 2;
        const [x0, y0, x1, y1] = box;
        data.set([x0, y0, x1, y0, x0, y1, x1, y1], v * 2);
        v += 4;
      });
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, data.subarray(0, v * 2), gl.DYNAMIC_DRAW);
      gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
      gl.uniform2f(size, POND_W, POND_H);
      gl.disable(gl.STENCIL_TEST);
      gl.colorMask(true, true, true, true);
      gl.clearColor(water[0], water[1], water[2], 1);
      gl.clearStencil(0);
      gl.stencilMask(0xff);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);
      gl.enable(gl.STENCIL_TEST);
      gl.stencilMask(1);
      for (const run of runs) {
        // Every fan triangle flips the bit under it, so a pixel ends up set where the ring winds an odd number of times.
        gl.colorMask(false, false, false, false);
        gl.stencilFunc(gl.ALWAYS, 0, 1);
        gl.stencilOp(gl.KEEP, gl.KEEP, gl.INVERT);
        gl.drawArrays(gl.TRIANGLE_FAN, run.at, run.n);
        // Paint where the bit is set, and clear it for the next drop.
        gl.colorMask(true, true, true, true);
        gl.stencilFunc(gl.NOTEQUAL, 0, 1);
        gl.stencilOp(gl.ZERO, gl.ZERO, gl.ZERO);
        const c = inks[run.ink];
        gl.uniform4f(color, c[0], c[1], c[2], 1);
        gl.drawArrays(gl.TRIANGLE_STRIP, run.at + run.n, 4);
      }
      gl.disable(gl.STENCIL_TEST);
    },
    dispose() {
      if (gl.isContextLost()) return;
      gl.deleteBuffer(buffer);
      gl.deleteVertexArray(vao);
      gl.deleteProgram(program);
    },
  };
}

function canvas2d(ctx: CanvasRenderingContext2D): Painter {
  return {
    draw(m) {
      const { width, height } = ctx.canvas;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = WATER;
      ctx.fillRect(0, 0, width, height);
      ctx.setTransform(width / POND_W, 0, 0, height / POND_H, 0, 0);
      for (const d of m.drops) {
        if (!bounds(d.pts)) continue;
        ctx.beginPath();
        ctx.moveTo(d.pts[0], d.pts[1]);
        for (let i = 2; i < d.pts.length; i += 2) ctx.lineTo(d.pts[i], d.pts[i + 1]);
        ctx.closePath();
        ctx.fillStyle = INK_HEX[d.ink];
        ctx.fill("evenodd");
      }
    },
    dispose() {},
  };
}

/** The print a sheet of w x h would lift off the pond: the water, the rings the sheet covers, then the paper's grain
 * (water-coloured flecks and faint sumi fibres, so no colour the contrast test has not seen). Canvas2D, no filter. */
function renderPrint(m: Marble, w: number, h: number, seed: string): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d", { alpha: false });
  if (!ctx) throw new Error("no 2d context");
  ctx.fillStyle = WATER;
  ctx.fillRect(0, 0, w, h);
  const { s, ox, oy } = printFrame(POND_W, POND_H, w, h);
  ctx.setTransform(s, 0, 0, s, -ox * s, -oy * s);
  for (const d of m.drops) {
    if (!bounds(d.pts)) continue;
    ctx.beginPath();
    ctx.moveTo(d.pts[0], d.pts[1]);
    for (let i = 2; i < d.pts.length; i += 2) ctx.lineTo(d.pts[i], d.pts[i + 1]);
    ctx.closePath();
    ctx.fillStyle = INK_HEX[d.ink];
    ctx.fill("evenodd");
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  for (const g of grain(seed, w, h)) {
    ctx.globalAlpha = g.alpha;
    ctx.fillStyle = g.light ? WATER : INK_HEX.sumi;
    ctx.fillRect(g.x, g.y, g.size, g.size);
  }
  ctx.globalAlpha = 1;
  return c;
}

const KEEP_FAILED = "Couldn't keep it here: this browser won't store the print. Pull a print to save it instead.";

// mulberry32's mix on a counter: the n-th draw of a seeded sequence, in [0, 1). No Math.random.
function hash(n: number): number {
  let t = (n * 0x6d2b79f5 + 0x5a1) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** A comb raking the whole pond along angle, pulling `pull` px: tines span the diagonal, as in lib/marble's recipe. */
function combAcross(angle: number, pull: number): Op {
  const n = Math.min(64, Math.ceil(Math.hypot(POND_W, POND_H) / COMB_SPACING) + 1);
  const back = (COMB_SPACING * (n - 1)) / 2;
  return {
    kind: "comb",
    x: POND_W / 2 + Math.sin(angle) * back,
    y: POND_H / 2 - Math.cos(angle) * back,
    angle,
    z: Math.max(-MAX_PULL, Math.min(MAX_PULL, pull)),
    u: uForHalf(COMB_HALF),
    n,
    spacing: COMB_SPACING,
  };
}

/** A blow at (x, y): the water turns round it, clockwise on screen for a drag to the right. */
const blowAt = (x: number, y: number, z: number): Op => ({ kind: "vortex", x, y, z, u: uForHalf(BLOW_HALF) });

/** The op a drag segment from (ax, ay) to (bx, by) makes with a tool; drip is handled by spacing, not segments. */
function segmentOp(tool: Tool, ax: number, ay: number, bx: number, by: number): Op | null {
  const dx = bx - ax;
  const dy = by - ay;
  const len = Math.hypot(dx, dy);
  if (tool === "comb") return combAcross(Math.atan2(dy, dx), len);
  if (tool === "blow") return blowAt(ax, ay, (dx >= 0 ? 1 : -1) * len * BLOW_TURN);
  return null;
}

type Stroke = { ax: number; ay: number; trail: number[]; done: boolean };

type Engine = { push(op: Op): void; clear(): void; snapshot(): Marble };

export default function Pond({ onLive, onLost }: { onLive: () => void; onLost: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const engine = useRef<Engine | null>(null);
  const [tool, setTool] = useState<Tool>("drip");
  const [ink, setInk] = useState<Ink>("sumi");
  const toolRef = useRef(tool);
  const inkRef = useRef(ink);
  useEffect(() => {
    toolRef.current = tool;
    inkRef.current = ink;
  }, [tool, ink]);
  const [drops, setDrops] = useState(0);
  const [full, setFull] = useState<Refusal | null>(null);
  const [reticle, setReticle] = useState<[number, number]>([POND_W / 2, POND_H / 2]);
  const heading = useRef<[number, number]>([1, 0]);
  const draws = useRef(0);
  const id = useId();
  const [sheet, setSheet] = useState(0);
  const [pulling, setPulling] = useState(false);
  const [pulled, setPulled] = useState<{ url: string; name: string } | null>(null);
  const [keep, setKeep] = useState("");
  const [kept, setKept] = useState(() => {
    try {
      return parseStoredPrint(localStorage.getItem(STORAGE_KEY)) !== null;
    } catch {
      return false;
    }
  });
  const pulledUrl = useRef<string | null>(null);
  useEffect(() => () => {
    if (pulledUrl.current) URL.revokeObjectURL(pulledUrl.current);
  }, []);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;

    let painter: Painter;
    let renderer: "webgl2" | "2d" = "webgl2";
    const gl = canvas.getContext("webgl2", { alpha: false, antialias: true, stencil: true, depth: false, powerPreference: "low-power" });
    try {
      if (!gl) throw new Error("no webgl2");
      painter = webgl(gl);
    } catch {
      renderer = "2d";
      // a canvas that handed out a WebGL context cannot give a 2D one, so a failed shader leaves the still print
      const ctx = gl ? null : canvas.getContext("2d", { alpha: false });
      if (!ctx) {
        onLost();
        return;
      }
      painter = canvas2d(ctx);
    }
    canvas.dataset.renderer = renderer;
    // Only now that the pond answers to it does a touch drag stop scrolling the page.
    canvas.style.touchAction = "none";

    let marble = replay(pondRecipe(), POND_W, POND_H).marble;
    let refused: Refusal | null = null;
    let pending: Op[] = [];
    let raf = 0;
    let gone = false;
    const strokes = new Map<number, Stroke>();

    const report = () => {
      canvas.dataset.drops = String(marble.drops.length);
      canvas.dataset.verts = String(marble.verts);
      canvas.dataset.state = refused ? "full" : "ready";
      setDrops(marble.drops.length);
      setFull(refused);
    };
    const draw = () => {
      if (gone) return;
      painter.draw(marble);
      draws.current++;
      canvas.dataset.draws = String(draws.current);
    };

    // Turn the drags gathered since the last frame into ops: drops spaced along a drip, segments for comb and blow.
    // A stroke gives MAX_SEGS ops a frame at most; past that the rest of its drag joins the last one.
    const gather = () => {
      const t = toolRef.current;
      for (const [pointer, s] of strokes) {
        const pts = s.trail;
        s.trail = [];
        let segs = 0;
        for (let i = 0; i < pts.length; i += 2) {
          const x = pts[i];
          const y = pts[i + 1];
          const far = Math.hypot(x - s.ax, y - s.ay);
          if (t === "drip") {
            if (far < DRIP_R * DRIP_GAP) continue;
            pending.push({ kind: "drop", x, y, r: DRIP_R, ink: inkRef.current });
          } else {
            if (far < SEG || (segs === MAX_SEGS - 1 && i < pts.length - 2)) continue;
            const op = segmentOp(t, s.ax, s.ay, x, y);
            if (op) pending.push(op);
            segs++;
          }
          s.ax = x;
          s.ay = y;
        }
        if (s.done) strokes.delete(pointer);
      }
    };

    // One batch per frame: every op gathered since the last, then one draw.
    const frame = () => {
      raf = 0;
      if (gone) return;
      gather();
      const ops = pending;
      pending = [];
      let changed = false;
      let refusal: Refusal | null = null;
      for (const op of ops) {
        const r = applyOp(marble, op);
        if (r.ok) {
          marble = r.marble;
          changed = true;
        } else if (r.reason !== "invalid") refusal = r.reason;
      }
      refused = refusal ?? (changed ? null : refused);
      if (changed) draw();
      report();
    };
    const kick = () => {
      if (!raf && !gone) raf = requestAnimationFrame(frame);
    };

    const toModel = (e: { clientX: number; clientY: number }): [number, number] => {
      const r = canvas.getBoundingClientRect();
      return [((e.clientX - r.left) * POND_W) / r.width, ((e.clientY - r.top) * POND_H) / r.height];
    };

    const onDown = (e: PointerEvent) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      try {
        canvas.setPointerCapture(e.pointerId);
      } catch {}
      const [x, y] = toModel(e);
      strokes.set(e.pointerId, { ax: x, ay: y, trail: [], done: false });
      if (toolRef.current === "drip") pending.push({ kind: "drop", x, y, r: DRIP_R, ink: inkRef.current });
      kick();
    };
    const onMove = (e: PointerEvent) => {
      const s = strokes.get(e.pointerId);
      if (!s || s.done) return;
      const all = typeof e.getCoalescedEvents === "function" ? e.getCoalescedEvents() : [];
      for (const ev of all.length ? all : [e]) s.trail.push(...toModel(ev));
      kick();
    };
    const onUp = (e: PointerEvent) => {
      const s = strokes.get(e.pointerId);
      if (!s) return;
      // the last of the drag still counts: the next frame gathers it, then lets the stroke go
      s.done = true;
      kick();
    };

    // The water plays only while the pond is on screen; a click starts it again.
    const onClick = () => startWater();
    const seen = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) stopWater();
    });
    seen.observe(canvas);

    const resize = () => {
      const r = canvas.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) return;
      const dpr = Math.min(2, devicePixelRatio || 1);
      const w = Math.round(r.width * dpr);
      const h = Math.round(r.height * dpr);
      if (canvas.width === w && canvas.height === h) return;
      canvas.width = w;
      canvas.height = h;
      draw();
    };

    const onLostContext = (e: Event) => {
      e.preventDefault();
      gone = true;
      cancelAnimationFrame(raf);
      raf = 0;
      onLost();
    };

    engine.current = {
      push(op) {
        pending.push(op);
        kick();
      },
      clear() {
        pending = [];
        strokes.clear();
        marble = createMarble(POND_W, POND_H);
        refused = null;
        draw();
        report();
      },
      snapshot: () => marble,
    };

    resize();
    draw();
    report();
    onLive();

    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("click", onClick);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onUp);
    canvas.addEventListener("webglcontextlost", onLostContext);

    return () => {
      gone = true;
      engine.current = null;
      cancelAnimationFrame(raf);
      observer.disconnect();
      seen.disconnect();
      stopWater();
      canvas.removeEventListener("click", onClick);
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onUp);
      canvas.removeEventListener("webglcontextlost", onLostContext);
      painter.dispose();
    };
  }, [onLive, onLost]);

  // One visible line, read out as it changes: the drop count, or that the pond is full.
  const status = full ? "The pond is full. Clear it to keep marbling." : `${drops} ${drops === 1 ? "drop" : "drops"} of ink on the pond.`;

  const randomDrops = useRef(0);
  const randomDrip = useCallback(() => {
    const k = randomDrops.current++;
    engine.current?.push({
      kind: "drop",
      x: 40 + hash(3 * k) * (POND_W - 80),
      y: 40 + hash(3 * k + 1) * (POND_H - 80),
      r: 12 + hash(3 * k + 2) * 18,
      ink: inkRef.current,
    });
  }, []);

  const combs = useRef(0);
  const combButton = useCallback(() => {
    // across and back again, alternating like a rake drawn to and fro
    const k = combs.current++;
    engine.current?.push(combAcross(k % 2 === 0 ? 0 : Math.PI, 24));
  }, []);

  // Pull a print: the sheet lowers (CSS only; none under reduced motion) while the print is drawn and encoded.
  const pull = async () => {
    const m = engine.current?.snapshot();
    if (!m || pulling) return;
    setPulling(true);
    setSheet((n) => n + 1);
    setKeep("Pulling a print…");
    try {
      // a frame for the sheet to start lowering before the main thread draws
      await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
      const seed = printSeed(m);
      const c = renderPrint(m, PRINT_W, PRINT_H, seed);
      const blob = await new Promise<Blob | null>((r) => c.toBlob(r, "image/png"));
      c.width = c.height = 0;
      if (!blob) throw new Error("no png");
      const url = URL.createObjectURL(blob);
      const name = printName(seed);
      if (pulledUrl.current) URL.revokeObjectURL(pulledUrl.current);
      pulledUrl.current = url;
      setPulled({ url, name });
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.hidden = true;
      document.body.append(a);
      a.click();
      a.remove();
      setKeep(`Pulled ${name}.`);
    } catch {
      setKeep("The print didn't come off the water. Try again.");
    } finally {
      setPulling(false);
    }
  };

  const keepAsBackground = () => {
    const m = engine.current?.snapshot();
    if (!m) return;
    let url: string | null = null;
    try {
      const c = renderPrint(m, BG_W, BG_H, printSeed(m));
      url = parseStoredPrint(c.toDataURL("image/jpeg", BG_QUALITY));
      c.width = c.height = 0;
      if (!url) throw new Error("no jpeg");
      localStorage.setItem(STORAGE_KEY, url);
    } catch {
      setKeep(KEEP_FAILED);
      return;
    }
    document.documentElement.style.setProperty("--pond-print", printUrl(url));
    setKept(true);
    setKeep("Kept as this page's background, faint under the paper.");
  };

  const clearBackground = () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
    document.documentElement.style.removeProperty("--pond-print");
    setKept(false);
    setKeep("Background cleared.");
  };

  const onKey = (e: KeyboardEvent<HTMLCanvasElement>) => {
    const step = e.shiftKey ? STEP * 4 : STEP;
    const move: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    const dir = move[e.key];
    if (dir) {
      e.preventDefault();
      heading.current = dir;
      setReticle(([x, y]) => [Math.max(0, Math.min(POND_W, x + dir[0] * step)), Math.max(0, Math.min(POND_H, y + dir[1] * step))]);
      return;
    }
    if (e.key !== " " && e.key !== "Enter") return;
    e.preventDefault();
    startWater();
    const [x, y] = reticle;
    const [hx, hy] = heading.current;
    if (tool === "drip") engine.current?.push({ kind: "drop", x, y, r: DRIP_R, ink });
    else if (tool === "comb") engine.current?.push(combAcross(Math.atan2(hy, hx), KEY_PULL));
    else engine.current?.push(blowAt(x, y, (hx + hy >= 0 ? 1 : -1) * KEY_TURN));
  };

  const inkName = INKS.find((i) => i.id === ink)!.label;
  const toolName = TOOLS.find((t) => t.id === tool)!.label;
  const label = `Marbling pond with ${drops} ${drops === 1 ? "drop" : "drops"} of ink. ${toolName} with ${inkName}: arrow keys move the brush, Space uses it.`;

  return (
    <>
      <div className="pond-stage" data-own-sound="">
        <canvas
          ref={ref}
          className="pond-canvas"
          role="img"
          aria-label={label}
          aria-describedby={`${id}-hint`}
          tabIndex={0}
          onKeyDown={onKey}
          data-state="loading"
        />
        <span
          className="pond-reticle"
          aria-hidden="true"
          style={{ left: `${(reticle[0] / POND_W) * 100}%`, top: `${(reticle[1] / POND_H) * 100}%` }}
        />
        {sheet > 0 && <span key={sheet} className="pond-paper" aria-hidden="true" onAnimationEnd={() => setSheet(0)} />}
      </div>
      <div className="pond-tools" data-own-sound="">
        <fieldset className="pond-set">
          <legend className="caption">Tool</legend>
          <div className="pond-chips">
            {TOOLS.map((t) => (
              <label key={t.id} className="chip">
                <input type="radio" name={`${id}-tool`} value={t.id} checked={tool === t.id} onChange={() => setTool(t.id)} className="sr-only" />
                {t.label}
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset className="pond-set">
          <legend className="caption">Ink</legend>
          <div className="pond-chips">
            {INKS.map((i) => (
              <label key={i.id} className="chip">
                <input type="radio" name={`${id}-ink`} value={i.id} checked={ink === i.id} onChange={() => setInk(i.id)} className="sr-only" />
                <span className="pond-swatch" aria-hidden="true" style={{ background: INK_HEX[i.id] }} />
                {i.label}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="pond-chips">
          <button type="button" className="chip" onClick={randomDrip}>
            Random drip
          </button>
          <button type="button" className="chip" onClick={combButton}>
            Comb across
          </button>
          <button type="button" className="chip" onClick={() => engine.current?.clear()}>
            Clear
          </button>
        </div>
        <p id={`${id}-hint`} className="pond-hint">
          Drip drops ink where you press. Comb rakes the whole pond the way you drag. Blow swirls the water round the
          pointer: drag right to turn it clockwise. On the pond, arrow keys move the brush and Space uses it.
        </p>
        <p className="pond-status" aria-live="polite" data-full={full ? "" : undefined}>
          {status}
        </p>
        <div className="pond-chips">
          <button type="button" className="chip" onClick={pull} aria-disabled={pulling || undefined}>
            Pull a print
          </button>
          <button type="button" className="chip" onClick={keepAsBackground}>
            Set as background
          </button>
          {kept && (
            <button type="button" className="chip" onClick={clearBackground}>
              Clear background
            </button>
          )}
        </div>
        <p className="pond-keep" aria-live="polite">
          {keep}
          {pulled && (
            <>
              {" "}
              <a href={pulled.url} download={pulled.name}>
                Download {pulled.name}
              </a>
            </>
          )}
        </p>
      </div>
    </>
  );
}
