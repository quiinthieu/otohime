// Every animated chapter must have its scene in the stage, its keyframes in the
// CSS, and a still under prefers-reduced-motion. Both files are read as text:
// node --test cannot import .tsx.
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { CHAPTERS } from "./sun.ts";

const SUN = join(import.meta.dirname, "..");
const stage = readFileSync(join(SUN, "_components", "stage.tsx"), "utf8");
const css = readFileSync(join(SUN, "sun.css"), "utf8");

const ANIMATED = CHAPTERS.map((c) => c.id);

function filesUnder(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const path = join(dir, e.name);
    return e.isDirectory() ? filesUnder(path) : [path];
  });
}

test("each animated chapter has a scene group in the stage", () => {
  for (const id of ANIMATED) assert.ok(stage.includes(`data-scene="${id}"`), `no data-scene="${id}" in stage.tsx`);
});

test("each animated chapter has keyframes in the CSS, named sun-<id>-<part>", () => {
  for (const id of ANIMATED) assert.ok(css.includes(`@keyframes sun-${id}-`), `no @keyframes sun-${id}- in sun.css`);
});

test("keyframes run only under their own chapter", () => {
  for (const id of ANIMATED) {
    const uses = [...css.matchAll(new RegExp(`[^{}]*\\{[^{}]*animation:[^{}]*sun-${id}-[^{}]*\\}`, "g"))];
    assert.ok(uses.length > 0, `nothing uses sun-${id}-`);
    for (const m of uses) assert.ok(m[0].includes(`[data-chapter="${id}"]`), `sun-${id}- runs outside its chapter: ${m[0].trim()}`);
  }
});

test("reduced motion turns every animation off", () => {
  const block = css.match(/@media \(prefers-reduced-motion: reduce\)\s*\{[\s\S]*$/);
  assert.ok(block, "no prefers-reduced-motion: reduce block");
  assert.ok(block[0].includes("animation: none"));
  assert.ok(block[0].includes("transition: none"));
});

test("the visually-hidden heading is clipped so it cannot scroll the page sideways", () => {
  const block = css.match(/\.visually-hidden\s*\{[^}]*\}/);
  assert.ok(block, "no .visually-hidden rule");
  assert.match(block[0], /overflow:\s*hidden/);
});

test("the wobble filter is never on a scene", () => {
  const scenes = stage.slice(stage.indexOf("data-scene="));
  assert.ok(!scenes.includes("filter="), "a scene group carries a filter");
});

test("no raster, video or canvas under app/(sun)/", () => {
  const SELF = import.meta.filename;
  for (const file of filesUnder(SUN).filter((f) => f !== SELF && /\.(?:[jt]sx?|css)$/.test(f))) {
    const text = readFileSync(file, "utf8");
    assert.doesNotMatch(text, /<image|<video|<canvas/i, file);
    assert.doesNotMatch(text, /\.(?:gif|png|jpe?g|webp|mp4|webm)\b/i, file);
  }
});
