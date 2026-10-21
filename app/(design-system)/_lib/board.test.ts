// The board, checked: one count of each thing; every knob moves all nine
// parts with the system on and none with it off ("9 to fix by hand"); the
// switch, the dresses and reset say what the plan says; turn() is pure.
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  type Board,
  CORNERS,
  DEFAULT,
  describe,
  DRIFT,
  FACES,
  GAPS,
  type Knob,
  KNOBS,
  PAPERS,
  PARTS,
  PATTERNS,
  POTS,
  SIZES,
  SPEEDS,
  SPOTS,
  turn,
  type Turn,
  values,
} from "./board.ts";
import { cornerFor, DRESSES } from "./siblings.ts";

const OFF: Board = turn(DEFAULT, { knob: "system", to: false }).board;

// Every knob and every preset that differs from the default's.
const DEFAULT_PRESET: Record<Knob, string> = { paper: "cream", spot: "blue", corner: "soft", gap: "even", size: "small", speed: "quick", face: "cursive" };
const KNOB_TURNS: { knob: Knob; to: string }[] = (Object.keys(KNOBS) as Knob[]).flatMap((knob) =>
  Object.keys(KNOBS[knob])
    .filter((to) => to !== DEFAULT_PRESET[knob])
    .map((to) => ({ knob, to })),
);

test("one count of each thing: 8 pots, 9 parts, 3 patterns", () => {
  assert.equal(POTS.length, 8);
  assert.deepEqual([...POTS].sort(), Object.keys(DEFAULT.pots).sort());
  assert.equal(PARTS.length, 9);
  assert.deepEqual([...PARTS], ["card", "bar", "field", "ring", "button", "ghost", "tag", "note", "switch"]);
  assert.equal(PATTERNS.length, 3);
  assert.deepEqual([...PATTERNS], ["form", "list", "dialog"]);
});

test("the presets are the plan's", () => {
  assert.deepEqual(PAPERS, {
    cream: { paper: "#f6f3ea", ink: "#1d1b17" },
    white: { paper: "#ffffff", ink: "#1d1b17" },
    night: { paper: "#161513", ink: "#ebe5d6" },
  });
  assert.deepEqual(SPOTS, { blue: "#2456b3", coral: "#ef6a4c", mint: "#93d3b0", yellow: "#f4b829", pink: "#f3a6bb", shade: "#3f4e93" });
  assert.deepEqual([...CORNERS], ["sharp", "soft", "round"]);
  assert.deepEqual(GAPS, { tight: 8, even: 14, airy: 20 });
  assert.deepEqual(SIZES, { small: 17, large: 21 });
  assert.deepEqual(SPEEDS, { still: 0, quick: 150 });
  assert.deepEqual([...FACES], ["cursive", "serif", "sans-serif", "monospace"]);
  assert.equal(KNOB_TURNS.length, 2 + 5 + 2 + 2 + 1 + 1 + 3);
});

test("DEFAULT is cream, blue, soft, even, small, quick, cursive, with the system on", () => {
  assert.deepEqual(DEFAULT, {
    pots: { paper: "#f6f3ea", ink: "#1d1b17", spot: "#2456b3", corner: "soft", gap: 14, size: 17, speed: 150, face: "cursive" },
    system: true,
  });
});

for (const t of KNOB_TURNS) {
  test(`${t.knob} ${t.to}, system on: 1 knob turned, all 9 parts followed`, () => {
    const r = turn(DEFAULT, t);
    assert.deepEqual(r.followed, [...PARTS]);
    assert.deepEqual(r.hot, [...PARTS]);
    assert.equal(r.say, "1 knob turned. 9 parts followed.");
    assert.equal(r.say, `1 knob turned. ${PARTS.length} parts followed.`);
    const before = values(DEFAULT);
    const after = values(r.board);
    for (const p of PARTS) {
      assert.notDeepEqual(after[p], before[p], `${p} did not move`);
      assert.deepEqual(after[p], r.board.pots, `${p} draws from the pots`);
    }
  });

  test(`${t.knob} ${t.to}, system off: 0 parts followed, 9 to fix by hand`, () => {
    const r = turn(OFF, t);
    assert.deepEqual(r.followed, []);
    assert.deepEqual(r.hot, []);
    assert.equal(r.say, "1 knob turned. 0 parts followed. 9 to fix by hand.");
    assert.deepEqual(values(r.board), DRIFT);
    assert.notDeepEqual(r.board.pots, OFF.pots, "the knob still moves the pot");
  });
}

test("Paper night sets its partner ink", () => {
  assert.equal(turn(DEFAULT, { knob: "paper", to: "night" }).board.pots.ink, "#ebe5d6");
  assert.equal(turn(DEFAULT, { knob: "paper", to: "white" }).board.pots.ink, "#1d1b17");
});

test("the switch: off keeps every part's own values, on follows the pots again", () => {
  const off = turn(DEFAULT, { knob: "system", to: false });
  assert.equal(off.say, "System off: every part keeps its own values.");
  assert.deepEqual(off.followed, []);
  assert.deepEqual(values(off.board), DRIFT);
  const on = turn(off.board, { knob: "system", to: true });
  assert.equal(on.say, "System on: 9 parts follow the pots again.");
  assert.deepEqual(on.followed, [...PARTS]);
  assert.deepEqual(on.board, DEFAULT);
});

