import type { Note } from "./sound.ts";
export const PENTATONIC = [220, 247, 294, 330, 392] as const;
export const BABBLE_LIMIT = 2.3; // leaves room for clapper, envelope and scheduler margin
/** Deterministic tiny syllables. At most 28 notes = 56 nodes, plus four clapper nodes. */
export function babble(text: string, seed: number): Note[] {
  const notes: Note[] = [];
  let at = 0.12;
  let state = seed >>> 0;
  for (const char of text.slice(0, 1024)) {
    if (/[.,!?;:—]/u.test(char)) { at += 0.15; continue; }
    if (/\s/u.test(char)) { at += 0.025; continue; }
    if (notes.length >= 28 || at + 0.07 > BABBLE_LIMIT) break;
    state = (Math.imul(state, 1664525) + 1013904223 + char.codePointAt(0)!) >>> 0;
    notes.push({ hz: PENTATONIC[state % PENTATONIC.length], at, attack: 0.008, decay: 0.045 });
    at += 0.065;
  }
  return notes;
}
