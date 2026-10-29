import { FINDS, STICKERS, type Rarity } from "../content/stickers.ts";

export const COLLECTION_KEY = "otohime.ink-collection.v1";
export const DAILY_COIN_CAP = 12;
export const COPIES: Record<Rarity, number> = { common: 4, uncommon: 2, rare: 1, secret: 1 };
export type Placement = { copy: string; id: string; x: number; y: number; rotation: number };
export type Collection = {
  version: 1; batch: number; coins: number; day: string; visited: string[];
  stock: Record<string, number>; owned: Record<string, number>; finds: string[]; album: Placement[];
  last: string | null;
};
export const localDay = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const freshStock = () => Object.fromEntries(STICKERS.filter(s => !s.hidden).map(s => [s.id, COPIES[s.rarity]]));
export const freshCollection = (): Collection => ({ version: 1, batch: 1, coins: 0, day: "", visited: [], stock: freshStock(), owned: {}, finds: [], album: [], last: null });
const integer = (v: unknown, max: number) => typeof v === "number" && Number.isSafeInteger(v) && v >= 0 && v <= max;
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

export function parseCollection(raw: string | null): Collection {
  try {
    const v: unknown = JSON.parse(raw ?? "null");
    if (!record(v) || v.version !== 1 || !integer(v.batch, 100000) || v.batch === 0 || !integer(v.coins, 10000) ||
      typeof v.day !== "string" || !Array.isArray(v.visited) || v.visited.length > DAILY_COIN_CAP ||
      !v.visited.every(x => typeof x === "string" && x.startsWith("/") && x.length <= 200) || new Set(v.visited).size !== v.visited.length ||
      !record(v.stock) || !record(v.owned) || !Array.isArray(v.finds) || !Array.isArray(v.album)) return freshCollection();
    const catalogIds = new Set(STICKERS.map(s => s.id));
    const stockIds = new Set(STICKERS.filter(s => !s.hidden).map(s => s.id));
    if (Object.keys(v.stock).some(id => !stockIds.has(id)) || Object.keys(v.owned).some(id => !catalogIds.has(id))) return freshCollection();
    for (const s of STICKERS) {
      if (!s.hidden && !integer(v.stock[s.id], COPIES[s.rarity])) return freshCollection();
      if (v.owned[s.id] !== undefined && !integer(v.owned[s.id], 100000)) return freshCollection();
    }
    const validFinds: string[] = Object.values(FINDS);
    if (!v.finds.every(x => validFinds.includes(x as string)) || new Set(v.finds).size !== v.finds.length || v.album.length > 160) return freshCollection();
    const copies = new Set<string>();
    for (const p of v.album) {
      if (!record(p) || typeof p.id !== "string" || typeof p.copy !== "string" || copies.has(p.copy) ||
        !STICKERS.some(s => s.id === p.id) || !integer(v.owned[p.id], 100000) ||
        !Number.isFinite(p.x) || !Number.isFinite(p.y) || !Number.isFinite(p.rotation) ||
        (p.x as number) < 0 || (p.x as number) > 1 || (p.y as number) < 0 || (p.y as number) > 1 || Math.abs(p.rotation as number) > 180) return freshCollection();
      const index = Number(p.copy.slice(p.id.length + 1));
      if (!p.copy.startsWith(`${p.id}:`) || !integer(index, (v.owned[p.id] as number) - 1)) return freshCollection();
      copies.add(p.copy);
    }
    return { ...freshCollection(), ...v, last: typeof v.last === "string" && STICKERS.some(s => s.id === v.last) ? v.last : null } as Collection;
  } catch { return freshCollection(); }
}

export function explore(s: Collection, route: string, day: string): Collection {
  if (!route.startsWith("/") || route.length > 200 || /^\/(api|admin|account|dashboard|sign-in|sign-up)(\/|$)/.test(route)) return s;
  const visited = s.day === day ? s.visited : [];
  if (visited.includes(route) || visited.length >= DAILY_COIN_CAP) return s;
  return { ...s, day, visited: [...visited, route], coins: Math.min(10000, s.coins + 1) };
}
export function claimFind(s: Collection, id: string): Collection {
  if (!(Object.values(FINDS) as string[]).includes(id) || s.finds.includes(id)) return s;
  return { ...s, finds: [...s.finds, id], coins: Math.min(10000, s.coins + 1), owned: { ...s.owned, [id]: (s.owned[id] ?? 0) + 1 } };
}
export function drawSticker(s: Collection, random: number): Collection {
  const total = Object.values(s.stock).reduce((a, b) => a + b, 0);
  if (!s.coins || !total || !Number.isFinite(random) || random < 0 || random >= 1) return s;
  let ticket = Math.floor(random * total);
  for (const sticker of STICKERS.filter(s => !s.hidden)) {
    const count = s.stock[sticker.id];
    if (ticket < count) return { ...s, coins: s.coins - 1, stock: { ...s.stock, [sticker.id]: count - 1 }, owned: { ...s.owned, [sticker.id]: (s.owned[sticker.id] ?? 0) + 1 }, last: sticker.id };
    ticket -= count;
  }
  return s;
}
export function nextBatch(s: Collection): Collection {
  return Object.values(s.stock).some(Boolean) ? s : { ...s, batch: s.batch + 1, stock: freshStock(), last: null };
}
export function stockBoard(s: Collection) {
  const total = Object.values(s.stock).reduce((a, b) => a + b, 0);
  return (["common", "uncommon", "rare", "secret"] as Rarity[]).map(rarity => {
    const stickers = STICKERS.filter(s => !s.hidden && s.rarity === rarity);
    const remaining = stickers.reduce((n, x) => n + s.stock[x.id], 0);
    return { rarity, remaining, initial: stickers.length * COPIES[rarity], odds: total ? remaining / total : 0 };
  });
}
export function placeSticker(s: Collection, p: Placement): Collection {
  const index = Number(p.copy.slice(p.id.length + 1));
  if (!p.copy.startsWith(`${p.id}:`) || !integer(index, (s.owned[p.id] ?? 0) - 1) || ![p.x, p.y, p.rotation].every(Number.isFinite)) return s;
  const existing = s.album.findIndex(a => a.copy === p.copy);
  if (existing < 0 && s.album.length >= 160) return s;
  const placed = { ...p, x: Math.max(0, Math.min(1, p.x)), y: Math.max(0, Math.min(1, p.y)), rotation: Math.max(-180, Math.min(180, p.rotation)) };
  return { ...s, album: existing < 0 ? [...s.album, placed] : s.album.map((a, i) => i === existing ? placed : a) };
}
export const KONAMI = ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "b", "a"];
export function matchKonami(history: string[], key: string, editing = false): string[] {
  if (editing) return [];
  const next = [...history, key.length === 1 ? key.toLowerCase() : key].slice(-KONAMI.length);
  // Retain suffixes, including the third up in up-up-up-down…
  for (let n = next.length; n > 0; n--) if (next.slice(-n).every((k, i) => k === KONAMI[i])) return next.slice(-n);
  return [];
}
