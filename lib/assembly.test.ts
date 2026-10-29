import assert from "node:assert/strict";
import { test } from "node:test";
import { assemblyProgress, CRATE_LIMIT, processCrate } from "./assembly.ts";
import { assemblyStations } from "../content/assembly.ts";

test("the visitor crate is cleaned, chopped, sorted and packed without losing letters", () => {
  const result = processCrate("  Zebra! 42 ");
  assert.deepEqual(result.stages, ["  Zebra! 42 ", "ZEBRA42", "Z / E / B / R / A / 4 / 2", "2 · 4 · A · B · E · R · Z", "[ 2 · 4 · A · B · E · R · Z ]"]);
  assert.equal(result.count, 7);
  assert.deepEqual(result.sorted, [...result.chopped].sort());
  assert.deepEqual(processCrate("  Zebra! 42 "), result);
});
test("empty, punctuation, Unicode and long crates remain bounded and readable", () => {
  assert.equal(processCrate("!? ").packed, "[ empty ]");
  assert.equal(processCrate("").count, 0);
  assert.equal(processCrate("café猫").count, 5);
  assert.equal(processCrate("ＡＢ").clean, "AB");
  assert.equal(processCrate("x".repeat(1000)).count, CRATE_LIMIT);
  assert.equal(processCrate("<script>").clean, "SCRIPT");
});
test("scroll progress reaches every station and reverses with the visitor", () => {
  const centers = [100, 300, 500, 700, 900];
  assert.equal(assemblyProgress(centers, -200), 0);
  assert.equal(assemblyProgress(centers, 400), 1.5);
  assert.equal(assemblyProgress(centers, 9000), 4);
  assert.deepEqual(centers.map(focus => assemblyProgress(centers, focus)), [0, 1, 2, 3, 4]);
  assert.equal(assemblyProgress([], 0), 0);
  assert.deepEqual(assemblyStations.map(station => station.id), ["ingest", "clean", "transform", "load", "serve"]);
});
