import assert from "node:assert/strict";
import { test } from "node:test";
import {
  BOIL_HZ,
  boilOwner,
  boilStep,
  FRAMES_PER_BOIL,
  HANDS,
  INK,
  ink,
  inkFilter,
  isHand,
  MATERIALS,
  reroll,
  SEEDS,
  wrapSeed,
  type Hand,
  type InkState,
  type Primitive,
} from "./ink-modes.ts";

// The filter Inked drew before there were hands, attribute for attribute.
const HOUSE: Primitive[] = [
  { tag: "feTurbulence", attrs: { type: "turbulence", baseFrequency: 0.035, numOctaves: 2, seed: 3, result: "warp" } },
  {
    tag: "feDisplacementMap",
    attrs: { in: "SourceGraphic", in2: "warp", scale: 3.5, xChannelSelector: "R", yChannelSelector: "G", result: "inked" },
  },
  { tag: "feTurbulence", attrs: { type: "fractalNoise", baseFrequency: 0.85, numOctaves: 1, seed: 8, result: "noise" } },
  {
    tag: "feColorMatrix",
    attrs: { in: "noise", type: "matrix", values: "0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1.6 0 0 0 -0.82", result: "specks" },
  },
  { tag: "feComposite", attrs: { in: "specks", in2: "inked", operator: "in", result: "grain" } },
  { tag: "feMerge", nodes: ["inked", "grain"] },
];

test("the default hand is the house filter, exactly", () => {
  assert.deepEqual(inkFilter(), HOUSE);
  assert.deepEqual(inkFilter("ink", 0, 3.5), HOUSE);
  assert.equal(MATERIALS.ink.stroke, 2.4);
});

test("ink passes the wobble slider straight through", () => {
  for (const w of [0, 0.1, 2.3, 7]) {
    const d = inkFilter("ink", 0, w)[1];
    assert.equal(d.tag === "feDisplacementMap" && d.attrs.scale, w);
  }
});

test("four hands, each its own filter", () => {
  assert.deepEqual([...HANDS], ["ink", "pencil", "crayon", "watercolour"]);
  const shapes = HANDS.map((h) => JSON.stringify(inkFilter(h)));
  assert.equal(new Set(shapes).size, 4);
  // and they differ in kind, not only in a number
  assert.equal(new Set(HANDS.map((h) => MATERIALS[h].stroke)).size, 4);
  assert.ok(!MATERIALS.ink.tooth && !MATERIALS.ink.wash);
  assert.ok(MATERIALS.pencil.tooth && MATERIALS.crayon.tooth);
  assert.ok(MATERIALS.watercolour.wash);
  assert.ok(MATERIALS.pencil.stroke < MATERIALS.ink.stroke && MATERIALS.crayon.stroke > MATERIALS.ink.stroke);
});

test("material parameters stay in bounds", () => {
  for (const h of HANDS) {
    const m = MATERIALS[h];
    assert.ok(m.stroke >= 1.2 && m.stroke <= 4.8, `${h} stroke ${m.stroke}`);
    assert.ok(m.warp.frequency > 0 && m.warp.frequency <= 0.2, `${h} warp frequency`);
    assert.ok(m.warp.octaves >= 1 && m.warp.octaves <= 3, `${h} warp octaves`);
    assert.ok(m.warp.scale > 0 && m.warp.scale <= 1.5, `${h} warp scale`);
    assert.ok(m.grain.frequency > 0 && m.grain.frequency <= 2, `${h} grain frequency`);
    assert.ok(m.grain.octaves >= 1 && m.grain.octaves <= 3, `${h} grain octaves`);
    // grain stays specks: most of the noise range gives no speck
    assert.ok(m.grain.slope * 0.5 + m.grain.intercept <= 0.05, `${h} grain covers too much`);
    if (m.tooth) assert.ok(m.tooth.floor >= 0.3 && m.tooth.floor < 1, `${h} tooth floor ${m.tooth.floor}`);
    if (m.wash) {
      assert.ok(m.wash.blur > 0 && m.wash.blur <= 4, `${h} wash blur`);
      assert.ok(m.wash.spread <= 16 && m.wash.opacity <= 0.6, `${h} wash`);
    }
    const prims = inkFilter(h, 0, 7);
    assert.ok(prims.length <= 14, `${h} has ${prims.length} primitives`);
    // the most the line work can stray, at the slider's top
    const d = prims[1];
    assert.ok(d.tag === "feDisplacementMap" && Number(d.attrs.scale) <= 7 * 1.5, h);
  }
});

