import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";
import { site } from "../content/site.ts";
import {
  end,
  endBusy,
  endCue,
  endReadout,
  KONAMI,
  konamiStep,
  LCD_ROW_CAP,
  lcdLine,
  lcdRows,
  newEnd,
  TENTH_POKE,
  type End,
  type EndAction,
} from "./end.ts";
import { PUBLIC_PAGES } from "./pages.ts";

const ITEMS = site.end.lines.length;
const play = (start: End = newEnd(ITEMS), ...actions: EndAction[]): End =>
  actions.reduce(end, start);

test("idle state starts at SAVE POINT with the console resting", () => {
  const s = newEnd(ITEMS);
  assert.equal(endBusy(s), false);
  assert.equal(s.pokes, 0);
  assert.equal(s.line, 0);
  assert.equal(s.unlocked, false);
  assert.deepEqual(lcdRows(s, site.end), ["SAVE", "POINT"]);
  assert.equal(lcdLine(s, site.end), "SAVE POINT");
  assert.equal(endReadout(s, site.end), site.end.idle.readout);
});

test("each poke advances the cycle, wraps around, and changes LCD and readout", () => {
  let s = newEnd(ITEMS);
  for (let i = 1; i <= ITEMS * 2 + 2; i++) {
    const prevReadout = endReadout(s, site.end);
    const prevLcd = lcdLine(s, site.end);
    s = play(s, "poke", "settle");
    assert.equal(s.pokes, i);
    if (i === TENTH_POKE) {
      assert.equal(s.cue, "tenth");
      assert.deepEqual(lcdRows(s, site.end), site.end.tenth.lcd);
      assert.equal(endReadout(s, site.end), site.end.tenth.readout);
    } else {
      assert.equal(s.cue, "poke");
      assert.deepEqual(endCue(s, site.end), site.end.lines[s.line]);
    }
    assert.notEqual(endReadout(s, site.end), prevReadout, `poke ${i} readout did not change`);
    assert.notEqual(lcdLine(s, site.end), prevLcd, `poke ${i} lcd did not change`);
  }
});

test("the tenth poke shows the breather line and the eleventh resumes cycling", () => {
  let s = newEnd(ITEMS);
  for (let i = 0; i < TENTH_POKE - 1; i++) s = play(s, "poke", "settle");
  const ninthLine = s.line;
  const tenth = play(s, "poke");
  assert.equal(tenth.pokes, TENTH_POKE);
  assert.equal(tenth.cue, "tenth");
  assert.equal(tenth.line, ninthLine);
  assert.deepEqual(lcdRows(tenth, site.end), ["STOP", "POKING"]);

  const eleventh = play(tenth, "settle", "poke", "settle");
  assert.equal(eleventh.pokes, TENTH_POKE + 1);
  assert.equal(eleventh.cue, "poke");
  assert.equal(eleventh.line, (ninthLine + 1) % ITEMS);
  assert.deepEqual(lcdRows(eleventh, site.end), site.end.lines[eleventh.line].lcd);
});

test("a poke holds the button down for two ticks and settle releases it immediately", () => {
  const s0 = play(newEnd(ITEMS), "poke");
  assert.equal(endBusy(s0), true);
  assert.equal(s0.pressed, true);
  assert.equal(s0.hold, 2);

  const s1 = play(s0, "tick");
  assert.equal(endBusy(s1), true);
  assert.equal(s1.hold, 1);

  const s2 = play(s1, "tick");
  assert.equal(endBusy(s2), false);
  assert.equal(s2.pressed, false);
  assert.equal(s2.hold, 0);

  const settled = play(newEnd(ITEMS), "poke", "settle");
  assert.equal(endBusy(settled), false);
  assert.equal(settled.pressed, false);
  assert.equal(settled.hold, 0);
  assert.equal(settled.pokes, 1);
});

test("the Konami sequence unlocks Reached the end with lowercase or uppercase B and A", () => {
  const lower = play(
    newEnd(ITEMS),
    ...KONAMI.map((key) => ({ key })),
  );
  assert.equal(lower.unlocked, true);
  assert.equal(lower.progress, 0);
  assert.equal(lower.cue, "unlocked");
  assert.deepEqual(lcdRows(lower, site.end), ["REACHED", "THE END"]);
  assert.equal(endReadout(sOr(lower), site.end), site.end.unlocked.readout);

  // Uppercase B/A with Shift keydown events interspersed
  const upperKeys = [
    ...KONAMI.slice(0, 8),
    "Shift",
    "B",
    "Shift",
    "A",
  ];
  const upper = play(
    newEnd(ITEMS),
    ...upperKeys.map((key) => ({ key })),
  );
  assert.equal(upper.unlocked, true);
  assert.equal(upper.progress, 0);
  assert.equal(upper.cue, "unlocked");
});

