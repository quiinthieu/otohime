// Ink ghosts wire protocol, shared by the Cloudflare Worker, the local fake and
// (later) the browser client. Pure: no DOM, Node or Workers APIs beyond
// TextEncoder, so every runtime imports the same file.

/** Total sockets one room accepts; the 25th gets {t:"full"} and close 1013. */
export const ROOM_CAP = 24;
/** Largest accepted client frame, in UTF-8 bytes. */
export const MAX_FRAME_BYTES = 128;
/** Token bucket per connection: capacity and refill per second, counted over every incoming frame. */
export const RATE_CAPACITY = 15;
export const RATE_REFILL_PER_SECOND = 15;
/** Invalid frames (malformed, oversize, binary) before the socket is closed 1008. */
export const MAX_INVALID = 5;

export const CLOSE_POLICY = 1008;
export const CLOSE_FULL = 1013;
export const CLOSE_NORMAL = 1000;

/** Coordinates leave the server rounded to this many decimals, which bounds every outgoing frame. */
const COORD_DECIMALS = 4;

export type ClientMessage = { t: "m" | "c"; x: number; y: number };

export type ServerMessage =
  | { t: "hi"; id: string; n: number }
  | { t: "m"; id: string; x: number; y: number }
  | { t: "c"; id: string; x: number; y: number }
  | { t: "bye"; id: string }
  | { t: "n"; n: number }
  | { t: "full" };

export type FrameRejection = "binary" | "oversize" | "malformed";

export type ParsedFrame = { ok: true; msg: ClientMessage } | { ok: false; reason: FrameRejection };

const encoder = new TextEncoder();

/** UTF-8 length of a string, stopping early once it is known to exceed the cap. */
export function utf8Bytes(text: string): number {
  // Every UTF-16 code unit is at least one UTF-8 byte, so a long string is oversize without encoding it.
  if (text.length > MAX_FRAME_BYTES) return text.length;
  return encoder.encode(text).length;
}

/** Clamps a finite number into [0, 1] and rounds it; anything else is null. */
export function normalizeCoord(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const clamped = Math.min(1, Math.max(0, value));
  const scale = 10 ** COORD_DECIMALS;
  return Math.round(clamped * scale) / scale;
}

/**
 * Parses one incoming WebSocket frame. Only text frames holding a JSON object
 * {t:"m"|"c", x:number, y:number} pass; other fields (an id, for instance) are
 * ignored, never echoed.
 */
export function parseClientFrame(data: unknown): ParsedFrame {
  if (typeof data !== "string") return { ok: false, reason: "binary" };
  if (utf8Bytes(data) > MAX_FRAME_BYTES) return { ok: false, reason: "oversize" };
  let value: unknown;
  try {
    value = JSON.parse(data);
  } catch {
    return { ok: false, reason: "malformed" };
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return { ok: false, reason: "malformed" };
  }
  const { t, x, y } = value as Record<string, unknown>;
  if (t !== "m" && t !== "c") return { ok: false, reason: "malformed" };
  const nx = normalizeCoord(x);
  const ny = normalizeCoord(y);
  if (nx === null || ny === null) return { ok: false, reason: "malformed" };
  return { ok: true, msg: { t, x: nx, y: ny } };
}

export function encodeServerMessage(msg: ServerMessage): string {
  return JSON.stringify(msg);
}
