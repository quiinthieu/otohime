// Pure Koi-Koi yaku detector and score calculator across all 12 standard yaku.
// Handles mutually exclusive Bright tiers (Goko, Shiko, Ame-Shiko, Sanko),
// Hanami-zake, Tsukimi-zake, Inoshikacho (+1 per extra tane), Akatan, Aotan,
// Tane (5+), Tan (5+), and Kasu (10+ including Sake Cup dual tane/kasu rule).

import {
  countsAsKasu,
  countsAsTane,
  resolveCard,
  SPECIAL_CARD_IDS,
  type CardId,
  type HanafudaCard,
} from "./deck.ts";

export const ALL_YAKU_IDS = [
  "Goko",
  "Shiko",
  "Ame-Shiko",
  "Sanko",
  "Hanami-zake",
  "Tsukimi-zake",
  "Inoshikacho",
  "Akatan",
  "Aotan",
  "Tane",
  "Tan",
  "Kasu",
] as const;

export type YakuId = (typeof ALL_YAKU_IDS)[number];

export type YakuMetadata = {
  id: YakuId;
  name: YakuId;
  japaneseName: string;
  reading: string;
  basePoints: number;
  description: string;
};

export const YAKU_DEFINITIONS: Readonly<Record<YakuId, YakuMetadata>> = {
  Goko: {
    id: "Goko",
    name: "Goko",
    japaneseName: "五光",
    reading: "Gokō",
    basePoints: 10,
    description: "All five Bright cards (Crane, Curtain, Moon, Rain Man, Phoenix).",
  },
  Shiko: {
    id: "Shiko",
    name: "Shiko",
    japaneseName: "四光",
    reading: "Shikō",
    basePoints: 8,
    description: "Four dry Bright cards (Crane, Curtain, Moon, Phoenix) without Rain Man.",
  },
  "Ame-Shiko": {
    id: "Ame-Shiko",
    name: "Ame-Shiko",
    japaneseName: "雨四光",
    reading: "Ame-Shikō",
    basePoints: 7,
    description: "Four Bright cards including Rain Man.",
  },
  Sanko: {
    id: "Sanko",
    name: "Sanko",
    japaneseName: "三光",
    reading: "Sankō",
    basePoints: 5,
    description: "Any three dry Bright cards without Rain Man.",
  },
  "Hanami-zake": {
    id: "Hanami-zake",
    name: "Hanami-zake",
    japaneseName: "花見酒",
    reading: "Hanami-zake",
    basePoints: 5,
    description: "Cherry Blossom Viewing: Camp Curtain with Chrysanthemum Sake Cup.",
  },
  "Tsukimi-zake": {
    id: "Tsukimi-zake",
    name: "Tsukimi-zake",
    japaneseName: "月見酒",
    reading: "Tsukimi-zake",
    basePoints: 5,
    description: "Moon Viewing: Full Moon with Chrysanthemum Sake Cup.",
  },
  Inoshikacho: {
    id: "Inoshikacho",
    name: "Inoshikacho",
    japaneseName: "猪鹿蝶",
    reading: "Inoshikachō",
    basePoints: 5,
    description: "Boar, Deer, and Butterflies (+1 point for each extra Tane card).",
  },
  Akatan: {
    id: "Akatan",
    name: "Akatan",
    japaneseName: "赤短",
    reading: "Akatan",
    basePoints: 5,
    description: "All three Red Poetry Ribbons (Pine, Plum, Cherry).",
  },
  Aotan: {
    id: "Aotan",
    name: "Aotan",
    japaneseName: "青短",
    reading: "Aotan",
    basePoints: 5,
    description: "All three Blue Ribbons (Peony, Chrysanthemum, Maple).",
  },
  Tane: {
    id: "Tane",
    name: "Tane",
    japaneseName: "タネ",
    reading: "Tane",
    basePoints: 1,
    description: "Five or more Tane (animal/object) cards (+1 point for each beyond five).",
  },
  Tan: {
    id: "Tan",
    name: "Tan",
    japaneseName: "短冊",
    reading: "Tan",
    basePoints: 1,
    description: "Five or more Tanzaku (ribbon) cards (+1 point for each beyond five).",
  },
  Kasu: {
    id: "Kasu",
    name: "Kasu",
    japaneseName: "カス",
    reading: "Kasu",
    basePoints: 1,
    description: "Ten or more Kasu (chaff) cards, with Sake Cup counting as Kasu (+1 point for each beyond ten).",
  },
};

