import assert from "node:assert/strict";
import { test } from "node:test";
import { MONTHLY_FLOWERS, MONTH_KEYS } from "../yearly-log.ts";
import {
  CARD_BY_ID,
  CARD_IDS,
  countsAsKasu,
  countsAsTane,
  getCardById,
  getCardsByCategory,
  getCardsByMonth,
  HANAFUDA_DECK,
  isSameMonth,
  requireCardById,
  SPECIAL_CARD_IDS,
  SUIT_METADATA,
  type CardId,
} from "./deck.ts";
import {
  ALL_YAKU_IDS,
  calculateRoundScore,
  detectYaku,
  diffNewYaku,
  hasNewYaku,
  sumYakuPoints,
  YAKU_DEFINITIONS,
  type YakuId,
} from "./yaku.ts";
import {
  advanceToNextRound,
  canCardMatchField,
  chooseCpuFieldMatch,
  chooseCpuHandPlay,
  chooseCpuKoiKoiDecision,
  createCustomRoundState,
  createMatch,
  decideKoiKoi,
  DEFAULT_ROUNDS,
  DEFAULT_SEED,
  drawStockCard,
  getMatchingFieldCards,
  getPlayableHandMatches,
  HANAMI_ZAKE_SEED,
  hanafudaReducer,
  hasFourOfSameMonth,
  hasFourPairs,
  mulberry32,
  playHandCard,
  resolveHandPlay,
  resolveStockDraw,
   runCpuTurn,
  selectFieldMatch,
  shuffleDeck,
  simulateMatch,
  simulateRound,
  stepCpu,
  TSUKIMI_ZAKE_SEED,
} from "./engine.ts";

test("deck defines all 48 traditional Hanafuda cards across 12 monthly flower suits with SVG motifs", () => {
  assert.equal(HANAFUDA_DECK.length, 48);
  assert.equal(CARD_IDS.length, 48);
  assert.equal(CARD_BY_ID.size, 48);

  // Verify 4 cards per month and flower alignment with lib/yearly-log.ts
  for (const key of MONTH_KEYS) {
    const monthNum = Number(key);
    const suit = SUIT_METADATA[key];
    assert.equal(suit.month, monthNum);
    assert.equal(suit.flower, MONTHLY_FLOWERS[key]);

    const cards = getCardsByMonth(key);
    assert.equal(cards.length, 4, `Month ${key} must have 4 cards`);
    assert.deepEqual(getCardsByMonth(monthNum), cards);

    const variants = new Set(cards.map((c) => c.motif.variant));
    assert.deepEqual([...variants].sort(), [1, 2, 3, 4]);

    for (const card of cards) {
      assert.equal(card.month, monthNum);
      assert.equal(card.monthKey, key);
      assert.equal(card.flower, MONTHLY_FLOWERS[key]);
      assert.equal(card.motif.basePlant, suit.basePlant);
      assert.ok(card.motif.paths.length >= 2, `${card.id} must have SVG motif paths`);
      for (const d of card.motif.paths) {
        assert.match(d, /^M\d+/, `${card.id} path "${d}" must start with an SVG Move command`);
      }
    }
  }

  // Category counts: 5 hikari, 9 tane, 10 tanzaku (3 akatan, 3 aotan, 4 plain), 24 kasu
  const hikari = getCardsByCategory("hikari");
  const tane = getCardsByCategory("tane");
  const tanzaku = getCardsByCategory("tanzaku");
  const kasu = getCardsByCategory("kasu");

  assert.equal(hikari.length, 5);
  assert.equal(tane.length, 9);
  assert.equal(tanzaku.length, 10);
  assert.equal(kasu.length, 24);

  assert.equal(hikari.filter((c) => c.isRainMan).length, 1);
  assert.equal(requireCardById(SPECIAL_CARD_IDS.RAIN_MAN).isRainMan, true);

  assert.equal(tanzaku.filter((c) => c.ribbonType === "akatan").length, 3);
  assert.equal(tanzaku.filter((c) => c.ribbonType === "aotan").length, 3);
  assert.equal(tanzaku.filter((c) => c.ribbonType === "plain").length, 4);

  // Only Sake Cup has dualKasu = true
  const dualKasuCards = HANAFUDA_DECK.filter((c) => c.dualKasu);
  assert.equal(dualKasuCards.length, 1);
  assert.equal(dualKasuCards[0].id, SPECIAL_CARD_IDS.SAKE_CUP);
  assert.equal(countsAsTane(SPECIAL_CARD_IDS.SAKE_CUP), true);
  assert.equal(countsAsKasu(SPECIAL_CARD_IDS.SAKE_CUP), true);
  assert.equal(countsAsKasu(SPECIAL_CARD_IDS.CRANE), false);
  assert.equal(countsAsKasu("01-kasu-1"), true);

  // Lookup and negative controls
  assert.equal(isSameMonth("01-hikari-crane", "01-kasu-2"), true);
  assert.equal(isSameMonth("01-hikari-crane", "02-tane-warbler"), false);
  assert.equal(getCardById("nonexistent-card"), null);
  assert.deepEqual(getCardsByMonth(0), []);
  assert.deepEqual(getCardsByMonth(13), []);
  assert.throws(() => requireCardById("nonexistent-card"), /Unknown Hanafuda card id/);
});

