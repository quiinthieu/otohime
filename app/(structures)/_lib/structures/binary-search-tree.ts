// The search tree: higher or lower, made into a shape. Smaller numbers go
// left, bigger ones right; each node looked at on the way down is one step,
// and so is writing a new leaf or relinking one arrow. Numbers are unique, so
// a node's id is its number (n8). The tree holds 15 numbers; an insert that
// would land below level 5 is refused, so the 1-to-5 line (the trap) fits and
// nothing deeper does.
import { COST_ROOM, countSteps, done, listed, measure, refuse, stepsWord, whole, WHOLE_PLEASE, type Action, type Beat, type Move, type Structure } from "../machine.ts";

export type TreeNode = { value: number; left: TreeNode | null; right: TreeNode | null };
export type TreeState = { cap: number; root: TreeNode | null };

const CAP = 15;
export const MAX_LEVELS = 5;
const id = (v: number) => `n${v}`;

export const size = (t: TreeNode | null): number => (t ? 1 + size(t.left) + size(t.right) : 0);
export const height = (t: TreeNode | null): number => (t ? 1 + Math.max(height(t.left), height(t.right)) : 0);

/** The numbers level by level, top first, left to right. */
export function levels(t: TreeNode | null): number[][] {
  const out: number[][] = [];
  let row = t ? [t] : [];
  while (row.length) {
    out.push(row.map((n) => n.value));
    row = row.flatMap((n) => [n.left, n.right].filter((c): c is TreeNode => c !== null));
  }
  return out;
}

// Walks down from the root looking for x: one step a node. Returns the beats,
// the path of nodes, and whether x is the last of them.
function descend(root: TreeNode | null, x: number, missing: "find" | "insert"): { trace: Beat[]; path: TreeNode[]; found: boolean } {
  const trace: Beat[] = [];
  const path: TreeNode[] = [];
  let at = root;
  while (at) {
    path.push(at);
    if (x === at.value) {
      trace.push({ say: `This is ${x}: found it.`, hot: [id(x)], step: true });
      return { trace, path, found: true };
    }
    const left = x < at.value;
    const next = left ? at.left : at.right;
    const way = `${x} is ${left ? "less" : "more"} than ${at.value}, so go ${left ? "left" : "right"}`;
    const say = next || missing === "insert" ? `${way}.` : `${way}, but there is nothing there.`;
    trace.push({ say, hot: [id(at.value)], step: true });
    at = next;
  }
  return { trace, path, found: false };
}

// The tree with x hung under the end of the path (path-copying: nothing shared is changed).
function hang(t: TreeNode | null, x: number): TreeNode {
  if (!t) return { value: x, left: null, right: null };
  return x < t.value ? { ...t, left: hang(t.left, x) } : { ...t, right: hang(t.right, x) };
}

function insert(s: TreeState, x: number): Move<TreeState> {
  const { trace, path, found } = descend(s.root, x, "insert");
  if (found) {
    trace.push({ say: `${x} is already in the tree: ${stepsWord(countSteps(trace))}.`, hot: [id(x)] });
    return done(s, trace);
  }
  if (size(s.root) >= s.cap) return refuse(s, `The tree holds ${s.cap} numbers and is full, so there is no room for ${x}.`);
  if (path.length + 1 > MAX_LEVELS) return refuse(s, `${x} would sit on level ${path.length + 1}, below the bottom of the page.`);
  if (!s.root) {
    trace.push({ say: `The tree is empty, so ${x} goes at the top.`, hot: [id(x)], step: true });
  } else {
    const parent = path[path.length - 1];
    trace.push({ say: `The place ${x < parent.value ? "left" : "right"} of ${parent.value} is empty, so write ${x} there.`, hot: [id(x), id(parent.value)], step: true });
  }
  trace.push({ say: `${x} is in the tree, in ${stepsWord(countSteps(trace))}.`, hot: [id(x)] });
  return done({ ...s, root: hang(s.root, x) }, trace);
}

function find(s: TreeState, x: number): Move<TreeState> {
  const { trace, found } = descend(s.root, x, "find");
  const n = stepsWord(countSteps(trace));
  if (found) trace.push({ say: `Found ${x} in ${n}.`, hot: [id(x)] });
  else trace.push({ say: s.root ? `${x} is not here: ${n}.` : `The tree is empty, so ${x} is not here.` });
  return done(s, trace);
}

// The tree with the node holding x replaced by `by` (which may be null).
function swapOut(t: TreeNode | null, x: number, by: (n: TreeNode) => TreeNode | null): TreeNode | null {
  if (!t) return null;
  if (x === t.value) return by(t);
  return x < t.value ? { ...t, left: swapOut(t.left, x, by) } : { ...t, right: swapOut(t.right, x, by) };
}

