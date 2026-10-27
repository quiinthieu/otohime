// Deterministic Hanafuda Koi-Koi state machine and greedy CPU policy.
// Pure functions only: seeded mulberry32 PRNG, 3-round default match,
// hand-play and stock-draw matching, new-yaku detection, Koi-Koi vs Shobu
// decision handling, 7+ point doubling, opponent Koi-Koi reversal, and
// greedy CPU evaluation with zero LLM or external dependencies.

import {
  HANAFUDA_DECK,
  MONTHLY_FLOWERS_BY_NUMBER,
  requireCardById,
  resolveCard,
  SPECIAL_CARD_IDS,
  type CardId,
  type HanafudaCard,
  type MonthNumber,
} from "./deck.ts";
import {
  calculateRoundScore,
  detectYaku,
  diffNewYaku,
  type DetectedYaku,
  type RoundScoreBreakdown,
} from "./yaku.ts";

export type PlayerId = "human" | "cpu";
export type KoiKoiDecision = "koi-koi" | "shobu";

export type RoundPhase =
  | "play-hand"
  | "choose-hand-match"
  | "draw-stock"
  | "choose-draw-match"
  | "koi-koi-decision"
  | "round-over"
  | "match-over";

export type PendingMatchChoice = {
  stage: "hand" | "draw";
  player: PlayerId;
  card: HanafudaCard;
  matchingFieldCards: HanafudaCard[];
};

export type PendingKoiKoiDecision = {
  player: PlayerId;
  newYaku: DetectedYaku[];
  allYaku: DetectedYaku[];
  scoreBreakdown: RoundScoreBreakdown;
  promptText: string;
};

export type TurnSummary = {
  player: PlayerId;
  handCard: HanafudaCard;
  handCaptured: HanafudaCard[];
  drawnCard: HanafudaCard | null;
  drawCaptured: HanafudaCard[];
  newYaku: DetectedYaku[];
};

export type DecisionSummary = {
  player: PlayerId;
  decision: KoiKoiDecision;
  yaku: DetectedYaku[];
  scoreBreakdown: RoundScoreBreakdown;
};

export type RoundEndReason = "shobu" | "exhausted" | "four-of-a-kind" | "four-pairs";

export type RoundResult = {
  round: number;
  month: MonthNumber;
  flower: string;
  winner: PlayerId | null;
  reason: RoundEndReason;
  yaku: DetectedYaku[];
  basePoints: number;
  sevenPlusDoubled: boolean;
  opponentKoiKoiDoubled: boolean;
  multiplier: 1 | 2 | 4;
  pointsAwarded: number;
  koiKoiCalls: Record<PlayerId, number>;
};

export type HanafudaState = {
  seed: number;
  roundSeed: number;
  redealCount: number;
  round: number;
  totalRounds: number;
  roundMonth: MonthNumber;
  dealer: PlayerId;
  activePlayer: PlayerId;
  phase: RoundPhase;
  hands: Record<PlayerId, HanafudaCard[]>;
  field: HanafudaCard[];
  stock: HanafudaCard[];
  captured: Record<PlayerId, HanafudaCard[]>;
  achievedYaku: Record<PlayerId, DetectedYaku[]>;
  koiKoiCalled: Record<PlayerId, boolean>;
  koiKoiCalls: Record<PlayerId, number>;
  scores: Record<PlayerId, number>;
  pendingMatchChoice: PendingMatchChoice | null;
  pendingDecision: PendingKoiKoiDecision | null;
  lastTurn: TurnSummary | null;
  lastDecision: DecisionSummary | null;
  roundHistory: RoundResult[];
  matchWinner: PlayerId | "tie" | null;
  turnCount: number;
  announcement: string;
};

export type CreateMatchOptions = {
  seed?: number;
  totalRounds?: number;
  dealer?: PlayerId;
  scores?: Partial<Record<PlayerId, number>>;
};

export type PlayHandOptions = {
  targetFieldCardId?: CardId | string | null;
  drawTargetFieldCardId?: CardId | string | null;
  autoDraw?: boolean;
};

export type CustomRoundInput = {
  seed?: number;
  round?: number;
  totalRounds?: number;
  dealer?: PlayerId;
  activePlayer?: PlayerId;
  phase?: RoundPhase;
  hands?: Partial<Record<PlayerId, readonly (HanafudaCard | CardId | string)[]>>;
  field?: readonly (HanafudaCard | CardId | string)[];
  stock?: readonly (HanafudaCard | CardId | string)[];
  captured?: Partial<Record<PlayerId, readonly (HanafudaCard | CardId | string)[]>>;
  koiKoiCalled?: Partial<Record<PlayerId, boolean>>;
  koiKoiCalls?: Partial<Record<PlayerId, number>>;
  scores?: Partial<Record<PlayerId, number>>;
  roundHistory?: readonly RoundResult[];
};

export type HanafudaAction =
  | {
      type: "PLAY_HAND_CARD";
      cardId: CardId | string;
      targetFieldCardId?: CardId | string | null;
      drawTargetFieldCardId?: CardId | string | null;
      autoDraw?: boolean;
    }
  | {
      type: "DRAW_STOCK";
      targetFieldCardId?: CardId | string | null;
    }
  | {
      type: "SELECT_FIELD_MATCH";
      targetFieldCardId: CardId | string;
      autoDraw?: boolean;
    }
  | {
      type: "DECIDE_KOI_KOI";
      decision: KoiKoiDecision;
    }
  | {
      type: "STEP_CPU";
    }
  | {
      type: "RUN_CPU_TURN";
    }
  | {
      type: "NEXT_ROUND";
    }
  | {
      type: "NEW_MATCH";
      options?: CreateMatchOptions;
    };

export const DEFAULT_ROUNDS = 3;
export const DEFAULT_SEED = 53;
export const HANAMI_ZAKE_SEED = 53;
export const TSUKIMI_ZAKE_SEED = 151;
export const HAND_SIZE = 8;
export const FIELD_SIZE = 8;
export const STOCK_SIZE = 24;
const MAX_REDEAL_ATTEMPTS = 64;

