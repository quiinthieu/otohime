// The board's kit of hand-inked stamps: nine parts, three corners each, 27 in
// all. The server inks them once and hands the island their path strings as
// props; the island draws each once in <defs> as <symbol id="part-button-soft">
// and places nine with <use>, so rough.js never reaches the browser. A corner
// change swaps a <use>'s href; nothing else about the stamp changes, because
// a part's three are inked with the same seeds and differ only in the radius.
//
// outline: the part's body first (the closed shape its fill goes on), then any
// ink details, all stroked in the ink pot. accent: the part's one spot mark,
// closed shapes filled with the spot pot. Sizes, radii and ids live in
// paper.ts, which scenes.ts shares without loading any ink.
import { CORNERS, PARTS, type Corner, type Part } from "./board.ts";
import { inkCircle, inkLine, inkPath, inkRect, type InkPath } from "./ink.ts";
import { radiusOf, STAMP_SIZE, stampId } from "./paper.ts";

export { CORNER_RADIUS, radiusOf, STAMP_IDS, STAMP_SIZE, stampBounds, stampId } from "./paper.ts";

export type Stamp = { id: string; part: Part; corner: Corner; outline: string[]; accent: string[] };

const round = (n: number) => Math.round(n * 100) / 100;

/** A w x h box centred on the origin with corners of radius r, as SVG path data. */
export function boxPath(w: number, h: number, r: number): string {
  const [x0, y0, x1, y1] = [-w / 2, -h / 2, w / 2, h / 2];
  const p = (x: number, y: number) => `${round(x)} ${round(y)}`;
  if (r <= 0) return `M${p(x0, y0)} L${p(x1, y0)} L${p(x1, y1)} L${p(x0, y1)} Z`;
  const out = [`M${p(x0 + r, y0)}`];
  const line = (fx: number, fy: number, tx: number, ty: number) => {
    if (fx !== tx || fy !== ty) out.push(`L${p(tx, ty)}`);
  };
  line(x0 + r, y0, x1 - r, y0);
  out.push(`Q${p(x1, y0)} ${p(x1, y0 + r)}`);
  line(x1, y0 + r, x1, y1 - r);
  out.push(`Q${p(x1, y1)} ${p(x1 - r, y1)}`);
  line(x1 - r, y1, x0 + r, y1);
  out.push(`Q${p(x0, y1)} ${p(x0, y1 - r)}`);
  line(x0, y1 - r, x0, y0 + r);
  out.push(`Q${p(x0, y0)} ${p(x0 + r, y0)}`);
  return `${out.join(" ")} Z`;
}

// The ink details and the spot mark of each part, about its origin. Neither
// reads the corner, so a part's three stamps share them exactly.
function details(part: Part): { ink: InkPath[]; spot: InkPath[] } {
  const { w, h } = STAMP_SIZE[part];
  const o = (s: string) => ({ seed: `${part}:${s}` });
  const thin = (s: string) => ({ ...o(s), strokeWidth: 1.4 });
  switch (part) {
    case "card":
      // a title underlined in spot, and two lines of body text
      return {
        ink: [...inkLine(-w / 2 + 16, 14, w / 2 - 90, 14, thin("line1")), ...inkLine(-w / 2 + 16, 28, w / 2 - 150, 28, thin("line2"))],
        spot: inkRect(-w / 2 + 16, -4, 84, 5, o("underline")),
      };
    case "bar":
      // a spot dot at the left, a three-line menu at the right
      return {
        ink: [-7, 0, 7].flatMap((y, k) => inkLine(w / 2 - 34, y, w / 2 - 14, y, thin(`menu${k}`))),
        spot: inkCircle(-w / 2 + 18, 0, 6, o("dot")),
      };
    case "field":
      // a caret near the right end
      return { ink: [], spot: inkRect(w / 2 - 24, -11, 3, 22, o("caret")) };
    case "ring":
      // a radio ring with its spot dot, the word to its right
      return { ink: inkCircle(-16, 0, 11, thin("ring")), spot: inkCircle(-16, 0, 6, o("dot")) };
    case "button":
      // a small arrowhead after the word
      return { ink: [], spot: inkPath(`M${w / 2 - 30} -6 L${w / 2 - 18} 0 L${w / 2 - 30} 6 Z`, o("go")) };
    case "ghost":
      // no fill of its own: a spot underline under the word
      return { ink: [], spot: inkRect(-34, 13, 68, 4, o("underline")) };
    case "tag":
      return { ink: [], spot: inkCircle(-w / 2 + 16, 0, 5, o("dot")) };
    case "note":
      // a spot bar down its left edge
      return { ink: [], spot: inkRect(-w / 2 + 10, -h / 2 + 10, 6, h - 20, o("bar")) };
    case "switch":
      // the knob, at the "on" end
      return { ink: [], spot: inkCircle(16, 0, 10, o("knob")) };
  }
}

function draw(part: Part, corner: Corner): { outline: InkPath[]; accent: InkPath[] } {
  const { w, h } = STAMP_SIZE[part];
  const { ink, spot } = details(part);
  const body = inkPath(boxPath(w, h, radiusOf(part, corner)), { seed: `${part}:body` });
  return { outline: [...body, ...ink], accent: spot };
}

/** All 27 stamps, part by part, corners sharp, soft, round. Pure: the same paths every call. */
export function inkStamps(): Stamp[] {
  return PARTS.flatMap((part) =>
    CORNERS.map((corner) => {
      const { outline, accent } = draw(part, corner);
      return { id: stampId(part, corner), part, corner, outline: outline.map((p) => p.d), accent: accent.map((p) => p.d) };
    }),
  );
}
