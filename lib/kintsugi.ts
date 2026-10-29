export type Seam = { seed: number; x: number; y: number };
export type MendedCard = { id: string; count: number; seams: Seam[] };
export const MAX_SEAMS = 12;

export function validSeam(value: unknown): value is Seam {
  if (!value || typeof value !== "object") return false;
  const s = value as Seam;
  return Number.isInteger(s.seed) && s.seed >= 0 && s.seed <= 0xffffffff &&
    Number.isFinite(s.x) && s.x >= 0 && s.x <= 100 && Number.isFinite(s.y) && s.y >= 0 && s.y <= 100;
}

/** Normalized coordinates keep each visitor's contact point through resizes. */
export function fractures({ seed, x, y }: Seam): string[] {
  let state = seed >>> 0;
  const random = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
  return Array.from({ length: 6 }, (_, i) => {
    const angle = (i + random() * .5) * Math.PI / 3;
    const points = [[x, y]];
    for (let step = 1; step <= 5; step++) {
      const distance = step * 29;
      points.push([Math.max(0, Math.min(100, x + Math.cos(angle) * distance + (random() - .5) * 8)), Math.max(0, Math.min(100, y + Math.sin(angle) * distance + (random() - .5) * 8))]);
    }
    return points.map(([px, py], j) => `${j ? "L" : "M"}${px.toFixed(2)},${py.toFixed(2)}`).join(" ");
  });
}

export function rageClick(previous: { at: number; x: number; y: number }[], point: { at: number; x: number; y: number }) {
  const hits = [...previous.filter(p => point.at - p.at < 850 && Math.hypot(p.x - point.x, p.y - point.y) < 36), point];
  return { hits: hits.slice(-4), triggered: hits.length >= 4 };
}
