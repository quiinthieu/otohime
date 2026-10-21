// A ladder of five rungs, byte to terabyte, each a thousand times the one
// below, with an everyday thing beside each. A red sliver on the top rung is
// what counting in 1,024s takes off a terabyte.
import type { Article } from "../articles.ts";
import { inkCircle, inkLine, inkRect, type InkPath } from "../ink.ts";
import { fact, label, SMALL, SPOT, WIDTH, type Figure } from "./kit.ts";

// byte, kilobyte, megabyte, gigabyte, terabyte, bottom to top
const RUNGS = [300, 240, 180, 120, 60];
const RAILS = [70, 130];

function things(): InkPath[] {
  const [b, kb, mb, gb, tb] = RUNGS;
  return [
    // a letter
    ...inkRect(162, b - 12, 18, 22, { seed: "gb:letter" }),
    ...inkLine(165, b + 8, 171, b - 9, { seed: "gb:a-left" }),
    ...inkLine(171, b - 9, 177, b + 8, { seed: "gb:a-right" }),
    // a page with lines of text
    ...inkRect(158, kb - 16, 24, 30, { seed: "gb:page" }),
    ...[0, 1, 2, 3].flatMap((i) => inkLine(162, kb - 9 + i * 6, 178, kb - 9 + i * 6, { seed: `gb:line${i}`, strokeWidth: 1.2 })),
    // a book
    ...inkRect(152, mb - 14, 36, 26, { seed: "gb:book" }),
    ...inkLine(158, mb - 14, 158, mb + 12, { seed: "gb:spine" }),
    // a disc
    ...inkCircle(170, gb, 14, { seed: "gb:disc" }),
    ...inkCircle(170, gb, 3, { seed: "gb:hole" }),
    // a drive
    ...inkRect(150, tb - 11, 40, 22, { seed: "gb:drive" }),
    ...inkCircle(182, tb + 4, 2, { seed: "gb:light" }),
  ];
}

export function gigabyteFigure(a: Article): Figure {
  const [left, right] = RAILS;
  const paths: InkPath[] = [
    ...inkLine(left, 30, left, 318, { seed: "gb:rail-left" }),
    ...inkLine(right, 30, right, 318, { seed: "gb:rail-right" }),
    ...RUNGS.flatMap((y, i) => inkRect(left - 4, y - 9, right - left + 8, 18, { seed: `gb:rung${i}` })),
    ...things(),
  ];
  const spot: InkPath[] = inkRect(right - 6, RUNGS[4] - 9, 10, 18, {
    stroke: SPOT,
    fill: SPOT,
    fillStyle: "solid",
    seed: "gb:sliver",
  });
  const step = fact(a, "step");
  return {
    viewBox: [WIDTH, 340],
    paths,
    spot,
    labels: [
      label(200, RUNGS[0] + 6, `1 byte = ${fact(a, "bits")}: a letter`),
      label(200, RUNGS[1] + 6, `${fact(a, "page")}: a page of ${fact(a, "letters")}`),
      label(200, RUNGS[2] + 6, `${fact(a, "book")}: a book of ${fact(a, "pages")}`),
      label(200, RUNGS[3] + 6, `${fact(a, "film")}: a DVD film`),
      label(200, RUNGS[4] + 6, `1 TB: about ${fact(a, "films")}`),
      ...RUNGS.slice(1).map((y) => label((left + right) / 2, y + 36, step, { anchor: "middle", size: SMALL })),
      label(150, 30, `counted in ${fact(a, "binary")}s, it shows ${fact(a, "shown")}`, { spot: true, size: SMALL }),
    ],
  };
}
