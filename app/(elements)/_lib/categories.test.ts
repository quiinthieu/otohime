import assert from "node:assert/strict";
import { test } from "node:test";
import { CATEGORIES, categoryOf, contrast, PAPER, RAW_CATEGORIES } from "./categories.ts";
import { ELEMENTS } from "./elements.ts";

test("ten legend categories with unique ids and colours", () => {
  assert.equal(CATEGORIES.length, 10);
  assert.equal(new Set(CATEGORIES.map((c) => c.id)).size, 10);
  assert.equal(new Set(CATEGORIES.map((c) => c.light)).size, 10);
  assert.equal(new Set(CATEGORIES.map((c) => c.dark)).size, 10);
});

test("15 raw strings fold into exactly the ten ids", () => {
  assert.equal(Object.keys(RAW_CATEGORIES).length, 15);
  assert.deepEqual(new Set(Object.values(RAW_CATEGORIES)), new Set(CATEGORIES.map((c) => c.id)));
});

test("each colour is at least 3:1 against its own paper", () => {
  for (const c of CATEGORIES) {
    assert.ok(contrast(c.light, PAPER.light) >= 3, `${c.id} light ${contrast(c.light, PAPER.light).toFixed(2)}`);
    assert.ok(contrast(c.dark, PAPER.dark) >= 3, `${c.id} dark ${contrast(c.dark, PAPER.dark).toFixed(2)}`);
  }
});

test("contrast matches the WCAG reference values", () => {
  assert.equal(contrast("#000000", "#ffffff"), 21);
  assert.equal(contrast("#ffffff", "#ffffff"), 1);
  assert.ok(Math.abs(contrast("#767676", "#ffffff") - 4.54) < 0.01);
});

test("categoryOf: hydrogen is a nonmetal, every element has a category, unknowns are unknown", () => {
  assert.equal(categoryOf(ELEMENTS[0]).id, "nonmetal");
  assert.equal(categoryOf(ELEMENTS[25]).id, "transition-metal");
  assert.equal(categoryOf(ELEMENTS[56]).id, "lanthanide");
  assert.equal(categoryOf(ELEMENTS[117]).id, "unknown");
  const counts = new Map<string, number>();
  for (const el of ELEMENTS) counts.set(categoryOf(el).id, (counts.get(categoryOf(el).id) ?? 0) + 1);
  assert.equal(counts.size, 10);
  assert.equal(counts.get("lanthanide"), 15);
  assert.equal(counts.get("actinide"), 15);
  assert.throws(() => categoryOf({ category: "made up" }), /unmapped/);
});
