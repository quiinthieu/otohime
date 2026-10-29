import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { test } from "node:test";
import { site } from "../../../../../content/site.ts";
import { DESK_ITEMS } from "../../../../../lib/desk.ts";
import { stringPath } from "../../../../../lib/desk-string.ts";
import { CONSOLE_MENU } from "../../../../../lib/pages.ts";
import { anchor, CORK, DRAG_THRESHOLD, dropAt, pastThreshold, PIN_PAIRS, pinHomes, parsePins, serializePins, PINS, PINS_KEY, rebase, STACKED, turn } from "./drag.ts";

const DIR = resolve(import.meta.dirname, "..");
const read = (p: string) => readFileSync(join(DIR, p), "utf8");
const css = () => read("desk.css").replace(/\/\*[\s\S]*?\*\//g, "");

test("a press is a click until it travels the threshold, about 6 px, in any direction", () => {
  assert.equal(DRAG_THRESHOLD, 6);
  assert.equal(pastThreshold(0, 0), false);
  assert.equal(pastThreshold(5.9, 0), false);
  assert.equal(pastThreshold(4, 4), false); // 5.66 px on the diagonal
  assert.equal(pastThreshold(0, -6), true);
  assert.equal(pastThreshold(-5, 4), true); // 6.4 px
  assert.equal(pastThreshold(3, 0, 2), true);
});

test("a drop moves the spot by the offset over the surface's size and keeps it on the surface", () => {
  const size = { w: 800, h: 500 };
  assert.deepEqual(dropAt({ x: 0.5, y: 0.5 }, 80, -50, size), { x: 0.6, y: 0.4 });
  assert.deepEqual(dropAt({ x: 0.9, y: 0.1 }, 400, -400, size), { x: 1, y: 0 });
  assert.deepEqual(dropAt({ x: 0.1, y: 0.9 }, -400, 400, size), { x: 0, y: 1 });
  // A surface not laid out yet leaves the spot alone instead of dividing by zero.
  assert.deepEqual(dropAt({ x: 0.3, y: 0.7 }, 50, 50, { w: 0, h: 500 }), { x: 0.3, y: 0.7 });
});

test("rebase keeps a body drawn where it is when its spot moves, so the spring settles it, not a jump", () => {
  const size = { w: 800, h: 500 };
  const from = { x: 0.5, y: 0.5 };
  // Dropped inside: the whole offset becomes the new spot, and nothing is left to travel.
  const to = dropAt(from, 80, -50, size);
  const left = rebase({ x: 80, y: -50 }, from, to, size);
  assert.ok(Math.abs(left.x) < 1e-9 && Math.abs(left.y) < 1e-9, JSON.stringify(left));
  // Thrown past the edge: the spot stops at the edge and the overshoot is what springs back.
  const edge = dropAt(from, 600, 0, size);
  assert.deepEqual(edge, { x: 1, y: 0.5 });
  assert.deepEqual(rebase({ x: 600, y: 0 }, from, edge, size), { x: 200, y: 0 });
  // Drawn position = spot in px + offset, the same before and after.
  const before = from.x * size.w + 600;
  assert.equal(edge.x * size.w + rebase({ x: 600, y: 0 }, from, edge, size).x, before);
});

test("turn is the near way round, so tidying a lean of 350 degrees springs back 10, not 350", () => {
  assert.equal(turn(350, 0), -10);
  assert.equal(turn(-8, 0), -8);
  assert.equal(turn(10, 0), 10);
  assert.equal(turn(0, 0), 0);
  assert.equal(turn(180, 0), 180);
  assert.equal(turn(-170, 170), 20);
});

test("a pin's head is its spot in cork units, plus its px offset at the cork's width", () => {
  assert.deepEqual(anchor({ x: 0.5, y: 0.5 }, { x: 0, y: 0 }, 0), { x: CORK.w / 2, y: CORK.h / 2 });
  // A 200 px cork is half the 400 units: 10 px is 20 units.
  assert.deepEqual(anchor({ x: 0, y: 0 }, { x: 10, y: -5 }, 200), { x: 20, y: -10 });
  // Unmeasured, an offset counts for nothing rather than NaN.
  assert.deepEqual(anchor({ x: 0.25, y: 0 }, { x: 10, y: 10 }, 0), { x: 100, y: 0 });
});

test("the pins are real projects from /projects, on the cork, with unique ids", () => {
  assert.equal(PINS.length, 5);
  assert.equal(new Set(PINS.map((p) => p.id)).size, PINS.length);
  for (const pin of PINS) {
    const project = site.projectList.find((p) => p.title === pin.title);
    assert.ok(project, pin.title);
    assert.equal(pin.href, project.href);
    assert.equal(pin.note, project.note);
    assert.ok(pin.x >= 0 && pin.x <= 1 && pin.y >= 0 && pin.y <= 1, pin.id);
  }
  assert.deepEqual(pinHomes()[PINS[0].id], { x: PINS[0].x, y: PINS[0].y });
});

test("the red string joins the projects that share a tag, and every pair sags into a quadratic", () => {
  assert.deepEqual(PIN_PAIRS, [
    ["orrery", "planisphere"],
    ["planisphere", "barometer"],
    ["elements", "gazette"],
  ]);
  const homes = pinHomes();
  for (const [a, b] of PIN_PAIRS) {
    const d = stringPath(anchor(homes[a], { x: 0, y: 0 }, 0), anchor(homes[b], { x: 0, y: 0 }, 0));
    assert.match(d, /^M [\d.]+ [\d.]+ Q [\d.]+ [\d.]+ [\d.]+ [\d.]+$/, d);
  }
});

test("pin storage restores known positions, clamps edges and recovers corrupt or older layouts", () => {
  const homes = pinHomes();
  const id = PINS[0].id;
  const moved = { ...homes, [id]: { x: 0.5, y: 0.75 } };
  assert.deepEqual(parsePins(serializePins(moved)), moved);
  for (const raw of [null, "broken", "{}", JSON.stringify({ v: "old", pins: moved })]) {
    assert.deepEqual(parsePins(raw), homes);
  }
  const raw = JSON.stringify({ v: PINS_KEY, pins: { [id]: { x: -1, y: 2 }, unknown: { x: 1, y: 1 } } });
  assert.deepEqual(parsePins(raw), { ...homes, [id]: { x: 0, y: 1 } });
  assert.deepEqual(parsePins(JSON.stringify({ v: PINS_KEY, pins: { [id]: { x: "bad", y: 0 } } })), homes);
});

// The wiring, read as source: the component's DOM work is not runnable under node --test.
test("the page names its h1 for the console's desk cartridge and draws the desk", () => {
  assert.ok(CONSOLE_MENU.some((page) => page.href === "/desk"));
  const page = read("page.tsx");
  assert.match(page, /<FigTitle n="\d+" morph="\/desk"/);
  assert.match(page, /<InkDesk\b/);
  assert.match(page, /import "\.\/desk\.css";/);
});

test("the objects are real links in the registry's order, and the stack order is only z-index", () => {
  const desk = read("_components/ink-desk.tsx");
  assert.match(desk, /^"use client";/);
  assert.match(desk, /\{DESK_ITEMS\.map\(\(entry\) => \{/);
  assert.match(desk, /<Link\s+href=\{entry\.href\}\s+className="desk-link"\s+draggable=\{false\}[^>]*?onClick=\{\(event\) => onItemClick\(entry\.id, event\)\}\s*>/);
  assert.match(desk, /zIndex: item\.z \+ 1/);
  // The layout's order is never what the list renders.
  assert.doesNotMatch(desk, /\bdesk\.map\(\(item\) => \(?\s*<li/);
  assert.ok(DESK_ITEMS.every((item) => item.href.startsWith("/")));
});

test("the layout is kept with useSyncExternalStore and parseDesk under desk:v1, and Tidy up resets it", () => {
  const desk = read("_components/ink-desk.tsx");
  assert.match(desk, /useSyncExternalStore\(subscribe, getLayout, getServerLayout\)/);
  assert.match(desk, /parseDesk\(localStorage\.getItem\(DESK_KEY\)\)/);
  assert.match(desk, /localStorage\.setItem\(DESK_KEY, serializeDesk\(next\)\)/);
  assert.match(desk, /const next = tidy\(layout\);[\s\S]*saveLayout\(next\);\s*savePins\(homes\);/);
  assert.match(desk, /onClick=\{tidyUp\}/);
  assert.doesNotMatch(desk, /Math\.random/);
});

test("a drag past the threshold captures the pointer, swallows its click and springs on rAF; the string follows", () => {
  const desk = read("_components/ink-desk.tsx");
  const move = desk.slice(desk.indexOf("function onPointerMove"), desk.indexOf("function onPointerEnd"));
  assert.match(move, /if \(!pastThreshold\(dx, dy\)\) return;[\s\S]*setPointerCapture/);
  assert.match(desk, /swallow\.current = dropped;/);
  assert.match(desk, /event\.preventDefault\(\);/);
  const tick = desk.slice(desk.indexOf("function tick"), desk.indexOf("function kick"));
  assert.match(tick, /advance\(m\.x, m\.tx, dt\)/);
  assert.match(tick, /paintStrings\(\);/);
  assert.match(tick, /requestAnimationFrame\(tick\)/);
  assert.match(desk, /wobble\(m\.x\.v\)/);
  assert.match(desk, /setAttribute\("d", stringPath\(headOf\(a\), headOf\(b\)\)\)/);
});

test("touch-action: none is on the drag handles only: the tape and the pins", () => {
  const sheet = css();
  const rules = [...sheet.matchAll(/([^{}]+)\{([^}]*)\}/g)].filter((m) => /touch-action\s*:\s*none/.test(m[2]));
  assert.deepEqual(
    rules.map((m) => m[1].trim()).sort(),
    [".desk-pin", ".desk-tape"],
  );
  for (const file of ["_components/ink-desk.tsx", "_components/desk-art.tsx"]) {
    // No inline style sets it either (the comments may name it).
    assert.doesNotMatch(read(file).replace(/^\s*\/\/.*$/gm, ""), /touch-?action/i, file);
  }
  // Nothing on the desk transitions its transform: the frames are the component's. The one transition rule
  // there is turns them all off.
  assert.deepEqual([...sheet.matchAll(/transition\s*:\s*([^;]+);/g)].map((m) => m[1]), ["none"]);
});

// The rules inside one @media block of desk.css, by selector.
function mediaRules(query: string): Map<string, string> {
  const sheet = css();
  const at = sheet.indexOf(`@media ${query} {`);
  assert.ok(at >= 0, `desk.css has @media ${query}`);
  let depth = 0;
  let end = sheet.indexOf("{", at);
  for (; end < sheet.length; end++) {
    if (sheet[end] === "{") depth++;
    else if (sheet[end] === "}" && --depth === 0) break;
  }
  const body = sheet.slice(sheet.indexOf("{", at) + 1, end);
  const rules = new Map<string, string>();
  for (const m of body.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
    for (const sel of m[1].split(",")) rules.set(sel.trim(), (rules.get(sel.trim()) ?? "") + m[2]);
  }
  return rules;
}
const has = (rules: Map<string, string>, sel: string, decl: RegExp) => assert.match(rules.get(sel) ?? "", decl, `${sel} ${decl}`);

test("STACKED is a narrow or a coarse-pointer screen, and desk.css stacks the desk under that very query", () => {
  assert.equal(STACKED, "(max-width: 40rem), (pointer: coarse)");
  const stack = mediaRules(STACKED);
  // No string, no menu, nothing to tidy.
  for (const sel of [".desk-string", ".desk-menu", ".desk-bar"]) has(stack, sel, /display: none;/);
  // The items and the pins leave their spots: the inline left, top, z-index and transform are overruled.
  for (const sel of [".desk-item", ".desk-pin"]) {
    has(stack, sel, /position: relative;/);
    has(stack, sel, /inset: auto !important;/);
    has(stack, sel, /z-index: auto !important;/);
    has(stack, sel, /transform: none !important;/);
    has(stack, sel, /touch-action: auto;/);
  }
  has(stack, ".desk-tape", /touch-action: auto;/);
  has(stack, ".desk", /aspect-ratio: auto;/);
  has(stack, ".desk-items", /display: grid;/);
  has(stack, ".desk-cork", /position: static;/);
});

test("the stacked desk is the same markup: render never reads the media, only the handlers do", () => {
  const desk = read("_components/ink-desk.tsx");
  assert.match(desk, /const stacked = \(\) => matchMedia\(STACKED\)\.matches;/);
  // Every matchMedia call is inside a function body that runs on an event, none in the JSX.
  const jsx = desk.slice(desk.indexOf("  return (\n    <div className=\"desk-wrap\">"));
  assert.ok(jsx.length > 100);
  assert.doesNotMatch(jsx, /matchMedia|stacked\(\)/);
  assert.doesNotMatch(desk, /useSyncExternalStore\([^)]*(STACKED|matchMedia)/);
  // A press, a right click and the desk's keys all stand aside on the stacked desk.
  const fn = (name: string) => desk.slice(desk.indexOf(`function ${name}(`), desk.indexOf("\n  }\n", desk.indexOf(`function ${name}(`)));
  assert.match(fn("onPointerDown"), /if \(press\.current \|\| !event\.isPrimary \|\| event\.button !== 0 \|\| stacked\(\)\) return;/);
  assert.match(fn("onContextMenu"), /^[^]*?\{\n\s*if \(stacked\(\)\) return;\n\s*event\.preventDefault\(\);/);
  assert.match(fn("onItemKey"), /\|\| stacked\(\)\) return;/);
});

test("reduced motion: nothing on the desk or in it transitions or animates, and the springs snap", () => {
  const still = mediaRules("(prefers-reduced-motion: reduce)");
  for (const sel of [".desk-wrap", ".desk-wrap *"]) {
    has(still, sel, /transition: none;/);
    has(still, sel, /animation: none;/);
    // Not !important: the site's own reset is !important on durations only, so this one stays readable.
    assert.doesNotMatch(still.get(sel) ?? "", /!important/);
  }
  const desk = read("_components/ink-desk.tsx");
  const kick = desk.slice(desk.indexOf("function kick"), desk.indexOf("if (frame.current) return;"));
  assert.match(kick, /if \(matchMedia\(REDUCED\)\.matches\)/);
  assert.match(kick, /m\.x = \{ x: m\.tx, v: 0 \};/);
  assert.match(kick, /m\.r = REST;/);
  // An open under way lands at once and changes the page.
  assert.match(kick, /f\.s = \{ x: f\.to, v: 0 \};[\s\S]*flipLanded\(\);[\s\S]*return;/);
});

test("the cork keeps the string's aspect, so the SVG scales evenly", () => {
  assert.match(css(), new RegExp(`\\.desk-cork \\{[^}]*aspect-ratio: ${CORK.w} / ${CORK.h};`));
  assert.match(read("_components/ink-desk.tsx"), /viewBox=\{`0 0 \$\{CORK\.w\} \$\{CORK\.h\}`\}/);
});
