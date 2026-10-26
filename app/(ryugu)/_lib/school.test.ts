// The ink fish, frame by frame: the same school from the same seed, inside the sea, cruising when left alone and
// darting away from a pointer or a touch, never faster than MAX_SPEED and never teleported by a long frame.
import assert from "node:assert/strict";
import { test } from "node:test";
import { COUNT, CRUISE, FLEE_RADIUS, fishTransform, MAX_DT, MAX_SPEED, newSchool, SEA, stepSchool, toSea, type Fish, type Point } from "./school.ts";

const FRAME = 1 / 60;
const run = (school: Fish[], seconds: number, pointer: (t: number) => Point = () => null) => {
  let s = school;
  for (let i = 0, t = 0; t < seconds; i++, t = i * FRAME) s = stepSchool(s, FRAME, t, pointer(t));
  return s;
};
const speed = (f: Fish) => Math.hypot(f.vx, f.vy);
const inside = (f: Fish) => f.x >= 0 && f.x <= SEA.w && f.y >= 0 && f.y <= SEA.h;

test("the same seed gives the same school, so the server's still sea is the client's first frame", () => {
  assert.deepEqual(newSchool(), newSchool());
  assert.notDeepEqual(newSchool(1), newSchool(2));
  assert.equal(newSchool().length, COUNT);
  for (const f of newSchool()) {
    assert.ok(inside(f));
    // above the palace, in the upper two thirds
    assert.ok(f.y <= SEA.h * 0.62, `${f.y}`);
    assert.ok(Math.abs(speed(f) - CRUISE) < CRUISE, `${speed(f)}`);
  }
});

test("left alone for a minute, the school stays in the sea at about cruising speed", () => {
  const s = run(newSchool(), 60);
  for (const f of s) {
    assert.ok(inside(f), `${f.x},${f.y}`);
    assert.ok(speed(f) <= CRUISE * 1.5, `${speed(f)}`);
  }
});

test("a pointer close to a fish drives it away, faster than cruising and further than without it", () => {
  const [fish] = newSchool();
  const near = { x: fish.x - 40, y: fish.y };
  const calm = run([fish], 0.5)[0];
  const fled = run([fish], 0.5, () => near)[0];
  const from = (f: Fish) => Math.hypot(f.x - near.x, f.y - near.y);
  assert.ok(from(fled) > from(calm) + 20, `${from(fled)} vs ${from(calm)}`);
  assert.ok(fled.x > fish.x + 20, "it fled to the right, away from a pointer on its left");
  assert.ok(speed(fled) > CRUISE * 2, `${speed(fled)}`);
});

test("a touch right on top of a fish sends it off along its own heading", () => {
  const fish: Fish = { x: 500, y: 300, vx: CRUISE, vy: 0, size: 1, phase: 0 };
  const fled = run([fish], 0.2, () => ({ x: 500, y: 300 }))[0];
  assert.ok(fled.x > 500 + 15, `${fled.x}`);
});

test("a pointer beyond FLEE_RADIUS frightens nobody", () => {
  const [fish] = newSchool();
  const far = { x: fish.x + FLEE_RADIUS + 400, y: fish.y };
  assert.deepEqual(run([fish], 0.5, () => far), run([fish], 0.5));
});

test("however long it is chased, no fish passes MAX_SPEED or leaves the sea", () => {
  let s = newSchool();
  // a pointer sweeping the sea for twenty seconds
  s = run(s, 20, (t) => ({ x: (t * 300) % SEA.w, y: SEA.h / 2 + Math.sin(t) * 200 }));
  for (const f of s) {
    assert.ok(speed(f) <= MAX_SPEED + 1e-9, `${speed(f)}`);
    assert.ok(inside(f), `${f.x},${f.y}`);
  }
});

test("a long frame (a tab back from the background) counts as MAX_DT, and a zero or negative one moves nothing", () => {
  const school = newSchool();
  assert.deepEqual(stepSchool(school, 30, 1, null), stepSchool(school, MAX_DT, 1, null));
  assert.deepEqual(stepSchool(school, 0, 1, null), school);
  assert.deepEqual(stepSchool(school, -1, 1, null), school);
  assert.notEqual(stepSchool(school, 0, 1, null), school, "a copy, never the same array");
});

test("fishTransform faces the fish the way it swims", () => {
  assert.equal(fishTransform({ x: 10, y: 20, vx: 0, vy: 5, size: 1.2, phase: 0 }), "translate(10.0 20.0) rotate(90.0) scale(1.2)");
  assert.equal(fishTransform({ x: 0, y: 0, vx: -5, vy: 0, size: 1, phase: 0 }), "translate(0.0 0.0) rotate(180.0) scale(1)");
});

test("toSea maps a pointer into the scene's units through the slice crop, and refuses an empty box", () => {
  // 2000 x 600 on screen: scale 2, the 1200-unit-tall drawing cropped 300 px top and bottom
  const box = { left: 0, top: 100, width: 2000, height: 600 };
  assert.deepEqual(toSea(1000, 400, box), { x: 500, y: 300 });
  assert.deepEqual(toSea(0, 100, box), { x: 0, y: 150 });
  // the same aspect as the sea: a plain scale
  assert.deepEqual(toSea(250, 150, { left: 0, top: 0, width: 500, height: 300 }), { x: 500, y: 300 });
  assert.equal(toSea(1, 1, { left: 0, top: 0, width: 0, height: 300 }), null);
});
