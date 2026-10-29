import type { Note, Project } from "../content/site.ts";

/** World units. Row 0 is the top plank; book positions are box centres. */
export const SHELF_WIDTH = 12;
export const SHELF_ROW_GAP = 3.2;
export const SHELF_MARGIN = 0.35;
export const SHELF_BOOK_GAP = 0.12;
export const SHELF_BOOK_DEPTH = 0.6;

export type ShelfBook = {
  id: string;
  kind: "project" | "note";
  slug: string;
  title: string;
  subtitle: string;
  href: string;
  swatch: Project["colour"];
  date: string;
  thickness: number;
  height: number;
  tiltRad: number;
  row: number;
  x: number;
  y: number;
  z: number;
  viewTransitionName: string;
};

function hash(value: string): number {
  let result = 2166136261;
  for (const character of value) result = Math.imul(result ^ character.charCodeAt(0), 16777619);
  return result >>> 0;
}

export function shelfRowCount(bookCount: number): number {
  return bookCount > 30 ? 4 : 3;
}

/** Width/height of the box after its rotation around its centre in the XY plane. */
export function shelfBookExtent(book: Pick<ShelfBook, "thickness" | "height" | "tiltRad">) {
  const c = Math.abs(Math.cos(book.tiltRad));
  const s = Math.abs(Math.sin(book.tiltRad));
  return { width: c * book.thickness + s * book.height, height: c * book.height + s * book.thickness };
}

