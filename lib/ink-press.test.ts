// The Ink Poster Press's layout engine (lib/ink-press.ts), and the shape of the components that draw it: the press
// rides its own chunk behind next/dynamic with ssr: false, the eager loader holds none of the engine, and the press
// stops its clock when the context is lost, the tab hides or the poster leaves the screen. e2e/ink-press.test.ts
// samples the real pixels in a browser.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  DEFAULT_PHRASE,
  DRY_MS,
  EXPORT_H,
  EXPORT_W,
  LAYOUTS,
  LEADING,
  MAX_CHARS,
  MAX_DPR,
  cleanPhrase,
  design,
  displaySize,
  fitText,
  fontFor,
  formatSeed,
  layoutOf,
  mulberry32,
  parseSeed,
  posterFilename,
  posterQuery,
  readQuery,
  rgb,
  setCase,
  shuffleSeed,
  stampFrame,
  typeBox,
  wetness,
  withLayout,
} from "./ink-press.ts";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
// A monospace stand-in for measureText: every character is 0.6 of the font size wide.
const mono = (line: string) => Array.from(line).length * 0.6;

test("mulberry32 is the reference generator: the same seed gives the same floats, all in [0, 1)", () => {
  // the first three draws for seed 1 of the published mulberry32 (bryc), run separately
  const r = mulberry32(1);
  assert.deepEqual([r(), r(), r()].map((v) => Math.round(v * 1e9)), [627073941, 2735721, 527447040]);
  const a = mulberry32(0xdeadbeef);
  const b = mulberry32(0xdeadbeef);
  let sum = 0;
  for (let i = 0; i < 10_000; i++) {
    const v = a();
    assert.equal(v, b());
    assert.ok(v >= 0 && v < 1, `${v}`);
    sum += v;
  }
  assert.ok(Math.abs(sum / 10_000 - 0.5) < 0.02, "the draws are spread evenly");
  assert.notEqual(mulberry32(2)(), mulberry32(3)());
});

test("a seed travels as 8 hex digits and nothing else parses", () => {
  for (const seed of [0, 1, 0xabc, 0x7fffffff, 0xffffffff]) {
    assert.match(formatSeed(seed), /^[0-9a-f]{8}$/);
    assert.equal(parseSeed(formatSeed(seed)), seed);
  }
  assert.equal(parseSeed("FF"), 255);
  for (const bad of [null, undefined, "", "xyz", "123456789", "-1", "1.5", " 12", "0x12"]) assert.equal(parseSeed(bad), null, String(bad));
});

test("the seed picks the layout, every layout is one step away, and the step stays a u32", () => {
  assert.deepEqual([0, 1, 2, 3, 4, 5].map(layoutOf), ["stamp", "riso", "brush", "stamp", "riso", "brush"]);
  for (const seed of [0, 1, 2, 1234567, 0xfffffffd, 0xfffffffe, 0xffffffff]) {
    for (const layout of LAYOUTS) {
      const next = withLayout(seed, layout);
      assert.equal(layoutOf(next), layout, `${seed} -> ${layout}`);
      assert.ok(Number.isInteger(next) && next >= 0 && next <= 0xffffffff, `${next}`);
      assert.ok(Math.abs(next - seed) <= 3, `${seed} -> ${next} is a far jump`);
    }
    assert.equal(withLayout(seed, layoutOf(seed)), seed, "asking for the layout it has keeps the seed");
  }
});

test("shuffle always lands on a new seed, from any draw", () => {
  for (const draw of [0, 0.25, 0.5, 0.999999, 1, -1, 2]) {
    const next = shuffleSeed(12345, draw);
    assert.ok(Number.isInteger(next) && next >= 0 && next <= 0xffffffff, `${draw} -> ${next}`);
    assert.notEqual(next, 12345);
  }
  assert.notEqual(shuffleSeed(0, 0), 0);
  assert.notEqual(shuffleSeed(0xffffffff, 1), 0xffffffff);
});

