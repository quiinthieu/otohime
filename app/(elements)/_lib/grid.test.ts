import assert from "node:assert/strict";
import { test } from "node:test";
import { ELEMENTS } from "./elements.ts";
import { COLUMNS, MARKERS, neighbour, place, ROWS, rowEnd, rowStart, SPACER_ROW, type Direction } from "./grid.ts";

const by = (symbol: string) => {
  const el = ELEMENTS.find((e) => e.symbol === symbol);
  if (!el) throw new Error(symbol);
  return el;
};
const at = (symbol: string) => place(by(symbol));
const move = (symbol: string, dir: Direction) => ELEMENTS[neighbour(by(symbol).number, dir, ELEMENTS) - 1].symbol;

test("anchors: H, He and both ends of the two series rows", () => {
  assert.deepEqual(at("H"), { col: 1, row: 1 });
  assert.deepEqual(at("He"), { col: 18, row: 1 });
  assert.deepEqual(at("La"), { col: 3, row: 9 });
  assert.deepEqual(at("Lu"), { col: 17, row: 9 });
  assert.deepEqual(at("Ac"), { col: 3, row: 10 });
  assert.deepEqual(at("Lr"), { col: 17, row: 10 });
  assert.deepEqual(at("Og"), { col: 18, row: 7 });
  assert.deepEqual(at("Hf"), { col: 4, row: 6 });
});

test("every element is inside the 18 × 10 grid, none on the spacer row", () => {
  for (const el of ELEMENTS) {
    const { col, row } = place(el);
    assert.ok(col >= 1 && col <= COLUMNS && row >= 1 && row <= ROWS, el.symbol);
    assert.notEqual(row, SPACER_ROW, el.symbol);
  }
});

test("the series rows are 57-71 and 89-103, only in columns 3..17", () => {
  const series = (row: number) => ELEMENTS.filter((el) => place(el).row === row);
  assert.deepEqual(series(9).map((el) => el.number), Array.from({ length: 15 }, (_, i) => 57 + i));
  assert.deepEqual(series(10).map((el) => el.number), Array.from({ length: 15 }, (_, i) => 89 + i));
  for (const el of [...series(9), ...series(10)]) assert.ok(place(el).col >= 3 && place(el).col <= 17, el.symbol);
});

test("both markers sit in empty cells under group 3", () => {
  assert.deepEqual(
    MARKERS.map((m) => [m.col, m.row, m.label]),
    [
      [3, 6, "57–71"],
      [3, 7, "89–103"],
    ],
  );
  for (const m of MARKERS) assert.ok(!ELEMENTS.some((el) => place(el).col === m.col && place(el).row === m.row), m.label);
});

test("left and right skip the gaps and stop at the edges", () => {
  assert.equal(move("Ba", "ArrowRight"), "Hf");
  assert.equal(move("Hf", "ArrowLeft"), "Ba");
  assert.equal(move("H", "ArrowRight"), "He");
  assert.equal(move("Be", "ArrowRight"), "B");
  assert.equal(move("H", "ArrowLeft"), "H");
  assert.equal(move("Og", "ArrowRight"), "Og");
  assert.equal(move("Ce", "ArrowRight"), "Pr");
  assert.equal(move("La", "ArrowLeft"), "La");
});

test("up and down move by column and cross the spacer to the series rows", () => {
  assert.equal(move("Ba", "ArrowDown"), "Ra");
  assert.equal(move("Ra", "ArrowUp"), "Ba");
  assert.equal(move("H", "ArrowDown"), "Li");
  assert.equal(move("Ne", "ArrowUp"), "He");
  assert.equal(move("B", "ArrowUp"), "He");
  // below La's gap: row 7 drops over the spacer into the lanthanides
  assert.equal(move("Ra", "ArrowDown"), "La");
  assert.equal(move("Rf", "ArrowDown"), "Ce");
  assert.equal(move("Ce", "ArrowUp"), "Rf");
  assert.equal(move("La", "ArrowDown"), "Ac");
  assert.equal(move("Ac", "ArrowUp"), "La");
  assert.equal(move("La", "ArrowUp"), "Ra"); // tie between Ra and Rf goes to the lower column
  assert.equal(move("Lr", "ArrowDown"), "Lr");
  assert.equal(move("H", "ArrowUp"), "H");
});

test("every move lands on a real element", () => {
  for (const el of ELEMENTS) {
    for (const dir of ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"] as const) {
      const n = neighbour(el.number, dir, ELEMENTS);
      assert.ok(n >= 1 && n <= 118, `${el.symbol} ${dir}`);
    }
  }
  assert.throws(() => neighbour(119, "ArrowLeft", ELEMENTS), /no element 119/);
});

test("Home and End go to the ends of the row", () => {
  const home = (s: string) => ELEMENTS[rowStart(by(s).number, ELEMENTS) - 1].symbol;
  const end = (s: string) => ELEMENTS[rowEnd(by(s).number, ELEMENTS) - 1].symbol;
  assert.equal(home("Fe"), "K");
  assert.equal(end("Fe"), "Kr");
  assert.equal(home("He"), "H");
  assert.equal(end("H"), "He");
  assert.equal(home("Nd"), "La");
  assert.equal(end("Nd"), "Lu");
  assert.equal(home("U"), "Ac");
  assert.equal(end("U"), "Lr");
  assert.equal(end("Ra"), "Og");
});
