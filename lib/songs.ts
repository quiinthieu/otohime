// Rules for the songs owners add to /music. Pure: no React, no db, so `npm test` loads it as-is.
import type { Swatch } from "../components/figures";

export const SWATCH_KEYS = ["yellow", "coral", "mint", "blue", "pink"] as const;

// Compile-time, both ways: a Swatch missing from SWATCH_KEYS, or a key that isn't a Swatch, fails here.
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : never) : never;
const _swatchKeysMatch: Same<(typeof SWATCH_KEYS)[number], Swatch> = true;
void _swatchKeysMatch;

export const MAX_ADDED_SONGS = 12;
export const LIMITS = { title: 80, artist: 80, note: 200 };

export type SongInput = {
  title: string;
  artist: string;
  note: string;
  colour: Swatch;
  video: string;
};
export type SongField = keyof SongInput;

const ID = /^[A-Za-z0-9_-]{11}$/;
const HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtu.be",
  "youtube-nocookie.com",
  "www.youtube-nocookie.com",
]);
const PATH_KINDS = new Set(["shorts", "embed", "live"]);

/** The 11-character video id from a bare id or a YouTube link, or null. */
export function parseVideoId(input: string): string | null {
  const text = typeof input === "string" ? input.trim() : "";
  if (ID.test(text)) return text;
  if (!text) return null;
  let url: URL;
  try {
    // "javascript:alert(1)" becomes https://javascript:alert(1), a bad port, so it throws
    url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
  } catch {
    return null;
  }
  if (url.username || url.password || url.port) return null;
  const host = url.hostname.toLowerCase();
  if (!HOSTS.has(host)) return null;
  const parts = url.pathname.split("/").filter(Boolean);
  let id: string | null | undefined;
  if (host === "youtu.be") {
    id = parts.length === 1 ? parts[0] : null;
  } else if (parts.length === 1 && parts[0] === "watch") {
    id = url.searchParams.get("v");
  } else if (parts.length === 2 && PATH_KINDS.has(parts[0])) {
    id = parts[1];
  }
  return id && ID.test(id) ? id : null;
}

const str = (v: unknown) => (typeof v === "string" ? v.trim() : undefined);

export function parseSong(
  fields: Record<string, unknown>,
):
  | { ok: true; song: SongInput }
  | { ok: false; errors: Partial<Record<SongField, string>> } {
  const errors: Partial<Record<SongField, string>> = {};
  const get = (k: string) => (Object.hasOwn(fields, k) ? fields[k] : undefined);

  const rawVideo = str(get("video"));
  const video = rawVideo === undefined ? null : parseVideoId(rawVideo);
  if (!video) errors.video = "Paste a YouTube link or video id.";

  const text = (key: "title" | "artist", label: string) => {
    const v = str(get(key));
    if (v === undefined || v.length < 1) errors[key] = `Add ${label}.`;
    else if (v.length > LIMITS[key]) errors[key] = `Keep ${label} to ${LIMITS[key]} characters.`;
    return v ?? "";
  };
  const title = text("title", "a title");
  const artist = text("artist", "an artist");

  const rawNote = get("note");
  const note = rawNote === undefined || rawNote === null ? "" : str(rawNote);
  if (note === undefined) errors.note = "The note must be text.";
  else if (note.length > LIMITS.note) errors.note = `Keep the note to ${LIMITS.note} characters.`;

  const colour = str(get("colour"));
  if (colour === undefined || !(SWATCH_KEYS as readonly string[]).includes(colour)) {
    errors.colour = "Pick one of the colours.";
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    song: { title, artist, note: note ?? "", colour: colour as Swatch, video: video as string },
  };
}
