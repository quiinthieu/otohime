// Planisphere's load motion, read from planisphere.css and wheel.tsx as text:
// the constellation lines draw on (pathLength="1"), the stars fade up as one
// group after them, the names and markers last; every keyframe is from-only, so
// the still is the finished chart; the disc's turn is unchanged and the island
// never remounts it; the reduced-motion block is last. Modelled on
// app/(orrery)/_lib/motion.test.ts, not shared with it. scripts/probe-motion.sh
// watches it run in a browser.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { test } from "node:test";

const GROUP = resolve(import.meta.dirname, "..");
const wheel = readFileSync(join(GROUP, "_components", "wheel.tsx"), "utf8");
const island = readFileSync(join(GROUP, "_components", "planisphere-app.tsx"), "utf8");
const css = readFileSync(join(GROUP, "planisphere.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

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
        out.push({ prelude: text.slice(start, open).trim().replace(/\s+/g, " "), body: text.slice(open + 1, i) });
        start = i + 1;
      }
    }
  }
  assert.equal(depth, 0, "planisphere.css has unbalanced braces");
  return out;
}

const top = blocks(css);
const selectors = (b: Block) => b.prelude.split(",").map((s) => s.trim());
const rules = (sel: string) => top.filter((b) => !b.prelude.startsWith("@") && selectors(b).includes(sel));
const keyframes = (name: string) => top.filter((b) => b.prelude === `@keyframes ${name}`);
const steps = (body: string) => blocks(body).map((b) => b.prelude);
const animation = (sel: string) => rules(sel).flatMap((b) => [...b.body.matchAll(/(?:^|;|\s)animation:\s*([^;]+);/g)].map((m) => m[1].trim()));
// The JSX element that carries an attribute, from its "<" to its ">".
const element = (attr: string) => {
  const found = [...wheel.matchAll(new RegExp(`<\\w+\\s[^<>]*\\b${attr}=""[^<>]*>`, "g"))].map((m) => m[0]);
  assert.equal(found.length, 1, `wheel.tsx has ${found.length} elements with ${attr}`);
  return found[0];
};

test("the new keyframes exist and each has only a from step", () => {
  for (const name of ["sky-draw", "sky-fade"]) {
    const k = keyframes(name);
    assert.equal(k.length, 1, `@keyframes ${name}`);
    assert.deepEqual(steps(k[0].body), ["from"], `@keyframes ${name}`);
  }
  assert.match(keyframes("sky-draw")[0].body, /from\s*\{\s*stroke-dashoffset:\s*1;\s*\}/);
  assert.match(keyframes("sky-fade")[0].body, /from\s*\{\s*opacity:\s*0;\s*\}/);
});

test("each constellation line measures 1, so one dash of 1 is the whole line", () => {
  const line = element("data-line");
  assert.match(line, /^<polyline\s/);
  assert.match(line, /\bpathLength="1"/);
  const rule = rules(".line-layer [data-line]");
  assert.equal(rule.length, 1);
  assert.match(rule[0].body, /stroke-dasharray:\s*1;/);
  assert.doesNotMatch(rule[0].body, /stroke-dashoffset/, "the base style must be the drawn line");
});

test("the lines draw over 0.9 s, the stars fade up 0.4 s in, the rest from 1.3 s", () => {
  assert.deepEqual(animation(".line-layer [data-line]"), ["sky-draw 0.9s ease-out"]);
  assert.deepEqual(animation(".star-layer"), ["sky-fade 0.6s ease-out 0.4s backwards"]);
  for (const sel of [".ecliptic-layer", ".name-layer", ".wheel [data-sun]", ".wheel [data-moon]"]) {
    assert.deepEqual(animation(sel), ["sky-fade 0.5s ease-out 1.3s backwards"], sel);
  }
});

test("the stars fade as one group: no star carries a style or a delay of its own", () => {
  const star = element("data-star");
  assert.match(star, /^<circle\s/);
  assert.doesNotMatch(star, /\bstyle=/);
  assert.doesNotMatch(wheel, /animation-?[Dd]elay|animationDelay/);
  assert.match(wheel, /<g aria-hidden="true" className="star-layer">/);
  // nothing in the stylesheet reaches a single star
  assert.ok(!top.some((b) => !b.prelude.startsWith("@") && /\[data-star\]/.test(b.prelude) && /animation/.test(b.body)));
});

test("the disc keeps its 0.4 s turn and is never remounted", () => {
  const disc = rules(".wheel [data-disc]");
  assert.equal(disc.length, 1);
  assert.match(disc[0].body, /transition:\s*transform 0\.4s ease-out;/);
  assert.doesNotMatch(disc[0].body, /animation/);
  // The disc has no key, and the island turns it by its style rather than by rendering the wheel.
  assert.match(wheel, /<g\s+data-disc=""\s+role="slider"/);
  assert.doesNotMatch(element("data-disc"), /\bkey=/);
  assert.doesNotMatch(island, /<Wheel\b/);
  assert.match(island, /el\.style\.transform = `rotate\(/);
});

test("the still is the finished chart: nothing outside @keyframes hides ink or offsets a dash", () => {
  for (const b of top.filter((x) => !x.prelude.startsWith("@"))) {
    assert.doesNotMatch(b.body, /opacity:\s*0\s*;/, `${b.prelude} sets opacity: 0`);
    assert.doesNotMatch(b.body, /stroke-dashoffset/, `${b.prelude} offsets a dash`);
    if (/animation:[^;]*\bsky-/.test(b.body)) assert.doesNotMatch(b.body, /animation:[^;]*\b(?:both|forwards)\b/, `${b.prelude} holds the sky's start after its end`);
  }
});

test("the reduced-motion block is last and stops the draw-on, the turn and the hop", () => {
  const reduced = top.filter((b) => /^@media[^{]*prefers-reduced-motion:\s*reduce/.test(b.prelude));
  assert.equal(reduced.length, 1);
  assert.equal(top.at(-1), reduced[0]);
  assert.match(reduced[0].body, /\*[\s\S]*\{[^}]*animation:\s*none\s*!important/);
  assert.match(reduced[0].body, /transition:\s*none\s*!important/);
  assert.match(reduced[0].body, /::view-transition-group\(\*\)/);
});
