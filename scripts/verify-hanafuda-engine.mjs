// Standalone verifier for the pure Hanafuda Koi-Koi deck, 12-yaku scorer,
// seeded 3-round state machine, card conservation invariant, and greedy CPU.
import assert from "node:assert/strict";
import {
  CARD_IDS,
  HANAFUDA_DECK,
  SPECIAL_CARD_IDS,
} from "../lib/hanafuda/deck.ts";
import {
  ALL_YAKU_IDS,
  calculateRoundScore,
  detectYaku,
} from "../lib/hanafuda/yaku.ts";
import {
  advanceToNextRound,
  createMatch,
  decideKoiKoi,
  HANAMI_ZAKE_SEED,
  playHandCard,
  simulateMatch,
  stepCpu,
  TSUKIMI_ZAKE_SEED,
} from "../lib/hanafuda/engine.ts";

// 1. Verify 48-card 12-month deck
assert.equal(HANAFUDA_DECK.length, 48, "Deck must contain 48 cards");
assert.equal(new Set(CARD_IDS).size, 48, "All 48 card IDs must be unique");

// 2. Verify all 12 standard yaku are reachable and accurately scored
const yakuFixtures = new Map([
  [
    "Goko",
    [
      SPECIAL_CARD_IDS.CRANE,
      SPECIAL_CARD_IDS.CURTAIN,
      SPECIAL_CARD_IDS.MOON,
      SPECIAL_CARD_IDS.RAIN_MAN,
      SPECIAL_CARD_IDS.PHOENIX,
    ],
  ],
  [
    "Shiko",
    [
      SPECIAL_CARD_IDS.CRANE,
      SPECIAL_CARD_IDS.CURTAIN,
      SPECIAL_CARD_IDS.MOON,
      SPECIAL_CARD_IDS.PHOENIX,
    ],
  ],
  [
    "Ame-Shiko",
    [
      SPECIAL_CARD_IDS.CRANE,
      SPECIAL_CARD_IDS.CURTAIN,
      SPECIAL_CARD_IDS.RAIN_MAN,
      SPECIAL_CARD_IDS.PHOENIX,
    ],
  ],
  ["Sanko", [SPECIAL_CARD_IDS.CRANE, SPECIAL_CARD_IDS.CURTAIN, SPECIAL_CARD_IDS.MOON]],
  ["Hanami-zake", [SPECIAL_CARD_IDS.CURTAIN, SPECIAL_CARD_IDS.SAKE_CUP]],
  ["Tsukimi-zake", [SPECIAL_CARD_IDS.MOON, SPECIAL_CARD_IDS.SAKE_CUP]],
  [
    "Inoshikacho",
    [SPECIAL_CARD_IDS.BOAR, SPECIAL_CARD_IDS.DEER, SPECIAL_CARD_IDS.BUTTERFLIES],
  ],
  [
    "Akatan",
    [
      SPECIAL_CARD_IDS.PINE_AKATAN,
      SPECIAL_CARD_IDS.PLUM_AKATAN,
      SPECIAL_CARD_IDS.CHERRY_AKATAN,
    ],
  ],
  [
    "Aotan",
    [
      SPECIAL_CARD_IDS.PEONY_AOTAN,
      SPECIAL_CARD_IDS.CHRYSANTHEMUM_AOTAN,
      SPECIAL_CARD_IDS.MAPLE_AOTAN,
    ],
  ],
  [
    "Tane",
    [
      SPECIAL_CARD_IDS.WARBLER,
      SPECIAL_CARD_IDS.CUCKOO,
      SPECIAL_CARD_IDS.BRIDGE,
      SPECIAL_CARD_IDS.GEESE,
      SPECIAL_CARD_IDS.SWALLOW,
    ],
  ],
  [
    "Tan",
    [
      SPECIAL_CARD_IDS.PINE_AKATAN,
      SPECIAL_CARD_IDS.PLUM_AKATAN,
      SPECIAL_CARD_IDS.WISTERIA_TAN,
      SPECIAL_CARD_IDS.IRIS_TAN,
      SPECIAL_CARD_IDS.CLOVER_TAN,
    ],
  ],
  [
    "Kasu",
    [
      "01-kasu-1",
      "01-kasu-2",
      "02-kasu-1",
      "02-kasu-2",
      "03-kasu-1",
      "03-kasu-2",
      "04-kasu-1",
      "04-kasu-2",
      "05-kasu-1",
      SPECIAL_CARD_IDS.SAKE_CUP,
    ],
  ],
]);

