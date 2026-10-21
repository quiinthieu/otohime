// Right here: this site's eleven other stylesheets as paper scraps, one row a
// sheet. Each row has the sheet's group, a scrap in its light paper (an empty
// scrap with a cross for a sheet that names none), the paper's hex, and a row
// of small boxes, one a named decision. Under them, in spot, how many sheets
// name a --paper and an --ink, and how many creams they choose. Every number
// is SIBLINGS', so the card and the pins cannot disagree. The scraps carry
// their group, so the page can mark each one data-sheet="<group>".
import { inkLine, inkRect, type InkPath } from "../ink.ts";
import { label, SMALL, WIDTH, type Figure } from "../kit.ts";
import { CREAMS, INK_COUNT, PAPER_COUNT, SIBLINGS } from "../siblings.ts";

export type Scrap = { sheet: string; paper: string | null; decisions: number; x: number; y: number; w: number; h: number };
export type HereFigure = Figure & { scraps: Scrap[] };

const ROW = { top: 14, pitch: 32 };
const SCRAP = { x: 16, w: 40, h: 24 };
const NAME_X = 64;
const HEX_X = 166;
const BOX = { x: 240, w: 5, h: 14, pitch: 7 };
const HEIGHT = ROW.top + SIBLINGS.length * ROW.pitch + 52;

export const NO_PAPER = "no paper";

export function hereFigure(): HereFigure {
  const paths: InkPath[] = [];
  const scraps: Scrap[] = [];
  const labels = SIBLINGS.flatMap((s, i) => {
    const mid = ROW.top + i * ROW.pitch + ROW.pitch / 2;
    const scrap: Scrap = { sheet: s.group, paper: s.paper, decisions: s.decisions, x: SCRAP.x, y: mid - SCRAP.h / 2, w: SCRAP.w, h: SCRAP.h };
    scraps.push(scrap);
    const o = (k: string) => ({ seed: `here:${s.group}:${k}` });
    if (s.paper) {
      paths.push(...inkRect(scrap.x, scrap.y, scrap.w, scrap.h, { ...o("scrap"), fill: s.paper, fillStyle: "solid" }));
    } else {
      paths.push(...inkRect(scrap.x, scrap.y, scrap.w, scrap.h, o("scrap")));
      paths.push(...inkLine(scrap.x + 6, scrap.y + 5, scrap.x + scrap.w - 6, scrap.y + scrap.h - 5, { ...o("cross"), strokeWidth: 1.4 }));
    }
    for (let k = 0; k < s.decisions; k++) {
      paths.push(...inkRect(BOX.x + k * BOX.pitch, mid - BOX.h / 2, BOX.w, BOX.h, { ...o(`box${k}`), strokeWidth: 1.2 }));
    }
    const baseline = mid + 6;
    return [label(NAME_X, baseline, s.group, { size: SMALL }), label(HEX_X, baseline, s.paper ?? NO_PAPER, { size: SMALL })];
  });
  const foot = ROW.top + SIBLINGS.length * ROW.pitch + 30;
  labels.push(
    label(16, foot, `--paper in ${PAPER_COUNT}`, { size: SMALL, spot: true }),
    label(WIDTH / 2, foot, `--ink in ${INK_COUNT}`, { anchor: "middle", size: SMALL, spot: true }),
    label(WIDTH - 16, foot, `${CREAMS} creams`, { anchor: "end", size: SMALL, spot: true }),
  );
  return { viewBox: [WIDTH, HEIGHT], paths, spot: [], labels, scraps };
}
