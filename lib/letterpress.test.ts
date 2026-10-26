// The letterpress keys, read from app/(site)/letterpress.css as text: the whole
// file is one @layer components block with no filter property, a press sinks a
// key 1px (70 ms in, 120 ms out), reduced motion keeps the key still and forced
// colours drop the shadows and grain. Every grain is an feTurbulence data URI
// whose specks are at most 0.06 opaque, and on the worst speck (and on none) ink
// and muted still reach 4.5:1 on every paper, season and scheme, inked keys keep
// their paper letters, and the dark letters on a swatch keep theirs. The WCAG sums
// are kept here, as in seasons-contrast.test.ts.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";
import { SEASONS } from "./seasons.ts";

const ROOT = resolve(import.meta.dirname, "..");
const MIN = 4.5;
const MAX_ALPHA = 0.06;
const SCHEMES = ["light", "dark"] as const;
type Scheme = (typeof SCHEMES)[number];
type Pair = Record<Scheme, string>;
type Rgb = [number, number, number];

const read = (path: string) => readFileSync(resolve(ROOT, path), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

function rgb(hex: string): Rgb {
  let h = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex)?.[1];
  if (!h) throw new Error(`not a #rgb or #rrggbb colour: ${hex}`);
  if (h.length === 3) h = [...h].map((c) => c + c).join("");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as Rgb;
}

