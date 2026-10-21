// Higher or lower: a secret number from 1 to 16, and each guess throws away
// half of what is left. Each row is what is left before a guess, the guess
// ringed; the last row, the spot, is the number found.
import { inkEllipse, inkRect, type InkPath } from "../ink.ts";
import { label, SMALL, SPOT, WIDTH, type Figure } from "../kit.ts";

const CELL = 26;
const LEFT = 32;
const ROW_TOP = 44;
const ROW_PITCH = 66;
const x = (v: number) => LEFT + (v - 1) * CELL;

// what is left, the guess, and what the guesser hears
const ROUNDS: { from: number; to: number; guess: number; say: string }[] = [
  { from: 1, to: 16, guess: 8, say: "1 to 16: is it 8? higher" },
  { from: 9, to: 16, guess: 12, say: "9 to 16: is it 12? higher" },
  { from: 13, to: 16, guess: 14, say: "13 to 16: is it 14? lower" },
];
const SECRET = 13;

export function binarySearchTreeLife(): Figure {
  const paths: InkPath[] = [];
  ROUNDS.forEach((r, k) => {
    const top = ROW_TOP + k * ROW_PITCH;
    for (let v = r.from; v <= r.to; v++) paths.push(...inkRect(x(v), top, CELL, 24, { seed: `guess:r${k}c${v}`, strokeWidth: 1.6 }));
    paths.push(...inkEllipse(x(r.guess) + CELL / 2, top + 12, 40, 38, { seed: `guess:ring${k}`, strokeWidth: 1.8 }));
  });
  const top = ROW_TOP + ROUNDS.length * ROW_PITCH;
  const spot = inkRect(x(SECRET), top, CELL, 24, { seed: "guess:found", stroke: SPOT, fill: SPOT, fillStyle: "hachure", hachureGap: 5 });
  return {
    viewBox: [WIDTH, 290],
    paths,
    spot,
    labels: [
      ...ROUNDS.map((r, k) => label(LEFT, ROW_TOP + k * ROW_PITCH - 12, r.say, { size: SMALL })),
      label(x(SECRET) + CELL / 2, top - 12, `it is ${SECRET}`, { anchor: "middle", size: SMALL, spot: true }),
    ],
  };
}