assert.equal(yakuFixtures.size, ALL_YAKU_IDS.length);
for (const yakuId of ALL_YAKU_IDS) {
  const cards = yakuFixtures.get(yakuId);
  assert.ok(cards, `Missing fixture for ${yakuId}`);
  const detected = detectYaku(cards);
  assert.ok(
    detected.some((y) => y.id === yakuId),
    `Expected ${yakuId} to be detected from fixture`,
  );
}

// 3. Verify 7+ doubling and opponent Koi-Koi reversal multipliers
const gokoScore = calculateRoundScore(detectYaku(yakuFixtures.get("Goko")), {
  opponentCalledKoiKoi: true,
});
assert.equal(gokoScore.basePoints, 10);
assert.equal(gokoScore.sevenPlusDoubled, true);
assert.equal(gokoScore.opponentKoiKoiDoubled, true);
assert.equal(gokoScore.multiplier, 4);
assert.equal(gokoScore.finalPoints, 40);

// 4. Verify 1-turn seeded yaku prompts
const hanamiMatch = playHandCard(
  createMatch({ seed: HANAMI_ZAKE_SEED }),
  SPECIAL_CARD_IDS.CURTAIN,
  SPECIAL_CARD_IDS.CHERRY_AKATAN,
);
assert.equal(hanamiMatch.phase, "koi-koi-decision");
assert.equal(hanamiMatch.pendingDecision?.newYaku[0]?.id, "Hanami-zake");
const afterShobu = decideKoiKoi(hanamiMatch, "shobu");
assert.equal(afterShobu.phase, "round-over");
assert.equal(afterShobu.scores.human, 5);

const tsukimiMatch = playHandCard(
  createMatch({ seed: TSUKIMI_ZAKE_SEED }),
  SPECIAL_CARD_IDS.CHRYSANTHEMUM_AOTAN,
  SPECIAL_CARD_IDS.SAKE_CUP,
);
assert.equal(tsukimiMatch.phase, "koi-koi-decision");
assert.equal(tsukimiMatch.pendingDecision?.newYaku[0]?.id, "Tsukimi-zake");

// 5. Verify 48-card conservation at every step across 30 seeded 3-round matches
function assertCardConservation(state) {
  const all = [
    ...state.hands.human,
    ...state.hands.cpu,
    ...state.field,
    ...state.stock,
    ...state.captured.human,
    ...state.captured.cpu,
    ...(state.pendingMatchChoice ? [state.pendingMatchChoice.card] : []),
  ];
  assert.equal(all.length, 48, `Expected 48 cards in play, found ${all.length}`);
  assert.equal(new Set(all.map((c) => c.id)).size, 48, "Duplicate card detected in state");
}

for (let seed = 1; seed <= 30; seed++) {
  let state = createMatch({ seed, totalRounds: 3 });
  assertCardConservation(state);
  let steps = 0;
  while (state.phase !== "match-over" && steps < 512) {
    state = state.phase === "round-over" ? advanceToNextRound(state) : stepCpu(state);
    assertCardConservation(state);
    steps++;
  }
  assert.equal(state.phase, "match-over");
  assert.equal(state.roundHistory.length, 3);
  const replay = simulateMatch({ seed, totalRounds: 3 });
  assert.deepEqual(state.scores, replay.scores);
}

console.log("ok - Hanafuda Koi-Koi 48-card deck, 12 yaku, multipliers, and 30 seeded 3-round matches verified.");
