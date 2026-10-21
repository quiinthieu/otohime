// One knob, nine parts: the same turn (Spot to coral, from the start) with
// the system on and off, side by side. On the left one pot with a line out
// to every part that followed; on the right every part with its own pot and
// a hand to change it, and nothing followed. Both counts are turn()'s.
import { DEFAULT, PARTS, turn, type Turn, type Turned } from "../board.ts";
import { inkCircle, inkLine, inkPath, inkRect, type InkPath } from "../ink.ts";
import { label, SMALL, SPOT, WIDTH, type Figure } from "../kit.ts";

export const FOLLOW_TURN: Turn = { knob: "spot", to: "coral" };

/** The turn on the start board with the system on, and with it off. */
export function followTurns(): { on: Turned; off: Turned } {
  return { on: turn(DEFAULT, FOLLOW_TURN), off: turn({ ...DEFAULT, system: false }, FOLLOW_TURN) };
}

const HEIGHT = 236;
const COLUMN = WIDTH / 2;
const PART = { w: 18, h: 24, pitch: 24, y: 164 };
const partX = (column: number, i: number) => column * COLUMN + COLUMN / 2 + (i - (PARTS.length - 1) / 2) * PART.pitch;

// A small hand pointing down at its pot: a slim blade, its tip at x, y.
function hand(x: number, y: number, seed: string): InkPath[] {
  return inkPath(`M${x} ${y} L${x - 4} ${y - 14} L${x} ${y - 26} L${x + 4} ${y - 14} Z`, { seed, strokeWidth: 1.4 });
}

export function followFigure(): Figure {
  const { on, off } = followTurns();
  const paths: InkPath[] = [];
  const spot: InkPath[] = [];

  // with a system: one pot, a line to each part that followed
  const pot = { x: COLUMN / 2, y: 74, r: 18 };
  spot.push(...inkCircle(pot.x, pot.y, pot.r, { seed: "follow:pot", stroke: SPOT, strokeWidth: 2.6 }));
  PARTS.forEach((part, i) => {
    const x = partX(0, i);
    paths.push(...inkRect(x - PART.w / 2, PART.y - PART.h / 2, PART.w, PART.h, { seed: `follow:on:${part}` }));
    if (on.followed.includes(part)) {
      spot.push(...inkLine(pot.x, pot.y + pot.r + 3, x, PART.y - PART.h / 2 - 3, { seed: `follow:line:${part}`, stroke: SPOT, strokeWidth: 1.6 }));
    }
  });

  // without one: every part its own pot and its own hand
  PARTS.forEach((part, i) => {
    const x = partX(1, i);
    paths.push(...inkRect(x - PART.w / 2, PART.y - PART.h / 2, PART.w, PART.h, { seed: `follow:off:${part}` }));
    paths.push(...inkCircle(x, 122, 7, { seed: `follow:own:${part}` }));
    paths.push(...hand(x, 110, `follow:hand:${part}`));
    if (off.followed.includes(part)) {
      spot.push(...inkLine(x, 129, x, PART.y - PART.h / 2 - 3, { seed: `follow:offline:${part}`, stroke: SPOT, strokeWidth: 1.6 }));
    }
  });
  paths.push(...inkLine(COLUMN, 12, COLUMN, HEIGHT - 12, { seed: "follow:fold", strokeWidth: 1.4 }));

  const labels = [
    label(COLUMN / 2, 30, "With a system", { anchor: "middle" }),
    label(COLUMN + COLUMN / 2, 30, "Without one", { anchor: "middle" }),
    label(COLUMN / 2, 212, `1 pot, ${on.followed.length} followed`, { anchor: "middle", spot: true }),
    label(COLUMN + COLUMN / 2, 212, `${PARTS.length} hands, ${off.followed.length} followed`, { anchor: "middle", size: SMALL }),
  ];
  return { viewBox: [WIDTH, HEIGHT], paths, spot, labels };
}
