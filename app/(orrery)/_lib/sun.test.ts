import assert from "node:assert/strict";
import { test } from "node:test";
import { lightTime } from "./format.ts";
import * as sun from "./sun.ts";
import { LAYERS, LIGHT_SECONDS, PHOTON_YEARS, SOURCES, type Layer } from "./sun.ts";

const layer = (id: string): Layer => {
  const l = LAYERS.find((x) => x.id === id);
  assert.ok(l, id);
  return l;
};

test("the interior layers tile [0, 1] in order", () => {
  const interior = LAYERS.filter((l) => l.region === "interior");
  assert.deepEqual(
    interior.map((l) => l.id),
    ["core", "radiative", "convective"],
  );
  assert.equal(interior[0].from, 0);
  assert.equal(interior[interior.length - 1].to, 1);
  for (let i = 1; i < interior.length; i++) assert.equal(interior[i].from, interior[i - 1].to);
  for (const l of interior) assert.ok(l.to > l.from);
});

test("the atmosphere layers are contiguous from 0 km", () => {
  const atmosphere = LAYERS.filter((l) => l.region === "atmosphere");
  assert.deepEqual(
    atmosphere.map((l) => l.id),
    ["photosphere", "chromosphere", "corona"],
  );
  assert.equal(atmosphere[0].from, 0);
  for (let i = 1; i < atmosphere.length; i++) assert.equal(atmosphere[i].from, atmosphere[i - 1].to);
  for (const l of atmosphere) assert.ok(l.to > l.from);
});

test("temperatures have the real shape", () => {
  const t = (id: string) => layer(id).tempK[0];
  assert.ok(t("core") > t("radiative"));
  assert.ok(t("radiative") > t("convective"));
  assert.ok(t("convective") > t("photosphere"));
  const surface = layer("photosphere").tempK[0];
  assert.ok(layer("chromosphere").tempK[1] > surface);
  assert.ok(layer("corona").tempK[1] > surface);
  // the interior cools outward, layer by layer
  for (const id of ["core", "radiative", "convective"]) assert.ok(layer(id).tempK[0] > layer(id).tempK[1]);
});

test("every source is an https page on nasa.gov or wikipedia.org", () => {
  for (const [key, s] of Object.entries(SOURCES)) {
    assert.ok(s.url.startsWith("https://"), key);
    const host = new URL(s.url).hostname;
    assert.ok(host.endsWith("nasa.gov") || host.endsWith("wikipedia.org"), `${key}: ${host}`);
    assert.ok(!s.url.includes("layers-of-the-sun"), key);
  }
});

test("the photon's trip is 170,000 years", () => {
  assert.equal(PHOTON_YEARS, 170_000);
});

test("light takes 8 min 19 s", () => {
  assert.equal(lightTime(LIGHT_SECONDS), "8 min 19 s");
});

test("the tour is gone: sun.ts exports no CHAPTERS", () => {
  assert.equal("CHAPTERS" in sun, false);
});
