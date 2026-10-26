// The Ink Desk's layout model: which objects lie on the desk, where, how
// tilted and in what stacking order. Pure, no DOM and no Math.random, so the
// server and the first client render agree and lib/desk.test.ts proves it.
// Positions are the item's centre as fractions of the desk (0..1 on each axis),
// so a layout saved on a wide screen still lands on the desk of a narrow one.
// Rotation is in degrees, z is a stacking rank 0..n-1 (0 at the back).

export type DeskKind = "notebook" | "polaroid" | "cassette" | "console";

// One object as the registry knows it: what it is, where it leads, and its
// home spot on a tidy desk.
export type DeskEntry = { id: string; kind: DeskKind; href: string; label: string; x: number; y: number };

// One object as it lies on the desk now.
export type DeskItem = { id: string; kind: DeskKind; href: string; x: number; y: number; rot: number; z: number };

export type DeskLayout = DeskItem[];

// The sections, back to front. Home spots leave the top-right corner for the cork.
export const DESK_ITEMS: readonly DeskEntry[] = [
  { id: "notes", kind: "notebook", href: "/notes", label: "Notes", x: 0.26, y: 0.34 },
  { id: "projects", kind: "polaroid", href: "/projects", label: "Projects", x: 0.56, y: 0.3 },
  { id: "sketches", kind: "polaroid", href: "/sketches", label: "Sketches", x: 0.72, y: 0.62 },
  { id: "music", kind: "cassette", href: "/music", label: "Music", x: 0.3, y: 0.74 },
  { id: "play", kind: "console", href: "/play", label: "Pocket", x: 0.52, y: 0.66 },
];

// localStorage key, and the version tag inside the stored JSON. A new shape
// gets a new tag; an old tag is read as nothing and the desk starts over.
export const DESK_KEY = "desk:v1";
export const DESK_VERSION = "desk:v1";

// The most a default item leans either way, and one press of "rotate".
export const MAX_TILT = 8;
export const ROTATE_STEP = 15;

// FNV-1a, 32 bit: a stable number per id.
export function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

// The id's lean in [-MAX_TILT, MAX_TILT], to a tenth of a degree.
export function tiltFor(id: string): number {
  const t = (hash(id) / 0xffffffff) * 2 - 1;
  return Math.round(t * MAX_TILT * 10) / 10 || 0;
}

const unit = (v: number) => Math.min(1, Math.max(0, v));

// Degrees into (-180, 180]. An angle already in range comes back exactly, so a
// stored 0.2 does not drift to 0.19999 on every load.
export function normalizeRot(deg: number): number {
  if (deg > -180 && deg <= 180) return deg || 0;
  const r = ((deg % 360) + 360) % 360;
  return r > 180 ? r - 360 : r;
}

// Restack so z is 0..n-1 in the current order; ties keep array order.
function rerank(layout: DeskLayout): DeskLayout {
  const order = layout.map((item, i) => ({ i, z: item.z })).sort((a, b) => a.z - b.z || a.i - b.i);
  const rank = new Array<number>(layout.length);
  order.forEach((o, r) => (rank[o.i] = r));
  return layout.map((item, i) => ({ ...item, z: rank[i] }));
}

const place = (e: DeskEntry, rot: number, z: number): DeskItem => ({
  id: e.id,
  kind: e.kind,
  href: e.href,
  x: e.x,
  y: e.y,
  rot,
  z,
});

// The first visit: every item at home, each leaning its own hashed way.
export function defaultLayout(registry: readonly DeskEntry[] = DESK_ITEMS): DeskLayout {
  return registry.map((e, i) => place(e, tiltFor(e.id), i));
}

// "Tidy up": every item back home and square, keeping the stacking order.
// Items the registry no longer knows are dropped, new ones go on top.
export function tidy(layout: DeskLayout, registry: readonly DeskEntry[] = DESK_ITEMS): DeskLayout {
  const z = new Map(layout.map((item) => [item.id, item.z]));
  return rerank(registry.map((e, i) => place(e, 0, z.get(e.id) ?? layout.length + i)));
}

export function bringToFront(layout: DeskLayout, id: string): DeskLayout {
  if (!layout.some((item) => item.id === id)) return layout;
  return rerank(layout.map((item) => (item.id === id ? { ...item, z: Infinity } : item)));
}

export function sendToBack(layout: DeskLayout, id: string): DeskLayout {
  if (!layout.some((item) => item.id === id)) return layout;
  return rerank(layout.map((item) => (item.id === id ? { ...item, z: -Infinity } : item)));
}

export function rotate(layout: DeskLayout, id: string, by: number = ROTATE_STEP): DeskLayout {
  return layout.map((item) => (item.id === id ? { ...item, rot: normalizeRot(item.rot + by) } : item));
}

// Move one item's centre, kept on the desk.
export function moveTo(layout: DeskLayout, id: string, x: number, y: number): DeskLayout {
  return layout.map((item) => (item.id === id ? clampItem({ ...item, x, y }) : item));
}

// Keep a centre on the desk and a rotation in range.
export function clampItem(item: DeskItem): DeskItem {
  return { ...item, x: unit(item.x), y: unit(item.y), rot: normalizeRot(item.rot) };
}

// Every item on the desk, rotations in range, z restacked to 0..n-1.
export function clamp(layout: DeskLayout): DeskLayout {
  return rerank(layout.map(clampItem));
}

// What goes into localStorage: positions only, since kind and href come from
// the registry and must not be trusted from storage.
export function serializeDesk(layout: DeskLayout): string {
  return JSON.stringify({
    v: DESK_VERSION,
    items: layout.map(({ id, x, y, rot, z }) => ({ id, x, y, rot, z })),
  });
}

const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

// Read a stored desk. Never throws: anything that is not a desk:v1 object gives
// the default layout; unknown and repeated ids are dropped, an item that is
// missing or has a bad field takes its default, and the rest is clamped.
export function parseDesk(raw: string | null | undefined, registry: readonly DeskEntry[] = DESK_ITEMS): DeskLayout {
  const fallback = defaultLayout(registry);
  if (typeof raw !== "string") return fallback;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return fallback;
  }
  if (typeof data !== "object" || data === null) return fallback;
  const { v, items } = data as { v?: unknown; items?: unknown };
  if (v !== DESK_VERSION || !Array.isArray(items)) return fallback;

  const stored = new Map<string, { x: number; y: number; rot: number; z: number }>();
  for (const it of items) {
    if (typeof it !== "object" || it === null) continue;
    const { id, x, y, rot, z } = it as Record<string, unknown>;
    if (typeof id !== "string" || stored.has(id)) continue;
    if (!finite(x) || !finite(y) || !finite(rot) || !finite(z)) continue;
    stored.set(id, { x, y, rot, z });
  }

  // Missing items keep their default z, offset past every stored one, so they land on top.
  const top = Math.max(0, ...[...stored.values()].map((s) => s.z + 1));
  return clamp(
    fallback.map((item, i) => {
      const s = stored.get(item.id);
      return s ? { ...item, ...s } : { ...item, z: top + i };
    }),
  );
}
