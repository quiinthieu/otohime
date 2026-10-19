// Pure state for the capsule machine: (state, action) => state, so a reducer
// drives it and a test can play it without a browser. Copied in the style of
// lib/machines.ts, not imported: Capsule owes nothing to the site.
// "tick" advances one frame; "settle" runs frames until the phase ends, which
// is what reduced motion and the tests use. The draw itself is actions.turn.

export const TURN_FRAMES = 12; // the crank, on twos at 12 fps
export const OPEN_FRAMES = 8; // the halves part and the card rises

export type Phase = "idle" | "loaded" | "turning" | "ready" | "opening" | "revealed";
export type Machine = { phase: Phase; frame: number };
export type MachineAction = "insert" | "turn" | "open" | "tick" | "settle";

export const newMachine = (): Machine => ({ phase: "idle", frame: 0 });

export const machineBusy = (s: Machine) => s.phase === "turning" || s.phase === "opening";

function settle<S>(state: S, frame: (s: S) => S, busy: (s: S) => boolean): S {
  // ponytail: a frame cap rather than proving the machine halts
  for (let i = 0; i < 500 && busy(state); i++) state = frame(state);
  return state;
}

function machineFrame(s: Machine): Machine {
  if (s.phase === "turning") {
    return s.frame + 1 < TURN_FRAMES ? { ...s, frame: s.frame + 1 } : { phase: "ready", frame: 0 };
  }
  if (s.phase === "opening") {
    return s.frame + 1 < OPEN_FRAMES ? { ...s, frame: s.frame + 1 } : { phase: "revealed", frame: 0 };
  }
  return s;
}

export function step(s: Machine, action: MachineAction): Machine {
  if (action === "tick") return machineFrame(s);
  if (action === "settle") return settle(s, machineFrame, machineBusy);
  // a press that does not fit the phase does nothing
  if (action === "insert") return s.phase === "idle" || s.phase === "revealed" ? { phase: "loaded", frame: 0 } : s;
  if (action === "turn") return s.phase === "loaded" ? { phase: "turning", frame: 0 } : s;
  return s.phase === "ready" ? { phase: "opening", frame: 0 } : s;
}
