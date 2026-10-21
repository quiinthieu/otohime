// The stamp kit: nine parts, three corners each, every one drawn about its
// own origin inside its size (plus 4 for the wobble), each with an outline
// and a spot accent; a part's three differ only in the corner radius; and the
// same every call, so the server's props never change between renders.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import { CORNERS, PARTS } from "./board.ts";
import { pathCoordinates } from "./paper.ts";
import { boxPath, CORNER_RADIUS, inkStamps, radiusOf, STAMP_IDS, STAMP_SIZE, stampBounds, stampId } from "./stamps.ts";

const WOBBLE = 4;

// A changed value means the kit was redrawn. Update it only on purpose.
const KIT_SHA256 = "7bf3396916bc1aaaa48fdc8d9f950a2a87ba19e2b86b00f19186c25c40e6b5fc";

const stamps = inkStamps();

test(`${PARTS.length * CORNERS.length} stamps: ${PARTS.length} parts by ${CORNERS.length} corners, ids part-<part>-<corner>, unique`, () => {
  assert.equal(stamps.length, 27);
  assert.deepEqual(
    stamps.map((s) => s.id),
    PARTS.flatMap((p) => CORNERS.map((c) => `part-${p}-${c}`)),
  );
  assert.deepEqual(stamps.map((s) => s.id), STAMP_IDS);
  assert.equal(new Set(stamps.map((s) => s.id)).size, 27);
  for (const s of stamps) assert.equal(s.id, stampId(s.part, s.corner));
});

for (const s of stamps) {
  test(`${s.id}: an outline and an accent, every point within its size + ${WOBBLE}, about its own origin`, () => {
    assert.ok(s.outline.length > 0, "an outline");
    assert.ok(s.accent.length > 0, "an accent");
    const [left, top, right, bottom] = stampBounds(s.part);
    assert.equal(left, -right);
    assert.equal(top, -bottom);
    for (const d of [...s.outline, ...s.accent]) {
      assert.match(d, /^M/);
      assert.doesNotMatch(d, /NaN|undefined|Infinity/);
      for (const [axis, v] of pathCoordinates(d)) {
        const [lo, hi] = axis === 0 ? [left, right] : [top, bottom];
        assert.ok(v >= lo - WOBBLE && v <= hi + WOBBLE, `${axis === 0 ? "x" : "y"}=${v} outside ${lo}..${hi}`);
      }
    }
  });
}

test("a part's three stamps differ only in the corner: the same details and accent, a different body", () => {
  for (const part of PARTS) {
    const [sharp, soft, round] = CORNERS.map((c) => stamps.find((s) => s.part === part && s.corner === c)!);
    for (const other of [soft, round]) {
      assert.deepEqual(other.accent, sharp.accent, `${part}: the accent`);
      assert.equal(other.outline.length, sharp.outline.length, `${part}: the outline's paths`);
      assert.deepEqual(other.outline.slice(1), sharp.outline.slice(1), `${part}: the ink details`);
    }
    assert.notEqual(sharp.outline[0], soft.outline[0], `${part}: sharp and soft bodies`);
    assert.notEqual(soft.outline[0], round.outline[0], `${part}: soft and round bodies`);
  }
});

test("the corner radii: sharp 0, soft 6, round as round as the part allows", () => {
  assert.deepEqual(CORNER_RADIUS, { sharp: 0, soft: 6, round: 18 });
  for (const part of PARTS) {
    assert.equal(radiusOf(part, "sharp"), 0);
    assert.ok(radiusOf(part, "soft") < radiusOf(part, "round"), part);
    assert.ok(radiusOf(part, "round") <= STAMP_SIZE[part].h / 2, part);
  }
  assert.equal(radiusOf("switch", "round"), 16, "a pill");
});

test("boxPath: square corners with no curve, round ones with a curve each, a pill with no zero-length side", () => {
  assert.equal(boxPath(40, 20, 0), "M-20 -10 L20 -10 L20 10 L-20 10 Z");
  assert.equal(boxPath(40, 20, 4).match(/Q/g)?.length, 4);
  const pill = boxPath(40, 20, 10);
  assert.equal(pill.match(/L/g)?.length, 2, pill);
  for (const d of [boxPath(40, 20, 0), boxPath(40, 20, 4), pill]) {
    for (const [axis, v] of pathCoordinates(d)) assert.ok(Math.abs(v) <= (axis === 0 ? 20 : 10), d);
  }
});

test("the same output on two calls, pinned", () => {
  assert.deepEqual(inkStamps(), inkStamps());
  assert.equal(createHash("sha256").update(JSON.stringify(stamps)).digest("hex"), KIT_SHA256);
});
