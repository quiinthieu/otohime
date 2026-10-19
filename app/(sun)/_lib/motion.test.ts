// Sun's motion, read from stage.tsx and sun.css as text: the six inked layers,
// the three loops, the four keyframes, the reduced-motion block, and that the
// still is the whole drawing. No browser: the walk and QA look at it in one.
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { test } from "node:test";
import { LAYERS } from "./sun.ts";

const SUN = resolve(import.meta.dirname, "..");
const ROOT = resolve(SUN, "../..");
const stage = readFileSync(join(SUN, "_components", "stage.tsx"), "utf8");
const css = readFileSync(join(SUN, "sun.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

type Block = { prelude: string; body: string };

// The top-level blocks of a stylesheet: rules, @media and @keyframes, each with
// its whole body (nested braces included).
function blocks(text: string): Block[] {
  const out: Block[] = [];
  let depth = 0;
  let start = 0;
  let open = 0;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "{") {
      if (depth === 0) open = i;
      depth++;
    } else if (text[i] === "}") {
      depth--;
      if (depth === 0) {
        out.push({ prelude: text.slice(start, open).trim(), body: text.slice(open + 1, i) });
        start = i + 1;
      }
    }
  }
  assert.equal(depth, 0, "sun.css has unbalanced braces");
  return out;
}

const top = blocks(css);
const selectors = (b: Block) => b.prelude.split(",").map((s) => s.trim().replace(/\s+/g, " "));
const values = (attr: string) => [...stage.matchAll(new RegExp(`${attr}=(?:"([^"]+)"|\\{[^}]*\\})`, "g"))].map((m) => m[1]);

test("the stage keeps six layers, in LAYERS order", () => {
  // stage.tsx maps LAYERS to <g data-layer={l.id}>, once
  assert.match(stage, /LAYERS\.map\(/);
  assert.match(stage, /data-layer=\{l\.id\}/);
  assert.equal([...stage.matchAll(/data-layer=/g)].length, 1);
  assert.deepEqual(
    LAYERS.map((l) => l.id),
    ["core", "radiative", "convective", "photosphere", "chromosphere", "corona"],
  );
  for (const l of LAYERS) assert.match(css, new RegExp(`\\[data-layer="${l.id}"\\]\\s*\\{\\s*--at:`), `${l.id} has no draw-on delay`);
});

test("the stage has exactly three loops: convection, photon, wind", () => {
  assert.deepEqual(values("data-loop"), ["convection", "photon", "wind"]);
});

test("the four keyframes exist", () => {
  const names = top.filter((b) => b.prelude.startsWith("@keyframes")).map((b) => b.prelude.replace("@keyframes", "").trim());
  for (const name of ["sun-draw", "sun-convection-roll", "sun-photon-walk", "sun-wind-stream"]) {
    assert.ok(names.includes(name), `no @keyframes ${name}`);
  }
  const draw = top.find((b) => b.prelude === "@keyframes sun-draw")!;
  assert.match(draw.body, /from\s*\{[^}]*stroke-dashoffset:\s*1;/);
  assert.match(draw.body, /to\s*\{[^}]*stroke-dashoffset:\s*0;/);
});

test("the layers draw on, staggered, and each loop is animated", () => {
  const rule = (sel: string) => top.find((b) => !b.prelude.startsWith("@") && selectors(b).includes(sel));
  assert.match(rule("[data-layer] path")?.body ?? "", /animation:\s*sun-draw\b[^;]*var\(--at\)/);
  assert.match(rule("[data-layer] .hachure")?.body ?? "", /animation:\s*sun-ink-fade\b/);
  assert.match(rule('[data-loop="convection"] .cell')?.body ?? "", /animation:\s*sun-convection-roll\b[^;]*infinite/);
  assert.match(rule('[data-loop="photon"] .walker')?.body ?? "", /animation:\s*sun-photon-walk\b[^;]*infinite/);
  assert.match(rule('[data-loop="wind"] .stream')?.body ?? "", /animation:\s*sun-wind-stream\b[^;]*infinite/);
});

test("the loops start after the draw-on", () => {
  const vars = top.find((b) => selectors(b).includes(".sun-svg") && /--loops:/.test(b.body))!.body;
  const draw = Number(/--draw:\s*([\d.]+)s/.exec(vars)![1]);
  const loops = Number(/--loops:\s*([\d.]+)s/.exec(vars)![1]);
  const lastAt = Math.max(...[...css.matchAll(/--at:\s*([\d.]+)s/g)].map((m) => Number(m[1])));
  assert.ok(loops >= lastAt + draw, `loops start at ${loops}s, the last layer finishes at ${lastAt + draw}s`);
});

test("reduced motion turns every animation off", () => {
  const reduced = top.filter((b) => /^@media[^{]*prefers-reduced-motion:\s*reduce/.test(b.prelude));
  assert.equal(reduced.length, 1);
  assert.match(reduced[0].body, /\*[\s\S]*\{[^}]*animation:\s*none\s*!important/);
  assert.match(reduced[0].body, /transition:\s*none\s*!important/);
});

test("the still is the complete drawing", () => {
  // Outside @keyframes and @media, nothing in the stylesheet hides ink or dashes it.
  const base = top.filter((b) => !b.prelude.startsWith("@"));
  const layerPath = base.filter((b) => selectors(b).includes("[data-layer] path"));
  assert.equal(layerPath.length, 1);
  for (const b of base) {
    assert.doesNotMatch(b.body, /opacity:\s*0\s*;/, `${b.prelude} sets opacity: 0`);
    assert.doesNotMatch(b.body, /stroke-dash(?:offset|array)/, `${b.prelude} dashes the ink`);
    assert.doesNotMatch(b.body, /visibility:\s*hidden|display:\s*none/, `${b.prelude} hides something`);
  }
  // The photon's dot rests partway along its zig-zag, as attributes, with no CSS.
  assert.match(stage, /strokeDasharray="0\.01 1"/);
  assert.match(stage, /const PHOTON_REST = -0\.6;/);
  assert.match(css, /@keyframes sun-photon-walk\s*\{\s*from\s*\{\s*stroke-dashoffset:\s*-0\.6;/);
});

test("the stage is a server component with no filter, image, video or canvas", () => {
  for (const bad of ['"use client"', "'use client'", "<filter", "<image", "<video", "<canvas", "filter=", "useState", "useEffect"]) {
    assert.ok(!stage.includes(bad), `stage.tsx contains ${bad}`);
  }
  assert.ok(!/(?<![-\w])filter\s*:/.test(css), "sun.css sets a filter");
});

test("nothing under app/(sun)/ refers to a raster or a video", () => {
  const files = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? files(join(dir, e.name)) : [join(dir, e.name)]));
  const all = files(SUN);
  assert.ok(all.length > 10);
  const raster = /\.(?:gif|png|jpe?g|webp|avif|mp4|webm|mov)\b/i;
  for (const f of all) {
    assert.ok(!raster.test(f), `${relative(ROOT, f)} is a raster or a video`);
    if (f === import.meta.filename) continue;
    assert.ok(!raster.test(readFileSync(f, "utf8")), `${relative(ROOT, f)} refers to a raster or a video`);
  }
});
