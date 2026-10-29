export type InkPoint = { x: number; y: number; t: number; pressure?: number };
export type Bristle = { offset: number; lag: number; ink: number; wear: number };
export type Brush = { bristles: Bristle[]; seed: number };
export type InkMark = { x: number; y: number; x2: number; y2: number; width: number; alpha: number };
export const BRISTLES = 40;
export const MAX_STEPS = 24;
export function noise(n: number) { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); }
export function createBrush(seed = 17): Brush {
  return { seed, bristles: Array.from({ length: BRISTLES }, (_, i) => ({ offset: (i / (BRISTLES - 1) - .5) * 2, lag: noise(i + seed) * 3, ink: 1, wear: .7 + noise(i * 3 + seed) * .8 })) };
}
export const brushLoad = (brush: Brush) => brush.bristles.reduce((n, b) => n + b.ink, 0) / brush.bristles.length;
export function brushWidth(a: InkPoint, b: InkPoint) {
  const speed = Math.hypot(b.x - a.x, b.y - a.y) / Math.max(8, b.t - a.t);
  const pressure = b.pressure === undefined ? .65 : Math.max(.02, Math.min(1, b.pressure));
  return Math.max(.5, 18 * (.18 + pressure) / (1 + speed * .6));
}
export function deposit(brush: Brush, a: InkPoint, b: InkPoint): { brush: Brush; marks: InkMark[] } {
  if (![a.x, a.y, a.t, b.x, b.y, b.t].every(Number.isFinite)) return { brush, marks: [] };
  const distance = Math.hypot(b.x - a.x, b.y - a.y);
  const steps = Math.min(MAX_STEPS, Math.max(1, Math.ceil(distance / 4)));
  const width = brushWidth(a, b), angle = Math.atan2(b.y - a.y, b.x - a.x);
  const nx = -Math.sin(angle), ny = Math.cos(angle), dx = Math.cos(angle), dy = Math.sin(angle);
  const marks: InkMark[] = [];
  const bristles = brush.bristles.map((bristle, i) => {
    const next = { ...bristle, ink: Math.max(0, bristle.ink - (distance + 1) * .00065 * bristle.wear) };
    for (let step = 0; step < steps; step++) {
      const ink = bristle.ink + (next.ink - bristle.ink) * step / steps;
      // As the bristles dry, distinct fibres stop transferring ink independently.
      if (ink < .015 || noise(brush.seed + i * 79 + Math.floor(b.t / 13) + step) > Math.min(1, ink * 2.1)) continue;
      const k = step / steps, k2 = (step + 1) / steps;
      const offset = bristle.offset * width, lag = bristle.lag * .5;
      const x = a.x + (b.x - a.x) * k + nx * offset - dx * lag;
      const y = a.y + (b.y - a.y) * k + ny * offset - dy * lag;
      marks.push({ x: Math.max(0, Math.min(600, x)), y: Math.max(0, Math.min(600, y)),
        x2: Math.max(0, Math.min(600, a.x + (b.x - a.x) * k2 + nx * offset - dx * lag)),
        y2: Math.max(0, Math.min(600, a.y + (b.y - a.y) * k2 + ny * offset - dy * lag)),
        width: .6 + noise(i + brush.seed) * .7, alpha: .15 + ink * .55 });
    }
    return next;
  });
  return { brush: { ...brush, bristles }, marks };
}
export function fibreBleed(points: InkPoint[], seed: number): InkMark[] {
  return points.filter((_, i) => i % 3 === 0).slice(0, 160).map((p, i) => {
    const reach = 2 + noise(seed + i) * 8;
    return { x: p.x - reach, y: p.y + noise(i + 3) * 5, x2: p.x + reach, y2: p.y + noise(i + 3) * 5 + .6, width: .6, alpha: .035 + noise(i + seed) * .035 };
  });
}
export function brushPath(points: InkPoint[], seed = 17): InkMark[] {
  let brush = createBrush(seed);
  const marks: InkMark[] = [];
  for (let i = 1; i < Math.min(points.length, 512); i++) { const plan = deposit(brush, points[i - 1], points[i]); brush = plan.brush; marks.push(...plan.marks); }
  return [...marks, ...fibreBleed(points, seed)];
}