export function otherPlayer(player: PlayerId): PlayerId {
  return player === "human" ? "cpu" : "human";
}

// Deterministic 32-bit mulberry32 PRNG returning values in [0, 1).
export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function deriveRoundSeed(matchSeed: number, round: number, redealAttempt = 0): number {
  const base = (matchSeed ^ Math.imul(round, 0x85ebca6b) ^ Math.imul(redealAttempt, 0xc2b2ae35)) >>> 0;
  return base === 0 ? 1 : base;
}

export function shuffleDeck(
  seed: number,
  deck: readonly HanafudaCard[] = HANAFUDA_DECK,
): HanafudaCard[] {
  const rng = mulberry32(seed);
  const out = [...deck];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = out[i];
    out[i] = out[j];
    out[j] = tmp;
  }
  return out;
}

export function monthCounts(cards: readonly (HanafudaCard | CardId | string)[]): Map<MonthNumber, number> {
  const counts = new Map<MonthNumber, number>();
  for (const item of cards) {
    const c = resolveCard(item);
    if (!c) continue;
    counts.set(c.month, (counts.get(c.month) ?? 0) + 1);
  }
  return counts;
}

// True when a set of 8 cards contains all 4 cards of the same month (Teshi / field lock).
export function hasFourOfSameMonth(cards: readonly (HanafudaCard | CardId | string)[]): boolean {
  for (const count of monthCounts(cards).values()) {
    if (count >= 4) return true;
  }
  return false;
}

// True when an 8-card hand or field consists of 4 distinct months with exactly 2 cards each (Kuttsuki).
export function hasFourPairs(cards: readonly (HanafudaCard | CardId | string)[]): boolean {
  const counts = monthCounts(cards);
  if (counts.size !== 4) return false;
  for (const count of counts.values()) {
    if (count !== 2) return false;
  }
  return true;
}

export function isInvalidInitialDeal(
  humanHand: readonly HanafudaCard[],
  cpuHand: readonly HanafudaCard[],
  field: readonly HanafudaCard[],
): boolean {
  return (
    hasFourOfSameMonth(field) ||
    hasFourPairs(field) ||
    hasFourOfSameMonth(humanHand) ||
    hasFourPairs(humanHand) ||
    hasFourOfSameMonth(cpuHand) ||
    hasFourPairs(cpuHand)
  );
}

export function dealRoundCards(seed: number, round = 1): {
  roundSeed: number;
  redealCount: number;
  humanHand: HanafudaCard[];
  cpuHand: HanafudaCard[];
  field: HanafudaCard[];
  stock: HanafudaCard[];
} {
  for (let attempt = 0; attempt < MAX_REDEAL_ATTEMPTS; attempt++) {
    const roundSeed = attempt === 0 && round === 1 ? seed >>> 0 : deriveRoundSeed(seed, round, attempt);
    const shuffled = shuffleDeck(roundSeed);
    // Traditional 2-by-2 or 4-by-4 deal sliced deterministically: 8 human, 8 cpu, 8 field, 24 stock
    const humanHand = shuffled.slice(0, HAND_SIZE);
    const cpuHand = shuffled.slice(HAND_SIZE, HAND_SIZE * 2);
    const field = shuffled.slice(HAND_SIZE * 2, HAND_SIZE * 2 + FIELD_SIZE);
    const stock = shuffled.slice(HAND_SIZE * 2 + FIELD_SIZE);
    if (!isInvalidInitialDeal(humanHand, cpuHand, field)) {
      return {
        roundSeed,
        redealCount: attempt,
        humanHand,
        cpuHand,
        field,
        stock,
      };
    }
  }
  const fallbackSeed = deriveRoundSeed(seed, round, MAX_REDEAL_ATTEMPTS);
  const shuffled = shuffleDeck(fallbackSeed);
  return {
    roundSeed: fallbackSeed,
    redealCount: MAX_REDEAL_ATTEMPTS,
    humanHand: shuffled.slice(0, HAND_SIZE),
    cpuHand: shuffled.slice(HAND_SIZE, HAND_SIZE * 2),
    field: shuffled.slice(HAND_SIZE * 2, HAND_SIZE * 2 + FIELD_SIZE),
    stock: shuffled.slice(HAND_SIZE * 2 + FIELD_SIZE),
  };
}

export function roundMonthFor(round: number): MonthNumber {
  const normalized = (((Math.max(1, Math.trunc(round)) - 1) % 12) + 1) as MonthNumber;
  return normalized;
}

export function createMatch(options: CreateMatchOptions = {}): HanafudaState {
  const seed = Number.isFinite(options.seed) ? (options.seed! >>> 0) : DEFAULT_SEED;
  const totalRounds =
    typeof options.totalRounds === "number" && Number.isInteger(options.totalRounds) && options.totalRounds >= 1
      ? Math.min(12, options.totalRounds)
      : DEFAULT_ROUNDS;
  const dealer: PlayerId = options.dealer === "cpu" ? "cpu" : "human";
  const deal = dealRoundCards(seed, 1);
  const roundMonth = roundMonthFor(1);
  const flower = MONTHLY_FLOWERS_BY_NUMBER[roundMonth];

  return {
    seed,
    roundSeed: deal.roundSeed,
    redealCount: deal.redealCount,
    round: 1,
    totalRounds,
    roundMonth,
    dealer,
    activePlayer: dealer,
    phase: "play-hand",
    hands: {
      human: deal.humanHand,
      cpu: deal.cpuHand,
    },
    field: deal.field,
    stock: deal.stock,
    captured: {
      human: [],
      cpu: [],
    },
    achievedYaku: {
      human: [],
      cpu: [],
    },
    koiKoiCalled: {
      human: false,
      cpu: false,
    },
    koiKoiCalls: {
      human: 0,
      cpu: 0,
    },
    scores: {
      human: options.scores?.human ?? 0,
      cpu: options.scores?.cpu ?? 0,
    },
    pendingMatchChoice: null,
    pendingDecision: null,
    lastTurn: null,
    lastDecision: null,
    roundHistory: [],
    matchWinner: null,
    turnCount: 0,
    announcement: `Round 1 (${flower}): ${dealer === "human" ? "Your" : "CPU's"} turn.`,
  };
}

