"use client";

import { useEffect, useRef } from "react";
import { isSeason } from "@/lib/seasons";
import {
  chooseSusukiMode, createFoxState, createSusukiBlades, stepFoxState,
  stepPointerSpring, stepScrollGust, susukiBladeCount, susukiSeasonTint,
  type PointerSpring,
} from "@/lib/susuki";

declare global {
  interface Window { __triggerSusukiFox?: () => void }
}

// Six attributes per blade; the final instance uses the same strip for the fox.
// Sixteen vertical segments make bending quadratic rather than rotating a quad.
const VERTEX = `#version 300 es
precision highp float;
layout(location=0) in vec4 aBlade;
layout(location=1) in vec2 aTip;
uniform vec2 uSize, uPointer, uPointerVel;
uniform float uTime, uScrollBoost, uFox, uBladeCount;
out vec2 vUV;
out float vPlume, vDepth;
flat out int vFox;
void main() {
  vFox = int(float(gl_InstanceID) >= uBladeCount);
  if (vFox == 1) {
    int id = min(gl_VertexID, 3);
    vec2 uv = vec2(float(id % 2), float(id / 2));
    vUV = uv; vPlume = 0.; vDepth = 1.;
    vec2 pos = vec2(uFox * (uSize.x + 144.) - 144., uSize.y * .72);
    pos += vec2(uv.x * 112., -uv.y * 64. + sin(uTime * 18.) * 2.);
    gl_Position = vec4(pos / uSize * vec2(2., -2.) + vec2(-1., 1.), 0., 1.);
    return;
  }
  float h = float(gl_VertexID / 2) / 16.;
  float side = float(gl_VertexID % 2) * 2. - 1.;
  vec2 root = vec2(aBlade.x, .52 + aBlade.y * .48);
  float lengthPx = (36. + aBlade.z * 136.) * (.6 + aBlade.y * .4);
  float wind = sin(uTime + aTip.x + aBlade.y * 4.) * (9. + 4. * uScrollBoost);
  float dist = length((root - uPointer) * vec2(1., .6));
  float gust = pow(max(0., 1. - dist / .18), 2.) *
    (sign(root.x - uPointer.x + .0001) * 58. + clamp(uPointerVel.x, -3., 3.) * 24.);
  float foxDist = abs(root.x - uFox);
  float foxGust = uFox >= 0. ? sign(root.x - uFox) * pow(max(0., 1. - foxDist / .12), 2.) * 42. : 0.;
  float plume = smoothstep(1. - aTip.y, 1. - aTip.y + .05, h);
  float width = mix(.55, 3.8 * sin((h - (1. - aTip.y)) / aTip.y * 3.14159), plume);
  width = max(.2, width) * (.6 + aBlade.y * .4);
  vec2 pos = root * uSize + vec2((aBlade.w * lengthPx + wind + gust + foxGust) * h * h + side * width, -lengthPx * h);
  gl_Position = vec4(pos / uSize * vec2(2., -2.) + vec2(-1., 1.), 0., 1.);
  vUV = vec2(side, h); vPlume = plume; vDepth = aBlade.y;
}`;
const FRAGMENT = `#version 300 es
precision highp float;
in vec2 vUV;
in float vPlume, vDepth;
flat in int vFox;
uniform vec3 uTint, uPlume;
uniform sampler2D uFoxAtlas;
uniform float uTime;
out vec4 color;
void main() {
  if (vFox == 1) {
    vec2 uv = vec2((vUV.x + mod(floor(uTime * 9.), 4.)) / 4., 1. - vUV.y);
    color = vec4(uTint, texture(uFoxAtlas, uv).a * .92);
    return;
  }
  float hash = fract(sin(dot(floor(gl_FragCoord.xy * vec2(1., .35)), vec2(12.9898,78.233))) * 43758.5453);
  float streak = mix(.25, .95, step(.28, hash));
  float feather = 1. - smoothstep(.35, 1., abs(vUV.x));
  color = vec4(mix(uTint, uPlume, vPlume), (.3 + vDepth * .5) * streak * mix(1., feather, vPlume));
}`;

