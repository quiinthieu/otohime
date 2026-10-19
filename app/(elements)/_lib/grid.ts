// Grid placement and arrow-key movement for the 18-column table. The dataset's
// xpos/ypos already are the standard layout: periods on rows 1-7, row 8 empty
// (the spacer), lanthanides on row 9 and actinides on row 10 at columns 3-17.

import type { Element } from "./elements.ts";

export type Cell = Pick<Element, "number" | "xpos" | "ypos">;
export type Direction = "ArrowLeft" | "ArrowRight" | "ArrowUp" | "ArrowDown";

export const COLUMNS = 18;
export const ROWS = 10;
export const SPACER_ROW = 8;

export function place(el: Cell): { col: number; row: number } {
  return { col: el.xpos, row: el.ypos };
}

// The two empty cells under group 3 that point at the series rows below.
export const MARKERS = [
  { col: 3, row: 6, label: "57–71", series: "lanthanide" },
  { col: 3, row: 7, label: "89–103", series: "actinide" },
] as const;

function at(n: number, all: readonly Cell[]): Cell {
  const cell = all.find((c) => c.number === n);
  if (!cell) throw new Error(`no element ${n}`);
  return cell;
}

/**
 * The element an arrow key moves to from element `from`, or `from` itself at an
 * edge. Left/right step to the nearest cell in the same row, skipping gaps
 * (Ba → Hf). Up/down go to the nearest row in that direction that has any
 * element, then to the closest column there (ties go to the lower column), so
 * Ba ↓ Ra and the lanthanide row is reached from row 7 over the spacer.
 */
export function neighbour(from: number, dir: Direction, all: readonly Cell[]): number {
  const here = at(from, all);
  if (dir === "ArrowLeft" || dir === "ArrowRight") {
    const sign = dir === "ArrowRight" ? 1 : -1;
    const row = all.filter((c) => c.ypos === here.ypos && (c.xpos - here.xpos) * sign > 0);
    if (row.length === 0) return from;
    return row.reduce((best, c) => (Math.abs(c.xpos - here.xpos) < Math.abs(best.xpos - here.xpos) ? c : best)).number;
  }
  const sign = dir === "ArrowDown" ? 1 : -1;
  const ahead = all.filter((c) => (c.ypos - here.ypos) * sign > 0);
  if (ahead.length === 0) return from;
  const rowGap = Math.min(...ahead.map((c) => Math.abs(c.ypos - here.ypos)));
  const row = ahead.filter((c) => Math.abs(c.ypos - here.ypos) === rowGap);
  return row.reduce((best, c) => {
    const d = Math.abs(c.xpos - here.xpos);
    const bd = Math.abs(best.xpos - here.xpos);
    return d < bd || (d === bd && c.xpos < best.xpos) ? c : best;
  }).number;
}

function rowOf(from: number, all: readonly Cell[]): Cell[] {
  const here = at(from, all);
  return all.filter((c) => c.ypos === here.ypos).sort((a, b) => a.xpos - b.xpos);
}

/** Home: the first element in `from`'s row. */
export function rowStart(from: number, all: readonly Cell[]): number {
  return rowOf(from, all)[0].number;
}

/** End: the last element in `from`'s row. */
export function rowEnd(from: number, all: readonly Cell[]): number {
  const row = rowOf(from, all);
  return row[row.length - 1].number;
}
