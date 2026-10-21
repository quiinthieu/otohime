// Every machine's drawing fits a phone: for every state its worked example
// passes through, the machine at its cap, and every state of a seeded
// 200-move run, each stamp, label, hand and arrow sits inside the 480-wide
// frame with a 2-unit margin, no two stamps overlap, every arrow joins two
// placed stamps, and every letter is 17 or more (12 px or more at 358 CSS px).
import assert from "node:assert/strict";
import { test } from "node:test";
import { type Action, type Structure } from "./machine.ts";
import { labelBox, SMALL, STAMP_SIZE, stampBounds, WIDTH, type Label } from "./paper.ts";
import { arrowEnds, kindsIn, placedText, pointerText, SCENE_KINDS, sceneFor, TEXT, type Pointer, type Scene } from "./scenes.ts";
import { STRUCTURES, bySlug } from "./structures/index.ts";
import { bucketOf } from "./structures/hash-table.ts";

const MARGIN = 2;
const PHONE_WIDTH = 358;
const MIN_PX = 12;

type Box = [number, number, number, number];

const inside = (scene: Scene, [l, t, r, b]: Box) => l >= MARGIN && t >= MARGIN && r <= scene.width - MARGIN && b <= scene.height - MARGIN;
const show = ([l, t, r, b]: Box) => `${l.toFixed(1)},${t.toFixed(1)} to ${r.toFixed(1)},${b.toFixed(1)}`;

function handBox(p: Pointer): Box {
  const a = (p.angle * Math.PI) / 180;
  const [l, t, r, b] = stampBounds("hand");
  const corners = [
    [l, t],
    [l, b],
    [r, t],
    [r, b],
  ].map(([x, y]) => [p.x + x * Math.cos(a) - y * Math.sin(a), p.y + x * Math.sin(a) + y * Math.cos(a)]);
  const xs = corners.map(([x]) => x);
  const ys = corners.map(([, y]) => y);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}

/** Everything wrong with a scene, as sentences; [] when it is clean. */
function problems(scene: Scene): string[] {
  const out: string[] = [];
  assert.equal(scene.width, WIDTH);
  const ids = new Set<string>();
  const boxes: [string, Box][] = [];
  for (const p of scene.stamps) {
    if (ids.has(p.id)) out.push(`${p.id} is placed twice`);
    ids.add(p.id);
    const [l, t, r, b] = stampBounds(p.kind);
    const box: Box = [p.x + l, p.y + t, p.x + r, p.y + b];
    if (!inside(scene, box)) out.push(`stamp ${p.id} at ${show(box)}`);
    for (const [other, o] of boxes) {
      if (box[0] < o[2] && o[0] < box[2] && box[1] < o[3] && o[1] < box[3]) out.push(`${p.id} overlaps ${other}`);
    }
    boxes.push([p.id, box]);
    if (p.text) {
      const lb = labelBox(placedText(p));
      if (!inside(scene, lb)) out.push(`the text ${p.text} on ${p.id} at ${show(lb)}`);
    }
  }
  const letters: Label[] = [...scene.labels, ...scene.pointers.map(pointerText), ...scene.stamps.filter((p) => p.text).map(placedText)];
  for (const l of letters) {
    if (!inside(scene, labelBox(l))) out.push(`label ${l.text} at ${show(labelBox(l))}`);
    if (l.size < SMALL || (l.size * PHONE_WIDTH) / WIDTH < MIN_PX) out.push(`label ${l.text} is size ${l.size}`);
    if (!l.text.trim()) out.push("an empty label");
  }
  for (const p of scene.pointers) {
    if (!inside(scene, handBox(p))) out.push(`hand ${p.id} at ${show(handBox(p))}`);
  }
  const arrowIds = new Set<string>();
  for (const a of scene.arrows) {
    if (arrowIds.has(a.id)) out.push(`arrow ${a.id} twice`);
    arrowIds.add(a.id);
    if (!ids.has(a.from) || !ids.has(a.to)) {
      out.push(`arrow ${a.id} joins ${a.from} to ${a.to}, not both placed`);
      continue;
    }
    const [x1, y1, x2, y2] = arrowEnds(scene, a);
    const box: Box = [Math.min(x1, x2), Math.min(y1, y2), Math.max(x1, x2), Math.max(y1, y2)];
    if (!inside(scene, box)) out.push(`arrow ${a.id} at ${show(box)}`);
    if (Math.hypot(x2 - x1, y2 - y1) < 12) out.push(`arrow ${a.id} is too short to see`);
  }
  return out;
}

