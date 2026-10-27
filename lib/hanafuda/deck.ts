// 48-card traditional Hanafuda deck across all 12 monthly flower suits (01..12).
// Pure data and lookup helpers: no DOM, no filesystem, no network.

import { MONTH_KEYS, MONTHLY_FLOWERS, monthKeyOf, type MonthKey } from "../yearly-log.ts";

export type MonthNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;

export type CardCategory = "hikari" | "tane" | "tanzaku" | "kasu";

export type RibbonType = "akatan" | "aotan" | "plain";

export type PlantMotifKind =
  | "pine"
  | "plum"
  | "cherry"
  | "wisteria"
  | "iris"
  | "peony"
  | "bush-clover"
  | "susuki"
  | "chrysanthemum"
  | "maple"
  | "willow"
  | "paulownia";

export type AccentMotifKind =
  | "crane-sun"
  | "curtain"
  | "full-moon"
  | "rain-man"
  | "phoenix"
  | "warbler"
  | "cuckoo"
  | "bridge"
  | "butterflies"
  | "boar"
  | "geese"
  | "sake-cup"
  | "deer"
  | "swallow"
  | "akatan"
  | "aotan"
  | "plain-ribbon"
  | "lightning"
  | "chaff";

export type MotifPalette = {
  primary: string;
  secondary: string;
  wash: string;
  ink: string;
};

export type HanafudaMotif = {
  basePlant: PlantMotifKind;
  accent: AccentMotifKind;
  variant: 1 | 2 | 3 | 4;
  stampLabel: "光" | "種" | "短" | "粕";
  inscription?: string;
  palette: MotifPalette;
  paths: readonly string[];
};

export const SPECIAL_CARD_IDS = {
  CRANE: "01-hikari-crane",
  PINE_AKATAN: "01-tanzaku-akatan",
  WARBLER: "02-tane-warbler",
  PLUM_AKATAN: "02-tanzaku-akatan",
  CURTAIN: "03-hikari-curtain",
  CHERRY_AKATAN: "03-tanzaku-akatan",
  CUCKOO: "04-tane-cuckoo",
  WISTERIA_TAN: "04-tanzaku-plain",
  BRIDGE: "05-tane-bridge",
  IRIS_TAN: "05-tanzaku-plain",
  BUTTERFLIES: "06-tane-butterflies",
  PEONY_AOTAN: "06-tanzaku-aotan",
  BOAR: "07-tane-boar",
  CLOVER_TAN: "07-tanzaku-plain",
  MOON: "08-hikari-moon",
  GEESE: "08-tane-geese",
  SAKE_CUP: "09-tane-sake-cup",
  CHRYSANTHEMUM_AOTAN: "09-tanzaku-aotan",
  DEER: "10-tane-deer",
  MAPLE_AOTAN: "10-tanzaku-aotan",
  RAIN_MAN: "11-hikari-rain-man",
  SWALLOW: "11-tane-swallow",
  WILLOW_TAN: "11-tanzaku-plain",
  LIGHTNING: "11-kasu-lightning",
  PHOENIX: "12-hikari-phoenix",
} as const;

export const CARD_IDS = [
  "01-hikari-crane",
  "01-tanzaku-akatan",
  "01-kasu-1",
  "01-kasu-2",
  "02-tane-warbler",
  "02-tanzaku-akatan",
  "02-kasu-1",
  "02-kasu-2",
  "03-hikari-curtain",
  "03-tanzaku-akatan",
  "03-kasu-1",
  "03-kasu-2",
  "04-tane-cuckoo",
  "04-tanzaku-plain",
  "04-kasu-1",
  "04-kasu-2",
  "05-tane-bridge",
  "05-tanzaku-plain",
  "05-kasu-1",
  "05-kasu-2",
  "06-tane-butterflies",
  "06-tanzaku-aotan",
  "06-kasu-1",
  "06-kasu-2",
  "07-tane-boar",
  "07-tanzaku-plain",
  "07-kasu-1",
  "07-kasu-2",
  "08-hikari-moon",
  "08-tane-geese",
  "08-kasu-1",
  "08-kasu-2",
  "09-tane-sake-cup",
  "09-tanzaku-aotan",
  "09-kasu-1",
  "09-kasu-2",
  "10-tane-deer",
  "10-tanzaku-aotan",
  "10-kasu-1",
  "10-kasu-2",
  "11-hikari-rain-man",
  "11-tane-swallow",
  "11-tanzaku-plain",
  "11-kasu-lightning",
  "12-hikari-phoenix",
  "12-kasu-1",
  "12-kasu-2",
  "12-kasu-3",
] as const;

