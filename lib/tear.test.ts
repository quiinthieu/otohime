import assert from "node:assert/strict";
import { test } from "node:test";
import { deckle, tearState } from "./tear.ts";
test("seeded deckle is deterministic, finite, bounded and changes with the surface seed", () => {
  assert.equal(deckle(42,1),deckle(42,1)); assert.notEqual(deckle(42,1),deckle(43,1));
  assert.match(deckle(42,1),/^polygon\(/); assert.equal(deckle(42,0),"polygon(0 0, 100% 0, 100% 100%, 0 100%)");
  for(const seed of [0,1,42,-1,NaN,Infinity]) for(const amount of [-2,0,0.5,1,3,NaN]) {
    const polygon=deckle(seed,amount); assert.doesNotMatch(polygon,/NaN|Infinity/);
    for(const m of polygon.matchAll(/([\d.]+)%/g)) assert.ok(Number(m[1])>=0 && Number(m[1])<=100);
  }
});
test("peel, Reset and cancellation use the same instant reversible state", () => {
  assert.equal(tearState("intact","peel"),"peeled"); assert.equal(tearState("peeled","reset"),"intact");
  assert.equal(tearState("peeled","cancel"),"intact"); assert.equal(tearState("intact","cancel"),"intact");
});
