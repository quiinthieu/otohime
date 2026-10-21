// Structures' motion, read from structures.css and the island as text: the
// stamps glide with a 150 ms transform transition, the lit one lifts, the In
// life drawing inks on over 600 ms, the island ticks at play.ts's 12 fps, and
// the stylesheet's last block, under reduced motion, zeroes the stamps'
// transitions, the draw-on and the hop. No browser: scripts/probe-structures.sh
// and scripts/probe-motion.sh watch it run.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { test } from "node:test";

const GROUP = resolve(import.meta.dirname, "..");
const css = readFileSync(join(GROUP, "structures.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
const island = readFileSync(join(GROUP, "_components", "machine-app.tsx"), "utf8");

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
  assert.equal(depth, 0, "structures.css has unbalanced braces");
  return out;
}

const top = blocks(css);
const selectors = (b: Block) => b.prelude.split(",").map((s) => s.trim());
const rule = (sel: string) => top.filter((b) => !b.prelude.startsWith("@") && selectors(b).includes(sel));
const reduced = top.filter((b) => /^@media[^{]*prefers-reduced-motion:\s*reduce/.test(b.prelude));

test("a stamp glides to its new place: transform 150 ms on its <use>, about its own box", () => {
  const glide = rule(".machine-svg use");
  assert.equal(glide.length, 1);
  assert.match(glide[0].body, /transition:\s*transform 150ms\b/);
  assert.match(glide[0].body, /transform-box:\s*fill-box/);
  assert.ok(selectors(glide[0]).includes(".machine-svg .stamp-text"), "a stamp's lettering glides with it");
  // a hand turns about its tip, which is its own origin
  assert.match(rule(".machine-svg use.hand")[0]?.body ?? "", /transform-box:\s*view-box/);
});

test("the stamp being looked at is lit in --hot and lifted 2 px, without overriding where it stands", () => {
  const hot = rule(".machine-svg use[data-hot]");
  assert.equal(hot.length, 1);
  assert.match(hot[0].body, /color:\s*var\(--hot\)/);
  assert.match(hot[0].body, /fill:\s*var\(--hot-wash\)/);
  // translate, not transform: the stamp's place is its inline transform
  assert.match(hot[0].body, /translate:\s*0 -2px/);
  assert.doesNotMatch(hot[0].body, /transform:/);
  assert.match(island, /data-hot=\{lit\(p\.id\)\}/);
  assert.match(island, /style=\{at\(p\.x, p\.y\)\}/);
});

test("the In life drawing inks on once, over 600 ms, and its still is the whole drawing", () => {
  assert.match(rule(".life path")[0]?.body ?? "", /animation:\s*ink-draw 600ms\b/);
  const draw = top.find((b) => b.prelude === "@keyframes ink-draw")!;
  assert.match(draw.body, /from\s*\{[^}]*stroke-dashoffset:\s*1;/);
  assert.match(draw.body, /to\s*\{[^}]*stroke-dashoffset:\s*0;/);
  for (const b of top.filter((x) => !x.prelude.startsWith("@"))) {
    assert.doesNotMatch(b.body, /stroke-dash(?:offset|array)/, `${b.prelude} dashes the ink`);
    assert.doesNotMatch(b.body, /opacity:\s*0\s*;/, `${b.prelude} hides something`);
    assert.doesNotMatch(b.body, /infinite/, `${b.prelude} loops`);
  }
});

test("the island ticks at play.ts's rate only while a move plays, and settles under reduced motion", () => {
  assert.match(island, /setInterval\(\(\) => dispatch\(\{ type: "tick" \}\), TICK_MS\)/);
  assert.match(island, /if \(!playing\) return;/);
  assert.match(island, /return \(\) => clearInterval\(id\)/);
  assert.match(island, /matchMedia\(REDUCED\)/);
  assert.match(island, /const REDUCED = "\(prefers-reduced-motion: reduce\)";/);
  assert.match(island, /e\.reduced && p\.mode === "play" \? settle\(played\) : played/);
});

test("the h1 is named for the hop from /projects", () => {
  const h1 = rule("h1").filter((b) => /view-transition-name/.test(b.body));
  assert.equal(h1.length, 1);
  assert.match(h1[0].body, /view-transition-name:\s*project-structures\s*;/);
});

test("the reduced-motion block is last and zeroes the stamps' transitions, the draw-on and the hop", () => {
  assert.equal(reduced.length, 1);
  assert.equal(top.at(-1), reduced[0]);
  const body = reduced[0].body;
  assert.match(body, /\*,\s*\*::before,\s*\*::after\s*\{[^}]*transition:\s*none\s*!important;[^}]*animation:\s*none\s*!important/);
  assert.match(body, /\.machine-svg use,\s*\.machine-svg \.stamp-text,\s*\.life path\s*\{[^}]*transition:\s*none\s*!important;[^}]*animation:\s*none\s*!important/);
  assert.match(body, /::view-transition-group\(\*\),\s*::view-transition-old\(\*\),\s*::view-transition-new\(\*\)\s*\{[^}]*animation-duration:\s*0s\s*!important;[^}]*animation-delay:\s*0s\s*!important/);
});
