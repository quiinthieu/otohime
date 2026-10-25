import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ACHIEVEMENT_KEY,
  CELLS,
  cell,
  CODE,
  codeStep,
  COLS,
  FLOOR,
  HIGH_KEY,
  newSnake,
  parseAchievement,
  parseHigh,
  placeFood,
  ROWS,
  snake,
  speed,
  SPEEDS,
  START,
  type Dir,
  type PocketKey,
  type Snake,
  type SnakeAction,
} from "./snake.ts";

const play = (s: Snake, ...actions: SnakeAction[]) => actions.reduce(snake, s);
const step = (dir: Dir): SnakeAction => ({ type: "step", dir });
const dir = (d: Dir): SnakeAction => ({ type: "dir", dir: d });
const ticks = (n: number): SnakeAction[] => Array(n).fill("tick");
// A board with the food somewhere harmless, so a test can steer without eating.
const at = (s: Partial<Snake>): Snake => ({ ...newSnake(1), food: cell(0, 0), ...s });

test("the grid is 16 by 14 and a new game waits, three cells long, heading right", () => {
  assert.equal(COLS, 16);
  assert.equal(ROWS, 14);
  const s = newSnake(42);
  assert.equal(s.status, "ready");
  assert.deepEqual(s.body, START);
  assert.equal(s.dir, "right");
  assert.equal(s.score, 0);
  assert.equal(play(s, ...ticks(20)).steps, 0, "a ready game does not move on ticks");
});

test("a seed fixes the food: the same seed, the same records, and never on the train", () => {
  // the known first record for seed 42, pinned so a change to the generator shows
  assert.equal(newSnake(42).food, 135);
  assert.equal(newSnake(42).food, newSnake(42).food);
  assert.notEqual(newSnake(42).food, newSnake(43).food);
  for (let seed = 0; seed < 500; seed++) {
    const s = newSnake(seed);
    assert.ok(s.food !== null && !s.body.includes(s.food), `seed ${seed}`);
    assert.ok(s.food >= 0 && s.food < CELLS);
  }
  // a crowded board still lands food only on the free cells
  const body = Array.from({ length: CELLS - 2 }, (_, i) => i);
  for (let seed = 0; seed < 50; seed++) {
    const { food } = placeFood(body, seed);
    assert.ok(food === CELLS - 1 || food === CELLS - 2, String(food));
  }
  assert.equal(placeFood(Array.from({ length: CELLS }, (_, i) => i), 9).food, null);
});

test("start then ticks move one cell every speed(score) frames", () => {
  const s = play(at({}), "start");
  assert.equal(s.status, "playing");
  const one = play(s, ...ticks(speed(0) - 1));
  assert.equal(one.steps, 0);
  const moved = play(one, "tick");
  assert.equal(moved.steps, 1);
  assert.deepEqual(moved.body, [cell(8, 7), cell(7, 7), cell(6, 7)]);
  assert.equal(moved.cue, "move");
});

test("a step turns and moves one cell at once, with no clock: reduced motion's turn-based play", () => {
  const s = at({});
  const down = play(s, step("down"));
  assert.equal(down.status, "playing");
  assert.deepEqual(down.body, [cell(7, 8), cell(7, 7), cell(6, 7)]);
  const right = play(down, step("right"), step("right"));
  assert.deepEqual(right.body, [cell(9, 8), cell(8, 8), cell(7, 8)]);
  assert.equal(right.steps, 3);
});

test("straight back is refused, even as the second of two turns inside a frame", () => {
  const s = play(at({}), "start");
  assert.equal(play(s, dir("left")).turn, "right");
  assert.equal(play(s, step("left")), s, "a reverse step does nothing");
  // up then left before the next move: left is still straight back from the last move (right)
  const quick = play(s, dir("up"), dir("left"));
  assert.equal(quick.turn, "up");
  const after = play(quick, ...ticks(speed(0)));
  assert.equal(after.dir, "up");
  assert.equal(after.status, "playing");
});

test("a wall ends the game, and so does the train's own body", () => {
  const wall = play(at({ body: [cell(15, 3), cell(14, 3), cell(13, 3)] }), step("right"));
  assert.equal(wall.status, "over");
  assert.equal(wall.cue, "burst");
  const top = play(at({ body: [cell(4, 0), cell(4, 1), cell(4, 2)], dir: "up", turn: "up" }), step("up"));
  assert.equal(top.status, "over");
  // a five-cell train curled so its head turns into its own middle
  const curl = at({ body: [cell(5, 5), cell(6, 5), cell(6, 6), cell(5, 6), cell(4, 6)], dir: "left", turn: "left" });
  const bitten = play(curl, step("down"));
  assert.equal(bitten.status, "over");
  assert.equal(play(bitten, step("left")), bitten, "an ended game ignores steps");
  assert.equal(play(bitten, ...ticks(10)), bitten, "and ticks");
});

