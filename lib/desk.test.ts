// The desk layout model, without a desk: registry, default and tidy layouts,
// stacking, rotation, clamping and the stored-layout parser.
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  bringToFront,
  clamp,
  clampItem,
  defaultLayout,
  DESK_ITEMS,
  DESK_KEY,
  DESK_VERSION,
  hash,
  MAX_TILT,
  moveTo,
  normalizeRot,
  parseDesk,
  rotate,
  ROTATE_STEP,
  sendToBack,
  serializeDesk,
  tidy,
  tiltFor,
  type DeskEntry,
  type DeskLayout,
} from "./desk.ts";

const ids = (layout: DeskLayout) => layout.map((item) => item.id);
const byZ = (layout: DeskLayout) => [...layout].sort((a, b) => a.z - b.z).map((item) => item.id);
const zs = (layout: DeskLayout) => layout.map((item) => item.z).sort((a, b) => a - b);
const get = (layout: DeskLayout, id: string) => {
  const item = layout.find((i) => i.id === id);
  assert.ok(item, `no ${id}`);
  return item;
};
const ranks = (n: number) => Array.from({ length: n }, (_, i) => i);
const stored = (items: unknown, v: unknown = DESK_VERSION) => JSON.stringify({ v, items });

test("the registry holds each section once, with a route and a home on the desk", () => {
  assert.deepEqual(ids(defaultLayout()), ["notes", "projects", "sketches", "music", "play"]);
  assert.equal(new Set(DESK_ITEMS.map((e) => e.id)).size, DESK_ITEMS.length);
  assert.deepEqual(
    Object.fromEntries(DESK_ITEMS.map((e) => [e.id, [e.kind, e.href]])),
    {
      notes: ["notebook", "/notes"],
      projects: ["polaroid", "/projects"],
      sketches: ["polaroid", "/sketches"],
      music: ["cassette", "/music"],
      play: ["console", "/play"],
    },
  );
  for (const e of DESK_ITEMS) {
    assert.ok(e.x >= 0 && e.x <= 1 && e.y >= 0 && e.y <= 1, `${e.id} home is off the desk`);
    assert.ok(e.label.length > 0);
  }
  assert.equal(DESK_KEY, "desk:v1");
});

test("hash is FNV-1a and stable", () => {
  assert.equal(hash(""), 0x811c9dc5);
  assert.equal(hash("a"), 0xe40c292c);
  assert.equal(hash("notes"), hash("notes"));
  assert.notEqual(hash("notes"), hash("music"));
});

test("the default layout puts every item at home, leaning its own hashed way", () => {
  const a = defaultLayout();
  assert.deepEqual(a, defaultLayout(), "same input, same desk: no Math.random");
  assert.deepEqual(zs(a), ranks(DESK_ITEMS.length));
  for (const [i, item] of a.entries()) {
    const e = DESK_ITEMS[i];
    assert.deepEqual([item.x, item.y, item.z], [e.x, e.y, i]);
    assert.equal(item.rot, tiltFor(item.id));
    assert.ok(Math.abs(item.rot) <= MAX_TILT, `${item.id} leans ${item.rot}`);
  }
  assert.ok(new Set(a.map((item) => item.rot)).size > 1, "the items do not all lean alike");
  assert.ok(a.some((item) => item.rot !== 0), "the desk is not already tidy");
});

test("Math.random is never called", () => {
  const real = Math.random;
  Math.random = () => assert.fail("Math.random called");
  try {
    defaultLayout();
    tidy(defaultLayout());
    parseDesk(stored([{ id: "notes", x: 0.1, y: 0.1, rot: 3, z: 0 }]));
  } finally {
    Math.random = real;
  }
});

test("tidy sends every item home square and keeps the stacking order", () => {
  let layout = defaultLayout();
  layout = moveTo(layout, "music", 0.95, 0.05);
  layout = rotate(layout, "music", 90);
  layout = bringToFront(layout, "notes");
  const before = byZ(layout);
  const t = tidy(layout);
  assert.deepEqual(ids(t), ids(defaultLayout()));
  assert.deepEqual(byZ(t), before);
  for (const [i, item] of t.entries()) {
    assert.deepEqual([item.x, item.y, item.rot], [DESK_ITEMS[i].x, DESK_ITEMS[i].y, 0]);
  }
  assert.deepEqual(tidy(t), t, "tidy twice is tidy once");
});

