// An optional, faint vinyl crackle, behind NEXT_PUBLIC_VINYL_CRACKLE=1 (off
// by default). It is synthesised: a few seconds of soft hiss and random pops,
// computed here and looped, so no audio file is shipped. It lives on its own
// AudioContext and gain node and only ever plays into the speakers; it never
// reads from, routes or masks the YouTube player (no media element source, no
// stream, nothing touches the iframe). The YouTube video stays the music.
//
// The context is created and resumed only inside a gesture (unlock), the
// loop runs only while the deck is playing in a visible tab, and close() on
// unmount releases it.

import type { Phase } from "./deck.ts";

export const CRACKLE_ENABLED = process.env.NEXT_PUBLIC_VINYL_CRACKLE === "1";

export const MAX_DB = -30; // never louder than this
export const MIN_DB = -80;
export const DEFAULT_DB = -36;
export const LOOP_S = 4;
export const POPS_PER_S = 7;
export const HISS = 0.012; // the hiss's peak amplitude, before the gain
export const POP_ATTACK_S = 0.0004;
export const POP_DECAY_S = 0.003;

// A pop's amplitude t seconds after it starts: a near-instant rise, then an
// exponential decay. 0 before it starts; 1 at the top.
export function popEnvelope(t: number): number {
  if (!(t >= 0)) return 0;
  if (t < POP_ATTACK_S) return t / POP_ATTACK_S;
  return Math.exp(-(t - POP_ATTACK_S) / POP_DECAY_S);
}

// The gain for a level in dB, clamped to MIN_DB..MAX_DB (a bad number is the quietest).
export function crackleGain(db: number): number {
  const level = Number.isFinite(db) ? Math.min(MAX_DB, Math.max(MIN_DB, db)) : MIN_DB;
  return 10 ** (level / 20);
}

// Small seeded generator, so a test can pin the loop down.
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// The loop's samples: hiss plus POPS_PER_S pops a second, each a short
// noisy click shaped by popEnvelope, all clamped to [-1, 1].
export function crackleSamples(sampleRate: number, seconds = LOOP_S, seed = 33): { samples: Float32Array<ArrayBuffer>; pops: number[] } {
  const n = Math.max(0, Math.round(sampleRate * seconds));
  const samples = new Float32Array(n);
  const rand = mulberry32(seed);
  for (let i = 0; i < n; i++) samples[i] = (rand() * 2 - 1) * HISS;
  const count = Math.round(POPS_PER_S * seconds);
  const length = Math.ceil(POP_ATTACK_S * sampleRate + 6 * POP_DECAY_S * sampleRate);
  const pops: number[] = [];
  for (let k = 0; k < count && n > 0; k++) {
    const at = Math.floor(rand() * n);
    const amp = (0.25 + rand() * 0.75) * (rand() < 0.5 ? -1 : 1);
    pops.push(at);
    for (let j = 0; j < length && at + j < n; j++) {
      samples[at + j] += amp * popEnvelope(j / sampleRate) * (0.7 + 0.3 * (rand() * 2 - 1));
    }
  }
  for (let i = 0; i < n; i++) samples[i] = Math.min(1, Math.max(-1, samples[i]));
  return { samples, pops };
}

// The crackle sounds only while the record plays, in a visible tab, with the flag and the toggle on.
export function crackleShouldPlay(o: { enabled: boolean; on: boolean; phase: Phase; hidden: boolean }): boolean {
  return o.enabled && o.on && !o.hidden && o.phase === "playing";
}

// The slice of the Web Audio API the crackle uses.
export type CrackleContext = Pick<
  AudioContext,
  "sampleRate" | "destination" | "createBuffer" | "createBufferSource" | "createGain" | "resume" | "suspend" | "close"
>;

export type Crackle = {
  unlock(): void; // call from a gesture: creates and resumes the context
  set(play: boolean): void; // start or stop the loop; never starts before unlock
  close(): void; // unmount
};

export function createCrackle(make: () => CrackleContext = () => new AudioContext(), db = DEFAULT_DB): Crackle {
  let ctx: CrackleContext | null = null;
  let gain: GainNode | null = null;
  let buffer: AudioBuffer | null = null;
  let source: AudioBufferSourceNode | null = null;
  const quiet = (p: Promise<void> | undefined) => void p?.catch(() => {});

  function set(play: boolean) {
    if (!play) {
      if (source) {
        try {
          source.stop();
        } catch {
          // never started
        }
        source.disconnect();
        source = null;
        quiet(ctx?.suspend());
      }
      return;
    }
    if (!ctx || !gain || !buffer || source) return;
    source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.connect(gain);
    source.start();
    quiet(ctx.resume());
  }

  return {
    unlock() {
      if (!ctx) {
        try {
          ctx = make();
        } catch {
          return; // no Web Audio here: the page plays on without the crackle
        }
        const { samples } = crackleSamples(ctx.sampleRate);
        buffer = ctx.createBuffer(1, samples.length, ctx.sampleRate);
        buffer.copyToChannel(samples, 0);
        gain = ctx.createGain();
        gain.gain.value = crackleGain(db);
        gain.connect(ctx.destination);
      }
      quiet(ctx.resume());
    },
    set,
    close() {
      set(false);
      gain?.disconnect();
      quiet(ctx?.close());
      ctx = null;
      gain = null;
      buffer = null;
    },
  };
}