test("table-driven yaku detector scores all 12 standard yaku and respects mutual exclusions", () => {
  assert.equal(ALL_YAKU_IDS.length, 12);
  for (const id of ALL_YAKU_IDS) {
    assert.ok(YAKU_DEFINITIONS[id], `Missing definition for ${id}`);
  }

  const tenRegularKasu: CardId[] = [
    "01-kasu-1",
    "01-kasu-2",
    "02-kasu-1",
    "02-kasu-2",
    "03-kasu-1",
    "03-kasu-2",
    "04-kasu-1",
    "04-kasu-2",
    "05-kasu-1",
    "05-kasu-2",
  ];

  const cases: {
    name: string;
    cards: CardId[];
    expected: { id: YakuId; points: number; basePoints: number; bonusPoints: number }[];
  }[] = [
    {
      name: "Goko (all 5 brights = 10 pts, excludes Shiko/Ame-Shiko/Sanko)",
      cards: [
        SPECIAL_CARD_IDS.CRANE,
        SPECIAL_CARD_IDS.CURTAIN,
        SPECIAL_CARD_IDS.MOON,
        SPECIAL_CARD_IDS.RAIN_MAN,
        SPECIAL_CARD_IDS.PHOENIX,
      ],
      expected: [{ id: "Goko", points: 10, basePoints: 10, bonusPoints: 0 }],
    },
    {
      name: "Shiko (4 dry brights without Rain Man = 8 pts)",
      cards: [
        SPECIAL_CARD_IDS.CRANE,
        SPECIAL_CARD_IDS.CURTAIN,
        SPECIAL_CARD_IDS.MOON,
        SPECIAL_CARD_IDS.PHOENIX,
      ],
      expected: [{ id: "Shiko", points: 8, basePoints: 8, bonusPoints: 0 }],
    },
    {
      name: "Ame-Shiko (3 dry brights + Rain Man = 7 pts)",
      cards: [
        SPECIAL_CARD_IDS.CRANE,
        SPECIAL_CARD_IDS.CURTAIN,
        SPECIAL_CARD_IDS.RAIN_MAN,
        SPECIAL_CARD_IDS.PHOENIX,
      ],
      expected: [{ id: "Ame-Shiko", points: 7, basePoints: 7, bonusPoints: 0 }],
    },
    {
      name: "Sanko (3 dry brights without Rain Man = 5 pts)",
      cards: [SPECIAL_CARD_IDS.CRANE, SPECIAL_CARD_IDS.MOON, SPECIAL_CARD_IDS.PHOENIX],
      expected: [{ id: "Sanko", points: 5, basePoints: 5, bonusPoints: 0 }],
    },
    {
      name: "Negative control: 2 dry brights + Rain Man does NOT score Sanko",
      cards: [SPECIAL_CARD_IDS.CRANE, SPECIAL_CARD_IDS.MOON, SPECIAL_CARD_IDS.RAIN_MAN],
      expected: [],
    },
    {
      name: "Hanami-zake (Curtain + Sake Cup = 5 pts)",
      cards: [SPECIAL_CARD_IDS.CURTAIN, SPECIAL_CARD_IDS.SAKE_CUP],
      expected: [{ id: "Hanami-zake", points: 5, basePoints: 5, bonusPoints: 0 }],
    },
    {
      name: "Tsukimi-zake (Moon + Sake Cup = 5 pts)",
      cards: [SPECIAL_CARD_IDS.MOON, SPECIAL_CARD_IDS.SAKE_CUP],
      expected: [{ id: "Tsukimi-zake", points: 5, basePoints: 5, bonusPoints: 0 }],
    },
    {
      name: "Hanami-zake + Tsukimi-zake stack (Curtain + Moon + Sake Cup = 10 pts)",
      cards: [SPECIAL_CARD_IDS.CURTAIN, SPECIAL_CARD_IDS.MOON, SPECIAL_CARD_IDS.SAKE_CUP],
      expected: [
        { id: "Hanami-zake", points: 5, basePoints: 5, bonusPoints: 0 },
        { id: "Tsukimi-zake", points: 5, basePoints: 5, bonusPoints: 0 },
      ],
    },
    {
      name: "Inoshikacho base (Boar + Deer + Butterflies = 5 pts)",
      cards: [SPECIAL_CARD_IDS.BOAR, SPECIAL_CARD_IDS.DEER, SPECIAL_CARD_IDS.BUTTERFLIES],
      expected: [{ id: "Inoshikacho", points: 5, basePoints: 5, bonusPoints: 0 }],
    },
    {
      name: "Inoshikacho with 1 extra tane (6 pts) and 2 extra tane (7 pts + Tane 1 pt)",
      cards: [
        SPECIAL_CARD_IDS.BOAR,
        SPECIAL_CARD_IDS.DEER,
        SPECIAL_CARD_IDS.BUTTERFLIES,
        SPECIAL_CARD_IDS.WARBLER,
        SPECIAL_CARD_IDS.CUCKOO,
      ],
      expected: [
        { id: "Inoshikacho", points: 7, basePoints: 5, bonusPoints: 2 },
        { id: "Tane", points: 1, basePoints: 1, bonusPoints: 0 },
      ],
    },
    {
      name: "Tane with 6 animals/objects (base 1 + bonus 1 = 2 pts)",
      cards: [
        SPECIAL_CARD_IDS.WARBLER,
        SPECIAL_CARD_IDS.CUCKOO,
        SPECIAL_CARD_IDS.BRIDGE,
        SPECIAL_CARD_IDS.GEESE,
        SPECIAL_CARD_IDS.SWALLOW,
        SPECIAL_CARD_IDS.SAKE_CUP,
      ],
      expected: [{ id: "Tane", points: 2, basePoints: 1, bonusPoints: 1 }],
    },
    {
      name: "Akatan (3 poetry ribbons = 5 pts)",
      cards: [
        SPECIAL_CARD_IDS.PINE_AKATAN,
        SPECIAL_CARD_IDS.PLUM_AKATAN,
        SPECIAL_CARD_IDS.CHERRY_AKATAN,
      ],
      expected: [{ id: "Akatan", points: 5, basePoints: 5, bonusPoints: 0 }],
    },
    {
      name: "Aotan (3 blue ribbons = 5 pts)",
      cards: [
        SPECIAL_CARD_IDS.PEONY_AOTAN,
        SPECIAL_CARD_IDS.CHRYSANTHEMUM_AOTAN,
        SPECIAL_CARD_IDS.MAPLE_AOTAN,
      ],
      expected: [{ id: "Aotan", points: 5, basePoints: 5, bonusPoints: 0 }],
    },
    {
      name: "Akatan + Aotan + Tan (all 6 special ribbons = 5 + 5 + 2 = 12 pts)",
      cards: [
        SPECIAL_CARD_IDS.PINE_AKATAN,
        SPECIAL_CARD_IDS.PLUM_AKATAN,
        SPECIAL_CARD_IDS.CHERRY_AKATAN,
        SPECIAL_CARD_IDS.PEONY_AOTAN,
        SPECIAL_CARD_IDS.CHRYSANTHEMUM_AOTAN,
        SPECIAL_CARD_IDS.MAPLE_AOTAN,
      ],
      expected: [
        { id: "Akatan", points: 5, basePoints: 5, bonusPoints: 0 },
        { id: "Aotan", points: 5, basePoints: 5, bonusPoints: 0 },
        { id: "Tan", points: 2, basePoints: 1, bonusPoints: 1 },
      ],
    },
    {
      name: "Tan with 5 mixed ribbons (1 pt)",
      cards: [
        SPECIAL_CARD_IDS.PINE_AKATAN,
        SPECIAL_CARD_IDS.PLUM_AKATAN,
        SPECIAL_CARD_IDS.WISTERIA_TAN,
        SPECIAL_CARD_IDS.IRIS_TAN,
        SPECIAL_CARD_IDS.CLOVER_TAN,
      ],
      expected: [{ id: "Tan", points: 1, basePoints: 1, bonusPoints: 0 }],
    },
    {
      name: "Kasu with 10 regular chaff cards (1 pt)",
      cards: tenRegularKasu,
      expected: [{ id: "Kasu", points: 1, basePoints: 1, bonusPoints: 0 }],
    },
    {
      name: "Kasu with 9 regular chaff + Sake Cup dual rule (10 effective kasu = 1 pt)",
      cards: [...tenRegularKasu.slice(0, 9), SPECIAL_CARD_IDS.SAKE_CUP],
      expected: [{ id: "Kasu", points: 1, basePoints: 1, bonusPoints: 0 }],
    },
    {
      name: "Sake Cup dual rule simultaneously completes Tane (5 tane) and Kasu (9 kasu + Sake Cup)",
      cards: [
        ...tenRegularKasu.slice(0, 9),
        SPECIAL_CARD_IDS.SAKE_CUP,
        SPECIAL_CARD_IDS.WARBLER,
        SPECIAL_CARD_IDS.CUCKOO,
        SPECIAL_CARD_IDS.BRIDGE,
        SPECIAL_CARD_IDS.GEESE,
      ],
      expected: [
        { id: "Tane", points: 1, basePoints: 1, bonusPoints: 0 },
        { id: "Kasu", points: 1, basePoints: 1, bonusPoints: 0 },
      ],
    },
    {
      name: "Negative control: 9 regular chaff without Sake Cup does not score Kasu",
      cards: tenRegularKasu.slice(0, 9),
      expected: [],
    },
  ];

  for (const tc of cases) {
    const detected = detectYaku(tc.cards);
    assert.deepEqual(
      detected.map((y) => ({
        id: y.id,
        points: y.points,
        basePoints: y.basePoints,
        bonusPoints: y.bonusPoints,
      })),
      tc.expected,
      tc.name,
    );
  }
});

