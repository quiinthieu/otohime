// The console's beeps, and the ink toys' stamp, rustle and press, as data: each
// cue is a few notes (square unless the cue names another wave) with a short attack and decay. Pure, so a test can read every envelope without a
// browser; lib/sound-client.ts plays them on Web Audio.

export type Note = {
  hz: number;
  at: number; // seconds after the cue starts
  attack: number; // seconds from silence to the peak
  decay: number; // seconds from the peak back to silence
};
export type Cue = { db: number; notes: readonly Note[]; wave?: OscillatorType };
export type CueName = "move" | "open" | "back" | "chime" | "eat" | "burst" | "stamp" | "rustle" | "press";

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
  // a rubber stamp pressed down: a low thud that drops as it lands
  stamp: { db: -19, notes: [note(196, 0, 0.002, 0.04), note(110, 0.02, 0.002, 0.09)] },
  // paper moved: quiet high ticks, unevenly spaced
  rustle: {
    db: -26,
    notes: [
      note(1480, 0, 0.002, 0.02),
      note(1245, 0.025, 0.002, 0.018),
      note(1660, 0.045, 0.002, 0.022),
      note(1320, 0.075, 0.002, 0.02),
      note(1560, 0.1, 0.002, 0.03),
    ],
  },
  // a letterpress key pushed down: a soft paper thunk, the quietest cue
  press: { db: -28, wave: "triangle", notes: [note(140, 0, 0.003, 0.07), note(90, 0.015, 0.003, 0.07)] },
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

// One bounded pet purr, on the site's shared context. No loop or media file.
export const PURR: Cue = { db: -34, wave: "triangle", notes: [
  note(147, 0, 0.008, 0.09), note(165, 0.09, 0.008, 0.09), note(147, 0.18, 0.008, 0.09),
] };
