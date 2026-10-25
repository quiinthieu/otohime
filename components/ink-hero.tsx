"use client";

// The ink hero's canvas: the wordmark as a few thousand ink specks that a pointer blows apart and that bleed
// back into shape. WebGL2 draws them as gl.POINTS, each a soft round speck whose alpha carries a paper-grain hash;
// without WebGL2 a Canvas2D fallback draws 600. The ink is the page's --ink, re-read when the theme changes. A
// lost WebGL context hands back to the static mark (onLost). Loaded only by components/ink-hero-loader.tsx.
//
// The canvas reports itself for scripts/probe-ink.sh: data-state is "loading", "scattered" while specks are off
// their targets, or "settled"; data-renderer is "webgl2" or "2d"; data-n is the speck count.
import { useEffect, useRef } from "react";
import { INK_MARK_STROKE, INK_MARK_WIDTH, inkMarkPoints } from "@/components/ink-hero-mark";
import {
  INK_FPS,
  SIM_HZ,
  blow,
  createField,
  inkTier,
  sampleTargets,
  settled,
  step,
  type InkField,
} from "@/lib/ink-particles";

const SEED = 0x0705;
const INTRO_SPREAD = 0.07; // of the box width: how far off the specks start before bleeding in
const RADIUS = 0.16; // of the box width: the reach of a pointer's blow
const SPEED_GAP_MS = 120; // a pointer sample older than this gives no speed

// gl.POINTS at (x, y) in CSS px, sized in device px. scripts/probe-ink.mjs finds the chunk by its first comment.
const VERTEX = `#version 300 es
// ink-hero speck
in float a_x;
in float a_y;
in float a_size;
uniform vec2 u_box;
uniform float u_dpr;
void main() {
  vec2 p = vec2(a_x, a_y) / u_box * 2.0 - 1.0;
  gl_Position = vec4(p.x, -p.y, 0.0, 1.0);
  gl_PointSize = a_size * u_dpr;
}`;

// A soft round speck; a per-pixel hash in its alpha is the paper's grain, fixed to the page, not to the speck.
const FRAGMENT = `#version 300 es
precision mediump float;
uniform vec3 u_ink;
out vec4 color;
float grain(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
void main() {
  vec2 c = gl_PointCoord * 2.0 - 1.0;
  float r = dot(c, c);
  if (r > 1.0) discard;
  float a = (1.0 - smoothstep(0.3, 1.0, r)) * (0.5 + 0.5 * grain(floor(gl_FragCoord.xy)));
  color = vec4(u_ink * a, a);
}`;

type Painter = {
  /** Draw the field in the ink, sized to a box w x h CSS px at dpr. */
  draw(field: InkField, ink: [number, number, number], w: number, h: number, dpr: number): void;
  /** New speck sizes after the field is rebuilt. */
  sizes(sizes: Float32Array): void;
  dispose(): void;
};

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
  const buffers = (["a_x", "a_y", "a_size"] as const).map((name) => {
    const buffer = gl.createBuffer()!;
    const at = gl.getAttribLocation(program, name);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.enableVertexAttribArray(at);
    gl.vertexAttribPointer(at, 1, gl.FLOAT, false, 0, 0);
    return buffer;
  });
  const box = gl.getUniformLocation(program, "u_box");
  const dprAt = gl.getUniformLocation(program, "u_dpr");
  const inkAt = gl.getUniformLocation(program, "u_ink");
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  gl.clearColor(0, 0, 0, 0);
  return {
    sizes(sizes) {
      gl.bindBuffer(gl.ARRAY_BUFFER, buffers[2]);
      gl.bufferData(gl.ARRAY_BUFFER, sizes, gl.STATIC_DRAW);
    },
    draw(field, ink, w, h, dpr) {
      gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform2f(box, w, h);
      gl.uniform1f(dprAt, dpr);
      gl.uniform3f(inkAt, ink[0], ink[1], ink[2]);
      gl.bindBuffer(gl.ARRAY_BUFFER, buffers[0]);
      gl.bufferData(gl.ARRAY_BUFFER, field.x, gl.DYNAMIC_DRAW);
      gl.bindBuffer(gl.ARRAY_BUFFER, buffers[1]);
      gl.bufferData(gl.ARRAY_BUFFER, field.y, gl.DYNAMIC_DRAW);
      gl.drawArrays(gl.POINTS, 0, field.n);
    },
    dispose() {
      if (gl.isContextLost()) return;
      for (const b of buffers) gl.deleteBuffer(b);
      gl.deleteProgram(program);
    },
  };
}

// Three alpha passes stand in for the grain: each speck keeps one, chosen by its index.
function canvas2d(ctx: CanvasRenderingContext2D): Painter {
  let sizes: Float32Array = new Float32Array(0);
  return {
    sizes(next) {
      sizes = next;
    },
    draw(field, ink, w, h, dpr) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = `rgb(${ink.map((c) => Math.round(c * 255)).join(" ")})`;
      for (let pass = 0; pass < 3; pass++) {
        ctx.globalAlpha = 0.55 + pass * 0.2;
        ctx.beginPath();
        for (let i = pass; i < field.n; i += 3) {
          const r = sizes[i] / 2;
          ctx.moveTo(field.x[i] + r, field.y[i]);
          ctx.arc(field.x[i], field.y[i], r, 0, Math.PI * 2);
        }
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    },
    dispose() {},
  };
}

// The resolved colour of `el`'s CSS color as linear 0..1 RGB, through a 1x1 canvas so any colour syntax reads.
function readInk(el: Element, probe: CanvasRenderingContext2D | null): [number, number, number] {
  const css = getComputedStyle(el).color;
  if (!probe) return [0.14, 0.12, 0.09];
  probe.clearRect(0, 0, 1, 1);
  probe.fillStyle = css;
  probe.fillRect(0, 0, 1, 1);
  const [r, g, b] = probe.getImageData(0, 0, 1, 1).data;
  return [r / 255, g / 255, b / 255];
}