test("diffNewYaku and calculateRoundScore handle yaku upgrades, 7+ doubling, and opponent Koi-Koi reversal", () => {
  const sanko = detectYaku([
    SPECIAL_CARD_IDS.CRANE,
    SPECIAL_CARD_IDS.MOON,
    SPECIAL_CARD_IDS.PHOENIX,
  ]);
  const shiko = detectYaku([
    SPECIAL_CARD_IDS.CRANE,
    SPECIAL_CARD_IDS.CURTAIN,
    SPECIAL_CARD_IDS.MOON,
    SPECIAL_CARD_IDS.PHOENIX,
  ]);
  assert.equal(hasNewYaku(sanko, sanko), false);
  assert.equal(hasNewYaku(sanko, shiko), true);
  assert.deepEqual(
    diffNewYaku(sanko, shiko).map((y) => y.id),
    ["Shiko"],
  );

  // Point upgrade within same yaku (Tan 1 pt -> 2 pts) triggers diffNewYaku
  const tan5 = detectYaku([
    "01-tanzaku-akatan",
    "02-tanzaku-akatan",
    "04-tanzaku-plain",
    "05-tanzaku-plain",
    "07-tanzaku-plain",
  ]);
  const tan6 = detectYaku([
    "01-tanzaku-akatan",
    "02-tanzaku-akatan",
    "04-tanzaku-plain",
    "05-tanzaku-plain",
    "07-tanzaku-plain",
    "11-tanzaku-plain",
  ]);
  assert.equal(sumYakuPoints(tan5), 1);
  assert.equal(sumYakuPoints(tan6), 2);
  assert.equal(hasNewYaku(tan5, tan6), true);

  // Score multipliers: ×1 (<7, no opp koi-koi), ×2 (7+), ×2 (opp koi-koi), ×4 (both)
  assert.deepEqual(calculateRoundScore(sanko), {
    basePoints: 5,
    sevenPlusDoubled: false,
    opponentKoiKoiDoubled: false,
    multiplier: 1,
    finalPoints: 5,
  });
  assert.deepEqual(calculateRoundScore(sanko, { opponentCalledKoiKoi: true }), {
    basePoints: 5,
    sevenPlusDoubled: false,
    opponentKoiKoiDoubled: true,
    multiplier: 2,
    finalPoints: 10,
  });
  assert.deepEqual(calculateRoundScore(shiko), {
    basePoints: 8,
    sevenPlusDoubled: true,
    opponentKoiKoiDoubled: false,
    multiplier: 2,
    finalPoints: 16,
  });
  assert.deepEqual(calculateRoundScore(shiko, { opponentCalledKoiKoi: true }), {
    basePoints: 8,
    sevenPlusDoubled: true,
    opponentKoiKoiDoubled: true,
    multiplier: 4,
    finalPoints: 32,
  });
});

