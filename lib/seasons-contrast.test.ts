// The season tints, read from app/(site)/seasons.css as text: every season
// sets --paper, --paper-2 and --ink as light-dark() pairs, and in both schemes
// the ink reads at 4.5:1 or better (WCAG 2, body text) on both papers. The
// site's --muted is not tinted, so it is held to the same line on the tinted
// papers, read from globals.css. The WCAG sums are kept here rather than
// borrowed from the design system, which nothing outside it may import.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";
import { SEASONS } from "./seasons.ts";

const ROOT = resolve(import.meta.dirname, "..");
const MIN = 4.5;
const SCHEMES = ["light", "dark"] as const;
type Scheme = (typeof SCHEMES)[number];
type Pair = Record<Scheme, string>;

const read = (path: string) => readFileSync(resolve(ROOT, path), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

function channel(c: number): number {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  let h = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex)?.[1];
  if (!h) throw new Error(`not a #rgb or #rrggbb colour: ${hex}`);
  if (h.length === 3) h = [...h].map((c) => c + c).join("");
  const [r, g, b] = [0, 2, 4].map((i) => channel(parseInt(h.slice(i, i + 2), 16)));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

// `--name: light-dark(#light, #dark);` declarations in a rule body.
function pairs(body: string): Record<string, Pair> {
  const out: Record<string, Pair> = {};
  for (const m of body.matchAll(/(--[\w-]+)\s*:\s*light-dark\(\s*(#[0-9a-f]+)\s*,\s*(#[0-9a-f]+)\s*\)\s*;/gi)) {
    out[m[1]] = { light: m[2], dark: m[3] };
  }
  return out;
}

// The body of each `:root[data-season="…"]` rule, by season.
function seasonBlocks(css: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const m of css.matchAll(/:root\[data-season="([a-z]+)"\]\s*\{([^{}]*)\}/g)) {
    assert.ok(!out.has(m[1]), `two blocks for ${m[1]}`);
    out.set(m[1], m[2]);
  }
  return out;
}

const seasonsCss = read("app/(site)/seasons.css");
const blocks = seasonBlocks(seasonsCss);
const rootBody = /:root\s*\{([^{}]*)\}/.exec(read("app/(site)/globals.css"))?.[1] ?? "";
const muted = pairs(rootBody)["--muted"];

test("the WCAG sums agree with known pairs", () => {
  assert.equal(contrast("#000000", "#ffffff"), 21);
  assert.equal(contrast("#fff", "#000"), 21);
  assert.equal(contrast("#777777", "#777777"), 1);
  // The house ink on the house paper, as globals.css records it: 14.4 / 14.1.
  assert.equal(contrast("#231e16", "#f2efe7").toFixed(1), "14.4");
  assert.equal(contrast("#ebe6da", "#1c1915").toFixed(1), "14.1");
  // A pale grey on white is the negative control: well under the line.
  assert.ok(contrast("#999999", "#ffffff") < MIN);
});

test("seasons.css has one block per season and no other", () => {
  assert.deepEqual([...blocks.keys()].sort(), [...SEASONS].sort());
});

for (const season of SEASONS) {
  test(`${season} tints --paper, --paper-2 and --ink as light-dark pairs`, () => {
    const body = blocks.get(season);
    assert.ok(body, `no :root[data-season="${season}"] block`);
    const vars = pairs(body);
    assert.deepEqual(Object.keys(vars).sort(), ["--ink", "--paper", "--paper-2"]);
  });

  for (const scheme of SCHEMES) {
    test(`${season} / ${scheme}: ink and muted reach ${MIN}:1 on both papers`, () => {
      const vars = pairs(blocks.get(season) ?? "");
      assert.ok(muted, "globals.css :root has no --muted light-dark pair");
      for (const paper of ["--paper", "--paper-2"]) {
        for (const [name, text] of [["--ink", vars["--ink"]], ["--muted", muted]] as const) {
          const ratio = contrast(text[scheme], vars[paper][scheme]);
          assert.ok(ratio >= MIN, `${season} ${scheme}: ${name} ${text[scheme]} on ${paper} ${vars[paper][scheme]} is ${ratio.toFixed(2)}:1`);
        }
      }
    });
  }
}

test("the ambient layer's keyframes are declared, transform and opacity only", () => {
  const names = [...seasonsCss.matchAll(/@keyframes\s+([\w-]+)\s*\{/g)].map((m) => m[1]);
  assert.deepEqual(names.sort(), ["almanac-leaf", "almanac-petal", "almanac-rain", "almanac-snow"]);
  // The keyframes close the file, so every declaration from the first one on is a frame's.
  const frames = seasonsCss.slice(seasonsCss.indexOf("@keyframes"));
  const props = [...frames.matchAll(/([\w-]+)\s*:/g)].map((m) => m[1]);
  assert.ok(props.length > 0);
  assert.deepEqual([...new Set(props)].sort(), ["opacity", "transform"]);
});