test("the phrase is cut to 24 code points, never splitting a surrogate pair, with controls and bidi gone", () => {
  assert.equal(MAX_CHARS, 24);
  assert.equal(cleanPhrase("  wet \t\n ink  "), "wet ink");
  assert.equal(cleanPhrase("a\u0000b‮c⁦d\u0085e"), "abcde");
  assert.equal(cleanPhrase("x".repeat(40)), "x".repeat(24));
  const waves = cleanPhrase("🌊".repeat(30));
  assert.equal(Array.from(waves).length, 24);
  assert.equal(waves, "🌊".repeat(24), "every wave is whole");
  assert.equal(cleanPhrase("twenty-three characters and more"), "twenty-three characters", "a cut on a space is trimmed");
  assert.equal(cleanPhrase("   "), "");
  assert.equal(cleanPhrase(DEFAULT_PHRASE), DEFAULT_PHRASE);
});

test("a design is fixed by its seed, and each layout keeps to its own inks, tilt and register", () => {
  assert.deepEqual(design(42), design(42));
  assert.notDeepEqual(design(42), design(45), "the next seed of the same layout is another poster");
  const seen = new Set<string>();
  for (let seed = 0; seed < 600; seed++) {
    const d = design(seed);
    seen.add(d.layout);
    assert.equal(d.layout, layoutOf(seed));
    assert.match(d.ink, /^#[0-9a-f]{6}$/);
    assert.match(d.ink2, /^#[0-9a-f]{6}$/);
    assert.ok(d.wobble >= 0.5 && d.wobble <= 1 && d.bleed >= 0.5 && d.bleed <= 1);
    if (d.layout === "riso") {
      assert.notEqual(d.ink, d.ink2, "riso prints with two drums");
      assert.ok(Math.abs(d.shift[0]) >= 0.006 && Math.abs(d.shift[0]) <= 0.016, `${d.shift}`);
      assert.ok(Math.abs(d.shift[1]) >= 0.004 && Math.abs(d.shift[1]) <= 0.012, `${d.shift}`);
      assert.ok(Math.abs(d.tilt) <= 0.035);
    } else {
      assert.equal(d.ink, d.ink2, `${d.layout} prints with one ink`);
      assert.deepEqual(d.shift, [0, 0]);
    }
    if (d.layout === "stamp") assert.ok(Math.abs(d.tilt) <= 0.1);
    if (d.layout === "brush") assert.ok(d.tilt <= 0.06 && d.tilt >= -0.18, `brush leans: ${d.tilt}`);
  }
  assert.equal(seen.size, 3);
});

test("fitText: the biggest type that fits, cut into one to three lines on its spaces", () => {
  const box = { w: 800, h: 600 };
  // one short word grows only to half the box's height
  assert.deepEqual(fitText("INK", mono, box), { lines: ["INK"], size: 300 });
  // a long phrase is cut so its widest line is as short as it can be
  const fit = fitText("THE BROKEN DAG RUNS AT DAWN", mono, box);
  assert.ok(fit.lines.length > 1, `${fit.lines}`);
  assert.equal(fit.lines.join(" "), "THE BROKEN DAG RUNS AT DAWN");
  for (const phrase of ["a", "wet ink", "the warehouse", "THE LAKE AT NIGHT", "x".repeat(24), "a b c d e f g h i j k l", "🌊 tide 🌊"]) {
    const f = fitText(phrase, mono, box);
    assert.ok(f.lines.length >= 1 && f.lines.length <= 3, phrase);
    assert.equal(f.lines.join(" "), phrase.split(" ").filter(Boolean).join(" "), "no word is lost or reordered");
    assert.ok(Math.max(...f.lines.map(mono)) * f.size <= box.w + 1e-6, `${phrase}: too wide`);
    assert.ok(f.lines.length * f.size * LEADING <= box.h + 1e-6, `${phrase}: too tall`);
    assert.ok(f.size <= box.h / 2 + 1e-9);
  }
  // one long word cannot be cut: it shrinks to fit the width instead
  const word = fitText("x".repeat(24), mono, box);
  assert.deepEqual(word.lines, ["x".repeat(24)]);
  assert.ok(Math.abs(word.size - 800 / (24 * 0.6)) < 1e-9);
  assert.deepEqual(fitText("", mono, box), { lines: [], size: 0 });
});

test("the type box and the stamp's frame sit inside the 1080x1350 sheet, frame round the type", () => {
  assert.equal(EXPORT_W, 1080);
  assert.equal(EXPORT_H, 1350);
  for (const layout of LAYOUTS) {
    const b = typeBox(layout, EXPORT_W, EXPORT_H);
    assert.ok(b.x > 0 && b.y > 0 && b.x + b.w < EXPORT_W && b.y + b.h < EXPORT_H, layout);
    assert.ok(Math.abs(b.x + b.w / 2 - EXPORT_W / 2) < 1e-9 && Math.abs(b.y + b.h / 2 - EXPORT_H / 2) < 1e-9, `${layout} is centred`);
  }
  const f = stampFrame(EXPORT_W, EXPORT_H);
  const b = typeBox("stamp", EXPORT_W, EXPORT_H);
  assert.ok(f.x > 0 && f.y > 0 && f.x + f.w < EXPORT_W && f.y + f.h < EXPORT_H);
  assert.ok(f.x < b.x && f.y < b.y && f.x + f.w > b.x + b.w && f.y + f.h > b.y + b.h);
});

test("each layout has its face and its case", () => {
  assert.equal(setCase("stamp", "wet ink"), "WET INK");
  assert.equal(setCase("riso", "wet ink"), "WET INK");
  assert.equal(setCase("brush", "wet ink"), "wet ink");
  assert.match(fontFor("stamp", 12.345), /^800 12\.35px .*monospace$/);
  assert.match(fontFor("riso", 100), /^900 100px .*sans-serif$/);
  assert.match(fontFor("brush", 100), /^italic 700 100px .*serif$/);
});

test("the PNG's name: an ASCII slug of the phrase, its layout and its seed", () => {
  assert.equal(posterFilename("Wet Ink", 0x1a), "ink-press-wet-ink-brush-0000001a.png");
  assert.equal(posterFilename("Café  crème!", 3), "ink-press-cafe-creme-stamp-00000003.png");
  assert.equal(posterFilename("🌊🌊", 1), "ink-press-poster-riso-00000001.png");
  assert.equal(posterFilename("../../etc/passwd", 0), "ink-press-etc-passwd-stamp-00000000.png");
  const long = posterFilename("a".repeat(30), 0);
  assert.equal(long, `ink-press-${"a".repeat(24)}-stamp-00000000.png`);
  assert.match(posterFilename("THE BROKEN DAG", 0xffffffff), /^ink-press-[a-z0-9-]+-(stamp|riso|brush)-[0-9a-f]{8}\.png$/);
});

test("?s= carries the seed and ?t= the phrase; a bad query reads as nothing", () => {
  assert.equal(posterQuery("wet ink", 0xbeef), "?s=0000beef&t=wet+ink");
  assert.equal(posterQuery("", 7), "?s=00000007");
  assert.deepEqual(readQuery(posterQuery("the lake", 0xbeef)), { seed: 0xbeef, phrase: "the lake" });
  assert.deepEqual(readQuery("?s=zz&t=%20%20"), { seed: null, phrase: null });
  assert.deepEqual(readQuery(""), { seed: null, phrase: null });
  assert.equal(readQuery(`?t=${"y".repeat(40)}%00`).phrase, "y".repeat(24));
});

test("fresh ink is wet, dries monotonically and is dry from DRY_MS on", () => {
  assert.equal(wetness(0), 1);
  assert.equal(wetness(-5), 1);
  assert.equal(wetness(Number.NaN), 1);
  assert.equal(wetness(DRY_MS), 0);
  assert.equal(wetness(DRY_MS * 10), 0);
  let prev = 1;
  for (let ms = 50; ms < DRY_MS; ms += 50) {
    const w = wetness(ms);
    assert.ok(w < prev && w > 0, `${ms}: ${w}`);
    prev = w;
  }
});

test("the display buffer is 4:5 and never past two device px per CSS px", () => {
  assert.equal(MAX_DPR, 2);
  assert.deepEqual(displaySize(384, 1), { w: 384, h: 480, dpr: 1 });
  assert.deepEqual(displaySize(384, 2), { w: 768, h: 960, dpr: 2 });
  assert.deepEqual(displaySize(384, 3), { w: 768, h: 960, dpr: 2 });
  assert.deepEqual(displaySize(384, 0), { w: 384, h: 480, dpr: 1 });
  assert.deepEqual(rgb("#ff8000"), [1, 128 / 255, 0]);
});

const LOADER = read("components/ink-press-loader.tsx");
const PRESS = read("components/ink-press.tsx");
const imports = (src: string) => [...src.matchAll(/^import [^;]*?from "([^"]+)";/gm)].map((m) => m[1]);

test("the loader brings the press through next/dynamic with ssr: false and holds none of its engine", () => {
  assert.match(LOADER, /dynamic\(\(\) => import\("@\/components\/ink-press"\), \{\s*ssr: false,/);
  assert.deepEqual(imports(LOADER).sort(), ["next/dynamic", "react"]);
  assert.match(read("app/(site)/(app)/play/page.tsx"), /<InkPressLoader \/>/);
});

test("the press is plain WebGL2 and React: no three, and only the site's own ink libraries", () => {
  assert.deepEqual(imports(PRESS).sort(), ["@/lib/ink-modes", "@/lib/ink-press", "react"]);
  assert.doesNotMatch(PRESS, /three|@react-three/);
  assert.match(PRESS, /getContext\("webgl2"/);
  assert.match(PRESS, /^\/\/ ink-press poster$/m, "the chunk's marker for e2e/ink-press.test.ts");
});

test("the press stops on a lost context, a hidden tab and an off-screen poster, and caps the ratio", () => {
  assert.match(PRESS, /addEventListener\("webglcontextlost", onLost\)/);
  assert.match(PRESS, /const onLost = \(e: Event\) => \{\s*e\.preventDefault\(\);[\s\S]*?setRenderer\("svg"\)/);
  assert.match(PRESS, /addEventListener\("visibilitychange", onVisibility\)/);
  assert.match(PRESS, /new IntersectionObserver\(/);
  assert.match(PRESS, /const running = \(\) => !gone && !document\.hidden && inView && !reduced\.matches && wetness\(elapsed\) > 0;/);
  assert.match(PRESS, /displaySize\(canvas\.getBoundingClientRect\(\)\.width, devicePixelRatio\)/);
  // every animation frame is asked for behind running(), so reduced motion never asks for one
  const asks = [...PRESS.matchAll(/requestAnimationFrame\(frame\)/g)].length;
  assert.equal(asks, [...PRESS.matchAll(/running\(\)\) raf = requestAnimationFrame\(frame\)/g)].length);
  assert.ok(asks >= 1);
  assert.match(PRESS, /elapsed = reduced\.matches \? DRY_MS : 0;/);
});

test("export draws the dried frame at 1080x1350 and reads it with toBlob in the same task", () => {
  const save = /save\(d, phrase, done\) \{([\s\S]*?)\n {6}\},/.exec(PRESS)?.[1] ?? "";
  assert.match(save, /canvas\.width = EXPORT_W;\s*canvas\.height = EXPORT_H;/);
  const draw = save.indexOf("painter.draw(d, 0)");
  const blob = save.indexOf('canvas.toBlob(done, "image/png")');
  assert.ok(draw > 0 && blob > draw, "toBlob follows the dried draw");
  assert.doesNotMatch(save.slice(draw, blob), /await|then\(|setTimeout|requestAnimationFrame/, "nothing yields between the draw and toBlob");
  // without WebGL the export is Canvas2D
  assert.match(PRESS, /paintPrint\(ctx, d, phrase, EXPORT_W, EXPORT_H\);\s*sheet\.toBlob\(done, "image\/png"\);/);
});
