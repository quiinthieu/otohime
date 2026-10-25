import assert from "node:assert/strict";
import { test } from "node:test";
import { fanOrigin, PEEK_GAP, PEEK_MARGIN, placePeek, type Placement, type Size } from "./peek-place.ts";

const DESKTOP = { width: 1366, height: 768 };
const PHONE = { width: 390, height: 844 };
const PANEL = { width: 420, height: 190 };
const point = (x: number, y: number) => ({ x, top: y, bottom: y });

const inside = (p: Placement, panel: Size, vp: Size) =>
  p.left >= PEEK_MARGIN &&
  p.top >= PEEK_MARGIN &&
  p.left + panel.width <= vp.width - PEEK_MARGIN &&
  p.top + panel.height <= vp.height - PEEK_MARGIN;

test("centred under the pointer when there is room", () => {
  assert.deepEqual(placePeek(point(600, 200), PANEL, DESKTOP), { left: 390, top: 200 + PEEK_GAP, above: false });
});

test("pushed in from the left and right edges", () => {
  assert.equal(placePeek(point(10, 200), PANEL, DESKTOP).left, PEEK_MARGIN);
  assert.equal(placePeek(point(1360, 200), PANEL, DESKTOP).left, DESKTOP.width - PANEL.width - PEEK_MARGIN);
});

test("flips above near the bottom edge", () => {
  const p = placePeek(point(600, 700), PANEL, DESKTOP);
  assert.equal(p.above, true);
  assert.equal(p.top, 700 - PEEK_GAP - PANEL.height);
});

test("a focused link anchors on its box: below its bottom, or above its top", () => {
  const link = { x: 300, top: 400, bottom: 420 };
  assert.equal(placePeek(link, PANEL, DESKTOP).top, 420 + PEEK_GAP);
  const low = { x: 300, top: 690, bottom: 710 };
  const p = placePeek(low, PANEL, DESKTOP);
  assert.equal(p.above, true);
  assert.ok(p.top + PANEL.height <= low.top, "the cards do not cover the link");
});

test("stays inside the viewport everywhere, on a desktop and a phone", () => {
  for (const [vp, panel] of [
    [DESKTOP, PANEL],
    [PHONE, { width: 374, height: 170 }],
  ] as const) {
    for (let x = 0; x <= vp.width; x += 13) {
      for (let y = 0; y <= vp.height; y += 17) {
        const p = placePeek(point(x, y), panel, vp);
        assert.ok(inside(p, panel, vp), `${vp.width}x${vp.height} at ${x},${y}: ${JSON.stringify(p)}`);
      }
    }
  }
});

test("a panel wider than the viewport sits at the left margin", () => {
  assert.equal(placePeek(point(100, 100), { width: 500, height: 100 }, PHONE).left, PEEK_MARGIN);
});

test("fanOrigin is the anchor inside the panel", () => {
  const a = point(600, 200);
  assert.deepEqual(fanOrigin(a, placePeek(a, PANEL, DESKTOP)), { x: 210, y: -PEEK_GAP });
  const low = point(600, 700);
  assert.deepEqual(fanOrigin(low, placePeek(low, PANEL, DESKTOP)), { x: 210, y: PANEL.height + PEEK_GAP });
});