function remove(s: TreeState, x: number): Move<TreeState> {
  const { trace, path, found } = descend(s.root, x, "find");
  if (!found) {
    trace.push({ say: s.root ? `${x} is not here, so there is nothing to take out: ${stepsWord(countSteps(trace))}.` : `The tree is empty, so ${x} is not here.` });
    return done(s, trace);
  }
  const node = path[path.length - 1];
  const parent = path[path.length - 2];
  let root: TreeNode | null;
  if (node.left && node.right) {
    trace.push({ say: `${x} has two children, so find the smallest number on its right to take its place.`, hot: [id(x)] });
    let next = node.right;
    trace.push({ say: `Go right to ${next.value}.`, hot: [id(next.value)], step: true });
    while (next.left) {
      next = next.left;
      trace.push({ say: `Go left to ${next.value}.`, hot: [id(next.value)], step: true });
    }
    const heir = next.value;
    trace.push({ say: `${heir} has nothing on its left, so it is the smallest: write ${heir} in place of ${x}.`, hot: [id(heir), id(x)], step: true });
    trace.push({ say: next.right ? `Point the arrow to the old ${heir} at ${next.right.value} instead.` : `Rub out the old ${heir}.`, hot: [id(heir)], step: true });
    root = swapOut(s.root, x, (n) => ({ ...n, value: heir, right: swapOut(n.right, heir, (h) => h.right) }));
  } else {
    const child = node.left ?? node.right;
    let say: string;
    if (!child) say = parent ? `${x} has no children, so rub it out.` : `${x} is the only number, so rub it out.`;
    else if (parent) say = `${x} has one child, ${child.value}, so point the arrow from ${parent.value} straight at ${child.value}.`;
    else say = `${x} has one child, ${child.value}, so ${child.value} becomes the top.`;
    trace.push({ say, hot: child ? [id(x), id(child.value)] : [id(x)], step: true });
    root = swapOut(s.root, x, () => child);
  }
  trace.push({ say: `${x} is out, in ${stepsWord(countSteps(trace))}.` });
  return done({ ...s, root }, trace);
}

// The trap, in one press: start again and insert 1 to 5 in order.
function line(s: TreeState): Move<TreeState> {
  const trace: Beat[] = [{ say: "Start again with an empty tree, and insert 1, 2, 3, 4 and 5 in order." }];
  let state: TreeState = { ...s, root: null };
  for (const x of [1, 2, 3, 4, 5]) {
    const move = insert(state, x);
    trace.push(...move.trace.slice(0, -1));
    state = move.state;
  }
  trace.push({ say: `Each number went right of the last: a line ${height(state.root)} levels tall, not a bushy tree, after ${stepsWord(countSteps(trace))}.`, hot: [id(5)] });
  return done(state, trace);
}

function reduce(s: TreeState, a: Action): Move<TreeState> {
  if (a.move === "line") return line(s);
  if (a.move !== "insert" && a.move !== "find" && a.move !== "remove") return refuse(s, `The search tree has no move called ${a.move}.`);
  const x = whole(a.value);
  if (x === null) return refuse(s, WHOLE_PLEASE);
  return a.move === "insert" ? insert(s, x) : a.move === "find" ? find(s, x) : remove(s, x);
}

const EIGHT: Action[] = [8, 4, 12, 2, 6, 10, 14, 1].map((value) => ({ move: "insert", value }));

export const binarySearchTree: Structure<TreeState> = {
  slug: "binary-search-tree",
  cap: CAP,
  empty: (cap = CAP) => ({ cap, root: null }),
  moves: [
    { id: "insert", label: "Insert", takes: "number" },
    { id: "find", label: "Find", takes: "number" },
    { id: "remove", label: "Remove", takes: "number" },
    { id: "line", label: "Insert 1, 2, 3, 4, 5", takes: "none" },
  ],
  defaultMove: "find",
  reduce,
  describe: (s) => {
    if (!s.root) return "An empty search tree.";
    const rows = levels(s.root).map((r, i) => `level ${i + 1}: ${listed(r)}`);
    return `A search tree of ${size(s.root)} numbers, ${height(s.root)} levels tall, ${s.root.value} at the top; ${rows.join("; ")}.`;
  },
  labels: (s) => levels(s.root).flat().map(String),
  example: [
    ...[8, 3, 10, 1, 6, 14].map((value) => ({ move: "insert", value })),
    { move: "find", value: 6 },
    { move: "find", value: 7 },
  ],
  costs() {
    const start = binarySearchTree.empty(COST_ROOM);
    return {
      find: measure(binarySearchTree, start, EIGHT, { move: "find", value: 1 }, "Find 1, at the bottom: one look a level, four levels."),
      add: measure(binarySearchTree, start, EIGHT, { move: "insert", value: 3 }, "Insert 3: walk down three levels, then write a new leaf."),
      remove: measure(binarySearchTree, start, EIGHT, { move: "remove", value: 1 }, "Remove 1: find it four levels down, then rub it out."),
    };
  },
};
