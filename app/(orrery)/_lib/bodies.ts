// The Orrery as data: the Sun, the eight planets and five stars, in one fixed
// order (the Sun, the planets out from it, then the stars by distance from us).
// Each body carries its layers in drawing order (inside out), its own sources,
// the "to scale" mark and its poster's words, every item naming one source.
// The Sun's entry is built from sun.ts and poster.ts, so nothing about the Sun
// moves. Planet numbers are the NASA fact sheet's (the index table, and the
// per-planet sheets for the equatorial radius); star numbers are Wikipedia
// infobox values, fetched 2026-10-20. bodies.test.ts keeps it all honest.
import { lightTime } from "./format.ts";
import { BADGES, CALLOUTS, EARTH_LABEL, FOOTER, LIFE, TAGLINE, TITLE } from "./poster.ts";
import { LAYERS, SOURCES } from "./sun.ts";

export type BodyKind = "star" | "planet";
export type BodyLayer = {
  id: string;
  name: string;
  region: "interior" | "atmosphere";
  from: number; // fractions of R inside, km above R outside
  to: number;
  colour: string;
  tempK?: [number, number];
};
export type Source = { name: string; url: string };
export type BodyCallout = { layer: string; n: number; text: string; source: string };
export type BodyBadge = { big: string; small: string; source: string };
export type Stage = { id: string; label: string; note?: string; source: string };
export type Comparison = { label: string; radiusKm: number; shape: "dot" | "orbit" };
export type Body = {
  slug: string;
  name: string;
  kind: BodyKind;
  radiusKm: number; // equatorial; R☉ = 695,700 km
  layers: readonly BodyLayer[];
  sources: Record<string, Source>;
  compare: Comparison; // the "to scale" mark
  polarRadiusKm?: number; // a body spun flat (Vega); radiusKm is the equator
  marks?: readonly string[]; // what makes it itself: rings, a spot, a companion (cutaway.ts draws them)
  poster: {
    title: string;
    tagline: string;
    callouts: readonly BodyCallout[];
    badges: readonly BodyBadge[];
    life?: readonly Stage[];
    footer: string;
  };
};

export const SUN_RADIUS_KM = 695_700;
// Sirius B, the white dwarf beside Sirius: 0.0084 R☉ on Wikipedia's Sirius infobox.
export const SIRIUS_B_RADIUS_KM = Math.round(0.0084 * SUN_RADIUS_KM);
const EARTH_RADIUS_KM = 6_378.137;
const MOON_RADIUS_KM = 1_738.1;
const JUPITER_RADIUS_KM = 71_492;
const AU_KM = 149_600_000; // Earth's distance from the Sun on the fact sheet
const LIGHT_KM_S = 299_792;

// A star's photosphere is a few hundred km, far below what the drawing shows
// (it is drawn at MIN_BAND); the infoboxes give no thickness, so its km here
// are nominal and no callout states one.
const PHOTOSPHERE_KM = 500;

const FACTSHEET: Source = { name: "NASA", url: "https://nssdc.gsfc.nasa.gov/planetary/factsheet/" };
const NASA_STARS: Source = { name: "NASA", url: "https://science.nasa.gov/universe/stars/" };
const wiki = (page: string): Source => ({ name: "Wikipedia", url: `https://en.wikipedia.org/wiki/${page}` });

function planetSources(slug: string, page: string): Record<string, Source> {
  return {
    factsheet: FACTSHEET,
    nssdc: { name: "NASA", url: `https://nssdc.gsfc.nasa.gov/planetary/factsheet/${slug}fact.html` },
    nasa: { name: "NASA", url: `https://science.nasa.gov/${slug}/facts/` },
    wikipedia: wiki(page),
  };
}

const starSources = (page: string): Record<string, Source> => ({ wikipedia: wiki(page), "nasa-stars": NASA_STARS });

// Sunlight's trip, from the fact sheet's distance from the Sun (10⁶ km).
const sunlight = (millionKm: number): BodyBadge => ({
  big: lightTime(Math.round((millionKm * 1_000_000) / LIGHT_KM_S)),
  small: "for sunlight to arrive",
  source: "factsheet",
});

