// The long press on fake timers, and the desk's wiring of the radial menu, the
// keys, the live line, the sounds and the notebook's leaves, read as source.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { test } from "node:test";
import { DRAG_THRESHOLD } from "./drag.ts";
import { LONG_PRESS_MS, longPress, type Timers } from "./long-press.ts";

const DIR = resolve(import.meta.dirname, "..");
const read = (p: string) => readFileSync(join(DIR, p), "utf8");

// A clock that only moves when told.
function fakeClock() {
  let now = 0;
  let next = 1;
  const due = new Map<number, { at: number; fire: () => void }>();
  const timers: Timers = {
    set: (fire, ms) => {
      due.set(next, { at: now + ms, fire });
      return next++;
    },
    clear: (id) => due.delete(id as number),
  };
  const tick = (ms: number) => {
    now += ms;
    for (const [id, t] of [...due]) {
      if (t.at <= now) {
        due.delete(id);
        t.fire();
      }
    }
  };
  return { timers, tick, pending: () => due.size };
}

test("held still for 500 ms, a press fires once", () => {
  assert.equal(LONG_PRESS_MS, 500);
  const clock = fakeClock();
  let fired = 0;
  const lp = longPress(() => fired++, clock.timers);
  lp.start(100, 100);
  clock.tick(499);
  assert.equal(fired, 0);
  assert.equal(lp.fired, false);
  clock.tick(1);
  assert.equal(fired, 1);
  assert.equal(lp.fired, true);
  clock.tick(5000);
  assert.equal(fired, 1);
});

test("a wobble under the drag threshold keeps the clock; moving past it cancels for good", () => {
  const clock = fakeClock();
  let fired = 0;
  const lp = longPress(() => fired++, clock.timers);
  lp.start(100, 100);
  lp.move(103, 104); // 5 px
  clock.tick(500);
  assert.equal(fired, 1, "a 5 px wobble is still a hold");

  lp.start(100, 100);
  clock.tick(300);
  lp.move(100 + DRAG_THRESHOLD, 100);
  assert.equal(clock.pending(), 0);
  lp.move(100, 100); // coming back does not restart it
  clock.tick(1000);
  assert.equal(fired, 1);
  assert.equal(lp.fired, false);
});

test("letting go first is a click: cancel stops the clock, and a new press starts a fresh one", () => {
  const clock = fakeClock();
  let fired = 0;
  const lp = longPress(() => fired++, clock.timers);
  lp.start(0, 0);
  clock.tick(400);
  lp.cancel();
  clock.tick(400);
  assert.equal(fired, 0);
  // A second start before the first fires replaces it, measured from the new press.
  lp.start(0, 0);
  clock.tick(300);
  lp.start(50, 50);
  clock.tick(300);
  assert.equal(fired, 0);
  assert.equal(clock.pending(), 1);
  clock.tick(200);
  assert.equal(fired, 1);
});

const desk = () => read("_components/ink-desk.tsx");
const section = (src: string, from: string, to: string) => src.slice(src.indexOf(from), src.indexOf(to, src.indexOf(from)));

