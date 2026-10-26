// The desk's controls, without a desk: the keymap, the px nudge, the radial
// menu's choices and spots, the aria-live lines, and the notebook's leaves
// turned by the spring.
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  defaultLayout,
  deskKey,
  deskSay,
  leafPose,
  MENU,
  menuSpots,
  NOTEBOOK_LEAVES,
  NOTEBOOK_OPEN,
  NOTEBOOK_PEEK,
  NOTEBOOK_SHUT,
  nudge,
  NUDGE,
  NUDGE_FAST,
  ROTATE_STEP,
} from "./desk.ts";
import { advance, type Spring } from "./spring.ts";

const SIZE = { w: 800, h: 500 };
const at = (layout: ReturnType<typeof defaultLayout>, id: string) => layout.find((item) => item.id === id)!;

test("arrows nudge 16 px, 64 with Shift; R rotates a step (Shift+R back); [ and ] restack; Esc closes", () => {
  assert.equal(NUDGE, 16);
  assert.equal(NUDGE_FAST, 64);
  assert.deepEqual(deskKey("ArrowLeft"), { type: "nudge", dx: -16, dy: 0 });
  assert.deepEqual(deskKey("ArrowRight"), { type: "nudge", dx: 16, dy: 0 });
  assert.deepEqual(deskKey("ArrowUp"), { type: "nudge", dx: 0, dy: -16 });
  assert.deepEqual(deskKey("ArrowDown"), { type: "nudge", dx: 0, dy: 16 });
  assert.deepEqual(deskKey("ArrowLeft", true), { type: "nudge", dx: -64, dy: 0 });
  assert.deepEqual(deskKey("ArrowDown", true), { type: "nudge", dx: 0, dy: 64 });
  assert.deepEqual(deskKey("r"), { type: "rotate", by: ROTATE_STEP });
  assert.deepEqual(deskKey("R", true), { type: "rotate", by: -ROTATE_STEP });
  assert.deepEqual(deskKey("["), { type: "back" });
  assert.deepEqual(deskKey("]"), { type: "front" });
  assert.deepEqual(deskKey("Escape"), { type: "close" });
  assert.deepEqual(deskKey("ContextMenu"), { type: "menu" });
  assert.deepEqual(deskKey("F10", true), { type: "menu" });
  // Everything else stays the browser's: Enter follows the link, Tab moves on, plain F10 is the browser's.
  for (const key of ["Enter", " ", "Tab", "F10", "a", "x", "{"]) assert.equal(deskKey(key), null, key);
});

test("a nudge moves the centre by px over the desk's size and stops at the edge", () => {
  const base = defaultLayout();
  const notes = at(base, "notes");
  const right = at(nudge(base, "notes", 16, 0, SIZE), "notes");
  assert.equal(right.x, notes.x + 16 / 800);
  assert.equal(right.y, notes.y);
  const up = at(nudge(base, "notes", 0, -64, SIZE), "notes");
  assert.equal(up.y, notes.y - 64 / 500);
  // Only that item moves.
  const moved = nudge(base, "notes", 16, 16, SIZE);
  for (const item of moved) if (item.id !== "notes") assert.deepEqual(item, at(base, item.id));
  // Far past the edge, it stops on it.
  const far = at(nudge(base, "notes", -5000, 5000, SIZE), "notes");
  assert.deepEqual([far.x, far.y], [0, 1]);
  // An unknown id, or a desk with no size yet, changes nothing.
  assert.equal(nudge(base, "nope", 16, 0, SIZE), base);
  assert.equal(nudge(base, "notes", 16, 0, { w: 0, h: 500 }), base);
  assert.equal(nudge(base, "notes", 16, 0, { w: NaN, h: 500 }), base);
});

test("the radial menu offers open, rotate, send to back, spaced evenly clockwise from the top", () => {
  assert.deepEqual(
    MENU.map((m) => m.action),
    ["open", "rotate", "back"],
  );
  assert.deepEqual(
    MENU.map((m) => m.label),
    ["Open", "Rotate", "Send to back"],
  );
  const spots = menuSpots(3, 64);
  assert.deepEqual(spots[0], { x: 0, y: -64 });
  assert.ok(spots[1].x > 0 && spots[1].y > 0, "the second is lower right");
  assert.ok(spots[2].x < 0 && spots[2].y > 0, "the third is lower left");
  for (const s of spots) assert.ok(Math.abs(Math.hypot(s.x, s.y) - 64) < 0.01, JSON.stringify(s));
  assert.equal(spots[1].x, -spots[2].x);
  assert.deepEqual(menuSpots(0, 64), []);
});