function sOr(s: End): End {
  return s;
}

test("Konami prefix overlap preserves matching prefixes and wrong keys reset to zero", () => {
  // Extra ArrowUp after ArrowUp, ArrowUp keeps progress at 2
  assert.equal(konamiStep(0, "ArrowUp"), 1);
  assert.equal(konamiStep(1, "ArrowUp"), 2);
  assert.equal(konamiStep(2, "ArrowUp"), 2);

  // ArrowUp after ArrowUp, ArrowUp, ArrowDown restarts prefix at 1
  assert.equal(konamiStep(3, "ArrowUp"), 1);
  // ArrowUp after ArrowUp, ArrowUp, ArrowDown, ArrowDown, ArrowLeft, ArrowRight restarts prefix at 1
  assert.equal(konamiStep(6, "ArrowUp"), 1);
  // Unrelated key resets progress to 0
  assert.equal(konamiStep(5, "Escape"), 0);
  assert.equal(konamiStep(9, "b"), 0);

  // Full sequence with overlapping prefix (three ArrowUps at start) unlocks
  const overlapped = play(
    newEnd(ITEMS),
    { key: "ArrowUp" },
    ...KONAMI.map((key) => ({ key })),
  );
  assert.equal(overlapped.unlocked, true);
  assert.equal(overlapped.progress, 0);

  // Partial progress followed by wrong key does not unlock
  const wrong = play(
    newEnd(ITEMS),
    ...KONAMI.slice(0, 8).map((key) => ({ key })),
    { key: "x" },
    { key: "b" },
    { key: "a" },
  );
  assert.equal(wrong.unlocked, false);
  assert.equal(wrong.progress, 0);
});

test("leaving the viewport clears partial Konami progress without losing pokes or unlock", () => {
  const partial = play(
    newEnd(ITEMS),
    "poke",
    "settle",
    { key: "ArrowUp" },
    { key: "ArrowUp" },
    { key: "ArrowDown" },
  );
  assert.equal(partial.progress, 3);
  const left = play(partial, "leave");
  assert.equal(left.progress, 0);
  assert.equal(left.pokes, 1);
  assert.equal(end(left, "leave"), left);
});

test("restoration and repeated unlock preserve mascot pokes and re-display the achievement", () => {
  const restored = play(newEnd(ITEMS), "restore");
  assert.equal(restored.unlocked, true);
  assert.equal(restored.cue, "unlocked");
  assert.deepEqual(lcdRows(restored, site.end), ["REACHED", "THE END"]);

  // Poking after restoration cycles normal poke lines while staying unlocked
  const pokedAfterRestore = play(restored, "poke", "settle");
  assert.equal(pokedAfterRestore.unlocked, true);
  assert.equal(pokedAfterRestore.cue, "poke");
  assert.deepEqual(lcdRows(pokedAfterRestore, site.end), site.end.lines[1].lcd);

  // Entering Konami again re-displays the unlocked cue
  const reUnlocked = play(
    pokedAfterRestore,
    ...KONAMI.map((key) => ({ key })),
  );
  assert.equal(reUnlocked.unlocked, true);
  assert.equal(reUnlocked.cue, "unlocked");
  assert.deepEqual(lcdRows(reUnlocked, site.end), ["REACHED", "THE END"]);
});

test("site.end copy matches the required sentences, LCD bounds, and PUBLIC_PAGES count", () => {
  assert.equal(site.end.title, "You've reached the end of the internet.");
  assert.equal(site.end.sub, "Thanks for stopping by. See you on the next level.");
  const allCues = [site.end.idle, site.end.tenth, site.end.unlocked, ...site.end.lines];
  for (const cue of allCues) {
    assert.equal(cue.lcd.length, 2);
    for (const row of cue.lcd) {
      assert.ok(row.length >= 2 && row.length <= LCD_ROW_CAP, `LCD row "${row}" exceeds ${LCD_ROW_CAP} chars`);
      assert.match(row, /^[A-Z0-9 ?.!·-]+$/, `LCD row "${row}" is not uppercase ASCII`);
    }
    assert.ok(cue.readout.length > 0);
  }
  const pageLine = site.end.lines.find((l) => l.lcd[0].includes("PAGES"));
  assert.ok(pageLine, "missing public pages count line");
  assert.equal(pageLine.lcd[0], `${PUBLIC_PAGES.length} PAGES`);
});

test("lib/end.ts is pure and imports no browser or DOM APIs", () => {
  const src = readFileSync(resolve(import.meta.dirname, "end.ts"), "utf8");
  assert.doesNotMatch(src, /\b(window|document|localStorage|matchMedia|IntersectionObserver|requestAnimationFrame)\b/);
});