export type CardId = (typeof CARD_IDS)[number];

export type HanafudaCard = {
  id: CardId;
  month: MonthNumber;
  monthKey: MonthKey;
  flower: string;
  japaneseMonthName: string;
  kanji: string;
  name: string;
  japaneseName: string;
  category: CardCategory;
  ribbonType: RibbonType | null;
  points: 20 | 10 | 5 | 1;
  isRainMan: boolean;
  dualKasu: boolean;
  motif: HanafudaMotif;
};

export type SuitMetadata = {
  month: MonthNumber;
  monthKey: MonthKey;
  flower: string;
  japaneseMonthName: string;
  kanji: string;
  basePlant: PlantMotifKind;
  palette: MotifPalette;
  basePlantPaths: readonly string[];
};

export const SUIT_METADATA: Record<MonthKey, SuitMetadata> = {
  "01": {
    month: 1,
    monthKey: "01",
    flower: MONTHLY_FLOWERS["01"],
    japaneseMonthName: "Matsu",
    kanji: "松",
    basePlant: "pine",
    palette: { primary: "#234d36", secondary: "#b8332a", wash: "#f4ede1", ink: "#1b1917" },
    basePlantPaths: [
      "M12 84 C20 66, 36 58, 52 72",
      "M18 68 L8 50 M18 68 L22 46 M18 68 L32 54",
      "M38 64 L30 44 M38 64 L44 42 M38 64 L54 52",
    ],
  },
  "02": {
    month: 2,
    monthKey: "02",
    flower: MONTHLY_FLOWERS["02"],
    japaneseMonthName: "Ume",
    kanji: "梅",
    basePlant: "plum",
    palette: { primary: "#a83242", secondary: "#3b5238", wash: "#f6ece8", ink: "#1b1917" },
    basePlantPaths: [
      "M10 82 C24 64, 34 46, 54 34",
      "M26 56 A6 6 0 1 0 26.1 56 Z",
      "M42 42 A5 5 0 1 0 42.1 42 Z",
    ],
  },
  "03": {
    month: 3,
    monthKey: "03",
    flower: MONTHLY_FLOWERS["03"],
    japaneseMonthName: "Sakura",
    kanji: "桜",
    basePlant: "cherry",
    palette: { primary: "#cf5c6c", secondary: "#8c2d38", wash: "#f9eef0", ink: "#1b1917" },
    basePlantPaths: [
      "M8 28 C26 32, 42 24, 56 36",
      "M22 28 C18 20, 26 16, 28 24 C34 18, 38 26, 30 30 Z",
      "M42 32 C38 24, 46 20, 48 28 C54 22, 58 30, 50 34 Z",
    ],
  },
  "04": {
    month: 4,
    monthKey: "04",
    flower: MONTHLY_FLOWERS["04"],
    japaneseMonthName: "Fuji",
    kanji: "藤",
    basePlant: "wisteria",
    palette: { primary: "#5b4882", secondary: "#b8332a", wash: "#f1edf7", ink: "#1b1917" },
    basePlantPaths: [
      "M16 10 C18 32, 14 54, 18 74",
      "M32 8 C34 30, 30 50, 34 70",
      "M46 12 C48 28, 44 46, 48 62",
    ],
  },
  "05": {
    month: 5,
    monthKey: "05",
    flower: MONTHLY_FLOWERS["05"],
    japaneseMonthName: "Ayame",
    kanji: "菖蒲",
    basePlant: "iris",
    palette: { primary: "#394878", secondary: "#2d5a42", wash: "#ebf0f5", ink: "#1b1917" },
    basePlantPaths: [
      "M20 88 L24 38",
      "M34 88 L32 34",
      "M24 38 C16 30, 22 20, 28 30 C34 20, 40 30, 32 38 Z",
    ],
  },
  "06": {
    month: 6,
    monthKey: "06",
    flower: MONTHLY_FLOWERS["06"],
    japaneseMonthName: "Botan",
    kanji: "牡丹",
    basePlant: "peony",
    palette: { primary: "#b52f3c", secondary: "#2c4c7e", wash: "#f7ece9", ink: "#1b1917" },
    basePlantPaths: [
      "M32 62 C18 62, 14 46, 26 40 C22 30, 42 30, 38 40 C50 46, 46 62, 32 62 Z",
      "M16 78 C24 70, 40 70, 48 78",
    ],
  },
  "07": {
    month: 7,
    monthKey: "07",
    flower: MONTHLY_FLOWERS["07"],
    japaneseMonthName: "Hagi",
    kanji: "萩",
    basePlant: "bush-clover",
    palette: { primary: "#9c354d", secondary: "#3b5c3e", wash: "#f5eee6", ink: "#1b1917" },
    basePlantPaths: [
      "M14 84 C18 56, 30 34, 48 20",
      "M24 84 C30 60, 40 42, 54 30",
      "M30 46 A3 2 0 1 0 30.1 46 M38 36 A3 2 0 1 0 38.1 36",
    ],
  },
  "08": {
    month: 8,
    monthKey: "08",
    flower: MONTHLY_FLOWERS["08"],
    japaneseMonthName: "Susuki",
    kanji: "芒",
    basePlant: "susuki",
    palette: { primary: "#8f6128", secondary: "#b8332a", wash: "#f6efe2", ink: "#1b1917" },
    basePlantPaths: [
      "M6 88 C20 66, 44 66, 58 88 Z",
      "M20 76 C24 54, 16 36, 10 24",
      "M34 74 C38 52, 46 36, 54 24",
    ],
  },
  "09": {
    month: 9,
    monthKey: "09",
    flower: MONTHLY_FLOWERS["09"],
    japaneseMonthName: "Kiku",
    kanji: "菊",
    basePlant: "chrysanthemum",
    palette: { primary: "#c48a22", secondary: "#2c4c7e", wash: "#f7f1e3", ink: "#1b1917" },
    basePlantPaths: [
      "M28 58 A10 10 0 1 0 28.1 58 Z",
      "M28 42 L28 74 M12 58 L44 58 M17 47 L39 69 M39 47 L17 69",
    ],
  },
  "10": {
    month: 10,
    monthKey: "10",
    flower: MONTHLY_FLOWERS["10"],
    japaneseMonthName: "Momiji",
    kanji: "紅葉",
    basePlant: "maple",
    palette: { primary: "#b83b24", secondary: "#2c4c7e", wash: "#f7ebe4", ink: "#1b1917" },
    basePlantPaths: [
      "M10 22 C26 28, 38 40, 52 54",
      "M24 28 L18 18 L26 22 L30 14 L32 24 L40 20 L34 30 Z",
      "M40 42 L34 32 L42 36 L46 28 L48 38 L56 34 L50 44 Z",
    ],
  },
  "11": {
    month: 11,
    monthKey: "11",
    flower: MONTHLY_FLOWERS["11"],
    japaneseMonthName: "Yanagi",
    kanji: "柳",
    basePlant: "willow",
    palette: { primary: "#2f5742", secondary: "#b8332a", wash: "#ecefe8", ink: "#1b1917" },
    basePlantPaths: [
      "M16 8 C12 34, 14 58, 10 82",
      "M30 8 C28 36, 26 60, 24 84",
      "M44 10 C42 34, 40 56, 38 78",
    ],
  },
  "12": {
    month: 12,
    monthKey: "12",
    flower: MONTHLY_FLOWERS["12"],
    japaneseMonthName: "Kiri",
    kanji: "桐",
    basePlant: "paulownia",
    palette: { primary: "#5a3d7a", secondary: "#c49228", wash: "#f3eef7", ink: "#1b1917" },
    basePlantPaths: [
      "M32 82 L32 44 M20 82 L20 52 M44 82 L44 52",
      "M14 78 C20 66, 44 66, 50 78 Z",
    ],
  },
};

