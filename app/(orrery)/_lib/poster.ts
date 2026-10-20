// The poster's words, every one with a source. The numbers come from the fact
// table in the pm-188 plan; the page shows these and nothing longer.
// poster.test.ts keeps them sourced and under the word budget.
import { lightTime, years } from "./format.ts";
import { LIGHT_SECONDS, PHOTON_YEARS, type LayerId, type SourceId } from "./sun.ts";

export type Callout = { layer: LayerId; n: 1 | 2 | 3 | 4 | 5 | 6; text: string; source: SourceId };
export type Badge = { big: string; small: string; source: SourceId };
export type LifeStage = { id: "today" | "giant" | "dwarf"; label: string; note?: string; source: SourceId };

export const TITLE = "The Sun";
export const TAGLINE = "A star, cut open.";

export const CALLOUTS: readonly Callout[] = [
  { layer: "core", n: 1, text: "15.7 million K. Hydrogen fuses into helium here.", source: "nssdc" },
  {
    layer: "radiative",
    n: 2,
    text: `Light bounces for about ${years(PHOTON_YEARS)} to get out.`,
    source: "nasa-facts",
  },
  { layer: "convective", n: 3, text: "Boiling plasma carries the heat the last 200,000 km.", source: "wikipedia-sun" },
  { layer: "photosphere", n: 4, text: "The surface we see: 500 km thin, 5,772 K, dotted with sunspots.", source: "nssdc" },
  { layer: "chromosphere", n: 5, text: "A 2,500 km red rim, seen in a total eclipse.", source: "nssdc" },
  {
    layer: "corona",
    n: 6,
    text: "1 to 2 million K, hotter than the surface. It streams away as the solar wind.",
    source: "nasa-facts",
  },
];

export const BADGES: readonly Badge[] = [
  { big: "109", small: "Earths across", source: "nssdc" },
  { big: lightTime(LIGHT_SECONDS), small: "of light to Earth", source: "nssdc" },
  { big: "15.7 million K", small: "at the core", source: "nssdc" },
  { big: "4.6 billion", small: "years old", source: "nasa-facts" },
];

export const LIFE: readonly LifeStage[] = [
  { id: "today", label: "Today", source: "nasa-facts" },
  { id: "giant", label: "Red giant", note: "in about 5 billion years", source: "nasa-facts" },
  { id: "dwarf", label: "White dwarf", source: "wikipedia-sun" },
];

export const FOOTER = "Numbers from NASA and Wikipedia · drawn by hand in code";
export const EARTH_LABEL = "Earth, to scale";
