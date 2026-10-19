import assert from "node:assert/strict";
import { test } from "node:test";
import { ELEMENTS } from "./elements.ts";
import { cellLabel, diagramLabel, mass, slug, sourceHost, temperature } from "./format.ts";

const el = (symbol: string) => {
  const found = ELEMENTS.find((e) => e.symbol === symbol);
  if (!found) throw new Error(symbol);
  return found;
};

test("cell labels name the element, its number and its legend category", () => {
  assert.equal(cellLabel(el("H")), "Hydrogen, atomic number 1, nonmetal");
  assert.equal(cellLabel(el("Fe")), "Iron, atomic number 26, transition metal");
  assert.equal(cellLabel(el("Og")), "Oganesson, atomic number 118, unknown properties");
});

test("masses have three decimals and slugs are lower-case symbols", () => {
  assert.equal(mass(el("H")), "1.008");
  assert.equal(mass(el("Fe")), "55.845");
  assert.equal(slug(el("Fe")), "fe");
  const slugs = new Set(ELEMENTS.map(slug));
  assert.equal(slugs.size, 118);
  for (const s of slugs) assert.match(s, /^[a-z]{1,2}$/);
});

test("temperatures print kelvin with Celsius, and nulls as not known", () => {
  assert.equal(temperature(1811), "1811 K (1537.85 °C)");
  assert.equal(temperature(13.99), "13.99 K (−259.16 °C)");
  assert.equal(temperature(273.15), "273.15 K (0 °C)");
  assert.equal(temperature(null), "not known");
  for (const e of ELEMENTS) {
    for (const k of [e.melt, e.boil]) assert.doesNotMatch(temperature(k), /NaN|undefined/, e.symbol);
  }
});

test("diagram labels list the shells", () => {
  assert.equal(diagramLabel(el("Fe")), "Bohr diagram of iron: shells of 2, 8, 14 and 2 electrons");
  assert.equal(diagramLabel(el("H")), "Bohr diagram of hydrogen: one shell of 1 electron");
  assert.equal(diagramLabel(el("He")), "Bohr diagram of helium: one shell of 2 electrons");
  assert.equal(diagramLabel(el("Li")), "Bohr diagram of lithium: shells of 2 and 1 electrons");
});

test("source hosts drop www", () => {
  assert.equal(sourceHost("https://en.wikipedia.org/wiki/Iron"), "en.wikipedia.org");
  assert.equal(sourceHost("https://www.nist.gov/x"), "nist.gov");
});
