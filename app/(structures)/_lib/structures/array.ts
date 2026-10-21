// The array: a chest of numbered drawers, kept together from drawer 0 with no
// gaps. Reading a drawer is one look; an insert moves everything behind the
// new place up one drawer, one step a thing, then writes; a find opens the
// drawers from the front.
import { COST_ROOM, countSteps, done, listed, measure, refuse, stepsWord, whole, WHOLE_PLEASE, type Action, type Beat, type Move, type Structure } from "../machine.ts";

export type ArrayState = { cap: number; items: readonly number[] };

const CAP = 8;
const slot = (i: number) => `slot${i}`;

function drawer(s: ArrayState, v: number | string | undefined): number | null {
  const i = typeof v === "string" && /^\s*\d+\s*$/.test(v) ? Number(v) : v;
  return typeof i === "number" && Number.isInteger(i) && i >= 0 && i < s.cap ? i : null;
}

const noDrawer = (s: ArrayState, v: unknown) => `There is no drawer ${v ?? "there"}: the drawers go from 0 to ${s.cap - 1}.`;
const pastEnd = (s: ArrayState, i: number) => `Drawer ${i} is past the end: the next drawer to fill is ${s.items.length}.`;

function read(s: ArrayState, a: Action): Move<ArrayState> {
  const i = drawer(s, a.value);
  if (i === null) return refuse(s, noDrawer(s, a.value));
  if (i >= s.items.length) return refuse(s, `Drawer ${i} is empty.`, [slot(i)]);
  const x = s.items[i];
  return done(s, [
    { say: `Go straight to drawer ${i} and open it: it holds ${x}.`, hot: [slot(i)], step: true },
    { say: `Drawer ${i} holds ${x}, read in 1 step.`, hot: [slot(i)] },
  ]);
}

function set(s: ArrayState, a: Action): Move<ArrayState> {
  const x = whole(a.value);
  if (x === null) return refuse(s, WHOLE_PLEASE);
  const i = drawer(s, a.to);
  if (i === null) return refuse(s, noDrawer(s, a.to));
  if (i > s.items.length) return refuse(s, pastEnd(s, i), [slot(i)]);
  const items = [...s.items];
  const old = items[i];
  items[i] = x;
  const say = old === undefined ? `Write ${x} in drawer ${i}, the first empty one.` : `Rub out ${old} in drawer ${i} and write ${x}.`;
  return done({ ...s, items }, [
    { say, hot: [slot(i)], step: true },
    { say: `Drawer ${i} now holds ${x}.`, hot: [slot(i)] },
  ]);
}

function insert(s: ArrayState, a: Action): Move<ArrayState> {
  const x = whole(a.value);
  if (x === null) return refuse(s, WHOLE_PLEASE);
  if (s.items.length >= s.cap) return refuse(s, `All ${s.cap} drawers are full, so there is no room for ${x}.`);
  const i = drawer(s, a.to);
  if (i === null) return refuse(s, noDrawer(s, a.to));
  if (i > s.items.length) return refuse(s, pastEnd(s, i), [slot(i)]);
  const trace: Beat[] = [];
  if (i < s.items.length) {
    trace.push({ say: `Drawer ${i} holds ${s.items[i]}, so everything from drawer ${i} on moves up one to make room.`, hot: [slot(i)] });
  }
  for (let j = s.items.length - 1; j >= i; j--) {
    trace.push({ say: `Move ${s.items[j]} from drawer ${j} up to drawer ${j + 1}.`, hot: [slot(j), slot(j + 1)], step: true });
  }
  trace.push({ say: `Write ${x} in drawer ${i}.`, hot: [slot(i)], step: true });
  trace.push({ say: `${x} is in drawer ${i}, in ${stepsWord(countSteps(trace))}.`, hot: [slot(i)] });
  return done({ ...s, items: [...s.items.slice(0, i), x, ...s.items.slice(i)] }, trace);
}

