export type Rarity = "common" | "uncommon" | "rare" | "secret";
export type Sticker = { id: string; name: string; rarity: Rarity; colour: string; paths: string[]; hidden?: boolean };

// Original pen drawings on a 100 × 100 paper square; shared by SVG and PNG.
const drawings = {
  spark: ["M48 12 36 43 14 47 37 57 34 87 54 64 83 70 69 47 84 25 59 31Z", "m48 42 8 12-11 10"],
  airflow: ["M50 50Q12 14 28 12T50 50Q86 12 88 29T50 50Q87 86 70 88T50 50Q14 88 12 71T50 50Z"],
  duck: ["M30 57Q12 34 29 24Q45 17 51 38L70 36 56 48Q91 43 82 66Q68 89 31 75Q17 67 30 57Z", "M32 32h2", "M42 62q15 12 27-1"],
  database: ["M20 28C20 8 80 8 80 28S20 48 20 28V73C20 94 80 94 80 73V28", "M20 48c0 20 60 20 60 0M20 65c0 20 60 20 60 0"],
  music: ["M39 71V25L77 17V62M39 39 77 31", "M39 68C15 56 12 91 33 84Q42 81 39 68M77 60C53 48 50 83 71 76Q80 73 77 60"],
  turtle: ["M25 54C20 15 76 15 77 54L70 73H32Z", "M25 47Q4 25 9 53L25 58M77 47q25-22 15 7L77 60M33 72 25 84M65 72l12 12M50 27 37 46 45 64 64 57 67 39Z"],
  cat: ["M20 43 19 16 40 30Q51 24 63 30L83 15 79 47Q91 85 50 86T20 43Z", "M34 51h3m26 0h3M46 61l5 5 5-5M51 66v7M11 61l21 3M68 64l21-5"],
  moon: ["M68 13C8 0 1 87 61 88Q81 87 89 69C32 90 29 23 68 13Z", "M73 27v16m-8-8h16"],
  mountain: ["M9 80 39 23 55 48 67 30 92 80Z", "M28 44l11 7 9-10M20 89h65M61 43l6 6 8-3"],
  flower: ["M50 46C9 30 37 2 50 34C65 0 94 29 62 46C99 54 81 88 60 63C63 99 25 94 40 62C5 79 0 43 38 47Z", "M46 45q15-7 13 10t-15 0Z"],
  letter: ["M12 28 86 24 89 76 15 80Z", "m13 29 39 29 34-33M15 79l26-29m20 0 28 26M24 17l20-2"],
  orbit: ["M34 52a17 17 0 1 0 34 0a17 17 0 1 0-34 0", "M9 75C-6 46 92 11 94 33S23 102 9 75M67 20l5-8m-1 68 8 8"],
  tools: ["M21 16 15 31 62 79 78 64 31 16 21 16Z", "m25 35 9-9M20 80 79 21M68 16l17 16-15 15-17-16Z"],
  book: ["M49 28Q30 14 11 22L14 78Q31 70 50 83Q70 69 89 76L87 21Q67 15 49 28V83", "m21 36 19 4m-18 8 18 4m20-12 17-5m-17 17 18-5"],
  lantern: ["M33 16h34v12H33ZM28 30Q8 52 29 75H72Q92 52 72 30ZM32 78h37v9H32Z", "M42 32q-12 22 0 41M59 32q14 23 0 41M51 89v8"],
  tea: ["M19 42h55L68 77Q43 92 24 76ZM74 48q31-8 11 20H72", "M16 88h64M35 31q-15-12 0-23m17 23q14-13 0-23"],
  fish: ["M14 52Q48 9 77 48L93 33V73L77 58Q44 94 14 52Z", "M28 46h2M52 33q-15 20 0 38M34 54h8"],
  cloud: ["M20 72C-2 62 13 35 30 43C25 8 78 13 73 44C103 38 103 77 79 75Z", "M30 83l-4 10m25-10-4 10m24-10-4 10"],
  key: ["M16 39a20 20 0 1 0 40 0a20 20 0 1 0-40 0M52 49l35 31-8 9-10-9 4-5-9-7-4 5-13-13", "M25 35a7 7 0 1 0 14 0a7 7 0 1 0-14 0"],
  sun: ["M30 50a20 20 0 1 0 40 0a20 20 0 1 0-40 0", "M50 6v14m0 60v14M6 50h14m60 0h14M17 17l11 11m44 44 11 11M17 83l11-11m44-44 11-11"],
} satisfies Record<string, string[]>;
type Drawing = keyof typeof drawings;
const rows: [string, Drawing, Rarity][] = [
  ["Spark", "spark", "common"], ["Airflow", "airflow", "common"], ["DuckDB", "duck", "common"],
  ["Joinery", "tools", "common"], ["Otohime", "fish", "common"], ["Ink Desk", "book", "common"],
  ["Stamp Ledger", "letter", "common"], ["Vinyl", "music", "common"], ["Tiny Kame", "turtle", "common"],
  ["Tea Break", "tea", "common"], ["Snowflake", "spark", "common"], ["Postgres", "database", "common"],
  ["Night Radio", "music", "uncommon"], ["Pond Cat", "cat", "uncommon"], ["Paper Mountain", "mountain", "uncommon"],
  ["Cloud Pipeline", "cloud", "uncommon"], ["Pocket Key", "key", "uncommon"], ["Moon Letter", "letter", "uncommon"],
  ["Hanafuda", "flower", "uncommon"], ["Ryugu Lantern", "lantern", "uncommon"], ["Orbit", "orbit", "uncommon"],
  ["Little Sun", "sun", "uncommon"], ["Midnight Duck", "duck", "rare"], ["Sea Princess", "fish", "rare"],
  ["Lunar Garden", "moon", "rare"], ["Golden Crank", "key", "rare"], ["Sakura Press", "flower", "rare"],
  ["Palace Kame", "turtle", "rare"], ["Foil Moon", "moon", "secret"], ["Holographic Otohime", "fish", "secret"],
  ["Rainy Notes", "cloud", "common"], ["Washi Sketch", "mountain", "common"], ["Ink Cat", "cat", "common"],
  ["Dawn Tea", "tea", "common"], ["Data Garden", "database", "uncommon"], ["Paper Observatory", "orbit", "uncommon"],
];
const colours = { common: "#405b59", uncommon: "#9d553c", rare: "#66558b", secret: "#826424" };
export const STICKERS: Sticker[] = rows.map(([name, drawing, rarity]) => ({
  id: name.toLowerCase().replaceAll(" ", "-"), name, rarity, colour: colours[rarity], paths: drawings[drawing],
}));
export const FINDS = { notes: "margin-flower", sketches: "sketch-cat", lost: "lost-moon", konami: "secret-kame" } as const;
for (const [id, name, drawing] of [
  [FINDS.notes, "Margin Flower", "flower"], [FINDS.sketches, "Sketch Cat", "cat"],
  [FINDS.lost, "Lost Moon", "moon"], [FINDS.konami, "Secret Kame", "turtle"],
] as [string, string, Drawing][]) STICKERS.push({ id, name, paths: drawings[drawing], rarity: "rare", colour: "#a33d32", hidden: true });
export const stickerById = (id: string) => STICKERS.find(s => s.id === id);
