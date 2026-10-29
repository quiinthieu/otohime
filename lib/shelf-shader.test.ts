import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  buildShelfUniforms, grazingDepthThreshold, hatchDensityBand, HATCH_BANDS,
  parseOutlineDebugParams, SHELF_THRESHOLDS, shelfCompositeFragment, shelfCompositeVertex,
  shelfNormalFragment, shelfObjectFragment, shelfObjectVertex, sobelEdgeWeight,
} from "./shelf-shader.ts";

test("grazing depth thresholds scale by 1/ndv and suppress steep plank gradients", () => {
  const base = SHELF_THRESHOLDS.depth;
  assert.equal(grazingDepthThreshold(base, 1), base);
  assert.equal(grazingDepthThreshold(base, 0.5), base * 2);
  assert.ok(Math.abs(grazingDepthThreshold(base, 0.2) - base * 5) < 1e-12);
  for (const ndv of [0, 0.01, 0.1, 0.199, -0.1]) {
    assert.equal(grazingDepthThreshold(base, ndv), Infinity);
    assert.equal(0.9 > grazingDepthThreshold(base, ndv), false, "plank's false depth edge is suppressed");
  }
  assert.equal(grazingDepthThreshold(base, -0.5), base * 2);
  assert.equal(grazingDepthThreshold(base, 0.3, 0.4), Infinity);
  assert.ok(base * 1.5 > grazingDepthThreshold(base, 1), "front-facing true depth edge fires");
  // The shader preserves occupancy silhouettes independently of the surface threshold.
  assert.match(shelfCompositeFragment, /depthEdge = max\(depthEdge, silhouette\)/);
  const suppressedDepth = 0.9 > grazingDepthThreshold(base, 0.1) ? 1 : 0;
  assert.equal(sobelEdgeWeight(Math.max(suppressedDepth, 1), 0, 1, 1), 1, "grazing silhouette still fires");
});

test("Sobel depth and normal channels combine by weighted maximum, with independent controls", () => {
  assert.equal(sobelEdgeWeight(0.4, 0.7, 2, 0.5), 0.8);
  assert.equal(sobelEdgeWeight(0.4, 0.7, 0, 2), 1.4);
  assert.equal(sobelEdgeWeight(1, 1, 0, 0), 0);
});

test("four hatching bands choose exact boundaries and share thresholds with GLSL", () => {
  assert.deepEqual([-1, 0, 0.24999, 0.25, 0.49999, 0.5, 0.74999, 0.75, 1, 2].map(hatchDensityBand), [3, 3, 3, 2, 2, 1, 1, 0, 0, 0]);
  for (const boundary of HATCH_BANDS) assert.ok(shelfObjectFragment.includes(`luminance < ${boundary}`));
  assert.match(shelfObjectFragment, /objectHatching\(vObjectPosition, vObjectNormal, luminance\)/);
  assert.match(shelfObjectVertex, /vObjectPosition = position/);
  assert.match(shelfObjectFragment, /p\.x - p\.y/);
  assert.match(shelfObjectFragment, /fwidth\(coordinate\)/);
  assert.doesNotMatch(shelfObjectFragment, /gl_FragCoord|uTime/);
});

test("debug query parsing is strict, finite and bounded; uniforms match the inspected state", () => {
  const defaults = { debug: false, kd: 1, kn: 1, ndvCutoff: 0.2 };
  assert.deepEqual(parseOutlineDebugParams(new URLSearchParams()), defaults);
  assert.deepEqual(parseOutlineDebugParams(new URLSearchParams("outlineDebug=true&kd=&kn=NaN&ndvCutoff=Infinity")), defaults);
  assert.deepEqual(parseOutlineDebugParams(new URLSearchParams("outlineDebug=1&kd=2.5&kn=0&ndvCutoff=0.35")), { debug: true, kd: 2.5, kn: 0, ndvCutoff: 0.35 });
  assert.deepEqual(parseOutlineDebugParams(new URLSearchParams("kd=-9&kn=900&ndvCutoff=0")), { debug: false, kd: 0, kn: 8, ndvCutoff: 0.2 });
  assert.equal(parseOutlineDebugParams(new URLSearchParams("ndvCutoff=3")).ndvCutoff, 1);
  const uniforms = buildShelfUniforms({ ...defaults, debug: true, kd: 3 });
  assert.equal(uniforms.uDebug.value, 1); assert.equal(uniforms.uKd.value, 3);
  assert.equal(uniforms.uDepthThreshold.value, SHELF_THRESHOLDS.depth);
  assert.equal(uniforms.uNormalThreshold.value, SHELF_THRESHOLDS.normal);
  assert.equal(uniforms.uNdvCutoff.value, SHELF_THRESHOLDS.minNdv);
  uniforms.uKd.value = 7;
  assert.equal(buildShelfUniforms(defaults).uKd.value, 1, "builders do not share mutable uniform state");
});