// Baked four-pose ink silhouette, generated locally; no fetch or external asset.
function foxAtlas() {
  const atlas = document.createElement("canvas");
  atlas.width = 448; atlas.height = 64;
  const ctx = atlas.getContext("2d")!;
  for (let frame = 0; frame < 4; frame++) {
    ctx.save(); ctx.translate(frame * 112, 0); ctx.fillStyle = "#18201a";
    ctx.beginPath();
    ctx.moveTo(15, 42); ctx.bezierCurveTo(2, 38, 0, 17, 5, 10);
    ctx.bezierCurveTo(10, 27, 25, 22, 35, 31);
    ctx.bezierCurveTo(46, 25, 65, 25, 78, 29);
    ctx.lineTo(82, 13); ctx.lineTo(89, 23); ctx.lineTo(98, 15);
    ctx.lineTo(98, 31); ctx.lineTo(110, 37); ctx.lineTo(96, 44);
    ctx.bezierCurveTo(73, 40, 57, 47, 35, 43); ctx.closePath(); ctx.fill();
    ctx.lineWidth = 4; ctx.lineCap = "round"; ctx.strokeStyle = "#18201a";
    for (let leg = 0; leg < 4; leg++) {
      const x = leg < 2 ? 40 : 79;
      const swing = Math.sin(frame * Math.PI / 2 + leg * Math.PI) * 9;
      ctx.beginPath(); ctx.moveTo(x, 40); ctx.lineTo(x + swing, 51); ctx.lineTo(x + swing * 1.6 + 3, 60); ctx.stroke();
    }
    ctx.restore();
  }
  return atlas;
}

function createRenderer(gl: WebGL2RenderingContext, canvas: HTMLCanvasElement) {
  const program = gl.createProgram()!;
  const buffer = gl.createBuffer()!;
  const vao = gl.createVertexArray()!;
  const texture = gl.createTexture()!;
  const shaders: WebGLShader[] = [];
  const dispose = () => {
    gl.deleteBuffer(buffer); gl.deleteVertexArray(vao); gl.deleteTexture(texture);
    shaders.forEach(s => gl.deleteShader(s)); gl.deleteProgram(program);
  };
  try {
    for (const [type, source] of [[gl.VERTEX_SHADER, VERTEX], [gl.FRAGMENT_SHADER, FRAGMENT]] as const) {
      const shader = gl.createShader(type)!; shaders.push(shader);
      gl.shaderSource(shader, source); gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) ?? "Susuki shader");
      gl.attachShader(program, shader);
    }
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) ?? "Susuki link");
    gl.bindVertexArray(vao); gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    // One spare attribute slot for the fox when the maximum blade count is used.
    const blades = createSusukiBlades(8000, 299);
    const data = new Float32Array(blades.length + 6); data.set(blades);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 24, 0); gl.vertexAttribDivisor(0, 1);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 24, 16); gl.vertexAttribDivisor(1, 1);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, foxAtlas());
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  } catch (error) { dispose(); throw error; }
  const uniforms = Object.fromEntries(["uSize", "uPointer", "uPointerVel", "uTime", "uScrollBoost", "uFox", "uBladeCount", "uTint", "uPlume", "uFoxAtlas"].map(n => [n, gl.getUniformLocation(program, n)]));
  return {
    dispose,
    draw(time: number, pointer: PointerSpring, boost: number, fox: number, count: number, tint: ReturnType<typeof susukiSeasonTint>) {
      gl.useProgram(program); gl.bindVertexArray(vao);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
      gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.uniform1i(uniforms.uFoxAtlas, 0);
      gl.uniform2f(uniforms.uSize, canvas.clientWidth, canvas.clientHeight);
      gl.uniform2f(uniforms.uPointer, pointer.x, pointer.y); gl.uniform2f(uniforms.uPointerVel, pointer.vx, pointer.vy);
      gl.uniform1f(uniforms.uTime, time); gl.uniform1f(uniforms.uScrollBoost, boost);
      gl.uniform1f(uniforms.uFox, fox); gl.uniform1f(uniforms.uBladeCount, count);
      gl.uniform3fv(uniforms.uTint, tint.ink); gl.uniform3fv(uniforms.uPlume, tint.plume);
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 34, count + (fox >= 0 ? 1 : 0));
    },
  };
}

type Connection = EventTarget & { saveData?: boolean };
const CALM: PointerSpring = { x: -2, y: -2, vx: 0, vy: 0 };

