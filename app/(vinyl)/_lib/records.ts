// The crate: what a record is, the rules records.json must keep, and the pure
// helpers the page reads (genres, search, the watch link, label art). The JSON
// is data only; the page imports it and calls parseRecords, tests and the
// checker read it from disk.

export type Rpm = 33 | 45;
export type Side = "A" | "B";
export type Track = { side: Side; title: string; youtubeVideoId: string };

export type VinylRecord = {
  id: string;
  title: string;
  artist: string;
  year: number;
  genre: string;
  coverArtUrl: string; // "procedural:<seed>" or a path on this site; never a YouTube thumbnail
  labelColor: string; // #rrggbb
  accentColor: string; // #rrggbb
  rpm: Rpm;
  youtubeVideoId: string;
  startSeconds?: number;
  endSeconds?: number;
  youtubePlaylistId?: string;
  tracks?: Track[];
  placeholder?: true; // listed in the README, to be replaced
};

export const MIN_RECORDS = 12;
export const MIN_CONTRAST = 4.5;
export const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
export const PLAYLIST_ID = /^[A-Za-z0-9_-]{10,64}$/;
const HEX = /^#[0-9a-f]{6}$/i;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const REQUIRED = ["id", "title", "artist", "genre", "coverArtUrl", "labelColor", "accentColor", "youtubeVideoId"] as const;
const KNOWN = new Set<string>([
  ...REQUIRED,
  "year",
  "rpm",
  "startSeconds",
  "endSeconds",
  "youtubePlaylistId",
  "tracks",
  "placeholder",
]);

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const nonEmpty = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;

// Relative luminance and contrast ratio, as WCAG 2 defines them.
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

// Black or white, whichever reads better on the label.
export function labelText(record: Pick<VinylRecord, "labelColor">): "#000000" | "#ffffff" {
  return contrast("#000000", record.labelColor) >= contrast("#ffffff", record.labelColor) ? "#000000" : "#ffffff";
}

const thumbnailHost = (url: string) => /ytimg\.com|youtube\.com|youtu\.be|ggpht\.com/i.test(url);

function validateRecord(r: unknown, at: string, errors: string[], warnings: string[]) {
  if (!isObject(r)) {
    errors.push(`${at}: not an object`);
    return;
  }
  for (const key of REQUIRED) if (!nonEmpty(r[key])) errors.push(`${at}: ${key} must be a non-empty string`);
  for (const key of Object.keys(r)) if (!KNOWN.has(key)) warnings.push(`${at}: unknown field ${key}`);

  if (nonEmpty(r.id) && !SLUG.test(r.id)) errors.push(`${at}: id must be lower-case words joined by hyphens`);
  const year = new Date().getFullYear();
  if (!Number.isInteger(r.year) || (r.year as number) < 1900 || (r.year as number) > year) {
    errors.push(`${at}: year must be a whole year from 1900 to ${year}`);
  }
  if (r.rpm !== 33 && r.rpm !== 45) errors.push(`${at}: rpm must be 33 or 45`);
  if (nonEmpty(r.youtubeVideoId) && !VIDEO_ID.test(r.youtubeVideoId)) errors.push(`${at}: youtubeVideoId must be 11 characters of A-Z a-z 0-9 _ -`);
  if (r.youtubePlaylistId !== undefined && !(typeof r.youtubePlaylistId === "string" && PLAYLIST_ID.test(r.youtubePlaylistId))) {
    errors.push(`${at}: youtubePlaylistId must be 10 to 64 characters of A-Z a-z 0-9 _ -`);
  }
  for (const key of ["labelColor", "accentColor"] as const) {
    if (nonEmpty(r[key]) && !HEX.test(r[key])) errors.push(`${at}: ${key} must be #rrggbb`);
  }
  if (typeof r.labelColor === "string" && HEX.test(r.labelColor)) {
    const ratio = contrast(labelText({ labelColor: r.labelColor }), r.labelColor);
    if (ratio < MIN_CONTRAST) errors.push(`${at}: label text contrast ${ratio.toFixed(2)} is under ${MIN_CONTRAST}`);
  }

  if (nonEmpty(r.coverArtUrl)) {
    const url = r.coverArtUrl;
    if (thumbnailHost(url)) errors.push(`${at}: coverArtUrl must not be a YouTube thumbnail`);
    else if (!/^procedural:\S+$/.test(url) && !/^\/(?!\/)\S*$/.test(url)) {
      errors.push(`${at}: coverArtUrl must be "procedural:<seed>" or a path starting with /`);
    }
  }

  const { startSeconds: start, endSeconds: end } = r;
  for (const [key, v] of [["startSeconds", start], ["endSeconds", end]] as const) {
    if (v !== undefined && !(typeof v === "number" && Number.isFinite(v) && v >= 0)) errors.push(`${at}: ${key} must be a number ≥ 0`);
  }
  if (typeof start === "number" && typeof end === "number" && !(start < end)) errors.push(`${at}: startSeconds must be before endSeconds`);

  if (r.tracks !== undefined) {
    if (!Array.isArray(r.tracks) || r.tracks.length === 0) errors.push(`${at}: tracks must be a non-empty list`);
    else
      r.tracks.forEach((t, j) => {
        const where = `${at}.tracks[${j}]`;
        if (!isObject(t)) return errors.push(`${where}: not an object`);
        if (t.side !== "A" && t.side !== "B") errors.push(`${where}: side must be "A" or "B"`);
        if (!nonEmpty(t.title)) errors.push(`${where}: title must be a non-empty string`);
        if (!(typeof t.youtubeVideoId === "string" && VIDEO_ID.test(t.youtubeVideoId))) errors.push(`${where}: youtubeVideoId must be 11 characters of A-Z a-z 0-9 _ -`);
      });
  }
  if (r.placeholder !== undefined && r.placeholder !== true) errors.push(`${at}: placeholder is either true or absent`);
}

