// The heap: a tournament ladder where the smaller number wins, kept as the
// row of boxes it really is (the children of box i are boxes 2i+1 and 2i+2).
// Writing a new number in the first free box is one step and so is each level
// it climbs; taking the smallest is one step, moving the last box to the top
// one more, and each level it sinks one more. A comparison that leaves a
// number where it is explains, but is not a step. Ids: box0…, and each number
// keeps v0, v1, … for life.
import { COST_ROOM, countSteps, done, listed, measure, refuse, stepsWord, whole, WHOLE_PLEASE, type Action, type Beat, type Move, type Structure } from "../machine.ts";

export type Entry = { id: string; value: number };
export type HeapState = { cap: number; row: readonly Entry[]; next: number };

const CAP = 15;
const box = (i: number) => `box${i}`;
export const parentOf = (i: number) => Math.floor((i - 1) / 2);

function swap(row: Entry[], i: number, j: number) {
  [row[i], row[j]] = [row[j], row[i]];
}

function add(s: HeapState, a: Action): Move<HeapState> {
  const x = whole(a.value);
  if (x === null) return refuse(s, WHOLE_PLEASE);
  if (s.row.length >= s.cap) return refuse(s, `All ${s.cap} boxes are full, so there is no room for ${x}.`);
  const entry = { id: `v${s.next}`, value: x };
  const row = [...s.row, entry];
  let i = row.length - 1;
  const trace: Beat[] = [{ say: i === 0 ? `Write ${x} in box 0, at the top.` : `Write ${x} in box ${i}, the first free box.`, hot: [entry.id, box(i)], step: true }];
  while (i > 0) {
    const p = parentOf(i);
    const up = row[p];
    if (x >= up.value) {
      trace.push({ say: `${x} is not smaller than ${up.value}, its parent in box ${p}, so it stays.`, hot: [entry.id, up.id] });
      break;
    }
    trace.push({ say: `${x} is smaller than ${up.value}, its parent in box ${p}, so they swap.`, hot: [entry.id, up.id], step: true });
    swap(row, i, p);
    i = p;
  }
  trace.push({ say: `${x} is in box ${i}, in ${stepsWord(countSteps(trace))}.`, hot: [entry.id] });
  return done({ ...s, row, next: s.next + 1 }, trace);
}

function take(s: HeapState): Move<HeapState> {
  const top = s.row[0];
  if (!top) return refuse(s, "The heap is empty, so there is nothing to take.");
  const trace: Beat[] = [{ say: `Take ${top.value}, the smallest, off the top.`, hot: [top.id, box(0)], step: true }];
  const row = s.row.slice(1, -1);
  const last = s.row[s.row.length - 1];
  if (s.row.length > 1) {
    row.unshift(last);
    trace.push({ say: `Move ${last.value}, from the last box, to the top.`, hot: [last.id, box(0)], step: true });
    let i = 0;
    for (;;) {
      const kids = [2 * i + 1, 2 * i + 2].filter((k) => k < row.length);
      if (kids.length === 0) break;
      const c = kids.reduce((m, k) => (row[k].value < row[m].value ? k : m));
      const child = row[c];
      const which = kids.length === 1 ? `its only child` : `the smaller of its children, ${listed(kids.map((k) => row[k].value))}`;
      if (last.value <= child.value) {
        trace.push({ say: `${last.value} is not bigger than ${child.value}, ${which}, so it stays.`, hot: [last.id, child.id] });
        break;
      }
      trace.push({ say: `${last.value} is bigger than ${child.value}, ${which}, so they swap.`, hot: [last.id, child.id], step: true });
      swap(row, i, c);
      i = c;
    }
  }
  trace.push({ say: `The smallest, ${top.value}, is out in ${stepsWord(countSteps(trace))}.` });
  return done({ ...s, row }, trace);
}

function reduce(s: HeapState, a: Action): Move<HeapState> {
  switch (a.move) {
    case "add":
      return add(s, a);
    case "take":
      return take(s);
    case "peek": {
      const top = s.row[0];
      if (!top) return refuse(s, "The heap is empty, so there is no top to look at.");
      return done(s, [
        { say: `Look at the top box: ${top.value} is the smallest.`, hot: [top.id, box(0)], step: true },
        { say: `${top.value} is at the top.`, hot: [top.id] },
      ]);
    }
    default:
      return refuse(s, `The heap has no move called ${a.move}.`);
  }
}

const EIGHT: Action[] = [1, 2, 3, 4, 5, 6, 7, 8].map((value) => ({ move: "add", value }));

export const heap: Structure<HeapState> = {
  slug: "heap",
  cap: CAP,
  empty: (cap = CAP) => ({ cap, row: [], next: 0 }),
  moves: [
    { id: "add", label: "Add", takes: "number" },
    { id: "take", label: "Take smallest", takes: "none" },
    { id: "peek", label: "Peek", takes: "none" },
  ],
  defaultMove: "add",
  reduce,
  describe: (s) =>
    s.row.length === 0
      ? `An empty heap, with room for ${s.cap} numbers.`
      : `A heap of ${s.row.length} numbers with ${s.row[0].value}, the smallest, at the top; the row of boxes reads ${listed(s.row.map((e) => e.value))}.`,
  labels: (s) => s.row.map((e) => String(e.value)),
  example: [...[5, 3, 8, 1, 4].map((value) => ({ move: "add", value })), { move: "take" }],
  costs() {
    const start = heap.empty(COST_ROOM);
    return {
      find: measure(heap, start, EIGHT, { move: "peek" }, "Peek: the smallest is always in the top box."),
      add: measure(heap, start, EIGHT, { move: "add", value: 0 }, "Add 0: write it in the first free box, then climb to the top."),
      remove: measure(heap, start, EIGHT, { move: "take" }, "Take the smallest: take the top, move the last box up, then sink it."),
    };
  },
};