// Callouts number themselves in layer order: one per layer, n = 1..k.
function callouts(items: readonly Omit<BodyCallout, "n">[]): BodyCallout[] {
  return items.map((c, i) => ({ ...c, n: i + 1 }));
}

const EARTH_SCALE: Comparison = { label: EARTH_LABEL, radiusKm: EARTH_RADIUS_KM, shape: "dot" };
const SUN_SCALE: Comparison = { label: "The Sun, to scale", radiusKm: SUN_RADIUS_KM, shape: "dot" };

const SUN: Body = {
  slug: "sun",
  name: "Sun",
  kind: "star",
  radiusKm: SUN_RADIUS_KM,
  layers: LAYERS,
  sources: SOURCES,
  compare: EARTH_SCALE,
  poster: { title: TITLE, tagline: TAGLINE, callouts: CALLOUTS, badges: BADGES, life: LIFE, footer: FOOTER },
};

const MERCURY: Body = {
  slug: "mercury",
  name: "Mercury",
  kind: "planet",
  radiusKm: 2_440.5,
  layers: [
    { id: "core", name: "Iron core", region: "interior", from: 0, to: 0.83, colour: "#b8a089" },
    { id: "mantle", name: "Mantle", region: "interior", from: 0.83, to: 0.98, colour: "#9c8f84" },
    { id: "crust", name: "Crust", region: "interior", from: 0.98, to: 1, colour: "#c9bfb3" },
  ],
  sources: planetSources("mercury", "Mercury_(planet)"),
  compare: EARTH_SCALE,
  poster: {
    title: "Mercury",
    tagline: "The smallest planet, cut open.",
    callouts: callouts([
      { layer: "core", text: "An iron core 2,020 km in radius: 57% of its volume.", source: "wikipedia" },
      { layer: "mantle", text: "A thin shell of silicate rock.", source: "wikipedia" },
      { layer: "crust", text: "Cratered rock with no air to hold heat. 167 °C on average.", source: "factsheet" },
    ]),
    badges: [
      { big: "0.38", small: "Earths across", source: "factsheet" },
      { big: "176 days", small: "from sunrise to sunrise", source: "factsheet" },
      { big: "88 days", small: "one year", source: "factsheet" },
      sunlight(57.9),
    ],
    footer: FOOTER,
  },
};

const VENUS: Body = {
  slug: "venus",
  name: "Venus",
  kind: "planet",
  radiusKm: 6_051.8,
  layers: [
    { id: "core", name: "Iron core", region: "interior", from: 0, to: 0.5, colour: "#d9a066" },
    { id: "mantle", name: "Mantle", region: "interior", from: 0.5, to: 0.99, colour: "#c4774a" },
    { id: "crust", name: "Crust", region: "interior", from: 0.99, to: 1, colour: "#a35d3b" },
    { id: "clouds", name: "Clouds", region: "atmosphere", from: 0, to: 70, colour: "#f2d28b" },
  ],
  sources: planetSources("venus", "Venus"),
  compare: EARTH_SCALE,
  poster: {
    title: "Venus",
    tagline: "Earth's hot twin, cut open.",
    callouts: callouts([
      { layer: "core", text: "An iron core about half the radius, inferred from Earth's.", source: "wikipedia" },
      { layer: "mantle", text: "Hot rock, like Earth's mantle.", source: "wikipedia" },
      { layer: "crust", text: "464 °C on average: hotter than Mercury.", source: "factsheet" },
      { layer: "clouds", text: "Thick clouds over air 92 times Earth's pressure.", source: "factsheet" },
    ]),
    badges: [
      { big: "0.95", small: "Earths across", source: "factsheet" },
      { big: "117 days", small: "from sunrise to sunrise", source: "factsheet" },
      { big: "225 days", small: "one year", source: "factsheet" },
      sunlight(108.2),
    ],
    footer: FOOTER,
  },
};

