// What a visitor can see of a round, as a pure function of the machine: the
// one thing the components read. The rule it keeps is that the tier comes
// last: no frame before the "edge" stage has an edge or a face, so nothing on
// the page can show the tier early (reveal.test.ts plays every frame).
// albumView keeps the album honest the same way: Turn has already saved the
// card, but the album and tally only count it once it is revealed.
import type { CardId, Tier } from "./cards.ts";
import type { Ledger } from "./ledger.ts";
import { DROP_FRAMES, type Machine, type OpenStage, openStageAt } from "./machine.ts";

export type Stage = "idle" | "loaded" | "turning" | "dropping" | "ready" | OpenStage | "revealed";
export type RevealView = {
  stage: Stage;
  shell: "none" | "dropping" | "closed" | "shake" | "open";
  card: "none" | "back" | "face";
  edge: Tier | null; // null before the edge stage, always
  flip: number; // 0..1 through the flip stage, 1 once revealed
  progress: number; // 0..1 through the current stage (1 at rest)
};

const rest = (stage: Stage, shell: RevealView["shell"]): RevealView => ({
  stage,
  shell,
  card: "none",
  edge: null,
  flip: 0,
  progress: 1,
});

export function revealView(m: Machine): RevealView {
  switch (m.phase) {
    case "idle":
    case "loaded":
      return rest(m.phase, "none");
    case "turning": {
      const start = m.length - DROP_FRAMES;
      if (m.frame < start) return { ...rest("turning", "none"), progress: (m.frame + 1) / start };
      return { ...rest("dropping", "dropping"), progress: (m.frame - start + 1) / DROP_FRAMES };
    }
    case "ready":
      return rest("ready", "closed");
    case "revealed":
      return { stage: "revealed", shell: "open", card: "face", edge: m.tier, flip: 1, progress: 1 };
    case "opening": {
      const tier = m.tier ?? "common";
      const { stage, k, n } = openStageAt(m.frame, tier);
      const progress = (k + 1) / n;
      const shown = stage === "edge" || stage === "hold" || stage === "flip";
      const flip = stage === "flip" ? progress : 0;
      return {
        stage,
        shell: stage === "shake" ? "shake" : "open",
        // the face only from the second half of the turn over, when the back is edge-on
        card: stage === "shake" || stage === "part" ? "none" : flip > 0.5 ? "face" : "back",
        edge: shown ? tier : null,
        flip,
        progress,
      };
    }
  }
}

// The album as it should look while a card is pending: one copy and one draw
// fewer. Nothing pending (or nothing of it left to hide) is the ledger itself.
export function albumView(ledger: Ledger, pending: CardId | null): Ledger {
  const copies = pending ? (ledger.owned[pending] ?? 0) : 0;
  if (!pending || copies < 1) return ledger;
  const owned = { ...ledger.owned };
  if (copies > 1) owned[pending] = copies - 1;
  else delete owned[pending];
  return { ...ledger, owned, draws: Math.max(0, ledger.draws - 1) };
}

// The card just revealed is its first copy: "New to your album."
export const isNewCard = (ledger: Ledger, id: CardId): boolean => ledger.owned[id] === 1;
