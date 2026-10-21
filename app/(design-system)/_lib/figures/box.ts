// The box: a painter's box of decisions. The rulebook on the lid; a shelf of
// pots, a shelf of parts, a shelf of patterns; one spot arrow from the spot
// pot through the button into the form: change a pot and everything below it
// follows. Every count is a constant's length, so the picture and the board
// cannot disagree.
import { PARTS, PATTERNS, POTS } from "../board.ts";
import { inkCircle, inkLine, inkRect, type InkPath } from "../ink.ts";
import { arrow, label, SMALL, SPOT, WIDTH, type Figure } from "../kit.ts";

const HEIGHT = 356;
const ROW_X = 130; // where each shelf's row of things starts
const SHELF = { pots: 104, parts: 182, patterns: 272 };
const POT = { r: 15, pitch: 44 };
const PART = { w: 30, h: 24, pitch: 38 };
const PATTERN = { w: 92, h: 44, pitch: 110, left: 170 };

const potX = (i: number) => ROW_X + i * POT.pitch;
const partX = (i: number) => ROW_X + i * PART.pitch;
const patternX = (i: number) => PATTERN.left + i * PATTERN.pitch;

// What each pattern holds, drawn small inside it: a form's two fields, a
// list's three lines, a dialog's line and button.
function inside(pattern: (typeof PATTERNS)[number], x: number, y: number): InkPath[] {
  const o = (s: string) => ({ seed: `box:${pattern}:${s}`, strokeWidth: 1.4 });
  const l = x - PATTERN.w / 2 + 12;
  const r = x + PATTERN.w / 2 - 12;
  switch (pattern) {
    case "form":
      return [...inkRect(l, y - 14, r - l, 9, o("a")), ...inkRect(l, y + 2, r - l, 9, o("b"))];
    case "list":
      return [-11, 0, 11].flatMap((dy, k) => inkLine(l, y + dy, r, y + dy, o(`l${k}`)));
    case "dialog":
      return [...inkLine(l, y - 8, r, y - 8, o("line")), ...inkRect(r - 30, y + 2, 30, 10, o("ok"))];
  }
}

export function boxFigure(): Figure {
  const paths: InkPath[] = [];
  const spot: InkPath[] = [];
  const o = (s: string) => ({ seed: `box:${s}` });

  // the lid with the rulebook on it, and the box below
  paths.push(...inkRect(24, 12, WIDTH - 48, 38, o("lid")));
  paths.push(...inkRect(12, 58, WIDTH - 24, 260, o("body")));
  for (const [k, y] of [130, 210].entries()) paths.push(...inkLine(12, y, WIDTH - 12, y, o(`shelf${k}`)));

  const spotPot = POTS.indexOf("spot");
  const button = PARTS.indexOf("button");
  const form = PATTERNS.indexOf("form");

  POTS.forEach((pot, i) => {
    const drawn = inkCircle(potX(i), SHELF.pots, POT.r, i === spotPot ? { ...o(`pot:${pot}`), stroke: SPOT, strokeWidth: 2.6 } : o(`pot:${pot}`));
    (i === spotPot ? spot : paths).push(...drawn);
  });
  PARTS.forEach((part, i) => {
    paths.push(...inkRect(partX(i) - PART.w / 2, SHELF.parts - PART.h / 2, PART.w, PART.h, o(`part:${part}`)));
  });
  PATTERNS.forEach((pattern, i) => {
    const x = patternX(i);
    paths.push(...inkRect(x - PATTERN.w / 2, SHELF.patterns - PATTERN.h / 2, PATTERN.w, PATTERN.h, o(`pattern:${pattern}`)));
    paths.push(...inside(pattern, x, SHELF.patterns));
  });

  // the spot pot, through the button, into the form
  const s = { ...o("follow"), stroke: SPOT, strokeWidth: 2.6 };
  spot.push(...arrow(potX(spotPot), SHELF.pots + POT.r + 4, partX(button), SHELF.parts - PART.h / 2 - 4, s));
  spot.push(...arrow(partX(button), SHELF.parts + PART.h / 2 + 4, patternX(form), SHELF.patterns - PATTERN.h / 2 - 4, { ...s, seed: "box:follow:2" }));

  const labels = [
    label(WIDTH / 2, 37, "the rulebook: words, keys, contrast", { anchor: "middle", size: SMALL }),
    label(28, SHELF.pots + 6, `${POTS.length} pots`),
    label(28, SHELF.parts + 6, `${PARTS.length} parts`),
    label(28, SHELF.patterns + 6, `${PATTERNS.length} patterns`, { size: SMALL }),
    label(WIDTH / 2, HEIGHT - 12, "change a pot and everything below it follows", { anchor: "middle", size: SMALL, spot: true }),
  ];
  return { viewBox: [WIDTH, HEIGHT], paths, spot, labels };
}