const EARTH: Body = {
  slug: "earth",
  name: "Earth",
  kind: "planet",
  radiusKm: EARTH_RADIUS_KM,
  layers: [
    { id: "inner-core", name: "Inner core", region: "interior", from: 0, to: 0.19, colour: "#f2c14e" },
    { id: "outer-core", name: "Outer core", region: "interior", from: 0.19, to: 0.55, colour: "#e8873a" },
    { id: "mantle", name: "Mantle", region: "interior", from: 0.55, to: 0.995, colour: "#c0573a" },
    { id: "crust", name: "Crust", region: "interior", from: 0.995, to: 1, colour: "#5f8f5a" },
    { id: "atmosphere", name: "Atmosphere", region: "atmosphere", from: 0, to: 100, colour: "#8fc3e8" },
  ],
  sources: planetSources("earth", "Earth"),
  compare: { label: "The Moon, to scale", radiusKm: MOON_RADIUS_KM, shape: "dot" },
  marks: ["clouds"],
  poster: {
    title: "Earth",
    tagline: "Our planet, cut open.",
    callouts: callouts([
      { layer: "inner-core", text: "Solid iron, 1,220 km in radius.", source: "wikipedia" },
      { layer: "outer-core", text: "Liquid iron. Its flow makes the magnetic field.", source: "wikipedia" },
      { layer: "mantle", text: "Hot rock down to 2,900 km, slowly churning.", source: "wikipedia" },
      { layer: "crust", text: "Only 6 to 50 km thin. Oceans cover 71% of it.", source: "wikipedia" },
      { layer: "atmosphere", text: "Air at 1 bar, 15 °C on average.", source: "factsheet" },
    ]),
    badges: [
      { big: "12,756 km", small: "across", source: "factsheet" },
      { big: "24 hours", small: "from sunrise to sunrise", source: "factsheet" },
      { big: "365 days", small: "one year", source: "factsheet" },
      sunlight(149.6),
    ],
    footer: FOOTER,
  },
};

const MARS: Body = {
  slug: "mars",
  name: "Mars",
  kind: "planet",
  radiusKm: 3_396.2,
  layers: [
    { id: "core", name: "Iron core", region: "interior", from: 0, to: 0.49, colour: "#e0a458" },
    { id: "mantle", name: "Mantle", region: "interior", from: 0.49, to: 0.985, colour: "#b5543c" },
    { id: "crust", name: "Crust", region: "interior", from: 0.985, to: 1, colour: "#d9714e" },
  ],
  sources: planetSources("mars", "Mars"),
  compare: EARTH_SCALE,
  marks: ["polar-cap"],
  poster: {
    title: "Mars",
    tagline: "The red planet, cut open.",
    callouts: callouts([
      { layer: "core", text: "A partly molten iron core, about half the radius.", source: "wikipedia" },
      { layer: "mantle", text: "Rock that once fed Olympus Mons, the largest volcano known.", source: "wikipedia" },
      { layer: "crust", text: "Rusty rock, 42 to 56 km thick.", source: "wikipedia" },
    ]),
    badges: [
      { big: "0.53", small: "Earths across", source: "factsheet" },
      { big: "24.7 hours", small: "from sunrise to sunrise", source: "factsheet" },
      { big: "687 days", small: "one year", source: "factsheet" },
      sunlight(228.0),
    ],
    footer: FOOTER,
  },
};

