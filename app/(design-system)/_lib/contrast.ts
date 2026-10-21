// The rulebook's one live rule, pure WCAG 2: relative luminance and the
// contrast ratio (L1 + 0.05) / (L2 + 0.05), lighter over darker, so the order
// of the two colours does not matter. Ink on paper must reach 4.5 to 1 (body
// text), the spot 3 to 1 (a mark you must see). The rule exists only while
// the system does: with it off, every part picks its own colours.
import { PARTS, type Board } from "./board.ts";

export const INK_MIN = 4.5;
export const SPOT_MIN = 3;

function channel(c: number): number {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

export function luminance(hex: string): number {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) throw new Error(`not a #rrggbb colour: ${hex}`);
  const [r, g, b] = m.slice(1).map((h) => channel(parseInt(h, 16)));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

export const OFF_SAY = `No system, so no rule to check: ${PARTS.length} parts pick their own colours.`;

const verdict = (ratio: number, min: number) => (ratio >= min ? "passes" : "fails");

export function rule(b: Board): { ink: number; spot: number; passes: boolean; say: string } {
  const ink = contrast(b.pots.ink, b.pots.paper);
  const spot = contrast(b.pots.spot, b.pots.paper);
  if (!b.system) return { ink, spot, passes: false, say: OFF_SAY };
  return {
    ink,
    spot,
    passes: ink >= INK_MIN && spot >= SPOT_MIN,
    say: `Ink on paper ${ink.toFixed(1)} to 1, ${verdict(ink, INK_MIN)}. Spot on paper ${spot.toFixed(1)} to 1, ${verdict(spot, SPOT_MIN)}.`,
  };
}
