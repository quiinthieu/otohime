// The stamp kit: eight kinds, three seeds each, every one drawn about its own
// origin inside its size (plus 4 for the wobble), and the same every call, so
// the server's props never change between renders.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import { pathCoordinates } from "./paper.ts";
import { inkStamps, STAMP_KINDS, STAMP_SIZE, stampBounds, stampId } from "./stamps.ts";

const WOBBLE = 4;

// A changed value means the kit was redrawn. Update it only on purpose.
const KIT_SHA256 = "e9981b5d72898364c9e46b6a6b56fbb0ccd7e891dd3ea54f92f26f70798e5a5d";

const stamps = inkStamps();

test("24 stamps: eight kinds, three seeds each, ids unique", () => {
  assert.equal(stamps.length, 24);
  assert.deepEqual([...STAMP_KINDS], ["box", "plate", "node", "bucket", "tile", "station", "arrow", "hand"]);
  for (const kind of STAMP_KINDS) {
    assert.deepEqual(
      stamps.filter((s) => s.kind === kind).map((s) => s.id),
      [0, 1, 2].map((n) => stampId(kind, n as 0 | 1 | 2)),
      kind,
    );
  }
  assert.equal(new Set(stamps.map((s) => s.id)).size, 24);
});

test("the sizes are the plan's", () => {
  assert.deepEqual(STAMP_SIZE.box, { w: 44, h: 44 });
  assert.deepEqual(STAMP_SIZE.plate, { w: 64, h: 14 });
  assert.equal(STAMP_SIZE.node.r, 20);
  assert.deepEqual(STAMP_SIZE.bucket, { w: 44, h: 30 });
  assert.deepEqual(STAMP_SIZE.tile, { w: 36, h: 36 });
  assert.equal(STAMP_SIZE.station.r, 14);
  assert.equal(STAMP_SIZE.arrow.length, 100);
  assert.ok(STAMP_SIZE.hand.length > 0);
});

for (const s of stamps) {
  test(`${s.id}: every point within its size + ${WOBBLE}, about its own origin`, () => {
    assert.ok(s.paths.length > 0);
    const [left, top, right, bottom] = stampBounds(s.kind);
    for (const d of s.paths) {
      assert.match(d, /^M/);
      assert.doesNotMatch(d, /NaN|undefined|Infinity/);
      for (const [axis, v] of pathCoordinates(d)) {
        const [lo, hi] = axis === 0 ? [left, right] : [top, bottom];
        assert.ok(v >= lo - WOBBLE && v <= hi + WOBBLE, `${axis === 0 ? "x" : "y"}=${v} outside ${lo}..${hi}`);
      }
    }
  });
}

test("a shape is centred on its origin; the arrow starts on it and the hand ends on it", () => {
  for (const kind of ["box", "plate", "node", "bucket", "tile", "station"] as const) {
    const [l, t, r, b] = stampBounds(kind);
    assert.equal(l, -r, kind);
    assert.equal(t, -b, kind);
  }
  assert.equal(stampBounds("arrow")[0], 0);
  assert.equal(stampBounds("arrow")[2], STAMP_SIZE.arrow.length);
  assert.equal(stampBounds("hand")[2], 0);
});

test("the arrow's shaft comes first, its head after", () => {
  for (const s of stamps.filter((x) => x.kind === "arrow")) {
    assert.equal(s.paths.length, 3);
    const xs = pathCoordinates(s.paths[0]).filter(([axis]) => axis === 0).map(([, v]) => v);
    assert.ok(Math.max(...xs) - Math.min(...xs) > 90, "the shaft spans the length");
  }
});

test("the same output on two calls, pinned", () => {
  assert.deepEqual(inkStamps(), inkStamps());
  assert.equal(createHash("sha256").update(JSON.stringify(stamps)).digest("hex"), KIT_SHA256);
});
