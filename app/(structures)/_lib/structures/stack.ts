// The stack: a pile of plates. Every move touches only the top plate, so
// every move is one step. Plates keep their ids (p0, p1, …) for life.
import { COST_ROOM, done, listed, measure, refuse, whole, WHOLE_PLEASE, type Action, type Move, type Structure } from "../machine.ts";

export type Plate = { id: string; value: number };
export type StackState = { cap: number; plates: readonly Plate[]; next: number }; // bottom first

const CAP = 7;

function reduce(s: StackState, a: Action): Move<StackState> {
  const top = s.plates[s.plates.length - 1];
  switch (a.move) {
    case "push": {
      const x = whole(a.value);
      if (x === null) return refuse(s, WHOLE_PLEASE);
      if (s.plates.length >= s.cap) return refuse(s, `The pile has ${s.cap} plates and is full, so ${x} would overflow it.`, top && [top.id]);
      const plate = { id: `p${s.next}`, value: x };
      return done({ ...s, plates: [...s.plates, plate], next: s.next + 1 }, [
        { say: top ? `Put ${x} on top of the pile, on ${top.value}.` : `Put ${x} down: the pile was empty.`, hot: [plate.id], step: true },
        { say: `${x} goes on top.`, hot: [plate.id] },
      ]);
    }
    case "pop": {
      if (!top) return refuse(s, "The pile is empty, so there is nothing to pop.");
      const below = s.plates[s.plates.length - 2];
      return done({ ...s, plates: s.plates.slice(0, -1) }, [
        { say: `Take ${top.value} off the top.`, hot: [top.id], step: true },
        { say: below ? `${top.value} comes off; ${below.value} is on top now.` : `${top.value} comes off; the pile is empty.`, hot: below ? [below.id] : [] },
      ]);
    }
    case "peek": {
      if (!top) return refuse(s, "The pile is empty, so there is no top plate to look at.");
      return done(s, [
        { say: `Look at the top plate: it is ${top.value}.`, hot: [top.id], step: true },
        { say: `${top.value} is on top.`, hot: [top.id] },
      ]);
    }
    default:
      return refuse(s, `The stack has no move called ${a.move}.`);
  }
}

const EIGHT: Action[] = [1, 2, 3, 4, 5, 6, 7, 8].map((value) => ({ move: "push", value }));

export const stack: Structure<StackState> = {
  slug: "stack",
  cap: CAP,
  empty: (cap = CAP) => ({ cap, plates: [], next: 0 }),
  moves: [
    { id: "push", label: "Push", takes: "number" },
    { id: "pop", label: "Pop", takes: "none" },
    { id: "peek", label: "Peek", takes: "none" },
  ],
  defaultMove: "push",
  reduce,
  describe: (s) => {
    const v = s.plates.map((p) => p.value);
    if (v.length === 0) return `An empty pile, with room for ${s.cap} plates.`;
    if (v.length === 1) return `A pile of 1 plate: ${v[0]}.`;
    return `A pile of ${v.length} plates, bottom to top: ${listed(v)}, with ${v[v.length - 1]} on top.`;
  },
  labels: (s) => s.plates.map((p) => String(p.value)),
  example: [
    { move: "push", value: 1 },
    { move: "push", value: 7 },
    { move: "push", value: 4 },
    { move: "peek" },
    { move: "pop" },
    { move: "push", value: 2 },
  ],
  costs() {
    const start = stack.empty(COST_ROOM);
    return {
      find: measure(stack, start, EIGHT, { move: "peek" }, "Peek: look at the top plate."),
      add: measure(stack, start, EIGHT, { move: "push", value: 9 }, "Push: put a plate on top."),
      remove: measure(stack, start, EIGHT, { move: "pop" }, "Pop: take the top plate off."),
    };
  },
};
