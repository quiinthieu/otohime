// A bounded trace of the pointer events a browser test's gesture produced, for the test's failure message.
// Pure, no DOM: the page records raw events (e2e/desk.test.ts's instrument()), and this keeps at most TRACE_MAX of
// them and formats them, so a failed drag says whether the finger came down on the tape, moved, was let go or was
// taken by the browser (pointercancel). scripts/e2e-gesture-trace.test.ts proves it.

export const GESTURE_TYPES = ["pointerdown", "pointermove", "pointerup", "pointercancel"] as const;
export type GestureType = (typeof GESTURE_TYPES)[number];

export const TRACE_MAX = 40;

// One event as the page saw it, before the page's own handlers ran (a capture listener on the document).
export type GestureRecord = {
  type: GestureType;
  // ms since the page's time origin
  t: number;
  x: number;
  y: number;
  pointerId: number;
  pointerType: string;
  // the event's target, as tag.class
  target: string;
  // whether the item under the pointer carried data-dragging then
  dragging: boolean;
};

export type GestureTrace = { records: GestureRecord[]; dropped: number; max: number };

export const emptyTrace = (max: number = TRACE_MAX): GestureTrace => ({ records: [], dropped: 0, max: Math.max(1, Math.floor(max)) });

const isGesture = (type: unknown): type is GestureType => (GESTURE_TYPES as readonly unknown[]).includes(type);

// The trace with one more record. A full trace drops its oldest pointermove first, so the press, the let-go and a
// cancel survive a long drag; with no move left to drop, the oldest record goes. Anything that is not a pointer
// down/move/up/cancel is ignored.
export function addGesture(trace: GestureTrace, record: GestureRecord): GestureTrace {
  if (!isGesture(record.type)) return trace;
  const records = [...trace.records, record];
  let dropped = trace.dropped;
  while (records.length > trace.max) {
    const move = records.findIndex((r) => r.type === "pointermove");
    records.splice(move === -1 ? 0 : move, 1);
    dropped++;
  }
  return { ...trace, records, dropped };
}

export const traceOf = (records: readonly GestureRecord[], max: number = TRACE_MAX): GestureTrace =>
  records.reduce(addGesture, emptyTrace(max));

export const hasGesture = (trace: GestureTrace, type: GestureType) => trace.records.some((r) => r.type === type);

const px = (v: number) => String(Math.round(v * 10) / 10);

// One line per record, times from the first one: "+16ms pointermove touch#1 (695.5,612) span.desk-tape dragging".
export function formatTrace(trace: GestureTrace): string {
  if (trace.records.length === 0) return "no pointer event reached the page";
  const t0 = trace.records[0].t;
  const lines = trace.records.map(
    (r) =>
      `+${Math.round(r.t - t0)}ms ${r.type} ${r.pointerType}#${r.pointerId} (${px(r.x)},${px(r.y)}) ${r.target || "?"}${r.dragging ? " dragging" : ""}`,
  );
  if (trace.dropped > 0) lines.push(`(${trace.dropped} record${trace.dropped === 1 ? "" : "s"} dropped to keep ${trace.max})`);
  return lines.join("\n");
}
