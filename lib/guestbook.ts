import { createHmac } from "node:crypto";

export type Stroke = { c: 0 | 1 | 2; p: number[]; w: number[]; t0: number; d: number };
export type GuestbookPayload = { v: 1; name: string; note: string; durationMs: number; strokes: Stroke[] };
export type PublicEntry = GuestbookPayload & { id: string; tilt: number; tape: number; createdAt: string };
export type Admission = { id: string; payload: GuestbookPayload; pointCount: number; byteCount: number; tilt: number; tape: number; hour: string; day: string; now: Date };
export type AdmissionResult = { kind: "accepted"; id: string } | { kind: "hour_limit" | "day_limit" | "queue_full" };
export type GuestbookStore = { admit(input: Admission): Promise<AdmissionResult>; list(cursor: Cursor | null): Promise<{ entries: PublicEntry[]; nextCursor: string | null }> };
export type Cursor = { createdAt: string; id: string };
export type ValidationResult = { ok: true; payload: GuestbookPayload; pointCount: number; byteCount: number } | { ok: false; reason: "shape" | "vector_large" | "text" | "profanity" | "url" | "honeypot" };

const keys = (value: Record<string, unknown>, allowed: string[]) => Object.keys(value).every((key) => allowed.includes(key));
const object = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const int = (value: unknown, min: number, max: number): value is number => Number.isInteger(value) && (value as number) >= min && (value as number) <= max;
const text = (value: string) => value.normalize("NFKC").replace(/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu, " ").replace(/\s+/gu, " ").trim();
const url = /(?:\b(?:https?|ftp):\/\/|\bwww\.|\b[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9-]+)*\.[a-z]{2,}\b|\b\d{1,3}(?:\.\d{1,3}){3}\b)/i;
const banned = ["fuck", "shit", "bitch", "cunt", "nigger", "faggot"];
function profane(value: string): boolean {
  const words = value.toLowerCase().replace(/[013457@$]/g, (c) => ({ "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "@": "a", "$": "s" })[c] ?? c).match(/[a-z]+/g) ?? [];
  return words.some((word) => banned.includes(word)) || banned.some((word) => new RegExp(`(?:^|[^a-z])${word.split("").join("[ ._-]*")}(?:$|[^a-z])`, "i").test(value));
}
export function validateGuestbook(value: unknown): ValidationResult {
  if (!object(value) || !keys(value, ["v", "name", "note", "durationMs", "website", "strokes"]) || value.v !== 1 || !int(value.durationMs, 0, 60000) || !Array.isArray(value.strokes) || value.strokes.length < 1 || value.strokes.length > 40) return { ok: false, reason: "shape" };
  if (value.website !== undefined && (typeof value.website !== "string" || value.website !== "")) return { ok: false, reason: "honeypot" };
  if ((value.name !== undefined && typeof value.name !== "string") || (value.note !== undefined && typeof value.note !== "string")) return { ok: false, reason: "text" };
  const name = text((value.name as string | undefined) ?? "");
  const note = text((value.note as string | undefined) ?? "");
  if ([...name].length > 24 || [...note].length > 80) return { ok: false, reason: "text" };
  if (url.test(`${name} ${note}`)) return { ok: false, reason: "url" };
  if (profane(`${name} ${note}`)) return { ok: false, reason: "profanity" };
  let points = 0;
  let start = 0;
  for (const stroke of value.strokes) {
    if (!object(stroke) || !keys(stroke, ["c", "p", "w", "t0", "d"]) || !int(stroke.c, 0, 2) || !Array.isArray(stroke.p) || !Array.isArray(stroke.w) || stroke.p.length < 4 || stroke.p.length % 2 || stroke.w.length !== stroke.p.length / 2 || !int(stroke.t0, 0, 60000) || !int(stroke.d, 1, 60000) || (stroke.t0 as number) < start || (stroke.t0 as number) + (stroke.d as number) > value.durationMs) return { ok: false, reason: "shape" };
    for (let i = 0; i < stroke.p.length; i++) if (!int(stroke.p[i], 0, i % 2 ? 160 : 240)) return { ok: false, reason: "shape" };
    if (!stroke.w.every((width) => int(width, 1, 15))) return { ok: false, reason: "shape" };
    points += stroke.w.length;
    if (points > 1500) return { ok: false, reason: "vector_large" };
    start = stroke.t0 as number;
  }
  const byteCount = Buffer.byteLength(JSON.stringify(value.strokes), "utf8");
  if (byteCount > 6144) return { ok: false, reason: "vector_large" };
  return { ok: true, payload: { v: 1, name, note, durationMs: value.durationMs as number, strokes: value.strokes as Stroke[] }, pointCount: points, byteCount };
}
export function buckets(ip: string, now: Date, secret: string) {
  const who = createHmac("sha256", secret).update(`guestbook:ip:${ip}`).digest("hex");
  const iso = now.toISOString();
  return { hour: `guestbook:ip:${who}:${iso.slice(0, 13)}`, day: `guestbook:day:${iso.slice(0, 10)}` };
}
export function clientIp(headers: Headers): string {
  return headers.get("x-real-ip")?.trim() || headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}
export function encodeCursor(cursor: Cursor): string { return Buffer.from(JSON.stringify(cursor)).toString("base64url"); }
export function decodeCursor(value: string): Cursor | null {
  if (!/^[A-Za-z0-9_-]{1,300}$/.test(value)) return null;
  try {
    const parsed: unknown = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    if (!object(parsed) || !keys(parsed, ["createdAt", "id"]) || typeof parsed.createdAt !== "string" || typeof parsed.id !== "string" || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{6}Z$/.test(parsed.createdAt) || !Number.isFinite(Date.parse(parsed.createdAt)) || !/^[0-9a-f]{8}-[0-9a-f-]{27,36}$/i.test(parsed.id)) return null;
    return encodeCursor(parsed as Cursor) === value ? parsed as Cursor : null;
  } catch { return null; }
}
