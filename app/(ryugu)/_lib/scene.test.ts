// The sea's motion rules and their fallbacks: the loop runs only for a live sea (WebGL, motion welcome) on a page
// someone can see; reduced motion asks for no WebGL context at all; a missing or lost context keeps the still sea
// that the server drew. The component is read as text for its wiring; e2e/ryugu.test.ts watches it in a browser.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { animating, bufferSize, createWater, FRAGMENT, sceneMode, VERTEX } from "./scene.ts";

const read = (p: string) => readFileSync(join(import.meta.dirname, "..", p), "utf8");
const SEA = read("_components/sea.tsx");
const CSS = read("ryugu.css").replace(/\/\*[\s\S]*?\*\//g, "");

test("reduced motion is still whatever the GPU can do; without WebGL the sea is static; otherwise it is live", () => {
  assert.equal(sceneMode({ reduced: true, webgl: true }), "still");
  assert.equal(sceneMode({ reduced: true, webgl: false }), "still");
  assert.equal(sceneMode({ reduced: false, webgl: false }), "static");
  assert.equal(sceneMode({ reduced: false, webgl: true }), "live");
});

test("only a live sea on a visible page animates", () => {
  assert.equal(animating("live", false), true);
  assert.equal(animating("live", true), false, "a hidden page pauses");
  for (const mode of ["still", "static"] as const) {
    assert.equal(animating(mode, false), false, mode);
    assert.equal(animating(mode, true), false, mode);
  }
});

test("the water's buffer follows the canvas's box, capped at 1.5 dppx and 1600 across", () => {
  assert.deepEqual(bufferSize(800, 600, 1), { w: 800, h: 600 });
  assert.deepEqual(bufferSize(800, 600, 3), { w: 1200, h: 900 });
  assert.deepEqual(bufferSize(2400, 1200, 2), { w: 1600, h: 800 });
  assert.deepEqual(bufferSize(0, 600, 2), { w: 0, h: 0 });
  assert.deepEqual(bufferSize(Number.NaN, 600, 2), { w: 0, h: 0 });
  assert.deepEqual(bufferSize(100, 50, 0), { w: 100, h: 50 });
});

// A canvas stand-in for the fallback paths: what getContext gives, and whether it threw.
const canvas = (context: unknown, throws = false) =>
  ({
    getContext: () => {
      if (throws) throw new Error("blocked");
      return context;
    },
  }) as unknown as HTMLCanvasElement;

test("createWater gives null, not an error, when there is no WebGL, it throws, or a shader will not compile", () => {
  assert.equal(createWater(canvas(null)), null);
  assert.equal(createWater(canvas(null, true)), null);
  const failing = {
    VERTEX_SHADER: 1,
    FRAGMENT_SHADER: 2,
    COMPILE_STATUS: 3,
    createShader: () => ({}),
    shaderSource: () => {},
    compileShader: () => {},
    getShaderParameter: () => false,
    createProgram: () => ({}),
  };
  assert.equal(createWater(canvas(failing)), null);
});

test("the shaders are WebGL 1 GLSL: one attribute, the resolution and the time, no textures", () => {
  assert.match(VERTEX, /attribute vec2 a;/);
  assert.match(FRAGMENT, /^precision mediump float;/);
  assert.match(FRAGMENT, /uniform vec2 u_res;/);
  assert.match(FRAGMENT, /uniform float u_time;/);
  assert.match(FRAGMENT, /gl_FragColor = /);
  assert.doesNotMatch(FRAGMENT, /sampler2D|texture2D|#version/);
});

test("the sea is a client component that asks for WebGL only when motion is welcome", () => {
  assert.match(SEA, /^"use client";/);
  assert.match(SEA, /const REDUCED = "\(prefers-reduced-motion: reduce\)";/);
  assert.match(SEA, /if \(!reduced\.matches && !tried\) \{\s*tried = true;\s*water = createWater\(canvas\);/);
  assert.match(SEA, /mode = sceneMode\(\{ reduced: reduced\.matches, webgl: water !== null \}\);/);
  assert.match(SEA, /reduced\.addEventListener\("change", update\)/);
  assert.match(SEA, /reduced\.removeEventListener\("change", update\)/);
});

test("the loop is scheduled only while animating, stops when the page is hidden, and is cancelled on unmount", () => {
  assert.equal(SEA.match(/requestAnimationFrame\(/g)?.length, 1, "one place schedules a frame");
  assert.match(SEA, /if \(!raf && animating\(mode, document\.hidden\)\) raf = requestAnimationFrame\(frame\);/);
  assert.match(SEA, /if \(animating\(mode, document\.hidden\)\) schedule\(\);\s*else stop\(\);/);
  assert.match(SEA, /document\.addEventListener\("visibilitychange", update\)/);
  assert.match(SEA, /document\.removeEventListener\("visibilitychange", update\)/);
  assert.match(SEA, /cancelAnimationFrame\(raf\)/);
  assert.match(SEA, /return \(\) => \{\s*stop\(\);/);
  // a lost context leaves the still sea
  assert.match(SEA, /addEventListener\("webglcontextlost", lost\)/);
});

test("the fish flee pointer and touch alike: pointer events, let go on leave, cancel or a lifted finger", () => {
  for (const handler of ["onPointerMove={near}", "onPointerDown={near}", "onPointerLeave={gone}", "onPointerCancel={gone}"]) {
    assert.ok(SEA.includes(handler), handler);
  }
  assert.match(SEA, /onPointerUp=\{\(event\) => event\.pointerType !== "mouse" && gone\(\)\}/);
  assert.match(SEA, /pointer\.current = box \? toSea\(event\.clientX, event\.clientY, box\) : null;/);
});

test("the still sea is served: a static SVG-filter caustic, the palace and the seeded fish, with no animation", () => {
  assert.match(SEA, /<filter id="ryugu-caustic"[\s\S]*<feTurbulence[\s\S]*<feComponentTransfer>/);
  assert.match(SEA, /<rect className="caustic" [^>]*filter="url\(#ryugu-caustic\)" \/>/);
  assert.match(SEA, /\{SCHOOL\.map\(\(f, i\) => \(\s*<g key=\{i\} data-fish="" transform=\{fishTransform\(f\)\}>/);
  assert.doesNotMatch(SEA, /<animate|<animateTransform|<set /, "nothing in the SVG moves by itself");
  assert.match(SEA, /useState<Mode \| "served">\("served"\)/);
  assert.match(SEA, /data-water=\{mode\}/);
});

test("ryugu.css shows the WebGL water only for a live sea, and the static caustic otherwise", () => {
  assert.match(CSS, /\.sea-water \{[^}]*opacity: 0;/);
  assert.match(CSS, /\.sea\[data-water="live"\] \.sea-water \{[^}]*opacity: 0\.9;/);
  assert.match(CSS, /\.sea-still \.caustic \{[^}]*opacity: 0\.7;/);
  // The only motion in the sheet is the way down, under no-preference; reduced motion takes every animation away.
  const animated = [...CSS.matchAll(/([^{}]+)\{[^{}]*\banimation:/g)].map((m) => m[1].trim());
  assert.deepEqual(animated.filter((s) => s.startsWith(".")), [".surface", ".palace-copy"]);
  assert.match(CSS, /@media \(prefers-reduced-motion: no-preference\) \{\s*\.surface \{/);
  assert.match(CSS, /@media \(prefers-reduced-motion: reduce\) \{\s*\*,\s*\*::before,\s*\*::after \{\s*animation: none !important;\s*transition: none !important;/);
});