// The states a run passes through, the start included.
function walk(s: Structure<unknown>, actions: readonly Action[], start: unknown = s.empty()): unknown[] {
  const states = [start];
  for (const a of actions) states.push(s.reduce(states.at(-1), a).state);
  return states;
}

// Words of one or two letters, three for each bucket, so the table fills.
const HASH_FILL: string[] = (() => {
  const letters = "abcdefghijklmnopqrstuvwxyz";
  const words = [...letters, ...[...letters].flatMap((a) => [...letters].map((b) => a + b))];
  return Array.from({ length: 8 }, (_, b) => words.filter((w) => bucketOf(w) === b).slice(0, 3)).flat();
})();

// Moves that fill each machine to its cap; the next one must be refused.
const FILL: Record<string, (cap: number) => Action[]> = {
  array: (cap) => Array.from({ length: cap }, (_, i) => ({ move: "set", value: 90 + i, to: String(i) })),
  "linked-list": (cap) => Array.from({ length: cap }, (_, i) => ({ move: "append", value: 90 + i })),
  stack: (cap) => Array.from({ length: cap }, (_, i) => ({ move: "push", value: 90 + i })),
  queue: (cap) => [...Array.from({ length: 3 }, (_, i) => ({ move: "join", value: i })), { move: "leave" }, { move: "leave" }, ...Array.from({ length: cap - 1 }, (_, i) => ({ move: "join", value: 90 + i }))],
  "hash-table": () => HASH_FILL.map((value) => ({ move: "put", value })),
  "binary-search-tree": () => [8, 4, 12, 2, 6, 10, 14, 1, 3, 5, 7, 9, 11, 13, 15].map((value) => ({ move: "insert", value })),
  heap: (cap) => Array.from({ length: cap }, (_, i) => ({ move: "add", value: 99 - i * 6 })),
  graph: () => [
    ...["A-B", "A-C", "A-D", "B-E", "C-E", "C-F", "D-G", "F-H", "G-H"].map((l) => ({ move: "connect", value: l[0], to: l[2] })),
    { move: "connect", value: "B", to: "C" },
    { move: "connect", value: "E", to: "F" },
    { move: "connect", value: "A", to: "H" },
  ],
};

// The move that must be refused once a machine is full, where repeating the
// last fill move would not be (a number already in the tree is found, not refused).
const ONE_MORE: Record<string, Action> = {
  array: { move: "insert", value: 1, to: "0" },
  "hash-table": { move: "put", value: "zzzzz" },
  "binary-search-tree": { move: "insert", value: 16 },
  graph: { move: "connect", value: "D", to: "H" },
};

// A small seeded generator, so the random run is the same every time.
function lcg(seed: number) {
  let x = seed;
  return (n: number) => {
    x = (Math.imul(x, 1664525) + 1013904223) >>> 0;
    return x % n;
  };
}

function randomRun(s: Structure<unknown>, seed: number, count = 200): Action[] {
  const pick = lcg(seed);
  const letters = "abcdefgh";
  return Array.from({ length: count }, () => {
    const m = s.moves[pick(s.moves.length)];
    switch (m.takes) {
      case "none":
        return { move: m.id };
      case "word":
        if (s.slug === "graph") return { move: m.id, value: "ABCDEFGH"[pick(8)] };
        return { move: m.id, value: Array.from({ length: 1 + pick(3) }, () => letters[pick(letters.length)]).join("") };
      case "pair":
        return { move: m.id, value: "ABCDEFGH"[pick(8)], to: "ABCDEFGH"[pick(8)] };
      case "index":
        return { move: m.id, value: pick(s.cap) };
      default:
        return m.at ? { move: m.id, value: pick(100), to: String(pick(s.cap)) } : { move: m.id, value: pick(20) };
    }
  });
}

