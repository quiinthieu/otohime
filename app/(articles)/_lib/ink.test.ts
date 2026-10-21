import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { inkCircle, inkLine, inkPath, inkRect, SEED, type InkPath } from "./ink.ts";

const ds = (paths: InkPath[]) => paths.map((p) => p.d);

// A changed value means the figures were redrawn: rough.js moved, or the defaults did.
// Update it only on purpose.
const CORE_SHA256 = "5d2a6fdcbd876e75cbc7a0286474953b42e5b84bcfbeae23758df6cad31bd4e9";

const SHAPES: Record<string, () => InkPath[]> = {
  circle: () => inkCircle(320, 300, 120, { seed: "earth", fill: "#c9c1b2", hachureAngle: -41 }),
  path: () => inkPath("M320 300 L320 60 A240 240 0 0 1 560 300 Z", { seed: "bulge", fill: "#b23a2f", fillStyle: "zigzag" }),
  rect: () => inkRect(10, 10, 120, 60, { seed: "jar", fill: "#f3eee3", fillStyle: "solid" }),
  line: () => inkLine(0, 0, 200, 40, { seed: "sunbeam" }),
};

test("the Gazette's seed is 213", () => {
  assert.equal(SEED, 213);
});

test("the same call draws the same ink", () => {
  for (const [name, draw] of Object.entries(SHAPES)) assert.deepEqual(draw(), draw(), name);
});

test("different seeds draw different ink", () => {
  const a = ds(inkCircle(100, 100, 50, { seed: "earth" }));
  const b = ds(inkCircle(100, 100, 50, { seed: "moon" }));
  assert.notDeepEqual(a, b);
  assert.notDeepEqual(ds(inkCircle(100, 100, 50)), ds(inkCircle(100, 100, 50, { seed: 7 })));
});

test("every path is well formed: starts with M, no NaN or undefined", () => {
  for (const [name, draw] of Object.entries(SHAPES)) {
    const paths = draw();
    assert.ok(paths.length > 0, name);
    for (const p of paths) {
      assert.match(p.d, /^M/, name);
      assert.doesNotMatch(p.d, /NaN|undefined|Infinity/, name);
      assert.ok(Number.isFinite(p.strokeWidth), name);
      assert.ok(p.stroke.length > 0, name);
    }
  }
});

test("a hachure-filled circle has an outline and a fill", () => {
  const paths = inkCircle(100, 100, 50, { seed: "earth", fillStyle: "hachure", fill: "#b23a2f" });
  assert.ok(paths.length >= 2);
  assert.ok(paths.some((p) => p.stroke === "#b23a2f"), "hachure strokes in the fill colour");
  assert.ok(paths.some((p) => p.stroke === "#1a1816" && p.strokeWidth === 2.2), "the outline is in ink");
});

test("the default roughness is 0.9, steadier than Orrery's 1.4", () => {
  assert.deepEqual(ds(inkLine(0, 0, 200, 40, { seed: "sunbeam" })), ds(inkLine(0, 0, 200, 40, { seed: "sunbeam", roughness: 0.9 })));
  assert.notDeepEqual(ds(inkLine(0, 0, 200, 40, { seed: "sunbeam" })), ds(inkLine(0, 0, 200, 40, { seed: "sunbeam", roughness: 1.4 })));
});

test("a solid fill comes back as a fill", () => {
  assert.ok(SHAPES.rect().some((p) => p.fill === "#f3eee3"));
});

test("pinned snapshot: the earth circle", () => {
  const paths = inkCircle(100, 100, 50, { seed: "earth", fillStyle: "hachure", fill: "#b23a2f" });
  const sha = createHash("sha256").update(ds(paths).join("")).digest("hex");
  assert.equal(sha, CORE_SHA256);
});

test("ink.ts needs no browser", () => {
  const text = readFileSync(new URL("./ink.ts", import.meta.url), "utf8");
  assert.doesNotMatch(text, /\bdocument\b/);
  assert.doesNotMatch(text, /\bwindow\b/);
});
