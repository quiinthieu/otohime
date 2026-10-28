import type { Note } from "../../../../../content/site.ts";

/** Sparse notes still need a stable, addressable identity. */
export type SkyNote = Readonly<Pick<Note, "slug"> & Partial<Pick<Note, "title" | "body" | "date">>> & {
  readonly tags?: readonly string[];
};

export type SkyStar = {
  slug: string;
  title: string;
  tags: string[];
  x: number;
  y: number;
  radius: number;
  brightness: number;
};

export type SkyEdge = { from: string; to: string; tag: string };
export type SkyConstellation = { tag: string; name: string; slugs: string[] };
export type SkyChart = {
  width: number;
  height: number;
  stars: SkyStar[];
  edges: SkyEdge[];
  constellations: SkyConstellation[];
};

export const SKY_SCALE = {
  minRadius: 5,
  maxRadius: 14,
  fullSizeLength: 2000,
  minBrightness: 0.35,
  fadeDays: 730,
} as const;

const DAY_MS = 86_400_000;
const MARGIN = 48;
const MIN_CELL = 96;
const MAX_JITTER = 24;
const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/** FNV-1a over UTF-16 code units: stable in both server and browser JS. */
function seed(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash = Math.imul(hash ^ value.charCodeAt(i), 16777619);
  }
  return hash >>> 0;
}

function jitter(key: string): number {
  return (seed(key) / 0xffffffff * 2 - 1) * MAX_JITTER;
}

/** Calendar dates only; never parse local time or fall back to the wall clock. */
function utcDay(value: string): number | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const milliseconds = Date.parse(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(milliseconds)) return undefined;
  if (new Date(milliseconds).toISOString().slice(0, 10) !== value) return undefined;
  return milliseconds / DAY_MS;
}

type NormalizedNote = { slug: string; title: string; body: string; date: string; tags: string[] };

function normalize(note: unknown): NormalizedNote | undefined {
  if (typeof note !== "object" || note === null) return undefined;
  const fields = note as Record<string, unknown>;
  if (typeof fields.slug !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(fields.slug)) return undefined;
  return {
    slug: fields.slug,
    title: typeof fields.title === "string" && fields.title.trim() ? fields.title : fields.slug,
    body: typeof fields.body === "string" ? fields.body : "",
    date: typeof fields.date === "string" ? fields.date : "",
    tags: Array.isArray(fields.tags)
      ? [...new Set(fields.tags.filter((tag): tag is string => typeof tag === "string")
        .map((tag) => tag.trim()).filter(Boolean))].sort(compare)
      : [],
  };
}

const ADJECTIVES = ["Sleepy", "Inky", "Wandering", "Tiny", "Curious", "Paper", "Moonlit", "Dancing"];
const FIGURES = ["Teapot", "Crane", "Moth", "Kite", "Fox", "Lantern", "Whale", "Umbrella"];

function constellationName(tag: string): string {
  return `The ${ADJECTIVES[seed(`adjective:${tag}`) % ADJECTIVES.length]} ${FIGURES[seed(`figure:${tag}`) % FIGURES.length]}`;
}

/**
 * Build serializable SVG chart data without randomness, ambient dates or input mutation.
 * Pass the same YYYY-MM-DD reference date to server and client. Invalid note dates
 * use the visible brightness floor; future notes are capped at full brightness.
 * Missing fields get safe defaults, invalid identities are skipped, and duplicate
 * slugs select the lexicographically first normalized record, independent of order.
 * Cells grow the canvas beyond its 960×640 minimum when necessary, so even dense
 * charts retain at least 48 units between centers (maximum star diameter is 28).
 * Placement is stable for the same slug set; adding/removing notes may reflow it.
 */
export function buildSky(notes: readonly SkyNote[], referenceDate: string): SkyChart {
  const referenceDay = utcDay(referenceDate);
  if (referenceDay === undefined) throw new RangeError("Sky referenceDate must be a valid YYYY-MM-DD date");

  const normalized = notes.map(normalize).filter((note) => note !== undefined)
    .sort((a, b) => compare(a.slug, b.slug) || compare(JSON.stringify(a), JSON.stringify(b)));
  const unique = normalized.filter((note, index) => index === 0 || normalized[index - 1].slug !== note.slug);
  // Sort spatial assignment by a slug seed, then return stars in canonical slug order.
  const placementOrder = [...unique].sort((a, b) => seed(a.slug) - seed(b.slug) || compare(a.slug, b.slug));
  const columns = Math.max(1, Math.round(Math.sqrt(unique.length * 1.5)));
  const rows = Math.max(1, Math.ceil(unique.length / columns));
  const width = Math.max(960, columns * MIN_CELL + MARGIN * 2);
  const height = Math.max(640, rows * MIN_CELL + MARGIN * 2);
  const cellWidth = (width - MARGIN * 2) / columns;
  const cellHeight = (height - MARGIN * 2) / rows;

  const stars = placementOrder.map((note, index): SkyStar => {
    const noteDay = utcDay(note.date);
    const age = noteDay === undefined ? SKY_SCALE.fadeDays : Math.max(0, referenceDay - noteDay);
    return {
      slug: note.slug,
      title: note.title,
      tags: note.tags,
      x: MARGIN + (index % columns + 0.5) * cellWidth + jitter(`x:${note.slug}`),
      y: MARGIN + (Math.floor(index / columns) + 0.5) * cellHeight + jitter(`y:${note.slug}`),
      radius: SKY_SCALE.minRadius + (SKY_SCALE.maxRadius - SKY_SCALE.minRadius)
        * Math.min(1, note.body.length / SKY_SCALE.fullSizeLength),
      brightness: 1 - (1 - SKY_SCALE.minBrightness) * Math.min(1, age / SKY_SCALE.fadeDays),
    };
  }).sort((a, b) => compare(a.slug, b.slug));

  const groups = new Map<string, string[]>();
  for (const star of stars) {
    for (const tag of star.tags) {
      const members = groups.get(tag) ?? [];
      members.push(star.slug);
      groups.set(tag, members);
    }
  }
  const constellations = [...groups].filter(([, members]) => members.length > 1)
    .sort(([a], [b]) => compare(a, b))
    .map(([tag, slugs]) => ({ tag, name: constellationName(tag), slugs }));
  // A chain per tag keeps every member connected with n-1 lines rather than a clique.
  const edges = constellations.flatMap(({ tag, slugs }) => slugs.slice(1)
    .map((to, index) => ({ from: slugs[index], to, tag })));

  return { width, height, stars, edges, constellations };
}