const ACCENT_PATHS: Record<AccentMotifKind, readonly string[]> = {
  "crane-sun": [
    "M44 22 A10 10 0 1 0 44.1 22 Z",
    "M20 74 C22 58, 34 52, 42 64 C36 72, 26 76, 20 74 Z",
    "M28 56 L24 40 L32 42",
  ],
  curtain: [
    "M8 54 C16 62, 24 54, 32 62 C40 54, 48 62, 56 54 L56 86 L8 86 Z",
    "M20 56 L20 86 M32 60 L32 86 M44 56 L44 86",
  ],
  "full-moon": [
    "M24 26 A12 12 0 1 0 24.1 26 Z",
  ],
  "rain-man": [
    "M38 46 C30 38, 48 34, 52 44 Z",
    "M34 52 L34 78 C38 82, 46 82, 48 76 L46 52 Z",
    "M12 16 L8 32 M26 18 L22 34",
  ],
  phoenix: [
    "M18 36 C28 20, 44 20, 52 38 C42 46, 26 46, 18 36 Z",
    "M12 26 C20 14, 32 18, 34 28",
    "M34 42 C40 56, 48 64, 56 70",
  ],
  warbler: [
    "M28 48 C34 40, 46 42, 48 50 C40 54, 32 54, 28 48 Z",
    "M48 46 L54 44",
  ],
  cuckoo: [
    "M18 34 C28 24, 42 26, 48 36 C36 38, 26 40, 18 34 Z",
    "M44 18 A8 8 0 0 1 54 28",
  ],
  bridge: [
    "M8 62 L40 48 L56 56 L24 70 Z",
    "M18 66 L18 82 M38 56 L38 72",
  ],
  butterflies: [
    "M18 26 C12 18, 24 14, 24 24 C30 16, 36 24, 26 28 Z",
    "M40 34 C34 26, 46 22, 46 32 C52 24, 58 32, 48 36 Z",
  ],
  boar: [
    "M14 68 C22 54, 42 54, 50 68 L46 78 L18 78 Z",
    "M50 66 L56 64",
  ],
  geese: [
    "M16 22 C22 16, 28 16, 34 22",
    "M28 30 C34 24, 40 24, 46 30",
    "M38 38 C44 32, 50 32, 56 38",
  ],
  "sake-cup": [
    "M26 26 C26 18, 50 18, 50 26 C50 34, 26 34, 26 26 Z",
    "M34 33 L42 33 L44 38 L32 38 Z",
  ],
  deer: [
    "M20 78 L24 54 L42 52 L46 78 M38 52 L42 34",
    "M42 34 L36 24 M42 34 L48 22 M45 28 L52 28",
  ],
  swallow: [
    "M20 56 C30 48, 42 50, 50 60 L36 58 L28 66 Z",
  ],
  akatan: [
    "M18 16 L32 12 L36 68 L22 72 Z",
    "M23 26 L31 24 M24 38 L32 36 M25 50 L33 48",
  ],
  aotan: [
    "M18 16 L32 12 L36 68 L22 72 Z",
    "M22 24 L32 22 M24 44 L34 42",
  ],
  "plain-ribbon": [
    "M18 16 L32 12 L36 68 L22 72 Z",
  ],
  lightning: [
    "M38 14 L24 38 L36 40 L20 70",
    "M14 66 C22 58, 42 58, 50 70",
  ],
  chaff: [
    "M16 76 C26 70, 38 70, 48 76",
  ],
};

