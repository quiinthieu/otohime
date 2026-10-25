// The stamp solver, stepped by hand: no DOM, no clock. Sizes are the board's
// own, a 13 px glyph scaled to a block about 24 by 48 px in a tray as wide
// as the phone column and as tall as the desktop one.
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  advance,
  collide,
  corners,
  drag,
  energy,
  grab,
  homeError,
  makeBox,
  makeWorld,
  MAX_MARKS,
  MAX_SPEED,
  release,
  SLEEP_STEPS,
  startTidy,
  step,
  STEP,
  tossVelocity,
  type Box,
  type World,
} from "./stamps.ts";

const W = 358;
const H = 300;
const BW = 24;
const BH = 48;

const at = (x: number, y: number, a = 0) => ({ x, y, a });
const bottom = (b: Box) => Math.max(...corners(b).map((c) => c[1]));
const run = (world: World, n: number, each?: (i: number) => void) => {
  for (let i = 0; i < n; i++) {
    step(world);
    each?.(i);
  }
};

test("a dropped box rests on the floor within 0.5 px and sleeps", () => {
  const box = makeBox(at(40, 20), BW, BH, at(120, 40, 0.3));
  const world = makeWorld(W, H, [box]);
  let slept = -1;
  run(world, 600, (i) => {
    if (slept < 0 && box.asleep) slept = i;
  });
  assert.ok(box.asleep, "never slept");
  assert.ok(slept >= SLEEP_STEPS, `slept at step ${slept}`);
  assert.ok(Math.abs(bottom(box) - H) <= 0.5, `lowest corner ${bottom(box).toFixed(3)} vs floor ${H}`);
  // lying flat on a face, upright or on its side
  const turn = Math.abs(Math.sin(2 * box.a));
  assert.ok(turn < 0.02, `rests at ${box.a.toFixed(3)} rad`);
  assert.equal(box.vx, 0);
  assert.equal(box.vy, 0);
  // asleep, it stays exactly where it is
  const before = { ...box };
  run(world, 120);
  assert.deepEqual({ x: box.x, y: box.y, a: box.a }, { x: before.x, y: before.y, a: before.a });
});

test("a box dropped flat lands with one mark and comes to rest upright", () => {
  const box = makeBox(at(40, 20), BW, BH, at(100, 30));
  const world = makeWorld(W, H, [box]);
  run(world, 400);
  assert.equal(world.marks.length, 1, JSON.stringify(world.marks));
  assert.ok(world.marks[0].speed > 260);
  assert.ok(Math.abs(box.y - (H - BH / 2)) <= 0.5, `centre ${box.y}`);
  assert.ok(Math.abs(box.a) < 1e-3, `angle ${box.a}`);
});

test("two stacked boxes hold for 600 steps", () => {
  const lower = makeBox(at(0, 0), BW * 2, BH, at(150, H - BH / 2));
  const upper = makeBox(at(0, 0), BW, BH, at(152, H - BH * 1.5 - 0.1));
  const world = makeWorld(W, H, [lower, upper]);
  run(world, 600, (i) => {
    assert.ok(Math.abs(upper.a) < 0.01, `upper tipped to ${upper.a} at step ${i}`);
    assert.ok(Math.abs(upper.x - 152) < 1, `upper slid to ${upper.x} at step ${i}`);
  });
  assert.ok(Math.abs(bottom(lower) - H) <= 0.5);
  assert.ok(Math.abs(bottom(upper) - (H - BH)) <= 1, `upper bottom ${bottom(upper)}`);
  assert.ok(lower.asleep && upper.asleep, "the stack never slept");
});

test("energy never rises without input", () => {
  const boxes = [
    makeBox(at(0, 0), BW, BH, at(60, 40, 0.4)),
    makeBox(at(0, 0), BW, BH, at(75, 120, -0.7)),
    makeBox(at(0, 0), BW, BH, at(200, 60, 1.2)),
    makeBox(at(0, 0), BW, BH, at(300, 200, 0)),
  ];
  boxes[2].vx = -600;
  boxes[2].w = 8;
  boxes[3].vy = -900;
  const world = makeWorld(W, H, boxes);
  let last = energy(world);
  const start = last;
  // position passes may lift a box out of an overlap: allow what lifting every box by the slop costs
  const slack = boxes.reduce((s, b) => s + (1 / b.im) * 2400 * 0.25, 0);
  run(world, 1200, (i) => {
    const e = energy(world);
    assert.ok(e <= last + slack, `energy rose from ${last.toFixed(1)} to ${e.toFixed(1)} at step ${i}`);
    last = e;
  });
  assert.ok(last < start, "nothing was lost");
  assert.ok(boxes.every((b) => b.asleep), "not everything came to rest");
});

test("a toss at clamp speed stays inside the walls", () => {
  for (const [vx, vy] of [
    [MAX_SPEED * 3, 0],
    [-MAX_SPEED * 3, -MAX_SPEED],
    [0, -MAX_SPEED * 5],
    [MAX_SPEED, MAX_SPEED],
  ]) {
    const box = makeBox(at(0, 0), BW, BH, at(W / 2, H / 2));
    const other = makeBox(at(0, 0), BW, BH, at(W - 30, H - BH / 2));
    const world = makeWorld(W, H, [box, other]);
    grab(world, 0, W / 2 + 4, H / 2 - 10);
    drag(world, W / 2 + 40, H / 2 - 40);
    run(world, 3);
    release(world, vx, vy);
    assert.ok(Math.hypot(box.vx, box.vy) <= MAX_SPEED + 1e-6, "the toss was not clamped");
    run(world, 480, (i) => {
      for (const b of world.boxes) {
        for (const [x, y] of corners(b)) {
          assert.ok(x >= -1e-6 && x <= W + 1e-6 && y >= -1e-6 && y <= H + 1e-6, `corner (${x}, ${y}) out at step ${i}`);
        }
        assert.ok(Math.hypot(b.vx, b.vy) <= MAX_SPEED + 1e-6);
      }
    });
  }
});

