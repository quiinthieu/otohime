// Pure typewriter stepper for the Ask receipt: given the full text, how much of it is shown and a reduced-motion
// flag, the next step. components/ask-console.tsx drives it from requestAnimationFrame. Under reduced motion every
// step is the whole text. A step never ends between the two halves of a surrogate pair. No browser APIs.

// 40 characters a second.
export const CHAR_MS = 25;

export type Step = { readonly index: number; readonly shown: string; readonly done: boolean };

const isHigh = (code: number) => code >= 0xd800 && code <= 0xdbff;

// Advances `chars` characters from `index` (clamped to the text), or straight to the end when `reduced`.
export function step(text: string, index: number, reduced: boolean, chars = 1): Step {
  const end = text.length;
  let next = reduced ? end : Math.min(end, Math.max(0, Math.trunc(index) || 0) + Math.max(0, Math.trunc(chars) || 0));
  if (next > 0 && next < end && isHigh(text.charCodeAt(next - 1))) next++;
  return { index: next, shown: text.slice(0, next), done: next >= end };
}

// How many characters should be on paper `elapsedMs` after typing starts: the first one on the first frame.
export function due(elapsedMs: number, charMs = CHAR_MS): number {
  return elapsedMs > 0 ? Math.floor(elapsedMs / charMs) + 1 : 1;
}
