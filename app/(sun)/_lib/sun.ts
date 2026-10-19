// The Sun as data: layers, sources and eight chapters of sourced facts. One
// basis per number: composition by mass, kelvin first with °C in brackets,
// distances in km. Every fact names a source, and every source is a page on
// nasa.gov or wikipedia.org (sun.test.ts refuses anything else).

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
export type ChapterId =
  | "scale"
  | "core"
  | "radiative"
  | "convective"
  | "photosphere"
  | "chromosphere"
  | "corona"
  | "life";
export type Fact = { label: string; value: string; source: SourceId };
export type Chapter = { id: ChapterId; title: string; layer: LayerId | "all"; lede: string; facts: Fact[] };

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

export const CHAPTERS: readonly Chapter[] = [
  {
    id: "scale",
    title: "How big is it?",
    layer: "all",
    lede: "The Sun holds almost all the mass in the Solar System. Light from it takes more than eight minutes to reach us.",
    facts: [
      {
        label: "Radius",
        value: "695,700 km: 109 Earths across, about 1.3 million Earths by volume",
        source: "nssdc",
      },
      { label: "Mass", value: "1.989 × 10³⁰ kg, 99.86 % of all the mass in the Solar System", source: "nssdc" },
      { label: "Distance", value: "149.6 million km; light takes 8 min 19 s", source: "nssdc" },
      { label: "Type", value: "G2 V, a yellow dwarf on the main sequence", source: "nssdc" },
      {
        label: "Made of (by mass)",
        value: "73.5 % hydrogen, 24.9 % helium, about 1.7 % heavier elements",
        source: "wikipedia-sun",
      },
    ],
  },
  {
    id: "core",
    title: "The core",
    layer: "core",
    lede: "Deep in the centre, hydrogen is squeezed into helium. That fusion is where all the Sun's light begins.",
    facts: [
      { label: "Extent", value: "the centre to about 0.25 R, about 138,000 km thick", source: "nasa-facts" },
      { label: "Temperature", value: "15.7 million K (15.7 million °C)", source: "nssdc" },
      { label: "Density", value: "150 g/cm³, about 13 times lead", source: "nssdc" },
      { label: "Pressure", value: "2.5 × 10¹¹ bar", source: "nssdc" },
      { label: "Fusion", value: "about 3.7 × 10³⁸ protons become helium every second", source: "wikipedia-sun" },
      { label: "Mass into light", value: "4.26 million tonnes every second; 3.828 × 10²⁶ W", source: "nssdc" },
    ],
  },
  {
    id: "radiative",
    title: "The radiative zone",
    layer: "radiative",
    lede: "Light cannot fly straight out. It bounces from particle to particle in a slow random walk.",
    facts: [
      { label: "Extent", value: "about 0.25 R to 0.7 R", source: "wikipedia-sun" },
      { label: "Temperature", value: "falls from about 7 million K to 2 million K", source: "wikipedia-sun" },
      {
        label: "A photon's trip",
        value: "energy takes about 170,000 years to cross it and reach the convection zone",
        source: "nasa-facts",
      },
    ],
  },
  {
    id: "convective",
    title: "The convection zone",
    layer: "convective",
    lede: "Here the gas is too opaque for light to carry the heat, so the heat is carried by rolling cells of plasma.",
    facts: [
      {
        label: "Extent",
        value: "from about 0.7 R (about 490,000 km from the centre) to the surface, about 200,000 km deep",
        source: "wikipedia-sun",
      },
      {
        label: "Temperature",
        value: "below 2 million K at its base, about 5,800 K at the top",
        source: "wikipedia-sun",
      },
      {
        label: "Why it churns",
        value: "hot plasma rises, cools at the surface and sinks, like a pot on the boil",
        source: "nasa-facts",
      },
    ],
  },
  {
    id: "photosphere",
    title: "The photosphere",
    layer: "photosphere",
    lede: "This thin skin is the part of the Sun we see. Dark sunspots drift across it as the Sun turns.",
    facts: [
      { label: "Thickness", value: "about 500 km", source: "nssdc" },
      { label: "Temperature", value: "5,772 K (5,499 °C)", source: "nssdc" },
      { label: "Rotation", value: "about 25 days at the equator, about 36 days near the poles", source: "nasa-facts" },
      {
        label: "Sunspots",
        value: "1,600 to 160,900 km across, cooler than their surroundings, lasting days to months",
        source: "nasa-facts",
      },
    ],
  },
  {
    id: "chromosphere",
    title: "The chromosphere",
    layer: "chromosphere",
    lede: "A thin, reddish layer above the surface, bristling with jets of gas called spicules.",
    facts: [
      { label: "Thickness", value: "about 2,500 km", source: "nssdc" },
      { label: "Temperature", value: "rises outward, to about 30,000 K at its top", source: "nssdc" },
      {
        label: "Seen in eclipses",
        value: "a thin red rim around the Moon during a total eclipse",
        source: "nasa-facts",
      },
    ],
  },
  {
    id: "corona",
    title: "Corona and solar wind",
    layer: "corona",
    lede: "The outer atmosphere is far hotter than the surface below it. It streams out into space as the solar wind.",
    facts: [
      { label: "Temperature", value: "1 to 2 million K, hotter than the surface below it", source: "nasa-facts" },
      { label: "Solar wind", value: "the corona streams out into space as the solar wind", source: "nasa-facts" },
      {
        label: "Flares and CMEs",
        value: "a flare releases energy like billions of hydrogen bombs; CMEs travel at over a million miles per hour",
        source: "nasa-facts",
      },
      {
        label: "Solar cycle",
        value: "about 11 years; the magnetic poles flip each cycle; Cycle 25 began in December 2019",
        source: "nasa-facts",
      },
    ],
  },
  {
    id: "life",
    title: "A star's life",
    layer: "all",
    lede: "The Sun is about halfway through its life. One day it will swell into a red giant and fade to a white dwarf.",
    facts: [
      {
        label: "Age",
        value: "about 4.6 billion years, a little under halfway through its main-sequence life",
        source: "nasa-facts",
      },
      {
        label: "Next 5 billion years",
        value: "it keeps fusing hydrogen as it does now, slowly brightening",
        source: "nasa-facts",
      },
      {
        label: "Red giant",
        value: "it swells, perhaps past Earth's orbit, then sheds its outer layers",
        source: "wikipedia-sun",
      },
      {
        label: "White dwarf",
        value: "a hot, Earth-sized remnant that cools for billions of years",
        source: "wikipedia-sun",
      },
    ],
  },
];
