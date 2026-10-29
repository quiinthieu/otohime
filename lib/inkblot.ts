/** Pure shared model. Coordinates/radii are fractions of a square sheet; angles are radians. */
export type InkEllipse = {
  x: number;
  y: number;
  r: number;
  /** Major radius = r * elongation; minor radius = r. */
  elongation: number;
  angle: number;
};
export type InkDrop = InkEllipse & { satellites: readonly InkEllipse[] };
export type InkDropInput = Pick<InkEllipse, "x" | "y"> & Partial<Omit<InkDrop, "x" | "y">>;
export type FoldedInkDrop = InkDrop & { side: "left" | "right" | "crease"; kind: "drop" | "bridge" };
export type BlotFeatures = {
  lobeCount: number;
  splatterCount: number;
  /** Union coverage of the folded sheet, sampled on a deterministic 32 × 32 grid. */
  density: number;
  verticalSpread: number;
  horizontalReach: number;
  dominantZone: "upper" | "middle" | "lower";
  symmetryScore: 1;
};
export type InkblotReading = {
  title: string;
  plateCode: string;
  observation: string;
  interpretation: string;
  disclaimer: typeof INKBLOT_DISCLAIMER;
};
export type WardNote = { id: string; name: string; note: string; tilt: number; hand: 0 | 1 | 2; specimen: true };

export const MAX_INKBLOT_DROPS = 48;
export const INKBLOT_DISCLAIMER = "A paper-and-ink toy — not medical or psychological advice.";
const BASE36_KEY = /^[0-9a-z]{1,10}$/;
const DAY_MS = 86_400_000;

export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

/** FNV-1a over UTF-16 code units, shared identically by browser and server. */
export function hashBlotString(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) hash = Math.imul(hash ^ input.charCodeAt(i), 16777619);
  return hash >>> 0;
}

export function formatBlotSeed(seed: number): string { return (seed >>> 0).toString(36); }

/** All allowed ten-digit values are safe integers; map them into the uint32 PRNG domain. */
export function parseBlotSeed(raw: unknown): number | null {
  return typeof raw === "string" && BASE36_KEY.test(raw) ? parseInt(raw, 36) >>> 0 : null;
}

function utcDateTimestamp(value: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const timestamp = Date.parse(`${value}T00:00:00.000Z`);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value ? timestamp : null;
}

export function dailyBlotKey(now: Date = new Date()): string { return `daily:${now.toISOString().slice(0, 10)}`; }

export function dailyBlotSeed(utcDateString: string): number {
  if (utcDateTimestamp(utcDateString) === null) throw new RangeError("Expected a valid YYYY-MM-DD UTC date");
  return hashBlotString(`inkblot:${utcDateString}`);
}

