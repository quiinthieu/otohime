import assert from "node:assert/strict";
import { test } from "node:test";
import { countTouches, main as mouldMain } from "../scripts/mould-graph.ts";
import {
  buildMouldGraph,
  computeVeinWeight,
  createMouldWorld,
  dropMouldFood,
  repelMouldAt,
  sampleSumiInkRgba,
  settleMouldWorld,
  stepMouldWorld,
  trailChecksum,
  WEIGHT_BASIS,
} from "./mould.ts";

const config = {
  seed: 7,
  width: 64,
  height: 36,
  agentCount: 40,
  preset: "petri-ring" as const,
  weightMode: "commits" as const,
  nodes: [
    { id: "a", label: "A", kind: "food" as const, x: 0.2, y: 0.5, commits: 12, throughputWeight: 0.4, depositWeight: 0.8, swatch: "#171614" },
    { id: "b", label: "B", kind: "food" as const, x: 0.8, y: 0.5, commits: 12, throughputWeight: 0.4, depositWeight: 0.8, swatch: "#171614" },
  ],
  edges: [{ from: "a", to: "b", weight: 0.9, kind: "project" as const }],
};

test("the same seed grows the same trail", () => {
  const left = stepMouldWorld(createMouldWorld(config), 12);
  const right = stepMouldWorld(createMouldWorld(config), 12);
  assert.equal(trailChecksum(left.trail), trailChecksum(right.trail));
  const other = stepMouldWorld(createMouldWorld({ ...config, seed: 8 }), 12);
  assert.notEqual(trailChecksum(left.trail), trailChecksum(other.trail));
});

test("veins thicken between two food sources", () => {
  const world = stepMouldWorld(createMouldWorld(config), 60);
  const { width, height } = world.config;
  let corridor = 0;
  let corridorN = 0;
  let background = 0;
  let backgroundN = 0;
  const y0 = 0.5 * (height - 1);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const value = world.trail[y * width + x];
      const along = x >= 0.2 * (width - 1) && x <= 0.8 * (width - 1) && Math.abs(y - y0) <= 1;
      if (along) {
        corridor += value;
        corridorN += 1;
      } else if (y < 2) {
        background += value;
        backgroundN += 1;
      }
    }
  }
  const corridorMean = corridor / corridorN;
  const backgroundMean = background / backgroundN;
  assert.ok(corridorMean > backgroundMean, `corridor ${corridorMean} background ${backgroundMean}`);
});

test("vein weight grows with commits and with throughput", () => {
  const few = computeVeinWeight(1, 0.2, "commits");
  const many = computeVeinWeight(80, 0.2, "commits");
  assert.ok(many.depositWeight > few.depositWeight);
  assert.ok(many.strokeWidthPx > few.strokeWidthPx);
  const thin = computeVeinWeight(4, 0.1, "throughput");
  const thick = computeVeinWeight(4, 3, "throughput");
  assert.ok(thick.depositWeight > thin.depositWeight && thick.strokeWidthPx > thin.strokeWidthPx);
  for (const mode of ["commits", "throughput", "blended"] as const) {
    const vein = computeVeinWeight(10, 1, mode);
    assert.ok(vein.depositWeight >= 0.35 && vein.depositWeight <= 1);
    assert.ok(vein.strokeWidthPx >= 1.25 && vein.strokeWidthPx <= 5.5);
  }
});

test("food, repel and a settled dish change the trail on purpose", () => {
  const world = createMouldWorld({ ...config, agentCount: 8 });
  const before = world.foods.length;
  dropMouldFood(world, 0.5, 0.5, 0.05, 1);
  assert.equal(world.foods.length, before + 1);
  stepMouldWorld(world, 1);
  const cx = Math.floor(0.5 * (world.config.width - 1));
  const cy = Math.floor(0.5 * (world.config.height - 1));
  assert.ok(world.trail[cy * world.config.width + cx] > 0);
  world.trail.fill(2);
  repelMouldAt(world, 0.5, 0.5, 0.12);
  assert.equal(world.trail[cy * world.config.width + cx], 0);
  const settled = settleMouldWorld(config, 8);
  assert.equal(settled.stepCount, 8);
  assert.ok(trailChecksum(settled.trail) > 0);
});

test("sumi ink stays on the paper and darkens as the trail thickens", () => {
  const paper = sampleSumiInkRgba(0, 0.5);
  const ink = sampleSumiInkRgba(4, 0.5);
  assert.ok(paper[0] > ink[0] && paper[1] > ink[1]);
  assert.equal(paper[3], 255);
  assert.ok(paper.every((channel) => channel >= 0 && channel <= 255));
});

test("the project graph labels illustrative throughput and counts path commits", () => {
  const counts = countTouches("---aaa\napp/(shore)/page.tsx\nlib/x.ts\n---bbb\napp/(site)/(app)/notes/page.tsx\n", [
    { href: "/shore" },
    { href: "/notes" },
  ]);
  assert.deepEqual(counts, [1, 1]);
  const graph = buildMouldGraph({
    generatedAt: "2026-10-29T00:00:00Z",
    head: null,
    projects: [{ title: "Shore", href: "/shore", colour: "mint", commits: 4 }],
    stack: [{ what: "Warehouse", tools: "Snowflake" }],
  });
  assert.equal(graph.weightBasis, WEIGHT_BASIS);
  assert.deepEqual(graph.workGraph.nodes.slice(0, 4).map((node) => node.id), ["source", "queue", "warehouse", "dashboard"]);
  assert.equal(graph.projectsGraph.nodes[0].commits, 4);
  assert.ok(graph.workGraph.edges.some((edge) => edge.kind === "pipeline"));
});

test("the committed mould graph matches this checkout", () => {
  assert.equal(mouldMain(["--check"]), 0);
});
