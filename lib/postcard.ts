// A postcard is a sketch, a short note and the moment it was stamped, carried whole in its link as base64url
// JSON, so there is nothing to store. Pure and browser-safe: the picker encodes, the view and the image route
// decode, and anything that fails validate() is a lost postcard, never a page.

// The sheets a postcard may carry: the sketchbook's twelve (lib/sketches.ts BASE_SKETCHES, pinned by
// lib/postcard.test.ts). An id outside this list is rejected, so a link can never point the image route at a
// file of its own choosing.
export const POSTCARD_SKETCHES = [
  { id: "cove", src: "/sketches/01-cove.jpg", title: "Cove" },
  { id: "alley", src: "/sketches/02-alley.jpg", title: "Alley" },
  { id: "lake", src: "/sketches/03-lake.jpg", title: "Lake" },
  { id: "terraces", src: "/sketches/04-terraces.jpg", title: "Terraces" },
  { id: "cafe", src: "/sketches/05-cafe.jpg", title: "Cafe street" },
  { id: "canyon", src: "/sketches/06-canyon.jpg", title: "Canyon" },
  { id: "cup", src: "/sketches/07-cup.jpg", title: "Cup" },
  { id: "key", src: "/sketches/08-key.jpg", title: "Key" },
  { id: "glasses", src: "/sketches/09-glasses.jpg", title: "Glasses" },
  { id: "flower", src: "/sketches/10-flower.jpg", title: "Jam jar" },
  { id: "peach", src: "/sketches/11-peach.jpg", title: "Peach" },
  { id: "wallet", src: "/sketches/12-wallet.jpg", title: "Wallet" },
] as const;

export type PostcardSketch = (typeof POSTCARD_SKETCHES)[number];
export type SketchId = PostcardSketch["id"];

export type Postcard = { sketch: SketchId; note: string; ts: number };

// The note's cap, in characters (code points, so an emoji is one).
export const NOTE_MAX = 140;
// A code longer than any valid postcard can be is refused before it is decoded.
export const CODE_MAX = 1024;
// Stamps from before the site and after 2100 are not real postmarks.
const TS_MIN = Date.UTC(2020, 0, 1);
const TS_MAX = Date.UTC(2100, 0, 1);

export function sketchById(id: string): PostcardSketch | undefined {
  return POSTCARD_SKETCHES.find((s) => s.id === id);
}

export function isSketchId(id: unknown): id is SketchId {
  return typeof id === "string" && sketchById(id) !== undefined;
}

// C0 and C1 controls, DEL, and the bidi embeddings, overrides and isolates that could flip the note's text
// around a name. Line breaks and tabs become one space first, so a two-line note stays two words apart.
const CONTROL = /[\u0000-\u001f\u007f-\u009f‎‏‪-‮⁦-⁩]/g;

// The note with its controls gone and runs of space collapsed, trimmed.
function stripNote(raw: string): string {
  return raw
    .replace(/[\r\n\t]+/g, " ")
    .replace(CONTROL, "")
    .replace(/ {2,}/g, " ")
    .trim();
}

const length = (text: string) => Array.from(text).length;

// How long the note will read once stripped, before any cut: what the picker counts against NOTE_MAX.
export const noteLength = (raw: string) => length(stripNote(raw));

// The note as the picker may stamp it: stripped, then cut to NOTE_MAX code points (never through a
// surrogate pair).
export function cleanNote(raw: string): string {
  return Array.from(stripNote(raw)).slice(0, NOTE_MAX).join("").trimEnd();
}

export type Validation = { ok: true; postcard: Postcard } | { ok: false; error: string };

// Anything claiming to be a postcard: the sketch must be on the list, the note a string of at most NOTE_MAX
// characters once stripped (a longer one is refused, not cut), and ts a whole millisecond between 2020 and 2100.
export function validatePostcard(input: unknown): Validation {
  if (typeof input !== "object" || input === null || Array.isArray(input)) return { ok: false, error: "not an object" };
  const { sketch, note, ts } = input as Record<string, unknown>;
  if (!isSketchId(sketch)) return { ok: false, error: "unknown sketch" };
  if (typeof note !== "string") return { ok: false, error: "note is not a string" };
  const clean = stripNote(note);
  if (length(clean) > NOTE_MAX) return { ok: false, error: "note is too long" };
  if (typeof ts !== "number" || !Number.isInteger(ts) || ts < TS_MIN || ts > TS_MAX) {
    return { ok: false, error: "bad timestamp" };
  }
  return { ok: true, postcard: { sketch, note: clean, ts } };
}

function toBase64Url(text: string): string {
  let binary = "";
  for (const byte of new TextEncoder().encode(text)) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(code: string): string {
  const b64 = code.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
  return new TextDecoder("utf-8", { fatal: true }).decode(Uint8Array.from(binary, (c) => c.charCodeAt(0)));
}

// The link's code: short keys, the note cleaned first, so what is encoded is exactly what will be shown.
export function encodePostcard(postcard: Postcard): string {
  const checked = validatePostcard(postcard);
  if (!checked.ok) throw new Error(`not a postcard: ${checked.error}`);
  const { sketch, note, ts } = checked.postcard;
  return toBase64Url(JSON.stringify({ s: sketch, n: note, t: ts }));
}

// A code back to its postcard, or null for anything that is not one: too long, not base64url, not UTF-8,
// not JSON, or not a valid postcard.
export function decodePostcard(code: string | null | undefined): Postcard | null {
  if (typeof code !== "string" || code.length === 0 || code.length > CODE_MAX) return null;
  if (!/^[A-Za-z0-9_-]+$/.test(code)) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(fromBase64Url(code));
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;
  const { s, n, t } = parsed as Record<string, unknown>;
  const checked = validatePostcard({ sketch: s, note: n, ts: t });
  return checked.ok ? checked.postcard : null;
}

// The view and the image of a code, as site paths.
export function postcardPaths(code: string): { view: string; image: string } {
  const q = `?c=${encodeURIComponent(code)}`;
  return { view: `/postcard/view${q}`, image: `/postcard/image${q}` };
}

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

// The date a postmark rings, in UTC so the server and every visitor read the same day: "26 OCT 2026".
export function postmarkDate(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getUTCDate()).padStart(2, "0")} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

// The PNG's download name: postcard-cove-2026-10-26.png.
export function postcardFilename(postcard: Postcard): string {
  return `postcard-${postcard.sketch}-${new Date(postcard.ts).toISOString().slice(0, 10)}.png`;
}