for (const s of STRUCTURES) {
  const example = walk(s, s.example);
  const fill = FILL[s.slug](s.cap);
  const full = walk(s, fill).at(-1);

  test(`${s.slug}: every state of the worked example fits 480 wide, no overlaps`, () => {
    example.forEach((state, i) => assert.deepEqual(problems(sceneFor(s.slug, state)), [], `after move ${i}`));
  });

  test(`${s.slug}: the machine at its cap of ${s.cap} fits, no overlaps`, () => {
    const refused = s.reduce(full, ONE_MORE[s.slug] ?? fill[fill.length - 1]);
    assert.ok(refused.refused, `${s.slug} is full`);
    assert.deepEqual(problems(sceneFor(s.slug, full)), []);
    assert.ok(sceneFor(s.slug, full).stamps.length >= Math.min(s.cap, 8));
  });

  test(`${s.slug}: every state of a seeded 200-move run fits too`, () => {
    walk(s, randomRun(s, 214)).forEach((state, i) => assert.deepEqual(problems(sceneFor(s.slug, state)), [], `after move ${i}`));
  });

  test(`${s.slug}: a stamp keeps its kind, seed and (in a fixed grid) its place in every state`, () => {
    const seen = new Map<string, string>();
    for (const state of [...example, full]) {
      for (const p of sceneFor(s.slug, state).stamps) {
        const fixed = /^(slot|tile|b|box)\d+$/.test(p.id) || s.slug === "graph";
        const key = `${p.kind}:${p.seed}${fixed ? `@${p.x},${p.y}` : ""}`;
        assert.equal(seen.get(p.id) ?? key, key, p.id);
        seen.set(p.id, key);
      }
    }
  });

  test(`${s.slug}: the height is fixed and the drawing is the same twice`, () => {
    const heights = new Set([...example, full].map((state) => sceneFor(s.slug, state).height));
    assert.equal(heights.size, 1);
    assert.deepEqual(sceneFor(s.slug, full), sceneFor(s.slug, full));
  });

  test(`${s.slug}: SCENE_KINDS names every stamp kind its drawings use, and no more`, () => {
    const used = new Set<string>();
    for (const state of [s.empty(), ...example, full, ...walk(s, randomRun(s, 214))]) for (const k of kindsIn(sceneFor(s.slug, state))) used.add(k);
    assert.deepEqual([...used].sort(), [...SCENE_KINDS[s.slug]].sort());
  });

  test(`${s.slug}: what the drawing writes is what labels() says`, () => {
    for (const state of [...example, full]) {
      const written = sceneFor(s.slug, state).stamps.map((p) => p.text).filter(Boolean);
      for (const l of s.labels(state)) assert.ok(written.includes(l), `${l} is not written`);
    }
  });
}

test("the search tree's 1..5 line places five nodes at strictly increasing depth", () => {
  const tree = bySlug("binary-search-tree")!;
  const state = tree.reduce(tree.empty(), { move: "line" }).state;
  const scene = sceneFor("binary-search-tree", state);
  const ys = [1, 2, 3, 4, 5].map((v) => scene.stamps.find((p) => p.id === `n${v}`)!.y);
  for (let i = 1; i < 5; i++) assert.ok(ys[i] > ys[i - 1], `n${i + 1} at ${ys[i]} is below n${i} at ${ys[i - 1]}`);
  assert.deepEqual(problems(scene), []);
});

test("the search tree's left-to-right order is its sorted order", () => {
  const tree = bySlug("binary-search-tree")!;
  const scene = sceneFor("binary-search-tree", walk(tree, tree.example).at(-1));
  const byX = [...scene.stamps].sort((a, b) => a.x - b.x).map((p) => Number(p.text));
  assert.deepEqual(byX, [1, 3, 6, 8, 10, 14]);
  assert.deepEqual(scene.arrows.map((a) => a.id).sort(), ["n10-n14", "n3-n1", "n3-n6", "n8-n10", "n8-n3"]);
});

