// Barometer's load motion, read from barometer.css and station.tsx as text: the
// four instruments settle in turn, every keyframe is from-only (so the still is
// the reading), the quiet face stays still, and the reduced-motion block is
// last. Modelled on app/(orrery)/_lib/motion.test.ts, not shared with it.
// scripts/probe-motion.sh watches it run in a browser.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { test } from "node:test";

const GROUP = resolve(import.meta.dirname, "..");
const station = readFileSync(join(GROUP, "_components", "station.tsx"), "utf8");
const css = readFileSync(join(GROUP, "barometer.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

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
  assert.equal(depth, 0, "barometer.css has unbalanced braces");
  return out;
}

const top = blocks(css);
const selectors = (b: Block) => b.prelude.split(",").map((s) => s.trim());
const rules = (sel: string) => top.filter((b) => !b.prelude.startsWith("@") && selectors(b).includes(sel));
const keyframes = (name: string) => top.filter((b) => b.prelude === `@keyframes ${name}`);
// The steps of a @keyframes body: "from", "to", "50%".
const steps = (body: string) => blocks(body).map((b) => b.prelude);
const animation = (sel: string) => rules(sel).flatMap((b) => [...b.body.matchAll(/(?:^|;|\s)animation:\s*([^;]+);/g)].map((m) => m[1].trim()));

const INSTRUMENTS = [
  { sel: ".needle", name: "swing", delay: 0 },
  { sel: "rect.mercury", name: "rise", delay: 0.15 },
  { sel: ".arrow", name: "vane-swing", delay: 0.3 },
  { sel: ".water", name: "rise", delay: 0.45 },
];

test("the four instruments animate at 1.1 s ease-out, 0.15 s apart", () => {
  for (const { sel, name, delay } of INSTRUMENTS) {
    const a = animation(sel);
    assert.equal(a.length, 1, `${sel} has ${a.length} animation declarations`);
    const want = delay === 0 ? `${name} 1.1s ease-out` : `${name} 1.1s ease-out ${delay}s backwards`;
    assert.equal(a[0], want, sel);
  }
});

test("the new keyframes exist and each has only a from step", () => {
  for (const name of ["swing", "rise", "vane-swing"]) {
    const k = keyframes(name);
    assert.equal(k.length, 1, `@keyframes ${name}`);
    assert.deepEqual(steps(k[0].body), ["from"], `@keyframes ${name}`);
  }
  assert.match(keyframes("rise")[0].body, /from\s*\{\s*transform:\s*scaleY\(0\);\s*\}/);
  assert.match(keyframes("vane-swing")[0].body, /from\s*\{\s*transform:\s*rotate\(0(?:deg)?\);\s*\}/);
});

test("the mercury and the water grow from their own bottom edge", () => {
  const origin = top.filter((b) => !b.prelude.startsWith("@") && selectors(b).includes("rect.mercury") && selectors(b).includes(".water"));
  assert.equal(origin.length, 1);
  assert.match(origin[0].body, /transform-box:\s*fill-box;/);
  assert.match(origin[0].body, /transform-origin:\s*bottom;/);
});

test("the quiet face turns all four off", () => {
  const quiet = top.filter((b) => !b.prelude.startsWith("@") && /animation:\s*none/.test(b.body) && selectors(b).every((s) => s.startsWith('[data-face="quiet"] ')));
  assert.equal(quiet.length, 1, "no single quiet-face animation: none rule");
  assert.deepEqual(
    selectors(quiet[0]).map((s) => s.slice('[data-face="quiet"] '.length)).sort(),
    INSTRUMENTS.map((i) => i.sel).sort(),
  );
});

test("station.tsx draws each animated part with the class the stylesheet names", () => {
  assert.match(station, /<rect className="mercury" data-mercury=/);
  assert.match(station, /<g className="needle" data-needle=/);
  assert.match(station, /<g className="arrow" data-vane=/);
  assert.match(station, /<rect className="water" data-cup=/);
  assert.match(station, /data-face=\{reading \? "reading" : "quiet"\}/);
});

test("the still is the reading: nothing outside @keyframes hides or empties an instrument", () => {
  for (const b of top.filter((x) => !x.prelude.startsWith("@"))) {
    assert.doesNotMatch(b.body, /opacity:\s*0\s*;/, `${b.prelude} sets opacity: 0`);
    assert.doesNotMatch(b.body, /transform:\s*scaleY\(0\)/, `${b.prelude} empties a part`);
  }
  // fill-mode backwards only holds the start during the delay; nothing holds the start after the end
  assert.doesNotMatch(css, /animation:[^;]*\b(?:both|forwards)\b[^;]*\b(?:rise|swing|vane-swing)\b|animation:[^;]*\b(?:rise|swing|vane-swing)\b[^;]*\b(?:both|forwards)\b/);
});

test("the reduced-motion block is last and stops the animations and the hop", () => {
  const reduced = top.filter((b) => /^@media[^{]*prefers-reduced-motion:\s*reduce/.test(b.prelude));
  assert.equal(reduced.length, 1);
  assert.equal(top.at(-1), reduced[0]);
  assert.match(reduced[0].body, /\*[\s\S]*\{[^}]*animation:\s*none\s*!important/);
  assert.match(reduced[0].body, /::view-transition-group\(\*\)/);
});
