import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { CHAR_MS, due, step } from "./typewriter.ts";

const ROOT = join(import.meta.dirname, "..");
const TEXT = "> SHORE: A TIDE POOL.";

test("a step types one more character by default", () => {
  assert.deepEqual(step(TEXT, 0, false), { index: 1, shown: ">", done: false });
  assert.deepEqual(step(TEXT, 5, false), { index: 6, shown: "> SHOR", done: false });
});

test("a step can type several characters, or none", () => {
  assert.deepEqual(step(TEXT, 2, false, 5), { index: 7, shown: "> SHORE", done: false });
  assert.deepEqual(step(TEXT, 4, false, 0), { index: 4, shown: "> SH", done: false });
  assert.equal(step(TEXT, 4, false, -3).index, 4);
});

test("stepping one at a time reaches the end in text.length steps, every view a prefix", () => {
  let index = 0;
  let steps = 0;
  for (let done = false; !done; steps++) {
    const next = step(TEXT, index, false);
    assert.ok(TEXT.startsWith(next.shown));
    assert.equal(next.shown.length, next.index);
    assert.equal(next.index, index + 1);
    index = next.index;
    done = next.done;
  }
  assert.equal(steps, TEXT.length);
  assert.equal(index, TEXT.length);
});

test("reduced motion shows the whole text on any step", () => {
  for (const [index, chars] of [
    [0, 0],
    [0, 1],
    [7, 1],
    [TEXT.length, 1],
  ]) {
    assert.deepEqual(step(TEXT, index, true, chars), { index: TEXT.length, shown: TEXT, done: true });
  }
  // Control: the same steps without the flag stop short.
  assert.equal(step(TEXT, 0, false, 0).done, false);
  assert.equal(step(TEXT, 7, false, 1).shown, "> SHORE:");
});

test("the index is clamped to the text", () => {
  assert.deepEqual(step(TEXT, TEXT.length + 9, false), { index: TEXT.length, shown: TEXT, done: true });
  assert.deepEqual(step(TEXT, TEXT.length - 1, false, 50), { index: TEXT.length, shown: TEXT, done: true });
  assert.deepEqual(step(TEXT, -4, false), { index: 1, shown: ">", done: false });
  assert.deepEqual(step(TEXT, Number.NaN, false, Number.NaN), { index: 0, shown: "", done: false });
  assert.equal(step(TEXT, 2.9, false, 1.9).index, 3);
});

test("empty text is done at once, reduced or not", () => {
  assert.deepEqual(step("", 0, false), { index: 0, shown: "", done: true });
  assert.deepEqual(step("", 0, true), { index: 0, shown: "", done: true });
});

test("a step never splits a surrogate pair", () => {
  const text = "A🌊B";
  assert.equal(text.length, 4);
  assert.deepEqual(step(text, 0, false), { index: 1, shown: "A", done: false });
  assert.deepEqual(step(text, 1, false), { index: 3, shown: "A🌊", done: false });
  assert.deepEqual(step(text, 3, false), { index: 4, shown: text, done: true });
  // a pair at the very end
  assert.deepEqual(step("A🌊", 1, false), { index: 3, shown: "A🌊", done: true });
});

test("due: the first character on the first frame, then one per CHAR_MS (40 a second)", () => {
  assert.equal(CHAR_MS, 25);
  assert.equal(due(0), 1);
  assert.equal(due(-5), 1);
  assert.equal(due(Number.NaN), 1);
  assert.equal(due(24), 1);
  assert.equal(due(25), 2);
  assert.equal(due(1000), 41);
  assert.equal(due(100, 50), 3);
  let last = 0;
  for (let ms = 0; ms <= 2000; ms += 7) {
    assert.ok(due(ms) >= last);
    last = due(ms);
  }
});

test("frames at 60 Hz type a 200-character answer in about five seconds", () => {
  const text = "x".repeat(200);
  let index = 0;
  let frames = 0;
  for (let done = false; !done; frames++) {
    const next = step(text, index, false, due(frames * (1000 / 60)) - index);
    index = next.index;
    done = next.done;
  }
  const seconds = frames / 60;
  assert.ok(seconds > 4.8 && seconds < 5.1, `${seconds}s`);
});

// The console is a client component the node runner cannot render; scripts/probe-ask.sh drives it in Chromium.
// These pin the wiring the probe cannot see apart: one stepper, frame-driven, cancelled, a live region, the
// reduced-motion query, and citations as links.
test("components/ask-console.tsx drives the stepper from requestAnimationFrame and cancels it", () => {
  const src = readFileSync(join(ROOT, "components/ask-console.tsx"), "utf8");
  assert.match(src, /from "@\/lib\/typewriter"/);
  assert.match(src, /requestAnimationFrame\(tick\)/);
  assert.match(src, /return \(\) => cancelAnimationFrame\(frame\)/);
  assert.match(src, /matchMedia\("\(prefers-reduced-motion: reduce\)"\)\.matches/);
  assert.match(src, /aria-live="polite"/);
  assert.match(src, /\{done \? spoken : ""\}/);
  assert.match(src, /<Receipt key=\{printed\.n\}/);
  assert.match(src, /<Link href=\{href\} className="ask-link">/);
  // the CSS clip-mask typewriter is gone; only the feed animation is left, still dropped under reduced motion
  const css = readFileSync(join(ROOT, "app/(site)/globals.css"), "utf8");
  assert.doesNotMatch(css, /ask-type/);
  assert.match(css, /\.ask-row \{[^}]*animation: ask-feed 120ms ease-out both;/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{\s*\.ask-row \{\s*animation: none;/);
});
