// Pure state for the operable figures: (state, action) => state, so a
// reducer drives each one and a test can play it without a browser.
// "tick" advances one frame; "settle" runs frames until the machine rests,
// which is what reduced motion and the tests use.

type Frame = "tick" | "settle";

function settle<S>(state: S, frame: (s: S) => S, busy: (s: S) => boolean): S {
  // ponytail: a frame cap rather than proving every machine halts
  for (let i = 0; i < 500 && busy(state); i++) state = frame(state);
  return state;
}

/* Pocket console: a menu cursor, and a button that stays down for two frames
   so the press shows. */

export type Button = "up" | "down" | "a";
export type Pad = { items: number; cursor: number; pressed: Button | null; hold: number };
export type PadAction = Button | Frame;

export const newPad = (items: number): Pad => ({ items, cursor: 0, pressed: null, hold: 0 });

const padBusy = (s: Pad) => s.pressed !== null;
const padFrame = (s: Pad): Pad => (s.hold > 1 ? { ...s, hold: s.hold - 1 } : { ...s, pressed: null, hold: 0 });

export function pad(s: Pad, action: PadAction): Pad {
  if (action === "tick") return padFrame(s);
  if (action === "settle") return settle(s, padFrame, padBusy);
  const step = action === "up" ? -1 : action === "down" ? 1 : 0;
  return { ...s, cursor: (s.cursor + step + s.items) % s.items, pressed: action, hold: 2 };
}

/* Switchboard: pick a line, the operator swings the cord into its jack, and
   it rings until someone picks up. The plug can also be carried by hand:
   let go within SNAP of a jack and that line connects (the plug is already
   in, so the call starts ringing); let go anywhere else, or lose the
   pointer, and the cord springs back to where the plug was, over SPRING
   frames. Positions are figure units, the drawing's viewBox. */

export const PLUG = 4; // frames for the cord to reach the jack
export const RING = 6; // frames of ringing
export const SNAP = 14; // how near a jack a dropped plug must land
export const SPRING = 6; // frames for a dropped plug to spring home
export type XY = readonly [x: number, y: number];
export type Board = {
  line: number | null;
  t: number;
  calls: number;
  held?: XY | null; // the plug, in hand
  from?: XY | null; // where it was let go, springing home
  back?: number; // spring frames left
};
export type BoardDrag =
  | { type: "grab"; at: XY }
  | { type: "move"; at: XY }
  | { type: "release"; at: XY; jacks: readonly XY[] }
  | { type: "cancel" };
export type BoardAction = number | Frame | BoardDrag;

export const newBoard = (): Board => ({ line: null, t: 0, calls: 0 });
const ringing = (s: Board) => s.line !== null && s.t < PLUG + RING;
export const boardBusy = (s: Board) => ringing(s) || (s.back ?? 0) > 0;

// How far the plug has come home, by spring frame: past it, then back.
const SPRUNG = [0, 0.45, 0.85, 1.08, 1.03, 0.99, 1];
export const springAt = (s: Board) => SPRUNG[SPRING - Math.min(SPRING, s.back ?? 0)];

// The jack a plug let go at `at` lands in: the nearest within SNAP, or null.
export function jackAt(at: XY, jacks: readonly XY[]): number | null {
  let best: number | null = null;
  let near = SNAP;
  for (let i = 0; i < jacks.length; i++) {
    const d = Math.hypot(jacks[i][0] - at[0], jacks[i][1] - at[1]);
    if (d <= near) [best, near] = [i, d];
  }
  return best;
}

// The cord is CORD long: slack hangs, roughly a catenary's sag
// sqrt(3 d (L - d) / 8) for a span d, and a cord pulled its full length
// runs straight. Returned as the bend's pull below the lower end.
export const CORD = 230;
export const cordSag = (span: number) => Math.min(40, Math.sqrt((3 * span * Math.max(0, CORD - span)) / 8) * 0.6);

function boardFrame(s: Board): Board {
  if (!boardBusy(s)) return s;
  let next = s;
  if (ringing(s)) {
    const t = s.t + 1;
    next = { ...next, t, calls: s.calls + (t === PLUG + RING ? 1 : 0) };
  }
  if ((s.back ?? 0) > 0) {
    const back = (s.back ?? 0) - 1;
    next = { ...next, back, from: back ? s.from : null };
  }
  return next;
}

// Let go of the plug: it springs home from where it was.
const drop = (s: Board, at: XY): Board => ({ ...s, held: null, from: at, back: SPRING });

function drag(s: Board, action: BoardDrag): Board {
  switch (action.type) {
    case "grab":
      return { ...s, held: action.at, from: null, back: 0 };
    case "move":
      return s.held ? { ...s, held: action.at } : s;
    case "cancel":
      return s.held ? drop(s, s.held) : s;
    case "release": {
      if (!s.held) return s;
      const jack = jackAt(action.at, action.jacks);
      if (jack === null) return drop(s, action.at);
      // the same call as picking the line, with the cord already in the jack
      const next = switchboard({ ...s, held: null, from: null, back: 0 }, jack);
      return { ...next, t: Math.max(next.t, PLUG) };
    }
  }
}

export function switchboard(s: Board, action: BoardAction): Board {
  if (action === "tick") return boardFrame(s);
  if (action === "settle") return settle(s, boardFrame, boardBusy);
  if (typeof action === "object") return drag(s, action);
  // another line, even mid-call: the operator moves the cord, out of any hand
  const free = s.held || s.back ? { ...s, held: null, from: null, back: 0 } : s;
  return action === free.line ? free : { ...free, line: action, t: 0 };
}

/* Claw machine. Slot 0 is over the prize chute; capsules sit in 1..SLOTS. */

