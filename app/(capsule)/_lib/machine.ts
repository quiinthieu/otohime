// Pure state for the capsule machine: (state, action) => state, so a reducer
// drives it and a test can play it without a browser. Copied in the style of
// lib/machines.ts, not imported: Capsule owes nothing to the site.
// "tick" advances one frame; "settle" runs frames until the phase ends, which
// is what reduced motion and the tests use. The draw itself is actions.turn,
// and the turn action carries what it decided: how long the crank turns,
// which capsule falls, and the tier, which only the open stages after "edge"
// may show (reveal.ts is the one reader).
import type { Tier } from "./cards.ts";

export const TURN_MIN = 16; // 1.3 s at 12 fps
export const TURN_MAX = 28; // 2.3 s
export const DROP_FRAMES = 6; // the last frames of the turn: the capsule falls
export const DOME_SIZE = 8; // capsules waiting in the dome

export type Phase = "idle" | "loaded" | "turning" | "ready" | "opening" | "revealed";
export type OpenStage = "shake" | "part" | "rise" | "edge" | "hold" | "flip";
export type Machine = { phase: Phase; frame: number; length: number; drop: number; tier: Tier | null };
export type MachineAction =
  | "insert"
  | "open"
  | "tick"
  | "settle"
  | { type: "turn"; frames: number; drop: number; tier: Tier };

// Opening, in order: the shell rocks, its halves part, a card back rises, its
// tier edge draws on, a legend holds a moment longer, and the card turns over.
export const OPEN_STAGES: readonly (readonly [OpenStage, number])[] = [
  ["shake", 6],
  ["part", 4],
  ["rise", 6],
  ["edge", 6],
  ["hold", 6],
  ["flip", 6],
];

const stagesFor = (tier: Tier) => OPEN_STAGES.filter(([stage]) => stage !== "hold" || tier === "legend");

export const openFrames = (tier: Tier): number => stagesFor(tier).reduce((sum, [, n]) => sum + n, 0);

// The stage an opening frame is in, and the frame within that stage.
export function openStageAt(frame: number, tier: Tier): { stage: OpenStage; k: number; n: number } {
  let start = 0;
  const stages = stagesFor(tier);
  for (const [stage, n] of stages) {
    if (frame < start + n) return { stage, k: Math.max(0, frame - start), n };
    start += n;
  }
  const [stage, n] = stages[stages.length - 1];
  return { stage, k: n - 1, n };
}

export const openStage = (frame: number, tier: Tier): OpenStage => openStageAt(frame, tier).stage;

export const newMachine = (): Machine => ({ phase: "idle", frame: 0, length: 0, drop: 0, tier: null });

export const machineBusy = (s: Machine) => s.phase === "turning" || s.phase === "opening";

function settle<S>(state: S, frame: (s: S) => S, busy: (s: S) => boolean): S {
  // ponytail: a frame cap rather than proving the machine halts
  for (let i = 0; i < 500 && busy(state); i++) state = frame(state);
  return state;
}

function machineFrame(s: Machine): Machine {
  if (s.phase === "turning") {
    return s.frame + 1 < s.length ? { ...s, frame: s.frame + 1 } : { ...s, phase: "ready", frame: 0 };
  }
  if (s.phase === "opening") {
    return s.frame + 1 < openFrames(s.tier ?? "common") ? { ...s, frame: s.frame + 1 } : { ...s, phase: "revealed", frame: 0 };
  }
  return s;
}

export function step(s: Machine, action: MachineAction): Machine {
  if (action === "tick") return machineFrame(s);
  if (action === "settle") return settle(s, machineFrame, machineBusy);
  // a press that does not fit the phase does nothing
  if (action === "insert") return s.phase === "idle" || s.phase === "revealed" ? { ...newMachine(), phase: "loaded" } : s;
  if (action === "open") return s.phase === "ready" ? { ...s, phase: "opening", frame: 0 } : s;
  if (s.phase !== "loaded") return s;
  const { frames, drop, tier } = action;
  return { phase: "turning", frame: 0, length: frames, drop, tier };
}
