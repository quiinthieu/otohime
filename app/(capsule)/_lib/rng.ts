// The n-th output of mulberry32 for a seed. Its state only ever adds
// 0x6D2B79F5, so step n is reached directly and a draw needs no history.
export function prng(seed: number, n: number): number {
  let t = (seed + Math.imul(n + 1, 0x6d2b79f5)) | 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