function luminance(c: Rgb): number {
  const [r, g, b] = c.map((v) => {
    const s = v / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: Rgb, b: Rgb): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

// A speck of `grain` at `alpha` over `under`, as the browser composites it.
const over = (grain: Rgb, alpha: number, under: Rgb): Rgb => under.map((u, i) => alpha * grain[i] + (1 - alpha) * u) as Rgb;

// `--name: light-dark(#light, #dark);` and `--name: #hex;` declarations in a rule body.
function pairs(body: string): Record<string, Pair> {
  const out: Record<string, Pair> = {};
  for (const m of body.matchAll(/(--[\w-]+)\s*:\s*light-dark\(\s*(#[0-9a-f]+)\s*,\s*(#[0-9a-f]+)\s*\)\s*;/gi)) {
    out[m[1]] = { light: m[2], dark: m[3] };
  }
  for (const m of body.matchAll(/(--[\w-]+)\s*:\s*(#[0-9a-f]+)\s*;/gi)) out[m[1]] = { light: m[2], dark: m[2] };
  return out;
}

// The body of the block whose `{` sits at `open`, up to its matching `}`.
function block(css: string, open: number): string {
  let depth = 0;
  for (let i = open; i < css.length; i++) {
    if (css[i] === "{") depth++;
    else if (css[i] === "}" && --depth === 0) return css.slice(open + 1, i);
  }
  throw new Error(`unclosed block at ${open}`);
}

// The body of the first block that opens with `prelude`.
function blockAfter(css: string, prelude: string): string {
  const at = css.indexOf(prelude);
  assert.ok(at >= 0, `no ${prelude} block`);
  return block(css, css.indexOf("{", at));
}

// A grain image: its specks' colour and the most opaque a speck can be. The
// colour matrix's rgb rows must be constant (offsets only) and its alpha row maps
// the noise's channels, each in [0, 1], so its positive weights plus its offset
// bound the alpha.
type Grain = { colour: Rgb; alpha: number };
function grain(uri: string): Grain {
  const svg = decodeURIComponent(uri);
  assert.match(svg, /<feTurbulence\b/, "grain without feTurbulence");
  const values = /<feColorMatrix\s+values='([^']+)'/.exec(svg)?.[1];
  assert.ok(values, "grain without an feColorMatrix values matrix");
  assert.doesNotMatch(svg, /<feColorMatrix\b[^>]*\btype=/, "the matrix must be the default type=matrix");
  const m = values.trim().split(/[\s,]+/).map(Number);
  assert.equal(m.length, 20, `a colour matrix has 20 values: ${values}`);
  assert.ok(m.every(Number.isFinite), values);
  for (const row of [0, 1, 2]) {
    assert.deepEqual(m.slice(row * 5, row * 5 + 4), [0, 0, 0, 0], `row ${row} must be a constant colour`);
  }
  const colour = [0, 1, 2].map((row) => Math.round(Math.min(1, Math.max(0, m[row * 5 + 4])) * 255)) as Rgb;
  const a = m.slice(15);
  const alpha = Math.min(1, Math.max(0, a.slice(0, 4).reduce((s, w) => s + Math.max(0, w), 0) + a[4]));
  return { colour, alpha };
}

const css = read("app/(site)/letterpress.css");
const globalsRoot = /:root\s*\{([^{}]*)\}/.exec(read("app/(site)/globals.css"))?.[1] ?? "";
const house = pairs(globalsRoot);
const seasonsCss = read("app/(site)/seasons.css");
const seasonVars = (season: string) =>
  pairs(new RegExp(`:root\\[data-season="${season}"\\]\\s*\\{([^{}]*)\\}`).exec(seasonsCss)?.[1] ?? "");
const layer = css.trim().startsWith("@layer components") ? blockAfter(css, "@layer components") : "";
const rootBody = /(?:^|\})\s*:root\s*\{([^{}]*)\}/.exec(layer)?.[1] ?? "";
const uris = Object.fromEntries([...rootBody.matchAll(/(--grain-[\w-]+)\s*:\s*url\("(data:image\/svg\+xml,[^"]+)"\)\s*;/g)].map((m) => [m[1], m[2]]));
const grains: Record<string, Grain> = Object.fromEntries(Object.entries(uris).map(([k, v]) => [k, grain(v)]));

// The papers a key sits on, house and seasonal, and the ink each pairs with.
const surfaces = (scheme: Scheme) =>
  [["house", house] as const, ...SEASONS.map((s) => [s, { ...house, ...seasonVars(s) }] as const)].map(([name, v]) => ({
    name,
    papers: [v["--paper"][scheme], v["--paper-2"][scheme]],
    ink: v["--ink"][scheme],
  }));

// The least contrast `text` has on `under` with `g`'s specks anywhere from none to its most opaque.
const worst = (text: string, under: string, g: Grain) =>
  Math.min(contrast(rgb(text), rgb(under)), contrast(rgb(text), over(g.colour, g.alpha, rgb(under))));

test("the WCAG sums and the grain reader agree with known values", () => {
  assert.equal(contrast(rgb("#000000"), rgb("#ffffff")), 21);
  assert.equal(contrast(rgb("#231e16"), rgb("#f2efe7")).toFixed(1), "14.4");
  assert.deepEqual(over([255, 255, 255], 0.5, [0, 0, 0]), [127.5, 127.5, 127.5]);
  const g = grain("%3CfeTurbulence/%3E%3CfeColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 .14 0 0 0 -.08'/%3E");
  assert.deepEqual(g.colour, [255, 255, 255]);
  assert.ok(Math.abs(g.alpha - 0.06) < 1e-9);
  // A noise channel copied into rgb is not one speck colour.
  assert.throws(() => grain("%3CfeTurbulence/%3E%3CfeColorMatrix values='1 0 0 0 0 0 0 0 0 1 0 0 0 0 1 .14 0 0 0 -.08'/%3E"));
});

test("letterpress.css is one @layer components block", () => {
  assert.ok(layer, "the file does not open with @layer components");
  assert.equal(css.trim(), `@layer components {${layer}}`, "something sits outside the layer");
});

test("letterpress.css declares only its own grain, deboss and letter edges, never paper or ink", () => {
  const names = [...css.matchAll(/(?<![\w-])(--[\w-]+)\s*:/g)].map((m) => m[1]);
  assert.ok(names.length > 0);
  for (const name of names) assert.match(name, /^--(?:grain|deboss|letter-edge)(?:-[\w-]+)?$/, `${name} is not the keys' own`);
});

test("letterpress.css sets no filter property", () => {
  assert.doesNotMatch(css, /(?:^|[;{\s])(?:-webkit-)?(?:backdrop-)?filter\s*:/);
  // The negative control: the same check catches one.
  assert.match(".btn { filter: blur(1px) }", /(?:^|[;{\s])(?:-webkit-)?(?:backdrop-)?filter\s*:/);
});

test("buttons, nav items and cartridge labels carry the grain and the deboss", () => {
  for (const sel of [".btn", ".nav-item", ".cartridge-label"]) {
    const rules = [...layer.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter((m) => m[1].split(",").some((s) => s.trim() === sel));
    const body = rules.map((m) => m[2]).join(";");
    assert.match(body, /background-image\s*:\s*var\(--grain(?:-light)?\)/, `${sel} has no grain`);
    assert.match(body, /box-shadow\s*:\s*var\(--deboss\)/, `${sel} is not debossed`);
    assert.match(body, /text-shadow\s*:/, `${sel} has no letter edge`);
  }
  assert.match(rootBody, /--deboss\s*:\s*inset[^;]*light-dark\(/);
  assert.match(rootBody, /--deboss-deep\s*:\s*inset[^;]*light-dark\(/);
  assert.match(rootBody, /--letter-edge\s*:[^;]*light-dark\(/);
});

test("a press sinks a key 1px into a deeper impression, 70 ms in and 120 ms out", () => {
  const press = [...layer.matchAll(/([^{}]+)\{([^{}]*)\}/g)].find((m) => /\.btn:active/.test(m[1]) && /\.nav-item:active/.test(m[1]));
  assert.ok(press, "no rule presses .btn and .nav-item");
  assert.match(press[2], /translate\s*:\s*0 1px\s*;/);
  assert.match(press[2], /box-shadow\s*:\s*var\(--deboss-deep\)/);
  assert.match(press[2], /transition-duration\s*:[^;]*\b70ms\b/);
  const rest = [...layer.matchAll(/([^{}]+)\{([^{}]*)\}/g)].find((m) => /^\s*\.btn,\s*\.nav-item\s*$/.test(m[1]));
  assert.ok(rest, "no resting rule for .btn and .nav-item");
  assert.match(rest[2], /translate 120ms/);
  assert.match(rest[2], /box-shadow 120ms/);
});

test("reduced motion keeps the key still and keeps its shadow", () => {
  const rm = blockAfter(layer, "@media (prefers-reduced-motion: reduce)");
  assert.match(rm, /\.btn:active[^{]*\{[^}]*translate\s*:\s*none/);
  assert.match(rm, /\.nav-item:active[^{]*\{[^}]*translate\s*:\s*none/);
  assert.doesNotMatch(rm, /transition[^;]*translate/, "a translate still transitions");
  assert.doesNotMatch(rm, /box-shadow\s*:\s*none/, "reduced motion drops the shadow");
});

test("forced colours drop shadows and grain and keep the borders", () => {
  const fc = blockAfter(layer, "@media (forced-colors: active)");
  for (const sel of [".btn", ".nav-item", ".cartridge-label"]) assert.ok(fc.includes(sel), `${sel} not handled`);
  assert.match(fc, /box-shadow\s*:\s*none/);
  assert.match(fc, /text-shadow\s*:\s*none/);
  assert.match(fc, /background-image\s*:\s*none\s*!important/);
  assert.doesNotMatch(fc, /border[\w-]*\s*:/, "forced colours touches a border");
});

test(`every grain is an feTurbulence image whose specks are at most ${MAX_ALPHA} opaque`, () => {
  const all = [...css.matchAll(/url\("(data:[^"]+)"\)/g)].map((m) => m[1]);
  assert.deepEqual(Object.keys(uris).sort(), ["--grain-dark", "--grain-light"]);
  assert.equal(all.length, Object.keys(uris).length, "a data URI outside the named grains");
  for (const [name, g] of Object.entries(grains)) {
    assert.ok(g.alpha > 0 && g.alpha <= MAX_ALPHA + 1e-9, `${name} reaches ${g.alpha}`);
  }
  // The negative control: a 20% grain fails the cap.
  assert.ok(grain("%3CfeTurbulence/%3E%3CfeColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 .2 0'/%3E").alpha > MAX_ALPHA);
});

test("the grain follows the scheme, the OS's or the pinned one", () => {
  assert.match(rootBody, /--grain\s*:\s*var\(--grain-light\)\s*;/);
  const os = blockAfter(layer, "@media (prefers-color-scheme: dark)");
  assert.match(os, /:root:not\(\[data-theme="light"\]\)\s*\{\s*--grain\s*:\s*var\(--grain-dark\)\s*;\s*\}/);
  assert.match(layer, /:root\[data-theme="dark"\]\s*\{\s*--grain\s*:\s*var\(--grain-dark\)\s*;\s*\}/);
  assert.deepEqual(grains["--grain-light"].colour, [255, 255, 255]);
  assert.deepEqual(grains["--grain-dark"].colour, [0, 0, 0]);
});

const schemeGrain: Record<Scheme, string> = { light: "--grain-light", dark: "--grain-dark" };
for (const scheme of SCHEMES) {
  test(`${scheme}: ink and muted reach ${MIN}:1 on the worst grain of every paper and season`, () => {
    const g = grains[schemeGrain[scheme]];
    const muted = house["--muted"][scheme];
    for (const s of surfaces(scheme)) {
      for (const paper of s.papers) {
        for (const [name, text] of [["ink", s.ink], ["muted", muted]]) {
          const r = worst(text, paper, g);
          assert.ok(r >= MIN, `${scheme} ${s.name}: ${name} ${text} on grained ${paper} is ${r.toFixed(2)}:1`);
        }
      }
    }
  });

  test(`${scheme}: an inked key's paper letters reach ${MIN}:1 on its worst grain`, () => {
    const g = grains[schemeGrain[scheme]];
    for (const s of surfaces(scheme)) {
      const r = worst(s.papers[0], s.ink, g);
      assert.ok(r >= MIN, `${scheme} ${s.name}: paper on grained ink is ${r.toFixed(2)}:1`);
    }
  });
}

test(`dark letters on every swatch reach ${MIN}:1 on the label grain`, () => {
  const onSwatch = house["--on-swatch"].light;
  for (const sw of ["--yellow", "--coral", "--mint", "--blue", "--pink"]) {
    const r = worst(onSwatch, house[sw].light, grains["--grain-light"]);
    assert.ok(r >= MIN, `${sw}: ${r.toFixed(2)}:1`);
  }
});

test("negative control: ink-coloured specks at the cap sink muted below the line on light paper", () => {
  const ink = { colour: rgb(house["--ink"].light), alpha: MAX_ALPHA };
  const failing = surfaces("light").flatMap((s) => s.papers.map((p) => worst(house["--muted"].light, p, ink))).filter((r) => r < MIN);
  assert.ok(failing.length > 0, "the contrast check would pass a grain that darkens light paper");
});