function remove(s: ArrayState, a: Action): Move<ArrayState> {
  const i = drawer(s, a.value);
  if (i === null) return refuse(s, noDrawer(s, a.value));
  if (i >= s.items.length) return refuse(s, `Drawer ${i} is empty, so there is nothing to take out.`, [slot(i)]);
  const x = s.items[i];
  const trace: Beat[] = [{ say: `Take ${x} out of drawer ${i}.`, hot: [slot(i)], step: true }];
  for (let j = i + 1; j < s.items.length; j++) {
    trace.push({ say: `Move ${s.items[j]} from drawer ${j} down to drawer ${j - 1}.`, hot: [slot(j), slot(j - 1)], step: true });
  }
  trace.push({ say: `${x} is out, in ${stepsWord(countSteps(trace))}.` });
  return done({ ...s, items: [...s.items.slice(0, i), ...s.items.slice(i + 1)] }, trace);
}

function find(s: ArrayState, a: Action): Move<ArrayState> {
  const x = whole(a.value);
  if (x === null) return refuse(s, WHOLE_PLEASE);
  const trace: Beat[] = [];
  for (let i = 0; i < s.items.length; i++) {
    const v = s.items[i];
    if (v === x) {
      trace.push({ say: `Drawer ${i} holds ${x}: that is it.`, hot: [slot(i)], step: true });
      trace.push({ say: `Found ${x} in ${stepsWord(countSteps(trace))}.`, hot: [slot(i)] });
      return done(s, trace);
    }
    const last = i === s.items.length - 1;
    const say = last ? `Drawer ${i} holds ${v}, not ${x}, and it is the last full drawer.` : `Drawer ${i} holds ${v}, not ${x}, so open the next one.`;
    trace.push({ say, hot: [slot(i)], step: true });
  }
  trace.push({ say: s.items.length === 0 ? `The drawers are empty, so ${x} is not here.` : `${x} is not here: ${stepsWord(countSteps(trace))}, every drawer.` });
  return done(s, trace);
}

function reduce(s: ArrayState, a: Action): Move<ArrayState> {
  switch (a.move) {
    case "read":
      return read(s, a);
    case "set":
      return set(s, a);
    case "insert":
      return insert(s, a);
    case "remove":
      return remove(s, a);
    case "find":
      return find(s, a);
    default:
      return refuse(s, `The array has no move called ${a.move}.`);
  }
}

const EIGHT = [10, 20, 30, 40, 50, 60, 70, 80];
const fill = (values: readonly number[]): Action[] => values.map((value, i) => ({ move: "set", value, to: String(i) }));

export const array: Structure<ArrayState> = {
  slug: "array",
  cap: CAP,
  empty: (cap = CAP) => ({ cap, items: [] }),
  moves: [
    { id: "read", label: "Read drawer", takes: "index" },
    { id: "set", label: "Set", takes: "number", at: true },
    { id: "insert", label: "Insert", takes: "number", at: true },
    { id: "remove", label: "Remove drawer", takes: "index" },
    { id: "find", label: "Find", takes: "number" },
  ],
  defaultMove: "find",
  reduce,
  describe: (s) =>
    s.items.length === 0
      ? `A chest of ${s.cap} numbered drawers, all empty.`
      : `A chest of ${s.cap} numbered drawers: drawers 0 to ${s.items.length - 1} hold ${listed(s.items)}, and ${s.cap - s.items.length} are empty.`,
  labels: (s) => s.items.map(String),
  example: [...fill([4, 8, 15, 16, 23]), { move: "insert", value: 7, to: "1" }, { move: "find", value: 16 }],
  costs() {
    const start = array.empty(COST_ROOM);
    const setup = fill(EIGHT);
    return {
      find: measure(array, start, setup, { move: "find", value: 80 }, "Find the last of 8: open every drawer from the front."),
      add: measure(array, start, setup, { move: "insert", value: 5, to: "0" }, "Insert at the front: move all 8 up one, then write."),
      remove: measure(array, start, setup, { move: "remove", value: 0 }, "Remove from the front: take it out, then move the other 7 down."),
    };
  },
};
