// Where everything in a machine's drawing goes, for any state: which stamp,
// where, with what written on it, which arrows join what, where the hands
// point and what the fixed labels say. Pure geometry and no ink, so the island
// can lay out every beat itself; the server and the island call the same
// sceneFor, so the still and the moving picture agree.
//
// Every scene is 480 wide, fits a 390 px phone and keeps a stamp's id for life
// (a slot, a note, a plate, a tile, a bucket, a word, a node, a station), so
// the island moves a stamp rather than redrawing it. Each slug's height is
// fixed, so the drawing does not jump as the machine fills.
import { BUCKETS, type HashState } from "./structures/hash-table.ts";
import type { ArrayState } from "./structures/array.ts";
import type { HeapState } from "./structures/heap.ts";
import type { ListState } from "./structures/linked-list.ts";
import type { StackState } from "./structures/stack.ts";
import type { TreeNode, TreeState } from "./structures/binary-search-tree.ts";
import { MAX_LEVELS } from "./structures/binary-search-tree.ts";
import { STATIONS, type GraphState } from "./structures/graph.ts";
import { tail, type QueueState } from "./structures/queue.ts";
import { label, SMALL, STAMP_SIZE, WIDTH, type Label, type StampKind, type StampSeed } from "./paper.ts";

export type PlacedKind = Exclude<StampKind, "arrow" | "hand">;
// x, y is the stamp's centre
export type Placed = { id: string; kind: PlacedKind; seed: StampSeed; x: number; y: number; text: string };
// a stamp's arrow to another stamp; a graph's line has no head
export type Arrow = { id: string; from: string; to: string; head: boolean };
// a hand with its tip on x, y, pointing `angle` degrees clockwise from +x
export type Pointer = { id: string; x: number; y: number; angle: number; text: string };
export type Scene = { width: typeof WIDTH; height: number; stamps: Placed[]; arrows: Arrow[]; pointers: Pointer[]; labels: Label[] };

// What a stamp has written on it: in the middle, except a plate, too thin to
// letter, which is lettered to its right.
export const TEXT = 18;
export function placedText(p: Placed): Label {
  if (p.kind === "plate") return label(p.x + STAMP_SIZE.plate.w / 2 + 10, p.y + TEXT * 0.35, p.text, { anchor: "start", size: TEXT });
  return label(p.x, p.y + TEXT * 0.35, p.text, { anchor: "middle", size: TEXT });
}

// A hand's word sits just past its tail, on the far side from what it points at.
const HAND_GAP = 8;
export function pointerText(p: Pointer): Label {
  const a = (p.angle * Math.PI) / 180;
  const back = STAMP_SIZE.hand.length + HAND_GAP;
  const [cos, sin] = [Math.cos(a), Math.sin(a)];
  const x = p.x - back * cos;
  const y = p.y - back * sin;
  const anchor = cos > 0.38 ? "end" : cos < -0.38 ? "start" : "middle";
  // a hand pointing down has its word above it; pointing up, below it
  const dy = sin > 0.38 ? -2 : sin < -0.38 ? SMALL * 0.8 : SMALL * 0.35;
  return label(Math.round(x), Math.round(y + dy), p.text, { anchor, size: SMALL });
}

// How far from a stamp's centre its outline is, heading `a` radians out.
function reach(kind: PlacedKind, a: number): number {
  if (kind === "node" || kind === "station") return STAMP_SIZE[kind].r;
  const { w, h } = STAMP_SIZE[kind];
  const [c, s] = [Math.abs(Math.cos(a)), Math.abs(Math.sin(a))];
  return Math.min(c > 1e-9 ? w / 2 / c : Infinity, s > 1e-9 ? h / 2 / s : Infinity);
}

