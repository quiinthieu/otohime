// Crate to platter: when a pointer becomes a drag, the round drop target, and
// that neither the dragged disc nor the flight is ever drawn over the player.
import assert from "node:assert/strict";
import { test } from "node:test";
import { intersects, layout, type Box } from "./geometry.ts";
import {
  around,
  boxOf,
  dragStep,
  FLIGHT_MS,
  flightPlan,
  ghostAllowed,
  ghostBox,
  GHOST_PX,
  insideDisc,
  LONG_PRESS_MS,
  MOVE_PX,
  TOUCH_SLOP_PX,
} from "./flight.ts";

test("mouse and pen drags start once they move, touch drags after a long press", () => {
  for (const type of ["mouse", "pen"]) {
    assert.equal(dragStep(type, MOVE_PX - 1, 0), "wait");
    assert.equal(dragStep(type, MOVE_PX, 0), "start");
    assert.equal(dragStep(type, 2, 5000), "wait", "holding a mouse still is not a drag");
  }
  assert.equal(dragStep("touch", 3, 100), "wait");
  assert.equal(dragStep("touch", TOUCH_SLOP_PX + 1, 100), "cancel", "moving early is a scroll");
  assert.equal(dragStep("touch", 0, LONG_PRESS_MS), "start");
  assert.equal(dragStep("touch", 40, LONG_PRESS_MS + 10), "start");
});

test("the platter is round: its box's corners are not the drop target", () => {
  const disc = { x: 100, y: 100, w: 200, h: 200 };
  assert.ok(insideDisc({ x: 200, y: 200 }, disc));
  assert.ok(insideDisc({ x: 299, y: 200 }, disc));
  assert.ok(!insideDisc({ x: 105, y: 105 }, disc));
  assert.ok(!insideDisc({ x: 50, y: 200 }, disc));
  assert.ok(!insideDisc({ x: 200, y: 200 }, { x: 0, y: 0, w: 0, h: 0 }));
});

test("the ghost is centred on the pointer and never drawn over the monitor", () => {
  assert.deepEqual(ghostBox({ x: 100, y: 50 }), { x: 100 - GHOST_PX / 2, y: 50 - GHOST_PX / 2, w: GHOST_PX, h: GHOST_PX });
  const monitor = { x: 500, y: 0, w: 480, h: 270 };
  assert.ok(ghostAllowed(ghostBox({ x: 300, y: 100 }), monitor));
  assert.ok(!ghostAllowed(ghostBox({ x: 600, y: 100 }), monitor));
  assert.ok(!ghostAllowed(ghostBox({ x: 500 - GHOST_PX / 2 + 1, y: 100 }), monitor), "even one pixel of overlap");
  assert.ok(ghostAllowed(ghostBox({ x: 500 - GHOST_PX / 2, y: 100 }), monitor), "touching edges is fine");
  assert.ok(ghostAllowed(ghostBox({ x: 600, y: 100 }), null));
});

test("a flight is FLIP: laid out on the platter, inverted onto the sleeve, transform and opacity only", () => {
  const from = { x: 20, y: 300, w: 148, h: 148 };
  const to = { x: 300, y: 80, w: 296, h: 296 };
  const plan = flightPlan(from, to, { x: 900, y: 0, w: 480, h: 270 }, false);
  assert.ok(plan);
  assert.deepEqual(plan.box, to);
  assert.equal(plan.duration, FLIGHT_MS);
  assert.ok(plan.duration >= 400 && plan.duration <= 500);
  assert.equal(plan.keyframes[0].transform, "translate(-280.0px, 220.0px) scale(0.5000)");
  assert.equal(plan.keyframes.at(-1)!.transform, "translate(0px, 0px) scale(1)");
  assert.equal(plan.keyframes.at(-1)!.opacity, 0);
  for (const k of plan.keyframes) assert.deepEqual(Object.keys(k).filter((key) => key !== "offset").sort(), ["opacity", "transform"]);
});

test("no flight under reduced motion, from a box with no size, or across the monitor", () => {
  const from = { x: 20, y: 300, w: 148, h: 148 };
  const to = { x: 300, y: 80, w: 296, h: 296 };
  assert.equal(flightPlan(from, to, null, true), null);
  assert.equal(flightPlan({ ...from, w: 0 }, to, null, false), null);
  assert.equal(flightPlan(from, { ...to, h: Number.NaN }, null, false), null);
  // a monitor between the sleeve and the platter: the path would cross it
  assert.equal(flightPlan(from, to, { x: 200, y: 250, w: 60, h: 60 }, false), null);
  assert.ok(flightPlan(from, to, null, false));
});

test("at every width the crate-to-platter flight clears the player", () => {
  for (const vw of [1440, 1366, 1024, 768, 390, 320]) {
    const l = layout(vw);
    // from each corner of the crate, as a sleeve-sized box, to the platter
    const size = Math.min(148, l.crate.w);
    const sleeves: Box[] = [
      { x: l.crate.x, y: l.crate.y, w: size, h: size },
      { x: l.crate.x + l.crate.w - size, y: l.crate.y, w: size, h: size },
      { x: l.crate.x, y: l.crate.y + l.crate.h - size, w: size, h: size },
      { x: l.crate.x + l.crate.w - size, y: l.crate.y + l.crate.h - size, w: size, h: size },
    ];
    for (const from of sleeves) {
      const plan = flightPlan(from, l.platter, l.monitorFrame, false);
      assert.ok(plan, `${vw}: the layout lets the record fly`);
      assert.ok(!intersects(around(from, l.platter), l.monitor), `${vw}`);
    }
  }
});

test("boxOf reads an element's viewport box", () => {
  assert.deepEqual(boxOf({ getBoundingClientRect: () => ({ left: 1, top: 2, width: 3, height: 4 }) }), { x: 1, y: 2, w: 3, h: 4 });
  assert.equal(boxOf(null), null);
  assert.equal(boxOf(undefined), null);
});