const JUPITER: Body = {
  slug: "jupiter",
  name: "Jupiter",
  kind: "planet",
  radiusKm: JUPITER_RADIUS_KM,
  layers: [
    { id: "core", name: "Diffuse core", region: "interior", from: 0, to: 0.2, colour: "#b07a4f" },
    { id: "metallic-hydrogen", name: "Metallic hydrogen", region: "interior", from: 0.2, to: 0.8, colour: "#c99b6d" },
    { id: "molecular-hydrogen", name: "Molecular hydrogen", region: "interior", from: 0.8, to: 1, colour: "#e3c79f" },
    { id: "cloud-tops", name: "Cloud tops", region: "atmosphere", from: 0, to: 50, colour: "#d98c5f" },
  ],
  sources: planetSources("jupiter", "Jupiter"),
  compare: EARTH_SCALE,
  marks: ["bands", "great-red-spot"],
  poster: {
    title: "Jupiter",
    tagline: "The largest planet, cut open.",
    callouts: callouts([
      { layer: "core", text: "A diffuse core of rock and ice, dissolving into hydrogen.", source: "wikipedia" },
      { layer: "metallic-hydrogen", text: "Hydrogen squeezed into a liquid metal. It drives the magnetic field.", source: "wikipedia" },
      { layer: "molecular-hydrogen", text: "Hydrogen and helium, thickening from gas to liquid.", source: "wikipedia" },
      { layer: "cloud-tops", text: "Banded clouds at −110 °C on average. 95 moons circle it.", source: "factsheet" },
    ]),
    badges: [
      { big: "11.2", small: "Earths across", source: "factsheet" },
      { big: "9.9 hours", small: "from sunrise to sunrise", source: "factsheet" },
      { big: "11.9 years", small: "one year", source: "factsheet" },
      sunlight(778.5),
    ],
    footer: FOOTER,
  },
};

const SATURN: Body = {
  slug: "saturn",
  name: "Saturn",
  kind: "planet",
  radiusKm: 60_268,
  layers: [
    { id: "core", name: "Diffuse core", region: "interior", from: 0, to: 0.6, colour: "#b89361" },
    { id: "metallic-hydrogen", name: "Metallic hydrogen", region: "interior", from: 0.6, to: 0.85, colour: "#d4b483" },
    { id: "molecular-hydrogen", name: "Molecular hydrogen", region: "interior", from: 0.85, to: 1, colour: "#eedcb3" },
    { id: "cloud-tops", name: "Cloud tops", region: "atmosphere", from: 0, to: 60, colour: "#e8c77e" },
  ],
  sources: planetSources("saturn", "Saturn"),
  compare: EARTH_SCALE,
  marks: ["rings"],
  poster: {
    title: "Saturn",
    tagline: "The ringed planet, cut open.",
    callouts: callouts([
      { layer: "core", text: "A diffuse core reaching 60% of the way out.", source: "wikipedia" },
      { layer: "metallic-hydrogen", text: "A thinner layer of metallic hydrogen than Jupiter's.", source: "wikipedia" },
      { layer: "molecular-hydrogen", text: "Mostly hydrogen and helium: 687 kg/m³, lighter than water.", source: "factsheet" },
      { layer: "cloud-tops", text: "Pale clouds at −140 °C, icy rings and 274 moons.", source: "factsheet" },
    ]),
    badges: [
      { big: "9.45", small: "Earths across", source: "factsheet" },
      { big: "10.7 hours", small: "from sunrise to sunrise", source: "factsheet" },
      { big: "29.4 years", small: "one year", source: "factsheet" },
      sunlight(1_432.0),
    ],
    footer: FOOTER,
  },
};

const URANUS: Body = {
  slug: "uranus",
  name: "Uranus",
  kind: "planet",
  radiusKm: 25_559,
  layers: [
    { id: "core", name: "Rocky core", region: "interior", from: 0, to: 0.2, colour: "#7d8f8c" },
    { id: "icy-mantle", name: "Icy mantle", region: "interior", from: 0.2, to: 0.75, colour: "#7fc4c9" },
    { id: "envelope", name: "Hydrogen envelope", region: "interior", from: 0.75, to: 1, colour: "#b5e3e0" },
  ],
  sources: planetSources("uranus", "Uranus"),
  compare: EARTH_SCALE,
  marks: ["rings", "tilt"],
  poster: {
    title: "Uranus",
    tagline: "The tipped ice giant, cut open.",
    callouts: callouts([
      { layer: "core", text: "A small core of rock.", source: "wikipedia" },
      { layer: "icy-mantle", text: "A hot, dense fluid of water, ammonia and methane.", source: "wikipedia" },
      { layer: "envelope", text: "Hydrogen and helium at −195 °C, tipped 98° on its side.", source: "factsheet" },
    ]),
    badges: [
      { big: "4.0", small: "Earths across", source: "factsheet" },
      { big: "17.2 hours", small: "from sunrise to sunrise", source: "factsheet" },
      { big: "84 years", small: "one year", source: "factsheet" },
      sunlight(2_867.0),
    ],
    footer: FOOTER,
  },
};

