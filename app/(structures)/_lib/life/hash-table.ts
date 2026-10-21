// A coat check: a rail of eight numbered hooks, and a coat whose hook is
// worked out from the coat itself, so the attendant goes straight there.
// Hook 5 is the spot.
import { inkLine, inkPath, type InkPath } from "../ink.ts";
import { arrow, between, label, SMALL, SPOT, WIDTH, type Figure } from "../kit.ts";

const RAIL = 50;
const HOOK = (i: number) => 74 + i * 47;
const CHOSEN = 5;

const hook = (x: number) => `M${x} ${RAIL} L${x} ${RAIL + 26} C${x} ${RAIL + 40} ${x - 16} ${RAIL + 40} ${x - 14} ${RAIL + 28}`;

export function hashTableLife(): Figure {
  const paths: InkPath[] = [
    ...inkLine(40, RAIL, 440, RAIL, { seed: "coat:rail", strokeWidth: 2.8 }),
    // the coat on its hanger
    ...inkPath("M70 176 L94 160 L118 176 Z", { seed: "coat:hanger" }),
    ...inkLine(94, 160, 94, 150, { seed: "coat:hanger-hook" }),
    ...inkPath("M66 178 L122 178 L134 262 L54 262 Z", { seed: "coat:body" }),
    ...inkPath("M84 178 L94 204 L104 178", { seed: "coat:collar", strokeWidth: 1.6 }),
    ...inkLine(94, 204, 94, 262, { seed: "coat:front", strokeWidth: 1.6 }),
    ...arrow(...between(130, 196, HOOK(CHOSEN) - 6, RAIL + 72, 8, 4), { seed: "coat:straight", strokeWidth: 1.8 }),
  ];
  const spot: InkPath[] = [];
  for (let i = 0; i < 8; i++) {
    (i === CHOSEN ? spot : paths).push(...inkPath(hook(HOOK(i)), i === CHOSEN ? { seed: `coat:hook${i}`, stroke: SPOT, strokeWidth: 3 } : { seed: `coat:hook${i}` }));
  }
  return {
    viewBox: [WIDTH, 290],
    paths,
    spot,
    labels: [
      ...Array.from({ length: 8 }, (_, i) => label(HOOK(i) - 4, RAIL + 66, String(i), { anchor: "middle", ...(i === CHOSEN ? { spot: true } : {}) })),
      label(94, 280, "coat", { anchor: "middle", size: SMALL }),
    ],
  };
}