test("a press on an item starts the long press, a drag or a let-go stops it, and a hold opens the menu and eats the click", () => {
  const src = desk();
  const down = section(src, "function onPointerDown", "function onPointerMove");
  assert.match(down, /hold\.start\(event\.clientX, event\.clientY\)/);
  const move = section(src, "function onPointerMove", "function onPointerEnd");
  assert.match(move, /p\.held\) return;/);
  assert.match(move, /hold\.move\(event\.clientX, event\.clientY\)/);
  assert.match(move, /p\.moved = true;\s*hold\.cancel\(\);/);
  const end = section(src, "function onPointerEnd", "function tidyUp");
  assert.match(end, /hold\.cancel\(\);/);
  assert.match(end, /if \(p\.held\) \{\s*swallow\.current = true;/);
  assert.match(src, /longPress\(\(\) => \{[\s\S]*?p\.held = true;[\s\S]*?openMenu\(p\.key\.slice\(5\)\);/);
  // The menu opens under the pointer, so the hold captures it: its let-go still ends the press on the item.
  assert.match(src, /p\.held = true;[\s\S]*?bodies\.current\.get\(p\.key\)\?\.setPointerCapture\(p\.pointerId\);[\s\S]*?openMenu/);
  assert.match(down, /if \(press\.current\?\.held\) press\.current = null;\s*if \(press\.current \|\|/);
  // A right click or the touch browser's own long-press menu opens ours instead.
  assert.match(src, /onContextMenu=\{\(event\) => onContextMenu\(entry\.id, event\)\}/);
  assert.match(section(src, "function onContextMenu", "\n  }\n"), /event\.preventDefault\(\);/);
});

test("the menu is a role=menu of three menuitems that take the focus; Esc and Tab close it and refocus the item", () => {
  const src = desk();
  assert.match(src, /role="menu"/);
  assert.match(src, /\{MENU\.map\(\(choice, i\) => \(/);
  assert.match(src, /role="menuitem"/);
  assert.match(src, /onClick=\{\(\) => choose\(menu, choice\.action\)\}/);
  assert.match(src, /menuRef\.current\?\.querySelector\("button"\)\?\.focus\(\);/);
  const keys = section(src, "function onMenuKey", "function onContextMenu");
  assert.match(keys, /case "Escape":\s*case "Tab":\s*event\.preventDefault\(\);\s*closeMenu\(id, true\);/);
  assert.match(section(src, "function closeMenu", "function openItem"), /querySelector<HTMLElement>\("\.desk-link"\)\?\.focus\(\)/);
  const choose = section(src, "function choose", "function onItemKey");
  assert.match(choose, /action === "open"[\s\S]*openItem\(id\)/);
  assert.match(choose, /action === "rotate"[\s\S]*turnItem\(id, ROTATE_STEP\)/);
  assert.match(choose, /backItem\(id\);\s*closeMenu\(id, true\);/);
  // A press outside closes it.
  assert.match(src, /document\.addEventListener\("pointerdown", outside, true\)/);
});

test("a focused item takes deskKey's keys, and every change is said on a polite live line", () => {
  const src = desk();
  assert.match(src, /onKeyDown=\{\(event\) => onItemKey\(entry\.id, event\)\}/);
  const keys = section(src, "function onItemKey", "function onMenuKey");
  assert.match(keys, /const act = deskKey\(event\.key, event\.shiftKey\);/);
  assert.match(keys, /if \(act\.type === "close"\) \{\s*if \(menu\) closeMenu\(menu, true\);/);
  assert.match(keys, /act\.type === "nudge"\) nudgeItem\(id, act\.dx, act\.dy\)/);
  assert.match(keys, /act\.type === "rotate"\) turnItem\(id, act\.by\)/);
  assert.match(keys, /act\.type === "back"\) backItem\(id\)/);
  assert.match(keys, /act\.type === "front"\) frontItem\(id\)/);
  assert.match(keys, /else openMenu\(id\)/);
  assert.match(src, /<p className="sr-only" aria-live="polite" data-desk-said="">\s*\{said\}/);
  for (const fn of ["nudgeItem", "turnItem", "backItem", "frontItem", "openMenu", "closeMenu"]) {
    assert.match(section(src, `function ${fn}`, "\n  }\n"), /say\(id, \{ type: "/, fn);
  }
  // The items say how to drive them.
  assert.match(src, /aria-describedby=\{hintId\}/);
  assert.match(src, /aria-haspopup="menu"/);
});

test("a pickup and a send-to-back rustle; a drop, an open and a link's click stamp", () => {
  const src = desk();
  assert.match(src, /import \{ play \} from "@\/lib\/sound-client";/);
  assert.match(section(src, "function onPointerMove", "function onPointerEnd"), /dataset\.dragging = "";\s*play\("rustle"\);/);
  const end = section(src, "function onPointerEnd", "function tidyUp");
  // Only a real drop stamps: a cancelled drag returns before it.
  assert.ok(end.indexOf('play("stamp")') > end.indexOf("if (!dropped) {"), "stamp after the cancel branch");
  assert.match(section(src, "function backItem", "\n  }\n"), /play\("rustle"\)/);
  assert.match(section(src, "function openItem", "function turnItem"), /play\("stamp"\);/);
  assert.match(src, /if \(!swallow\.current\) return play\("stamp"\);/);
  // Nothing else makes a sound.
  assert.equal([...src.matchAll(/play\("(\w+)"\)/g)].length, 5);
});

test("the notebook's leaves turn on the spring in the frame loop, peek on hover and focus, and an open lands before the page changes", () => {
  const src = desk();
  const tick = section(src, "function tick", "function kick");
  assert.match(tick, /const s = advance\(f\.s, f\.to, dt\);/);
  assert.match(tick, /paintLeaves\(\);/);
  assert.match(tick, /motion\.current\.size > 0 \|\| f\.live \? requestAnimationFrame\(tick\)/);
  assert.match(section(src, "function paintLeaves", "function flipLanded"), /leafPose\(flip\.current\.s\.x, i\)[\s\S]*perspective\(1200px\) rotateY\(\$\{pose\.deg\}deg\)/);
  // Reduced motion: the leaves stand where they are pulled to and the page changes at once.
  const kick = section(src, "function kick", "useLayoutEffect(");
  assert.match(kick, /f\.s = \{ x: f\.to, v: 0 \};[\s\S]*flipLanded\(\);/);
  assert.match(src, /function peek\(open: boolean\) \{\s*if \(matchMedia\(REDUCED\)\.matches\) return;/);
  assert.match(src, /onFocus: \(\) => peek\(true\)/);
  assert.match(src, /onBlur: \(\) => peek\(false\)/);
  const open = section(src, "function openItem", "function turnItem");
  assert.match(open, /setTimeout\(go, FLIP_NAV_MS\);\s*flipTo\(NOTEBOOK_OPEN, go\);/);
  assert.match(src, /leafRef=\{entry\.kind === "notebook" \? setLeaf : undefined\}/);
  const art = read("_components/desk-art.tsx");
  assert.match(art, /Array\.from\(\{ length: NOTEBOOK_LEAVES \}/);
  assert.match(art, /ref=\{\(el\) => leafRef\?\.\(i, el\)\}/);
  const css = read("desk.css").replace(/\/\*[\s\S]*?\*\//g, "");
  assert.match(css, /\.desk-leaf \{[^}]*transform-style: preserve-3d;/);
  assert.match(css, /\.desk-leaf-face \{[^}]*backface-visibility: hidden;/);
  assert.match(css, /\.desk-leaf-back \{[^}]*transform: rotateY\(180deg\);/);
});
