import { createHmac, randomInt, randomUUID } from "node:crypto";
import { clientIp, decodeCursor } from "./guestbook.ts";
import { validateBlotKey } from "./inkblot.ts";
import type { InkblotPayload, InkblotStore } from "./inkblot-store.ts";

export type InkblotDeps = {
  env: { DATABASE_URL?: string; BETTER_AUTH_SECRET?: string; BETTER_AUTH_URL?: string };
  store?: InkblotStore;
  now?: () => Date;
  id?: () => string;
  log?: (reason: string, requestId: string) => void;
};
const json = (value: unknown, status = 200, extra: Record<string, string> = {}) => Response.json(value, { status, headers: { "cache-control": "no-store", ...extra } });
const messages: Record<string, string> = {
  shape: "Please check the observation form.", text: "Please use a note of 1–80 characters and a name of up to 24 characters.",
  blot_key: "That inkblot key is invalid or unavailable for new notes.", profanity: "Please choose kinder words.", url: "Links are not allowed in observations.",
  honeypot: "Please submit the observation form directly.", json: "Please send valid JSON.", media_type: "Please send JSON.",
  origin: "Please submit from this site.", body_large: "This observation is too large.", hour_limit: "Please try again next hour.",
  day_limit: "The ink ward is busy today. Please try tomorrow.", queue_full: "The review queue is full. Please try later.",
  unavailable: "Observations are temporarily unavailable.", cursor: "That page link is invalid.",
};
const fail = (reason: string, status: number, extra?: Record<string, string>) => json({ reason, message: messages[reason] }, status, extra);
const normalize = (value: string) => value.normalize("NFKC").replace(/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu, " ").replace(/\s+/gu, " ").trim();
// Match the Guestbook's local moderation policy; no visitor text goes to an LLM.
const url = /(?:\b(?:https?|ftp):\/\/|\bwww\.|\b[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9-]+)*\.[a-z]{2,}\b|\b\d{1,3}(?:\.\d{1,3}){3}\b)/i;
const banned = ["fuck", "shit", "bitch", "cunt", "nigger", "faggot"];
function profane(value: string): boolean {
  const plain = value.toLowerCase().replace(/[013457@$]/g, c => ({ "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "@": "a", "$": "s" })[c] ?? c);
  return banned.some(word => new RegExp(`(?:^|[^a-z])${word.split("").join("[ ._-]*")}(?:$|[^a-z])`, "i").test(plain));
}
function validate(value: unknown, now: Date): { payload: InkblotPayload } | { reason: string } {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return { reason: "shape" };
  const fields = value as Record<string, unknown>;
  if (!Object.keys(fields).every(key => ["blotKey", "name", "note", "website"].includes(key))) return { reason: "shape" };
  if (!validateBlotKey(fields.blotKey, now)) return { reason: "blot_key" };
  if (fields.website !== undefined && fields.website !== "") return { reason: "honeypot" };
  if ((fields.name !== undefined && typeof fields.name !== "string") || typeof fields.note !== "string") return { reason: "text" };
  const name = normalize((fields.name as string | undefined) ?? "");
  const note = normalize(fields.note);
  if ([...name].length > 24 || [...note].length < 1 || [...note].length > 80) return { reason: "text" };
  if (url.test(`${name} ${note}`)) return { reason: "url" };
  if (profane(`${name} ${note}`)) return { reason: "profanity" };
  return { payload: { blotKey: fields.blotKey, name, note } };
}
export function inkblotBuckets(ip: string, now: Date, secret: string) {
  const who = createHmac("sha256", secret).update(`inkblot:ip:${ip}`).digest("hex");
  const iso = now.toISOString();
  return { hour: `inkblot:ip:${who}:${iso.slice(0, 13)}`, day: `inkblot:day:${iso.slice(0, 10)}` };
}
async function readCapped(request: Request): Promise<string | null> {
  const declared = request.headers.get("content-length");
  if (declared !== null && Number(declared) > 4096) return null;
  if (!request.body) return "";
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 4096) { await reader.cancel(); return null; }
      chunks.push(value);
    }
    return new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks));
  } finally { reader.releaseLock(); }
}
export async function inkblotPost(request: Request, deps: InkblotDeps): Promise<Response> {
  if (!deps.env.DATABASE_URL || !deps.env.BETTER_AUTH_SECRET || !deps.store) return fail("unavailable", 503);
  let expected: string;
  try { expected = new URL(deps.env.BETTER_AUTH_URL ?? "").origin; } catch { return fail("unavailable", 503); }
  const origin = request.headers.get("origin");
  if (origin !== null && origin !== expected) return fail("origin", 403);
  if (!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(request.headers.get("content-type") ?? "")) return fail("media_type", 415);
  let body: string | null;
  try { body = await readCapped(request); } catch { return fail("json", 400); }
  if (body === null) return fail("body_large", 413);
  let value: unknown;
  try { value = JSON.parse(body); } catch { return fail("json", 400); }
  const now = (deps.now ?? (() => new Date()))();
  const valid = validate(value, now);
  if ("reason" in valid) return fail(valid.reason, 400);
  const id = (deps.id ?? randomUUID)();
  const tilt = randomInt(-4, 5);
  const hand = randomInt(3);
  const keys = inkblotBuckets(clientIp(request.headers), now, deps.env.BETTER_AUTH_SECRET);
  try {
    const result = await deps.store.admit({ id, payload: valid.payload, tilt, hand, ...keys, now });
    if (result.kind === "accepted") return json({ id: result.id, blotKey: valid.payload.blotKey, status: "pending", tilt, hand }, 201);
    if (result.kind === "queue_full") return fail(result.kind, 503);
    return fail(result.kind, 429, { "retry-after": result.kind === "hour_limit" ? "3600" : "86400" });
  } catch { deps.log?.("write_failed", randomUUID()); return fail("unavailable", 503); }
}
function readableKey(key: string | null): key is string {
  if (key === null) return false;
  // Reuse strict calendar validation at the requested date, preserving old daily galleries.
  return validateBlotKey(key, key.startsWith("daily:") ? new Date(`${key.slice(6)}T00:00:00.000Z`) : new Date());
}
export async function inkblotGet(request: Request, deps: InkblotDeps): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const blotKey = params.get("blot");
  if (params.getAll("blot").length !== 1 || !readableKey(blotKey)) return fail("blot_key", 400);
  const raw = params.getAll("cursor");
  const cursor = raw.length ? decodeCursor(raw[0]) : null;
  if (raw.length > 1 || (raw.length === 1 && !cursor)) return fail("cursor", 400);
  // Date.parse normalizes impossible dates; Postgres also rejects ISO year zero.
  if (cursor && (cursor.createdAt.startsWith("0000-") || new Date(cursor.createdAt).toISOString() !== `${cursor.createdAt.slice(0, 23)}Z`)) return fail("cursor", 400);
  if (!deps.env.DATABASE_URL || !deps.store) return fail("unavailable", 503);
  try { return json(await deps.store.list(blotKey, cursor)); }
  catch { deps.log?.("read_failed", randomUUID()); return fail("unavailable", 503); }
}
