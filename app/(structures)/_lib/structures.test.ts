// The eight machines, checked against the plan's table: each worked example
// ends where the table says and its last move's sentences are pinned; every
// move's step count is the number of its step beats; a full (or empty)
// machine refuses with one beat and the same state; every cost falls in its
// band; and every reducer is pure (the states it is given are frozen).
import assert from "node:assert/strict";
import { test } from "node:test";
import { band, countSteps, replay, type Action, type Move, type Structure } from "./machine.ts";
import { array } from "./structures/array.ts";
import { binarySearchTree, height, levels, type TreeState } from "./structures/binary-search-tree.ts";
import { graph, path, ripple, type GraphState } from "./structures/graph.ts";
import { bucketOf, COST_WORDS, hashTable, letterSum, type HashState } from "./structures/hash-table.ts";
import { heap, type HeapState } from "./structures/heap.ts";
import { bySlug, STRUCTURES } from "./structures/index.ts";
import { queue, tail, type QueueState } from "./structures/queue.ts";

const ORDER = ["array", "linked-list", "stack", "queue", "hash-table", "binary-search-tree", "heap", "graph"];

function deepFreeze<T>(v: T): T {
  if (v && typeof v === "object" && !Object.isFrozen(v)) {
    Object.freeze(v);
    for (const k of Object.keys(v)) deepFreeze((v as Record<string, unknown>)[k]);
  }
  return v;
}

// reduce on a frozen copy, and the input still deep-equal afterwards: pure.
function pureReduce<S>(s: Structure<S>, state: S, a: Action): Move<S> {
  const before = structuredClone(state);
  const move = s.reduce(deepFreeze(state), a);
  assert.deepEqual(state, before, `${s.slug} ${a.move} changed its input`);
  return move;
}

function run<S>(s: Structure<S>, actions: readonly Action[], start: S = s.empty()): Move<S>[] {
  const moves: Move<S>[] = [];
  let state = start;
  for (const a of actions) {
    const m = pureReduce(s, state, a);
    moves.push(m);
    state = m.state;
  }
  return moves;
}

const say = (m: Move<unknown>) => m.trace.map((b) => b.say);
const labels = <S>(s: Structure<S>, actions: readonly Action[]) => s.labels(replay(s, actions).state).join(" ");

// The table's end states and each example's last move, sentence by sentence.
const END: Record<string, { labels: string; last: string[] }> = {
  array: {
    labels: "4 7 8 15 16 23",
    last: [
      "Drawer 0 holds 4, not 16, so open the next one.",
      "Drawer 1 holds 7, not 16, so open the next one.",
      "Drawer 2 holds 8, not 16, so open the next one.",
      "Drawer 3 holds 15, not 16, so open the next one.",
      "Drawer 4 holds 16: that is it.",
      "Found 16 in 5 steps.",
    ],
  },
  "linked-list": {
    labels: "4 9 7",
    last: [
      "This note holds 4, not 3, so follow its arrow.",
      "This note holds 9, not 3, so follow its arrow.",
      "This note holds 3: found it.",
      "Point the arrow of 9 past 3, straight at 7.",
      "3 is out of the list, in 4 steps.",
    ],
  },
  stack: { labels: "1 7 2", last: ["Put 2 on top of the pile, on 7.", "2 goes on top."] },
  queue: {
    labels: "2 9 6 1 8 3 7",
    last: ["Write 7 on tile 7, where the tail hand points.", "Tile 7 is the last, so the tail hand wraps round to tile 0.", "7 joins the back of the line."],
  },
  "hash-table": {
    labels: "cat act dog fox",
    last: [
      "act adds up to 1 + 3 + 20 = 24, and 24 shared by 8 leaves 0: bucket 0.",
      "Bucket 0 holds cat first, not act, so look at the next word.",
      "The next word is act: that is it.",
      "Found act in 3 steps.",
    ],
  },
  "binary-search-tree": {
    labels: "8 3 10 1 6 14",
    last: ["7 is less than 8, so go left.", "7 is more than 3, so go right.", "7 is more than 6, so go right, but there is nothing there.", "7 is not here: 3 steps."],
  },
  heap: {
    labels: "3 4 8 5",
    last: [
      "Take 1, the smallest, off the top.",
      "Move 4, from the last box, to the top.",
      "4 is bigger than 3, the smaller of its children, 3 and 8, so they swap.",
      "4 is not bigger than 5, its only child, so it stays.",
      "The smallest, 1, is out in 3 steps.",
    ],
  },
  graph: {
    labels: "A B C D E F G H",
    last: [
      "Start at A and light it.",
      "B is 1 hop from A.",
      "C is 1 hop from A.",
      "D is 1 hop from A.",
      "E is 2 hops from A, reached from B.",
      "F is 2 hops from A, reached from C.",
      "G is 2 hops from A, reached from D.",
      "H is 3 hops from A, reached from F.",
      "Follow the way back: H from F, F from C, C from A.",
      "The way from A to H is A C F H: 3 hops, found in 8 steps.",
    ],
  },
};

