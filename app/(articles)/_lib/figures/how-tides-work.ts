// The Earth in a stretched coat of ocean, one bulge toward the Moon and one
// away from it, with longer pull arrows on the near side. Below, two insets:
// Sun, Earth and Moon in line (spring tides) and at right angles (neap).
import type { Article } from "../articles.ts";
import { inkCircle, inkPath, type InkPath } from "../ink.ts";
import { arrow, fact, label, SMALL, SPOT, WIDTH, type Figure } from "./kit.ts";

// An ellipse as two arcs, which rough.js turns into curves.
const ellipse = (cx: number, cy: number, rx: number, ry: number) =>
  `M${cx - rx} ${cy} A${rx} ${ry} 0 1 0 ${cx + rx} ${cy} A${rx} ${ry} 0 1 0 ${cx - rx} ${cy} Z`;

const EARTH = { x: 140, y: 118, r: 44 };
const MOON = { x: 380, y: 118, r: 16 };

export function tidesFigure(a: Article): Figure {
  const paths: InkPath[] = [
    ...inkCircle(EARTH.x, EARTH.y, EARTH.r, { seed: "tide:earth", fill: "#1a1816", fillStyle: "hachure", hachureGap: 7 }),
    ...inkCircle(MOON.x, MOON.y, MOON.r, { seed: "tide:moon" }),
    // the pull, strong on the near side and weak on the far side
    ...arrow(226, 118, 290, 118, { seed: "tide:pull-near" }),
    ...arrow(52, 118, 66, 118, { seed: "tide:pull-far" }, 6),
    // spring: Sun, Earth and Moon in a line
    ...inkCircle(40, 282, 18, { seed: "tide:spring-sun", fill: "#1a1816", fillStyle: "hachure", hachureGap: 5 }),
    ...inkCircle(120, 282, 9, { seed: "tide:spring-earth" }),
    ...inkCircle(152, 282, 5, { seed: "tide:spring-moon" }),
    // neap: the Moon at right angles
    ...inkCircle(290, 282, 18, { seed: "tide:neap-sun", fill: "#1a1816", fillStyle: "hachure", hachureGap: 5 }),
    ...inkCircle(380, 282, 9, { seed: "tide:neap-earth" }),
    ...inkCircle(380, 252, 5, { seed: "tide:neap-moon" }),
  ];
  const spot: InkPath[] = [
    ...inkPath(ellipse(EARTH.x, EARTH.y, 76, 54), { stroke: SPOT, seed: "tide:bulges" }),
    ...inkPath(ellipse(120, 282, 17, 12), { stroke: SPOT, seed: "tide:spring-bulges" }),
    ...inkPath(ellipse(380, 282, 13, 11), { stroke: SPOT, seed: "tide:neap-bulges" }),
  ];
  return {
    viewBox: [WIDTH, 330],
    paths,
    spot,
    labels: [
      label(470, 40, `the Moon's pull: ${fact(a, "ratio")} the Sun's`, { anchor: "end", size: SMALL }),
      label(MOON.x, 158, "Moon", { anchor: "middle", size: SMALL }),
      label(226, 100, "high tide", { spot: true, size: SMALL }),
      label(60, 198, "high tide", { anchor: "middle", spot: true, size: SMALL }),
      label(240, 228, `two high tides every ${fact(a, "cycle")}`, { anchor: "middle" }),
      label(100, 322, `spring tides: ${fact(a, "spring")}`, { anchor: "middle", size: SMALL }),
      label(470, 322, `neap tides: ${fact(a, "neap")}`, { anchor: "end", size: SMALL }),
    ],
  };
}
