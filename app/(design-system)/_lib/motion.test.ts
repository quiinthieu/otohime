// Design system's motion, read from design-system.css and the island as text:
// a part's <use> glides its fill, stroke and place at the Speed pot
// (var(--board-speed), which the island sets from the pots on the <svg>); the
// parts a turn moved are marked in --hot for 500 ms and lifted 2 px; the box,
// follow and here figures ink on once over 600 ms; and the stylesheet's last
// block, under reduced motion, zeroes the parts' transitions, the draw-on and
// the hop. No browser: scripts/probe-design-system.sh and
// scripts/probe-motion.sh watch it run. Modelled on Structures', not shared.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { test } from "node:test";

const GROUP = resolve(import.meta.dirname, "..");
const css = readFileSync(join(GROUP, "design-system.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
const island = readFileSync(join(GROUP, "_components", "board-app.tsx"), "utf8");

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
  assert.equal(depth, 0, "design-system.css has unbalanced braces");
  return out;
}

const top = blocks(css);
const selectors = (b: Block) => b.prelude.split(",").map((s) => s.trim());
const rule = (sel: string) => top.filter((b) => !b.prelude.startsWith("@") && selectors(b).includes(sel));
const reduced = top.filter((b) => /^@media[^{]*prefers-reduced-motion:\s*reduce/.test(b.prelude));

test("a part's <use> glides its fill, stroke and place at the Speed pot, about its own box", () => {
  const glide = rule(".board-svg use");
  assert.equal(glide.length, 1);
  const props = glide[0].body.match(/transition-property:\s*([^;]+);/)?.[1].split(",").map((p) => p.trim()) ?? [];
  for (const p of ["fill", "stroke", "transform"]) assert.ok(props.includes(p), `transition-property lacks ${p}: ${props.join(", ")}`);
  assert.match(glide[0].body, /transition-duration:\s*var\(--board-speed\)\s*;/);
  assert.match(glide[0].body, /transform-box:\s*fill-box/);
  // the colours are the part's --part-*, which the island points at the pots
  assert.match(glide[0].body, /fill:\s*var\(--part-accent\)/);
  assert.match(glide[0].body, /stroke:\s*var\(--part-ink\)/);
});

test("the island sets the pots on the <svg>, Speed in ms, and points every part at them with the system on", () => {
  for (const pot of ["paper", "ink", "spot", "face", "speed"]) assert.match(island, new RegExp(`"--board-${pot}":`), `--board-${pot}`);
  assert.match(island, /"--board-speed": `\$\{p\.speed\}ms`/);
  assert.match(island, /"--part-accent": "var\(--board-spot\)"/);
  assert.match(island, /"--part-ink": "var\(--board-ink\)"/);
  // a gap moves a part by its transform, a corner swaps its href
  assert.match(island, /transform: `translate\(\$\{part\.x\}px, \$\{part\.y\}px\)`/);
  assert.match(island, /href=\{`#\$\{part\.stamp\}`\}/);
});

test("the parts a turn moved are marked in --hot for 500 ms and lifted 2 px, without overriding where they stand", () => {
  const hot = rule(".board-svg use[data-hot]");
  assert.equal(hot.length, 1);
  assert.match(hot[0].body, /var\(--hot\)/);
  // translate, not transform: the part's place is its inline transform
  assert.match(hot[0].body, /translate:\s*0 -2px/);
  assert.doesNotMatch(hot[0].body, /transform:/);
  assert.match(island, /const HOT_MS = 500;/);
  assert.match(island, /setTimeout\(\(\) => dispatch\(\{ type: "cool", beat \}\), HOT_MS\)/);
  assert.match(island, /return \(\) => clearTimeout\(id\)/);
  assert.match(island, /data-hot=\{lit\(part\.part\)\}/);
});

test("the figures ink on once, over 600 ms, and their still is the whole drawing", () => {
  assert.match(rule(".draw .ink path")[0]?.body ?? "", /animation:\s*ink-draw 600ms\b/);
  assert.match(rule(".draw .spot path")[0]?.body ?? "", /animation:\s*ink-draw 600ms\b/);
  const draw = top.find((b) => b.prelude === "@keyframes ink-draw")!;
  assert.match(draw.body, /from\s*\{[^}]*stroke-dashoffset:\s*1;/);
  assert.match(draw.body, /to\s*\{[^}]*stroke-dashoffset:\s*0;/);
  for (const b of top.filter((x) => !x.prelude.startsWith("@"))) {
    assert.doesNotMatch(b.body, /stroke-dash(?:offset|array)/, `${b.prelude} dashes the ink`);
    assert.doesNotMatch(b.body, /opacity:\s*0\s*;/, `${b.prelude} hides something`);
    assert.doesNotMatch(b.body, /infinite/, `${b.prelude} loops`);
  }
});

test("the h1 is named for the hop from /projects", () => {
  const h1 = rule("h1").filter((b) => /view-transition-name/.test(b.body));
  assert.equal(h1.length, 1);
  assert.match(h1[0].body, /view-transition-name:\s*project-design-system\s*;/);
});

test("the reduced-motion block is last and zeroes the parts' transitions, the draw-on and the hop", () => {
  assert.equal(reduced.length, 1);
  assert.equal(top.at(-1), reduced[0]);
  const body = reduced[0].body;
  assert.match(body, /\*,\s*\*::before,\s*\*::after\s*\{[^}]*transition:\s*none\s*!important;[^}]*animation:\s*none\s*!important/);
  assert.match(body, /\.board-svg use,\s*\.board-svg \.word,\s*\.board-svg \.screen,\s*\.draw path\s*\{[^}]*transition:\s*none\s*!important;[^}]*animation:\s*none\s*!important/);
  assert.match(body, /::view-transition-group\(\*\),\s*::view-transition-old\(\*\),\s*::view-transition-new\(\*\)\s*\{[^}]*animation-duration:\s*0s\s*!important;[^}]*animation-delay:\s*0s\s*!important/);
});