function toCardList(items: readonly (HanafudaCard | CardId | string)[] | undefined): HanafudaCard[] {
  if (!items) return [];
  return items.map((item) => {
    const card = resolveCard(item);
    if (!card) {
      throw new Error(`Invalid Hanafuda card reference: ${String(item)}`);
    }
    return card;
  });
}

export function createCustomRoundState(input: CustomRoundInput = {}): HanafudaState {
  const seed = (input.seed ?? DEFAULT_SEED) >>> 0;
  const round = input.round ?? 1;
  const totalRounds = input.totalRounds ?? DEFAULT_ROUNDS;
  const dealer = input.dealer ?? "human";
  const activePlayer = input.activePlayer ?? dealer;
  const phase = input.phase ?? "play-hand";
  const roundMonth = roundMonthFor(round);
  const humanCaptured = toCardList(input.captured?.human);
  const cpuCaptured = toCardList(input.captured?.cpu);

  return {
    seed,
    roundSeed: seed,
    redealCount: 0,
    round,
    totalRounds,
    roundMonth,
    dealer,
    activePlayer,
    phase,
    hands: {
      human: toCardList(input.hands?.human),
      cpu: toCardList(input.hands?.cpu),
    },
    field: toCardList(input.field),
    stock: toCardList(input.stock),
    captured: {
      human: humanCaptured,
      cpu: cpuCaptured,
    },
    achievedYaku: {
      human: detectYaku(humanCaptured),
      cpu: detectYaku(cpuCaptured),
    },
    koiKoiCalled: {
      human: input.koiKoiCalled?.human ?? false,
      cpu: input.koiKoiCalled?.cpu ?? false,
    },
    koiKoiCalls: {
      human: input.koiKoiCalls?.human ?? (input.koiKoiCalled?.human ? 1 : 0),
      cpu: input.koiKoiCalls?.cpu ?? (input.koiKoiCalled?.cpu ? 1 : 0),
    },
    scores: {
      human: input.scores?.human ?? 0,
      cpu: input.scores?.cpu ?? 0,
    },
    pendingMatchChoice: null,
    pendingDecision: null,
    lastTurn: null,
    lastDecision: null,
    roundHistory: input.roundHistory ? [...input.roundHistory] : [],
    matchWinner: null,
    turnCount: 0,
    announcement: `Round ${round} (${MONTHLY_FLOWERS_BY_NUMBER[roundMonth]}): ${activePlayer === "human" ? "Your" : "CPU's"} turn.`,
  };
}

export function getMatchingFieldCards(
  state: Pick<HanafudaState, "field">,
  cardOrId: HanafudaCard | CardId | string,
): HanafudaCard[] {
  const card = resolveCard(cardOrId);
  if (!card) return [];
  return state.field.filter((f) => f.month === card.month);
}

export function canCardMatchField(
  cardOrId: HanafudaCard | CardId | string,
  fieldCardOrId: HanafudaCard | CardId | string,
): boolean {
  const a = resolveCard(cardOrId);
  const b = resolveCard(fieldCardOrId);
  return a !== null && b !== null && a.month === b.month;
}

export function getPlayableHandMatches(
  state: Pick<HanafudaState, "hands" | "field" | "activePlayer">,
  player: PlayerId = state.activePlayer,
): Record<CardId, CardId[]> {
  const out = {} as Record<CardId, CardId[]>;
  for (const card of state.hands[player]) {
    out[card.id] = state.field.filter((f) => f.month === card.month).map((f) => f.id);
  }
  return out;
}

function applyCardToField(
  field: readonly HanafudaCard[],
  playedCard: HanafudaCard,
  targetFieldCardId?: CardId | string | null,
):
  | {
      status: "resolved";
      nextField: HanafudaCard[];
      capturedCards: HanafudaCard[];
    }
  | {
      status: "needs-choice";
      matchingFieldCards: HanafudaCard[];
    } {
  const matches = field.filter((f) => f.month === playedCard.month);

  if (matches.length === 0) {
    return {
      status: "resolved",
      nextField: [...field, playedCard],
      capturedCards: [],
    };
  }

  if (matches.length === 1 || matches.length >= 3) {
    // Either single match (capture 2) or 3-on-field Hiki sweep (capture all 4 of that month).
    const matchedIds = new Set(matches.map((m) => m.id));
    return {
      status: "resolved",
      nextField: field.filter((f) => !matchedIds.has(f.id)),
      capturedCards: [playedCard, ...matches],
    };
  }

  // Exactly 2 matching cards on the field.
  if (targetFieldCardId) {
    const chosen = matches.find((m) => m.id === targetFieldCardId);
    if (!chosen) {
      throw new Error(
        `Card ${String(targetFieldCardId)} is not a valid month-${playedCard.month} match for ${playedCard.id}`,
      );
    }
    return {
      status: "resolved",
      nextField: field.filter((f) => f.id !== chosen.id),
      capturedCards: [playedCard, chosen],
    };
  }

  return {
    status: "needs-choice",
    matchingFieldCards: matches,
  };
}

