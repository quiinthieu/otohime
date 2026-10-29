// Paints a Physarum trail as sumi on washi. WebGL2 when the context exists,
// otherwise the same ramp through canvas pixels.

import { sampleSumiInkRgba, stepMouldWorld, type MouldWorld } from "@/lib/mould";

export type SumiKind = "webgl2" | "canvas2d";

type Painter = { kind: SumiKind; paint: (trail: Float32Array, width: number, height: number) => void; destroy: () => void };

const VERT = `#version 300 es
layout(location=0) in vec2 aPos;
out vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

const FRAG = `#version 300 es
precision mediump float;
uniform sampler2D uTrail;
in vec2 vUv;
out vec4 o;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void main() {
  float t = texture(uTrail, vec2(vUv.x, 1.0 - vUv.y)).r;
  float g = hash(gl_FragCoord.xy);
  float ink = smoothstep(0.04, 0.58, t);
  float bleed = smoothstep(0.0, 0.2, t);
  float edge = clamp(ink + (g - 0.5) * 0.16 * bleed, 0.0, 1.0);
  vec3 paper = vec3(0.965, 0.945, 0.902);
  vec3 sumi = vec3(0.090, 0.086, 0.078);
  o = vec4(mix(paper, sumi, edge) + (g - 0.5) * 0.025, 1.0);
}`;

function compile(gl: WebGL2RenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function release(gl: WebGL2RenderingContext) {
  gl.getExtension("WEBGL_lose_context")?.loseContext();
}

function webglPainter(canvas: HTMLCanvasElement): Painter | null {
  const gl = canvas.getContext("webgl2", { premultipliedAlpha: false, preserveDrawingBuffer: true });
  if (!gl) return null;
  const vs = compile(gl, gl.VERTEX_SHADER, VERT);
  const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) {
    release(gl);
    return null;
  }
  const program = gl.createProgram();
  if (!program) {
    release(gl);
    return null;
  }
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    release(gl);
    return null;
  }
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  gl.useProgram(program);
  let bytes = new Uint8Array(0);
  return {
    kind: "webgl2",
    paint(trail, width, height) {
      sizeCanvas(canvas);
      if (bytes.length !== trail.length) bytes = new Uint8Array(trail.length);
      let peak = 0.0001;
      for (let i = 0; i < trail.length; i++) if (trail[i] > peak) peak = trail[i];
      for (let i = 0; i < trail.length; i++) bytes[i] = Math.max(0, Math.min(255, (1 - Math.exp(-trail[i] / (peak * 0.35))) * 255));
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, width, height, 0, gl.RED, gl.UNSIGNED_BYTE, bytes);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    },
    destroy() {
      gl.deleteTexture(texture);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
    },
  };
}

function canvasPainter(canvas: HTMLCanvasElement): Painter {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("mould: no canvas");
  const scratch = document.createElement("canvas");
  const ink = scratch.getContext("2d");
  if (!ink) throw new Error("mould: no canvas");
  return {
    kind: "canvas2d",
    paint(trail, width, height) {
      sizeCanvas(canvas);
      scratch.width = width;
      scratch.height = height;
      const image = ink.createImageData(width, height);
      for (let i = 0; i < trail.length; i++) {
        const grain = ((Math.imul(i + 1, 374761393) >>> 0) % 1000) / 1000;
        const [r, g, b, a] = sampleSumiInkRgba(trail[i], grain);
        image.data[i * 4] = r;
        image.data[i * 4 + 1] = g;
        image.data[i * 4 + 2] = b;
        image.data[i * 4 + 3] = a;
      }
      ink.putImageData(image, 0, 0);
      ctx.imageSmoothingEnabled = true;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(scratch, 0, 0, canvas.width, canvas.height);
    },
    destroy() {},
  };
}

function webglUsable() {
  try {
    const probe = document.createElement("canvas");
    const gl = probe.getContext("webgl2");
    if (!gl) return false;
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, 2, 2, 0, gl.RED, gl.UNSIGNED_BYTE, new Uint8Array(4));
    const ok = gl.getError() === gl.NO_ERROR;
    gl.deleteTexture(texture);
    return ok;
  } catch {
    return false;
  }
}

function sizeCanvas(canvas: HTMLCanvasElement) {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const width = Math.max(1, Math.round(rect.width * dpr));
  const height = Math.max(1, Math.round(rect.height * dpr));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
}

export function startMouldLoop(canvas: HTMLCanvasElement, getWorld: () => MouldWorld, reduced: boolean) {
  const painter = webglUsable() ? webglPainter(canvas) ?? canvasPainter(canvas) : canvasPainter(canvas);
  let stop = false;
  let onScreen = true;
  let raf = 0;
  const paint = () => {
    const world = getWorld();
    painter.paint(world.trail, world.config.width, world.config.height);
  };
  const frame = () => {
    if (stop) return;
    if (document.hidden || !onScreen) return;
    stepMouldWorld(getWorld(), 1);
    paint();
    raf = requestAnimationFrame(frame);
  };
  const kick = () => {
    if (stop || reduced || document.hidden || !onScreen) return;
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(frame);
  };
  const io = new IntersectionObserver(([entry]) => {
    onScreen = entry.isIntersecting;
    if (onScreen) kick();
  });
  io.observe(canvas);
  const onVis = () => { if (!document.hidden) kick(); };
  document.addEventListener("visibilitychange", onVis);
  paint();
  kick();
  return {
    kind: painter.kind,
    stop() {
      stop = true;
      cancelAnimationFrame(raf);
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      painter.destroy();
    },
  };
}