test("the head may take the cell the tail leaves, but not when it eats", () => {
  // a square of four: the head (5,5) moves down into (5,6), which the tail is leaving
  const ring = { body: [cell(5, 5), cell(6, 5), cell(6, 6), cell(5, 6)], dir: "left" as Dir, turn: "left" as Dir };
  const chase = play(at(ring), step("down"));
  assert.equal(chase.status, "playing");
  assert.deepEqual(chase.body, [cell(5, 6), cell(5, 5), cell(6, 5), cell(6, 6)]);
  // the same move onto food there: the tail stays, so it is a collision
  const full = play(at({ ...ring, food: cell(5, 6) }), step("down"));
  assert.equal(full.status, "over");
});

test("eating grows the train, scores, and lays the next record from the seed", () => {
  const s = at({ food: cell(8, 7) });
  const ate = play(s, step("right"));
  assert.equal(ate.score, 1);
  assert.equal(ate.body.length, 4);
  assert.equal(ate.cue, "eat");
  assert.deepEqual(ate.body, [cell(8, 7), ...START]);
  assert.ok(ate.food !== null && !ate.body.includes(ate.food));
  assert.equal(ate.food, placeFood(ate.body, s.seed).food);
  assert.notEqual(ate.seed, s.seed);
  // a cue is the move's own: a turn, a wrap or a restored best afterwards does not repeat it
  assert.equal(play(ate, dir("down")).cue, null);
  assert.equal(play(ate, { type: "wrap", on: true }).cue, null);
  assert.equal(play(ate, { type: "best", best: 50 }).cue, null);
  assert.equal(play({ ...ate, status: "playing", wait: 3 }, "tick").cue, null);
  // the next plain move keeps the new length
  assert.equal(play(ate, step("down")).body.length, 4);
});

test("a seeded trace plays to the first two records and scores both", () => {
  // walk to the food along x, then y: a fixed seed makes this the same game every time
  let s = play(newSnake(7), "start");
  const first = s.food!;
  for (let eaten = 0; eaten < 2; eaten++) {
    const target = s.food!;
    let guard = 0;
    while (s.food === target && s.status === "playing" && guard++ < 64) {
      const [hx, hy] = [s.body[0] % COLS, Math.floor(s.body[0] / COLS)];
      const [fx, fy] = [target % COLS, Math.floor(target / COLS)];
      const want: Dir = fx > hx ? "right" : fx < hx ? "left" : fy > hy ? "down" : "up";
      const next = play(s, step(want));
      s = next === s ? play(s, step(want === "left" || want === "right" ? "down" : "right")) : next;
    }
    assert.equal(s.status, "playing");
  }
  assert.equal(s.score, 2);
  assert.notEqual(s.food, first);
  assert.equal(s.body.length, 5);
});

test("the speed table is bounded and never under its floor", () => {
  assert.equal(speed(0), SPEEDS[0].frames);
  for (let score = 1; score < CELLS; score++) assert.ok(speed(score) <= speed(score - 1));
  assert.equal(speed(CELLS), FLOOR);
  assert.equal(speed(10_000), FLOOR);
  assert.ok(SPEEDS.every((s) => s.frames >= FLOOR));
});

test("filling the board wins: no food left, nothing moves after", () => {
  // a serpentine through every cell but the last one, the head at its end and the last cell the food
  const path: number[] = [];
  for (let y = 0; y < ROWS; y++) for (let i = 0; i < COLS; i++) path.push(cell(y % 2 ? COLS - 1 - i : i, y));
  const last = path.pop()!;
  const s = at({ body: [...path].reverse(), food: last, dir: "left", turn: "left", score: CELLS - 4, status: "playing" });
  const won = play(s, step("left"));
  assert.equal(won.status, "won");
  assert.equal(won.food, null);
  assert.equal(won.body.length, CELLS);
  assert.equal(play(won, ...ticks(10)), won);
  assert.equal(play(won, "start").status, "playing", "A after a win deals a new game");
  assert.equal(play(won, "start").body.length, 3);
});