const ARROW_GAP = 4;
/** An arrow's two ends, cut back to just outside the stamps it joins. */
export function arrowEnds(scene: Scene, arrow: Arrow): [number, number, number, number] {
  const from = scene.stamps.find((p) => p.id === arrow.from);
  const to = scene.stamps.find((p) => p.id === arrow.to);
  if (!from || !to) throw new Error(`arrow ${arrow.id} joins a stamp that is not placed`);
  const a = Math.atan2(to.y - from.y, to.x - from.x);
  const r1 = reach(from.kind, a) + ARROW_GAP;
  const r2 = reach(to.kind, a + Math.PI) + ARROW_GAP;
  const round = (n: number) => Math.round(n * 10) / 10;
  return [
    round(from.x + r1 * Math.cos(a)),
    round(from.y + r1 * Math.sin(a)),
    round(to.x - r2 * Math.cos(a)),
    round(to.y - r2 * Math.sin(a)),
  ];
}

// A stamp's seed follows from its id, so it looks the same in every state.
function seedFor(id: string): StampSeed {
  let h = 7;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) % 9973;
  return (h % 3) as StampSeed;
}

const place = (id: string, kind: PlacedKind, x: number, y: number, text = ""): Placed => ({ id, kind, seed: seedFor(id), x, y, text });

const scene = (height: number, parts: Partial<Omit<Scene, "width" | "height">>): Scene => ({
  width: WIDTH,
  height,
  stamps: parts.stamps ?? [],
  arrows: parts.arrows ?? [],
  pointers: parts.pointers ?? [],
  labels: parts.labels ?? [],
});

// A row of boxes, eight a line, each with its number under it: the array's
// drawers and the heap's row.
const PER_ROW = 8;
const BOX_PITCH = 56;
const BOX_LINE = 84;
const BOX_LEFT = WIDTH / 2 - ((PER_ROW - 1) * BOX_PITCH) / 2;

function boxRow(count: number, top: number, idOf: (i: number) => string, textOf: (i: number) => string): { stamps: Placed[]; labels: Label[]; bottom: number } {
  const stamps: Placed[] = [];
  const labels: Label[] = [];
  const half = STAMP_SIZE.box.h / 2;
  for (let i = 0; i < count; i++) {
    const x = BOX_LEFT + (i % PER_ROW) * BOX_PITCH;
    const y = top + half + Math.floor(i / PER_ROW) * BOX_LINE;
    stamps.push(place(idOf(i), "box", x, y, textOf(i)));
    labels.push(label(x, y + half + 20, String(i), { anchor: "middle", size: SMALL }));
  }
  const lines = Math.ceil(count / PER_ROW);
  return { stamps, labels, bottom: top + (lines - 1) * BOX_LINE + 2 * half + 26 };
}

// 1. The array: a row of numbered drawers.
function arrayScene(s: ArrayState): Scene {
  const row = boxRow(s.cap, 12, (i) => `slot${i}`, (i) => (i < s.items.length ? String(s.items[i]) : ""));
  return scene(row.bottom + 8, row);
}

// 2. The linked list: notes four to a line, each with an arrow to the next,
// and a hand at the first. The fifth note starts a second line.
const LIST_PER_ROW = 4;
const LIST_PITCH = 120;
const LIST_LINE = 100;
const LIST_TOP = 84;

function listScene(s: ListState): Scene {
  const left = WIDTH / 2 - ((LIST_PER_ROW - 1) * LIST_PITCH) / 2;
  const stamps = s.nodes.map((n, k) =>
    place(n.id, "box", left + (k % LIST_PER_ROW) * LIST_PITCH, LIST_TOP + Math.floor(k / LIST_PER_ROW) * LIST_LINE, String(n.value)),
  );
  const arrows = s.nodes.slice(1).map((n, k) => ({ id: `arrow-${s.nodes[k].id}`, from: s.nodes[k].id, to: n.id, head: true }));
  const first = stamps[0];
  const pointers: Pointer[] = first ? [{ id: "start", x: first.x, y: first.y - STAMP_SIZE.box.h / 2 - 4, angle: 90, text: "start" }] : [];
  const lines = Math.ceil(s.cap / LIST_PER_ROW);
  return scene(LIST_TOP + (lines - 1) * LIST_LINE + STAMP_SIZE.box.h / 2 + 12, { stamps, arrows, pointers });
}

