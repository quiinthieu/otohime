// Four calendar years of 365 days, each with a red sliver of the 0.2422 day it
// leaves out; the four slivers make the leap day. Below, a 400-year ruler from
// 1600 to 2000 hatched with its 97 leap days, 1900 skipped and 2000 kept.
import type { Article } from "../articles.ts";
import { inkLine, inkPath, inkRect, type InkPath } from "../ink.ts";
import { arrow, fact, label, SMALL, SPOT, WIDTH, type Figure } from "./kit.ts";

const ROWS = [34, 62, 90, 118];
const BAR = 22;
const RULER = { x0: 30, x1: 400, y: 250 };

export function leapFigure(a: Article): Figure {
  const step = (RULER.x1 - RULER.x0) / 4;
  const ticks = [0, 1, 2, 3, 4].map((i) => RULER.x0 + i * step);
  const paths: InkPath[] = [
    ...ROWS.flatMap((y, i) => inkRect(20, y, 280, BAR, { seed: `leap:year${i}` })),
    ...inkPath(`M330 ${ROWS[0]} L338 ${ROWS[0]} L338 ${ROWS[3] + BAR} L330 ${ROWS[3] + BAR}`, { seed: "leap:brace" }),
    ...arrow(340, 87, 360, 87, { seed: "leap:to-day" }, 7),
    ...inkLine(RULER.x0, RULER.y, RULER.x1, RULER.y, { seed: "leap:ruler" }),
    ...ticks.flatMap((x, i) => inkLine(x, RULER.y - 16, x, RULER.y + 8, { seed: `leap:tick${i}` })),
  ];
  const spot: InkPath[] = [
    ...ROWS.flatMap((y, i) => inkRect(300, y, 22, BAR, { stroke: SPOT, fill: SPOT, fillStyle: "hachure", hachureGap: 4, seed: `leap:sliver${i}` })),
    ...inkRect(RULER.x0, RULER.y - 14, RULER.x1 - RULER.x0, 12, {
      stroke: SPOT,
      fill: SPOT,
      fillStyle: "hachure",
      hachureAngle: 90,
      hachureGap: 4,
      seed: "leap:leap-days",
    }),
  ];
  return {
    viewBox: [WIDTH, 340],
    paths,
    spot,
    labels: [
      label(311, 24, `+${fact(a, "short")}`, { anchor: "middle", spot: true, size: SMALL }),
      label(160, 51, fact(a, "calendar"), { anchor: "middle", size: SMALL }),
      label(366, 93, fact(a, "leap"), { spot: true }),
      label(366, 114, "leap day", { size: SMALL }),
      label(160, 168, `one year = ${fact(a, "year")}`, { anchor: "middle", size: SMALL }),
      label(240, 196, `no leap days: ${fact(a, "drift")} off a century`, { anchor: "middle", size: SMALL }),
      label(215, 226, fact(a, "count"), { anchor: "middle", spot: true, size: SMALL }),
      label(ticks[0], 280, "1600", { anchor: "middle", size: SMALL }),
      label(ticks[3], 280, fact(a, "y1900"), { anchor: "middle", size: SMALL }),
      label(ticks[4], 280, fact(a, "y2000"), { anchor: "middle", size: SMALL }),
      label(240, 326, `average year: ${fact(a, "mean")}`, { anchor: "middle" }),
    ],
  };
}
