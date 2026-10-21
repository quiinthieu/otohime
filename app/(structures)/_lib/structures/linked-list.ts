// The linked list: a treasure hunt of notes, each pointing at the next. The
// state keeps the notes in hunt order; each note has an id it keeps for life
// (n0, n1, …) so the drawing can move it. Adding at the front writes a note
// and points it at the old first one; anything else walks from the front,
// one read a note.
import { COST_ROOM, countSteps, done, listed, measure, refuse, stepsWord, whole, WHOLE_PLEASE, type Action, type Beat, type Move, type Structure } from "../machine.ts";

export type ListNode = { id: string; value: number };
export type ListState = { cap: number; nodes: readonly ListNode[]; next: number };

const CAP = 7;

const full = (s: ListState, x: number) => `All ${s.cap} notes are used, so there is no room for ${x}.`;

function make(s: ListState, x: number): [ListNode, number] {
  return [{ id: `n${s.next}`, value: x }, s.next + 1];
}

function pushFront(s: ListState, a: Action): Move<ListState> {
  const x = whole(a.value);
  if (x === null) return refuse(s, WHOLE_PLEASE);
  if (s.nodes.length >= s.cap) return refuse(s, full(s, x));
  const [node, next] = make(s, x);
  const trace: Beat[] = [];
  if (s.nodes.length === 0) {
    trace.push({ say: `Write ${x} on a new note; the list starts there.`, hot: [node.id], step: true });
  } else {
    const head = s.nodes[0];
    trace.push({ say: `Write ${x} on a new note.`, hot: [node.id], step: true });
    trace.push({ say: `Point its arrow at ${head.value}, the old first note, and start the list at ${x}.`, hot: [node.id, head.id], step: true });
  }
  trace.push({ say: `${x} is at the front.`, hot: [node.id] });
  return done({ ...s, nodes: [node, ...s.nodes], next }, trace);
}

function append(s: ListState, a: Action): Move<ListState> {
  const x = whole(a.value);
  if (x === null) return refuse(s, WHOLE_PLEASE);
  if (s.nodes.length >= s.cap) return refuse(s, full(s, x));
  if (s.nodes.length === 0) return pushFront(s, { move: "push", value: x });
  const [node, next] = make(s, x);
  const trace: Beat[] = s.nodes.map((n, i) => {
    const last = i === s.nodes.length - 1;
    const say = last ? `Read the note with ${n.value}: its arrow points nowhere, so it is the last.` : `Read the note with ${n.value}: its arrow points on to ${s.nodes[i + 1].value}.`;
    return { say, hot: [n.id], step: true };
  });
  const tail = s.nodes[s.nodes.length - 1];
  trace.push({ say: `Write ${x} on a new note.`, hot: [node.id], step: true });
  trace.push({ say: `Point the arrow of ${tail.value} at ${x}.`, hot: [tail.id, node.id], step: true });
  trace.push({ say: `${x} is at the end, in ${stepsWord(countSteps(trace))}.`, hot: [node.id] });
  return done({ ...s, nodes: [...s.nodes, node], next }, trace);
}

// Reads from the front until it meets x: the beats, and where x is (or -1).
function walk(s: ListState, x: number): [Beat[], number] {
  const trace: Beat[] = [];
  for (let i = 0; i < s.nodes.length; i++) {
    const n = s.nodes[i];
    if (n.value === x) {
      trace.push({ say: `This note holds ${x}: found it.`, hot: [n.id], step: true });
      return [trace, i];
    }
    const last = i === s.nodes.length - 1;
    const say = last ? `This note holds ${n.value}, not ${x}, and its arrow points nowhere.` : `This note holds ${n.value}, not ${x}, so follow its arrow.`;
    trace.push({ say, hot: [n.id], step: true });
  }
  return [trace, -1];
}

function notHere(s: ListState, x: number, trace: Beat[]): Move<ListState> {
  trace.push({ say: s.nodes.length === 0 ? `The list is empty, so ${x} is not in it.` : `${x} is not in the list: ${stepsWord(countSteps(trace))}.` });
  return done(s, trace);
}

function find(s: ListState, a: Action): Move<ListState> {
  const x = whole(a.value);
  if (x === null) return refuse(s, WHOLE_PLEASE);
  const [trace, at] = walk(s, x);
  if (at < 0) return notHere(s, x, trace);
  trace.push({ say: `Found ${x} in ${stepsWord(countSteps(trace))}.`, hot: [s.nodes[at].id] });
  return done(s, trace);
}

function remove(s: ListState, a: Action): Move<ListState> {
  const x = whole(a.value);
  if (x === null) return refuse(s, WHOLE_PLEASE);
  const [trace, at] = walk(s, x);
  if (at < 0) return notHere(s, x, trace);
  const gone = s.nodes[at];
  const before = s.nodes[at - 1];
  const after = s.nodes[at + 1];
  if (!before) {
    const say = after ? `${x} is the first note, so start the list at ${after.value} instead.` : `${x} is the only note, so the list is now empty.`;
    trace.push({ say, hot: after ? [gone.id, after.id] : [gone.id], step: true });
  } else if (after) {
    trace.push({ say: `Point the arrow of ${before.value} past ${x}, straight at ${after.value}.`, hot: [before.id, after.id], step: true });
  } else {
    trace.push({ say: `Point the arrow of ${before.value} at nothing: it is the last note now.`, hot: [before.id], step: true });
  }
  trace.push({ say: `${x} is out of the list, in ${stepsWord(countSteps(trace))}.` });
  return done({ ...s, nodes: s.nodes.filter((n) => n !== gone) }, trace);
}

function reduce(s: ListState, a: Action): Move<ListState> {
  switch (a.move) {
    case "push":
      return pushFront(s, a);
    case "append":
      return append(s, a);
    case "find":
      return find(s, a);
    case "remove":
      return remove(s, a);
    default:
      return refuse(s, `The linked list has no move called ${a.move}.`);
  }
}

const EIGHT: Action[] = [10, 20, 30, 40, 50, 60, 70, 80].map((value) => ({ move: "append", value }));

export const linkedList: Structure<ListState> = {
  slug: "linked-list",
  cap: CAP,
  empty: (cap = CAP) => ({ cap, nodes: [], next: 0 }),
  moves: [
    { id: "push", label: "Push front", takes: "number" },
    { id: "append", label: "Append", takes: "number" },
    { id: "find", label: "Find", takes: "number" },
    { id: "remove", label: "Remove", takes: "number" },
  ],
  defaultMove: "find",
  reduce,
  describe: (s) =>
    s.nodes.length === 0
      ? `An empty linked list, with room for ${s.cap} notes.`
      : `A linked list of ${s.nodes.length} notes: ${listed(s.nodes.map((n) => n.value))}, each pointing at the next, the last pointing nowhere.`,
  labels: (s) => s.nodes.map((n) => String(n.value)),
  example: [
    { move: "push", value: 3 },
    { move: "push", value: 9 },
    { move: "push", value: 4 },
    { move: "append", value: 7 },
    { move: "find", value: 9 },
    { move: "remove", value: 3 },
  ],
  costs() {
    const start = linkedList.empty(COST_ROOM);
    return {
      find: measure(linkedList, start, EIGHT, { move: "find", value: 80 }, "Find the last of 8: read every note from the front."),
      add: measure(linkedList, start, EIGHT, { move: "push", value: 5 }, "Push at the front: write a note and point it at the old first one."),
      remove: measure(linkedList, start, EIGHT, { move: "remove", value: 80 }, "Remove the last: read all 8 to find it, then move one arrow."),
    };
  },
};
