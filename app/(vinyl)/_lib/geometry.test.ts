// YouTube's size and overlap rules, proven on the layout's numbers: the player
// is at least 200×200 everywhere and 480×270 from 1024 px, it fits the
// viewport, and no other box touches any part of it.
import assert from "node:assert/strict";
import { test } from "node:test";
import { contains, DESKTOP_MIN, intersects, layout, MONITOR_MIN_H, MONITOR_MIN_W, MONITOR_TARGET_H, PLATTER, TONEARM_SWEEP, TURNTABLE_VIEW, type Box } from "./geometry.ts";

const WIDTHS = [1440, 1366, 1280, 1024, 1023, 900, 768, 600, 414, 390, 360, 320];
const OTHERS = ["crate", "turntable", "platter", "tonearmSweep", "lcd", "transport"] as const;

test("the player is at least 200×200 at every width, and 480×270 from 1024 px", () => {
  for (const vw of WIDTHS) {
    const { monitor, mode } = layout(vw);
    assert.ok(monitor.w >= 200 && monitor.h >= MONITOR_MIN_H, `${vw}: ${monitor.w}×${monitor.h}`);
    if (vw >= DESKTOP_MIN) {
      assert.equal(mode, "desktop");
      assert.ok(monitor.w >= MONITOR_MIN_W && monitor.h >= MONITOR_TARGET_H, `${vw}: ${monitor.w}×${monitor.h}`);
      assert.ok(Math.abs(monitor.w / monitor.h - 16 / 9) < 1e-9, "16:9 on a desktop");
    } else {
      assert.equal(mode, "stacked");
      assert.ok(monitor.h >= (monitor.w * 9) / 16 - 1e-9, "never shorter than 16:9");
    }
  }
});

test("the player intersects no other box", () => {
  for (const vw of WIDTHS) {
    const l = layout(vw);
    for (const key of OTHERS) assert.ok(!intersects(l.monitor, l[key]), `${vw}: monitor overlaps ${key} ${JSON.stringify([l.monitor, l[key]])}`);
  }
});

test("the player sits inside its frame and the viewport", () => {
  for (const vw of WIDTHS) {
    const l = layout(vw);
    assert.ok(contains(l.monitorFrame, l.monitor), `${vw}`);
    assert.ok(l.monitor.x >= 0 && l.monitor.x + l.monitor.w <= vw, `${vw}: ${l.monitor.x}+${l.monitor.w}`);
    // the frame is around the player, so it is drawn only where the player is not
    for (const key of OTHERS) assert.ok(!intersects(l.monitorFrame, l[key]), `${vw}: frame overlaps ${key}`);
  }
});

test("the platter and the tonearm's whole sweep stay inside the turntable", () => {
  const view = { x: 0, y: 0, ...TURNTABLE_VIEW };
  assert.ok(contains(view, TONEARM_SWEEP));
  assert.ok(contains(view, { x: PLATTER.cx - PLATTER.r, y: PLATTER.cy - PLATTER.r, w: 2 * PLATTER.r, h: 2 * PLATTER.r }));
  for (const vw of WIDTHS) {
    const l = layout(vw);
    assert.ok(contains(l.turntable, l.platter), `${vw}`);
    assert.ok(contains(l.turntable, l.tonearmSweep), `${vw}`);
    assert.ok(l.turntable.w <= 420 && l.turntable.w > 0);
  }
});

test("the page's own boxes don't overlap each other either", () => {
  for (const vw of WIDTHS) {
    const l = layout(vw);
    const cells = ["crate", "turntable", "lcd", "transport", "monitorFrame"] as const;
    for (const a of cells) for (const b of cells) if (a < b) assert.ok(!intersects(l[a], l[b]), `${vw}: ${a} overlaps ${b}`);
  }
});

test("intersects needs shared area; touching edges don't count", () => {
  const a: Box = { x: 0, y: 0, w: 10, h: 10 };
  assert.ok(intersects(a, { x: 5, y: 5, w: 10, h: 10 }));
  assert.ok(intersects(a, { x: 2, y: 2, w: 1, h: 1 }), "inside");
  assert.ok(intersects({ x: 2, y: 2, w: 1, h: 1 }, a), "around");
  assert.ok(!intersects(a, { x: 10, y: 0, w: 10, h: 10 }), "touching right");
  assert.ok(!intersects(a, { x: 0, y: 10, w: 10, h: 10 }), "touching below");
  assert.ok(!intersects(a, { x: 20, y: 20, w: 1, h: 1 }));
  assert.ok(intersects(a, { x: -5, y: 3, w: 30, h: 1 }), "a bar across");
});
