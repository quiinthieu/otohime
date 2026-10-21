// Midday: a sunbeam crosses a band of air, blue arrows scatter off it in every
// direction and red goes straight on to a person. Sunset: a low beam crosses a
// much longer stretch of air, and the blue is scattered away along the road.
import type { Article } from "../articles.ts";
import { inkCircle, inkLine, inkRect, type InkPath } from "../ink.ts";
import { arrow, fact, label, SMALL, SPOT, WIDTH, type Figure } from "./kit.ts";

function person(x: number, y: number, seed: string): InkPath[] {
  return [
    ...inkCircle(x, y - 22, 7, { seed: `${seed}:head` }),
    ...inkLine(x, y - 15, x, y + 12, { seed: `${seed}:body` }),
    ...inkLine(x, y + 12, x - 8, y + 30, { seed: `${seed}:left` }),
    ...inkLine(x, y + 12, x + 8, y + 30, { seed: `${seed}:right` }),
  ];
}

export function skyFigure(a: Article): Figure {
  const spot = { stroke: SPOT };
  const paths: InkPath[] = [
    // midday
    ...inkCircle(40, 95, 20, { seed: "sky:sun", fill: "#1a1816", fillStyle: "hachure", hachureGap: 6 }),
    ...inkRect(110, 50, 150, 90, { seed: "sky:air" }),
    ...inkLine(64, 95, 260, 95, { seed: "sky:beam" }),
    ...arrow(260, 95, 392, 95, { seed: "sky:red" }),
    ...person(420, 98, "sky:person"),
    // sunset
    ...inkCircle(40, 266, 14, { seed: "sky:low-sun", fill: "#1a1816", fillStyle: "hachure", hachureGap: 6 }),
    ...inkRect(80, 236, 310, 60, { seed: "sky:long-air" }),
    ...arrow(58, 266, 416, 266, { seed: "sky:low-beam" }),
    ...person(444, 270, "sky:low-person"),
  ];
  const scatter: InkPath[] = [
    ...arrow(185, 95, 150, 60, { ...spot, seed: "sky:s1" }),
    ...arrow(185, 95, 222, 58, { ...spot, seed: "sky:s2" }),
    ...arrow(185, 95, 148, 130, { ...spot, seed: "sky:s3" }),
    ...arrow(185, 95, 224, 132, { ...spot, seed: "sky:s4" }),
    ...arrow(185, 95, 185, 56, { ...spot, seed: "sky:s5" }, 7),
    ...[120, 180, 240, 300, 360].flatMap((x, i) =>
      arrow(x, 266, x + 14, i % 2 ? 288 : 244, { ...spot, seed: `sky:low-s${i}` }, 6),
    ),
  ];
  return {
    viewBox: [WIDTH, 320],
    paths,
    spot: scatter,
    labels: [
      label(14, 24, `scattering ∝ ${fact(a, "law")}`, { size: SMALL }),
      label(40, 62, "Midday", { anchor: "middle", size: SMALL }),
      label(185, 42, "air", { anchor: "middle", size: SMALL }),
      label(185, 165, `blue, ${fact(a, "blue")}: scatters ${fact(a, "ratio")}`, { anchor: "middle", spot: true }),
      label(326, 84, `red, ${fact(a, "red")}`, { anchor: "middle" }),
      label(40, 304, "Sunset", { anchor: "middle", size: SMALL }),
      label(235, 226, "a long road through air: the blue is gone", { anchor: "middle", size: SMALL }),
    ],
  };
}
