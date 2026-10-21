// A tournament ladder where the smaller number wins each match, with the same
// numbers in a row of boxes underneath: the worked example's heap, 1 3 8 5 4.
// The winner at the top is the spot.
import { inkPath, inkRect, type InkPath } from "../ink.ts";
import { label, SPOT, WIDTH, type Figure } from "../kit.ts";

const ROW = [1, 3, 8, 5, 4];
// where box i sits on the ladder
const LADDER: [number, number][] = [
  [240, 40],
  [130, 104],
  [350, 104],
  [75, 168],
  [185, 168],
];
const RUNG = { w: 40, h: 30 };
const BOXES = { y: 222, pitch: 56, w: 44, h: 40 };

export function heapLife(): Figure {
  const paths: InkPath[] = [];
  const spot: InkPath[] = [];
  LADDER.forEach(([x, y], i) => {
    const o = i === 0 ? { seed: "ladder:winner", stroke: SPOT, fill: SPOT, fillStyle: "hachure" as const, hachureGap: 6 } : { seed: `ladder:rung${i}` };
    (i === 0 ? spot : paths).push(...inkRect(x - RUNG.w / 2, y - RUNG.h / 2, RUNG.w, RUNG.h, o));
  });
  // each match: the two players' lines meet, and the winner's line climbs
  for (const p of [0, 1]) {
    const [px, py] = LADDER[p];
    const [ax, ay] = LADDER[2 * p + 1];
    const [bx] = LADDER[2 * p + 2];
    const mid = (py + ay) / 2;
    paths.push(...inkPath(`M${ax} ${ay - RUNG.h / 2} L${ax} ${mid} L${bx} ${mid} L${bx} ${ay - RUNG.h / 2}`, { seed: `ladder:match${p}`, strokeWidth: 1.8 }));
    paths.push(...inkPath(`M${px} ${mid} L${px} ${py + RUNG.h / 2}`, { seed: `ladder:climb${p}`, strokeWidth: 1.8 }));
  }
  const boxX = (i: number) => WIDTH / 2 + (i - 2) * BOXES.pitch;
  ROW.forEach((_, i) => paths.push(...inkRect(boxX(i) - BOXES.w / 2, BOXES.y, BOXES.w, BOXES.h, { seed: `ladder:box${i}` })));
  return {
    viewBox: [WIDTH, 280],
    paths,
    spot,
    labels: [
      ...LADDER.map(([x, y], i) => label(x, y + 6, String(ROW[i]), { anchor: "middle", ...(i === 0 ? { spot: true } : {}) })),
      ...ROW.map((v, i) => label(boxX(i), BOXES.y + 26, String(v), { anchor: "middle" })),
    ],
  };
}