export const SLOTS = 6;
export const DROP = 6; // frames to lower the claw all the way

export type Capsule = { slot: number; game: number };
export type Claw = {
  slot: number;
  drop: number;
  phase: "idle" | "down" | "grab" | "up" | "carry" | "release";
  wait: number;
  holding: Capsule | null;
  capsules: Capsule[];
  games: number;
  prizes: number;
  last: number | null;
  missed: boolean;
};
export type ClawAction = "left" | "right" | "drop" | Frame;

const stock = (games: number): Capsule[] =>
  Array.from({ length: Math.min(games, SLOTS) }, (_, i) => ({ slot: i + 1, game: i }));

export const newClaw = (games: number): Claw => ({
  slot: 0,
  drop: 0,
  phase: "idle",
  wait: 0,
  holding: null,
  capsules: stock(games),
  games,
  prizes: 0,
  last: null,
  missed: false,
});

export const clawBusy = (s: Claw) => s.phase !== "idle";

function clawFrame(s: Claw): Claw {
  switch (s.phase) {
    case "idle":
      return s;
    case "down":
      return s.drop < DROP ? { ...s, drop: s.drop + 1 } : { ...s, phase: "grab", wait: 3 };
    case "grab": {
      if (s.wait > 0) return { ...s, wait: s.wait - 1 };
      // ponytail: rigged in the player's favour, a lined-up drop always grabs
      const holding = s.capsules.find((c) => c.slot === s.slot) ?? null;
      return {
        ...s,
        phase: "up",
        holding,
        missed: !holding,
        capsules: s.capsules.filter((c) => c !== holding),
      };
    }
    case "up":
      if (s.drop > 0) return { ...s, drop: s.drop - 1 };
      return { ...s, phase: s.holding ? "carry" : "idle" };
    case "carry":
      return s.slot > 0 ? { ...s, slot: s.slot - 1 } : { ...s, phase: "release", wait: 3 };
    case "release":
      if (s.wait > 0) return { ...s, wait: s.wait - 1 };
      return {
        ...s,
        phase: "idle",
        holding: null,
        prizes: s.prizes + 1,
        last: s.holding?.game ?? s.last,
        // the last prize refills the cabinet
        capsules: s.capsules.length ? s.capsules : stock(s.games),
      };
  }
}

export function claw(s: Claw, action: ClawAction): Claw {
  if (action === "tick") return clawFrame(s);
  if (action === "settle") return settle(s, clawFrame, clawBusy);
  if (clawBusy(s)) return s;
  if (action === "left") return s.slot > 0 ? { ...s, slot: s.slot - 1 } : s;
  if (action === "right") return s.slot < SLOTS ? { ...s, slot: s.slot + 1 } : s;
  return { ...s, phase: "down", missed: false };
}

/* Conveyor: a batch of parcels rides the belt and drops into bins by colour. */

export const LANES = 5;
export const BELT = 300; // belt length
export const FALL = 3; // frames from the belt into a bin
export const binX = (lane: number) => 70 + 50 * lane; // a bin's middle
const BATCH = 8;
const SPEED = 10; // belt units a frame

export type Parcel = { id: number; x: number; lane: number; fall: number; rows: number };
export type Conveyor = {
  queue: number[]; // lanes still in the hopper
  parcels: Parcel[];
  bins: number[];
  rows: number; // loaded since the last truncate
  batch: number; // rows in the current or latest batch
  batches: number;
  belt: number; // frames the belt has run, for its stripes
  next: number; // the next parcel's id
  gap: number; // frames until the hopper drops the next parcel
};
export type ConveyorAction = "run" | "truncate" | Frame;

export const newConveyor = (): Conveyor => ({
  queue: [],
  parcels: [],
  bins: Array(LANES).fill(0),
  rows: 0,
  batch: 0,
  batches: 0,
  belt: 0,
  next: 0,
  gap: 0,
});

export const conveyorBusy = (s: Conveyor) => s.queue.length > 0 || s.parcels.length > 0;

function conveyorFrame(s: Conveyor): Conveyor {
  if (!conveyorBusy(s)) return s;
  const parcels: Parcel[] = [];
  const bins = [...s.bins];
  let { rows, batch, queue, next, gap } = s;
  for (const p of s.parcels) {
    if (p.x < binX(p.lane)) parcels.push({ ...p, x: Math.min(p.x + SPEED, binX(p.lane)) });
    else if (p.fall < FALL) parcels.push({ ...p, fall: p.fall + 1 });
    else {
      bins[p.lane]++;
      rows += p.rows;
      batch += p.rows;
    }
  }
  if (queue.length && !gap) {
    // ponytail: made-up row counts, steady so the tests can count them
    parcels.push({ id: next, x: 18, lane: queue[0], fall: 0, rows: 120 + ((next * 97) % 400) });
    queue = queue.slice(1);
    next++;
    gap = 3;
  } else {
    gap = Math.max(0, gap - 1);
  }
  const done = !queue.length && !parcels.length;
  return { ...s, parcels, bins, rows, batch, queue, next, gap, belt: s.belt + 1, batches: s.batches + (done ? 1 : 0) };
}

export function conveyor(s: Conveyor, action: ConveyorAction): Conveyor {
  if (action === "tick") return conveyorFrame(s);
  if (action === "settle") return settle(s, conveyorFrame, conveyorBusy);
  if (conveyorBusy(s)) return s;
  if (action === "truncate") return { ...s, bins: Array(LANES).fill(0), rows: 0 };
  // a steady shuffle of lanes, different every batch
  const queue = Array.from({ length: BATCH }, (_, i) => (i * 3 + s.batches * 2) % LANES);
  return { ...s, queue, batch: 0, gap: 0 };
}