export type DetectedYaku = {
  id: YakuId;
  name: YakuId;
  japaneseName: string;
  reading: string;
  description: string;
  basePoints: number;
  bonusPoints: number;
  points: number;
  cardIds: CardId[];
};

export type RoundScoreBreakdown = {
  basePoints: number;
  sevenPlusDoubled: boolean;
  opponentKoiKoiDoubled: boolean;
  multiplier: 1 | 2 | 4;
  finalPoints: number;
};

const INOSHIKACHO_CORE_IDS: readonly CardId[] = [
  SPECIAL_CARD_IDS.BOAR,
  SPECIAL_CARD_IDS.DEER,
  SPECIAL_CARD_IDS.BUTTERFLIES,
];

const AKATAN_IDS: readonly CardId[] = [
  SPECIAL_CARD_IDS.PINE_AKATAN,
  SPECIAL_CARD_IDS.PLUM_AKATAN,
  SPECIAL_CARD_IDS.CHERRY_AKATAN,
];

const AOTAN_IDS: readonly CardId[] = [
  SPECIAL_CARD_IDS.PEONY_AOTAN,
  SPECIAL_CARD_IDS.CHRYSANTHEMUM_AOTAN,
  SPECIAL_CARD_IDS.MAPLE_AOTAN,
];

function makeDetectedYaku(id: YakuId, bonusPoints: number, cardIds: readonly CardId[]): DetectedYaku {
  const def = YAKU_DEFINITIONS[id];
  return {
    id: def.id,
    name: def.name,
    japaneseName: def.japaneseName,
    reading: def.reading,
    description: def.description,
    basePoints: def.basePoints,
    bonusPoints,
    points: def.basePoints + bonusPoints,
    cardIds: [...cardIds],
  };
}

export function normalizeCapturedCards(captured: readonly (HanafudaCard | CardId | string)[]): HanafudaCard[] {
  const seen = new Set<CardId>();
  const out: HanafudaCard[] = [];
  for (const item of captured) {
    const card = resolveCard(item);
    if (!card || seen.has(card.id)) continue;
    seen.add(card.id);
    out.push(card);
  }
  return out;
}

