// The queue: a line on a ring of tiles. The head hand points at the front of
// the line, the tail hand at the first free tile behind it; both move on one
// tile at a time and wrap from the last tile to tile 0. Joining writes under
// the tail hand and moves it on; leaving takes from under the head hand and
// moves it on: two steps each, however long the line. Ids: tile0…, head,
// tail, and each person keeps q0, q1, … for life.
import { COST_ROOM, done, listed, measure, refuse, whole, WHOLE_PLEASE, type Action, type Move, type Structure } from "../machine.ts";

export type Person = { id: string; value: number };
export type QueueState = { cap: number; tiles: readonly (Person | null)[]; head: number; size: number; next: number };

const CAP = 8;
const tile = (i: number) => `tile${i}`;

/** The tile the tail hand points at: the first free one behind the line. */
export const tail = (s: QueueState) => (s.head + s.size) % s.cap;

/** The line from front to back. */
export const line = (s: QueueState): Person[] =>
  Array.from({ length: s.size }, (_, k) => s.tiles[(s.head + k) % s.cap]).filter((p): p is Person => p !== null);

function handMoves(s: QueueState, hand: "head" | "tail", from: number) {
  const to = (from + 1) % s.cap;
  const say = to === 0 ? `Tile ${from} is the last, so the ${hand} hand wraps round to tile 0.` : `Move the ${hand} hand on to tile ${to}.`;
  return { say, hot: [hand, tile(to)], step: true };
}

function reduce(s: QueueState, a: Action): Move<QueueState> {
  switch (a.move) {
    case "join": {
      const x = whole(a.value);
      if (x === null) return refuse(s, WHOLE_PLEASE);
      if (s.size >= s.cap) return refuse(s, `All ${s.cap} tiles are taken, so ${x} must wait.`);
      const t = tail(s);
      const person = { id: `q${s.next}`, value: x };
      const tiles = s.tiles.map((p, i) => (i === t ? person : p));
      return done({ ...s, tiles, size: s.size + 1, next: s.next + 1 }, [
        { say: `Write ${x} on tile ${t}, where the tail hand points.`, hot: [person.id, tile(t), "tail"], step: true },
        handMoves(s, "tail", t),
        { say: `${x} joins the back of the line.`, hot: [person.id] },
      ]);
    }
    case "leave": {
      const front = s.tiles[s.head];
      if (s.size === 0 || !front) return refuse(s, "The line is empty, so nobody can leave.");
      const tiles = s.tiles.map((p, i) => (i === s.head ? null : p));
      return done({ ...s, tiles, head: (s.head + 1) % s.cap, size: s.size - 1 }, [
        { say: `Take ${front.value} from tile ${s.head}, where the head hand points.`, hot: [front.id, tile(s.head), "head"], step: true },
        handMoves(s, "head", s.head),
        { say: `${front.value} leaves the front of the line.` },
      ]);
    }
    case "peek": {
      const front = s.tiles[s.head];
      if (s.size === 0 || !front) return refuse(s, "The line is empty, so there is nobody at the front.");
      return done(s, [
        { say: `The head hand points at tile ${s.head}: ${front.value} is first in line.`, hot: [front.id, tile(s.head), "head"], step: true },
        { say: `${front.value} is at the front.`, hot: [front.id] },
      ]);
    }
    default:
      return refuse(s, `The queue has no move called ${a.move}.`);
  }
}

const EIGHT: Action[] = [1, 2, 3, 4, 5, 6, 7, 8].map((value) => ({ move: "join", value }));

export const queue: Structure<QueueState> = {
  slug: "queue",
  cap: CAP,
  empty: (cap = CAP) => ({ cap, tiles: Array.from({ length: cap }, () => null), head: 0, size: 0, next: 0 }),
  moves: [
    { id: "join", label: "Join (enqueue)", takes: "number" },
    { id: "leave", label: "Leave (dequeue)", takes: "none" },
    { id: "peek", label: "Peek", takes: "none" },
  ],
  defaultMove: "join",
  reduce,
  describe: (s) => {
    const hands = `The head hand is on tile ${s.head} and the tail hand on tile ${tail(s)}.`;
    if (s.size === 0) return `An empty line on a ring of ${s.cap} tiles. ${hands}`;
    return `A line of ${s.size} on a ring of ${s.cap} tiles, front to back: ${listed(line(s).map((p) => p.value))}. ${hands}`;
  },
  labels: (s) => line(s).map((p) => String(p.value)),
  example: [
    { move: "join", value: 5 },
    { move: "join", value: 2 },
    { move: "join", value: 9 },
    { move: "leave" },
    ...[6, 1, 8, 3, 7].map((value) => ({ move: "join", value })),
  ],
  costs() {
    const start = queue.empty(COST_ROOM);
    return {
      find: measure(queue, start, EIGHT, { move: "peek" }, "Peek: look under the head hand."),
      add: measure(queue, start, EIGHT, { move: "join", value: 9 }, "Join: write under the tail hand, then move it on."),
      remove: measure(queue, start, EIGHT, { move: "leave" }, "Leave: take from under the head hand, then move it on."),
    };
  },
};