test("A restarts an ended game from the carried seed, keeping debug mode", () => {
  const over = play(at({ body: [cell(15, 3), cell(14, 3), cell(13, 3)], wrap: false, seed: 99 }), step("right"));
  const again = play(over, "start");
  assert.equal(again.status, "playing");
  assert.equal(again.score, 0);
  assert.deepEqual(again.body, START);
  assert.equal(again.food, newSnake(99).food);
  assert.deepEqual(play(over, "restart"), again);
  const wrapped = play({ ...over, wrap: true }, "restart");
  assert.equal(wrapped.wrap, true);
  // a playing game ignores start
  assert.equal(play(again, "start"), again);
  assert.deepEqual(play(again, { type: "new", seed: 5 }), newSnake(5));
});

test("the best score rises with eating, survives restarts and takes a restored value only if higher", () => {
  const ate = play(at({ food: cell(8, 7) }), step("right"));
  assert.equal(ate.best, 1);
  const over = play(ate, step("up"), ...Array(10).fill(step("up")));
  assert.equal(over.status, "over");
  const again = play(over, "start");
  assert.equal(again.score, 0);
  assert.equal(again.best, 1);
  assert.equal(play(again, { type: "new", seed: 3 }).best, 1);
  assert.equal(play(again, { type: "best", best: 9 }).best, 9);
  assert.equal(play(again, { type: "best", best: 0 }), again);
  assert.equal(play(newSnake(1, false, 4), "restart").best, 4);
});

test("debug mode wraps every wall instead of ending the game", () => {
  const on = (s: Partial<Snake>) => play(at({ ...s }), { type: "wrap", on: true });
  assert.deepEqual(play(on({ body: [cell(15, 3), cell(14, 3), cell(13, 3)] }), step("right")).body[0], cell(0, 3));
  assert.deepEqual(play(on({ body: [cell(0, 3), cell(1, 3), cell(2, 3)], dir: "left", turn: "left" }), step("left")).body[0], cell(15, 3));
  assert.deepEqual(play(on({ body: [cell(4, 0), cell(4, 1), cell(4, 2)], dir: "up", turn: "up" }), step("up")).body[0], cell(4, 13));
  assert.deepEqual(play(on({ body: [cell(4, 13), cell(4, 12), cell(4, 11)], dir: "down", turn: "down" }), step("down")).body[0], cell(4, 0));
  // wrapping onto its own body still ends it
  const loop = on({ body: [cell(15, 3), cell(14, 3), cell(13, 3), cell(12, 3), cell(0, 3), cell(0, 4)], dir: "right", turn: "right" });
  assert.equal(play(loop, step("right")).status, "over");
});

test("the console code: the right ten inputs complete it, wrong ones do not, partial overlaps carry", () => {
  const run = (keys: readonly PocketKey[]) => keys.reduce(codeStep, 0);
  assert.equal(CODE.length, 10);
  assert.equal(run(CODE), CODE.length);
  assert.equal(run(["up", "up", "down", "down", "left", "right", "left", "right", "a", "b"]), 0);
  assert.notEqual(run(CODE.slice(0, 9)), CODE.length);
  assert.equal(run(["a", "b", ...CODE]), CODE.length, "noise before the code");
  assert.equal(run(["up", "up", "up", ...CODE.slice(2)]), CODE.length, "a third up still leaves two");
  assert.equal(run(["up", "up", "down", "up", "up", ...CODE.slice(2)]), CODE.length);
  assert.equal(run(["up", "up", "down", "down", "b"]), 0);
});

test("stored values are guarded: only whole reachable scores, only \"1\" for the achievement", () => {
  assert.equal(HIGH_KEY, "pocket:high");
  assert.equal(ACHIEVEMENT_KEY, "pocket:achievement");
  assert.equal(parseHigh("12"), 12);
  assert.equal(parseHigh("0"), 0);
  for (const bad of [null, undefined, "", "-3", "1.5", "NaN", "12abc", "999", "1e2", " 4"]) assert.equal(parseHigh(bad), 0, String(bad));
  assert.equal(parseAchievement("1"), true);
  for (const bad of [null, "0", "true", "11"]) assert.equal(parseAchievement(bad), false);
});

test("actions never change the state they are given", () => {
  const s = Object.freeze({ ...at({ food: cell(8, 7) }), body: Object.freeze([...START]) }) as Snake;
  const copy = JSON.stringify(s);
  for (const action of [step("right"), step("down"), "start", "restart", "tick", dir("up"), { type: "wrap", on: true }] as SnakeAction[]) {
    snake(s, action);
  }
  play(s, "start", ...ticks(30));
  assert.equal(JSON.stringify(s), copy);
});
