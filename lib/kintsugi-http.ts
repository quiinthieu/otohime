import { createHmac } from "node:crypto";
import { knownCard } from "./kintsugi-cards.ts";
import { validSeam } from "./kintsugi.ts";
import { clientIp } from "./guestbook.ts";
import type { createKintsugiStore } from "./kintsugi-store.ts";

type Store = ReturnType<typeof createKintsugiStore>;
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "cache-control": "no-store", ...(status === 429 ? { "retry-after": "3600" } : {}) } });
export function seamBuckets(ip: string, id: string, secret: string, now = new Date()) {
  const visitor = createHmac("sha256", secret).update(`kintsugi:${ip}`).digest("hex");
  const hour = now.toISOString().slice(0, 13);
  return [`visitor:${visitor}:${hour}`, `card:${visitor}:${id}:${hour}`, `day:${hour.slice(0, 10)}`];
}
export async function kintsugiPost(request: Request, store: Store | undefined, secret: string | undefined) {
  if (!store || !secret) return json({ error: "unavailable" }, 503);
  if (request.headers.get("origin") !== new URL(request.url).origin) return json({ error: "origin" }, 403);
  if (!/^application\/json(?:\s*;.*)?$/i.test(request.headers.get("content-type") ?? "")) return json({ error: "media_type" }, 415);
  const reader = request.body?.getReader();
  if (!reader) return json({ error: "body" }, 400);
  let text = "", size = 0;
  const decoder = new TextDecoder();
  try {
    while (true) {
      const { value, done } = await reader.read(); if (done) break;
      size += value.length;
      if (size > 512) { await reader.cancel(); return json({ error: "body_large" }, 413); }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
    let value;
    try { value = JSON.parse(text); } catch { return json({ error: "json" }, 400); }
    if (!knownCard(value?.id) || !validSeam(value?.seam)) return json({ error: "invalid_seam" }, 400);
    const result = await store.mend(value.id, value.seam, seamBuckets(clientIp(request.headers), value.id, secret));
    return result === "accepted" ? json({ saved: true }, 201) : json({ error: result }, result === "limited" ? 429 : 503);
  } catch { return json({ error: "unavailable" }, 503); }
}
export async function kintsugiGet(store: Store | undefined) {
  try { return json({ cards: (await store?.list() ?? []).filter(c => knownCard(c.id)), available: !!store }); }
  catch { return json({ cards: [], available: false }, 503); }
}