test("GLSL uses linearized depth, view-space normals, full Sobel kernels and explicit grazing suppression", () => {
  assert.match(shelfNormalFragment, /abs\(dot\(N, V\)\)/);
  assert.match(shelfNormalFragment, /vec4\(N \* 0\.5 \+ 0\.5, ndv\)/);
  assert.match(shelfObjectVertex, /normalMatrix \* normal/);
  assert.match(shelfCompositeFragment, /\(uNear \* uFar\) \/ \(uFar - depth \* \(uFar - uNear\)\)/);
  assert.match(shelfCompositeFragment, /for \(int y = -1; y <= 1; y\+\+\)/);
  assert.match(shelfCompositeFragment, /for \(int x = -1; x <= 1; x\+\+\)/);
  assert.match(shelfCompositeFragment, /uDepthThreshold \/ max\(ndv, 0\.2\)/);
  assert.match(shelfCompositeFragment, /ndv < uNdvCutoff \? 0\.0/);
  assert.match(shelfCompositeFragment, /max\(uKd \* depthEdge, uKn \* normalEdge\)/);
  assert.match(shelfCompositeFragment, /brushNoise/);
  assert.match(shelfCompositeFragment, /vec2 uv = clamp\(vUv \+/);
  assert.match(shelfObjectFragment, /luminance < 0\.4 \? 0\.62 : luminance < 0\.72 \? 0\.82 : 1\.0/);
  assert.match(shelfCompositeVertex, /gl_Position = vec4\(position.xy/);
});

const root = new URL("../", import.meta.url);
function sources(directory: string): string[] {
  return readdirSync(new URL(`${directory}/`, root), { withFileTypes: true }).flatMap((entry) => {
    const name = `${directory}/${entry.name}`;
    return entry.isDirectory() ? sources(name) : /\.[cm]?[jt]sx?$/.test(name) && !/\.test\./.test(name) ? [name] : [];
  });
}
const read = (name: string) => readFileSync(new URL(name, root), "utf8");

test("bundle isolation: only the shelf lazy renderer and existing atom import Three/R3F", () => {
  const imports3D = /(?:from\s*|import\s*\(|require\s*\()\s*["'](?:three(?:\/[^"']*)?|@react-three\/[^"']+)["']/;
  const importers = ["app", "components", "lib"].flatMap(sources).filter((file) => imports3D.test(read(file))).sort();
  assert.deepEqual(importers, ["app/(elements)/_components/atom-3d.tsx", "components/ink-shelf-3d.tsx"]);
  assert.doesNotMatch(read("lib/shelf-shader.ts"), imports3D, "CPU references stay importable in Node");
  const shell = read("components/ink-shelf.tsx");
  assert.match(shell, /dynamic\(\(\) => import\("@\/components\/ink-shelf-3d"\), \{ ssr: false \}\)/);
  assert.match(shell, /capable && !failed && books.length > 0/);
  const shellImporters = ["app", "components", "lib"].flatMap(sources).filter((name) => /["']@\/components\/ink-shelf["']/.test(read(name)));
  assert.deepEqual(shellImporters, [path.posix.join("app", "(site)", "(app)", "shelf", "page.tsx")]);
});

test("renderer lifecycle keeps demand frames, bounded DPR, context-loss fallback and explicit GPU disposal", () => {
  const renderer = read("components/ink-shelf-3d.tsx");
  assert.match(renderer, /frameloop="demand" dpr=\{\[1, 1\.5\]\}/);
  assert.match(renderer, /new DepthTexture/); assert.match(renderer, /scene.overrideMaterial = pipeline.normalMaterial/);
  for (const resource of ["colour", "normals", "normalMaterial", "composite", "quad.geometry"]) {
    assert.ok(renderer.includes(`pipeline.${resource}.dispose()`));
  }
  assert.match(renderer, /resources.texture.dispose\(\)/);
  assert.match(renderer, /onHover\(book.id\)/);
  assert.match(renderer, /focusedBook === book.id \|\| hoveredBook === book.id/);
  assert.match(renderer, /event.preventDefault\(\); onFail\(\)/);
  assert.match(renderer, /removeEventListener\("webglcontextlost", lost\)/);
  assert.match(renderer, /fallback=\{null\}/, "R3F always mounts canvas fallback DOM; it must not signal renderer failure");
  assert.doesNotMatch(renderer, /requestAnimationFrame|setInterval/);
});