// 3. The stack: plates piled up from a fixed floor, a hand at the top one.
const PLATE_PITCH = 24;
const STACK_TOP = 24;

function stackScene(s: StackState): Scene {
  const floor = STACK_TOP + (s.cap - 1) * PLATE_PITCH;
  const x = WIDTH / 2;
  const stamps = s.plates.map((p, i) => place(p.id, "plate", x, floor - i * PLATE_PITCH, String(p.value)));
  const top = stamps.at(-1);
  const pointers: Pointer[] = top ? [{ id: "top", x: x - STAMP_SIZE.plate.w / 2 - 6, y: top.y, angle: 0, text: "top" }] : [];
  const labels = [label(x, floor + STAMP_SIZE.plate.h / 2 + 24, "the bottom stays put", { anchor: "middle", size: SMALL })];
  return scene(floor + STAMP_SIZE.plate.h / 2 + 34, { stamps, pointers, labels });
}

// 4. The queue: tiles on a ring, tile 0 at the top and clockwise from there,
// numbered inside; the head and tail hands point in from outside, a little
// either side of their tiles so the two never cover each other.
const RING_R = 100;
const RING_CY = 184;
const HAND_OUT = 28;
const HAND_SPLAY = 9;

function queueScene(s: QueueState): Scene {
  const cx = WIDTH / 2;
  const angleOf = (i: number) => -90 + (360 / s.cap) * i;
  const at = (deg: number, r: number): [number, number] => {
    const a = (deg * Math.PI) / 180;
    return [Math.round((cx + r * Math.cos(a)) * 10) / 10, Math.round((RING_CY + r * Math.sin(a)) * 10) / 10];
  };
  const stamps = s.tiles.map((p, i) => {
    const [x, y] = at(angleOf(i), RING_R);
    return place(`tile${i}`, "tile", x, y, p ? String(p.value) : "");
  });
  const labels = s.tiles.map((_, i) => {
    const [x, y] = at(angleOf(i), RING_R - 42);
    return label(x, Math.round(y + SMALL * 0.35), String(i), { anchor: "middle", size: SMALL });
  });
  const hand = (id: string, tile: number, splay: number): Pointer => {
    const deg = angleOf(tile) + splay;
    const [x, y] = at(deg, RING_R + HAND_OUT);
    return { id, x, y, angle: deg + 180, text: id };
  };
  const pointers = [hand("head", s.head, -HAND_SPLAY), hand("tail", tail(s), HAND_SPLAY)];
  return scene(2 * RING_CY, { stamps, labels, pointers });
}

// 5. The hash table: the buckets down the left, each word hung on its
// bucket's chain to the right, in the order they came.
const HASH_TOP = 30;
const HASH_LINE = 52;
const BUCKET_X = 56;
const WORD_PITCH = 92;

function hashScene(s: HashState): Scene {
  const stamps: Placed[] = [];
  const arrows: Arrow[] = [];
  s.buckets.forEach((chain, b) => {
    const y = HASH_TOP + b * HASH_LINE;
    stamps.push(place(`b${b}`, "bucket", BUCKET_X, y, String(b)));
    let prev = `b${b}`;
    chain.forEach((w, k) => {
      const id = `w-${w}`;
      stamps.push(place(id, "box", BUCKET_X + (k + 1) * WORD_PITCH, y, w));
      arrows.push({ id: `arrow-${prev}`, from: prev, to: id, head: true });
      prev = id;
    });
  });
  return scene(HASH_TOP + (BUCKETS - 1) * HASH_LINE + STAMP_SIZE.box.h / 2 + 8, { stamps, arrows });
}

// 6. The search tree: a node's depth is its level and its place in sorted
// order is its column, so the left-to-right order is the sorted order. Two
// nodes on one level always have a node between them in sorted order, so
// they sit at least two columns apart.
const LEVEL_PITCH = 64;
const TREE_TOP = 30;
const TREE_EDGE = 26;