function finalizeTurnAfterDraw(state: HanafudaState): HanafudaState {
  const player = state.activePlayer;
  const opponent = otherPlayer(player);
  const currentYaku = detectYaku(state.captured[player]);
  const newYaku = diffNewYaku(state.achievedYaku[player], currentYaku);

  const nextAchievedYaku: Record<PlayerId, DetectedYaku[]> = {
    ...state.achievedYaku,
    [player]: currentYaku,
  };

  const updatedTurn: TurnSummary | null = state.lastTurn
    ? {
        ...state.lastTurn,
        newYaku,
      }
    : null;

  if (newYaku.length > 0) {
    const scoreBreakdown = calculateRoundScore(currentYaku, {
      opponentCalledKoiKoi: state.koiKoiCalled[opponent],
    });
    const yakuNames = newYaku.map((y) => `${y.name} (${y.points} pt${y.points === 1 ? "" : "s"})`).join(", ");
    const promptText = `${player === "human" ? "You" : "CPU"} formed ${yakuNames} — Koi-koi?`;
    return {
      ...state,
      phase: "koi-koi-decision",
      achievedYaku: nextAchievedYaku,
      pendingMatchChoice: null,
      pendingDecision: {
        player,
        newYaku,
        allYaku: currentYaku,
        scoreBreakdown,
        promptText,
      },
      lastTurn: updatedTurn,
      turnCount: state.turnCount + 1,
      announcement: promptText,
    };
  }

  // No new yaku formed this turn. Check if both hands are now empty.
  if (state.hands.human.length === 0 && state.hands.cpu.length === 0) {
    return finishRoundExhausted({
      ...state,
      achievedYaku: nextAchievedYaku,
      pendingMatchChoice: null,
      pendingDecision: null,
      lastTurn: updatedTurn,
      turnCount: state.turnCount + 1,
    });
  }

  const nextPlayer = opponent;
  return {
    ...state,
    activePlayer: nextPlayer,
    phase: "play-hand",
    achievedYaku: nextAchievedYaku,
    pendingMatchChoice: null,
    pendingDecision: null,
    lastTurn: updatedTurn,
    turnCount: state.turnCount + 1,
    announcement: `${nextPlayer === "human" ? "Your" : "CPU's"} turn.`,
  };
}

function finishRoundExhausted(state: HanafudaState): HanafudaState {
  const flower = MONTHLY_FLOWERS_BY_NUMBER[state.roundMonth];
  const result: RoundResult = {
    round: state.round,
    month: state.roundMonth,
    flower,
    winner: null,
    reason: "exhausted",
    yaku: [],
    basePoints: 0,
    sevenPlusDoubled: false,
    opponentKoiKoiDoubled: false,
    multiplier: 1,
    pointsAwarded: 0,
    koiKoiCalls: { ...state.koiKoiCalls },
  };
  const roundHistory = [...state.roundHistory, result];
  const isFinalRound = state.round >= state.totalRounds;
  const matchWinner = isFinalRound ? computeMatchWinner(state.scores) : null;

  return {
    ...state,
    phase: isFinalRound ? "match-over" : "round-over",
    pendingMatchChoice: null,
    pendingDecision: null,
    roundHistory,
    matchWinner,
    announcement: `Round ${state.round} (${flower}) ended in a draw (0 pts).`,
  };
}

function computeMatchWinner(scores: Record<PlayerId, number>): PlayerId | "tie" {
  if (scores.human > scores.cpu) return "human";
  if (scores.cpu > scores.human) return "cpu";
  return "tie";
}

function finishRoundWithWinner(
  state: HanafudaState,
  winner: PlayerId,
  reason: RoundEndReason = "shobu",
): HanafudaState {
  const loser = otherPlayer(winner);
  const yaku = state.achievedYaku[winner];
  const breakdown = calculateRoundScore(yaku, {
    opponentCalledKoiKoi: state.koiKoiCalled[loser],
  });
  const nextScores: Record<PlayerId, number> = {
    ...state.scores,
    [winner]: state.scores[winner] + breakdown.finalPoints,
  };
  const flower = MONTHLY_FLOWERS_BY_NUMBER[state.roundMonth];
  const result: RoundResult = {
    round: state.round,
    month: state.roundMonth,
    flower,
    winner,
    reason,
    yaku,
    basePoints: breakdown.basePoints,
    sevenPlusDoubled: breakdown.sevenPlusDoubled,
    opponentKoiKoiDoubled: breakdown.opponentKoiKoiDoubled,
    multiplier: breakdown.multiplier,
    pointsAwarded: breakdown.finalPoints,
    koiKoiCalls: { ...state.koiKoiCalls },
  };
  const roundHistory = [...state.roundHistory, result];
  const isFinalRound = state.round >= state.totalRounds;
  const matchWinner = isFinalRound ? computeMatchWinner(nextScores) : null;
  const yakuLabel = yaku.map((y) => y.name).join(", ");
  const multNote = breakdown.multiplier > 1 ? ` (×${breakdown.multiplier})` : "";

  return {
    ...state,
    dealer: winner,
    phase: isFinalRound ? "match-over" : "round-over",
    scores: nextScores,
    pendingMatchChoice: null,
    pendingDecision: null,
    roundHistory,
    matchWinner,
    announcement: `Shobu! ${winner === "human" ? "You win" : "CPU wins"} Round ${state.round} with ${yakuLabel} for ${breakdown.finalPoints} pts${multNote}.`,
  };
}

// Step 1 of a turn: play a card from the active player's hand onto the field.
// Transitions to "draw-stock" (or "choose-hand-match" if 2 field cards match and no targetFieldCardId is given).
export function resolveHandPlay(
  state: HanafudaState,
  handCardId: CardId | string,
  targetFieldCardId?: CardId | string | null,
): HanafudaState {
  if (state.phase !== "play-hand") {
    throw new Error(`Cannot play a hand card during phase "${state.phase}"`);
  }
  const player = state.activePlayer;
  const playerHand = state.hands[player];
  const handIndex = playerHand.findIndex((c) => c.id === handCardId);
  if (handIndex === -1) {
    throw new Error(`Card ${String(handCardId)} is not in ${player}'s hand`);
  }
  const playedCard = playerHand[handIndex];
  const nextPlayerHand = playerHand.filter((_, i) => i !== handIndex);
  const nextHands: Record<PlayerId, HanafudaCard[]> = {
    ...state.hands,
    [player]: nextPlayerHand,
  };

  const matchOutcome = applyCardToField(state.field, playedCard, targetFieldCardId);
  if (matchOutcome.status === "needs-choice") {
    return {
      ...state,
      phase: "choose-hand-match",
      hands: nextHands,
      pendingMatchChoice: {
        stage: "hand",
        player,
        card: playedCard,
        matchingFieldCards: matchOutcome.matchingFieldCards,
      },
      lastTurn: {
        player,
        handCard: playedCard,
        handCaptured: [],
        drawnCard: null,
        drawCaptured: [],
        newYaku: [],
      },
      announcement: `Choose which ${playedCard.flower} card to capture.`,
    };
  }

  const nextCaptured: Record<PlayerId, HanafudaCard[]> = {
    ...state.captured,
    [player]: [...state.captured[player], ...matchOutcome.capturedCards],
  };

  return {
    ...state,
    phase: "draw-stock",
    hands: nextHands,
    field: matchOutcome.nextField,
    captured: nextCaptured,
    pendingMatchChoice: null,
    lastTurn: {
      player,
      handCard: playedCard,
      handCaptured: matchOutcome.capturedCards,
      drawnCard: null,
      drawCaptured: [],
      newYaku: [],
    },
  };
}

