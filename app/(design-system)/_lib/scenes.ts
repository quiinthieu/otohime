// Where the board's nine parts go for any board: which stamp, where, filled
// and stroked with what, and what each says in which size and face. Pure
// geometry and no ink, so the island can lay out every turn itself; the
// server and the island call the same scene(), so the still and the moving
// picture agree.
//
// The parts sit on a small screen, six rows from the top: a bar; a card; a
// field and its ring; a button and a ghost; a tag and a switch; a note. Every
// part is drawn from values(board), so with the system on all nine read the
// pots and with it off each reads its own DRIFT. A part's x and y follow only
// the gaps (its own and those above it, or to its left), its stamp only its
// corner, and its colours and lettering only paper, ink, spot, size and face.
// The height is the one the widest gap needs, so the drawing never jumps.
import { DRIFT, GAPS, PARTS, values, type Board, type Face, type Part, type PartValues } from "./board.ts";
import { label, STAMP_SIZE, stampId, WIDTH, type Label } from "./paper.ts";

// x, y is the stamp's centre; fill is the body, stroke the outline and the
// lettering, accent the spot mark.
export type Placed = {
  part: Part;
  stamp: string;
  x: number;
  y: number;
  fill: string;
  stroke: string;
  accent: string;
  speed: number;
  label: { text: string; size: number; face: Face };
};

export type Scene = { width: typeof WIDTH; height: number; paper: string; parts: Placed[]; labels: Label[] };

// What each part says. Short, so the largest size fits inside the part.
export const WORDS: Record<Part, string> = {
  card: "A card",
  bar: "Menu",
  field: "Your name",
  ring: "yes",
  button: "Send",
  ghost: "Cancel",
  tag: "New",
  note: "A note to read",
  switch: "On",
};

// The rows, top to bottom; a row's second part sits right of its first.
export const ROWS: readonly (readonly Part[])[] = [["bar"], ["card"], ["field", "ring"], ["button", "ghost"], ["tag", "switch"], ["note"]];

const LEFT = 40;
const TOP = 8;

// The widest gap any board can reach: a gap preset or a part's own drift.
export const MAX_GAP = Math.max(...Object.values(GAPS), ...PARTS.map((p) => DRIFT[p].gap));

export const HEIGHT = TOP + ROWS.reduce((sum, row) => sum + MAX_GAP + STAMP_SIZE[row[0]].h, 0) + MAX_GAP;

// Where a part's word goes, from its centre: its anchor, x and baseline.
function wordAt(part: Part, size: number): { anchor: "start" | "middle"; dx: number; dy: number } {
  const { w, h } = STAMP_SIZE[part];
  const mid = Math.round(size * 0.35 * 10) / 10;
  switch (part) {
    case "card":
      return { anchor: "start", dx: -w / 2 + 16, dy: -h / 2 + 30 };
    case "bar":
      return { anchor: "start", dx: -w / 2 + 32, dy: mid };
    case "field":
      return { anchor: "start", dx: -w / 2 + 12, dy: mid };
    case "ring":
      return { anchor: "start", dx: -3, dy: mid };
    case "button":
      return { anchor: "middle", dx: -8, dy: mid };
    case "ghost":
      return { anchor: "middle", dx: 0, dy: 6 };
    case "tag":
    case "note":
      return { anchor: "start", dx: -w / 2 + 28, dy: mid };
    case "switch":
      return { anchor: "start", dx: -24, dy: mid };
  }
}

function place(part: Part, v: PartValues, x: number, y: number): Placed {
  return {
    part,
    stamp: stampId(part, v.corner),
    x,
    y,
    // the button is the one part filled with the spot; the rest sit on paper
    fill: part === "button" ? v.spot : v.paper,
    stroke: v.ink,
    accent: v.spot,
    speed: v.speed,
    label: { text: WORDS[part], size: v.size, face: v.face },
  };
}

/** The word on a placed part, where the island letters it. */
export function wordOf(p: Placed): Label {
  const at = wordAt(p.part, p.label.size);
  return label(p.x + at.dx, p.y + at.dy, p.label.text, { anchor: at.anchor, size: p.label.size });
}

/** The board's drawing: nine parts in PARTS order, each lettered. */
export function scene(b: Board): Scene {
  const v = values(b);
  const at = new Map<Part, Placed>();
  let cursor = TOP;
  for (const row of ROWS) {
    const [first, second] = row;
    cursor += v[first].gap;
    const { w, h } = STAMP_SIZE[first];
    at.set(first, place(first, v[first], LEFT + w / 2, cursor + h / 2));
    if (second) {
      const s = STAMP_SIZE[second];
      at.set(second, place(second, v[second], LEFT + w + v[second].gap + s.w / 2, cursor + s.h / 2));
    }
    cursor += h;
  }
  const parts = PARTS.map((p) => at.get(p)!);
  // every DRIFT part keeps the cream screen, so the card's paper is the screen's
  return { width: WIDTH, height: HEIGHT, paper: v.card.paper, parts, labels: parts.map(wordOf) };
}