test("seeded PRNG, shuffleDeck, and initial deal checks (4-of-a-kind and 4-pairs)", () => {
  const rngA = mulberry32(42);
  const rngB = mulberry32(42);
  const rngC = mulberry32(43);

  const seqA = Array.from({ length: 10 }, () => rngA());
  const seqB = Array.from({ length: 10 }, () => rngB());
  const seqC = Array.from({ length: 10 }, () => rngC());
  assert.deepEqual(seqA, seqB);
  assert.notDeepEqual(seqA, seqC);

  const deckA = shuffleDeck(12345);
  const deckB = shuffleDeck(12345);
  assert.deepEqual(
    deckA.map((c) => c.id),
    deckB.map((c) => c.id),
  );
  assert.equal(new Set(deckA.map((c) => c.id)).size, 48);

  // 4-of-a-kind (Teshi) and 4-pairs (Kuttsuki) detection
  assert.equal(
    hasFourOfSameMonth(["01-hikari-crane", "01-tanzaku-akatan", "01-kasu-1", "01-kasu-2"]),
    true,
  );
  assert.equal(
    hasFourOfSameMonth(["01-hikari-crane", "01-tanzaku-akatan", "01-kasu-1", "02-kasu-1"]),
    false,
  );
  assert.equal(
    hasFourPairs([
      "01-hikari-crane",
      "01-kasu-1",
      "02-tane-warbler",
      "02-kasu-1",
      "03-hikari-curtain",
      "03-kasu-1",
      "04-tane-cuckoo",
      "04-kasu-1",
    ]),
    true,
  );
  assert.equal(
    hasFourPairs([
      "01-hikari-crane",
      "01-kasu-1",
      "02-tane-warbler",
      "02-kasu-1",
      "03-hikari-curtain",
      "03-kasu-1",
      "04-tane-cuckoo",
      "05-kasu-1",
    ]),
    false,
  );

  const match = createMatch({ seed: DEFAULT_SEED });
  assert.equal(match.totalRounds, DEFAULT_ROUNDS);
  assert.equal(match.hands.human.length, 8);
  assert.equal(match.hands.cpu.length, 8);
  assert.equal(match.field.length, 8);
  assert.equal(match.stock.length, 24);
  assert.equal(hasFourOfSameMonth(match.field), false);
  assert.equal(hasFourPairs(match.field), false);
});

