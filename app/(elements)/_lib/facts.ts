// Typed access to funFacts.json: one fact in our own words per element, with
// the page it can be checked on. facts.test.ts validates the file itself; this
// module is imported by the pages through Next's plain JSON import.

import data from "./funFacts.json";

export interface Fact {
  fact: string;
  sourceUrl: string;
}

type FunFacts = Record<string, Fact> & { needsReview: number[] };

const FACTS = data as unknown as FunFacts;
const REVIEW = new Set(FACTS.needsReview);

export function factOf(n: number): Fact {
  const f = FACTS[String(n)];
  if (!f || Array.isArray(f)) throw new Error(`no fact for element ${n}`);
  return f;
}

/** True when the fact for element `n` still waits for a person to check it against its source. */
export function isNeedsReview(n: number): boolean {
  return REVIEW.has(n);
}
