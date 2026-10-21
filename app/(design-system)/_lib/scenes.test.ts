// The board's drawing fits a phone: for the start board, every board one turn
// away from it, every dress, the system-off board and every mix of the pots
// that move or letter the parts, each part (with its wobble) and each word
// sits inside the 480-wide frame with a 2-unit margin, no two parts overlap,
// every word sits inside its own part, and every letter is 17 or more (12 px
// or more at 358 CSS px). A part moves only with the gaps and swaps its stamp
// only with its corner.
import assert from "node:assert/strict";
import { test } from "node:test";
import { CORNERS, DEFAULT, DRIFT, FACES, GAPS, KNOBS, PARTS, SIZES, turn, values, type Board, type Knob, type Turn } from "./board.ts";
import { labelBox, SMALL, STAMP_SIZE, stampBounds, stampId, WIDTH } from "./paper.ts";
import { HEIGHT, MAX_GAP, ROWS, scene, WORDS, wordOf, type Scene } from "./scenes.ts";
import { DRESSES } from "./siblings.ts";

const MARGIN = 2;
const WOBBLE = 4;
const PHONE_WIDTH = 358;
const MIN_PX = 12;

type Box = [number, number, number, number];

const show = ([l, t, r, b]: Box) => `${l.toFixed(1)},${t.toFixed(1)} to ${r.toFixed(1)},${b.toFixed(1)}`;
const inside = ([l, t, r, b]: Box, [L, T, R, B]: Box) => l >= L && t >= T && r <= R && b <= B;
const overlap = (a: Box, b: Box) => a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];

/** Everything wrong with a scene, as sentences; [] when it is clean. */
function problems(s: Scene): string[] {
  const out: string[] = [];
  if (s.width !== WIDTH) out.push(`${s.width} wide`);
  const frame: Box = [MARGIN, MARGIN, s.width - MARGIN, s.height - MARGIN];
  if (s.parts.map((p) => p.part).join() !== PARTS.join()) out.push(`parts ${s.parts.map((p) => p.part).join()}`);
  const boxes: [string, Box][] = [];
  for (const p of s.parts) {
    const [l, t, r, b] = stampBounds(p.part);
    const box: Box = [p.x + l, p.y + t, p.x + r, p.y + b];
    const inked: Box = [box[0] - WOBBLE, box[1] - WOBBLE, box[2] + WOBBLE, box[3] + WOBBLE];
    if (!inside(inked, frame)) out.push(`${p.part} at ${show(inked)}`);
    for (const [other, o] of boxes) if (overlap(box, o)) out.push(`${p.part} overlaps ${other}`);
    boxes.push([p.part, box]);
    const word = labelBox(wordOf(p));
    if (!inside(word, box)) out.push(`${p.part}'s word at ${show(word)} leaves ${show(box)}`);
  }
  if (s.labels.length !== PARTS.length) out.push(`${s.labels.length} labels`);
  for (const l of s.labels) {
    if (!inside(labelBox(l), frame)) out.push(`label ${l.text} at ${show(labelBox(l))}`);
    if (l.size < SMALL || (l.size * PHONE_WIDTH) / WIDTH < MIN_PX) out.push(`label ${l.text} is size ${l.size}`);
    if (!l.text.trim()) out.push("an empty label");
  }
  return out;
}

// Every board one turn from the start: each knob to each of its presets, the
// switch both ways, each dress, and reset.
const turns: Turn[] = [
  ...(Object.keys(KNOBS) as Knob[]).flatMap((knob) => Object.keys(KNOBS[knob]).map((to) => ({ knob, to }))),
  { knob: "system", to: false },
  { knob: "system", to: true },
  ...DRESSES.map((d) => ({ knob: "dress" as const, to: d.group })),
  { knob: "reset" },
];
const name = (t: Turn) => ("to" in t ? `${t.knob} ${t.to}` : t.knob);

const off: Board = { ...DEFAULT, system: false };

test("the start board fits", () => {
  assert.deepEqual(problems(scene(DEFAULT)), []);
});

for (const t of turns) {
  test(`one turn from the start, ${name(t)}: in frame, no overlaps, letters ${SMALL} or more`, () => {
    assert.deepEqual(problems(scene(turn(DEFAULT, t).board)), []);
  });
}

for (const d of DRESSES) {
  test(`dressed as ${d.dress.name}, with the system on and off`, () => {
    assert.deepEqual(problems(scene(turn(DEFAULT, { knob: "dress", to: d.group }).board)), []);
    assert.deepEqual(problems(scene(turn(off, { knob: "dress", to: d.group }).board)), []);
  });
}