test("hand-play and stock-draw matching cover 0, 1, 2 (choice), and 3 (sweep) field matches", () => {
  // 1. 0 matches on field + 1 match on stock draw
  const s0 = createCustomRoundState({
    hands: { human: ["01-hikari-crane", "05-kasu-1"], cpu: ["12-kasu-1", "12-kasu-2"] },
    field: ["02-tane-warbler"],
    stock: ["02-tanzaku-akatan"],
  });
  const afterHand0 = resolveHandPlay(s0, "01-hikari-crane");
  assert.equal(afterHand0.phase, "draw-stock");
  assert.equal(afterHand0.field.some((c) => c.id === "01-hikari-crane"), true);
  assert.equal(afterHand0.captured.human.length, 0);

  const afterDraw0 = resolveStockDraw(afterHand0);
  assert.equal(afterDraw0.phase, "play-hand");
  assert.equal(afterDraw0.activePlayer, "cpu");
  assert.deepEqual(
    afterDraw0.captured.human.map((c) => c.id),
    ["02-tanzaku-akatan", "02-tane-warbler"],
  );

  // 2. 2 matches on field during hand play -> "choose-hand-match" -> selectFieldMatch
  const s2 = createCustomRoundState({
    hands: { human: ["01-hikari-crane", "05-kasu-1"], cpu: ["12-kasu-1", "12-kasu-2"] },
    field: ["01-tanzaku-akatan", "01-kasu-1"],
    stock: ["06-kasu-1"],
  });
  assert.equal(getMatchingFieldCards(s2, "01-hikari-crane").length, 2);
  assert.equal(canCardMatchField("01-hikari-crane", "01-tanzaku-akatan"), true);
  assert.deepEqual(getPlayableHandMatches(s2)["05-kasu-1"], []);
  assert.deepEqual(getPlayableHandMatches(s2)["01-hikari-crane"], [
    "01-tanzaku-akatan",
    "01-kasu-1",
  ]);

  const pausedHand = playHandCard(s2, "01-hikari-crane");
  assert.equal(pausedHand.phase, "choose-hand-match");
  assert.equal(pausedHand.pendingMatchChoice?.stage, "hand");

  const resolvedHand = selectFieldMatch(pausedHand, "01-tanzaku-akatan");
  assert.equal(resolvedHand.phase, "play-hand");
  assert.deepEqual(
    resolvedHand.captured.human.map((c) => c.id),
    ["01-hikari-crane", "01-tanzaku-akatan"],
  );
  assert.equal(resolvedHand.field.some((c) => c.id === "01-kasu-1"), true);

  // 3. 2 matches on field during stock draw -> "choose-draw-match" -> selectFieldMatch
  const sDraw2 = createCustomRoundState({
    hands: { human: ["05-kasu-1", "05-kasu-2"], cpu: ["12-kasu-1", "12-kasu-2"] },
    field: ["03-hikari-curtain", "03-tanzaku-akatan"],
    stock: ["03-kasu-1"],
  });
  const pausedDraw = playHandCard(sDraw2, "05-kasu-1");
  assert.equal(pausedDraw.phase, "choose-draw-match");
  assert.equal(pausedDraw.pendingMatchChoice?.stage, "draw");

  const resolvedDraw = selectFieldMatch(pausedDraw, "03-hikari-curtain");
  assert.equal(resolvedDraw.phase, "play-hand");
  assert.deepEqual(
    resolvedDraw.captured.human.map((c) => c.id),
    ["03-kasu-1", "03-hikari-curtain"],
  );

  // 4. 3 matches on field (Hiki month sweep captures all 4 cards of that month)
  const s3 = createCustomRoundState({
    hands: { human: ["01-hikari-crane", "05-kasu-1"], cpu: ["12-kasu-1", "12-kasu-2"] },
    field: ["01-tanzaku-akatan", "01-kasu-1", "01-kasu-2"],
    stock: ["06-kasu-1"],
  });
  const swept = playHandCard(s3, "01-hikari-crane");
  assert.equal(swept.captured.human.length, 4);
  assert.equal(swept.field.filter((c) => c.month === 1).length, 0);
});

