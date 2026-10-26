import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { inkFilter, MATERIALS } from "./ink-modes.ts";
import { SEASONS } from "./seasons.ts";
import {
  PRINT_RUNS, PRINT_RUN_IDS, HOUSE_COLORS, isPrintRunId, resolvePrintRun,
  type AppearanceColors, type ColorScheme,
} from "./print-runs.ts";
import { labDefaults } from "./ink-lab.ts";

const schemes = ["light", "dark"] as const;

test("the four immutable print runs have the contracted identities and defaults", () => {
  assert.deepEqual(PRINT_RUN_IDS, ["house", "sumi", "riso", "indigo"]);
  assert.deepEqual(PRINT_RUN_IDS.map(id => PRINT_RUNS[id].label), ["House", "Sumi black", "Riso pink + mint", "Indigo night"]);
  for (const id of PRINT_RUN_IDS) {
    assert.equal(isPrintRunId(id), true);
    assert.equal(Object.isFrozen(PRINT_RUNS[id]), true);
    assert.equal(Object.isFrozen(PRINT_RUNS[id].plates.light), true);
  }
  assert.equal(Object.isFrozen(PRINT_RUNS), true);
  assert.throws(() => { Object.assign(PRINT_RUNS.riso.plates.light, { 1: "#ffffff" }); }, TypeError);
  for (const value of ["", "RISO", "__proto__", "constructor", null, {}, "<script>"]) assert.equal(isPrintRunId(value), false);
  assert.equal(PRINT_RUNS.house.colors, null);
  assert.equal(PRINT_RUNS.sumi.plateCount, 2);
  assert.equal(PRINT_RUNS.riso.turbulenceMultiplier, 1.1);
  assert.equal(PRINT_RUNS.indigo.colorScheme, "dark");
});

test("house inherits any project's house colors; presets coexist with every theme and season", () => {
  for (const theme of schemes) for (const season of SEASONS) {
    const context = { theme, season, house: HOUSE_COLORS[theme] };
    for (const id of PRINT_RUN_IDS) {
      const resolved = resolvePrintRun(id, context);
      assert.deepEqual(resolved.context, context);
      assert.equal(resolved.colorScheme, id === "indigo" ? "dark" : theme);
      if (id === "house") {
        assert.deepEqual(resolved.colors, context.house);
        assert.equal(resolved.overrides, null);
      } else assert.deepEqual(resolved.overrides, PRINT_RUNS[id].colors?.[resolved.colorScheme]);
      assert.equal(context.theme, theme);
      assert.equal(context.season, season);
    }
    assert.equal(resolvePrintRun("indigo", context).colorScheme, "dark");
    assert.equal(resolvePrintRun("house", context).colorScheme, theme);
  }
  const custom: AppearanceColors = { ...HOUSE_COLORS.dark, paper: "#121212", ink: "#fafafa" };
  assert.deepEqual(resolvePrintRun("house", { theme: "dark", season: null, house: custom }).colors, custom);
});

test("house defaults preserve the ink material and existing inkFilter output", () => {
  const settings = labDefaults("house").settings;
  assert.equal(settings.turbulence, MATERIALS.ink.warp.frequency);
  assert.equal(settings.displacement, 3.5);
  assert.equal(settings.wobble, 0);
  assert.equal(settings.grain, 0.06);
  assert.deepEqual(settings.plates, ["#231e16", "#f3a6bb", "#93d3b0"]);
  assert.deepEqual(inkFilter(), inkFilter(settings.hand, 0, settings.displacement));
  assert.deepEqual(inkFilter().slice(0, 2), [
    { tag: "feTurbulence", attrs: { type: "turbulence", baseFrequency: 0.035, numOctaves: 2, seed: 3, result: "warp" } },
    { tag: "feDisplacementMap", attrs: { in: "SourceGraphic", in2: "warp", scale: 3.5, xChannelSelector: "R", yChannelSelector: "G", result: "inked" } },
  ]);
});

// Independent WCAG arithmetic; grain has a scheme-specific pigment and a TOTAL
// alpha budget (white on light, black on dark). Paper textures sit BELOW text,
// as in letterpress.css; a foreground overlay would change the house contract.
function rgb(hex: string) {
  return [0, 2, 4].map(i => parseInt(hex.slice(i + 1, i + 3), 16));
}
function luminance(channels: number[]) {
  const linear = channels.map(c => c / 255 <= 0.04045 ? c / 255 / 12.92 : ((c / 255 + 0.055) / 1.055) ** 2.4);
  return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
}
function contrast(a: number[], b: number[]) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
function worst(text: string, paper: string, scheme: ColorScheme) {
  const pigment = scheme === "light" ? 255 : 0;
  return Math.min(...[0, 0.06].map(alpha =>
    contrast(rgb(text), rgb(paper).map(c => c * (1 - alpha) + pigment * alpha)),
  ));
}

test("contrast checker rejects an unreadable negative control", () => {
  assert.equal(contrast(rgb("#000000"), rgb("#ffffff")), 21);
  assert.ok(worst("#aaaaaa", "#ffffff", "light") < 4.5);
});

test("body, muted and focus remain readable on both papers and fields at maximum total grain", () => {
  for (const id of PRINT_RUN_IDS) for (const theme of schemes) {
    const { colors, colorScheme } = resolvePrintRun(id, { theme, season: null, house: HOUSE_COLORS[theme] });
    for (const paper of [colors.paper, colors.paper2, colors.field]) {
      for (const text of [colors.ink, colors.muted]) assert.ok(worst(text, paper, colorScheme) >= 4.5, `${id}/${theme}: ${text} on ${paper}`);
      assert.ok(worst(colors.focus, paper, colorScheme) >= 3);
      assert.ok(worst(colors.line, paper, colorScheme) >= 3);
    }
    assert.ok(PRINT_RUNS[id].grain <= 0.06);
  }
});

test("inherited seasonal house colors also pass, without duplicating their source of truth", () => {
  const css = readFileSync(new URL("../app/(site)/seasons.css", import.meta.url), "utf8");
  for (const season of SEASONS) for (const theme of schemes) {
    const block = css.match(new RegExp(`:root\\[data-season="${season}"\\]\\s*\\{([^}]+)\\}`))?.[1] ?? "";
    const pair = (name: string) => {
      const match = block.match(new RegExp(`--${name}: light-dark\\((#[a-f0-9]+), (#[a-f0-9]+)\\)`));
      assert.ok(match);
      return match[theme === "light" ? 1 : 2] as `#${string}`;
    };
    const house = { ...HOUSE_COLORS[theme], paper: pair("paper"), paper2: pair("paper-2"), ink: pair("ink") };
    const { colors, plates } = resolvePrintRun("house", { theme, season, house });
    assert.equal(plates[0], house.ink);
    for (const paper of [colors.paper, colors.paper2, colors.field]) for (const text of [colors.ink, colors.muted]) assert.ok(worst(text, paper, theme) >= 4.5, `${season}/${theme}`);
  }
});