const POINTS_BY_CATEGORY: Record<CardCategory, 20 | 10 | 5 | 1> = {
  hikari: 20,
  tane: 10,
  tanzaku: 5,
  kasu: 1,
};

const STAMP_BY_CATEGORY: Record<CardCategory, "光" | "種" | "短" | "粕"> = {
  hikari: "光",
  tane: "種",
  tanzaku: "短",
  kasu: "粕",
};

type RawCardSpec = {
  id: CardId;
  monthKey: MonthKey;
  variant: 1 | 2 | 3 | 4;
  name: string;
  japaneseName: string;
  category: CardCategory;
  ribbonType?: RibbonType;
  accent: AccentMotifKind;
  inscription?: string;
  isRainMan?: boolean;
  dualKasu?: boolean;
};

const RAW_CARDS: readonly RawCardSpec[] = [
  // Month 1 — Pine (Matsu)
  {
    id: "01-hikari-crane",
    monthKey: "01",
    variant: 1,
    name: "Pine with Crane",
    japaneseName: "松に鶴",
    category: "hikari",
    accent: "crane-sun",
  },
  {
    id: "01-tanzaku-akatan",
    monthKey: "01",
    variant: 2,
    name: "Pine with Poetry Ribbon",
    japaneseName: "松に赤短",
    category: "tanzaku",
    ribbonType: "akatan",
    accent: "akatan",
    inscription: "あかよろし",
  },
  {
    id: "01-kasu-1",
    monthKey: "01",
    variant: 3,
    name: "Pine Chaff I",
    japaneseName: "松のカス一",
    category: "kasu",
    accent: "chaff",
  },
  {
    id: "01-kasu-2",
    monthKey: "01",
    variant: 4,
    name: "Pine Chaff II",
    japaneseName: "松のカス二",
    category: "kasu",
    accent: "chaff",
  },

  // Month 2 — Plum (Ume)
  {
    id: "02-tane-warbler",
    monthKey: "02",
    variant: 1,
    name: "Plum with Bush Warbler",
    japaneseName: "梅に鴬",
    category: "tane",
    accent: "warbler",
  },
  {
    id: "02-tanzaku-akatan",
    monthKey: "02",
    variant: 2,
    name: "Plum with Poetry Ribbon",
    japaneseName: "梅に赤短",
    category: "tanzaku",
    ribbonType: "akatan",
    accent: "akatan",
    inscription: "あかよろし",
  },
  {
    id: "02-kasu-1",
    monthKey: "02",
    variant: 3,
    name: "Plum Chaff I",
    japaneseName: "梅のカス一",
    category: "kasu",
    accent: "chaff",
  },
  {
    id: "02-kasu-2",
    monthKey: "02",
    variant: 4,
    name: "Plum Chaff II",
    japaneseName: "梅のカス二",
    category: "kasu",
    accent: "chaff",
  },

  // Month 3 — Cherry (Sakura)
  {
    id: "03-hikari-curtain",
    monthKey: "03",
    variant: 1,
    name: "Cherry with Camp Curtain",
    japaneseName: "桜に幕",
    category: "hikari",
    accent: "curtain",
  },
  {
    id: "03-tanzaku-akatan",
    monthKey: "03",
    variant: 2,
    name: "Cherry with Poetry Ribbon",
    japaneseName: "桜に赤短",
    category: "tanzaku",
    ribbonType: "akatan",
    accent: "akatan",
    inscription: "みよしの",
  },
  {
    id: "03-kasu-1",
    monthKey: "03",
    variant: 3,
    name: "Cherry Chaff I",
    japaneseName: "桜のカス一",
    category: "kasu",
    accent: "chaff",
  },
  {
    id: "03-kasu-2",
    monthKey: "03",
    variant: 4,
    name: "Cherry Chaff II",
    japaneseName: "桜のカス二",
    category: "kasu",
    accent: "chaff",
  },

  // Month 4 — Wisteria (Fuji)
  {
    id: "04-tane-cuckoo",
    monthKey: "04",
    variant: 1,
    name: "Wisteria with Cuckoo",
    japaneseName: "藤に不如帰",
    category: "tane",
    accent: "cuckoo",
  },
  {
    id: "04-tanzaku-plain",
    monthKey: "04",
    variant: 2,
    name: "Wisteria with Red Ribbon",
    japaneseName: "藤に短冊",
    category: "tanzaku",
    ribbonType: "plain",
    accent: "plain-ribbon",
  },
  {
    id: "04-kasu-1",
    monthKey: "04",
    variant: 3,
    name: "Wisteria Chaff I",
    japaneseName: "藤のカス一",
    category: "kasu",
    accent: "chaff",
  },
  {
    id: "04-kasu-2",
    monthKey: "04",
    variant: 4,
    name: "Wisteria Chaff II",
    japaneseName: "藤のカス二",
    category: "kasu",
    accent: "chaff",
  },

  // Month 5 — Iris (Ayame)
  {
    id: "05-tane-bridge",
    monthKey: "05",
    variant: 1,
    name: "Iris with Eight-Plank Bridge",
    japaneseName: "菖蒲に八橋",
    category: "tane",
    accent: "bridge",
  },
  {
    id: "05-tanzaku-plain",
    monthKey: "05",
    variant: 2,
    name: "Iris with Red Ribbon",
    japaneseName: "菖蒲に短冊",
    category: "tanzaku",
    ribbonType: "plain",
    accent: "plain-ribbon",
  },
  {
    id: "05-kasu-1",
    monthKey: "05",
    variant: 3,
    name: "Iris Chaff I",
    japaneseName: "菖蒲のカス一",
    category: "kasu",
    accent: "chaff",
  },
  {
    id: "05-kasu-2",
    monthKey: "05",
    variant: 4,
    name: "Iris Chaff II",
    japaneseName: "菖蒲のカス二",
    category: "kasu",
    accent: "chaff",
  },

  // Month 6 — Peony (Botan)
  {
    id: "06-tane-butterflies",
    monthKey: "06",
    variant: 1,
    name: "Peony with Butterflies",
    japaneseName: "牡丹に蝶",
    category: "tane",
    accent: "butterflies",
  },
  {
    id: "06-tanzaku-aotan",
    monthKey: "06",
    variant: 2,
    name: "Peony with Blue Ribbon",
    japaneseName: "牡丹に青短",
    category: "tanzaku",
    ribbonType: "aotan",
    accent: "aotan",
  },
  {
    id: "06-kasu-1",
    monthKey: "06",
    variant: 3,
    name: "Peony Chaff I",
    japaneseName: "牡丹のカス一",
    category: "kasu",
    accent: "chaff",
  },
  {
    id: "06-kasu-2",
    monthKey: "06",
    variant: 4,
    name: "Peony Chaff II",
    japaneseName: "牡丹のカス二",
    category: "kasu",
    accent: "chaff",
  },

  // Month 7 — Bush Clover (Hagi)
  {
    id: "07-tane-boar",
    monthKey: "07",
    variant: 1,
    name: "Bush Clover with Boar",
    japaneseName: "萩に猪",
    category: "tane",
    accent: "boar",
  },
  {
    id: "07-tanzaku-plain",
    monthKey: "07",
    variant: 2,
    name: "Bush Clover with Red Ribbon",
    japaneseName: "萩に短冊",
    category: "tanzaku",
    ribbonType: "plain",
    accent: "plain-ribbon",
  },
  {
    id: "07-kasu-1",
    monthKey: "07",
    variant: 3,
    name: "Bush Clover Chaff I",
    japaneseName: "萩のカス一",
    category: "kasu",
    accent: "chaff",
  },
  {
    id: "07-kasu-2",
    monthKey: "07",
    variant: 4,
    name: "Bush Clover Chaff II",
    japaneseName: "萩のカス二",
    category: "kasu",
    accent: "chaff",
  },

  // Month 8 — Susuki Grass (Susuki)
  {
    id: "08-hikari-moon",
    monthKey: "08",
    variant: 1,
    name: "Susuki Grass with Full Moon",
    japaneseName: "芒に月",
    category: "hikari",
    accent: "full-moon",
  },
  {
    id: "08-tane-geese",
    monthKey: "08",
    variant: 2,
    name: "Susuki Grass with Geese",
    japaneseName: "芒に雁",
    category: "tane",
    accent: "geese",
  },
  {
    id: "08-kasu-1",
    monthKey: "08",
    variant: 3,
    name: "Susuki Grass Chaff I",
    japaneseName: "芒のカス一",
    category: "kasu",
    accent: "chaff",
  },
  {
    id: "08-kasu-2",
    monthKey: "08",
    variant: 4,
    name: "Susuki Grass Chaff II",
    japaneseName: "芒のカス二",
    category: "kasu",
    accent: "chaff",
  },

  // Month 9 — Chrysanthemum (Kiku)
  {
    id: "09-tane-sake-cup",
    monthKey: "09",
    variant: 1,
    name: "Chrysanthemum with Sake Cup",
    japaneseName: "菊に盃",
    category: "tane",
    accent: "sake-cup",
    inscription: "寿",
    dualKasu: true,
  },
  {
    id: "09-tanzaku-aotan",
    monthKey: "09",
    variant: 2,
    name: "Chrysanthemum with Blue Ribbon",
    japaneseName: "菊に青短",
    category: "tanzaku",
    ribbonType: "aotan",
    accent: "aotan",
  },
  {
    id: "09-kasu-1",
    monthKey: "09",
    variant: 3,
    name: "Chrysanthemum Chaff I",
    japaneseName: "菊のカス一",
    category: "kasu",
    accent: "chaff",
  },
  {
    id: "09-kasu-2",
    monthKey: "09",
    variant: 4,
    name: "Chrysanthemum Chaff II",
    japaneseName: "菊のカス二",
    category: "kasu",
    accent: "chaff",
  },

  // Month 10 — Maple (Momiji)
  {
    id: "10-tane-deer",
    monthKey: "10",
    variant: 1,
    name: "Maple with Deer",
    japaneseName: "紅葉に鹿",
    category: "tane",
    accent: "deer",
  },
  {
    id: "10-tanzaku-aotan",
    monthKey: "10",
    variant: 2,
    name: "Maple with Blue Ribbon",
    japaneseName: "紅葉に青短",
    category: "tanzaku",
    ribbonType: "aotan",
    accent: "aotan",
  },
  {
    id: "10-kasu-1",
    monthKey: "10",
    variant: 3,
    name: "Maple Chaff I",
    japaneseName: "紅葉のカス一",
    category: "kasu",
    accent: "chaff",
  },
  {
    id: "10-kasu-2",
    monthKey: "10",
    variant: 4,
    name: "Maple Chaff II",
    japaneseName: "紅葉のカス二",
    category: "kasu",
    accent: "chaff",
  },

  // Month 11 — Willow (Yanagi)
  {
    id: "11-hikari-rain-man",
    monthKey: "11",
    variant: 1,
    name: "Willow with Rain Man",
    japaneseName: "柳に小野道風",
    category: "hikari",
    accent: "rain-man",
    isRainMan: true,
  },
  {
    id: "11-tane-swallow",
    monthKey: "11",
    variant: 2,
    name: "Willow with Swallow",
    japaneseName: "柳に燕",
    category: "tane",
    accent: "swallow",
  },
  {
    id: "11-tanzaku-plain",
    monthKey: "11",
    variant: 3,
    name: "Willow with Red Ribbon",
    japaneseName: "柳に短冊",
    category: "tanzaku",
    ribbonType: "plain",
    accent: "plain-ribbon",
  },
  {
    id: "11-kasu-lightning",
    monthKey: "11",
    variant: 4,
    name: "Willow with Lightning",
    japaneseName: "柳に稲妻",
    category: "kasu",
    accent: "lightning",
  },

  // Month 12 — Paulownia (Kiri)
  {
    id: "12-hikari-phoenix",
    monthKey: "12",
    variant: 1,
    name: "Paulownia with Phoenix",
    japaneseName: "桐に鳳凰",
    category: "hikari",
    accent: "phoenix",
  },
  {
    id: "12-kasu-1",
    monthKey: "12",
    variant: 2,
    name: "Paulownia Chaff I",
    japaneseName: "桐のカス一",
    category: "kasu",
    accent: "chaff",
  },
  {
    id: "12-kasu-2",
    monthKey: "12",
    variant: 3,
    name: "Paulownia Chaff II",
    japaneseName: "桐のカス二",
    category: "kasu",
    accent: "chaff",
  },
  {
    id: "12-kasu-3",
    monthKey: "12",
    variant: 4,
    name: "Paulownia Gold Chaff",
    japaneseName: "桐の色カス",
    category: "kasu",
    accent: "chaff",
  },
];

