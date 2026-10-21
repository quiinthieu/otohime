import { DEFAULT } from "../_lib/board.ts";
import { captions } from "../_lib/copy.ts";
import { inkStamps } from "../_lib/stamps.ts";
import { BoardApp, type Stamp } from "./board-app";

// The board, on the server: ink the 27 stamps (rough.js stays here) and hand
// the island their finished path strings and the start board. The island is
// server-rendered like the rest of the page, so with JavaScript off its HTML
// is the finished drawing at DEFAULT (laid out by the same scene()), the
// counter's start sentence, the rule line's rule(DEFAULT) and the knobs
// greyed in a disabled fieldset: one pair of <output>s, whoever reads them.
//
// The page ships the stamps twice (the HTML and the payload the island
// hydrates from), so they go as little as draws them: a part's three stamps
// differ only in the body (the corner), so each part sends its three bodies
// and its ink details and spot mark once, with numbers rounded to whole units
// (0.75 px on a phone, finer than the wobble).

const whole = (d: string) => d.replace(/-?\d+\.\d+/g, (n) => String(Math.round(Number(n))));

function kit(): Stamp[] {
  const out = new Map<string, Stamp>();
  for (const s of inkStamps()) {
    const details = s.outline.slice(1).map(whole).join(" ");
    const accentFill = s.accentFill.map(whole).join(" ");
    const accentStroke = s.accentStroke.map(whole).join(" ");
    const part = out.get(s.part) ?? { part: s.part, bodies: [], details, accentFill, accentStroke };
    if (part.details !== details || part.accentFill !== accentFill || part.accentStroke !== accentStroke) {
      throw new Error(`${s.id}: a corner changed more than the body`);
    }
    part.bodies.push({ id: s.id, fill: whole(s.fill), d: whole(s.outline[0]) });
    out.set(s.part, part);
  }
  return [...out.values()];
}

export function Board() {
  const stamps = kit();
  return (
    <figure className="figure board" data-figure="board">
      <BoardApp stamps={stamps} initial={DEFAULT} />
      <figcaption>{captions.board}</figcaption>
    </figure>
  );
}