function treeScene(s: TreeState): Scene {
  const order: { node: TreeNode; depth: number; parent: TreeNode | null }[] = [];
  const walk = (n: TreeNode | null, depth: number, parent: TreeNode | null) => {
    if (!n) return;
    walk(n.left, depth + 1, n);
    order.push({ node: n, depth, parent });
    walk(n.right, depth + 1, n);
  };
  walk(s.root, 0, null);
  const count = order.length;
  const pitch = count > 1 ? Math.min(LEVEL_PITCH, (WIDTH - 2 * TREE_EDGE) / (count - 1)) : 0;
  const id = (n: TreeNode) => `n${n.value}`;
  const stamps = order.map(({ node, depth }, k) =>
    place(id(node), "node", Math.round((WIDTH / 2 + (k - (count - 1) / 2) * pitch) * 10) / 10, TREE_TOP + depth * LEVEL_PITCH, String(node.value)),
  );
  const arrows = order.flatMap(({ node, parent }) => (parent ? [{ id: `${id(parent)}-${id(node)}`, from: id(parent), to: id(node), head: false }] : []));
  return scene(TREE_TOP + (MAX_LEVELS - 1) * LEVEL_PITCH + STAMP_SIZE.node.r + 10, { stamps, arrows });
}

// 7. The heap: the tree it stands for above, its row of boxes below. Box i's
// children are boxes 2i+1 and 2i+2, and the tree draws exactly that: node i
// sits on level floor(log2(i+1)), evenly across its level.
const HEAP_TOP = 30;
const HEAP_LEVEL = 60;

function heapScene(s: HeapState): Scene {
  const levelsCount = Math.ceil(Math.log2(s.cap + 1));
  const stamps: Placed[] = s.row.map((e, i) => {
    const level = Math.floor(Math.log2(i + 1));
    const across = i - (2 ** level - 1);
    return place(e.id, "node", (WIDTH * (across + 0.5)) / 2 ** level, HEAP_TOP + level * HEAP_LEVEL, String(e.value));
  });
  const arrows = s.row.slice(1).map((e, k) => {
    const i = k + 1;
    return { id: `edge${i}`, from: s.row[Math.floor((i - 1) / 2)].id, to: e.id, head: false };
  });
  const rowTop = HEAP_TOP + (levelsCount - 1) * HEAP_LEVEL + STAMP_SIZE.node.r + 28;
  const row = boxRow(s.cap, rowTop, (i) => `box${i}`, (i) => (i < s.row.length ? String(s.row[i].value) : ""));
  return scene(row.bottom + 8, { stamps: [...stamps, ...row.stamps], arrows, labels: row.labels });
}

// 8. The graph: eight stations in fixed places, laid out by hops from A
// (B C D, then E F G, then H) so the starter map's lines never cross.
export const STATION_AT: Record<(typeof STATIONS)[number], [number, number]> = {
  A: [50, 150],
  B: [170, 46],
  C: [180, 150],
  D: [160, 258],
  E: [310, 72],
  F: [306, 186],
  G: [296, 282],
  H: [430, 230],
};

function graphScene(s: GraphState): Scene {
  const stamps = STATIONS.map((st) => place(st, "station", ...STATION_AT[st], st));
  const arrows = s.lines.map((l) => {
    const [a, b] = l.split("-");
    return { id: l, from: a, to: b, head: false };
  });
  return scene(310, { stamps, arrows });
}

const SCENES: Record<string, (s: never) => Scene> = {
  array: arrayScene,
  "linked-list": listScene,
  stack: stackScene,
  queue: queueScene,
  "hash-table": hashScene,
  "binary-search-tree": treeScene,
  heap: heapScene,
  graph: graphScene,
};

/** The drawing of `state`, a state of the structure `slug`. */
export function sceneFor(slug: string, state: unknown): Scene {
  const draw = SCENES[slug];
  if (!draw) throw new Error(`no scene for ${slug}`);
  return draw(state as never);
}