export const HANAFUDA_DECK: readonly HanafudaCard[] = Object.freeze(
  RAW_CARDS.map((spec): HanafudaCard => {
    const suit = SUIT_METADATA[spec.monthKey];
    const motif: HanafudaMotif = {
      basePlant: suit.basePlant,
      accent: spec.accent,
      variant: spec.variant,
      stampLabel: STAMP_BY_CATEGORY[spec.category],
      ...(spec.inscription ? { inscription: spec.inscription } : {}),
      palette: suit.palette,
      paths: Object.freeze([...suit.basePlantPaths, ...ACCENT_PATHS[spec.accent]]),
    };
    return Object.freeze({
      id: spec.id,
      month: suit.month,
      monthKey: suit.monthKey,
      flower: suit.flower,
      japaneseMonthName: suit.japaneseMonthName,
      kanji: suit.kanji,
      name: spec.name,
      japaneseName: spec.japaneseName,
      category: spec.category,
      ribbonType: spec.ribbonType ?? null,
      points: POINTS_BY_CATEGORY[spec.category],
      isRainMan: spec.isRainMan === true,
      dualKasu: spec.dualKasu === true,
      motif: Object.freeze(motif),
    });
  }),
);

export const CARD_BY_ID: ReadonlyMap<string, HanafudaCard> = new Map(
  HANAFUDA_DECK.map((card) => [card.id, card]),
);

