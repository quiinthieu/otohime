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
