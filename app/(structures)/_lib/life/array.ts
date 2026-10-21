// A chest of eight numbered drawers on short legs, two rows of four. Drawer 5
// is the spot: any drawer opens at once, because each has a number.
import { inkCircle, inkLine, inkRect, type InkPath } from "../ink.ts";
import { label, SPOT, WIDTH, type Figure } from "../kit.ts";

const DRAWER = { w: 76, h: 90, left: 76, top: 46, pitchX: 84, pitchY: 98 };
const OPEN = 5;

export function arrayLife(): Figure {
  const at = (i: number): [number, number] => [DRAWER.left + (i % 4) * DRAWER.pitchX, DRAWER.top + Math.floor(i / 4) * DRAWER.pitchY];
  const paths: InkPath[] = [
    ...inkRect(60, 30, 360, 222, { seed: "chest:body", strokeWidth: 2.6 }),
    ...inkLine(52, 30, 428, 30, { seed: "chest:top", strokeWidth: 2.6 }),
    ...inkLine(78, 252, 74, 278, { seed: "chest:leg-l" }),
    ...inkLine(402, 252, 406, 278, { seed: "chest:leg-r" }),
  ];
  const spot: InkPath[] = [];
  for (let i = 0; i < 8; i++) {
    const [x, y] = at(i);
    const o = i === OPEN ? { stroke: SPOT, seed: `chest:drawer${i}` } : { seed: `chest:drawer${i}` };
    const into = i === OPEN ? spot : paths;
    into.push(...inkRect(x, y, DRAWER.w, DRAWER.h, i === OPEN ? { ...o, fill: SPOT, fillStyle: "hachure", hachureGap: 7 } : o));
    into.push(...inkCircle(x + DRAWER.w / 2, y + DRAWER.h - 22, 6, { ...o, seed: `chest:knob${i}` }));
  }
  return {
    viewBox: [WIDTH, 290],
    paths,
    spot,
    labels: Array.from({ length: 8 }, (_, i) => {
      const [x, y] = at(i);
      return label(x + DRAWER.w / 2, y + 34, String(i), { anchor: "middle", ...(i === OPEN ? { spot: true } : {}) });
    }),
  };
}
