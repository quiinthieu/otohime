// Open-Meteo's 29 WMO weather codes in twelve words. Anything else, including
// the codes WMO leaves unused (4, 98), reads "unsettled".

const GROUPS: Record<string, readonly number[]> = {
  clear: [0],
  "mainly clear": [1],
  "partly cloudy": [2],
  overcast: [3],
  fog: [45, 48],
  drizzle: [51, 53, 55],
  "freezing rain": [56, 57, 66, 67],
  rain: [61, 63, 65],
  showers: [80, 81, 82],
  snow: [71, 73, 75, 77, 85, 86],
  thunder: [95, 97],
  "thunder with hail": [96, 99],
};

export const UNSETTLED = "unsettled";

const WORDS = new Map<number, string>(
  Object.entries(GROUPS).flatMap(([word, codes]) => codes.map((c): [number, string] => [c, word])),
);

/** The twelve words, in the order above. */
export const CODE_WORDS: readonly string[] = Object.keys(GROUPS);

export function wordFor(code: number): string {
  return WORDS.get(code) ?? UNSETTLED;
}