export default function SusukiField() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current!;
    const footer = canvas.closest<HTMLElement>("footer.end")!;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    const dark = matchMedia("(prefers-color-scheme: dark)");
    const connection = (navigator as Navigator & { connection?: Connection }).connection;
    let gl: WebGL2RenderingContext | null = null;
    try { gl = canvas.getContext("webgl2", { alpha: true, antialias: false }); } catch {}
    let renderer: ReturnType<typeof createRenderer> | null = null;
    let ctx: CanvasRenderingContext2D | null = null;
    if (!gl) ctx = canvas.getContext("2d");
    let initialized = false, lost = false, visible = false, disposed = false, raf = 0, last = 0, time = 0, ticks = 0, frames = 0;
    let slow = 0, boost = 0, delta = 0, lastScroll = scrollY;
    let pointer = CALM, target = { x: -2, y: -2 };
    let fox = createFoxState();
    try { fox = createFoxState({ hasRun: sessionStorage.getItem("susuki-fox") === "1" }); } catch {}
    let tint = susukiSeasonTint("autumn", "light");
    let mode: "live" | "static" = "static";
    function stop() { if (raf) cancelAnimationFrame(raf); raf = 0; last = 0; canvas.dataset.running = "false"; }
    function syncFox() {
      canvas.dataset.fox = fox.phase;
      if (fox.hasRun) { try { sessionStorage.setItem("susuki-fox", "1"); } catch {} }
    }
    function render() {
      if (!initialized || lost || disposed) return;
      const count = susukiBladeCount(canvas.clientWidth, slow);
      if (renderer) renderer.draw(time, mode === "live" ? pointer : CALM, mode === "live" ? boost : 0, mode === "live" && fox.phase === "trotting" ? fox.x : -1, count, tint);
      else if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const dpr = canvas.width / canvas.clientWidth;
        ctx.save(); ctx.scale(dpr, dpr);
        const blades = createSusukiBlades(360, 299);
        for (let i = 0; i < blades.length; i += 6) {
          const [x, depth, height, lean] = blades.subarray(i, i + 4);
          const rootX = x * canvas.clientWidth, rootY = (.52 + depth * .48) * canvas.clientHeight;
          const h = 36 + height * 136;
          ctx.strokeStyle = `rgb(${tint.ink.map(v => v * 255).join(" ")} / .6)`;
          ctx.lineWidth = .7; ctx.beginPath(); ctx.moveTo(rootX, rootY);
          ctx.quadraticCurveTo(rootX, rootY - h * .6, rootX + lean * h, rootY - h); ctx.stroke();
          ctx.strokeStyle = `rgb(${tint.plume.map(v => v * 255).join(" ")} / .8)`;
          ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(rootX + lean * h * .65, rootY - h * .78); ctx.lineTo(rootX + lean * h, rootY - h); ctx.stroke();
        }
        ctx.restore();
      }
      canvas.dataset.frames = String(++frames);
      canvas.dataset.blades = String(count);
      canvas.dataset.gust = String(mode === "live" ? Math.hypot(pointer.vx, pointer.vy) : 0);
      canvas.dataset.scrollBoost = String(mode === "live" ? boost : 0);
      syncFox();
    }
    function schedule() {
      if (!raf && visible && !document.hidden && mode === "live" && !lost && !disposed) {
        canvas.dataset.running = "true"; raf = requestAnimationFrame(frame);
      }
    }
    function frame(now: number) {
      // Stable probe marker; EndStage's counters must exclude this ambient loop.
      canvas.dataset.loop = "susuki-ambient-frame";
      raf = 0;
      if (!visible || document.hidden || mode !== "live" || lost || disposed) { stop(); return; }
      const elapsed = last ? (now - last) / 1000 : 1 / 60;
      if (last && elapsed > .020) slow = 1;
      const dt = Math.min(.05, elapsed); last = now;
      boost = stepScrollGust(boost, delta, dt); delta = 0;
      time += dt * (1 + boost);
      pointer = stepPointerSpring(pointer, target, dt);
      fox = stepFoxState(fox, dt);
      canvas.dataset.rafTicks = String(++ticks);
      render(); schedule();
    }
    function appearance() {
      const root = document.documentElement;
      const season = isSeason(root.dataset.season) ? root.dataset.season : "autumn";
      const scheme = root.dataset.theme === "dark" || (root.dataset.theme !== "light" && dark.matches) ? "dark" : "light";
      tint = susukiSeasonTint(season, scheme);
      canvas.dataset.season = season; canvas.dataset.tint = tint.ink.join(",");
      render();
    }
    function policy() {
      stop(); mode = chooseSusukiMode({ webgl2: !!renderer, reducedMotion: reduced.matches, saveData: !!connection?.saveData, contextLost: lost });
      canvas.dataset.mode = mode; canvas.dataset.state = lost ? "context-lost" : mode;
      if (mode === "static") { pointer = CALM; target = CALM; boost = 0; delta = 0; fox = createFoxState({ hasRun: fox.hasRun }); }
      initialized = true; render(); schedule();
    }
    function resize() {
      const dpr = Math.min(devicePixelRatio || 1, 1.5);
      const w = Math.max(1, Math.round(canvas.clientWidth * dpr)), h = Math.max(1, Math.round(canvas.clientHeight * dpr));
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; render(); }
    }
    function initGL() {
      if (!gl) return;
      try { renderer = createRenderer(gl, canvas); canvas.dataset.renderer = "webgl2"; }
      catch { canvas.dataset.renderer = "unavailable"; }
    }
    function input(type: "pointer" | "scroll" | "key") {
      const wasTrotting = fox.phase === "trotting";
      fox = stepFoxState(fox, { type }); syncFox();
      if (wasTrotting) render();
    }
    function move(e: PointerEvent) {
      input("pointer");
      if (mode !== "live" || (e.pointerType === "touch" && e.buttons === 0)) return;
      const rect = canvas.getBoundingClientRect();
      target = { x: (e.clientX - rect.left) / rect.width, y: (e.clientY - rect.top) / rect.height };
    }
    function leave(e: PointerEvent) {
      input("pointer"); target = { x: -2, y: -2 };
      // A released touch must not send the spring sweeping back across blades.
      if (e.pointerType === "touch" && mode === "live") { pointer = CALM; render(); }
    }
    function scroll() { input("scroll"); delta += scrollY - lastScroll; lastScroll = scrollY; }
    function key() { input("key"); }
    function trigger() { if (mode === "live" && visible && !document.hidden && !lost) { fox = stepFoxState(fox, { type: "trigger" }); syncFox(); render(); } }
    function visibility() { if (document.hidden) stop(); else schedule(); }
    function contextLost(e: Event) { e.preventDefault(); lost = true; stop(); policy(); }
    function contextRestored() { renderer?.dispose(); renderer = null; lost = false; initGL(); policy(); }
    const observer = new MutationObserver(appearance);
    observer.observe(document.documentElement, { attributeFilter: ["data-season", "data-theme"] });
    const triggerObserver = new MutationObserver(() => { if (canvas.hasAttribute("data-susuki-fox-trigger")) { trigger(); canvas.removeAttribute("data-susuki-fox-trigger"); } });
    triggerObserver.observe(canvas, { attributeFilter: ["data-susuki-fox-trigger"] });
    const intersection = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; if (visible) schedule(); else stop(); });
    const size = new ResizeObserver(resize);
    canvas.dataset.rafTicks = "0";
    initGL(); if (!gl) canvas.dataset.renderer = "2d";
    resize(); appearance(); policy();
    size.observe(canvas); intersection.observe(footer);
    const passive = { passive: true };
    footer.addEventListener("pointermove", move, passive); footer.addEventListener("pointerdown", move, passive);
    footer.addEventListener("pointerleave", leave, passive); footer.addEventListener("pointerup", leave, passive); footer.addEventListener("pointercancel", leave, passive);
    window.addEventListener("scroll", scroll, passive); window.addEventListener("keydown", key, passive);
    document.addEventListener("visibilitychange", visibility);
    canvas.addEventListener("webglcontextlost", contextLost); canvas.addEventListener("webglcontextrestored", contextRestored);
    reduced.addEventListener("change", policy); dark.addEventListener("change", appearance); connection?.addEventListener?.("change", policy);
    window.__triggerSusukiFox = trigger;
    return () => {
      disposed = true; stop(); renderer?.dispose();
      observer.disconnect(); triggerObserver.disconnect(); intersection.disconnect(); size.disconnect();
      footer.removeEventListener("pointermove", move); footer.removeEventListener("pointerdown", move);
      footer.removeEventListener("pointerleave", leave); footer.removeEventListener("pointerup", leave); footer.removeEventListener("pointercancel", leave);
      window.removeEventListener("scroll", scroll); window.removeEventListener("keydown", key);
      document.removeEventListener("visibilitychange", visibility);
      canvas.removeEventListener("webglcontextlost", contextLost); canvas.removeEventListener("webglcontextrestored", contextRestored);
      reduced.removeEventListener("change", policy); dark.removeEventListener("change", appearance); connection?.removeEventListener?.("change", policy);
      if (window.__triggerSusukiFox === trigger) delete window.__triggerSusukiFox;
    };
  }, []);
  return <canvas ref={ref} aria-hidden="true" data-susuki-field="" />;
}