test("the live line names the item and what changed", () => {
  assert.equal(deskSay("Notes", { type: "moved", x: 0.284, y: 0.5 }), "Notes moved to 28% across, 50% down.");
  assert.equal(deskSay("Music", { type: "rotated", rot: 375 }), "Music turned to 15 degrees.");
  assert.equal(deskSay("Pocket", { type: "back" }), "Pocket sent to the back.");
  assert.equal(deskSay("Pocket", { type: "front" }), "Pocket brought to the front.");
  assert.equal(deskSay("Notes", { type: "menu" }), "Notes menu: open, rotate, send to back.");
  assert.equal(deskSay("Notes", { type: "closed" }), "Notes menu closed.");
  assert.equal(deskSay("", { type: "tidied" }), "Desk tidied up.");
});

test("leaf i turns while the spring is between i and i+1, and a turned leaf stacks over the ones before it", () => {
  assert.equal(NOTEBOOK_LEAVES, 3);
  assert.deepEqual([NOTEBOOK_SHUT, NOTEBOOK_PEEK, NOTEBOOK_OPEN], [0, 1, 3]);
  // Shut: every leaf flat, the cover on top.
  assert.deepEqual([0, 1, 2].map((i) => leafPose(0, i)), [
    { deg: 0, z: 3 },
    { deg: 0, z: 2 },
    { deg: 0, z: 1 },
  ]);
  // Half way through the cover.
  assert.deepEqual(leafPose(0.5, 0), { deg: -90, z: 3 });
  assert.deepEqual(leafPose(0.5, 1), { deg: 0, z: 2 });
  // The cover over, the first page a quarter turned.
  assert.deepEqual(leafPose(1.25, 0), { deg: -180, z: 1 });
  assert.deepEqual(leafPose(1.25, 1), { deg: -45, z: 2 });
  // Open: every leaf over, the last on top of the left pile.
  assert.deepEqual([0, 1, 2].map((i) => leafPose(3, i).deg), [-180, -180, -180]);
  assert.deepEqual([0, 1, 2].map((i) => leafPose(3, i).z), [1, 2, 3]);
  // Past either end, or garbage: clamped, never a NaN in a style.
  assert.deepEqual(leafPose(-0.4, 0), { deg: 0, z: 3 });
  assert.deepEqual(leafPose(3.4, 2), { deg: -180, z: 3 });
  assert.deepEqual(leafPose(NaN, 0), { deg: 0, z: 3 });
});

// Run the desk's spring toward a pose at 60 Hz, as the component's frame loop does.
function run(from: Spring, to: number, frames = 240) {
  const trace: number[] = [];
  let s = from;
  for (let f = 0; f < frames; f++) {
    const next = advance(s, to, 1 / 60);
    s = next.state;
    trace.push(s.x);
    if (next.done) break;
  }
  return { s, trace };
}

test("on the spring, a peek opens the cover past flat and the first page lifts, then falls back", () => {
  const { s, trace } = run({ x: NOTEBOOK_SHUT, v: 0 }, NOTEBOOK_PEEK);
  assert.deepEqual(s, { x: NOTEBOOK_PEEK, v: 0 }, "settles open on the first page");
  const top = Math.max(...trace);
  assert.ok(top > 1.05 && top < 1.3, `overshoot ${top}`);
  // At the overshoot the first page is lifted off the pile, and it is flat again once settled.
  assert.ok(leafPose(top, 1).deg < -9, String(leafPose(top, 1).deg));
  assert.equal(leafPose(s.x, 1).deg, 0);
  assert.equal(leafPose(s.x, 0).deg, -180);
});

test("on the spring, an open turns the leaves in order, cover first, and lands with all of them over", () => {
  const { s, trace } = run({ x: NOTEBOOK_SHUT, v: 0 }, NOTEBOOK_OPEN);
  assert.equal(s.x, NOTEBOOK_OPEN);
  // The frame each leaf first passes upright: strictly in order.
  const upright = [0, 1, 2].map((i) => trace.findIndex((p) => leafPose(p, i).deg <= -90));
  assert.ok(upright.every((f) => f >= 0), JSON.stringify(upright));
  assert.ok(upright[0] < upright[1] && upright[1] < upright[2], JSON.stringify(upright));
  // A leaf never turns ahead of the one before it.
  for (const p of trace) {
    const degs = [0, 1, 2].map((i) => leafPose(p, i).deg);
    assert.ok(degs[0] <= degs[1] && degs[1] <= degs[2], `${p}: ${degs}`);
  }
  // And it lands in well under a second at 60 Hz.
  assert.ok(trace.findIndex((p) => p >= NOTEBOOK_OPEN - 0.1) < 30, String(trace.findIndex((p) => p >= NOTEBOOK_OPEN - 0.1)));
});
