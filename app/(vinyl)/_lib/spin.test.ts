// The platter's inertia: it spins up and down smoothly, never jumps, and holds
// still under reduced motion.
import assert from "node:assert/strict";
import { test } from "node:test";
import { rpmValue } from "./deck.ts";
import { advance, MAX_DT_MS, REST, settled, type Spin } from "./spin.ts";

const FRAME = 16;
const R33 = rpmValue(33);
const R45 = rpmValue(45);

function frames(start: Spin, target: number, ms: number, reduced = false) {
  const out = [start];
  for (let t = 0; t < ms; t += FRAME) out.push(advance(out.at(-1)!, FRAME, target, reduced));
  return out;
}
// How far the platter turned between two frames, the short way round.
const turned = (a: Spin, b: Spin) => (b.angle - a.angle + 360) % 360;

test("spins up to 98% of 33⅓ within 1.3 s at 16 ms frames", () => {
  for (const target of [R33, R45]) {
    const run = frames(REST, target, 1300);
    assert.ok(run.at(-1)!.rpm >= 0.98 * target, `${target}: ${run.at(-1)!.rpm}`);
    // and not instantly: inertia is visible in the first 100 ms
    assert.ok(run[6].rpm < 0.5 * target);
  }
});

test("spins down to a full stop within 2 s", () => {
  for (const from of [R33, R45]) {
    const run = frames({ angle: 10, rpm: from }, 0, 2000);
    assert.equal(run.at(-1)!.rpm, 0, `from ${from}`);
    assert.ok(settled(run.at(-1)!, 0));
    // a stopped platter stays where it stopped
    const still = frames(run.at(-1)!, 0, 500);
    assert.ok(still.every((s) => s.angle === run.at(-1)!.angle));
    // and it took a while: no snap to zero
    assert.ok(run[30].rpm > 0.1 * from);
  }
});

test("rpm moves monotonically towards the target and never overshoots", () => {
  const cases: [Spin, number][] = [
    [REST, R33],
    [REST, R45],
    [{ angle: 0, rpm: R45 }, 0],
    [{ angle: 0, rpm: R33 }, R45],
    [{ angle: 0, rpm: R45 }, R33],
  ];
  for (const [start, target] of cases) {
    const run = frames(start, target, 3000);
    for (let i = 1; i < run.length; i++) {
      const [a, b] = [run[i - 1].rpm, run[i].rpm];
      if (target >= start.rpm) assert.ok(b >= a && b <= target, `${a} → ${b} towards ${target}`);
      else assert.ok(b <= a && b >= target, `${a} → ${b} towards ${target}`);
    }
    assert.equal(run.at(-1)!.rpm, target, "snaps onto the target at the end");
  }
});

test("no frame turns the platter more than rpm × 6 × 0.1 degrees (no snap)", () => {
  const pairs: [Spin, Spin][] = [];
  for (const run of [frames(REST, R45, 2000), frames({ angle: 0, rpm: R45 }, 0, 2500), frames({ angle: 300, rpm: R33 }, R45, 2000)]) {
    for (let i = 1; i < run.length; i++) pairs.push([run[i - 1], run[i]]);
  }
  // long frames, from a background tab
  for (const s of frames(REST, R33, 2000)) pairs.push([s, advance(s, 5000, R33, false)]);
  let biggest = 0;
  for (const [a, b] of pairs) {
    const limit = Math.max(a.rpm, b.rpm) * 6 * 0.1;
    const moved = turned(a, b);
    assert.ok(moved <= limit + 1e-9, `${JSON.stringify(a)} → ${JSON.stringify(b)} moved ${moved}° with limit ${limit}°`);
    biggest = Math.max(biggest, moved);
  }
  assert.ok(biggest > 0);
});

test("the angle is continuous and stays in [0, 360)", () => {
  const run = frames({ angle: 359, rpm: R45 }, R45, 5000);
  for (const s of run) assert.ok(s.angle >= 0 && s.angle < 360, String(s.angle));
  // steady 45 rpm turns 45 × 6 × 0.016 = 4.32° a frame
  assert.ok(Math.abs(turned(run[10], run[11]) - 4.32) < 1e-9);
});

test("a 5 s frame is clamped to 100 ms", () => {
  const start = { angle: 20, rpm: R33 };
  assert.deepEqual(advance(start, 5000, R33, false), advance(start, MAX_DT_MS, R33, false));
  assert.deepEqual(advance(REST, 5000, R45, false), advance(REST, MAX_DT_MS, R45, false));
  // nonsense frames do nothing
  assert.deepEqual(advance(start, -16, R33, false), start);
  assert.deepEqual(advance(start, NaN, R33, false), start);
});

test("reduced motion freezes the angle", () => {
  for (const [start, target] of [
    [REST, R33],
    [{ angle: 123, rpm: R45 }, R45],
    [{ angle: 77, rpm: R33 }, 0],
  ] as [Spin, number][]) {
    const run = frames(start, target, 2000, true);
    assert.ok(run.every((s) => s.angle === start.angle));
    assert.equal(run.at(-1)!.rpm, target);
  }
});

test("settled only when stopped and meant to stay stopped", () => {
  assert.ok(settled(REST, 0));
  assert.ok(!settled(REST, R33));
  assert.ok(!settled({ angle: 0, rpm: 1 }, 0));
});
