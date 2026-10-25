// The console's beeps, as data: each cue is a few square-wave notes with a
// short attack and decay. Pure, so a test can read every envelope without a
// browser; lib/sound-client.ts plays them on Web Audio.

export type Note = {
  hz: number;
  at: number; // seconds after the cue starts
  attack: number; // seconds from silence to the peak
  decay: number; // seconds from the peak back to silence
};
export type Cue = { db: number; notes: readonly Note[] };
export type CueName = "move" | "open" | "back" | "chime" | "eat" | "burst";

// Nothing plays louder than this, whatever a cue asks for.
export const MAX_DB = -18;
export const SOUND_KEY = "sound";

const note = (hz: number, at = 0, attack = 0.004, decay = 0.05): Note => ({ hz, at, attack, decay });

export const CUES: Record<CueName, Cue> = {
  // a cursor tick
  move: { db: -24, notes: [note(880, 0, 0.003, 0.035)] },
  // A: up a fifth
  open: { db: -20, notes: [note(660), note(990, 0.06, 0.004, 0.08)] },
  // B or a step back: down a fourth
  back: { db: -20, notes: [note(784), note(587, 0.06, 0.004, 0.08)] },
  // the boot jingle: C E G C
  chime: {
    db: -20,
    notes: [note(523, 0, 0.005, 0.1), note(659, 0.09, 0.005, 0.1), note(784, 0.18, 0.005, 0.1), note(1047, 0.27, 0.005, 0.18)],
  },
  // a pellet
  eat: { db: -22, notes: [note(1320, 0, 0.002, 0.03), note(1760, 0.03, 0.002, 0.04)] },
  // a crash: falling, a little longer
  burst: { db: -18, notes: [note(392, 0, 0.003, 0.06), note(262, 0.05, 0.003, 0.08), note(165, 0.11, 0.003, 0.14)] },
};

export const dbToGain = (db: number) => 10 ** (db / 20);

// The peak gain a cue's notes reach, never above MAX_DB.
export const cueGain = (cue: Cue) => dbToGain(Math.min(cue.db, MAX_DB));

export const noteEnd = (n: Note) => n.at + n.attack + n.decay;
export const cueLength = (cue: Cue) => Math.max(0, ...cue.notes.map(noteEnd));

// A note's gain automation from its start time t: silence, the peak, silence.
export function envelope(n: Note, t: number, peak: number): [time: number, gain: number][] {
  const start = t + n.at;
  return [
    [start, 0],
    [start + n.attack, peak],
    [start + n.attack + n.decay, 0],
  ];
}

// The stored preference: only the exact word "on" turns it on.
export const parseSound = (stored: string | null | undefined): boolean => stored === "on";
export const storeSound = (on: boolean) => (on ? "on" : "off");
