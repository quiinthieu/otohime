// The costs card: how many steps a find, an add and a remove take with 8
// things inside, drawn as rows of small boxes, one box a step. The numbers are
// the machine's own: costs() runs reduce on 8 things, so the card and the
// machine cannot disagree. The cheapest row (or rows, on a tie) is in spot.
import { stepsWord, type Band, type Cost } from "./machine.ts";
import { inkRect, type InkPath } from "./ink.ts";
import { label, SMALL, SPOT, WIDTH, type Figure } from "./kit.ts";
import { bySlug } from "./structures/index.ts";

export const BAND_WORDS: Record<Band, string> = {
  one: "about the same, whatever the size",
  few: "a few",
  all: "every one",
};

export const COST_ROWS = ["find", "add", "remove"] as const;
export type CostRow = { name: (typeof COST_ROWS)[number]; best: boolean } & Cost;

/** The three rows, in card order, from bySlug(slug).costs(). */
export function costRows(slug: string): CostRow[] {
  const structure = bySlug(slug);
  if (!structure) throw new Error(`no structure ${slug}`);
  const costs = structure.costs();
  const least = Math.min(...COST_ROWS.map((n) => costs[n].steps));
  return COST_ROWS.map((name) => ({ name, ...costs[name], best: costs[name].steps === least }));
}

const TOP = 16;
const ROW = 80;
const LEFT = 24;
const STEP = { size: 22, pitch: 26 };

export function costsFigure(slug: string): Figure {
  const paths: InkPath[] = [];
  const spot: InkPath[] = [];
  const rows = costRows(slug);
  const labels = rows.flatMap((r, k) => {
    const top = TOP + k * ROW;
    for (let i = 0; i < r.steps; i++) {
      const o = r.best ? { seed: `costs:${slug}:${r.name}:${i}`, stroke: SPOT, strokeWidth: 2.6 } : { seed: `costs:${slug}:${r.name}:${i}` };
      (r.best ? spot : paths).push(...inkRect(LEFT + i * STEP.pitch, top + 30, STEP.size, STEP.size, o));
    }
    return [
      label(LEFT, top + 18, `${r.name}: ${BAND_WORDS[r.band]}`, { size: SMALL, ...(r.best ? { spot: true } : {}) }),
      label(LEFT + r.steps * STEP.pitch + 10, top + 48, stepsWord(r.steps), r.best ? { spot: true } : {}),
    ];
  });
  return { viewBox: [WIDTH, TOP + rows.length * ROW], paths, spot, labels };
}
