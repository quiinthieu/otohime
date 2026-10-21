// What every structure in the series provides, and the few rules they share.
// A move is pure: reduce(state, action) gives the next state and the trace
// that explains it, one beat a picture and a sentence. The trace is the
// explanation: the narration, the numbered steps, the step count and the
// costs card all read it, so the words and the numbers cannot drift apart.
//
// A step is looking at one thing, moving one thing one place, writing a new
// thing into its place, or relinking or rubbing out one arrow or line. A beat
// that counts says so with `step: true`; a move's `steps` is the number of
// those beats. A refused move (full, empty, or a value the machine cannot
// take) returns the very same state object, `refused`, and exactly one beat.

export type Beat = {
  say: string; // one sentence
  hot?: string[]; // element ids lit on this beat
  step?: boolean; // this beat counts as a step
};

export type Move<S> = { state: S; trace: Beat[]; steps: number; refused?: string };

// `value` is the number or word a move takes, or the first station of a pair;
// `to` is the second station of a pair, or the drawer a number goes to.
export type Action = { move: string; value?: number | string; to?: string };

// "index" moves take a drawer number in `value`; a move with `at` takes a
// number in `value` and a drawer number in `to`; "pair" moves take two
// station letters, `value` and `to`.
export type Takes = "none" | "number" | "word" | "index" | "pair";
export type MoveSpec = { id: string; label: string; takes: Takes; at?: boolean };

export type Band = "one" | "few" | "all";
export type Cost = { steps: number; band: Band; why: string };
export type Costs = { find: Cost; add: Cost; remove: Cost };

export type Structure<S> = {
  slug: string; // [a-z-]+, the URL
  cap: number; // the most the machine holds
  empty(cap?: number): S;
  moves: readonly MoveSpec[];
  defaultMove: string; // what Enter runs
  reduce(s: S, a: Action): Move<S>;
  describe(s: S): string; // the drawing's aria-label: names every label
  labels(s: S): string[]; // what the drawing writes, in reading order
  example: readonly Action[]; // the worked example Reset replays
  costs(): Costs; // measured by running reduce on 8 things
};

// Costs run on a copy with room for this many, so 8 things always fit.
export const COST_ROOM = 16;
export const COST_SIZE = 8;

// The numbers the machines take: whole numbers a drawing can letter.
export const MAX_VALUE = 99;

export function band(n: number): Band {
  if (Number.isInteger(n)) {
    if (n >= 1 && n <= 3) return "one";
    if (n >= 4 && n <= 6) return "few";
    if (n >= 7 && n <= 10) return "all";
  }
  throw new RangeError(`${n} steps falls in no band`);
}

export const countSteps = (trace: readonly Beat[]) => trace.filter((b) => b.step).length;

export const stepsWord = (n: number) => (n === 1 ? "1 step" : `${n} steps`);

/** A move that happened: `steps` is counted from the trace, never typed. */
export function done<S>(state: S, trace: Beat[]): Move<S> {
  return { state, trace, steps: countSteps(trace) };
}

/** A move the machine will not make: the same state, one beat, no steps. */
export function refuse<S>(state: S, say: string, hot?: string[]): Move<S> {
  return { state, trace: [hot ? { say, hot } : { say }], steps: 0, refused: say };
}

export function replay<S>(structure: Structure<S>, actions: readonly Action[], start: S = structure.empty()): { state: S; last: Move<S> } {
  let last: Move<S> = { state: start, trace: [], steps: 0 };
  for (const a of actions) last = structure.reduce(last.state, a);
  return { state: last.state, last };
}

/** Runs `setup` from `start`, then measures one move; a refusal is a bug in the setup. */
export function measure<S>(structure: Structure<S>, start: S, setup: readonly Action[], action: Action, why: string): Cost {
  const { state } = replay(structure, setup, start);
  const move = structure.reduce(state, action);
  if (move.refused) throw new Error(`${structure.slug}: ${action.move} was refused: ${move.refused}`);
  return { steps: move.steps, band: band(move.steps), why };
}

/** A whole number from 0 to MAX_VALUE, from a number or a string of digits; else null. */
export function whole(v: number | string | undefined): number | null {
  const n = typeof v === "string" && /^\s*\d+\s*$/.test(v) ? Number(v) : v;
  return typeof n === "number" && Number.isInteger(n) && n >= 0 && n <= MAX_VALUE ? n : null;
}

export const WHOLE_PLEASE = `Use a whole number from 0 to ${MAX_VALUE}.`;

/** "1, 7 and 2" */
export function listed(items: readonly (string | number)[]): string {
  const s = items.map(String);
  if (s.length <= 1) return s.join("");
  return `${s.slice(0, -1).join(", ")} and ${s.at(-1)}`;
}
