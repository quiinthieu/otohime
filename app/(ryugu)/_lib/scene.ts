// How the palace's sea moves, and the water itself. The server draws a still sea (a static SVG-filter caustic, the
// fish where the seed puts them, components in ../_components/); the client only adds motion, and only when the
// visitor's system welcomes it and WebGL draws the water. Anything else keeps the still sea as it was served.
export type Mode = "live" | "still" | "static";

// still: the visitor asks for less motion. static: no WebGL to draw the water, so nothing swims either.
export function sceneMode({ reduced, webgl }: { reduced: boolean; webgl: boolean }): Mode {
  if (reduced) return "still";
  return webgl ? "live" : "static";
}

// The loop runs only for a live sea on a page someone can see.
export const animating = (mode: Mode, hidden: boolean) => mode === "live" && !hidden;

// The canvas's buffer: its own CSS box, at most 1.5 device pixels a pixel and 1600 across, so the shader stays
// cheap on large and dense screens. A box with no size gives no buffer.
export function bufferSize(width: number, height: number, dpr: number): { w: number; h: number } {
  if (!(width > 0 && height > 0)) return { w: 0, h: 0 };
  const ratio = Math.min(Math.max(dpr || 1, 1), 1.5);
  const scale = Math.min(ratio, 1600 / width);
  return { w: Math.max(1, Math.round(width * scale)), h: Math.max(1, Math.round(height * scale)) };
}

export const VERTEX = `attribute vec2 a;
void main(){gl_Position=vec4(a,0.0,1.0);}`;

// Caustics, written for this page: three sine swells, the plane warped by a slow current, add up to a height whose
// zero lines are where light gathers. 1 - |h| / 3 is brightest on those lines and pow() sharpens them into the
// net of light that plays on a sea floor. Alpha follows the light, so the sea beneath shows between the lines.
export const FRAGMENT = `precision mediump float;
uniform vec2 u_res;
uniform float u_time;
float swell(vec2 p, vec2 d, float f, float s){return sin(dot(p, d) * f + u_time * s);}
void main(){
  vec2 p = gl_FragCoord.xy / u_res.y * 3.0;
  p += 0.35 * vec2(sin(p.y * 1.7 + u_time * 0.6), cos(p.x * 1.3 - u_time * 0.5));
  float h = swell(p, vec2(0.8, 0.6), 4.0, 0.9) + swell(p, vec2(-0.5, 0.85), 5.0, -0.7) + swell(p, vec2(0.1, -1.0), 3.3, 0.5);
  float c = pow(1.0 - abs(h) / 3.0, 7.0);
  float depth = gl_FragCoord.y / u_res.y;
  float a = c * (0.25 + 0.5 * depth);
  gl_FragColor = vec4(vec3(0.84, 0.91, 0.93) * a, a);
}`;

export type Water = { draw: (seconds: number) => void; resize: (w: number, h: number) => void; dispose: () => void };

// The WebGL water on a canvas, or null where WebGL cannot draw it (no context, a shader that does not compile, a
// lost context): the caller keeps the static sea.
export function createWater(canvas: HTMLCanvasElement): Water | null {
  let gl: WebGLRenderingContext | null = null;
  try {
    gl = canvas.getContext("webgl", { premultipliedAlpha: true, antialias: false, alpha: true });
  } catch {
    return null;
  }
  if (!gl) return null;
  const shader = (type: number, source: string) => {
    const s = gl.createShader(type);
    if (!s) return null;
    gl.shaderSource(s, source);
    gl.compileShader(s);
    return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null;
  };
  const vs = shader(gl.VERTEX_SHADER, VERTEX);
  const fs = shader(gl.FRAGMENT_SHADER, FRAGMENT);
  const program = gl.createProgram();
  if (!vs || !fs || !program) return null;
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;
  gl.useProgram(program);
  const quad = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const a = gl.getAttribLocation(program, "a");
  gl.enableVertexAttribArray(a);
  gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0);
  const res = gl.getUniformLocation(program, "u_res");
  const time = gl.getUniformLocation(program, "u_time");
  const g = gl;
  return {
    draw(seconds) {
      g.uniform1f(time, seconds);
      g.uniform2f(res, canvas.width, canvas.height);
      g.drawArrays(g.TRIANGLE_STRIP, 0, 4);
    },
    resize(w, h) {
      canvas.width = w;
      canvas.height = h;
      g.viewport(0, 0, w, h);
    },
    dispose() {
      g.deleteBuffer(quad);
      g.deleteProgram(program);
      g.deleteShader(vs);
      g.deleteShader(fs);
    },
  };
}
