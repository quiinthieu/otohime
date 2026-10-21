// Two jars: liquid water's molecules crowded close, and ice's open six-sided
// rings standing a little taller from the same water. Below, a lake with its
// lid of ice, the 4 °C water at the bottom, and a fish.
import type { Article } from "../articles.ts";
import { inkCircle, inkPath, type InkPath } from "../ink.ts";
import { fact, label, SMALL, SPOT, WIDTH, type Figure } from "./kit.ts";

// Liquid molecules, jittered by hand so the jar looks crowded, not gridded.
const DROPS: [number, number][] = [
  [44, 78], [66, 74], [90, 80], [112, 72], [136, 78], [160, 74], [184, 80],
  [54, 98], [78, 100], [100, 94], [124, 100], [148, 96], [172, 100], [192, 104],
  [42, 120], [66, 122], [88, 116], [112, 124], [136, 118], [160, 124], [184, 120],
  [54, 140], [78, 138], [102, 142], [126, 138], [150, 142], [174, 138],
];

// Pointy-topped hexagon of side s round (cx, cy), as an absolute path.
function hexagon(cx: number, cy: number, s: number): string {
  const pts = [0, 1, 2, 3, 4, 5].map((i) => {
    const t = (Math.PI / 3) * i + Math.PI / 6;
    return `${(cx + s * Math.cos(t)).toFixed(1)} ${(cy + s * Math.sin(t)).toFixed(1)}`;
  });
  return `M${pts[0]} L${pts.slice(1).join(" L")} Z`;
}

const S = 16;
const HEX_W = Math.sqrt(3) * S;
// three rows of honeycomb, the middle row offset by half a ring
const RINGS: [number, number][] = [0, 1, 2].flatMap((row) =>
  [0, 1, 2, 3].map((col): [number, number] => [300 + col * HEX_W + (row % 2) * (HEX_W / 2), 68 + row * 1.5 * S]),
);

export function iceFigure(a: Article): Figure {
  const paths: InkPath[] = [
    ...inkPath("M24 52 L24 152 L206 152 L206 52", { seed: "ice:jar-water" }),
    ...inkPath("M30 64 L200 64", { seed: "ice:surface", strokeWidth: 1.4 }),
    ...DROPS.flatMap(([x, y], i) => inkCircle(x, y, 6, { seed: `ice:drop${i}`, strokeWidth: 1.4 })),
    ...inkPath("M274 52 L274 152 L456 152 L456 52", { seed: "ice:jar-ice" }),
    // the lake bed, and a fish near the bottom
    ...inkPath("M14 214 C60 330 420 330 466 214", { seed: "ice:bed" }),
    ...inkPath("M250 280 Q272 266 294 280 Q272 294 250 280 Z", { seed: "ice:fish" }),
    ...inkPath("M294 280 L306 272 L306 288 Z", { seed: "ice:tail" }),
  ];
  const spot: InkPath[] = [
    ...RINGS.flatMap(([x, y], i) => inkPath(hexagon(x, y, S), { stroke: SPOT, seed: `ice:ring${i}` })),
    ...inkPath("M30 214 L450 214 L446 230 L36 230 Z", { stroke: SPOT, fill: SPOT, fillStyle: "hachure", hachureGap: 5, seed: "ice:lid" }),
  ];
  return {
    viewBox: [WIDTH, 340],
    paths,
    spot,
    labels: [
      label(115, 38, "liquid water", { anchor: "middle", size: SMALL }),
      label(365, 38, `ice: ${fact(a, "grow")} bigger`, { anchor: "middle", spot: true, size: SMALL }),
      label(115, 178, fact(a, "water"), { anchor: "middle" }),
      label(365, 178, fact(a, "ice"), { anchor: "middle", spot: true }),
      label(240, 208, "a lid of ice on the lake", { anchor: "middle", size: SMALL }),
      label(240, 254, `${fact(a, "densest")} water at the bottom`, { anchor: "middle", size: SMALL }),
    ],
  };
}
