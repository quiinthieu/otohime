import { randomUUID } from "node:crypto";
import { buckets, clientIp, decodeCursor, validateGuestbook, type GuestbookStore } from "./guestbook.ts";

export type GuestbookEnv = { DATABASE_URL?: string; BETTER_AUTH_SECRET?: string; BETTER_AUTH_URL?: string };
export type GuestbookDeps = { store?: GuestbookStore; env: GuestbookEnv; now?: () => Date; id?: () => string; decoration?: () => { tilt: number; tape: number }; log?: (reason: string, requestId: string) => void };
const headers = { "cache-control": "no-store" };
const json = (value: unknown, status = 200, extra: Record<string, string> = {}) => Response.json(value, { status, headers: { ...headers, ...extra } });
const messages: Record<string, string> = {
  shape: "Please check the drawing data and try again.", vector_large: "This drawing has too many marks.", text: "Please shorten or check your name and note.", profanity: "Please choose kinder words.", url: "Links are not allowed in the guestbook.", honeypot: "Please submit the drawing form directly.", json: "Please send valid JSON.", media_type: "Please send JSON.", origin: "Please submit from this site.", body_large: "This drawing is too large.", hour_limit: "Please try again next hour.", day_limit: "The guestbook is busy today. Please try tomorrow.", queue_full: "The review queue is full. Please try later.", unavailable: "The guestbook is temporarily unavailable.", cursor: "That page link is invalid.",
};
const fail = (reason: string, status: number, extra: Record<string, string> = {}) => json({ reason, message: messages[reason] }, status, extra);
async function readCapped(request: Request): Promise<string | null> {
  const declared = request.headers.get("content-length");
  if (declared !== null && Number(declared) > 8192) return null;
  if (!request.body) return "";
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 8192) { await reader.cancel(); return null; }
    chunks.push(value);
  }
  return new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks));
}
export async function guestbookPost(request: Request, deps: GuestbookDeps): Promise<Response> {
  const requestId = randomUUID();
  if (!deps.env.DATABASE_URL || !deps.env.BETTER_AUTH_SECRET || !deps.store) return fail("unavailable", 503);
  if (!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(request.headers.get("content-type") ?? "")) return fail("media_type", 415);
  const origin = request.headers.get("origin");
  if (origin) {
    let expected: string;
    try { expected = new URL(deps.env.BETTER_AUTH_URL ?? "").origin; } catch { return fail("unavailable", 503); }
    if (origin !== expected) return fail("origin", 403);
  }
  let body: string | null;
  try { body = await readCapped(request); } catch { return fail("json", 400); }
  if (body === null) return fail("body_large", 413);
  let value: unknown;
  try { value = JSON.parse(body); } catch { return fail("json", 400); }
  const valid = validateGuestbook(value);
  if (!valid.ok) return fail(valid.reason, valid.reason === "vector_large" ? 413 : 400);
  const now = (deps.now ?? (() => new Date()))();
  const id = (deps.id ?? randomUUID)();
  const decoration = (deps.decoration ?? (() => ({ tilt: Math.floor(Math.random() * 9) - 4, tape: Math.floor(Math.random() * 4) })))();
  const keys = buckets(clientIp(request.headers), now, deps.env.BETTER_AUTH_SECRET);
  try {
    const result = await deps.store.admit({ id, payload: valid.payload, pointCount: valid.pointCount, byteCount: valid.byteCount, ...decoration, ...keys, now });
    if (result.kind === "accepted") return json({ id: result.id, status: "pending" }, 201);
    if (result.kind === "queue_full") return fail(result.kind, 503);
    return fail(result.kind, 429, { "retry-after": result.kind === "hour_limit" ? "3600" : "86400" });
  } catch { deps.log?.("write_failed", requestId); return fail("unavailable", 503); }
}
export async function guestbookGet(request: Request, deps: GuestbookDeps): Promise<Response> {
  const requestId = randomUUID();
  const params = new URL(request.url).searchParams;
  const raw = params.getAll("cursor");
  if (raw.length > 1 || (raw.length === 1 && !decodeCursor(raw[0]))) return fail("cursor", 400);
  if (!deps.env.DATABASE_URL || !deps.store) return fail("unavailable", 503);
  try { return json(await deps.store.list(raw.length ? decodeCursor(raw[0]) : null)); }
  catch { deps.log?.("read_failed", requestId); return fail("unavailable", 503); }
}