// Everything wrong with a records.json, as errors (refuse to ship) and
// warnings (ship, but look). Repeated video ids are only warnings, so the
// placeholder crate stays green until its ids are replaced.
export function validateRecords(raw: unknown): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!Array.isArray(raw)) return { errors: ["records must be a list"], warnings };
  if (raw.length < MIN_RECORDS) errors.push(`there must be at least ${MIN_RECORDS} records, found ${raw.length}`);

  const ids = new Map<string, number>();
  const videos = new Map<string, string>();
  raw.forEach((r, i) => {
    const at = isObject(r) && nonEmpty(r.id) ? `records[${i}] (${r.id})` : `records[${i}]`;
    validateRecord(r, at, errors, warnings);
    if (!isObject(r)) return;
    if (nonEmpty(r.id)) {
      if (ids.has(r.id)) errors.push(`${at}: id repeats records[${ids.get(r.id)}]`);
      else ids.set(r.id, i);
    }
    if (nonEmpty(r.youtubeVideoId)) {
      const first = videos.get(r.youtubeVideoId);
      if (first) warnings.push(`${at}: video ${r.youtubeVideoId} is also on ${first}`);
      else videos.set(r.youtubeVideoId, String(r.id));
    }
  });
  return { errors, warnings };
}

export function parseRecords(raw: unknown): VinylRecord[] {
  const { errors } = validateRecords(raw);
  if (errors.length) throw new Error(`records.json is invalid:\n${errors.join("\n")}`);
  return raw as VinylRecord[];
}

// Every video a record can play: its own and its tracks', each once.
export function videoIds(record: VinylRecord): string[] {
  return [...new Set([record.youtubeVideoId, ...(record.tracks ?? []).map((t) => t.youtubeVideoId)])];
}

export function genres(records: readonly VinylRecord[]): string[] {
  return [...new Set(records.map((r) => r.genre))].sort((a, b) => a.localeCompare(b));
}

export function filterRecords(records: readonly VinylRecord[], { query = "", genre = "" }: { query?: string; genre?: string }): VinylRecord[] {
  const q = query.trim().toLowerCase();
  return records.filter(
    (r) => (!genre || r.genre === genre) && (!q || r.title.toLowerCase().includes(q) || r.artist.toLowerCase().includes(q)),
  );
}

export function watchUrl(record: Pick<VinylRecord, "youtubeVideoId">): string {
  return `https://www.youtube.com/watch?v=${record.youtubeVideoId}`;
}

// FNV-1a, so a record's art is the same on every render and every machine.
export function seedOf(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193);
  return h >>> 0;
}

// A small deterministic generator for the art's choices.
function random(seed: number) {
  let s = seed || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 0x100000000;
  };
}

export type LabelArt = {
  seed: number;
  background: string;
  accent: string;
  text: "#000000" | "#ffffff";
  rings: number[]; // radii as fractions of the label's radius, outermost first
  arc: { start: number; sweep: number }; // degrees, for the title set on a curve
  rotation: number; // degrees, so labels don't all line up
};

// The parameters of a record's centre label; the turntable and the sleeve draw
// from these, so no image is ever fetched.
export function labelArt(record: VinylRecord): LabelArt {
  const seed = seedOf(record.id);
  const next = random(seed);
  const count = 2 + Math.floor(next() * 3);
  const rings = Array.from({ length: count }, (_, i) => Number((0.94 - i * (0.5 / count) - next() * 0.04).toFixed(3)));
  const sweep = 140 + Math.round(next() * 80);
  return {
    seed,
    background: record.labelColor,
    accent: record.accentColor,
    text: labelText(record),
    rings,
    arc: { start: -90 - sweep / 2, sweep },
    rotation: Math.round(next() * 360),
  };
}
