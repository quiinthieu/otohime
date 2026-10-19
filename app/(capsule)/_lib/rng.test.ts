import assert from "node:assert/strict";
import { test } from "node:test";
import { prng } from "./rng.ts";

test("the same seed and step give the same value", () => {
  for (const [seed, n] of [[0, 0], [42, 7], [4294967295, 123456], [-5, 3]]) {
    assert.equal(prng(seed, n), prng(seed, n));
  }
  assert.notEqual(prng(42, 0), prng(42, 1));
  assert.notEqual(prng(42, 0), prng(43, 0));
});

test("values stay in [0, 1)", () => {
  for (const seed of [0, 1, 42, 0x9e3779b9, 4294967295]) {
    for (let n = 0; n < 5000; n++) {
      const u = prng(seed, n);
      assert.ok(u >= 0 && u < 1, `prng(${seed}, ${n}) = ${u}`);
    }
  }
});