export function validateBlotKey(key: unknown, now: Date = new Date()): key is string {
  if (typeof key !== "string") return false;
  if (BASE36_KEY.test(key)) return true;
  if (!/^daily:\d{4}-\d{2}-\d{2}$/.test(key) || !Number.isFinite(now.getTime())) return false;
  const date = utcDateTimestamp(key.slice(6));
  const today = utcDateTimestamp(now.toISOString().slice(0, 10));
  return date !== null && today !== null && Math.abs(date - today) <= DAY_MS;
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const finite = (value: number | undefined, fallback: number) => value !== undefined && Number.isFinite(value) ? value : fallback;

function normalizeEllipse(input: Partial<InkEllipse>, satellite = false): InkEllipse {
  const angle = finite(input.angle, 0);
  return {
    x: clamp(finite(input.x, 0.25), 0.015, 0.49),
    y: clamp(finite(input.y, 0.5), 0.015, 0.985),
    r: clamp(finite(input.r, satellite ? 0.008 : 0.05), satellite ? 0.002 : 0.025, satellite ? 0.025 : 0.11),
    elongation: clamp(finite(input.elongation, 1), 1, 2.4),
    angle: ((angle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI),
  };
}

export function generateSeededDrops(seed: number): InkDrop[] {
  const random = mulberry32(seed);
  const count = 8 + Math.floor(random() * 13);
  return Array.from({ length: count }, () => {
    const body: InkEllipse = {
      x: 0.12 + random() * 0.37,
      y: 0.12 + random() * 0.76,
      r: 0.025 + random() * 0.085,
      elongation: 1 + random() * 1.4,
      angle: random() * Math.PI,
    };
    const satellites = Array.from({ length: 1 + Math.floor(random() * 4) }, () => {
      const direction = random() * Math.PI * 2;
      const distance = body.r * (1.5 + random() * 1.8);
      return normalizeEllipse({
        x: body.x + Math.cos(direction) * distance,
        y: body.y + Math.sin(direction) * distance,
        r: 0.003 + random() * 0.015,
        elongation: 1 + random() * 0.6,
        angle: direction,
      }, true);
    });
    return { ...body, satellites };
  });
}

/** Returns a new array; once full, subsequent drips leave the first 48 intact. */
export function appendUserDrop(drops: readonly InkDrop[], drop: InkDropInput): InkDrop[] {
  if (drops.length >= MAX_INKBLOT_DROPS) return drops.slice(0, MAX_INKBLOT_DROPS);
  return [...drops, {
    ...normalizeEllipse(drop),
    satellites: (drop.satellites ?? []).slice(0, 4).map((satellite) => normalizeEllipse(satellite, true)),
  }];
}

function reflect(ellipse: InkEllipse): InkEllipse {
  return { ...ellipse, x: 1 - ellipse.x, angle: -ellipse.angle };
}

/** Adjacent left/right pairs, followed by self-symmetric crease bridges. No randomness. */
export function mirrorDropsForFold(leftDrops: readonly InkDrop[]): FoldedInkDrop[] {
  const pairs: FoldedInkDrop[] = [];
  const bridges: FoldedInkDrop[] = [];
  for (const drop of leftDrops) {
    pairs.push(
      { ...drop, satellites: drop.satellites.map((satellite) => ({ ...satellite })), side: "left", kind: "drop" },
      { ...reflect(drop), satellites: drop.satellites.map(reflect), side: "right", kind: "drop" },
    );
    if (drop.x >= 0.42) bridges.push({
      x: 0.5, y: drop.y, r: Math.max(drop.r * 0.45, (0.5 - drop.x) * 0.8),
      elongation: 1.5, angle: 0, satellites: [], side: "crease", kind: "bridge",
    });
  }
  return [...pairs, ...bridges];
}

export function analyzeBlot(leftDrops: readonly InkDrop[]): BlotFeatures {
  const folded = mirrorDropsForFold(leftDrops);
  const ellipses = folded.flatMap((drop) => [drop, ...drop.satellites]).map((ellipse) => {
    const cos = Math.cos(ellipse.angle);
    const sin = Math.sin(ellipse.angle);
    const major = ellipse.r * ellipse.elongation;
    return { ...ellipse, cos, sin, major,
      dx: Math.hypot(major * cos, ellipse.r * sin),
      dy: Math.hypot(major * sin, ellipse.r * cos),
    };
  });
  let top = 1, bottom = 0, left = 0.5, area = 0, weightedY = 0;
  for (const ellipse of ellipses) {
    top = Math.min(top, ellipse.y - ellipse.dy);
    bottom = Math.max(bottom, ellipse.y + ellipse.dy);
    left = Math.min(left, ellipse.x - ellipse.dx);
    const weight = ellipse.r * ellipse.major;
    area += weight;
    weightedY += ellipse.y * weight;
  }
  let covered = 0;
  for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
    if (ellipses.some((ellipse) => {
      const dx = (x + 0.5) / 32 - ellipse.x;
      const dy = (y + 0.5) / 32 - ellipse.y;
      return ((dx * ellipse.cos + dy * ellipse.sin) / ellipse.major) ** 2 +
        ((-dx * ellipse.sin + dy * ellipse.cos) / ellipse.r) ** 2 <= 1;
    })) covered++;
  }
  const center = area ? weightedY / area : 0.5;
  return {
    lobeCount: folded.length,
    splatterCount: folded.reduce((sum, drop) => sum + drop.satellites.length, 0),
    density: covered / 1024,
    verticalSpread: clamp(clamp(bottom, 0, 1) - clamp(top, 0, 1), 0, 1),
    horizontalReach: clamp(1 - 2 * left, 0, 1),
    dominantZone: center < 1 / 3 ? "upper" : center > 2 / 3 ? "lower" : "middle",
    symmetryScore: 1,
  };
}

const densityLabel = (features: BlotFeatures) => features.density < 0.12 ? "light" : features.density < 0.3 ? "moderate" : "high";

export function describeBlotAlt(features: BlotFeatures, blotKey: string): string {
  const label = blotKey.startsWith("daily:") ? `daily plate ${blotKey.slice(6)}` : `seed ${blotKey}`;
  if (features.lobeCount === 0) return `Blank paper (${label}), ready for ink drops and a central fold.`;
  return `Symmetric sumi inkblot (${label}): ${features.lobeCount} lobes mirrored about the central crease, ` +
    `${features.splatterCount} satellite splatters, ${features.dominantZone}-weighted spread, ${densityLabel(features)} ink density, ` +
    `${Math.round(features.verticalSpread * 100)}% paper height and ${Math.round(features.horizontalReach * 100)}% paper width.`;
}

export const INKBLOT_READING_FRAGMENTS = [
  "a moth keeping a library appointment", "two umbrellas exchanging weather", "a teapot practising its bow",
  "a bridge waiting for footsteps", "a cloud with an overdue book", "a beetle carrying a tiny atlas",
  "a pair of gloves applauding quietly", "a kite consulting the wind", "a lantern taking the scenic route",
  "two leaves comparing their journeys", "a moon borrowing a paper coat", "a crab arranging its stationery",
  "a garden gate learning to dance", "a whale rehearsing a whisper", "a fox folding a map",
  "two shoes planning a holiday", "a fern writing in the margins", "a mountain sending a postcard",
  "a boat listening to the rain", "a butterfly with a pocket watch", "a chair dreaming of a forest",
  "a snail delivering a small invitation", "two spoons reflecting on lunch", "a star drying its ink",
] as const;

/** Clinical stationery parody; these sentences describe the paper's imaginary bureaucracy. */
export const INKBLOT_READING_TEMPLATES = [
  "The paper ward files {image} under {fragment}. Its {zone} shelves remain open to other stories.",
  "Plate clerk's report: {lobes} lobes have convened to discuss {image}. The minutes resemble {fragment}.",
  "The fold committee recommends a second look at {image}, preferably in the company of {fragment}.",
  "Today's imaginary prescription for the sheet is more margin space for {image} and {fragment}.",
  "A {density} ink forecast has brought {fragment} to the {zone} edge of {image}.",
  "The paper's chart records {image}; the ink has countersigned with {fragment}.",
  "In the waiting room of this fold, {image} has saved a seat for {fragment}.",
  "The specimen librarian suspects {image} belongs on the same shelf as {fragment}.",
  "The crease's unofficial diagnosis is an abundance of {image}, with a footnote about {fragment}.",
  "The ink porter reports that {fragment} has checked in carrying a sketch of {image}.",
  "The sheet's discharge plan sends {image} through the {zone} door to meet {fragment}.",
  "Under the desk lamp, {image} becomes an honorary colleague of {fragment}.",
  "The archive has reserved {lobes} little alcoves for {image} and one wide margin for {fragment}.",
  "An imaginary ward round finds {image} sharing the {zone} corridor with {fragment}.",
  "The specimen label says {image}; the reverse of the label says {fragment}.",
  "A {spread} arrangement gives {image} room to exchange postcards with {fragment}.",
  "The fold attendant has stamped {image} as suitable company for {fragment}.",
  "This sheet's case conference invites {image} to tell a very small story about {fragment}.",
  "The paper registrar counts {lobes} lobes, then abandons arithmetic in favour of {image} and {fragment}.",
  "A {density} gathering of ink appoints {image} as temporary ambassador to {fragment}.",
  "The blot's visiting hours are reserved for {image}; {fragment} may arrive without an appointment.",
  "The margin department has misfiled {image} beside {fragment}. The paper seems content with this.",
  "Across the crease, {image} sends a quiet memo to {fragment}.",
  "The specimen trolley carries {image} past {lobes} lobes toward {fragment}.",
  "A {spread} paper horizon gives {image} a view of {fragment}.",
  "The ink's fictional chart describes {image} in {density} strokes, followed by {fragment}.",
  "The ward clock has paused while {image} exchanges names with {fragment}.",
  "On the {zone} landing, the fold has arranged a meeting between {image} and {fragment}.",
  "The sheet's imaginary consultant suggests filing {image} as a distant cousin of {fragment}.",
  "The paper canteen serves {image} a generous helping of {fragment}.",
  "A {density} ink tide leaves {image} in the care of {fragment}.",
  "The blot's correspondence desk pairs {image} with a letter from {fragment}.",
  "The {lobes} lobes have elected {image} to escort {fragment} around the crease.",
  "The paper ward's lost-property drawer contains {image} and a note signed by {fragment}.",
  "A {spread} fold gives {image} an unusually spacious address beside {fragment}.",
  "The ink's honorary receptionist announces {image}, followed shortly by {fragment}.",
  "The specimen's {zone} wing has been decorated with {image} for a visit from {fragment}.",
  "The paper's observation window frames {image}; its reflection suggests {fragment}.",
  "The crease clerk certifies that {image} has sufficient room to daydream about {fragment}.",
  "The final entry in this imaginary chart leaves {image} in conversation with {fragment}.",
] as const;

function noteWords(visitorNote: string): string {
  const clean = visitorNote.slice(0, 1024).normalize("NFKC")
    .replace(/<[^>]*>|(?:https?:\/\/|www\.)\S+|\S+@\S+/giu, " ")
    .replace(/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu, " ");
  return (clean.match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu) ?? [])
    .slice(0, 4).map((word) => Array.from(word).slice(0, 24).join("")).join(" ") || "an unnamed paper creature";
}

