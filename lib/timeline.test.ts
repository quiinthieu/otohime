import assert from "node:assert/strict";
import { test } from "node:test";
import { careerArchive, TIMELINE_YEARS, turnYear } from "./timeline.ts";
test("the book labels its nine career chapters and preserves public projects", () => {
  const years = careerArchive([{ title: "Shore", note: "A timer", started: "2026-10-19", href: "/shore" }], [{ what: "Warehouse", tools: "Snowflake", note: "Queries" }]);
  assert.deepEqual(years.map(y => y.year), TIMELINE_YEARS);
  for (const year of years) {
    assert.ok(year.note.length > 0);
    assert.doesNotMatch(year.note, /fictional placeholders/i);
    assert.doesNotMatch(year.note, /draft/i);
    assert.deepEqual(new Set(year.pieces.map(piece => piece.kind)), new Set(["work", "place", "project", "tool"]));
    assert.ok(year.pieces.every(piece => !/draft placeholder/i.test(piece.detail)));
  }
  assert.match(years[0].pieces[0].title, /Data intern/);
  assert.equal(years[8].pieces[0].href, "/shore");
  assert.match(years[8].pieces.at(-1)!.detail, /adoption year is unrecorded/);
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