const NEPTUNE: Body = {
  slug: "neptune",
  name: "Neptune",
  kind: "planet",
  radiusKm: 24_764,
  layers: [
    { id: "core", name: "Rocky core", region: "interior", from: 0, to: 0.25, colour: "#6f7d8c" },
    { id: "icy-mantle", name: "Icy mantle", region: "interior", from: 0.25, to: 0.8, colour: "#4f7fc9" },
    { id: "envelope", name: "Hydrogen envelope", region: "interior", from: 0.8, to: 1, colour: "#8fb3ea" },
  ],
  sources: planetSources("neptune", "Neptune"),
  compare: EARTH_SCALE,
  marks: ["dark-spot"],
  poster: {
    title: "Neptune",
    tagline: "The farthest planet, cut open.",
    callouts: callouts([
      { layer: "core", text: "Iron, nickel and rock, about 1.2 Earth masses.", source: "wikipedia" },
      { layer: "icy-mantle", text: "Water, ammonia and methane: 10 to 15 Earth masses.", source: "wikipedia" },
      { layer: "envelope", text: "Hydrogen and helium at −200 °C, with 16 moons around.", source: "factsheet" },
    ]),
    badges: [
      { big: "3.9", small: "Earths across", source: "factsheet" },
      { big: "16.1 hours", small: "from sunrise to sunrise", source: "factsheet" },
      { big: "164 years", small: "one year", source: "factsheet" },
      sunlight(4_515.0),
    ],
    footer: FOOTER,
  },
};

const photosphere = (colour: string): BodyLayer => ({
  id: "photosphere",
  name: "Photosphere",
  region: "atmosphere",
  from: 0,
  to: PHOTOSPHERE_KM,
  colour,
});

const PROXIMA: Body = {
  slug: "proxima-centauri",
  name: "Proxima Centauri",
  kind: "star",
  radiusKm: Math.round(0.1542 * SUN_RADIUS_KM),
  layers: [
    { id: "core", name: "Core", region: "interior", from: 0, to: 0.3, colour: "#f7b267" },
    { id: "convective", name: "Convection zone", region: "interior", from: 0.3, to: 1, colour: "#e4572e" },
    photosphere("#c0392b"),
  ],
  sources: starSources("Proxima_Centauri"),
  compare: { label: "Jupiter, to scale", radiusKm: JUPITER_RADIUS_KM, shape: "dot" },
  poster: {
    title: "Proxima Centauri",
    tagline: "The nearest star, cut open.",
    callouts: callouts([
      { layer: "core", text: "Hydrogen fuses slowly here, enough for trillions of years.", source: "wikipedia" },
      { layer: "convective", text: "The whole star churns. There is no radiative zone.", source: "wikipedia" },
      { layer: "photosphere", text: "2,992 K, dim and red, and prone to flares.", source: "wikipedia" },
    ]),
    badges: [
      { big: "0.15", small: "Suns across", source: "wikipedia" },
      { big: "4.25", small: "light years away", source: "wikipedia" },
      { big: "2,992 K", small: "at the surface", source: "wikipedia" },
      { big: "0.12", small: "Suns of mass", source: "wikipedia" },
    ],
    life: [
      { id: "today", label: "Red dwarf", source: "wikipedia" },
      { id: "blue-dwarf", label: "Blue dwarf", note: "in trillions of years", source: "wikipedia" },
      { id: "white-dwarf", label: "White dwarf", source: "wikipedia" },
    ],
    footer: FOOTER,
  },
};

