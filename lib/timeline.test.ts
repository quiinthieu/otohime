import assert from "node:assert/strict";
import { test } from "node:test";
import { careerArchive, TIMELINE_YEARS, turnYear } from "./timeline.ts";
test("the book covers all nine years without inventing a career", () => {
  const years = careerArchive([{ title: "Shore", note: "A timer", started: "2026-10-19", href: "/shore" }], [{ what: "Warehouse", tools: "Snowflake", note: "Queries" }]);
  assert.deepEqual(years.map(y => y.year), TIMELINE_YEARS);
  assert.equal(years[0].pieces.length, 0);
  assert.match(years[0].note, /No dated career/);
  assert.equal(years[8].pieces[0].href, "/shore");
  assert.match(years[8].pieces[1].detail, /adoption year is unrecorded/);
});
test("page turns and keyboard boundaries clamp to the book", () => {
  assert.equal(turnYear(0, "ArrowLeft"), 0);
  assert.equal(turnYear(8, "ArrowRight"), 8);
  assert.equal(turnYear(4, "Home"), 0);
  assert.equal(turnYear(4, "End"), 8);
  assert.equal(turnYear(4, "PageDown"), 5);
  assert.equal(turnYear(4, "PageUp"), 3);
  assert.equal(turnYear(4, "x"), 4);
});
