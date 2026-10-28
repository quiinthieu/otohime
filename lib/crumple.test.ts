import assert from 'node:assert/strict';
import { test } from 'node:test';
import { foldMesh, createFold, FOLD_MS, MAX_BALLS } from './crumple.ts';

test('seeded paper triangles and creases are deterministic, finite and bounded throughout the fold', () => {
  assert.equal(MAX_BALLS, 8);
  for (const seed of [0, 1, 42, 0xffffffff]) {
    for (const elapsed of [0, 1, 100, 200, 399, 400, 10000]) {
      const mesh = foldMesh(seed, elapsed);
      assert.deepEqual(mesh, foldMesh(seed, elapsed));
      assert.equal(mesh.length, 72);
      for (const triangle of mesh) {
        assert.equal(triangle.points.length, 3);
        assert.ok(triangle.shade >= 0 && triangle.shade <= 1);
        for (const p of triangle.points) {
          assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y));
          assert.ok(p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1);
          if (elapsed >= FOLD_MS) assert.ok(Math.hypot(p.x - .5, p.y - .5) <= .251);
        }
      }
    }
  }
  assert.notDeepEqual(foldMesh(1, FOLD_MS), foldMesh(2, FOLD_MS));
  assert.deepEqual(foldMesh(42, FOLD_MS), foldMesh(42, FOLD_MS + 1));
});

test('injected elapsed clock completes at 400ms, cancellation is terminal until explicit restart, reset is immediate', () => {
  let now = 50;
  const fold = createFold({ seed: 42, clock: () => now });
  assert.equal(fold.state, 'intact');
  fold.start(); assert.equal(fold.state, 'folding');
  now += 399; assert.equal(fold.tick(), 'folding');
  now++; assert.equal(fold.tick(), 'ball');
  fold.reset(); assert.equal(fold.state, 'intact');
  fold.start(); now += 200; fold.cancel(); now += 10000;
  assert.equal(fold.tick(), 'intact'); assert.equal(fold.elapsed, 0);
  fold.start(true); assert.equal(fold.state, 'ball'); assert.equal(fold.elapsed, FOLD_MS);
  fold.reset(); assert.equal(fold.state, 'intact');
});

test('invalid seed, elapsed and clocks fail closed; backwards clocks never reverse geometry', () => {
  for (const seed of [NaN, Infinity, -1, 1.1, 2 ** 32]) assert.throws(() => foldMesh(seed, 0), RangeError);
  for (const elapsed of [NaN, Infinity, -1]) assert.throws(() => foldMesh(1, elapsed), RangeError);
  assert.throws(() => createFold({ seed: 1, clock: () => NaN }).start(), RangeError);
  let now = 100;
  const fold = createFold({ seed: 1, clock: () => now }); fold.start();
  now = 300; fold.tick(); now = 200; fold.tick(); assert.equal(fold.elapsed, 200);
  now = Infinity; assert.throws(() => fold.tick(), RangeError);
  assert.equal(fold.state, 'intact');
});

import { launchBall, stepBall, placeInBasket, BALL_LIMIT_MS, type BallWorld } from './crumple.ts';
const world: BallWorld = { width: 800, height: 600, basket: { left: 300, right: 420, top: 400, bottom: 480 } };
function simulate(x: number, vx = 0) {
  let b = launchBall({ x, y: 250 }, { x: vx, y: 0 }, world);
  for (let i = 0; i < 700 && b.state === 'flying'; i++) b = stepBall(b, 10, world);
  return b;
}
test('fixed-step basket opening catches a real falling circle; a rim strike misses (negative control)', () => {
  assert.equal(simulate(360).state, 'basket');
  const miss = simulate(300);
  assert.ok(miss.rimHits > 0); assert.equal(miss.state, 'rest');
  assert.notEqual(miss.state, simulate(360).state);
  assert.deepEqual(simulate(300), simulate(300));
});
test('high velocity, resize, invalid delta and active five-second bound stay finite and sleep', () => {
  assert.equal(BALL_LIMIT_MS, 5000);
  let b = launchBall({ x: -1e9, y: 1e9 }, { x: 1e12, y: -1e12 }, world);
  assert.ok(Math.abs(b.vx) <= 1200 && Math.abs(b.vy) <= 1200);
  assert.deepEqual(stepBall(b, NaN, world), b);
  assert.deepEqual(stepBall(b, -1, world), b);
  const small = { ...world, width: 180, height: 160 };
  for (let i = 0; i < 501 && b.state === 'flying'; i++) {
    b = stepBall(b, 10, small);
    assert.ok([b.x, b.y, b.vx, b.vy].every(Number.isFinite));
    assert.ok(b.x >= b.radius && b.x <= small.width - b.radius);
    assert.ok(b.y >= b.radius && b.y <= small.height - b.radius);
  }
  assert.notEqual(b.state, 'flying'); assert.ok(b.activeMs <= 5000);
  assert.deepEqual(stepBall(b, 100, small), b);
  assert.throws(() => launchBall({ x: NaN, y: 0 }, { x: 0, y: 0 }, world), RangeError);
  assert.throws(() => stepBall(b, 10, { ...world, width: NaN }), RangeError);
  const placed = placeInBasket(world); assert.equal(placed.state, 'basket'); assert.equal(placed.x, 360);
});
test('clamped finite delta and fixed substeps cannot tunnel through the opening or run forever', () => {
  const a = launchBall({ x: 360, y: 200 }, { x: 0, y: 1200 }, world);
  assert.equal(stepBall(a, Infinity, world).activeMs, 0);
  let b = a;
  for (let i = 0; i < 25 && b.state === 'flying'; i++) b = stepBall(b, 1e9, world);
  assert.equal(b.state, 'basket'); assert.ok(b.activeMs <= 5000);
  let c = launchBall({ x: 70, y: 80 }, { x: 1100, y: -1100 }, world);
  // Force energy each step to demonstrate the deadline independent of natural rest.
  for (let i = 0; i < 20; i++) c = stepBall({ ...c, state: 'flying', vx: 1100, vy: -1100 }, 250, world);
  assert.equal(c.activeMs, 5000); assert.equal(c.state, 'rest'); assert.equal(c.vx, 0);
});