const SIRIUS: Body = {
  slug: "sirius",
  name: "Sirius",
  kind: "star",
  radiusKm: Math.round(1.7144 * SUN_RADIUS_KM),
  layers: [
    { id: "convective-core", name: "Convective core", region: "interior", from: 0, to: 0.15, colour: "#fdfdfd" },
    { id: "radiative", name: "Radiative zone", region: "interior", from: 0.15, to: 1, colour: "#cfe3f7" },
    photosphere("#9cc3ec"),
  ],
  sources: starSources("Sirius"),
  compare: SUN_SCALE,
  marks: ["companion"],
  poster: {
    title: "Sirius",
    tagline: "The brightest night star, cut open.",
    callouts: callouts([
      { layer: "convective-core", text: "A churning core: the Sun's layers in reverse.", source: "nasa-stars" },
      { layer: "radiative", text: "Calm gas carries the light out.", source: "nasa-stars" },
      { layer: "photosphere", text: "9,845 K and blue-white, the brightest star in our night sky.", source: "wikipedia" },
    ]),
    badges: [
      { big: "1.7", small: "Suns across", source: "wikipedia" },
      { big: "8.6", small: "light years away", source: "wikipedia" },
      { big: "9,845 K", small: "at the surface", source: "wikipedia" },
      { big: "2.1", small: "Suns of mass", source: "wikipedia" },
    ],
    life: [
      { id: "today", label: "Today", source: "wikipedia" },
      { id: "giant", label: "Red giant", source: "wikipedia" },
      { id: "dwarf", label: "White dwarf", note: "like Sirius B", source: "wikipedia" },
    ],
    footer: FOOTER,
  },
};

const VEGA: Body = {
  slug: "vega",
  name: "Vega",
  kind: "star",
  radiusKm: Math.round(2.726 * SUN_RADIUS_KM),
  layers: [
    { id: "convective-core", name: "Convective core", region: "interior", from: 0, to: 0.15, colour: "#fffdf2" },
    { id: "radiative", name: "Radiative zone", region: "interior", from: 0.15, to: 1, colour: "#dde8f8" },
    photosphere("#a9c4ee"),
  ],
  sources: starSources("Vega"),
  compare: SUN_SCALE,
  polarRadiusKm: Math.round(2.418 * SUN_RADIUS_KM), // Wikipedia: 2.418 R☉ at the poles, 2.726 at the equator
  marks: ["flattened"],
  poster: {
    title: "Vega",
    tagline: "A star spun flat, cut open.",
    callouts: callouts([
      { layer: "convective-core", text: "A churning core turning hydrogen into helium.", source: "nasa-stars" },
      { layer: "radiative", text: "Calm gas carries the light out.", source: "nasa-stars" },
      {
        layer: "photosphere",
        text: "One spin every 16.3 hours flattens it: 10,070 K at the poles, 8,910 K at the equator.",
        source: "wikipedia",
      },
    ]),
    badges: [
      { big: "2.7", small: "Suns across", source: "wikipedia" },
      { big: "25", small: "light years away", source: "wikipedia" },
      { big: "10,070 K", small: "at the poles", source: "wikipedia" },
      { big: "2.15", small: "Suns of mass", source: "wikipedia" },
    ],
    life: [
      { id: "today", label: "Today", source: "wikipedia" },
      { id: "giant", label: "Red giant", source: "wikipedia" },
      { id: "dwarf", label: "White dwarf", source: "wikipedia" },
    ],
    footer: FOOTER,
  },
};