test("tidy follows the registry: retired items go, new ones land on top", () => {
  const registry: DeskEntry[] = [
    ...DESK_ITEMS.filter((e) => e.id !== "music"),
    { id: "pin-shore", kind: "polaroid", href: "/shore", label: "Shore", x: 0.9, y: 0.1 },
  ];
  const t = tidy(defaultLayout(), registry);
  assert.deepEqual(ids(t), registry.map((e) => e.id));
  assert.equal(byZ(t).at(-1), "pin-shore");
  assert.deepEqual(zs(t), ranks(registry.length));
});

test("bringToFront and sendToBack restack to 0..n-1 without reordering the rest", () => {
  const base = defaultLayout();
  const front = bringToFront(base, "notes");
  assert.deepEqual(byZ(front), ["projects", "sketches", "music", "play", "notes"]);
  assert.deepEqual(zs(front), ranks(base.length));
  assert.deepEqual(ids(front), ids(base), "array order is the registry's, not the stack's");

  const back = sendToBack(front, "play");
  assert.deepEqual(byZ(back), ["play", "projects", "sketches", "music", "notes"]);
  assert.deepEqual(zs(back), ranks(base.length));

  let churn = base;
  for (let i = 0; i < 100; i++) churn = bringToFront(churn, base[i % base.length].id);
  assert.deepEqual(zs(churn), ranks(base.length), "z never grows");

  assert.equal(bringToFront(base, "nope"), base);
  assert.equal(sendToBack(base, "nope"), base);
  assert.deepEqual(bringToFront(front, "notes"), front, "already in front");
});

test("rotate turns one item by a step and wraps into (-180, 180]", () => {
  const base = defaultLayout();
  const r = rotate(base, "music");
  assert.equal(get(r, "music").rot, normalizeRot(get(base, "music").rot + ROTATE_STEP));
  for (const id of ["notes", "projects", "sketches", "play"]) assert.equal(get(r, id).rot, get(base, id).rot);

  const square = tidy(base);
  let spun = square;
  for (let i = 0; i < 360 / ROTATE_STEP; i++) spun = rotate(spun, "notes");
  assert.equal(get(spun, "notes").rot, 0, "a full turn is home");
  assert.equal(get(rotate(square, "notes", -30), "notes").rot, -30);
  assert.equal(get(rotate(square, "notes", 190), "notes").rot, -170);

  assert.equal(normalizeRot(180), 180);
  assert.equal(normalizeRot(-180), 180);
  assert.equal(normalizeRot(540), 180);
  assert.equal(normalizeRot(-90), -90);
  assert.equal(normalizeRot(725), 5);
});

test("clamp keeps centres on the desk and restacks", () => {
  const item = { ...defaultLayout()[0], x: -0.4, y: 1.7, rot: 400, z: 9 };
  assert.deepEqual(
    [clampItem(item).x, clampItem(item).y, clampItem(item).rot],
    [0, 1, 40],
  );
  const wild = defaultLayout().map((it, i) => ({ ...it, x: i - 2, y: 2 - i, z: 10 * (5 - i) }));
  const c = clamp(wild);
  for (const it of c) assert.ok(it.x >= 0 && it.x <= 1 && it.y >= 0 && it.y <= 1);
  assert.deepEqual(byZ(c), ["play", "music", "sketches", "projects", "notes"]);
  assert.deepEqual(zs(c), ranks(c.length));

  const moved = moveTo(defaultLayout(), "play", 3, -1);
  assert.deepEqual([get(moved, "play").x, get(moved, "play").y], [1, 0]);
});

test("serializeDesk round-trips through parseDesk and stores positions only", () => {
  let layout = defaultLayout();
  layout = moveTo(layout, "sketches", 0.12, 0.88);
  layout = rotate(layout, "sketches", -45);
  layout = sendToBack(layout, "projects");
  const raw = serializeDesk(layout);
  assert.deepEqual(parseDesk(raw), layout);

  const data = JSON.parse(raw);
  assert.equal(data.v, "desk:v1");
  for (const it of data.items) assert.deepEqual(Object.keys(it).sort(), ["id", "rot", "x", "y", "z"]);
});