test("tidy brings every box home within 0.5 px in 30 steps", () => {
  const homes = [at(10, 8), at(18, 8), at(26, 8), at(34, 8)];
  const boxes = homes.map((h, i) => makeBox(h, BW, BH, at(40 + i * 80, H - BH / 2, i - 1.5)));
  const world = makeWorld(W, H, boxes);
  boxes[1].vx = MAX_SPEED;
  boxes[2].a = 9.5;
  boxes[2].w = -20;
  boxes[3].vy = -MAX_SPEED;
  startTidy(world);
  run(world, 30);
  assert.ok(homeError(world) <= 0.5, `worst ${homeError(world).toFixed(3)} px from home`);
  for (const [i, b] of boxes.entries()) {
    assert.ok(Math.hypot(b.x - homes[i].x, b.y - homes[i].y) <= 0.5, `box ${i} at (${b.x}, ${b.y})`);
  }
});

test("tidy from across a desktop tray still lands within 0.5 px in 30 steps", () => {
  const box = makeBox(at(20, 10), BW, BH, at(1300, 280, 3));
  const world = makeWorld(1320, 300, [box]);
  box.vx = MAX_SPEED;
  startTidy(world);
  run(world, 30);
  assert.ok(homeError(world) <= 0.5, `${homeError(world)}`);
});

test("a grabbed box follows the pointer, and a release from height leaves a mark", () => {
  const box = makeBox(at(0, 0), BW, BH, at(100, H - BH / 2));
  const world = makeWorld(W, H, [box]);
  run(world, 60);
  assert.ok(box.asleep);
  grab(world, 0, 100, H - BH / 2 - 10);
  drag(world, 180, 80);
  run(world, 120);
  // the grabbed point hangs within a few px of the pointer
  const c = Math.cos(box.a);
  const s = Math.sin(box.a);
  const gx = box.x + c * 0 - s * -10;
  const gy = box.y + s * 0 + c * -10;
  assert.ok(Math.hypot(gx - 180, gy - 80) < 4, `grab point at (${gx.toFixed(1)}, ${gy.toFixed(1)})`);
  const before = world.marks.length;
  release(world);
  run(world, 240);
  // the landing, and maybe a second as a tall block tips over onto its side
  const left = world.marks.length - before;
  assert.ok(left >= 1 && left <= 2, `${left} marks`);
});

test("the mark list keeps the latest 40", () => {
  const box = makeBox(at(0, 0), BW, BH, at(100, 40));
  const world = makeWorld(W, H, [box]);
  for (let i = 0; i < 50; i++) {
    box.x = 40 + (i % 10) * 25;
    box.y = 40;
    box.a = 0;
    box.vx = box.vy = box.w = 0;
    box.asleep = false;
    run(world, 120);
  }
  assert.equal(world.marks.length, MAX_MARKS);
  assert.equal(world.marks.at(-1)!.x, 40 + 9 * 25);
});

test("box-box contacts: one or two points, the normal from a to b", () => {
  const a = makeBox(at(0, 0), 40, 40, at(0, 0));
  const flat = collide(a, makeBox(at(0, 0), 40, 40, at(10, 39)));
  assert.equal(flat.length, 2);
  for (const c of flat) {
    assert.ok(Math.abs(c.nx) < 1e-9 && Math.abs(c.ny - 1) < 1e-9, `normal (${c.nx}, ${c.ny})`);
    assert.ok(Math.abs(c.sep + 1) < 1e-9, `sep ${c.sep}`);
  }
  const corner = collide(a, makeBox(at(0, 0), 40, 40, at(0, 47, Math.PI / 4)));
  assert.equal(corner.length, 1);
  assert.ok(corner[0].ny > 0.99);
  assert.equal(collide(a, makeBox(at(0, 0), 40, 40, at(41, 0))).length, 0);
});

test("the toss is the pointer's velocity over its last 80 ms, clamped", () => {
  const samples = [
    { t: 0, x: 0, y: 0 },
    { t: 0.5, x: 0, y: 0 },
    { t: 0.54, x: 20, y: -10 },
    { t: 0.58, x: 40, y: -20 },
  ];
  const v = tossVelocity(samples);
  assert.ok(Math.abs(v.vx - 500) < 1e-6 && Math.abs(v.vy + 250) < 1e-6, JSON.stringify(v));
  const fast = tossVelocity([
    { t: 0, x: 0, y: 0 },
    { t: 0.01, x: 500, y: 0 },
  ]);
  assert.ok(Math.abs(Math.hypot(fast.vx, fast.vy) - MAX_SPEED) < 1e-6);
  assert.deepEqual(tossVelocity([{ t: 0, x: 0, y: 0 }]), { vx: 0, vy: 0 });
});

test("advance runs fixed 120 Hz steps and carries the remainder", () => {
  const world = makeWorld(W, H, [makeBox(at(0, 0), BW, BH, at(100, 40))]);
  advance(world, 0.02);
  assert.equal(world.steps, 2);
  advance(world, 0.006);
  assert.equal(world.steps, 3);
  assert.ok(Math.abs(world.carry - (0.026 - 3 * STEP)) < 1e-12);
  advance(world, 5);
  assert.equal(world.steps, 15, "a stalled frame runs at most 12 steps");
});
