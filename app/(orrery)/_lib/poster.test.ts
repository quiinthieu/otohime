import assert from "node:assert/strict";
import { test } from "node:test";
import { lightTime } from "./format.ts";
import { BADGES, CALLOUTS, EARTH_LABEL, FOOTER, LIFE, TAGLINE, TITLE } from "./poster.ts";
import { LAYERS, LIGHT_SECONDS, SOURCES } from "./sun.ts";
import { textWords } from "./words.ts";

test("six callouts, numbered 1 to 6, in layer order", () => {
  assert.equal(CALLOUTS.length, 6);
  assert.deepEqual(
    CALLOUTS.map((c) => c.n),
    [1, 2, 3, 4, 5, 6],
  );
  assert.deepEqual(
    CALLOUTS.map((c) => c.layer),
    LAYERS.map((l) => l.id),
  );
  for (const c of CALLOUTS) assert.ok(c.text.length > 0, c.layer);
});

test("four badges and three life stages", () => {
  assert.equal(BADGES.length, 4);
  assert.deepEqual(
    LIFE.map((s) => s.id),
    ["today", "giant", "dwarf"],
  );
  for (const s of LIFE) assert.ok(s.label.length > 0, s.id);
});

test("every poster item names a known source", () => {
  const keys = Object.keys(SOURCES);
  for (const item of [...CALLOUTS, ...BADGES, ...LIFE]) assert.ok(keys.includes(item.source), JSON.stringify(item));
});

test("the callouts carry the core temperature and the photon's trip", () => {
  const all = CALLOUTS.map((c) => c.text).join(" ");
  assert.ok(all.includes("15.7 million K"));
  assert.ok(all.includes("170,000 years"));
});

test("the badges carry the four headline numbers", () => {
  const big = BADGES.map((b) => b.big);
  assert.ok(big.includes("109"));
  assert.ok(big.includes(lightTime(LIGHT_SECONDS)));
  assert.equal(lightTime(LIGHT_SECONDS), "8 min 19 s");
  assert.ok(big.includes("15.7 million K"));
  assert.ok(big.some((b) => b.startsWith("4.6")));
  for (const b of BADGES) assert.ok(b.small.length > 0, b.big);
});

test("the poster's words fit the budget, leaving room under the cap", () => {
  const text = [
    TITLE,
    TAGLINE,
    ...CALLOUTS.map((c) => `${c.n} ${c.text}`),
    ...LAYERS.map((l) => l.name), // the page may name each layer beside its callout
    ...BADGES.map((b) => `${b.big} ${b.small}`),
    ...LIFE.map((s) => `${s.label} ${s.note ?? ""}`),
    FOOTER,
    EARTH_LABEL,
  ].join(" ");
  const n = textWords(text);
  assert.ok(n <= 170, `${n} words`);
});