const POLARIS: Body = {
  slug: "polaris",
  name: "Polaris",
  kind: "star",
  radiusKm: Math.round(46.27 * SUN_RADIUS_KM),
  layers: [
    { id: "core", name: "Helium core", region: "interior", from: 0, to: 0.05, colour: "#fff1c1" },
    { id: "shell", name: "Burning shell", region: "interior", from: 0.05, to: 0.1, colour: "#ffd27a" },
    { id: "envelope", name: "Pulsing envelope", region: "interior", from: 0.1, to: 1, colour: "#f6e3a1" },
    photosphere("#f2c14e"),
  ],
  sources: starSources("Polaris"),
  compare: SUN_SCALE,
  marks: ["pulse-rings"],
  poster: {
    title: "Polaris",
    tagline: "The North Star, cut open.",
    callouts: callouts([
      { layer: "core", text: "Its core hydrogen is spent; helium is left.", source: "nasa-stars" },
      { layer: "shell", text: "Hydrogen still burns in a shell around it.", source: "nasa-stars" },
      { layer: "envelope", text: "Swells and shrinks every 4 days: a Cepheid.", source: "wikipedia" },
      { layer: "photosphere", text: "6,015 K, yellow-white, almost due north.", source: "wikipedia" },
    ]),
    badges: [
      { big: "46", small: "Suns across", source: "wikipedia" },
      { big: "447", small: "light years away", source: "wikipedia" },
      { big: "6,015 K", small: "at the surface", source: "wikipedia" },
      { big: "5.1", small: "Suns of mass", source: "wikipedia" },
    ],
    life: [
      { id: "today", label: "Supergiant", note: "pulsing today", source: "wikipedia" },
      { id: "shed", label: "Sheds its outer layers", source: "nasa-stars" },
      { id: "dwarf", label: "White dwarf", source: "nasa-stars" },
    ],
    footer: FOOTER,
  },
};

const BETELGEUSE: Body = {
  slug: "betelgeuse",
  name: "Betelgeuse",
  kind: "star",
  radiusKm: Math.round(764 * SUN_RADIUS_KM),
  layers: [
    { id: "helium-core", name: "Helium core", region: "interior", from: 0, to: 0.01, colour: "#fff3d6" },
    { id: "shell", name: "Burning shell", region: "interior", from: 0.01, to: 0.05, colour: "#ffc078" },
    { id: "convective", name: "Convective envelope", region: "interior", from: 0.05, to: 1, colour: "#e8704a" },
    photosphere("#b8402a"),
  ],
  sources: starSources("Betelgeuse"),
  compare: { label: "Earth's orbit, to scale", radiusKm: AU_KM, shape: "orbit" },
  marks: ["lumpy"],
  poster: {
    title: "Betelgeuse",
    tagline: "A red supergiant near its end, cut open.",
    callouts: callouts([
      { layer: "helium-core", text: "Helium fuses into carbon here.", source: "wikipedia" },
      { layer: "shell", text: "Hydrogen burns in a shell around it.", source: "wikipedia" },
      { layer: "convective", text: "Most of the star: huge boiling cells of cool gas.", source: "wikipedia" },
      { layer: "photosphere", text: "3,779 K and red. It dimmed sharply in 2019 and 2020.", source: "wikipedia" },
    ]),
    badges: [
      { big: "about 764", small: "Suns across", source: "wikipedia" },
      { big: "about 548", small: "light years away", source: "wikipedia" },
      { big: "3,779 K", small: "at the surface", source: "wikipedia" },
      { big: "14", small: "Suns of mass", source: "wikipedia" },
    ],
    life: [
      { id: "today", label: "Red supergiant", source: "wikipedia" },
      { id: "supernova", label: "Supernova", note: "within 100,000 years", source: "wikipedia" },
      { id: "neutron-star", label: "Neutron star", source: "wikipedia" },
    ],
    footer: FOOTER,
  },
};

export const BODIES: readonly Body[] = [
  SUN,
  MERCURY,
  VENUS,
  EARTH,
  MARS,
  JUPITER,
  SATURN,
  URANUS,
  NEPTUNE,
  PROXIMA,
  SIRIUS,
  VEGA,
  POLARIS,
  BETELGEUSE,
];

export function bodyBySlug(slug: string): Body | undefined {
  return BODIES.find((b) => b.slug === slug);
}

// Previous / Next in the one fixed order; the ends have no wrap-around.
export function neighbours(slug: string): { prev?: Body; next?: Body } {
  const i = BODIES.findIndex((b) => b.slug === slug);
  if (i < 0) return {};
  return { prev: BODIES[i - 1], next: BODIES[i + 1] };
}

export const ORRERY = {
  title: "Orrery",
  tagline: "The Sun, the planets and five stars, cut open and drawn by hand.",
  footer: FOOTER,
};