// Step 2 of a turn: flip the top card of the stock pile and match it against the field.
// If the stock pile is empty, immediately finalizes the turn.
export function resolveStockDraw(
  state: HanafudaState,
  targetFieldCardId?: CardId | string | null,
): HanafudaState {
  if (state.phase !== "draw-stock") {
    throw new Error(`Cannot draw from stock during phase "${state.phase}"`);
  }
  const player = state.activePlayer;
  if (state.stock.length === 0) {
    return finalizeTurnAfterDraw(state);
  }

  const [drawnCard, ...remainingStock] = state.stock;
  const matchOutcome = applyCardToField(state.field, drawnCard, targetFieldCardId);

  if (matchOutcome.status === "needs-choice") {
    return {
      ...state,
      phase: "choose-draw-match",
      stock: remainingStock,
      pendingMatchChoice: {
        stage: "draw",
        player,
        card: drawnCard,
        matchingFieldCards: matchOutcome.matchingFieldCards,
      },
      lastTurn: state.lastTurn
        ? {
            ...state.lastTurn,
            drawnCard,
          }
        : {
            player,
            handCard: drawnCard,
            handCaptured: [],
            drawnCard,
            drawCaptured: [],
            newYaku: [],
          },
      announcement: `Drawn ${drawnCard.name}: choose which ${drawnCard.flower} card to capture.`,
    };
  }

  const nextCaptured: Record<PlayerId, HanafudaCard[]> = {
    ...state.captured,
    [player]: [...state.captured[player], ...matchOutcome.capturedCards],
  };

  const withDraw: HanafudaState = {
    ...state,
    field: matchOutcome.nextField,
    stock: remainingStock,
    captured: nextCaptured,
    pendingMatchChoice: null,
    lastTurn: state.lastTurn
      ? {
          ...state.lastTurn,
          drawnCard,
          drawCaptured: matchOutcome.capturedCards,
        }
      : {
          player,
          handCard: drawnCard,
          handCaptured: [],
          drawnCard,
          drawCaptured: matchOutcome.capturedCards,
          newYaku: [],
        },
  };

  return finalizeTurnAfterDraw(withDraw);
}

// Resolves a pending 2-card field match choice during either "choose-hand-match" or "choose-draw-match".
export function selectFieldMatch(
  state: HanafudaState,
  targetFieldCardId: CardId | string,
  options: { autoDraw?: boolean; drawTargetFieldCardId?: CardId | string | null } = {},
): HanafudaState {
  const autoDraw = options.autoDraw ?? true;
  if (
    (state.phase !== "choose-hand-match" && state.phase !== "choose-draw-match") ||
    !state.pendingMatchChoice
  ) {
    throw new Error(`No pending field match choice in phase "${state.phase}"`);
  }
  const { stage, player, card, matchingFieldCards } = state.pendingMatchChoice;
  const chosen = matchingFieldCards.find((m) => m.id === targetFieldCardId);
  if (!chosen) {
    throw new Error(`Card ${String(targetFieldCardId)} is not a valid match choice for ${card.id}`);
  }

  const nextField = state.field.filter((f) => f.id !== chosen.id);
  const capturedPair = [card, chosen];
  const nextCaptured: Record<PlayerId, HanafudaCard[]> = {
    ...state.captured,
    [player]: [...state.captured[player], ...capturedPair],
  };

  if (stage === "hand") {
    const afterHand: HanafudaState = {
      ...state,
      phase: "draw-stock",
      field: nextField,
      captured: nextCaptured,
      pendingMatchChoice: null,
      lastTurn: state.lastTurn
        ? {
            ...state.lastTurn,
            handCaptured: capturedPair,
          }
        : {
            player,
            handCard: card,
            handCaptured: capturedPair,
            drawnCard: null,
            drawCaptured: [],
            newYaku: [],
          },
    };
    return autoDraw ? resolveStockDraw(afterHand, options.drawTargetFieldCardId) : afterHand;
  }

  const afterDraw: HanafudaState = {
    ...state,
    field: nextField,
    captured: nextCaptured,
    pendingMatchChoice: null,
    lastTurn: state.lastTurn
      ? {
          ...state.lastTurn,
          drawCaptured: capturedPair,
        }
      : {
          player,
          handCard: card,
          handCaptured: [],
          drawnCard: card,
          drawCaptured: capturedPair,
          newYaku: [],
        },
  };
  return finalizeTurnAfterDraw(afterDraw);
}

// High-level turn helper: plays a card from hand and (by default) immediately draws from the stock pile.
export function playHandCard(
  state: HanafudaState,
  handCardId: CardId | string,
  targetFieldCardId?: CardId | string | null,
  options: PlayHandOptions = {},
): HanafudaState {
  const effectiveTarget = targetFieldCardId ?? options.targetFieldCardId ?? null;
  const autoDraw = options.autoDraw ?? true;
  const afterHand = resolveHandPlay(state, handCardId, effectiveTarget);
  if (autoDraw && afterHand.phase === "draw-stock") {
    return resolveStockDraw(afterHand, options.drawTargetFieldCardId);
  }
  return afterHand;
}

export function drawStockCard(
  state: HanafudaState,
  targetFieldCardId?: CardId | string | null,
): HanafudaState {
  return resolveStockDraw(state, targetFieldCardId);
}

