import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { inkCircle, inkLine, inkPath, inkRect, type InkPath } from "./ink.ts";

const ds = (paths: InkPath[]) => paths.map((p) => p.d);

// A changed value means the Sun was redrawn: rough.js moved, or the defaults did.
// Update it only on purpose.
const CORE_SHA256 = "fae75b53f854c8c3e7341a16e4891d7e4b4c7ed2b49397231ff65fac1d5a29ab";

const SHAPES: Record<string, () => InkPath[]> = {
  circle: () => inkCircle(320, 300, 120, { seed: "core", fill: "#fff3b0", hachureAngle: -41 }),
  path: () => inkPath("M320 300 L320 60 A240 240 0 0 1 560 300 Z", { seed: "wedge", fill: "#ffd166", fillStyle: "zigzag" }),
  rect: () => inkRect(10, 10, 120, 60, { seed: "badge", fill: "#f4a259", fillStyle: "solid" }),
  line: () => inkLine(0, 0, 200, 40, { seed: "arrow" }),
};

test("the same call draws the same ink", () => {
  for (const [name, draw] of Object.entries(SHAPES)) assert.deepEqual(draw(), draw(), name);
});

test("different seeds draw different ink", () => {
  const a = ds(inkCircle(100, 100, 50, { seed: "core" }));
  const b = ds(inkCircle(100, 100, 50, { seed: "corona" }));
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
  const paths = inkCircle(100, 100, 50, { seed: "core", fillStyle: "hachure", fill: "#f4b400" });
  assert.ok(paths.length >= 2);
  assert.ok(paths.some((p) => p.stroke === "#f4b400"), "hachure strokes in the fill colour");
  assert.ok(paths.some((p) => p.stroke === "#3a2a28" && p.strokeWidth === 2.2), "the outline is in ink");
});

test("a solid fill comes back as a fill", () => {
  assert.ok(SHAPES.rect().some((p) => p.fill === "#f4a259"));
});

test("pinned snapshot: the core circle", () => {
  const paths = inkCircle(100, 100, 50, { seed: "core", fillStyle: "hachure", fill: "#f4b400" });
  const sha = createHash("sha256").update(ds(paths).join("")).digest("hex");
  assert.equal(sha, CORE_SHA256);
});

test("ink.ts needs no browser", () => {
  const text = readFileSync(new URL("./ink.ts", import.meta.url), "utf8");
  assert.doesNotMatch(text, /\bdocument\b/);
  assert.doesNotMatch(text, /\bwindow\b/);
});