export default function InkHero({ onLive, onLost }: { onLive: () => void; onLost: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const host = canvas?.parentElement;
    if (!canvas || !host) return;

    let painter: Painter;
    const gl = canvas.getContext("webgl2", { antialias: false, premultipliedAlpha: true, powerPreference: "low-power" });
    let renderer: "webgl2" | "2d" = "webgl2";
    try {
      if (!gl) throw new Error("no webgl2");
      painter = webgl(gl);
    } catch {
      renderer = "2d";
      // a canvas that handed out a WebGL context cannot give a 2D one, so a failed shader leaves the static mark
      const ctx = gl ? null : canvas.getContext("2d");
      if (!ctx) {
        onLost();
        return;
      }
      painter = canvas2d(ctx);
    }
    canvas.dataset.renderer = renderer;

    const swatch = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
    let ink = readInk(host, swatch);
    let w = 0;
    let h = 0;
    let dpr = 1;
    let field: InkField | null = null;
    let raf = 0;
    let last = 0;
    let lastDraw = 0;
    let acc = 0;
    let gone = false;
    const points = inkMarkPoints();

    const draw = () => {
      if (field && !gone) painter.draw(field, ink, w, h, dpr);
    };

    const frame = (now: number) => {
      raf = 0;
      if (!field || gone) return;
      acc += Math.min(0.25, last ? (now - last) / 1000 : 1 / SIM_HZ);
      last = now;
      let done = settled(field);
      while (acc >= 1 / SIM_HZ && !done) {
        done = step(field);
        acc -= 1 / SIM_HZ;
      }
      if (done || now - lastDraw >= 1000 / INK_FPS - 1) {
        draw();
        lastDraw = now;
      }
      canvas.dataset.state = done ? "settled" : "scattered";
      if (done) {
        last = 0;
        acc = 0;
      } else {
        raf = requestAnimationFrame(frame);
      }
    };
    const kick = () => {
      if (!raf && !gone) raf = requestAnimationFrame(frame);
    };

    // Size the canvas to the box and lay the specks on the mark at that size. The first build bleeds in.
    const build = (intro: boolean) => {
      const rect = host.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) return;
      dpr = Math.min(2, devicePixelRatio || 1);
      w = rect.width;
      h = rect.height;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      const n = renderer === "webgl2" ? inkTier({ webgl2: true, width: innerWidth, cores: navigator.hardwareConcurrency || 4 }) : 600;
      const scale = w / INK_MARK_WIDTH;
      field = createField(sampleTargets(points, n, SEED, scale, INK_MARK_STROKE / 2), SEED, intro ? w * INTRO_SPREAD : 0);
      // bigger specks when there are fewer of them, so the mark reads as solid at every tier
      const base = Math.max(1.4, scale * (n >= 2400 ? 1.7 : n >= 1200 ? 2.3 : 3.1));
      const sizes = new Float32Array(n);
      for (let i = 0; i < n; i++) sizes[i] = base * (0.6 + 0.8 * (((i * 2654435761) >>> 0) / 4294967296));
      painter.sizes(sizes);
      canvas.dataset.n = String(n);
      canvas.dataset.state = settled(field) ? "settled" : "scattered";
      draw();
      kick();
    };

    // Pointer speed from the previous sample over the box; a first sample or a stale one counts as still.
    let px = 0;
    let py = 0;
    let pt = -1;
    const onPointer = (e: PointerEvent) => {
      if (!field || gone) return;
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const dt = e.timeStamp - pt;
      const speed = pt >= 0 && dt > 0 && dt < SPEED_GAP_MS ? (Math.hypot(x - px, y - py) / dt) * 1000 : 0;
      px = x;
      py = y;
      pt = e.timeStamp;
      if (blow(field, x, y, speed, Math.max(40, w * RADIUS)) > 0) {
        canvas.dataset.state = "scattered";
        kick();
      }
    };
    const onLeave = () => {
      pt = -1;
    };

    const retint = () => {
      ink = readInk(host, swatch);
      canvas.dataset.ink = ink.map((c) => Math.round(c * 255)).join(",");
      draw();
    };
    canvas.dataset.ink = ink.map((c) => Math.round(c * 255)).join(",");

    const onLostContext = (e: Event) => {
      e.preventDefault();
      gone = true;
      cancelAnimationFrame(raf);
      raf = 0;
      onLost();
    };

    build(true);
    onLive();

    let width = w;
    const resize = new ResizeObserver(() => {
      const next = host.getBoundingClientRect().width;
      if (Math.abs(next - width) < 0.5) return;
      width = next;
      build(false);
    });
    resize.observe(host);
    const theme = new MutationObserver(retint);
    theme.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "class", "style"] });
    const scheme = matchMedia("(prefers-color-scheme: dark)");
    scheme.addEventListener("change", retint);
    host.addEventListener("pointermove", onPointer);
    host.addEventListener("pointerdown", onPointer);
    host.addEventListener("pointerleave", onLeave);
    canvas.addEventListener("webglcontextlost", onLostContext);

    return () => {
      gone = true;
      cancelAnimationFrame(raf);
      resize.disconnect();
      theme.disconnect();
      scheme.removeEventListener("change", retint);
      host.removeEventListener("pointermove", onPointer);
      host.removeEventListener("pointerdown", onPointer);
      host.removeEventListener("pointerleave", onLeave);
      canvas.removeEventListener("webglcontextlost", onLostContext);
      painter.dispose();
    };
  }, [onLive, onLost]);

  return <canvas ref={ref} className="ink-hero-canvas" data-state="loading" />;
}