test("parseDesk falls back to the default desk for anything that is not desk:v1", () => {
  const fallback = defaultLayout();
  for (const raw of [
    null,
    undefined,
    "",
    "not json",
    "null",
    "42",
    '"desk:v1"',
    "[]",
    "{}",
    stored([{ id: "notes", x: 0.1, y: 0.1, rot: 0, z: 0 }], "desk:v0"),
    stored([{ id: "notes", x: 0.1, y: 0.1, rot: 0, z: 0 }], "desk:v2"),
    stored([{ id: "notes", x: 0.1, y: 0.1, rot: 0, z: 0 }], 1),
    stored({ notes: { x: 0.1, y: 0.1, rot: 0, z: 0 } }),
  ]) {
    assert.deepEqual(parseDesk(raw), fallback, String(raw));
  }
});

test("parseDesk drops unknown ids and fills missing items on top", () => {
  const raw = stored([
    { id: "ghost", x: 0.5, y: 0.5, rot: 0, z: 0 },
    { id: "music", x: 0.9, y: 0.2, rot: 12, z: 0 },
    { id: "notes", x: 0.1, y: 0.8, rot: -3, z: 1 },
    { id: "__proto__", x: 0.5, y: 0.5, rot: 0, z: 2 },
  ]);
  const d = parseDesk(raw);
  assert.deepEqual(ids(d), ids(defaultLayout()));
  assert.deepEqual([get(d, "music").x, get(d, "music").y, get(d, "music").rot], [0.9, 0.2, 12]);
  assert.deepEqual([get(d, "notes").x, get(d, "notes").y, get(d, "notes").rot], [0.1, 0.8, -3]);
  assert.deepEqual(byZ(d), ["music", "notes", "projects", "sketches", "play"]);
  assert.deepEqual(zs(d), ranks(d.length));
  for (const id of ["projects", "sketches", "play"]) {
    const def = get(defaultLayout(), id);
    assert.deepEqual([get(d, id).x, get(d, id).y, get(d, id).rot], [def.x, def.y, def.rot]);
  }
});

test("parseDesk takes kind and href from the registry, never from storage", () => {
  const d = parseDesk(stored([{ id: "notes", kind: "console", href: "javascript:alert(1)", x: 0.2, y: 0.2, rot: 0, z: 0 }]));
  assert.deepEqual([get(d, "notes").kind, get(d, "notes").href], ["notebook", "/notes"]);
});

test("parseDesk resets a bad item to its default and clamps the rest", () => {
  const d = parseDesk(
    stored([
      { id: "notes", x: "0.2", y: 0.2, rot: 0, z: 0 },
      { id: "projects", x: 0.2, y: null, rot: 0, z: 0 },
      { id: "sketches", x: 0.3, y: 0.3, rot: 0 },
      "music",
      null,
      { id: "play", x: 4, y: -2, rot: 900, z: 7 },
      { id: "play", x: 0.5, y: 0.5, rot: 0, z: 0 },
    ]),
  );
  const def = defaultLayout();
  for (const id of ["notes", "projects", "sketches", "music"]) {
    assert.deepEqual([get(d, id).x, get(d, id).y, get(d, id).rot], [get(def, id).x, get(def, id).y, get(def, id).rot]);
  }
  assert.deepEqual([get(d, "play").x, get(d, "play").y, get(d, "play").rot], [1, 0, 180], "first copy wins, clamped");
  assert.deepEqual(zs(d), ranks(d.length));
  // Infinity and NaN cannot come out of JSON.parse, but a hand-written store can say 1e999.
  const huge = parseDesk('{"v":"desk:v1","items":[{"id":"notes","x":1e999,"y":0.5,"rot":0,"z":0}]}');
  assert.equal(get(huge, "notes").x, get(def, "notes").x);
});

test("parseDesk reads against a custom registry", () => {
  const registry: DeskEntry[] = [
    { id: "a", kind: "polaroid", href: "/a", label: "A", x: 0.1, y: 0.1 },
    { id: "b", kind: "polaroid", href: "/b", label: "B", x: 0.9, y: 0.9 },
  ];
  const d = parseDesk(stored([{ id: "b", x: 0.5, y: 0.5, rot: 0, z: 0 }, { id: "notes", x: 0, y: 0, rot: 0, z: 1 }]), registry);
  assert.deepEqual(ids(d), ["a", "b"]);
  assert.deepEqual(byZ(d), ["b", "a"]);
  assert.deepEqual(parseDesk(null, registry), defaultLayout(registry));
});
