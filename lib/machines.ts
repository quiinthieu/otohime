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