// Handles the active player's "koi-koi" vs "shobu" decision after forming a new yaku.
export function decideKoiKoi(state: HanafudaState, decision: KoiKoiDecision): HanafudaState {
  if (state.phase !== "koi-koi-decision" || !state.pendingDecision) {
    throw new Error(`Cannot make a Koi-Koi decision during phase "${state.phase}"`);
  }
  const player = state.activePlayer;
  const opponent = otherPlayer(player);
  const { newYaku, scoreBreakdown } = state.pendingDecision;
  const lastDecision: DecisionSummary = {
    player,
    decision,
    yaku: newYaku,
    scoreBreakdown,
  };

  if (decision === "shobu") {
    return finishRoundWithWinner(
      {
        ...state,
        lastDecision,
      },
      player,
      "shobu",
    );
  }

  // Player called "koi-koi"
  const nextKoiKoiCalled: Record<PlayerId, boolean> = {
    ...state.koiKoiCalled,
    [player]: true,
  };
  const nextKoiKoiCalls: Record<PlayerId, number> = {
    ...state.koiKoiCalls,
    [player]: state.koiKoiCalls[player] + 1,
  };

  const withCall: HanafudaState = {
    ...state,
    koiKoiCalled: nextKoiKoiCalled,
    koiKoiCalls: nextKoiKoiCalls,
    pendingDecision: null,
    lastDecision,
  };

  if (withCall.hands.human.length === 0 && withCall.hands.cpu.length === 0) {
    return finishRoundExhausted(withCall);
  }

  return {
    ...withCall,
    activePlayer: opponent,
    phase: "play-hand",
    announcement: `Koi-koi! ${player === "human" ? "You continue" : "CPU continues"} the round. ${opponent === "human" ? "Your" : "CPU's"} turn.`,
  };
}

// Advances from "round-over" to the next round in the match.
export function advanceToNextRound(state: HanafudaState): HanafudaState {
  if (state.phase !== "round-over") {
    throw new Error(`Cannot advance to next round during phase "${state.phase}"`);
  }
  if (state.round >= state.totalRounds) {
    return {
      ...state,
      phase: "match-over",
      matchWinner: computeMatchWinner(state.scores),
    };
  }
  const nextRound = state.round + 1;
  const nextMonth = roundMonthFor(nextRound);
  const flower = MONTHLY_FLOWERS_BY_NUMBER[nextMonth];
  const deal = dealRoundCards(state.seed, nextRound);

  return {
    ...state,
    roundSeed: deal.roundSeed,
    redealCount: deal.redealCount,
    round: nextRound,
    roundMonth: nextMonth,
    activePlayer: state.dealer,
    phase: "play-hand",
    hands: {
      human: deal.humanHand,
      cpu: deal.cpuHand,
    },
    field: deal.field,
    stock: deal.stock,
    captured: {
      human: [],
      cpu: [],
    },
    achievedYaku: {
      human: [],
      cpu: [],
    },
    koiKoiCalled: {
      human: false,
      cpu: false,
    },
    koiKoiCalls: {
      human: 0,
      cpu: 0,
    },
    pendingMatchChoice: null,
    pendingDecision: null,
    lastTurn: null,
    lastDecision: null,
    announcement: `Round ${nextRound} (${flower}): ${state.dealer === "human" ? "Your" : "CPU's"} turn.`,
  };
}

// --- Greedy CPU policy (deterministic, zero LLM dependencies) --------------------------------------------------

function cardStrategicValue(
  card: HanafudaCard,
  myCapturedIds: ReadonlySet<CardId>,
  oppCapturedIds: ReadonlySet<CardId>,
): number {
  let score = card.points * 3;

  // High-priority yaku enablers
  if (card.id === SPECIAL_CARD_IDS.SAKE_CUP) {
    score += 95;
    if (myCapturedIds.has(SPECIAL_CARD_IDS.CURTAIN) || myCapturedIds.has(SPECIAL_CARD_IDS.MOON)) {
      score += 120;
    }
    if (oppCapturedIds.has(SPECIAL_CARD_IDS.CURTAIN) || oppCapturedIds.has(SPECIAL_CARD_IDS.MOON)) {
      score += 80;
    }
  } else if (card.id === SPECIAL_CARD_IDS.CURTAIN || card.id === SPECIAL_CARD_IDS.MOON) {
    score += 85;
    if (myCapturedIds.has(SPECIAL_CARD_IDS.SAKE_CUP)) {
      score += 120;
    }
    if (oppCapturedIds.has(SPECIAL_CARD_IDS.SAKE_CUP)) {
      score += 75;
    }
  } else if (card.category === "hikari") {
    score += 70;
  }

  // Inoshikacho synergy (Boar, Deer, Butterflies)
  if (
    card.id === SPECIAL_CARD_IDS.BOAR ||
    card.id === SPECIAL_CARD_IDS.DEER ||
    card.id === SPECIAL_CARD_IDS.BUTTERFLIES
  ) {
    const ownedCount = [
      SPECIAL_CARD_IDS.BOAR,
      SPECIAL_CARD_IDS.DEER,
      SPECIAL_CARD_IDS.BUTTERFLIES,
    ].filter((id) => myCapturedIds.has(id)).length;
    const oppCount = [
      SPECIAL_CARD_IDS.BOAR,
      SPECIAL_CARD_IDS.DEER,
      SPECIAL_CARD_IDS.BUTTERFLIES,
    ].filter((id) => oppCapturedIds.has(id)).length;
    score += 40 + ownedCount * 35 + (oppCount === 2 ? 50 : 0);
  }

  // Akatan / Aotan ribbon synergy
  if (card.ribbonType === "akatan") {
    const owned = [
      SPECIAL_CARD_IDS.PINE_AKATAN,
      SPECIAL_CARD_IDS.PLUM_AKATAN,
      SPECIAL_CARD_IDS.CHERRY_AKATAN,
    ].filter((id) => myCapturedIds.has(id)).length;
    const opp = [
      SPECIAL_CARD_IDS.PINE_AKATAN,
      SPECIAL_CARD_IDS.PLUM_AKATAN,
      SPECIAL_CARD_IDS.CHERRY_AKATAN,
    ].filter((id) => oppCapturedIds.has(id)).length;
    score += 35 + owned * 30 + (opp === 2 ? 45 : 0);
  } else if (card.ribbonType === "aotan") {
    const owned = [
      SPECIAL_CARD_IDS.PEONY_AOTAN,
      SPECIAL_CARD_IDS.CHRYSANTHEMUM_AOTAN,
      SPECIAL_CARD_IDS.MAPLE_AOTAN,
    ].filter((id) => myCapturedIds.has(id)).length;
    const opp = [
      SPECIAL_CARD_IDS.PEONY_AOTAN,
      SPECIAL_CARD_IDS.CHRYSANTHEMUM_AOTAN,
      SPECIAL_CARD_IDS.MAPLE_AOTAN,
    ].filter((id) => oppCapturedIds.has(id)).length;
    score += 35 + owned * 30 + (opp === 2 ? 45 : 0);
  } else if (card.category === "tane") {
    score += 22;
  } else if (card.category === "tanzaku") {
    score += 14;
  } else {
    score += 4;
  }

  return score;
}