test("seeded 1-turn yaku triggers Koi-Koi prompt and handles Shobu, 7+ doubling, and opponent Koi-Koi reversal", () => {
  // Turn 1 Hanami-zake with HANAMI_ZAKE_SEED (53)
  const m1 = createMatch({ seed: HANAMI_ZAKE_SEED });
  const afterTurn1 = playHandCard(m1, SPECIAL_CARD_IDS.CURTAIN, SPECIAL_CARD_IDS.CHERRY_AKATAN);
  assert.equal(afterTurn1.phase, "koi-koi-decision");
  assert.ok(afterTurn1.pendingDecision);
  assert.deepEqual(
    afterTurn1.pendingDecision.newYaku.map((y) => y.id),
    ["Hanami-zake"],
  );
  assert.match(afterTurn1.announcement, /Hanami-zake \(5 pts\) — Koi-koi\?/);

  // Calling Shobu awards 5 points and ends Round 1
  const shobuState = decideKoiKoi(afterTurn1, "shobu");
  assert.equal(shobuState.phase, "round-over");
  assert.equal(shobuState.scores.human, 5);
  assert.equal(shobuState.roundHistory.length, 1);
  assert.equal(shobuState.roundHistory[0].winner, "human");
  assert.equal(shobuState.roundHistory[0].pointsAwarded, 5);

  // Turn 1 Tsukimi-zake with TSUKIMI_ZAKE_SEED (151)
  const m2 = createMatch({ seed: TSUKIMI_ZAKE_SEED });
  const afterTsukimi = playHandCard(
    m2,
    SPECIAL_CARD_IDS.CHRYSANTHEMUM_AOTAN,
    SPECIAL_CARD_IDS.SAKE_CUP,
  );
  assert.equal(afterTsukimi.phase, "koi-koi-decision");
  assert.deepEqual(
    afterTsukimi.pendingDecision?.newYaku.map((y) => y.id),
    ["Tsukimi-zake"],
  );

  // Test Koi-Koi call followed by opponent Koi-Koi reversal AND 7+ doubling (×4 total multiplier)
  const reversalStart = createCustomRoundState({
    hands: {
      human: ["03-hikari-curtain", "04-kasu-1"],
      cpu: ["12-hikari-phoenix", "05-kasu-1"],
    },
    field: ["03-kasu-1", "12-kasu-1"],
    stock: ["04-kasu-2", "05-kasu-2"],
    captured: {
      human: ["09-tane-sake-cup"],
      cpu: ["01-hikari-crane", "08-hikari-moon", "11-hikari-rain-man"],
    },
  });

  // Human completes Hanami-zake (5 pts) and calls "koi-koi"
  const humanYakuState = playHandCard(reversalStart, "03-hikari-curtain", "03-kasu-1");
  assert.equal(humanYakuState.phase, "koi-koi-decision");
  const afterHumanKoiKoi = decideKoiKoi(humanYakuState, "koi-koi");
  assert.equal(afterHumanKoiKoi.koiKoiCalled.human, true);
  assert.equal(afterHumanKoiKoi.koiKoiCalls.human, 1);
  assert.equal(afterHumanKoiKoi.activePlayer, "cpu");
  assert.equal(afterHumanKoiKoi.phase, "play-hand");

  // CPU turn: captures Phoenix to complete Ame-Shiko (7 base pts) while human called Koi-Koi -> ×4 = 28 pts!
  const afterCpuTurn = runCpuTurn(afterHumanKoiKoi);
  assert.equal(afterCpuTurn.phase, "round-over");
  assert.equal(afterCpuTurn.scores.cpu, 28);
  assert.equal(afterCpuTurn.scores.human, 0);
  const lastRound = afterCpuTurn.roundHistory[0];
  assert.equal(lastRound.winner, "cpu");
  assert.equal(lastRound.basePoints, 7);
  assert.equal(lastRound.sevenPlusDoubled, true);
  assert.equal(lastRound.opponentKoiKoiDoubled, true);
  assert.equal(lastRound.multiplier, 4);
  assert.equal(lastRound.pointsAwarded, 28);
});