// The table's bands for 8 things: find · add · remove.
const BANDS: Record<string, [string, string, string]> = {
  array: ["all", "all", "all"],
  "linked-list": ["all", "one", "all"],
  stack: ["one", "one", "one"],
  queue: ["one", "one", "one"],
  "hash-table": ["one", "one", "one"],
  "binary-search-tree": ["few", "few", "few"],
  heap: ["one", "few", "few"],
  graph: ["all", "one", "one"],
};

// Fills each machine to its cap; `over` is the one move too many.
const n = (move: string, values: readonly number[]): Action[] => values.map((value) => ({ move, value }));
const FULL: Record<string, { fill: Action[]; over: Action }> = {
  array: { fill: [0, 1, 2, 3, 4, 5, 6, 7].map((i) => ({ move: "insert", value: i, to: String(i) })), over: { move: "insert", value: 9, to: "0" } },
  "linked-list": { fill: n("push", [1, 2, 3, 4, 5, 6, 7]), over: { move: "append", value: 8 } },
  stack: { fill: n("push", [1, 2, 3, 4, 5, 6, 7]), over: { move: "push", value: 8 } },
  queue: { fill: n("join", [1, 2, 3, 4, 5, 6, 7, 8]), over: { move: "join", value: 9 } },
  // cat, act and h all add up to a multiple of 8: bucket 0's chain of 3 is full.
  "hash-table": { fill: ["cat", "act", "h"].map((value) => ({ move: "put", value })), over: { move: "put", value: "p" } },
  "binary-search-tree": { fill: n("insert", [8, 4, 12, 2, 6, 10, 14, 1, 3, 5, 7, 9, 11, 13, 15]), over: { move: "insert", value: 16 } },
  heap: { fill: n("add", [15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1]), over: { move: "add", value: 0 } },
  graph: {
    fill: ["A-B", "A-C", "A-D", "B-E", "C-E", "C-F", "D-G", "F-H", "G-H", "A-H", "B-C", "E-F"].map((l) => ({ move: "connect", value: l[0], to: l[2] })),
    over: { move: "connect", value: "D", to: "E" },
  },
};

// Taking from an empty machine is refused too.
const EMPTY: Record<string, Action> = { array: { move: "remove", value: 0 }, stack: { move: "pop" }, queue: { move: "leave" }, heap: { move: "take" } };

test("eight structures in the series' order, slugs lower-case words joined by hyphens", () => {
  assert.deepEqual(
    STRUCTURES.map((s) => s.slug),
    ORDER,
  );
  for (const s of STRUCTURES) assert.match(s.slug, /^[a-z-]+$/);
  assert.equal(bySlug("heap"), heap);
  assert.equal(bySlug("nope"), undefined);
});

test("band: 1–3 one, 4–6 few, 7–10 all, anything else throws", () => {
  for (const [k, b] of [
    [1, "one"],
    [3, "one"],
    [4, "few"],
    [6, "few"],
    [7, "all"],
    [10, "all"],
  ] as const) {
    assert.equal(band(k), b, String(k));
  }
  for (const bad of [0, 11, -1, 2.5, Number.NaN]) assert.throws(() => band(bad), RangeError, String(bad));
});

test("replay runs actions from empty() and returns the last move", () => {
  const { state, last } = replay(array, [{ move: "set", value: 4, to: "0" }]);
  assert.deepEqual(state.items, [4]);
  assert.equal(last.state, state);
  assert.equal(replay(array, []).last.steps, 0);
});