test("the heap draws box i's children as boxes 2i+1 and 2i+2, above its row", () => {
  const heap = bySlug("heap")!;
  const state = walk(heap, heap.example.slice(0, 5)).at(-1);
  const scene = sceneFor("heap", state);
  assert.deepEqual(
    scene.stamps.filter((p) => /^box\d+$/.test(p.id) && p.text).map((p) => p.text),
    ["1", "3", "8", "5", "4"],
  );
  const nodes = scene.stamps.filter((p) => p.kind === "node");
  const rowTop = Math.min(...scene.stamps.filter((p) => p.kind === "box").map((p) => p.y));
  assert.ok(nodes.every((n) => n.y < rowTop));
  const at = (text: string) => nodes.find((n) => n.text === text)!.id;
  assert.deepEqual(
    scene.arrows.map((a) => [a.id, a.from, a.to]),
    [
      ["edge1", at("1"), at("3")],
      ["edge2", at("1"), at("8")],
      ["edge3", at("3"), at("5")],
      ["edge4", at("3"), at("4")],
    ],
  );
});

test("the queue's hands: head on the front's tile, tail on the next free one, wrapping to tile 0", () => {
  const queue = bySlug("queue")!;
  const scene = sceneFor("queue", walk(queue, queue.example).at(-1));
  const tileOf = (p: Pointer) => {
    const tiles = scene.stamps.filter((t) => t.kind === "tile");
    return tiles.reduce((best, t) => (Math.hypot(t.x - p.x, t.y - p.y) < Math.hypot(best.x - p.x, best.y - p.y) ? t : best)).id;
  };
  const hand = (id: string) => scene.pointers.find((p) => p.id === id)!;
  assert.equal(tileOf(hand("head")), "tile1");
  assert.equal(tileOf(hand("tail")), "tile0");
  assert.equal(scene.stamps.find((t) => t.id === "tile0")!.text, "");
  assert.equal(scene.stamps.find((t) => t.id === "tile7")!.text, "7");
});

test("the list wraps onto a second line after four notes; the stack grows up from its floor", () => {
  const list = bySlug("linked-list")!;
  const full = walk(list, FILL["linked-list"](list.cap)).at(-1);
  const ys = sceneFor("linked-list", full).stamps.map((p) => p.y);
  assert.equal(new Set(ys.slice(0, 4)).size, 1);
  assert.ok(ys[4] > ys[3]);
  const stack = bySlug("stack")!;
  const states = walk(stack, FILL.stack(stack.cap));
  const bottom = new Set(states.slice(1).map((st) => sceneFor("stack", st).stamps[0].y));
  assert.equal(bottom.size, 1, "the bottom plate never moves");
  const plates = sceneFor("stack", states.at(-1)).stamps;
  for (let i = 1; i < plates.length; i++) assert.ok(plates[i].y < plates[i - 1].y);
});

test("the hash table hangs act behind cat in bucket 0", () => {
  const hash = bySlug("hash-table")!;
  const scene = sceneFor("hash-table", walk(hash, hash.example).at(-1));
  assert.deepEqual(
    scene.arrows.filter((a) => a.id === "arrow-b0" || a.id === "arrow-w-cat").map((a) => [a.from, a.to]),
    [
      ["b0", "w-cat"],
      ["w-cat", "w-act"],
    ],
  );
});

test("the checker flags what it should", () => {
  const base: Scene = { width: WIDTH, height: 100, stamps: [], arrows: [], pointers: [], labels: [] };
  assert.deepEqual(problems(base), []);
  const two: Scene = {
    ...base,
    stamps: [
      { id: "a", kind: "box", seed: 0, x: 40, y: 40, text: "1" },
      { id: "b", kind: "box", seed: 1, x: 70, y: 40, text: "2" },
    ],
  };
  assert.deepEqual(problems(two), ["b overlaps a"]);
  assert.deepEqual(problems({ ...base, stamps: [{ id: "a", kind: "node", seed: 0, x: 21, y: 50, text: "" }] }), ["stamp a at 1.0,30.0 to 41.0,70.0"]);
  assert.deepEqual(problems({ ...base, arrows: [{ id: "x", from: "a", to: "b", head: true }] }), ["arrow x joins a to b, not both placed"]);
  assert.deepEqual(problems({ ...base, labels: [{ x: 10, y: 50, text: "tiny", size: 14 }] }), ["label tiny is size 14"]);
  assert.equal(TEXT >= SMALL, true);
  assert.equal(STAMP_SIZE.hand.length, 28);
});
