// Fan-out peeks, the data half: which three items a marked link fans out.
// scripts/peeks-index.ts feeds this the site's sketches, notes, projects and the
// Gazette, and commits the answer as public/peeks.json; the client only looks
// keys up. Ranking is pure and deterministic: shared words weighted by rarity,
// at most one item per kind, ties to the kind order, then the freshest, then id.
import { tokenize } from "./ask.ts";

export type PeekKind = "sketch" | "note" | "project" | "article";
// A peek target is `kind:slug`: an item's own id, a Gazette kicker as
// `tag:sky`, or a song credit as `credit:adela`.
export type PeekKey = string;

export type PeekItem = { kind: PeekKind; title: string; href: string; blurb: string; src?: string };
export type PeekIndex = { version: 1; items: Record<PeekKey, PeekItem>; peeks: Record<PeekKey, [PeekKey, PeekKey, PeekKey]> };

// What the ranking reads. order is the item's place in its content list; date
// (YYYY-MM-DD), when there is one, says how fresh it is.
export type PeekCandidate = { id: PeekKey; item: PeekItem; text: string; order: number; date?: string };
export type PeekTarget = { key: PeekKey; text: string };

export const PEEK_COUNT = 3;
// The id of the one hint components/peek-layer.tsx renders, read out after a marked link's name.
export const PEEK_HINT_ID = "peek-hint";
export const KIND_ORDER: readonly PeekKind[] = ["sketch", "note", "project", "article"];
const KEY = /^(sketch|note|project|article|tag|credit):[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const isPeekKey = (key: string): key is PeekKey => KEY.test(key);
export const peekSlug = (text: string) =>
  text
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

// ln(1 + N/df) per word: a word every item shares is worth little, one two
// items share is worth a lot.
export function weights(candidates: readonly PeekCandidate[]): Map<string, number> {
  const df = new Map<string, number>();
  for (const c of candidates) for (const t of new Set(tokenize(c.text))) df.set(t, (df.get(t) ?? 0) + 1);
  const out = new Map<string, number>();
  for (const [t, n] of df) out.set(t, Math.log(1 + candidates.length / n));
  return out;
}

export function score(query: ReadonlySet<string>, text: string, idf: ReadonlyMap<string, number>): number {
  let sum = 0;
  for (const t of new Set(tokenize(text))) if (query.has(t)) sum += idf.get(t) ?? 0;
  return sum;
}

// Newer first for dated items, then content order.
export function fresher(a: PeekCandidate, b: PeekCandidate): number {
  if (a.date !== b.date) {
    if (!a.date) return 1;
    if (!b.date) return -1;
    return a.date < b.date ? 1 : -1;
  }
  return a.order - b.order;
}

export function rank(target: PeekTarget, candidates: readonly PeekCandidate[], idf = weights(candidates)): PeekCandidate[] {
  const query = new Set(tokenize(target.text));
  return candidates
    .filter((c) => c.id !== target.key)
    .map((c) => ({ c, s: score(query, c.text, idf) }))
    .sort(
      (a, b) =>
        b.s - a.s ||
        KIND_ORDER.indexOf(a.c.item.kind) - KIND_ORDER.indexOf(b.c.item.kind) ||
        fresher(a.c, b.c) ||
        (a.c.id < b.c.id ? -1 : a.c.id > b.c.id ? 1 : 0),
    )
    .map(({ c }) => c);
}

// The best item of each kind, best first, so a peek mixes sketches, notes and
// projects. Only when kinds run out does a second item of one kind join.
export function relate(target: PeekTarget, candidates: readonly PeekCandidate[], idf = weights(candidates)): [PeekKey, PeekKey, PeekKey] {
  const ranked = rank(target, candidates, idf);
  const picked: PeekCandidate[] = [];
  const kinds = new Set<PeekKind>();
  for (const c of ranked) {
    if (picked.length === PEEK_COUNT) break;
    if (!kinds.has(c.item.kind)) {
      picked.push(c);
      kinds.add(c.item.kind);
    }
  }
  for (const c of ranked) {
    if (picked.length === PEEK_COUNT) break;
    if (!picked.includes(c)) picked.push(c);
  }
  if (picked.length < PEEK_COUNT) throw new Error(`${target.key}: only ${picked.length} items to peek at`);
  return picked.map((c) => c.id) as [PeekKey, PeekKey, PeekKey];
}

export function buildPeekIndex(candidates: readonly PeekCandidate[], targets: readonly PeekTarget[]): PeekIndex {
  const items: Record<PeekKey, PeekItem> = {};
  for (const c of candidates) {
    if (!isPeekKey(c.id)) throw new Error(`bad peek id ${c.id}`);
    if (items[c.id]) throw new Error(`duplicate peek id ${c.id}`);
    items[c.id] = c.item;
  }
  const idf = weights(candidates);
  const peeks: Record<PeekKey, [PeekKey, PeekKey, PeekKey]> = {};
  for (const t of targets) {
    if (!isPeekKey(t.key)) throw new Error(`bad peek key ${t.key}`);
    if (peeks[t.key]) throw new Error(`duplicate peek key ${t.key}`);
    peeks[t.key] = relate(t, candidates, idf);
  }
  return { version: 1, items, peeks };
}

// One item or peek per line, so a content change is a readable diff.
export function serializePeeks(index: PeekIndex): string {
  const lines = (record: Record<string, unknown>) =>
    Object.entries(record)
      .map(([k, v]) => `${JSON.stringify(k)}:${JSON.stringify(v)}`)
      .join(",\n");
  return `{"version":${index.version},"items":{\n${lines(index.items)}\n},"peeks":{\n${lines(index.peeks)}\n}}\n`;
}

// The three cards for a marked link, or none when the key is unknown, so a
// stale marker leaves the plain link alone.
export function peeksFor(index: PeekIndex, key: string): PeekItem[] {
  const ids = Object.hasOwn(index.peeks, key) ? index.peeks[key] : undefined;
  if (!ids) return [];
  const items = ids.map((id) => (Object.hasOwn(index.items, id) ? index.items[id] : undefined));
  return items.every(Boolean) ? (items as PeekItem[]) : [];
}