function evaluateCaptureGain(
  state: HanafudaState,
  player: PlayerId,
  capturedBundle: readonly HanafudaCard[],
): number {
  const opponent = otherPlayer(player);
  const myCurrent = state.captured[player];
  const myCurrentIds = new Set<CardId>(myCurrent.map((c) => c.id));
  const oppCapturedIds = new Set<CardId>(state.captured[opponent].map((c) => c.id));

  const simulatedCaptured = [...myCurrent, ...capturedBundle];
  const nextYaku = detectYaku(simulatedCaptured);
  const newYaku = diffNewYaku(state.achievedYaku[player], nextYaku);

  let gain = 0;
  if (newYaku.length > 0) {
    const newPts = newYaku.reduce((acc, y) => acc + y.points, 0);
    gain += 1000 + newPts * 250;
  }

  for (const card of capturedBundle) {
    gain += cardStrategicValue(card, myCurrentIds, oppCapturedIds);
  }

  return gain;
}

export function chooseCpuFieldMatch(
  state: HanafudaState,
  playedOrDrawnCard: HanafudaCard,
  matchingFieldCards: readonly HanafudaCard[],
): CardId {
  if (matchingFieldCards.length === 0) {
    throw new Error(`No matching field cards available for ${playedOrDrawnCard.id}`);
  }
  const player = state.activePlayer;
  let bestCard = matchingFieldCards[0];
  let bestScore = -Infinity;

  for (const candidate of matchingFieldCards) {
    const score = evaluateCaptureGain(state, player, [playedOrDrawnCard, candidate]);
    if (
      score > bestScore ||
      (score === bestScore && candidate.id.localeCompare(bestCard.id) < 0)
    ) {
      bestScore = score;
      bestCard = candidate;
    }
  }

  return bestCard.id;
}

export function chooseCpuHandPlay(state: HanafudaState): {
  handCardId: CardId;
  targetFieldCardId: CardId | null;
} {
  const player = state.activePlayer;
  const opponent = otherPlayer(player);
  const hand = state.hands[player];
  if (hand.length === 0) {
    throw new Error(`Player ${player} has no cards in hand`);
  }

  let bestMatch: {
    handCardId: CardId;
    targetFieldCardId: CardId | null;
    score: number;
  } | null = null;

  for (const handCard of hand) {
    const matches = state.field.filter((f) => f.month === handCard.month);
    if (matches.length === 0) continue;

    if (matches.length === 1 || matches.length >= 3) {
      const score = evaluateCaptureGain(state, player, [handCard, ...matches]);
      if (
        !bestMatch ||
        score > bestMatch.score ||
        (score === bestMatch.score && handCard.id.localeCompare(bestMatch.handCardId) < 0)
      ) {
        bestMatch = {
          handCardId: handCard.id,
          targetFieldCardId: matches[0].id,
          score,
        };
      }
    } else {
      // 2 matches on field: evaluate each target
      for (const target of matches) {
        const score = evaluateCaptureGain(state, player, [handCard, target]);
        if (
          !bestMatch ||
          score > bestMatch.score ||
          (score === bestMatch.score && handCard.id.localeCompare(bestMatch.handCardId) < 0)
        ) {
          bestMatch = {
            handCardId: handCard.id,
            targetFieldCardId: target.id,
            score,
          };
        }
      }
    }
  }

  if (bestMatch) {
    return {
      handCardId: bestMatch.handCardId,
      targetFieldCardId: bestMatch.targetFieldCardId,
    };
  }

  // No card in hand matches the field: discard the lowest strategic value card.
  // Prefer discarding a card whose month we hold a second copy of in hand so we can capture it later.
  const myCapturedIds = new Set<CardId>(state.captured[player].map((c) => c.id));
  const oppCapturedIds = new Set<CardId>(state.captured[opponent].map((c) => c.id));
  const handCountsByMonth = monthCounts(hand);

  let bestDiscard = hand[0];
  let lowestCost = Infinity;

  for (const handCard of hand) {
    const baseValue = cardStrategicValue(handCard, myCapturedIds, oppCapturedIds);
    const pairBonus = (handCountsByMonth.get(handCard.month) ?? 0) >= 2 ? -8 : 0;
    const discardCost = baseValue + pairBonus;
    if (
      discardCost < lowestCost ||
      (discardCost === lowestCost && handCard.id.localeCompare(bestDiscard.id) < 0)
    ) {
      lowestCost = discardCost;
      bestDiscard = handCard;
    }
  }

  return {
    handCardId: bestDiscard.id,
    targetFieldCardId: null,
  };
}

