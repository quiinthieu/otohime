// A metro map of eight stations on the starter map's lines. H is the spot:
// two routes reach it, one through F and one through G.
import { inkCircle, inkLine, type InkPath } from "../ink.ts";
import { between, label, SMALL, SPOT, WIDTH, type Figure } from "../kit.ts";

const AT: Record<string, [number, number]> = {
  A: [50, 150],
  B: [160, 56],
  C: [176, 150],
  D: [150, 240],
  E: [306, 72],
  F: [300, 170],
  G: [290, 250],
  H: [420, 206],
};
// where each letter sits from its station, clear of the lines
const LETTER: Record<string, [number, number, "start" | "middle" | "end"]> = {
  A: [-16, -12, "end"],
  B: [0, -20, "middle"],
  C: [0, 32, "middle"],
  D: [0, 34, "middle"],
  E: [0, -20, "middle"],
  F: [0, -20, "middle"],
  G: [0, 34, "middle"],
  H: [0, -22, "middle"],
};
const LINES = ["A-B", "A-C", "A-D", "B-E", "C-E", "C-F", "D-G", "F-H", "G-H"];
const R = 11;

export function graphLife(): Figure {
  const paths: InkPath[] = LINES.flatMap((l) => {
    const [a, b] = l.split("-");
    return inkLine(...between(...AT[a], ...AT[b], R + 3), { seed: `metro:${l}`, strokeWidth: 3 });
  });
  for (const [s, [x, y]] of Object.entries(AT)) if (s !== "H") paths.push(...inkCircle(x, y, R, { seed: `metro:${s}` }));
  const spot = inkCircle(...AT.H, R + 2, { seed: "metro:H", stroke: SPOT, fill: SPOT, fillStyle: "hachure", hachureGap: 4, strokeWidth: 2.6 });
  return {
    viewBox: [WIDTH, 300],
    paths,
    spot,
    labels: [
      ...Object.entries(AT).map(([s, [x, y]]) => {
        const [dx, dy, anchor] = LETTER[s];
        return label(x + dx, y + dy, s, { anchor, ...(s === "H" ? { spot: true } : {}) });
      }),
      label(466, 256, "two routes meet", { anchor: "end", size: SMALL, spot: true }),
    ],
  };
}
