import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { inkCircle, inkLine, inkPath, inkRect, SEED, type InkPath } from "./ink.ts";

const ds = (paths: InkPath[]) => paths.map((p) => p.d);

const SHAPES: Record<string, () => InkPath[]> = {
  star: () => inkCircle(40, 40, 16, { seed: "star-A", fill: "#f2b134", hachureAngle: -41 }),
  window: () => inkRect(10, 10, 40, 50, { seed: "window-0", fill: "#fffaf0", fillStyle: "solid" }),
  key: () => inkPath("M0 0 A20 20 0 0 1 40 0 Z", { seed: "key-Q" }),
  tape: () => inkLine(0, 0, 300, 0, { seed: "tape" }),
};

test("the seed is 203", () => {
  assert.equal(SEED, 203);
});

test("the same seed draws the same path data", () => {
  for (const [name, draw] of Object.entries(SHAPES)) assert.deepEqual(draw(), draw(), name);
  assert.deepEqual(ds(inkCircle(10, 10, 5)), ds(inkCircle(10, 10, 5, { seed: SEED })));
});

test("different seeds draw different ink", () => {
  assert.notDeepEqual(ds(inkCircle(100, 100, 50, { seed: "star-A" })), ds(inkCircle(100, 100, 50, { seed: "star-B" })));
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
    }
  }
});

test("a solid fill comes back as a fill", () => {
  assert.ok(SHAPES.window().some((p) => p.fill === "#fffaf0"));
});

test("ink.ts needs no browser", () => {
  const text = readFileSync(new URL("./ink.ts", import.meta.url), "utf8");
  assert.doesNotMatch(text, /\bdocument\b/);
  assert.doesNotMatch(text, /\bwindow\b/);
});