export function detectYaku(captured: readonly (HanafudaCard | CardId | string)[]): DetectedYaku[] {
  const cards = normalizeCapturedCards(captured);
  const byId = new Set<CardId>(cards.map((c) => c.id));
  const results: DetectedYaku[] = [];

  // 1. Bright yaku (mutually exclusive: Goko > Shiko > Ame-Shiko > Sanko)
  const hikariCards = cards.filter((c) => c.category === "hikari");
  const dryHikariCards = hikariCards.filter((c) => !c.isRainMan);
  const hasRainMan = byId.has(SPECIAL_CARD_IDS.RAIN_MAN);

  if (hikariCards.length === 5) {
    results.push(makeDetectedYaku("Goko", 0, hikariCards.map((c) => c.id)));
  } else if (dryHikariCards.length === 4 && !hasRainMan) {
    results.push(makeDetectedYaku("Shiko", 0, dryHikariCards.map((c) => c.id)));
  } else if (hikariCards.length === 4 && hasRainMan && dryHikariCards.length === 3) {
    results.push(makeDetectedYaku("Ame-Shiko", 0, hikariCards.map((c) => c.id)));
  } else if (dryHikariCards.length === 3 && !hasRainMan) {
    results.push(makeDetectedYaku("Sanko", 0, dryHikariCards.map((c) => c.id)));
  }

  // 2. Hanami-zake (Cherry Curtain + Chrysanthemum Sake Cup)
  if (byId.has(SPECIAL_CARD_IDS.CURTAIN) && byId.has(SPECIAL_CARD_IDS.SAKE_CUP)) {
    results.push(
      makeDetectedYaku("Hanami-zake", 0, [SPECIAL_CARD_IDS.CURTAIN, SPECIAL_CARD_IDS.SAKE_CUP]),
    );
  }

  // 3. Tsukimi-zake (Susuki Full Moon + Chrysanthemum Sake Cup)
  if (byId.has(SPECIAL_CARD_IDS.MOON) && byId.has(SPECIAL_CARD_IDS.SAKE_CUP)) {
    results.push(
      makeDetectedYaku("Tsukimi-zake", 0, [SPECIAL_CARD_IDS.MOON, SPECIAL_CARD_IDS.SAKE_CUP]),
    );
  }

  // 4. Tane & Inoshikacho
  const taneCards = cards.filter((c) => countsAsTane(c));
  if (INOSHIKACHO_CORE_IDS.every((id) => byId.has(id))) {
    const extraTane = taneCards.filter((c) => !INOSHIKACHO_CORE_IDS.includes(c.id));
    results.push(
      makeDetectedYaku("Inoshikacho", extraTane.length, [
        ...INOSHIKACHO_CORE_IDS,
        ...extraTane.map((c) => c.id),
      ]),
    );
  }
  if (taneCards.length >= 5) {
    results.push(
      makeDetectedYaku(
        "Tane",
        taneCards.length - 5,
        taneCards.map((c) => c.id),
      ),
    );
  }

  // 5. Ribbons: Akatan, Aotan, Tan
  const tanzakuCards = cards.filter((c) => c.category === "tanzaku");
  if (AKATAN_IDS.every((id) => byId.has(id))) {
    results.push(makeDetectedYaku("Akatan", 0, AKATAN_IDS));
  }
  if (AOTAN_IDS.every((id) => byId.has(id))) {
    results.push(makeDetectedYaku("Aotan", 0, AOTAN_IDS));
  }
  if (tanzakuCards.length >= 5) {
    results.push(
      makeDetectedYaku(
        "Tan",
        tanzakuCards.length - 5,
        tanzakuCards.map((c) => c.id),
      ),
    );
  }

  // 6. Kasu (10+ chaff, with Sake Cup counting as both tane and kasu)
  const kasuCards = cards.filter((c) => countsAsKasu(c));
  if (kasuCards.length >= 10) {
    results.push(
      makeDetectedYaku(
        "Kasu",
        kasuCards.length - 10,
        kasuCards.map((c) => c.id),
      ),
    );
  }

  return results;
}

export function sumYakuPoints(yakuList: readonly DetectedYaku[]): number {
  let total = 0;
  for (const y of yakuList) {
    total += y.points;
  }
  return total;
}

export function diffNewYaku(
  previous: readonly DetectedYaku[],
  next: readonly DetectedYaku[],
): DetectedYaku[] {
  const prevPoints = new Map<YakuId, number>();
  for (const y of previous) {
    prevPoints.set(y.id, y.points);
  }
  return next.filter((y) => {
    const oldPts = prevPoints.get(y.id);
    return oldPts === undefined || y.points > oldPts;
  });
}

export function hasNewYaku(
  previous: readonly DetectedYaku[],
  next: readonly DetectedYaku[],
): boolean {
  return diffNewYaku(previous, next).length > 0;
}

export function calculateRoundScore(
  yakuList: readonly DetectedYaku[],
  options: { opponentCalledKoiKoi?: boolean } = {},
): RoundScoreBreakdown {
  const basePoints = sumYakuPoints(yakuList);
  if (basePoints <= 0) {
    return {
      basePoints: 0,
      sevenPlusDoubled: false,
      opponentKoiKoiDoubled: false,
      multiplier: 1,
      finalPoints: 0,
    };
  }
  const sevenPlusDoubled = basePoints >= 7;
  const opponentKoiKoiDoubled = options.opponentCalledKoiKoi === true;
  const multiplier = ((sevenPlusDoubled ? 2 : 1) * (opponentKoiKoiDoubled ? 2 : 1)) as 1 | 2 | 4;
  return {
    basePoints,
    sevenPlusDoubled,
    opponentKoiKoiDoubled,
    multiplier,
    finalPoints: basePoints * multiplier,
  };
}
