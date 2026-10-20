// Rotor's window roll, read from rotor.css and rotor-app.tsx as text: each
// window letter is keyed on itself, so a step remounts it; the roll is a
// from-only keyframe on twos; it plays only on a letter marked [data-rolled],
// which a letter takes when it mounts after the first press, so the server
// render and the first paint never roll and the windows that did not step stay
// put; the reduced-motion block is last. Modelled on
// app/(orrery)/_lib/motion.test.ts, not shared with it. scripts/probe-motion.sh
// watches it run in a browser.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { test } from "node:test";

const GROUP = resolve(import.meta.dirname, "..");
const app = readFileSync(join(GROUP, "_components", "rotor-app.tsx"), "utf8");
const css = readFileSync(join(GROUP, "rotor.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

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
  assert.equal(depth, 0, "rotor.css has unbalanced braces");
  return out;
}

const top = blocks(css);
const selectors = (b: Block) => b.prelude.split(",").map((s) => s.trim());
const steps = (body: string) => blocks(body).map((b) => b.prelude);
// The JSX element that carries an attribute, from its "<" to its ">".
const element = (attr: string) => {
  const found = [...app.matchAll(new RegExp(`<\\w+\\s[^<>]*\\b${attr}=[^<>]*>`, "g"))].map((m) => m[0]);
  assert.equal(found.length, 1, `rotor-app.tsx has ${found.length} elements with ${attr}`);
  return found[0];
};

test("the roll keyframe exists and has only a from step", () => {
  const roll = top.filter((b) => b.prelude === "@keyframes roll");
  assert.equal(roll.length, 1);
  assert.deepEqual(steps(roll[0].body), ["from"]);
  assert.match(roll[0].body, /from\s*\{\s*transform:\s*translateY\(0\.35em\);\s*opacity:\s*0;\s*\}/);
});

test("each window letter is keyed on its slot and its letter, so a step remounts it", () => {
  const letter = element("data-window");
  assert.match(letter, /^<text\s/);
  assert.match(letter, /className="window-letter"/);
  const mount = element("rolls");
  assert.match(mount, /^<WindowLetter\s/);
  assert.match(mount, /\bkey=\{`\$\{i\}-\$\{s\.positions\[i\]\}`\}/);
  assert.match(mount, /\bletter=\{s\.positions\[i\]\}/);
});

test("data-rolled gates the roll, on twos, and only a letter that mounts after a press carries it", () => {
  const using = top.filter((b) => /animation:[^;]*\broll\b/.test(b.body));
  assert.equal(using.length, 1, "one rule plays the roll");
  assert.deepEqual(selectors(using[0]), [".window-letter[data-rolled]"]);
  assert.match(using[0].body, /animation:\s*roll 170ms steps\(2\);/);
  assert.match(using[0].body, /transform-box:\s*fill-box;/);
  // the bare letter never animates, so the server render and the first paint stand still
  for (const b of top.filter((x) => selectors(x).includes(".window-letter"))) assert.doesNotMatch(b.body, /animation/);

  // Fixed at mount: a flag on the windows' group would start the roll on every letter showing when it is set.
  assert.match(element("data-window"), /\bdata-rolled=\{rolled \? "" : undefined\}/);
  assert.match(app, /function WindowLetter\([^)]*\)[^{]*\{\s*const \[rolled\] = useState\(rolls\);/);
  assert.doesNotMatch(element("data-windows"), /data-rolled/);
  assert.match(element("rolls"), /\brolls=\{rolled\}/);
  assert.match(app, /const \[rolled, setRolled\] = useState\(false\);/);
  // set where a letter is pressed (a drawn key and the real keyboard), nowhere else
  assert.equal([...app.matchAll(/setRolled\(true\)/g)].length, 2);
  assert.match(app, /const press = \(letter: string\) => \{\s*setTouched\(true\);\s*setRolled\(true\);/);
  assert.match(app, /e\.preventDefault\(\);\s*setTouched\(true\);\s*setRolled\(true\);/);
});

test("the still is the machine at rest: nothing outside @keyframes hides a letter", () => {
  for (const b of top.filter((x) => !x.prelude.startsWith("@"))) {
    assert.doesNotMatch(b.body, /opacity:\s*0\s*;/, `${b.prelude} sets opacity: 0`);
    if (/\broll\b/.test(b.body)) assert.doesNotMatch(b.body, /\b(?:both|forwards|backwards|infinite)\b/, `${b.prelude} holds the roll`);
  }
});

test("the reduced-motion block is last and stops the roll and the hop", () => {
  const reduced = top.filter((b) => /^@media[^{]*prefers-reduced-motion:\s*reduce/.test(b.prelude));
  assert.equal(reduced.length, 1);
  assert.equal(top.at(-1), reduced[0]);
  assert.match(reduced[0].body, /\*[\s\S]*\{[^}]*animation:\s*none\s*!important/);
  assert.match(reduced[0].body, /::view-transition-group\(\*\)/);
});