function featureIdentity(features: BlotFeatures): string {
  return JSON.stringify([features.lobeCount, features.splatterCount, features.density,
    features.verticalSpread, features.horizontalReach, features.dominantZone, features.symmetryScore]);
}

export function generateInkblotReading(blotKey: string, features: BlotFeatures, visitorNote: string): InkblotReading {
  const image = noteWords(visitorNote);
  const identity = hashBlotString(JSON.stringify([blotKey, featureIdentity(features), image]));
  const random = mulberry32(identity);
  const template = INKBLOT_READING_TEMPLATES[Math.floor(random() * INKBLOT_READING_TEMPLATES.length)];
  const fragment = INKBLOT_READING_FRAGMENTS[Math.floor(random() * INKBLOT_READING_FRAGMENTS.length)];
  const slots: Record<string, string> = {
    image, fragment, zone: features.dominantZone, density: densityLabel(features),
    lobes: String(features.lobeCount), spread: features.verticalSpread > 0.6 ? "tall" : "compact",
  };
  return {
    title: `Notes from the ${features.dominantZone} paper ward`,
    plateCode: `INK-${formatBlotSeed(identity).padStart(7, "0").toUpperCase()}`,
    observation: `You saw “${image}” among ${features.lobeCount} ink lobes and ${features.splatterCount} satellite splatters.`,
    interpretation: template.replace(/\{(\w+)\}/g, (_, slot: string) => slots[slot]),
    disclaimer: INKBLOT_DISCLAIMER,
  };
}

export function curatedWardNotes(blotKey: string, features: BlotFeatures): WardNote[] {
  const seed = hashBlotString(`${blotKey}:${featureIdentity(features)}:specimens`);
  const random = mulberry32(seed);
  const start = Math.floor(random() * INKBLOT_READING_FRAGMENTS.length);
  return ["Ward librarian", "Fold attendant", "Ink porter"].map((name, index) => ({
    id: `specimen-${formatBlotSeed(seed)}-${index + 1}`,
    name,
    note: `I see ${INKBLOT_READING_FRAGMENTS[(start + index * 7) % INKBLOT_READING_FRAGMENTS.length]}.`,
    tilt: [-4, -3, -2, -1, 1, 2, 3, 4][Math.floor(random() * 8)],
    hand: Math.floor(random() * 3) as 0 | 1 | 2,
    specimen: true,
  }));
}