export function chooseCpuKoiKoiDecision(state: HanafudaState): KoiKoiDecision {
  const player = state.activePlayer;
  const opponent = otherPlayer(player);
  const remainingCards = state.hands[player].length;

  // Never call Koi-Koi with 0 cards left in hand (or ≤ 1 card when risk outweighs reward).
  if (remainingCards <= 1) {
    return "shobu";
  }

  const breakdown = calculateRoundScore(state.achievedYaku[player], {
    opponentCalledKoiKoi: state.koiKoiCalled[opponent],
  });

  // Always call Shobu on high-value yaku (5+ points) or when opponent called Koi-Koi (reversal ×2).
  if (breakdown.finalPoints >= 5 || state.koiKoiCalled[opponent]) {
    return "shobu";
  }

  // Call Shobu when ahead (or taking the lead) in the final round or with a solid 3+ point score.
  const projectedMyScore = state.scores[player] + breakdown.finalPoints;
  const oppScore = state.scores[opponent];
  if (projectedMyScore > oppScore && (state.round >= state.totalRounds || breakdown.finalPoints >= 3)) {
    return "shobu";
  }

  // Defensive check: if opponent is close to a high-value yaku, bank the points now.
  const oppCaptured = state.captured[opponent];
  const oppIds = new Set<CardId>(oppCaptured.map((c) => c.id));
  const oppHikariCount = oppCaptured.filter((c) => c.category === "hikari").length;
  const oppTaneCount = oppCaptured.filter((c) => c.category === "tane").length;
  const oppTanCount = oppCaptured.filter((c) => c.category === "tanzaku").length;
  const oppKasuCount = oppCaptured.filter((c) => c.category === "kasu" || c.dualKasu).length;
  const oppThreatening =
    oppHikariCount >= 2 ||
    oppIds.has(SPECIAL_CARD_IDS.SAKE_CUP) ||
    oppTaneCount >= 4 ||
    oppTanCount >= 4 ||
    oppKasuCount >= 8;

  if (oppThreatening || remainingCards <= 2) {
    return "shobu";
  }

  return "koi-koi";
}

// Executes a single atomic greedy step for the active player.
export function stepCpu(state: HanafudaState): HanafudaState {
  if (state.phase === "round-over" || state.phase === "match-over") {
    return state;
  }

  if (state.phase === "koi-koi-decision") {
    const decision = chooseCpuKoiKoiDecision(state);
    return decideKoiKoi(state, decision);
  }

  if (state.phase === "choose-hand-match" || state.phase === "choose-draw-match") {
    const choice = state.pendingMatchChoice!;
    const targetId = chooseCpuFieldMatch(state, choice.card, choice.matchingFieldCards);
    return selectFieldMatch(state, targetId, { autoDraw: true });
  }

  if (state.phase === "draw-stock") {
    const afterDraw = resolveStockDraw(state);
    if (afterDraw.phase === "choose-draw-match" && afterDraw.pendingMatchChoice) {
      const targetId = chooseCpuFieldMatch(
        afterDraw,
        afterDraw.pendingMatchChoice.card,
        afterDraw.pendingMatchChoice.matchingFieldCards,
      );
      return selectFieldMatch(afterDraw, targetId, { autoDraw: true });
    }
    return afterDraw;
  }

  // phase === "play-hand"
  const { handCardId, targetFieldCardId } = chooseCpuHandPlay(state);
  const afterPlay = playHandCard(state, handCardId, targetFieldCardId, { autoDraw: true });
  if (afterPlay.phase === "choose-draw-match" && afterPlay.pendingMatchChoice) {
    const targetId = chooseCpuFieldMatch(
      afterPlay,
      afterPlay.pendingMatchChoice.card,
      afterPlay.pendingMatchChoice.matchingFieldCards,
    );
    return selectFieldMatch(afterPlay, targetId, { autoDraw: true });
  }
  return afterPlay;
}

// Runs greedy CPU actions while activePlayer === "cpu" until human's turn or round/match end.
export function runCpuTurn(state: HanafudaState): HanafudaState {
  let current = state;
  let guard = 0;
  while (
    current.activePlayer === "cpu" &&
    current.phase !== "round-over" &&
    current.phase !== "match-over" &&
    guard < 32
  ) {
    current = stepCpu(current);
    guard++;
  }
  return current;
}

export function simulateRound(stateOrSeed: HanafudaState | number = DEFAULT_SEED): HanafudaState {
  let current = typeof stateOrSeed === "number" ? createMatch({ seed: stateOrSeed }) : stateOrSeed;
  let guard = 0;
  while (current.phase !== "round-over" && current.phase !== "match-over" && guard < 128) {
    current = stepCpu(current);
    guard++;
  }
  return current;
}

export function simulateMatch(optionsOrSeed: CreateMatchOptions | number = DEFAULT_SEED): HanafudaState {
  let current =
    typeof optionsOrSeed === "number"
      ? createMatch({ seed: optionsOrSeed })
      : createMatch(optionsOrSeed);
  let guard = 0;
  while (current.phase !== "match-over" && guard < 512) {
    if (current.phase === "round-over") {
      current = advanceToNextRound(current);
    } else {
      current = stepCpu(current);
    }
    guard++;
  }
  return current;
}

export function hanafudaReducer(state: HanafudaState, action: HanafudaAction): HanafudaState {
  switch (action.type) {
    case "PLAY_HAND_CARD":
      return playHandCard(state, action.cardId, action.targetFieldCardId, {
        drawTargetFieldCardId: action.drawTargetFieldCardId,
        autoDraw: action.autoDraw,
      });
    case "DRAW_STOCK":
      return drawStockCard(state, action.targetFieldCardId);
    case "SELECT_FIELD_MATCH":
      return selectFieldMatch(state, action.targetFieldCardId, {
        autoDraw: action.autoDraw,
      });
    case "DECIDE_KOI_KOI":
      return decideKoiKoi(state, action.decision);
    case "STEP_CPU":
      return stepCpu(state);
    case "RUN_CPU_TURN":
      return runCpuTurn(state);
    case "NEXT_ROUND":
      return advanceToNextRound(state);
    case "NEW_MATCH":
      return createMatch(action.options);
    default:
      return state;
  }
}

export {
  HANAFUDA_DECK,
  requireCardById,
  resolveCard,
  SPECIAL_CARD_IDS,
  type CardId,
  type HanafudaCard,
  type MonthNumber,
  calculateRoundScore,
  detectYaku,
  diffNewYaku,
  type DetectedYaku,
  type RoundScoreBreakdown,
};
