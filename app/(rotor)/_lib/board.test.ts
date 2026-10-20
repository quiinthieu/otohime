import assert from "node:assert/strict";
import { test } from "node:test";
import { DIVIDER_Y, LAMP_R, LAMPS, ROWS, VIEW, WINDOW, WINDOWS } from "./board.ts";
import { ALPHABET } from "./wiring.ts";

test("the rows hold every letter once, in the machine's QWERTZU order", () => {
  assert.equal(ROWS.join("").length, 26);
  assert.deepEqual([...ROWS.join("")].sort().join(""), ALPHABET);
  assert.equal(ROWS[0], "QWERTZUIO");
});

test("26 lamps, inside the box, none overlapping", () => {
  assert.equal(LAMPS.length, 26);
  for (const l of LAMPS) {
    assert.ok(l.x - LAMP_R > 0 && l.x + LAMP_R < VIEW.w, l.letter);
    assert.ok(l.y - LAMP_R > DIVIDER_Y && l.y + LAMP_R < VIEW.h, l.letter);
  }
  for (const a of LAMPS)
    for (const b of LAMPS) if (a !== b) assert.ok(Math.hypot(a.x - b.x, a.y - b.y) > 2 * LAMP_R, `${a.letter} ${b.letter}`);
});

test("three windows, centred, above the lamps", () => {
  assert.equal(WINDOWS.length, 3);
  assert.equal(WINDOWS[1].x, VIEW.w / 2);
  for (const w of WINDOWS) assert.ok(w.y + WINDOW.h / 2 < DIVIDER_Y && w.x - WINDOW.w / 2 > 0 && w.x + WINDOW.w / 2 < VIEW.w);
});
