// The infographics are data, so their brief is checked here: one per article,
// every ink point and label inside the frame with a 2-unit margin (as
// Capsule's art.test.ts checks its cards), labels legible on a 390 px phone,
// at most 14 of them, one spot-red subject, every fact drawn or excused, and
// the same drawing every time.
import assert from "node:assert/strict";
import { test } from "node:test";
import { ARTICLES } from "./articles.ts";
import { FIGURES, UNDRAWN, type Figure, type Label } from "./figures/index.ts";

const MARGIN = 2;
// 390 px less two 16 px gutters
const PHONE_WIDTH = 358;
const MIN_PX = 12;
const MAX_LABELS = 14;
// A generous average glyph width for a serif text face, in ems.
const EM_PER_CHAR = 0.52;

// How many numbers each command takes, and which of them are x (0) or y (1).
const AXES: Record<string, number[]> = {
  M: [0, 1],
  L: [0, 1],
  T: [0, 1],
  H: [0],
  V: [1],
  C: [0, 1, 0, 1, 0, 1],
  S: [0, 1, 0, 1],
  Q: [0, 1, 0, 1],
  Z: [],
};

// Every absolute point in d as [axis, value]; throws on anything it cannot place.
function coordinates(d: string): [number, number][] {
  const tokens = d.match(/[A-Za-z]|-?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g) ?? [];
  const out: [number, number][] = [];
  let axes: number[] | null = null;
  let i = 0;
  for (const t of tokens) {
    if (/^[A-Za-z]$/.test(t)) {
      axes = AXES[t] ?? null;
      if (!axes) throw new Error(`command ${t} is not one of M L H V C S Q T Z`);
      i = 0;
      continue;
    }
    if (!axes || axes.length === 0) throw new Error(`stray number ${t}`);
    out.push([axes[i % axes.length], Number(t)]);
    i++;
  }
  return out;
}

function outside(fig: Figure): string[] {
  const [w, h] = fig.viewBox;
  const problems: string[] = [];
  for (const [kind, paths] of [["ink", fig.paths], ["spot", fig.spot]] as const) {
    paths.forEach((p, n) => {
      for (const [axis, v] of coordinates(p.d)) {
        const max = axis === 0 ? w : h;
        if (!(v >= MARGIN && v <= max - MARGIN)) problems.push(`${kind} path ${n}: ${axis === 0 ? "x" : "y"}=${v}`);
      }
    });
  }
  return problems;
}

// The label's left and right edges, estimated from its length.
function extent(l: Label): [number, number] {
  const width = l.text.length * l.size * EM_PER_CHAR;
  if (l.anchor === "middle") return [l.x - width / 2, l.x + width / 2];
  if (l.anchor === "end") return [l.x - width, l.x];
  return [l.x, l.x + width];
}

for (const a of ARTICLES) {
  test(`${a.slug} has a figure, drawn the same every time`, () => {
    const draw = FIGURES[a.slug];
    assert.equal(typeof draw, "function");
    assert.deepEqual(draw(a), draw(a));
  });

  const fig = FIGURES[a.slug]?.(a);
  if (!fig) continue;
  const [w, h] = fig.viewBox;

  test(`${a.slug}: every point and label stays inside its ${w}×${h} frame`, () => {
    assert.ok(fig.paths.length > 0);
    assert.deepEqual(outside(fig), []);
    for (const l of fig.labels) {
      assert.ok(l.x >= MARGIN && l.x <= w - MARGIN && l.y >= MARGIN && l.y <= h - MARGIN, `${l.text} at ${l.x},${l.y}`);
      // the cap height sits above the baseline, so the top of the text is inside too
      assert.ok(l.y - l.size * 0.75 >= 0, `${l.text} is cut off at the top`);
      const [left, right] = extent(l);
      assert.ok(left >= 0 && right <= w, `${l.text} runs from ${left.toFixed(0)} to ${right.toFixed(0)}`);
    }
  });

  test(`${a.slug}: at most ${MAX_LABELS} labels, each ≥ ${MIN_PX} px at ${PHONE_WIDTH} px wide`, () => {
    assert.ok(fig.labels.length > 0 && fig.labels.length <= MAX_LABELS, `${fig.labels.length} labels`);
    for (const l of fig.labels) {
      assert.ok((l.size * PHONE_WIDTH) / w >= MIN_PX, `${l.text}: ${((l.size * PHONE_WIDTH) / w).toFixed(1)} px`);
      assert.ok(l.text.trim().length > 0);
    }
  });

  test(`${a.slug}: the subject is in spot red`, () => {
    assert.ok(fig.spot.length > 0 || fig.labels.some((l) => l.spot));
  });

  test(`${a.slug}: every fact is drawn, or UNDRAWN says why`, () => {
    const excused = UNDRAWN[a.slug] ?? {};
    for (const f of a.facts) {
      const drawn = fig.labels.some((l) => l.text.includes(f.value));
      if (f.id in excused) {
        assert.ok(!drawn, `${f.id} is drawn, so drop it from UNDRAWN`);
        assert.ok(excused[f.id].length > 10, `${f.id} needs a reason`);
      } else {
        assert.ok(drawn, `${f.id} (${f.value}) is in no label`);
      }
    }
    for (const id of Object.keys(excused)) assert.ok(a.facts.some((f) => f.id === id), `UNDRAWN names ${id}, not a fact`);
  });
}

test("every figure belongs to an article", () => {
  assert.deepEqual(Object.keys(FIGURES).sort(), ARTICLES.map((a) => a.slug).sort());
  for (const slug of Object.keys(UNDRAWN)) assert.ok(slug in FIGURES, slug);
});

test("the coordinate reader places what it should", () => {
  assert.deepEqual(coordinates("M1 2 L3 4"), [[0, 1], [1, 2], [0, 3], [1, 4]]);
  assert.deepEqual(coordinates("M0 0 C1 2 3 4 5 6 Z").length, 8);
  assert.deepEqual(coordinates("M5 5 H9 V7"), [[0, 5], [1, 5], [0, 9], [1, 7]]);
  assert.throws(() => coordinates("M0 0 A5 5 0 0 1 9 9"));
  const frame: Figure = { viewBox: [100, 100], paths: [{ d: "M1 50 L50 50", stroke: "#000", strokeWidth: 1 }], spot: [], labels: [] };
  assert.deepEqual(outside(frame), ["ink path 0: x=1"]);
  assert.deepEqual(extent({ x: 100, y: 10, text: "abcd", size: 10, anchor: "middle" }), [100 - 10.4, 100 + 10.4]);
});