const CARDS_BY_MONTH: ReadonlyMap<MonthKey, readonly HanafudaCard[]> = new Map(
  MONTH_KEYS.map((key) => [key, Object.freeze(HANAFUDA_DECK.filter((c) => c.monthKey === key))]),
);

const CARDS_BY_CATEGORY: ReadonlyMap<CardCategory, readonly HanafudaCard[]> = new Map(
  (["hikari", "tane", "tanzaku", "kasu"] as const).map((cat) => [
    cat,
    Object.freeze(HANAFUDA_DECK.filter((c) => c.category === cat)),
  ]),
);

export function getCardById(id: string): HanafudaCard | null {
  return CARD_BY_ID.get(id) ?? null;
}

export function requireCardById(id: string): HanafudaCard {
  const card = CARD_BY_ID.get(id);
  if (!card) {
    throw new Error(`Unknown Hanafuda card id: ${id}`);
  }
  return card;
}

export function resolveCard(cardOrId: HanafudaCard | CardId | string): HanafudaCard | null {
  if (typeof cardOrId === "string") {
    return getCardById(cardOrId);
  }
  if (cardOrId && typeof cardOrId === "object" && typeof cardOrId.id === "string") {
    return CARD_BY_ID.get(cardOrId.id) ?? null;
  }
  return null;
}

