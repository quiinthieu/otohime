import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyHands, CREATURES, OneEuro, PoseTracker } from "./shadow-poses.ts";
import { handFixture, poseFixture } from "./fixtures/shadow-hands.ts";
test("shadow poses recognize all four synthetic fixtures and mirrored hands", () => {
  for (const pose of CREATURES) {
    const hands = poseFixture(pose);
    assert.equal(classifyHands(hands), pose);
    assert.equal(classifyHands(hands.map(h => h.map(p => ({ ...p, x: 1 - p.x })))), pose);
    assert.equal(classifyHands(hands.map(h => h.map(p => ({ ...p, x: p.y, y: 1 - p.x })))), pose);
  }
});
test("shadow poses reject missing ambiguous and invalid landmarks", () => {
  assert.equal(classifyHands([]), "neutral");
  assert.equal(classifyHands([handFixture([true, true, true, true])]), "neutral");
  assert.equal(classifyHands([handFixture([false, false, false, false])]), "neutral");
  assert.equal(classifyHands([handFixture([true, true, true, false])]), "neutral");
  assert.equal(classifyHands([[{ x: NaN, y: 0, z: 0 }]]), "neutral");
});
test("shadow pose stability debounces six frames and resets on missing hands", () => {
  const tracker = new PoseTracker();
  for (let frame = 0; frame < 5; frame++) assert.equal(tracker.update(poseFixture("rabbit"), frame * 55).pose, "neutral");
  assert.equal(tracker.update(poseFixture("rabbit"), 275).pose, "rabbit");
  assert.equal(tracker.update(poseFixture("dog"), 330).pose, "rabbit");
  assert.equal(tracker.update([], 385).pose, "neutral");
  const filter = new OneEuro();
  filter.filter(0, 0);
  assert.ok(filter.filter(1, 55) < 0.8);
  assert.ok(Number.isFinite(filter.filter(1, 55)));
});
