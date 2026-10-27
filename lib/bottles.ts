/** Public Bottle data. This module has no server, database or browser dependencies. */
export type Bottle = {
  id: string;
  url: string;
  title: string;
  note: string;
  kind: "site" | "toy" | "art";
};
export type BottleInput = Omit<Bottle, "id">;
export type BottleValidation =
  | { ok: true; value: BottleInput }
  | { ok: false; reason: "shape" | "honeypot" | "url" | "text" | "kind" };
export type BottleStatus = "pending" | "approved" | "rejected";

const object = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === "object" && !Array.isArray(v);
const plain = (v: unknown): v is string =>
  typeof v === "string" &&
  [...v.trim()].length >= 1 &&
  [...v.trim()].length <= 80 &&
  !/[<>\p{Cc}\p{Cf}\p{Zl}\p{Zp}]|&(?:#\w+|\w+);/u.test(v);
export function canonicalBottleUrl(value: unknown): string | null {
  if (
    typeof value !== "string" ||
    value.length > 2048 ||
    !/^https:\/\//i.test(value) ||
    /[\s\\\p{Cc}\p{Cf}]/u.test(value) ||
    value.includes("#") ||
    value.slice(8).split(/[/?]/, 1)[0].includes("@")
  )
    return null;
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase().replace(/\.$/, "");
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.port ||
      host.includes(":") ||
      /^[\d.]+$/.test(host)
    )
      return null;
    if (
      !/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z][a-z0-9-]{1,62}$/.test(
        host,
      ) ||
      host.length > 253 ||
      /(?:^|\.)(?:localhost|local|internal|invalid|test|example|onion|home|lan)$/.test(
        host,
      )
    )
      return null;
    for (const key of url.searchParams.keys())
      if (
        /^(?:utm_.+|fbclid|gclid|dclid|msclkid|mc_cid|mc_eid|igshid|yclid|_ga)$/i.test(
          key,
        )
      )
        return null;
    url.hostname = host;
    url.searchParams.sort();
    return url.href.length <= 2048 ? url.href : null;
  } catch {
    return null;
  }
}
export function parseBottle(value: unknown): BottleValidation {
  if (
    !object(value) ||
    Object.keys(value).some(
      (k) => !["url", "title", "note", "kind", "website"].includes(k),
    )
  )
    return { ok: false, reason: "shape" };
  if (value.website !== undefined && value.website !== "")
    return { ok: false, reason: "honeypot" };
  const url = canonicalBottleUrl(value.url);
  if (!url) return { ok: false, reason: "url" };
  if (!plain(value.title) || !plain(value.note))
    return { ok: false, reason: "text" };
  if (
    typeof value.kind !== "string" ||
    !["site", "toy", "art"].includes(value.kind)
  )
    return { ok: false, reason: "kind" };
  return {
    ok: true,
    value: {
      url,
      title: value.title.trim(),
      note: value.note.trim(),
      kind: value.kind as Bottle["kind"],
    },
  };
}
export function publicBottle(value: Bottle): Bottle {
  return {
    id: value.id,
    url: value.url,
    title: value.title,
    note: value.note,
    kind: value.kind,
  };
}
export function mergeBottles(
  curated: readonly Bottle[],
  approved: readonly Bottle[],
): Bottle[] {
  const seen = new Set<string>();
  return [
    ...curated,
    ...[...approved].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)),
  ].flatMap((b) => {
    const valid = parseBottle({
      url: b.url,
      title: b.title,
      note: b.note,
      kind: b.kind,
    });
    if (!valid.ok || seen.has(valid.value.url)) return [];
    seen.add(valid.value.url);
    return [{ id: b.id, ...valid.value }];
  });
}
/** Small deterministic PRNG for a repeatable visit; callers may inject any RNG. */
export function seededRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function pickBottle(
  pool: readonly Bottle[],
  seenIds: readonly string[],
  rng: () => number,
): Bottle | null {
  if (!pool.length) return null;
  const seen = new Set(seenIds);
  const fresh = pool.filter((b) => !seen.has(b.id));
  const previous = seenIds.filter((id) => pool.some((b) => b.id === id)).at(-1);
  const choices = fresh.length ? fresh : pool.length > 1 ? pool.filter((b) => b.id !== previous) : pool;
  const draw = rng();
  const index = Math.min(
    choices.length - 1,
    Math.max(
      0,
      Math.floor((Number.isFinite(draw) ? draw : 0) * choices.length),
    ),
  );
  return choices[index];
}

/** History is oldest first; cap the active collection and history at 100 entries. */
export function normalizeBottleHistory(pool: readonly Bottle[], value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const ids = new Set(pool.slice(0, 100).map((b) => b.id));
  return [...new Set(value.filter((id): id is string => typeof id === "string" && ids.has(id)).reverse())]
    .reverse().slice(-Math.min(pool.length, 100));
}
export function bottleDraw(pool: readonly Bottle[], history: unknown, rng: () => number): { bottle: Bottle | null; seen: string[] } {
  const active = pool.slice(0, 100);
  const seen = normalizeBottleHistory(active, history);
  const bottle = pickBottle(active, seen, rng);
  if (!bottle) return { bottle: null, seen: [] };
  const exhausted = active.every((b) => seen.includes(b.id));
  return { bottle, seen: [...(exhausted ? [] : seen), bottle.id].slice(-Math.min(active.length, 100)) };
}

/** Validate an API snapshot before rendering links; malformed snapshots use the offline collection. */
export function parseBottlePool(value: unknown): { bottles: Bottle[]; degraded: boolean } | null {
  if (!object(value) || !Array.isArray(value.bottles)) return null;
  const ids = new Set<string>();
  const urls = new Set<string>();
  const bottles: Bottle[] = [];
  for (const entry of value.bottles) {
    if (!object(entry) || typeof entry.id !== "string" || !entry.id || entry.id.length > 100 || ids.has(entry.id)) return null;
    const parsed = parseBottle({ url: entry.url, title: entry.title, note: entry.note, kind: entry.kind });
    if (!parsed.ok || urls.has(parsed.value.url)) return null;
    ids.add(entry.id);
    urls.add(parsed.value.url);
    if (bottles.length < 100) bottles.push({ id: entry.id, ...parsed.value });
  }
  return { bottles, degraded: value.degraded === true };
}