test("greedy CPU policy prioritizes yaku/bright captures, calls Koi-Koi on safe low yaku, and finishes 3-round matches deterministically", () => {
  // 1. CPU prioritizes completing Hanami-zake over a kasu match
  const statePickYaku = createCustomRoundState({
    activePlayer: "cpu",
    hands: {
      human: ["04-kasu-1"],
      cpu: ["01-kasu-1", SPECIAL_CARD_IDS.SAKE_CUP],
    },
    field: ["01-kasu-2", "09-kasu-1"],
    stock: ["04-kasu-2"],
    captured: {
      cpu: [SPECIAL_CARD_IDS.CURTAIN],
    },
  });
  const choice = chooseCpuHandPlay(statePickYaku);
  assert.equal(choice.handCardId, SPECIAL_CARD_IDS.SAKE_CUP);
  assert.equal(choice.targetFieldCardId, "09-kasu-1");

  // 2. When 2 field cards match, CPU picks the higher-value capture
  const fieldChoice = chooseCpuFieldMatch(
    statePickYaku,
    requireCardById("03-kasu-1"),
    [requireCardById("03-kasu-2"), requireCardById(SPECIAL_CARD_IDS.CURTAIN)],
  );
  assert.equal(fieldChoice, SPECIAL_CARD_IDS.CURTAIN);

  // 3. CPU calls "koi-koi" on a 1-pt Kasu yaku early in the round when opponent has no threats
  const earlyLowYaku = createCustomRoundState({
    activePlayer: "cpu",
    phase: "koi-koi-decision",
    hands: {
      human: ["04-kasu-1", "04-kasu-2", "05-kasu-1", "05-kasu-2"],
      cpu: ["06-kasu-1", "06-kasu-2", "07-kasu-1", "07-kasu-2"],
    },
    captured: {
      cpu: [
        "01-kasu-1",
        "01-kasu-2",
        "02-kasu-1",
        "02-kasu-2",
        "03-kasu-1",
        "03-kasu-2",
        "08-kasu-1",
        "08-kasu-2",
        "09-kasu-1",
        "09-kasu-2",
      ],
    },
  });
  assert.equal(chooseCpuKoiKoiDecision(earlyLowYaku), "koi-koi");

  // 4. Simulate 20 full 3-round matches across seeds 1..20 and verify determinism & card conservation
  for (let seed = 1; seed <= 20; seed++) {
    const finishA = simulateMatch({ seed, totalRounds: 3 });
    const finishB = simulateMatch({ seed, totalRounds: 3 });
    assert.equal(finishA.phase, "match-over");
    assert.equal(finishA.round, 3);
    assert.equal(finishA.roundHistory.length, 3);
    assert.ok(
      finishA.matchWinner === "human" ||
        finishA.matchWinner === "cpu" ||
        finishA.matchWinner === "tie",
    );
    assert.deepEqual(finishA.scores, finishB.scores);
    assert.deepEqual(finishA.roundHistory, finishB.roundHistory);
  }

  // 5. Reducer dispatch and negative controls
  let rState = hanafudaReducer(createMatch({ seed: HANAMI_ZAKE_SEED }), {
    type: "PLAY_HAND_CARD",
    cardId: SPECIAL_CARD_IDS.CURTAIN,
    targetFieldCardId: SPECIAL_CARD_IDS.CHERRY_AKATAN,
  });
  assert.equal(rState.phase, "koi-koi-decision");
  rState = hanafudaReducer(rState, { type: "DECIDE_KOI_KOI", decision: "shobu" });
  assert.equal(rState.phase, "round-over");
  rState = hanafudaReducer(rState, { type: "NEXT_ROUND" });
  assert.equal(rState.round, 2);
  assert.equal(rState.phase, "play-hand");

  const roundDone = simulateRound(rState);
  assert.ok(roundDone.phase === "round-over" || roundDone.phase === "match-over");
  const steppedWhenDone = stepCpu(roundDone);
  assert.equal(steppedWhenDone, roundDone);

  assert.throws(() => playHandCard(rState, "nonexistent-card"), /not in/);
  assert.throws(() => decideKoiKoi(rState, "shobu"), /Cannot make a Koi-Koi decision/);
  assert.throws(() => advanceToNextRound(rState), /Cannot advance to next round/);
  assert.throws(() => drawStockCard(rState), /Cannot draw from stock/);
});
