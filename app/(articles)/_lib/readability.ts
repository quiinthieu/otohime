// "Concise and easy to understand" as numbers: syllables, sentences and the
// Flesch-Kincaid grade, all pure and all on plain text. The syllable rule is
// the simple one (vowel groups, a silent trailing e), so it is calibrated on
// vectors you can count by hand, not on a dictionary. A word is a token with a
// letter or digit in it, the same as words.ts counts.
import { textWords } from "./words.ts";

const WORDS_PER_MINUTE = 200;

const tokens = (text: string) => text.split(/\s+/).filter((t) => /[\p{L}\p{N}]/u.test(t));

// Vowel groups, less a silent trailing e (but "table" keeps its "-ble" and
// "the" keeps its only vowel), at least 1. A token with no letters, like
// 365.2422, counts as 1.
export function syllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (w === "") return 1;
  let n = w.match(/[aeiouy]+/g)?.length ?? 0;
  if (n > 1 && w.endsWith("e") && !/[^aeiouy]le$/.test(w)) n -= 1;
  return Math.max(1, n);
}

// Splits after . ! or ? (and any closing quote or bracket) followed by space
// or the end, so the point in 0.917 never ends a sentence.
export function sentences(text: string): string[] {
  return text
    .split(/(?<=[.!?]["'”’)]*)\s+/)
    .map((s) => s.trim())
    .filter((s) => tokens(s).length > 0);
}

export function fkGrade(text: string): number {
  const words = tokens(text);
  const count = Math.max(1, sentences(text).length);
  if (words.length === 0) return 0;
  const syl = words.reduce((sum, w) => sum + syllables(w), 0);
  return 0.39 * (words.length / count) + 11.8 * (syl / words.length) - 15.59;
}

export function longestSentence(text: string): number {
  return Math.max(0, ...sentences(text).map(textWords));
}

export function meanSentence(text: string): number {
  const all = sentences(text);
  return all.length === 0 ? 0 : textWords(text) / all.length;
}

export function readingMinutes(words: number): number {
  return Math.max(1, Math.ceil(words / WORDS_PER_MINUTE));
}
