import assert from "node:assert/strict";
import { test } from "node:test";
import { kelvin, km, lightTime, years } from "./format.ts";

test("kelvin says millions with one decimal and plain kelvin below", () => {
  assert.equal(kelvin(15_700_000), "15.7 million K (15.7 million °C)");
  assert.equal(kelvin(2_000_000), "2 million K (2 million °C)");
  assert.equal(kelvin(5772), "5,772 K (5,499 °C)");
  assert.equal(kelvin(30_000), "30,000 K (29,727 °C)");
});

test("km groups thousands", () => {
  assert.equal(km(695_700), "695,700 km");
  assert.equal(km(500), "500 km");
});

test("years is singular for one", () => {
  assert.equal(years(170_000), "170,000 years");
  assert.equal(years(1), "1 year");
});

test("lightTime says minutes and seconds", () => {
  assert.equal(lightTime(499), "8 min 19 s");
  assert.equal(lightTime(480), "8 min");
  assert.equal(lightTime(45), "45 s");
});
