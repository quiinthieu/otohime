import type { FortuneTarget } from "./fortune-targets.ts";

export const FORTUNE_COLOURS = [
  { id: "coral", count: 5 },
  { id: "blue", count: 4 },
  { id: "mint", count: 4 },
  { id: "yellow", count: 6 },
] as const;
export type FortuneColour = (typeof FORTUNE_COLOURS)[number]["id"];
export type FortunePhase = "choose-colour" | "count-colour" | "choose-first-number" | "count-number" | "choose-final-number" | "ready-reveal" | "revealed";
export type FortuneState = {
  phase: FortunePhase;
  seed: string;
  pool: readonly FortuneTarget[];
  axis: 0 | 1;
  colour: FortuneColour | null;
  firstNumber: number | null;
  finalNumber: number | null;
  count: number;
  remaining: number;
  target: FortuneTarget | null;
};
export type FortuneAction =
  | { type: "choose-colour"; colour: FortuneColour }
  | { type: "choose-first-number"; number: number }
  | { type: "choose-final-number"; number: number }
  | { type: "tick" }
  | { type: "finish-counting" }
  | { type: "pinch" }
  | { type: "reveal" }
  | { type: "reset"; seed: string | number; targets: readonly FortuneTarget[] };

export const EMPTY_FORTUNE_TARGET: FortuneTarget = { id: "fortune-fallback", label: "Projects", href: "/projects", kind: "project" };

function safeTarget(target: FortuneTarget): boolean {
  return typeof target.id === "string" && target.id.length > 0 &&
    typeof target.label === "string" && target.label.trim().length > 0 &&
    typeof target.href === "string" && /^\/(?!\/)[A-Za-z0-9/_-]*(?:#[A-Za-z0-9_-]+)?$/.test(target.href);
}

function hash(text: string): number {
  let value = 2166136261;
  for (const char of text) value = Math.imul(value ^ char.charCodeAt(0), 16777619);
  return value >>> 0;
}

function shuffled(targets: readonly FortuneTarget[], seed: string): FortuneTarget[] {
  const result = [...targets];
  let value = hash(seed);
  for (let i = result.length - 1; i > 0; i--) {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
    const j = value % (i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function createFortuneState(seed: string | number, targets: readonly FortuneTarget[]): FortuneState {
  const key = String(seed);
  return { phase: "choose-colour", seed: key, pool: shuffled(targets.filter(safeTarget), key), axis: 0, colour: null, firstNumber: null, finalNumber: null, count: 0, remaining: 0, target: null };
}

export function visibleNumbers(state: FortuneState): readonly number[] {
  return state.axis === 0 ? [1, 3, 5, 7] : [2, 4, 6, 8];
}

function tick(state: FortuneState): FortuneState {
  if (state.phase !== "count-colour" && state.phase !== "count-number") return state;
  const remaining = state.remaining - 1;
  const axis = (1 - state.axis) as 0 | 1;
  return { ...state, remaining, count: state.count + 1, axis, phase: remaining === 0 ? (state.phase === "count-colour" ? "choose-first-number" : "choose-final-number") : state.phase };
}

export function fortuneReducer(state: FortuneState, action: FortuneAction): FortuneState {
  switch (action.type) {
    case "reset": return createFortuneState(action.seed, action.targets);
    case "pinch": return state.phase === "count-colour" || state.phase === "count-number" || state.phase === "revealed" ? state : { ...state, axis: (1 - state.axis) as 0 | 1 };
    case "choose-colour": {
      const colour = FORTUNE_COLOURS.find((candidate) => candidate.id === action.colour);
      return state.phase === "choose-colour" && colour ? { ...state, phase: "count-colour", colour: colour.id, count: 0, remaining: colour.count } : state;
    }
    case "tick": return tick(state);
    case "finish-counting": {
      if (state.phase !== "count-colour" && state.phase !== "count-number") return state;
      let next = state;
      while (next.remaining > 0) next = tick(next);
      return next;
    }
    case "choose-first-number":
      return state.phase === "choose-first-number" && visibleNumbers(state).includes(action.number)
        ? { ...state, phase: "count-number", firstNumber: action.number, count: 0, remaining: action.number } : state;
    case "choose-final-number":
      return state.phase === "choose-final-number" && visibleNumbers(state).includes(action.number)
        ? { ...state, phase: "ready-reveal", finalNumber: action.number } : state;
    case "reveal": {
      if (state.phase !== "ready-reveal") return state;
      const index = hash(`${state.seed}:${state.colour}:${state.firstNumber}:${state.finalNumber}`) % (state.pool.length || 1);
      return { ...state, phase: "revealed", target: state.pool[index] ?? EMPTY_FORTUNE_TARGET };
    }
  }
}
