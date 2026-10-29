import { KANJI, type Kanji } from "../content/kanji.ts";
export type Point = { x: number; y: number };

/** A calendar-date index, independent of timezone offsets and DST duration. */
export function dailyKanji(day: string): Kanji {
  const [year, month, date] = day.split("-").map(Number);
  const index = Math.floor(Date.UTC(year, month - 1, date) / 86400000);
  return KANJI[((Number.isFinite(index) ? index : 0) % KANJI.length + KANJI.length) % KANJI.length];
}
export function resample(points: Point[], count = 40): Point[] {
  if (!points.length) return [];
  if (points.length === 1) return Array.from({ length: count }, () => ({ ...points[0] }));
  const lengths = [0];
  for (let i = 1; i < points.length; i++) lengths.push(lengths[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y));
  const total = lengths.at(-1)!;
  if (!total) return Array.from({ length: count }, () => ({ ...points[0] }));
  let segment = 1;
  return Array.from({ length: count }, (_, i) => {
    const target = total * i / (count - 1);
    while (segment < lengths.length - 1 && lengths[segment] < target) segment++;
    const fraction = (target - lengths[segment - 1]) / Math.max(.00001, lengths[segment] - lengths[segment - 1]);
    return { x: points[segment - 1].x + (points[segment].x - points[segment - 1].x) * fraction, y: points[segment - 1].y + (points[segment].y - points[segment - 1].y) * fraction };
  });
}
function distance(a: Point[], b: Point[]) { return a.reduce((sum, p, i) => sum + Math.hypot(p.x - b[i].x, p.y - b[i].y), 0) / a.length; }
export function scoreSheet(strokes: Point[][], kanji: Kanji) {
  if (!strokes.length) return { stars: 0, shape: 0, order: 0, hint: "Follow the numbered ghost, one unhurried stroke at a time." };
  const expected = kanji.strokes.map(p => resample(p));
  let shape = 0, order = 0;
  const usable = strokes.slice(0, 64).filter(p => p.length);
  for (let i = 0; i < usable.length; i++) {
    const points = resample(usable[i]);
    const distances = expected.map(e => distance(points, e));
    const reverseDistances = expected.map(e => distance([...points].reverse(), e));
    const closest = Math.min(...distances, ...reverseDistances);
    shape += Math.max(0, 1 - closest / 22);
    if (i < expected.length && distances[i] < 15 && distances[i] <= closest + 3) order++;
  }
  const denominator = Math.max(expected.length, usable.length);
  shape /= denominator; order /= denominator;
  const stars = Math.max(1, Math.min(3, Math.round(1 + shape + order)));
  const hint = shape < .45 ? "A lovely beginning. Try staying a little closer to the faint ink guide." : order < .7 ? "The shape is finding its way. Follow the numbers and the direction of each stroke next time." : "Beautifully unhurried. Your strokes follow both the shape and its rhythm.";
  return { stars, shape, order, hint };
}
