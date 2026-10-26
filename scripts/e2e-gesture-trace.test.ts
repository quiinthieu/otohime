// scripts/e2e-gesture-trace.ts on fixed records: the bound, what a full trace drops, and the text a failed
// assertion carries.
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  addGesture,
  emptyTrace,
  formatTrace,
  hasGesture,
  TRACE_MAX,
  traceOf,
  type GestureRecord,
  type GestureType,
} from "./e2e-gesture-trace.ts";

const rec = (type: GestureType, t: number, x = 100, dragging = false): GestureRecord => ({
  type,
  t,
  x,
  y: 50,
  pointerId: 1,
  pointerType: "touch",
  target: "span.desk-tape",
  dragging,
});

// A press, n moves 12 px apart, and a let-go.
const drag = (n: number): GestureRecord[] => [
  rec("pointerdown", 1000),
  ...Array.from({ length: n }, (_, i) => rec("pointermove", 1000 + 16 * (i + 1), 100 + 12 * (i + 1), true)),
  rec("pointerup", 1000 + 16 * (n + 1), 100 + 12 * n, true),
];

test("the bound is 40 and a short gesture is kept whole, in order", () => {
  assert.equal(TRACE_MAX, 40);
  const t = traceOf(drag(10));
  assert.equal(t.records.length, 12);
  assert.equal(t.dropped, 0);
  assert.deepEqual(t.records, drag(10));
});

test("a long drag keeps at most 40 records, and the press and the let-go survive", () => {
  const t = traceOf(drag(100));
  assert.equal(t.records.length, TRACE_MAX);
  assert.equal(t.dropped, 102 - TRACE_MAX);
  assert.equal(t.records[0].type, "pointerdown");
  assert.equal(t.records.at(-1)!.type, "pointerup");
  // the newest moves are the ones kept
  assert.equal(t.records[1].x, 100 + 12 * (100 - TRACE_MAX + 3));
  assert.ok(hasGesture(t, "pointerdown") && hasGesture(t, "pointerup") && !hasGesture(t, "pointercancel"));
});

test("with no move left to drop, the oldest record goes", () => {
  const presses = Array.from({ length: 5 }, (_, i) => rec(i % 2 ? "pointerup" : "pointerdown", i));
  const t = traceOf(presses, 3);
  assert.deepEqual(
    t.records.map((r) => r.t),
    [2, 3, 4],
  );
  assert.equal(t.dropped, 2);
});

test("anything but pointer down/move/up/cancel is ignored, and the trace is not changed in place", () => {
  const empty = emptyTrace();
  const t = addGesture(empty, { ...rec("pointerdown", 0), type: "click" as GestureType });
  assert.equal(t, empty);
  const one = addGesture(empty, rec("pointercancel", 0));
  assert.equal(empty.records.length, 0);
  assert.equal(one.records.length, 1);
  assert.equal(emptyTrace(0).max, 1, "a bound below one is one");
});

test("the format: times from the first record, the pointer, the point, the target and the drag state", () => {
  assert.equal(formatTrace(emptyTrace()), "no pointer event reached the page");
  const t = traceOf([rec("pointerdown", 500.4, 683.26), rec("pointermove", 516.9, 695.5, true), { ...rec("pointercancel", 530, 700), target: "" }]);
  assert.equal(
    formatTrace(t),
    ["+0ms pointerdown touch#1 (683.3,50) span.desk-tape", "+17ms pointermove touch#1 (695.5,50) span.desk-tape dragging", "+30ms pointercancel touch#1 (700,50) ?"].join(
      "\n",
    ),
  );
  const long = formatTrace(traceOf(drag(60)));
  assert.equal(long.split("\n").length, TRACE_MAX + 1);
  assert.match(long, /\(22 records dropped to keep 40\)$/);
});
