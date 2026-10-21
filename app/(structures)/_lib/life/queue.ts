// A line at a bakery counter, standing on a ring of eight floor tiles. The
// first in line is the spot: first in, first served.
import { inkCircle, inkEllipse, inkLine, inkPath, inkRect, type InkPath } from "../ink.ts";
import { label, SMALL, SPOT, WIDTH, type Figure } from "../kit.ts";

const PEOPLE = [150, 220, 290, 360];
const FLOOR = 176;
const RING = { cx: 250, cy: 236, rx: 190, ry: 34 };

function person(x: number, seed: string, o: { stroke?: string } = {}): InkPath[] {
  return [
    ...inkCircle(x, FLOOR - 82, 12, { seed: `${seed}:head`, ...o }),
    ...inkPath(`M${x - 17} ${FLOOR} L${x - 12} ${FLOOR - 62} L${x + 12} ${FLOOR - 62} L${x + 17} ${FLOOR} Z`, { seed: `${seed}:body`, ...o }),
  ];
}

export function queueLife(): Figure {
  const paths: InkPath[] = [
    // the counter with a loaf on it
    ...inkRect(16, 92, 84, 84, { seed: "bakery:counter" }),
    ...inkLine(10, 92, 106, 92, { seed: "bakery:slab", strokeWidth: 2.6 }),
    ...inkEllipse(58, 82, 44, 16, { seed: "bakery:loaf" }),
    ...PEOPLE.slice(1).flatMap((x, i) => person(x, `bakery:p${i + 1}`)),
  ];
  // eight tiles round an ellipse on the floor, tile 0 nearest the counter
  for (let i = 0; i < 8; i++) {
    const a = Math.PI + (i * Math.PI) / 4;
    const x = RING.cx + RING.rx * Math.cos(a);
    const y = RING.cy + RING.ry * Math.sin(a);
    paths.push(...inkRect(Math.round(x - 14), Math.round(y - 9), 28, 18, { seed: `bakery:tile${i}`, strokeWidth: 1.6 }));
  }
  const spot = person(PEOPLE[0], "bakery:p0", { stroke: SPOT });
  return {
    viewBox: [WIDTH, 290],
    paths,
    spot,
    labels: [
      label(58, 58, "bakery", { anchor: "middle", size: SMALL }),
      label(PEOPLE[0], 70, "first", { anchor: "middle", size: SMALL, spot: true }),
      label(PEOPLE[3], 70, "last", { anchor: "middle", size: SMALL }),
    ],
  };
}