for (const d of DRESSES) {
  test(`dress ${d.group}: sets exactly paper, ink, spot, corner and face to the pins`, () => {
    const r = turn(DEFAULT, { knob: "dress", to: d.group });
    assert.equal(r.say, `Dressed as ${d.dress.name}: 9 parts followed.`);
    assert.deepEqual(r.followed, [...PARTS]);
    assert.equal(r.board.dress, d.group);
    assert.deepEqual(r.board.pots, {
      ...DEFAULT.pots,
      paper: d.paper,
      ink: d.ink,
      spot: d.dress.spot,
      corner: cornerFor(d.dress.radius),
      face: d.dress.face,
    });
    const off = turn(OFF, { knob: "dress", to: d.group });
    assert.equal(off.say, `Dressed as ${d.dress.name}: 0 parts followed. 9 to fix by hand.`);
    assert.deepEqual(values(off.board), DRIFT);
  });
}

test("reset returns DEFAULT from anywhere", () => {
  let b = DEFAULT;
  for (const t of [{ knob: "spot", to: "coral" }, { knob: "dress", to: "orrery" }, { knob: "system", to: false }] as Turn[]) b = turn(b, t).board;
  const r = turn(b, { knob: "reset" });
  assert.deepEqual(r.board, DEFAULT);
  assert.equal(r.say, "Back to the start.");
  assert.deepEqual(r.followed, [...PARTS]);
});

test("an unknown preset or sister throws", () => {
  assert.throws(() => turn(DEFAULT, { knob: "spot", to: "teal" }), /no spot preset named teal/);
  assert.throws(() => turn(DEFAULT, { knob: "paper", to: "blue" }));
  assert.throws(() => turn(DEFAULT, { knob: "dress", to: "vinyl" }), /no dress/);
  assert.throws(() => turn(DEFAULT, { knob: "dress", to: "nope" }));
});

test("describe names the paper, the spot, the corner and the gap, or says no system", () => {
  const d = describe(DEFAULT);
  for (const word of ["cream", "blue", "soft", "even"]) assert.match(d, new RegExp(`\\b${word}\\b`), d);
  const coral = describe(turn(DEFAULT, { knob: "spot", to: "coral" }).board);
  assert.match(coral, /\bcoral\b/);
  assert.match(describe(turn(DEFAULT, { knob: "paper", to: "night" }).board), /\bnight\b/);
  assert.match(describe(turn(DEFAULT, { knob: "corner", to: "round" }).board), /\bround\b/);
  assert.match(describe(turn(DEFAULT, { knob: "gap", to: "airy" }).board), /\bairy\b/);
  assert.match(describe(OFF), /no system/);
  const gazette = describe(turn(DEFAULT, { knob: "dress", to: "articles" }).board);
  assert.match(gazette, /Gazette paper/);
  assert.doesNotMatch(gazette, /#/);
});

test("values with the system on never deep-equal DRIFT", () => {
  const boards = [DEFAULT, ...KNOB_TURNS.map((t) => turn(DEFAULT, t).board), ...DRESSES.map((d) => turn(DEFAULT, { knob: "dress", to: d.group }).board)];
  for (const b of boards) assert.notDeepEqual(values(b), DRIFT);
});

test("DRIFT: nothing matches (three blues and a coral, three corners, three gaps), on cream", () => {
  const all = Object.values(DRIFT);
  assert.deepEqual(Object.keys(DRIFT), [...PARTS]);
  const spots = new Set(all.map((v) => v.spot));
  assert.ok(spots.size >= 3, `${spots.size} spots`);
  assert.deepEqual([...spots].sort(), ["#1a3f8a", "#2456b3", "#3b7bd6", "#ef6a4c"]);
  assert.equal(all.filter((v) => v.spot === "#ef6a4c").length, 1, "one stray coral");
  assert.ok(new Set(all.map((v) => v.corner)).size >= 3);
  assert.deepEqual([...new Set(all.map((v) => v.gap))].sort((a, b) => a - b), [8, 12, 20]);
  assert.deepEqual([...new Set(all.map((v) => v.size))].sort((a, b) => a - b), [17, 19, 21]);
  assert.equal(all.filter((v) => v.face === "serif").length, 2);
  for (const v of all) assert.deepEqual([v.paper, v.ink], [PAPERS.cream.paper, PAPERS.cream.ink]);
});

test("turn is pure: its input is the same before and after", () => {
  const boards = [DEFAULT, OFF, turn(DEFAULT, { knob: "dress", to: "shore" }).board];
  const turns: Turn[] = [...KNOB_TURNS, { knob: "system", to: false }, { knob: "system", to: true }, { knob: "dress", to: "capsule" }, { knob: "reset" }];
  for (const b of boards) {
    const copy = structuredClone(b);
    for (const t of turns) {
      const r = turn(b, t);
      assert.deepEqual(b, copy);
      assert.notEqual(r.board, b);
      assert.notEqual(r.board.pots, b.pots);
    }
  }
  const v = values(DEFAULT);
  v.card.spot = "#000000";
  assert.equal(values(DEFAULT).card.spot, "#2456b3", "values hands out copies");
  assert.notEqual(DRIFT.card.spot, "#000000");
});
