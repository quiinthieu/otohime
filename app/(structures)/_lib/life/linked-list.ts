// A treasure hunt: five notes left about the place, each saying where the next
// one is, and the treasure after the last. The fifth note is the spot: to
// reach it you read the four before it.
import { inkLine, inkPath, type InkPath } from "../ink.ts";
import { arrow, between, label, SMALL, SPOT, WIDTH, type Figure } from "../kit.ts";

// centre and tilt (degrees) of each note
const NOTES: [number, number, number][] = [
  [80, 86, -6],
  [230, 122, 5],
  [390, 82, -4],
  [380, 222, 6],
  [220, 236, -5],
];
const TREASURE: [number, number] = [76, 232];
const NOTE = { w: 64, h: 44 };

function note(cx: number, cy: number, tilt: number): string {
  const a = (tilt * Math.PI) / 180;
  const pts = [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ].map(([sx, sy]) => {
    const [x, y] = [(sx * NOTE.w) / 2, (sy * NOTE.h) / 2];
    return `${(cx + x * Math.cos(a) - y * Math.sin(a)).toFixed(1)} ${(cy + x * Math.sin(a) + y * Math.cos(a)).toFixed(1)}`;
  });
  return `M${pts[0]} L${pts.slice(1).join(" L")} Z`;
}

export function linkedListLife(): Figure {
  const paths: InkPath[] = [];
  const spot: InkPath[] = [];
  NOTES.forEach(([x, y, t], i) => {
    const last = i === NOTES.length - 1;
    (last ? spot : paths).push(...inkPath(note(x, y, t), last ? { seed: `hunt:note${i}`, stroke: SPOT, fill: SPOT, fillStyle: "hachure", hachureGap: 7 } : { seed: `hunt:note${i}` }));
    const [nx, ny] = i + 1 < NOTES.length ? NOTES[i + 1] : TREASURE;
    paths.push(...arrow(...between(x, y, nx, ny, 46, i + 1 < NOTES.length ? 46 : 30), { seed: `hunt:way${i}`, strokeWidth: 1.6 }));
  });
  const [tx, ty] = TREASURE;
  paths.push(...inkLine(tx - 16, ty - 16, tx + 16, ty + 16, { seed: "hunt:x1", strokeWidth: 3 }), ...inkLine(tx + 16, ty - 16, tx - 16, ty + 16, { seed: "hunt:x2", strokeWidth: 3 }));
  return {
    viewBox: [WIDTH, 290],
    paths,
    spot,
    labels: [
      label(80, 36, "start", { anchor: "middle", size: SMALL }),
      ...NOTES.map(([x, y], i) => label(x, y + 7, String(i + 1), { anchor: "middle", ...(i === NOTES.length - 1 ? { spot: true } : {}) })),
      label(76, 276, "treasure", { anchor: "middle", size: SMALL }),
    ],
  };
}
