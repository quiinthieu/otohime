// Pipeline snake, the pocket console's game behind B: pure state, (state, action) => state, so a test can
// play a whole game without a browser. A packet train runs on a COLS x ROWS grid, eats records (food) and
// grows; it loses on a wall or on itself, and wins when it fills the board. Food lands from a seeded
// generator carried in the state, so a seed fixes every record of a game and its restarts.
//
// Actions: a direction turns the head (never straight back); "start" begins a ready game (or restarts an
// ended one); "restart" deals a new game from the carried seed; "tick" is one 12 fps frame, and the train
// moves one cell every speed(score) frames; a "step" turns and moves one cell at once, which is how reduced
// motion plays, turn by turn with no clock. Cells are numbered y * COLS + x.
//
// The console's own Konami code (codeStep) is matched on console input only, and unlocks debug mode: walls
// wrap. It is the pocket's achievement, kept apart from the footer's.

export const COLS = 16;
export const ROWS = 14;
export const CELLS = COLS * ROWS;

export type Dir = "up" | "down" | "left" | "right";
export type Status = "ready" | "playing" | "over" | "won";
// What the last action did, for a beep: set by the move that did it, cleared by any other change.
export type SnakeCue = "move" | "eat" | "burst" | null;

export type Snake = {
  body: readonly number[]; // head first
  dir: Dir; // the way the head last moved
  turn: Dir; // the way it moves next
  food: number | null;
  score: number;
  best: number; // the best score, this game or any before (restored from storage by the console)
  status: Status;
  seed: number; // the generator's next state
  wait: number; // frames until the next move
  wrap: boolean; // debug mode: walls wrap
  steps: number;
  cue: SnakeCue;
};

export type SnakeAction =
  | "start"
  | "restart"
  | "tick"
  | { type: "dir"; dir: Dir }
  | { type: "step"; dir: Dir }
  | { type: "wrap"; on: boolean }
  | { type: "new"; seed: number }
  | { type: "best"; best: number };

// Frames a move takes, by score: faster as it grows, never under FLOOR (6 cells a second at 12 fps).
export const SPEEDS: readonly { from: number; frames: number }[] = [
  { from: 0, frames: 5 },
  { from: 5, frames: 4 },
  { from: 12, frames: 3 },
  { from: 24, frames: 2 },
];
export const FLOOR = 2;
export const speed = (score: number) =>
  Math.max(FLOOR, SPEEDS.reduce((frames, s) => (score >= s.from ? s.frames : frames), SPEEDS[0].frames));

export const cell = (x: number, y: number) => y * COLS + x;
export const xy = (c: number): [x: number, y: number] => [c % COLS, Math.floor(c / COLS)];

const DELTA: Record<Dir, [number, number]> = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
export const OPPOSITE: Record<Dir, Dir> = { up: "down", down: "up", left: "right", right: "left" };

// mulberry32: a number in [0, 1) and the generator's next state.
export function rand(seed: number): [value: number, next: number] {
  const next = (seed + 0x6d2b79f5) >>> 0;
  let t = next;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return [((t ^ (t >>> 14)) >>> 0) / 4294967296, next];
}

// A record on a free cell, picked by the seed, or null when the train fills the board.
export function placeFood(body: readonly number[], seed: number): { food: number | null; seed: number } {
  const taken = new Set(body);
  const free = CELLS - taken.size;
  if (free <= 0) return { food: null, seed };
  const [r, next] = rand(seed);
  let k = Math.floor(r * free);
  for (let c = 0; c < CELLS; c++) {
    if (taken.has(c)) continue;
    if (k-- === 0) return { food: c, seed: next };
  }
  return { food: null, seed };
}

// Three cells in the middle, heading right, the first record already down.
export const START: readonly number[] = [cell(7, 7), cell(6, 7), cell(5, 7)];

export function newSnake(seed = 0, wrap = false, best = 0): Snake {
  const placed = placeFood(START, seed >>> 0);
  return {
    body: START,
    dir: "right",
    turn: "right",
    food: placed.food,
    score: 0,
    best,
    status: "ready",
    seed: placed.seed,
    wait: speed(0),
    wrap,
    steps: 0,
    cue: null,
  };
}

