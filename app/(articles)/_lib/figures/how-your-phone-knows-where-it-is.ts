// Three satellites high over the Earth, each with an arc of its distance; the
// arcs meet at the phone. A fourth satellite carries a clock, and a scale
// arrow gives the height.
import type { Article } from "../articles.ts";
import { inkCircle, inkLine, inkPath, inkRect, type InkPath } from "../ink.ts";
import { arrow, fact, label, SMALL, SPOT, WIDTH, type Figure } from "./kit.ts";

const PHONE = { x: 240, y: 238 };
const SATELLITES: [number, number][] = [
  [70, 70],
  [240, 48],
  [410, 70],
];
const FOURTH: [number, number] = [396, 124];

function satellite(x: number, y: number, seed: string): InkPath[] {
  return [
    ...inkRect(x - 6, y - 6, 12, 12, { seed: `${seed}:body` }),
    ...inkRect(x - 24, y - 4, 14, 8, { seed: `${seed}:left`, fill: "#1a1816", fillStyle: "hachure", hachureGap: 3 }),
    ...inkRect(x + 10, y - 4, 14, 8, { seed: `${seed}:right`, fill: "#1a1816", fillStyle: "hachure", hachureGap: 3 }),
  ];
}

// A short arc of the circle round (sx, sy) that passes through the phone.
function distanceArc(sx: number, sy: number, seed: string): InkPath[] {
  const r = Math.hypot(PHONE.x - sx, PHONE.y - sy);
  const mid = Math.atan2(PHONE.y - sy, PHONE.x - sx);
  const at = (t: number) => `${(sx + r * Math.cos(t)).toFixed(1)} ${(sy + r * Math.sin(t)).toFixed(1)}`;
  return inkPath(`M${at(mid - 0.4)} A${r.toFixed(1)} ${r.toFixed(1)} 0 0 1 ${at(mid + 0.4)}`, { seed, strokeWidth: 1.6 });
}

export function phoneFigure(a: Article): Figure {
  const [fx, fy] = FOURTH;
  const paths: InkPath[] = [
    ...inkPath("M10 300 Q240 236 470 300", { seed: "gps:earth" }),
    ...SATELLITES.flatMap(([x, y], i) => [...satellite(x, y, `gps:sat${i}`), ...distanceArc(x, y, `gps:arc${i}`)]),
    ...satellite(fx, fy, "gps:sat3"),
    ...inkCircle(fx + 46, fy, 12, { seed: "gps:clock" }),
    ...inkLine(fx + 46, fy, fx + 46, fy - 8, { seed: "gps:hour" }),
    ...inkLine(fx + 46, fy, fx + 53, fy + 3, { seed: "gps:minute" }),
    ...arrow(24, 290, 24, 76, { seed: "gps:height" }),
  ];
  const spot: InkPath[] = [
    ...inkRect(PHONE.x - 7, PHONE.y - 12, 14, 24, { stroke: SPOT, fill: SPOT, fillStyle: "solid", seed: "gps:phone" }),
    ...inkCircle(PHONE.x, PHONE.y, 20, { stroke: SPOT, strokeWidth: 1.4, seed: "gps:within" }),
  ];
  return {
    viewBox: [WIDTH, 320],
    paths,
    spot,
    labels: [
      label(240, 22, `${fact(a, "count")} working GPS satellites`, { anchor: "middle" }),
      label(34, 190, `${fact(a, "height")} up`, { size: SMALL }),
      label(470, 164, `${fact(a, "needed")}: one fixes the clock`, { anchor: "end", size: SMALL }),
      label(266, 244, `within ${fact(a, "accuracy")}`, { spot: true, size: SMALL }),
      label(240, 312, "Earth", { anchor: "middle", size: SMALL }),
    ],
  };
}