for (const s of STRUCTURES) {
  const end = END[s.slug];

  test(`${s.slug}: the worked example ends at ${end.labels}, and its last move says so`, () => {
    const moves = run(s, s.example);
    for (const m of moves) assert.equal(m.refused, undefined, say(m).join(" "));
    assert.equal(s.labels(moves[moves.length - 1].state).join(" "), end.labels);
    assert.deepEqual(say(moves[moves.length - 1]), end.last);
  });

  test(`${s.slug}: every move counts its steps from its step beats and ends with a summary`, () => {
    const moves = [...run(s, s.example), ...run(s, FULL[s.slug].fill, s.empty())];
    for (const m of moves) {
      assert.equal(m.steps, countSteps(m.trace));
      assert.ok(m.steps >= 1, say(m).join(" "));
      const last = m.trace[m.trace.length - 1];
      assert.notEqual(last.step, true, `the summary is not a step: ${last.say}`);
      for (const b of m.trace) {
        assert.match(b.say, /^\S.*[.]$/, b.say);
        for (const id of b.hot ?? []) assert.match(id, /^[A-Za-z0-9-]+$/, id);
      }
    }
  });

  test(`${s.slug}: at its cap (${s.cap}) the next add is refused with one beat and the same state`, () => {
    const { fill, over } = FULL[s.slug];
    const full = replay(s, fill).state;
    for (const m of run(s, fill)) assert.equal(m.refused, undefined, say(m).join(" "));
    const m = pureReduce(s, full, over);
    assert.equal(typeof m.refused, "string");
    assert.equal(m.trace.length, 1);
    assert.equal(m.trace[0].say, m.refused);
    assert.equal(m.steps, 0);
    assert.equal(m.state, full, "the very same state object");
  });

  test(`${s.slug}: an unknown move and a bad value are refused the same way`, () => {
    const state = replay(s, s.example).state;
    for (const a of [{ move: "explode" }, { move: s.defaultMove, value: s.moves.find((m) => m.id === s.defaultMove)?.takes === "number" ? 100 : "Nope!" }]) {
      const m = pureReduce(s, state, a);
      assert.ok(m.refused, `${a.move} ${String(a.value)}`);
      assert.equal(m.trace.length, 1);
      assert.equal(m.state, state);
    }
  });

  test(`${s.slug}: costs for 8 things fall in the table's bands (${BANDS[s.slug].join(" · ")})`, () => {
    const c = s.costs();
    const got = [c.find, c.add, c.remove];
    got.forEach((cost, i) => {
      assert.equal(cost.band, BANDS[s.slug][i], `${cost.why} took ${cost.steps}`);
      assert.equal(band(cost.steps), cost.band);
      assert.ok(cost.why.length > 0 && !/O\(/.test(cost.why));
    });
    assert.deepEqual(s.costs(), c, "the same numbers every time");
  });

  test(`${s.slug}: describe names every label, in every state the example passes through`, () => {
    let state = s.empty();
    for (const a of [...s.example, ...FULL[s.slug].fill]) {
      state = s.reduce(state, a).state;
      const d = s.describe(state);
      for (const l of s.labels(state)) assert.ok(d.includes(l), `"${d}" lacks ${l}`);
    }
  });

  test(`${s.slug}: moves are listed once each and the default is one of them`, () => {
    const ids = s.moves.map((m) => m.id);
    assert.equal(new Set(ids).size, ids.length);
    assert.ok(ids.includes(s.defaultMove));
    for (const a of s.example) assert.ok(ids.includes(a.move), a.move);
  });

  const take = EMPTY[s.slug];
  if (take) {
    test(`${s.slug}: taking from an empty machine is refused`, () => {
      const empty = s.empty();
      const m = pureReduce(s, empty, take);
      assert.ok(m.refused);
      assert.equal(m.trace.length, 1);
      assert.equal(m.state, empty);
    });
  }
}

test("array: insert 7 at 1 moves 23, 16, 15 and 8, then writes: 5 steps; find 16 is 5 steps", () => {
  const moves = run(array, array.example);
  const insert = moves[5];
  assert.equal(insert.steps, 5);
  assert.deepEqual(
    insert.trace.filter((b) => b.step).map((b) => b.say),
    ["Move 23 from drawer 4 up to drawer 5.", "Move 16 from drawer 3 up to drawer 4.", "Move 15 from drawer 2 up to drawer 3.", "Move 8 from drawer 1 up to drawer 2.", "Write 7 in drawer 1."],
  );
  assert.equal(moves[6].steps, 5);
  assert.deepEqual(moves[6].trace[4].hot, ["slot4"]);
});

test("linked list: append 7 walks 3 notes, find 9 is 2 steps, remove 3 is 3 looks and a relink", () => {
  const moves = run(structure("linked-list"), structure("linked-list").example);
  assert.equal(labels(structure("linked-list"), structure("linked-list").example.slice(0, 3)), "4 9 3");
  const append = moves[3];
  assert.equal(append.trace.filter((b) => b.step && b.say.startsWith("Read")).length, 3);
  assert.equal(moves[4].steps, 2);
  assert.equal(moves[5].steps, 4);
});

test("stack: peek is 1 step and shows 4, pop takes 4 off", () => {
  const moves = run(structure("stack"), structure("stack").example);
  assert.equal(moves[3].steps, 1);
  assert.deepEqual(say(moves[3]), ["Look at the top plate: it is 4.", "4 is on top."]);
  assert.deepEqual(say(moves[4]), ["Take 4 off the top.", "4 comes off; 7 is on top now."]);
});

test("queue: front to back 2 9 6 1 8 3 7, the head on tile 1 and the tail wrapped to tile 0", () => {
  const { state } = replay(queue, queue.example) as { state: QueueState };
  assert.equal(state.head, 1);
  assert.equal(tail(state), 0);
  assert.deepEqual(
    state.tiles.map((p) => p?.value ?? null),
    [null, 2, 9, 6, 1, 8, 3, 7],
  );
});

test("hash table: act lands in bucket 0 behind cat; a 6-letter or capitalised word is refused", () => {
  assert.equal(letterSum("cat"), 24);
  assert.deepEqual(
    ["cat", "dog", "fox", "act"].map(bucketOf),
    [0, 2, 5, 0],
  );
  assert.deepEqual(
    COST_WORDS.map(bucketOf),
    [0, 1, 2, 3, 4, 5, 6, 7],
  );
  assert.equal(bucketOf("pig"), bucketOf("cat"));
  const { state } = replay(hashTable, hashTable.example) as { state: HashState };
  assert.deepEqual(state.buckets[0], ["cat", "act"]);
  for (const bad of ["carrot", "Cat", "c4t", "", "a b"]) {
    const m = pureReduce(hashTable, state, { move: "put", value: bad });
    assert.ok(m.refused, bad);
    assert.equal(m.state, state);
  }
});

test("search tree: find 6 and find 7 are 3 steps each; find 6 says less than 8, then more than 3", () => {
  const moves = run(binarySearchTree, binarySearchTree.example);
  const [find6, find7] = moves.slice(-2);
  assert.equal(find6.steps, 3);
  assert.equal(find7.steps, 3);
  assert.match(find6.trace[0].say, /less than 8/);
  assert.match(find6.trace[1].say, /more than 3/);
  assert.equal(find6.trace[find6.trace.length - 1].say, "Found 6 in 3 steps.");
  assert.equal(height((moves[moves.length - 1].state as TreeState).root), 3);
});

test("search tree: insert 1..5 on an empty tree is a line 5 tall, and find 5 costs 5 steps", () => {
  const [line, find5] = run(binarySearchTree, [{ move: "line" }, { move: "find", value: 5 }]);
  const root = (line.state as TreeState).root;
  assert.equal(height(root), 5);
  assert.deepEqual(levels(root), [[1], [2], [3], [4], [5]]);
  assert.equal(find5.steps, 5);
  // the demo starts again from empty whatever the tree held
  const after = pureReduce(binarySearchTree, replay(binarySearchTree, binarySearchTree.example).state, { move: "line" });
  assert.deepEqual(levels((after.state as TreeState).root), [[1], [2], [3], [4], [5]]);
  // nothing can hang below level 5
  const deep = pureReduce(binarySearchTree, line.state, { move: "insert", value: 6 });
  assert.ok(deep.refused);
});

test("search tree: remove keeps the order (leaf, one child, two children, the root)", () => {
  const t = binarySearchTree;
  const base = replay(t, t.example).state;
  const inorder = (s: TreeState) => {
    const out: number[] = [];
    const walk = (n: TreeState["root"]) => {
      if (!n) return;
      walk(n.left);
      out.push(n.value);
      walk(n.right);
    };
    walk(s.root);
    return out;
  };
  for (const [x, rest] of [
    [1, [3, 6, 8, 10, 14]],
    [10, [1, 3, 6, 8, 14]],
    [3, [1, 6, 8, 10, 14]],
    [8, [1, 3, 6, 10, 14]],
  ] as const) {
    const m = pureReduce(t, base, { move: "remove", value: x });
    assert.deepEqual(inorder(m.state), rest, `remove ${x}`);
    assert.equal(m.steps, countSteps(m.trace));
  }
  assert.equal(levels(pureReduce(t, base, { move: "remove", value: 8 }).state.root)[0][0], 10);
});

test("heap: the adds give the row 1 3 8 5 4 (1 climbs twice), take smallest gives 3 4 8 5", () => {
  const moves = run(heap, heap.example);
  assert.deepEqual(heap.labels(moves[4].state), ["1", "3", "8", "5", "4"]);
  assert.equal(moves[3].trace.filter((b) => b.step && /swap/.test(b.say)).length, 2, "1 climbs twice");
  assert.deepEqual(heap.labels(moves[5].state), ["3", "4", "8", "5"]);
  assert.equal(moves[5].steps, 3);
});

test("heap: every parent ≤ its children after every move of a 200-move seeded run", () => {
  // a small LCG, so the run is the same every time
  let seed = 214;
  const next = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  let state: HeapState = heap.empty();
  let refused = 0;
  for (let i = 0; i < 200; i++) {
    const a: Action = next() < 0.6 ? { move: "add", value: Math.floor(next() * 100) } : next() < 0.85 ? { move: "take" } : { move: "peek" };
    const m = pureReduce(heap, state, a);
    assert.equal(m.steps, countSteps(m.trace));
    if (m.refused) {
      refused++;
      assert.equal(m.state, state);
    }
    state = m.state;
    const row = state.row.map((e) => e.value);
    for (let k = 1; k < row.length; k++) assert.ok(row[Math.floor((k - 1) / 2)] <= row[k], `move ${i}: ${row.join(" ")}`);
    assert.equal(new Set(state.row.map((e) => e.id)).size, state.row.length, "ids stay unique");
  }
  assert.ok(refused < 200);
});

test("graph: the ripple from A is B C D, then E F G, then H; the way to H is A C F H", () => {
  const { state } = replay(graph, graph.example) as { state: GraphState };
  assert.equal(state.lines.length, 9);
  assert.deepEqual(ripple(state, "A"), [
    ["B", "C", "D"],
    ["E", "F", "G"],
    ["H"],
  ]);
  assert.deepEqual(path(state, "A", "H"), ["A", "C", "F", "H"]);
  assert.equal(path(graph.empty(), "A", "H"), null);
  const rippleMove = run(graph, graph.example).at(-2);
  assert.equal(rippleMove?.steps, 8);
});

test("graph: over 12 lines, a line twice and a station twice are refused", () => {
  const full = replay(graph, FULL.graph.fill).state;
  assert.equal(full.lines.length, 12);
  const starter = replay(graph, graph.example).state;
  for (const a of [
    { move: "connect", value: "A", to: "B" },
    { move: "connect", value: "A", to: "A" },
    { move: "connect", value: "A", to: "Z" },
    { move: "cut", value: "A", to: "H" },
  ]) {
    const m = pureReduce(graph, starter, a);
    assert.ok(m.refused, `${a.value}-${a.to}`);
    assert.equal(m.state, starter);
  }
});

test("element ids are stable: the same thing keeps its id from move to move", () => {
  const moves = run(queue, queue.example);
  const id2 = (s: QueueState) => s.tiles.find((p) => p?.value === 2)?.id;
  assert.ok(moves.slice(1).every((m) => id2(m.state as QueueState) === "q1"));
  const h = run(heap, heap.example);
  assert.equal((h[3].state as HeapState).row[0].id, "v3", "1 keeps its id as it climbs");
});

function structure(slug: string): Structure<unknown> {
  const s = bySlug(slug);
  assert.ok(s, slug);
  return s;
}