test("the system-off board fits, and places every part from DRIFT", () => {
  const s = scene(off);
  assert.deepEqual(problems(s), []);
  for (const p of s.parts) {
    const v = DRIFT[p.part];
    assert.equal(p.stamp, stampId(p.part, v.corner), p.part);
    assert.equal(p.accent, v.spot, p.part);
    assert.equal(p.stroke, v.ink, p.part);
    assert.equal(p.label.size, v.size, p.part);
    assert.equal(p.label.face, v.face, p.part);
    assert.equal(p.speed, v.speed, p.part);
  }
  assert.ok(new Set(s.parts.map((p) => p.accent)).size >= 3, "nothing matches");
  for (const t of turns.filter((t) => "to" in t && t.knob !== "system" && t.knob !== "dress")) {
    assert.deepEqual(scene(turn(off, t).board), s, `${name(t)} moves nothing with the system off`);
  }
});

test(`every mix of gap, size, corner and face fits (${Object.keys(GAPS).length * Object.keys(SIZES).length * CORNERS.length * FACES.length} boards)`, () => {
  for (const gap of Object.values(GAPS))
    for (const size of Object.values(SIZES))
      for (const corner of CORNERS)
        for (const face of FACES) {
          const b: Board = { ...DEFAULT, pots: { ...DEFAULT.pots, gap, size, corner, face } };
          assert.deepEqual(problems(scene(b)), [], `gap ${gap} size ${size} ${corner} ${face}`);
        }
});

const where = (s: Scene) => s.parts.map((p) => [p.part, p.x, p.y]);
const withPots = (pots: Partial<Board["pots"]>): Board => ({ ...DEFAULT, pots: { ...DEFAULT.pots, ...pots } });

test("the three corners place every part identically and swap only the stamp", () => {
  const [sharp, soft, round] = CORNERS.map((corner) => scene(withPots({ corner })));
  assert.deepEqual(where(sharp), where(soft));
  assert.deepEqual(where(soft), where(round));
  for (const [s, corner] of [[sharp, "sharp"], [soft, "soft"], [round, "round"]] as const) {
    assert.deepEqual(s.parts.map((p) => p.stamp), PARTS.map((p) => `part-${p}-${corner}`));
    assert.deepEqual({ ...s, parts: s.parts.map((p) => ({ ...p, stamp: "" })) }, { ...sharp, parts: sharp.parts.map((p) => ({ ...p, stamp: "" })) });
  }
});

test("the three gaps change the positions; paper, spot, size, speed and face do not", () => {
  const [tight, even, airy] = Object.values(GAPS).map((gap) => where(scene(withPots({ gap }))));
  assert.notDeepEqual(tight, even);
  assert.notDeepEqual(even, airy);
  for (const k of ["paper", "spot", "size", "speed", "face"] as const) {
    for (const to of Object.keys(KNOBS[k])) assert.deepEqual(where(scene(turn(DEFAULT, { knob: k, to }).board)), even, `${k} ${to}`);
  }
  // a wider gap moves every part down or right, never up or left
  const gapAt = (gap: number) => scene(withPots({ gap })).parts;
  const a = gapAt(GAPS.tight);
  const b = gapAt(GAPS.airy);
  a.forEach((p, i) => assert.ok(b[i].x >= p.x && b[i].y > p.y, p.part));
});

test("each part draws with every pot: paper or spot fill, ink outline, spot accent, its size, face and speed", () => {
  const b = withPots({ paper: "#ffffff", spot: "#ef6a4c", size: 21, face: "monospace", speed: 0 });
  const v = values(b);
  for (const p of scene(b).parts) {
    assert.equal(p.fill, p.part === "button" ? v[p.part].spot : v[p.part].paper, p.part);
    assert.equal(p.stroke, v[p.part].ink);
    assert.equal(p.accent, "#ef6a4c");
    assert.deepEqual(p.label, { text: WORDS[p.part], size: 21, face: "monospace" });
    assert.equal(p.speed, 0);
  }
  assert.equal(scene(b).paper, "#ffffff");
  assert.equal(scene(off).paper, "#f6f3ea", "the no-system screen stays cream");
});

test("the rows hold all nine parts once; the height is the widest gap's, whatever the board", () => {
  assert.deepEqual(ROWS.flat().slice().sort(), [...PARTS].sort());
  assert.equal(MAX_GAP, 20);
  for (const t of turns) assert.equal(scene(turn(DEFAULT, t).board).height, HEIGHT, name(t));
  assert.equal(scene(off).height, HEIGHT);
  const airy = scene(withPots({ gap: GAPS.airy }));
  const bottom = Math.max(...airy.parts.map((p) => p.y + STAMP_SIZE[p.part].h / 2));
  assert.ok(HEIGHT - bottom >= WOBBLE + MARGIN, `${HEIGHT - bottom} below the last part`);
});

test("scene is pure: the same board twice, and the board untouched", () => {
  const b = structuredClone(DEFAULT);
  assert.deepEqual(scene(b), scene(b));
  assert.deepEqual(b, DEFAULT);
});
