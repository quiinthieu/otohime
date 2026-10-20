// The Sun as data: its layers, the two numbers the poster derives words from,
// and the sources. Kelvin first, distances in km. Every poster fact names one
// of these sources (poster.ts), and every source is a page on nasa.gov or
// wikipedia.org (sun.test.ts refuses anything else).

export type LayerId = "core" | "radiative" | "convective" | "photosphere" | "chromosphere" | "corona";
export type Layer = {
  id: LayerId;
  name: string;
  region: "interior" | "atmosphere";
  from: number; // fractions of R inside, km above R outside
  to: number;
  tempK: [number, number]; // inner edge, outer edge
  colour: string;
};

export type SourceId = "nssdc" | "nasa-facts" | "wikipedia-sun";

export const LIGHT_SECONDS = 499; // 149.6e6 km / 299,792 km/s
export const PHOTON_YEARS = 170_000;

export const LAYERS: readonly Layer[] = [
  { id: "core", name: "Core", region: "interior", from: 0, to: 0.25, tempK: [15_700_000, 7_000_000], colour: "#fff3b0" },
  {
    id: "radiative",
    name: "Radiative zone",
    region: "interior",
    from: 0.25,
    to: 0.7,
    tempK: [7_000_000, 2_000_000],
    colour: "#ffd166",
  },
  {
    id: "convective",
    name: "Convection zone",
    region: "interior",
    from: 0.7,
    to: 1,
    tempK: [2_000_000, 5_800],
    colour: "#f4a259",
  },
  {
    id: "photosphere",
    name: "Photosphere",
    region: "atmosphere",
    from: 0,
    to: 500,
    tempK: [6_400, 4_400],
    colour: "#ff8c42",
  },
  {
    id: "chromosphere",
    name: "Chromosphere",
    region: "atmosphere",
    from: 500,
    to: 3_000,
    tempK: [4_400, 30_000],
    colour: "#e5446d",
  },
  {
    id: "corona",
    name: "Corona",
    region: "atmosphere",
    from: 3_000,
    to: 5_000_000,
    tempK: [1_000_000, 2_000_000],
    colour: "#cdb4db",
  },
];

export const SOURCES: Record<SourceId, { name: string; url: string }> = {
  nssdc: { name: "NASA", url: "https://nssdc.gsfc.nasa.gov/planetary/factsheet/sunfact.html" },
  "nasa-facts": { name: "NASA", url: "https://science.nasa.gov/sun/facts/" },
  "wikipedia-sun": { name: "Wikipedia", url: "https://en.wikipedia.org/wiki/Sun" },
};
