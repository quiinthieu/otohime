import { test } from "node:test";
import assert from "node:assert/strict";
import { growBonsai, isoWeek, MAX_BRANCHES, visibleBranches, weekDate } from "./bonsai.ts";
test("bonsai ISO weeks validate leap weeks and year boundaries", () => {
  assert.equal(isoWeek(new Date("2027-01-01")), "2026-W53");
  assert.equal(weekDate("2025-W53"), null);
  assert.equal(weekDate("2026-W00"), null);
  assert.equal(weekDate("2026-W99"), null);
});
test("bonsai deterministic growth preserves quiet twigs and subtree pruning", () => {
  const weeks = [{ week: "2026-W40", count: 30 }, { week: "2026-W41", count: 0 }];
  const branches = growBonsai(weeks, "2026-W41");
  assert.deepEqual(branches, growBonsai(weeks, "2026-W41"));
  assert.notDeepEqual(branches, growBonsai(weeks, "2026-W40"));
  assert.deepEqual(branches.filter(b => b.week === "2026-W40"), growBonsai(weeks, "2026-W40"));
  assert.ok(branches.some(b => b.week === "2026-W41" && !b.id.startsWith("trunk")));
  assert.ok(branches.filter(b => b.week === "2026-W41").every(b => !b.leaf));
  const cut = branches.find(b => b.id === "2026-W40-0")!;
  const visible = visibleBranches(branches, new Set([cut.id]));
  assert.ok(visible.length < branches.length - 1);
  assert.ok(visible.every(b => b.week !== "2026-W40" || b.id.startsWith("trunk")));
  assert.deepEqual(visibleBranches(branches, new Set()), branches);
});
test("bonsai bounds high activity and rejects malformed counts", () => {
  const weeks = Array.from({ length: 52 }, (_, i) => ({ week: `2026-W${String(i + 1).padStart(2, "0")}`, count: 100000 }));
  const tree = growBonsai(weeks, "2026-W52");
  assert.ok(tree.length <= MAX_BRANCHES);
  assert.ok(tree.every(b => [b.x, b.y, b.x2, b.y2].every(Number.isFinite)));
  assert.throws(() => growBonsai([{ week: "2026-W01", count: -1 }], "2026-W01"));
});
