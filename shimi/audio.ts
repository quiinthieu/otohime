import type { Cue } from "../lib/sound.ts";

/** C Yo pentatonic (0, 2, 5, 7, 9), two octaves, C4 through A5. */
export const SHIMI_PENTATONIC_HZ: readonly number[] = Object.freeze(
  [60, 62, 65, 67, 69, 72, 74, 77, 79, 81].map(midi => 440 * 2 ** ((midi - 69) / 12)),
);
export const charToPentatonicHz = (char: string): number =>
  SHIMI_PENTATONIC_HZ[(char.codePointAt(0) ?? 0) % SHIMI_PENTATONIC_HZ.length];

export function buildShimiChirpCue(char: string, durationMs = 48): Cue {
  const duration = Math.max(30, Math.min(80, Number.isFinite(durationMs) ? durationMs : 48)) / 1000;
  return { db: -28, wave: (char.codePointAt(0) ?? 0) % 2 ? "triangle" : "sine",
    notes: [{ hz: charToPentatonicHz(char), at: 0, attack: 0.004, decay: duration - 0.004 }] };
}

/** Explicit monotonic milliseconds. Rejections consume neither a voice nor a rate slot.
 * Reserve through the oscillator's actual end (including any scheduler release tail).
 */
export function createShimiChirpLimiter(options: { maxVoices?: number; maxPerSecond?: number } = {}) {
  const cap = (n: number | undefined, max: number) => Number.isFinite(n) ? Math.max(1, Math.min(max, Math.floor(n!))) : max;
  const maxVoices = cap(options.maxVoices, 3), maxPerSecond = cap(options.maxPerSecond, 8);
  let starts: number[] = [], ends: number[] = [], last = -Infinity;
  return {
    /** durationMs is the reservation length, not just the audible envelope. */
    tryChirp(nowMs: number, durationMs = 80): boolean {
      if (!Number.isFinite(nowMs) || nowMs < last || !Number.isFinite(durationMs) || durationMs <= 0) return false;
      last = nowMs;
      starts = starts.filter(start => nowMs - start < 1000);
      ends = ends.filter(end => end > nowMs);
      if (starts.length >= maxPerSecond || ends.length >= maxVoices) return false;
      starts.push(nowMs); ends.push(nowMs + Math.max(30, durationMs));
      return true;
    },
  };
}