/** Newest publication first, then identity (locale-independent). Inputs are never mutated. */
export function buildShelfBooks(projects: readonly Project[], notes: readonly Note[], cap = 40): ShelfBook[] {
  const swatches = ["yellow", "coral", "mint", "blue", "pink"] as const;
  const entries = [
    ...projects.flatMap((project) => project.href ? [{
      kind: "project" as const,
      slug: project.href.replace(/^\//, "").replace(/\/$/, ""),
      title: project.title,
      subtitle: project.note,
      href: project.href,
      swatch: project.colour,
      date: project.shipped ?? project.started ?? "",
      length: project.note.length,
    }] : []),
    ...notes.map((note) => ({
      kind: "note" as const,
      slug: note.slug,
      title: note.title,
      subtitle: note.body,
      href: `/notes/${note.slug}`,
      swatch: swatches[hash(note.slug) % swatches.length],
      date: note.date,
      length: note.body.length + note.tags.join("").length,
    })),
  ].map((entry) => ({ ...entry, id: `${entry.kind}-${entry.slug}` }));
  entries.sort((a, b) => a.date === b.date ? (a.id < b.id ? -1 : a.id > b.id ? 1 : 0) : a.date > b.date ? -1 : 1);
  const seen = new Set<string>();
  const limit = Number.isNaN(cap) ? 0 : Math.max(0, Math.min(40, Math.floor(cap)));
  const selected = entries.filter(({ id }) => {
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  }).slice(0, limit);
  const rows = shelfRowCount(selected.length);
  const perRow = Math.max(1, Math.ceil(selected.length / rows));
  let cursor = -SHELF_WIDTH / 2 + SHELF_MARGIN;
  return selected.map((entry, index) => {
    const row = Math.floor(index / perRow);
    if (index % perRow === 0) cursor = -SHELF_WIDTH / 2 + SHELF_MARGIN;
    const seed = hash(entry.id);
    const dimensions = {
      thickness: 0.46 + Math.min(0.32, entry.length / 1800),
      height: 1.8 + (seed % 701) / 1000,
      tiltRad: ((seed >>> 12) % 91 - 45) / 1000,
    };
    const extent = shelfBookExtent(dimensions);
    const x = cursor + extent.width / 2;
    cursor += extent.width + SHELF_BOOK_GAP;
    return {
      id: entry.id, kind: entry.kind, slug: entry.slug, title: entry.title,
      subtitle: entry.subtitle, href: entry.href, swatch: entry.swatch, date: entry.date,
      ...dimensions, row, x, y: -row * SHELF_ROW_GAP + extent.height / 2, z: 0,
      viewTransitionName: entry.id,
    };
  });
}

type Point3 = { x: number; y: number; z: number };
export type BookBounds3D = { min: Point3; max: Point3 };
export type ShelfViewport = { width: number; height: number; left?: number; top?: number };
export type BookScreenRect = { left: number; top: number; width: number; height: number; visible: boolean };
type Plane = [number, number, number, number];

/**
 * Axis-aligned bounds in the MVP's input space; column-major matrix (Three.js
 * Matrix4.elements), WebGL NDC z=-1..1, CSS-pixel viewport (never device pixels).
 * Intersect box and clip halfspaces before dividing by w. Enumerating plane
 * triples also covers a box enclosing the camera or the entire view frustum.
 */
export function projectBookScreenRect(bounds: BookBounds3D, mvp: ArrayLike<number>, viewport: ShelfViewport): BookScreenRect {
  const left = viewport.left ?? 0;
  const top = viewport.top ?? 0;
  const empty = { left, top, width: 0, height: 0, visible: false };
  const { min, max } = bounds;
  if (mvp.length !== 16 || !Array.from(mvp).every(Number.isFinite) ||
      ![left, top, viewport.width, viewport.height, min.x, min.y, min.z, max.x, max.y, max.z].every(Number.isFinite) ||
      viewport.width <= 0 || viewport.height <= 0 || min.x > max.x || min.y > max.y || min.z > max.z) return empty;
  const planes: Plane[] = [
    [1, 0, 0, -min.x], [-1, 0, 0, max.x],
    [0, 1, 0, -min.y], [0, -1, 0, max.y],
    [0, 0, 1, -min.z], [0, 0, -1, max.z],
  ];
  for (let axis = 0; axis < 3; axis++) {
    for (const sign of [-1, 1]) {
      planes.push([0, 1, 2, 3].map((column) => mvp[column * 4 + 3] + sign * mvp[column * 4 + axis]) as Plane);
    }
  }
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (let i = 0; i < planes.length - 2; i++) {
    for (let j = i + 1; j < planes.length - 1; j++) {
      for (let k = j + 1; k < planes.length; k++) {
        const a = planes[i], b = planes[j], c = planes[k];
        const bc = [b[1] * c[2] - b[2] * c[1], b[2] * c[0] - b[0] * c[2], b[0] * c[1] - b[1] * c[0]];
        const det = a[0] * bc[0] + a[1] * bc[1] + a[2] * bc[2];
        if (Math.abs(det) < 1e-12) continue;
        const ca = [c[1] * a[2] - c[2] * a[1], c[2] * a[0] - c[0] * a[2], c[0] * a[1] - c[1] * a[0]];
        const ab = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
        const [x, y, z] = [0, 1, 2].map((n) => (-a[3] * bc[n] - b[3] * ca[n] - c[3] * ab[n]) / det);
        if (planes.some((p) => p[0] * x + p[1] * y + p[2] * z + p[3] < -1e-8)) continue;
        const w = mvp[3] * x + mvp[7] * y + mvp[11] * z + mvp[15];
        if (w <= 1e-10) continue;
        const px = (mvp[0] * x + mvp[4] * y + mvp[8] * z + mvp[12]) / w;
        const py = (mvp[1] * x + mvp[5] * y + mvp[9] * z + mvp[13]) / w;
        minX = Math.min(minX, px); maxX = Math.max(maxX, px);
        minY = Math.min(minY, py); maxY = Math.max(maxY, py);
      }
    }
  }
  if (!Number.isFinite(minX)) return empty;
  const clamp = (n: number) => Math.max(0, Math.min(1, n));
  const x0 = clamp((minX + 1) / 2), x1 = clamp((maxX + 1) / 2);
  const y0 = clamp((1 - maxY) / 2), y1 = clamp((1 - minY) / 2);
  const width = (x1 - x0) * viewport.width, height = (y1 - y0) * viewport.height;
  return { left: left + x0 * viewport.width, top: top + y0 * viewport.height, width, height, visible: width > 0 && height > 0 };
}