test("lines are never blurred: only the wash under them is", () => {
  for (const h of HANDS) {
    const prims = inkFilter(h, 4, 3.5);
    for (const p of prims) {
      if (p.tag === "feGaussianBlur") assert.equal(p.attrs.in, "spread", h);
    }
    const merge = prims.at(-1);
    assert.ok(merge?.tag === "feMerge");
    // the line work is merged after (over) any wash
    const nodes = merge.nodes;
    if (nodes.includes("wash")) assert.equal(nodes[0], "wash");
    assert.ok(nodes.includes("inked") || nodes.includes("bitten"), h);
    assert.equal(nodes.at(-1), "grain");
  }
});

test("every primitive input is produced earlier, and names are unique", () => {
  for (const h of HANDS) {
    const seen = new Set(["SourceGraphic"]);
    for (const p of inkFilter(h, 7, 3.5)) {
      const inputs = p.tag === "feMerge" ? p.nodes : [p.attrs.in, p.attrs.in2].filter((x) => x !== undefined);
      for (const i of inputs) assert.ok(seen.has(String(i)), `${h}: ${p.tag} reads ${i} before it exists`);
      if (p.tag !== "feMerge") {
        const r = String(p.attrs.result);
        assert.ok(!seen.has(r), `${h}: ${r} twice`);
        seen.add(r);
      }
    }
  }
});

test("a seed moves every turbulence seed and nothing else", () => {
  for (const h of HANDS) {
    const a = inkFilter(h, 0);
    const b = inkFilter(h, 12);
    assert.equal(a.length, b.length);
    a.forEach((p, i) => {
      const q = b[i];
      if (p.tag === "feTurbulence" && q.tag === "feTurbulence") {
        assert.equal(Number(q.attrs.seed) - Number(p.attrs.seed), 12, h);
        assert.deepEqual({ ...p.attrs, seed: 0 }, { ...q.attrs, seed: 0 });
      } else assert.deepEqual(p, q);
    });
  }
});

test("seeds wrap round a small ring", () => {
  assert.equal(wrapSeed(0), 0);
  assert.equal(wrapSeed(SEEDS), 0);
  assert.equal(wrapSeed(-1), SEEDS - 1);
  assert.equal(wrapSeed(3.7), 3);
  const seen = new Set<number>();
  let s = 0;
  for (let i = 0; i < SEEDS * 3; i++) {
    s = boilStep(s);
    assert.ok(s >= 0 && s < SEEDS);
    seen.add(s);
  }
  assert.equal(seen.size, SEEDS);
  for (let i = 0; i < SEEDS; i++) {
    assert.notEqual(reroll(i), i);
    assert.ok(reroll(i) >= 0 && reroll(i) < SEEDS);
  }
});

test("re-roll changes the seed and keeps the hand", () => {
  const s: InkState = { hand: "crayon", seed: 5, beat: 1 };
  const r = ink(s, "reroll");
  assert.equal(r.hand, "crayon");
  assert.notEqual(r.seed, s.seed);
  assert.equal(r.beat, 0);
});

test("a boil changes the seed six times a second on the 12 fps clock", () => {
  assert.equal(BOIL_HZ, 6);
  assert.equal(FRAMES_PER_BOIL, 2);
  let s = INK;
  let changes = 0;
  for (let frame = 0; frame < 12; frame++) {
    const next = ink(s, "tick");
    if (next.seed !== s.seed) changes++;
    s = next;
  }
  assert.equal(changes, 6);
  assert.equal(s.hand, "ink");
});

test("picking a hand keeps the seed; unknown hands are ignored", () => {
  const s: InkState = { hand: "ink", seed: 9, beat: 0 };
  assert.deepEqual(ink(s, { type: "hand", hand: "watercolour" }), { hand: "watercolour", seed: 9, beat: 0 });
  assert.equal(ink(s, { type: "hand", hand: "ink" }), s);
  assert.equal(ink(s, { type: "hand", hand: "charcoal" as Hand }), s);
  assert.ok(isHand("pencil"));
  assert.ok(!isHand("charcoal") && !isHand(undefined));
});

test("the reducer never mutates its input", () => {
  const s = Object.freeze({ hand: "pencil", seed: 3, beat: 1 }) as InkState;
  ink(s, "tick");
  ink(s, "reroll");
  ink(s, { type: "hand", hand: "crayon" });
  assert.deepEqual(s, { hand: "pencil", seed: 3, beat: 1 });
});

test("one figure boils at a time", () => {
  const o = boilOwner();
  let calls = 0;
  const off = o.subscribe(() => calls++);
  assert.equal(o.get(), null);
  o.toggle("a");
  assert.equal(o.get(), "a");
  o.claim("b");
  assert.equal(o.get(), "b");
  // a figure that no longer boils can't stop another's
  o.release("a");
  assert.equal(o.get(), "b");
  o.toggle("b");
  assert.equal(o.get(), null);
  assert.equal(calls, 3);
  o.release("b");
  assert.equal(calls, 3);
  off();
  o.claim("c");
  assert.equal(calls, 3);
});
