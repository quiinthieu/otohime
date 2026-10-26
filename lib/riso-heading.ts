/** String-only boundary shared by site headings and the Ink Lab preview. */
export interface RisoTextProps {
  children: string;
  className?: string;
  /** The plain source, e.g. stamp-text; never put this on the visual layer. */
  sourceClassName?: string;
  plates?: 2 | 3;
}
export interface RisoHeadingProps extends RisoTextProps {
  as?: "h1" | "h2";
  id?: string;
}
export interface RisoCharacter {
  text: string;
  index: number;
  delay: number;
  offsets: readonly [readonly [number, number], readonly [number, number]];
}
// Grapheme clusters keep combining marks, emoji skin tones and ZWJ sequences on one plate.
const segmenter = new Intl.Segmenter("und", { granularity: "grapheme" });
export function risoCharacters(text: string): RisoCharacter[] {
  let seed = 2166136261;
  for (const point of text) seed = Math.imul(seed ^ point.codePointAt(0)!, 16777619) >>> 0;
  return Array.from(segmenter.segment(text), ({ segment }, index) => {
    const hash = Math.imul(seed ^ (index + 1), 16777619) >>> 0;
    const x = 1 + (hash & 1), y = 1 + ((hash >>> 1) & 1);
    const sign = (hash & 4) ? 1 : -1;
    return { text: segment, index, delay: Math.min(index * 18, 240),
      offsets: [[sign * x, -y], [-sign * y, x]] as const };
  });
}
export function risoPlateCount(value?: number): 2 | 3 { return value === 2 ? 2 : 3; }
