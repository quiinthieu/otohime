import { shimiRng } from "./rng.ts";
import { extractCrawlableWords } from "./walker.ts";

export const SHIMI_DIET_MAX_TOKENS = 2000;
export type ShimiDiet = {
  readonly maxTokens: number;
  readonly tokens: readonly string[];
  readonly next: ReadonlyMap<string, readonly string[]>;
};
const bound = (n: number, low: number, high: number, fallback: number) =>
  Math.max(low, Math.min(high, Number.isFinite(n) ? Math.floor(n) : fallback));

export function createShimiDiet(maxTokens = SHIMI_DIET_MAX_TOKENS): ShimiDiet {
  return { maxTokens: bound(maxTokens, 1, SHIMI_DIET_MAX_TOKENS, SHIMI_DIET_MAX_TOKENS), tokens: [], next: new Map() };
}

/** Returns a new FIFO snapshot; evicted words also leave the transition table. */
export function ingestWords(diet: ShimiDiet, words: readonly string[]): ShimiDiet {
  const maxTokens = bound(diet.maxTokens, 1, SHIMI_DIET_MAX_TOKENS, SHIMI_DIET_MAX_TOKENS);
  const tokens = [...diet.tokens, ...words.flatMap(extractCrawlableWords)].slice(-maxTokens);
  const next = new Map<string, string[]>();
  for (let i = 0; i + 1 < tokens.length; i++) {
    const successors = next.get(tokens[i]) ?? [];
    successors.push(tokens[i + 1]);
    next.set(tokens[i], successors);
  }
  return { maxTokens, tokens, next };
}

const FALLBACK = ["little", "paper", "dreams", "taste", "of", "quiet", "ink"];
export function generateShimiBurp(diet: ShimiDiet, seed: number, minWords = 4, maxWords = 10): string {
  const rng = shimiRng(seed);
  const min = bound(minWords, 4, 10, 4);
  const max = bound(maxWords, min, 10, 10);
  const count = min + Math.floor(rng() * (max - min + 1));
  const vocabulary = diet.tokens.length >= 4 ? diet.tokens : FALLBACK;
  const pick = (items: readonly string[]) => items[Math.floor(rng() * items.length)];
  let word = pick(vocabulary);
  const phrase = [word];
  while (phrase.length < count) {
    const successors = diet.tokens.length >= 4 ? diet.next.get(word) : undefined;
    word = pick(successors?.length ? successors : vocabulary);
    phrase.push(word);
  }
  return phrase.join(" ");
}
