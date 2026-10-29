"use client";

import { useEffect, useRef } from "react";

// A tiny fragment shader, isolated from ink artwork so a lost context keeps the sticker readable.
export function HoloFoil() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current!;
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    if (motion.matches) return;
    const gl = canvas.getContext("webgl", { alpha: true, antialias: false });
    if (!gl) return;
    const shader = (type: number, source: string) => {
      const s = gl.createShader(type)!; gl.shaderSource(s, source); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { gl.deleteShader(s); return null; }
      return s;
    };
    const vs = shader(gl.VERTEX_SHADER, "attribute vec2 p;varying vec2 uv;void main(){uv=p*.5+.5;gl_Position=vec4(p,0.,1.);}");
    const fs = shader(gl.FRAGMENT_SHADER, "precision mediump float;varying vec2 uv;uniform float t;uniform vec2 mouse;void main(){float a=uv.x*10.+uv.y*7.+t+mouse.x*3.+mouse.y*2.;vec3 c=.65+.35*cos(a+vec3(0.,2.1,4.2));float stripe=.5+.5*sin(a*8.);gl_FragColor=vec4(c,.18+stripe*.15);}");
    if (!vs || !fs) { if (vs) gl.deleteShader(vs); if (fs) gl.deleteShader(fs); return; }
    const program = gl.createProgram()!; gl.attachShader(program, vs); gl.attachShader(program, fs); gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) { gl.deleteProgram(program); gl.deleteShader(vs); gl.deleteShader(fs); return; }
    gl.useProgram(program);
    const buffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const p = gl.getAttribLocation(program, "p"); gl.enableVertexAttribArray(p); gl.vertexAttribPointer(p, 2, gl.FLOAT, false, 0, 0);
    const time = gl.getUniformLocation(program, "t"), mouse = gl.getUniformLocation(program, "mouse");
    let frame = 0, visible = true;
    const move = (e: PointerEvent) => { const b = canvas.getBoundingClientRect(); gl.uniform2f(mouse, (e.clientX - b.left) / b.width, (e.clientY - b.top) / b.height); };
    const render = (t: number) => { frame = 0; if (!visible || document.hidden || motion.matches || gl.isContextLost()) return; gl.uniform1f(time, t / 3000); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); frame = requestAnimationFrame(render); };
    const resume = () => { if (!frame) frame = requestAnimationFrame(render); };
    const observer = new IntersectionObserver(entries => { visible = entries[0].isIntersecting; if (visible) resume(); });
    observer.observe(canvas); canvas.parentElement?.addEventListener("pointermove", move);
    document.addEventListener("visibilitychange", resume); motion.addEventListener("change", resume); resume();
    return () => { cancelAnimationFrame(frame); observer.disconnect(); canvas.parentElement?.removeEventListener("pointermove", move); document.removeEventListener("visibilitychange", resume); motion.removeEventListener("change", resume); gl.deleteBuffer(buffer); gl.deleteProgram(program); gl.deleteShader(vs); gl.deleteShader(fs); };
  }, []);
  return <canvas ref={ref} width="192" height="224" className="holo-foil" aria-hidden="true" />;
}