const ended = (s: Snake) => s.status === "over" || s.status === "won";

// Turning straight back is refused: it is judged against the way the head last moved, so two quick turns
// inside one frame cannot fold the train onto its neck.
function turn(s: Snake, dir: Dir): Snake {
  if (ended(s) || (dir === OPPOSITE[s.dir] && s.body.length > 1)) return s;
  return dir === s.turn ? s : { ...s, turn: dir, cue: null };
}

// One cell on. The tail leaves its cell in the same move, so the head may take it, unless this move eats
// and the tail stays.
function advance(s: Snake): Snake {
  const [x, y] = xy(s.body[0]);
  const [dx, dy] = DELTA[s.turn];
  let nx = x + dx;
  let ny = y + dy;
  const lose: Snake = { ...s, dir: s.turn, status: "over", cue: "burst" };
  if (nx < 0 || nx >= COLS || ny < 0 || ny >= ROWS) {
    if (!s.wrap) return lose;
    nx = (nx + COLS) % COLS;
    ny = (ny + ROWS) % ROWS;
  }
  const next = cell(nx, ny);
  const eats = next === s.food;
  const stays = eats ? s.body : s.body.slice(0, -1);
  if (stays.includes(next)) return lose;
  const body = [next, ...stays];
  const moved = { ...s, body, dir: s.turn, steps: s.steps + 1 };
  if (!eats) return { ...moved, wait: speed(s.score), cue: "move" };
  const score = s.score + 1;
  const placed = placeFood(body, s.seed);
  return {
    ...moved,
    score,
    best: Math.max(s.best, score),
    food: placed.food,
    seed: placed.seed,
    status: placed.food === null ? "won" : s.status,
    wait: speed(score),
    cue: "eat",
  };
}

const begin = (s: Snake): Snake => ({ ...newSnake(s.seed, s.wrap, s.best), status: "playing" });

export function snake(s: Snake, action: SnakeAction): Snake {
  if (action === "tick") {
    if (s.status !== "playing") return s;
    return s.wait > 1 ? { ...s, wait: s.wait - 1, cue: null } : advance(s);
  }
  if (action === "start") {
    if (s.status === "ready") return { ...s, status: "playing", wait: speed(s.score), cue: null };
    return ended(s) ? begin(s) : s;
  }
  if (action === "restart") return begin(s);
  switch (action.type) {
    case "new":
      return newSnake(action.seed, s.wrap, s.best);
    case "best":
      return action.best > s.best ? { ...s, best: action.best, cue: null } : s;
    case "wrap":
      return action.on === s.wrap ? s : { ...s, wrap: action.on, cue: null };
    case "dir":
      return turn(s, action.dir);
    case "step": {
      const turned = turn(s, action.dir);
      // ended, or straight back: nothing moves
      if (turned.turn !== action.dir) return s;
      return advance({ ...turned, status: "playing" });
    }
  }
}

/* The console's Konami code, matched on its own buttons only. */

export type PocketKey = Dir | "a" | "b";
export const CODE: readonly PocketKey[] = ["up", "up", "down", "down", "left", "right", "left", "right", "b", "a"];

// How much of CODE the inputs so far end with, once `key` is added: the longest prefix of CODE that is a
// suffix of the input. CODE.length means the code is complete.
export function codeStep(progress: number, key: PocketKey): number {
  const sofar = [...CODE.slice(0, Math.max(0, Math.min(progress, CODE.length - 1))), key];
  for (let len = Math.min(sofar.length, CODE.length); len > 0; len--) {
    const tail = sofar.slice(sofar.length - len);
    if (tail.every((k, i) => k === CODE[i])) return len;
  }
  return 0;
}

// The two stored values, guarded: a best score is a whole number a game could reach, else 0; only "1"
// is an achievement.
export const HIGH_KEY = "pocket:high";
export const ACHIEVEMENT_KEY = "pocket:achievement";
export function parseHigh(stored: string | null | undefined): number {
  if (!stored || !/^\d{1,3}$/.test(stored)) return 0;
  const n = Number(stored);
  return n <= CELLS - START.length ? n : 0;
}
export const parseAchievement = (stored: string | null | undefined) => stored === "1";