export function getCardsByMonth(monthOrDate: number | string): readonly HanafudaCard[] {
  const key = monthKeyOf(monthOrDate);
  return key ? (CARDS_BY_MONTH.get(key) ?? []) : [];
}

export function getCardsByCategory(category: CardCategory): readonly HanafudaCard[] {
  return CARDS_BY_CATEGORY.get(category) ?? [];
}

export function isSameMonth(a: HanafudaCard | CardId | string, b: HanafudaCard | CardId | string): boolean {
  const cardA = resolveCard(a);
  const cardB = resolveCard(b);
  return cardA !== null && cardB !== null && cardA.month === cardB.month;
}

// Traditional Koi-Koi rule: the Chrysanthemum Sake Cup (09-tane-sake-cup) counts as both tane and kasu.
export function countsAsKasu(cardOrId: HanafudaCard | CardId | string): boolean {
  const card = resolveCard(cardOrId);
  return card !== null && (card.category === "kasu" || card.dualKasu);
}

export function countsAsTane(cardOrId: HanafudaCard | CardId | string): boolean {
  const card = resolveCard(cardOrId);
  return card !== null && card.category === "tane";
}

export const MONTHLY_FLOWERS_BY_NUMBER: Readonly<Record<MonthNumber, string>> = Object.freeze({
  1: MONTHLY_FLOWERS["01"],
  2: MONTHLY_FLOWERS["02"],
  3: MONTHLY_FLOWERS["03"],
  4: MONTHLY_FLOWERS["04"],
  5: MONTHLY_FLOWERS["05"],
  6: MONTHLY_FLOWERS["06"],
  7: MONTHLY_FLOWERS["07"],
  8: MONTHLY_FLOWERS["08"],
  9: MONTHLY_FLOWERS["09"],
  10: MONTHLY_FLOWERS["10"],
  11: MONTHLY_FLOWERS["11"],
  12: MONTHLY_FLOWERS["12"],
});

