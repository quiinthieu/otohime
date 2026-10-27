// The palace's ambience: the sea floor heard from inside Ryugu-jo, made on the spot with Web Audio. No audio file and
// no network: a few seconds of seeded brown noise, looped, under a low-pass whose cutoff drifts slowly up and down, so
// the water seems to move overhead, very quietly (AMBIENCE_DB).
//
// Off by default. The visitor turns it on with the palace's own sound button or the Pocket console's chip on the site
// (components/handheld.tsx); both write the one preference, localStorage[PALACE_SOUND_KEY] = "on" or "off". The palace
// may not import the site (./isolation.test.ts), so lib/palace-sound.ts declares the same key on the site's side and
// ./ambience.test.ts holds the two to it.
//
// Browsers let audio start only inside a click or key press, so the context is made (and resumed) only from one:
// an enable, or, when the preference was already on, the visitor's first gesture in the palace. Nothing ever plays on
// load. It is stopped when sound is switched off (here or by Pocket in another tab), suspended while the page is
// hidden, and closed when the palace is left. Anything Web Audio refuses (no API, a throwing constructor, a rejected
// resume) leaves the palace silent and working.

export const PALACE_SOUND_KEY = "ryugu-sound";
// Only the exact word "on" turns it on: unset, garbled or blocked storage is off.
export const parsePalaceSound = (stored: string | null | undefined): boolean => stored === "on";
export const storePalaceSound = (on: boolean) => (on ? "on" : "off");

export const AMBIENCE_DB = -38; // quieter than the site's quietest cue
export const AMBIENCE_SECONDS = 6;
export const AMBIENCE_SEED = 0x7279_7567; // "rybg"
export const AMBIENCE_CUTOFF_HZ = 360;
export const AMBIENCE_DRIFT_HZ = 140; // the cutoff wanders this far up and down
export const AMBIENCE_DRIFT_RATE = 0.05; // one slow pass every 20 s
export const AMBIENCE_Q = 0.7;
export const AMBIENCE_FADE = 2; // seconds in from silence
export const AMBIENCE_RELEASE = 0.4; // seconds out to silence

export const dbToGain = (db: number) => 10 ** (db / 20);

// mulberry32: a seeded sequence in [-1, 1). The same seed always gives the same sea.
function white(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (((t ^ (t >>> 14)) >>> 0) / 4294967296) * 2 - 1;
  };
}

/** Brown noise from a seed: white noise through a leaky integrator, tilted so the last sample meets the first (no
 * click where the loop wraps), then scaled to a peak of 1. */
export function brownNoise(seed: number, length: number): Float32Array {
  const out = new Float32Array(length);
  if (length === 0) return out;
  const next = white(seed);
  let b = 0;
  for (let i = 0; i < length; i++) {
    b = (b + 0.02 * next()) / 1.02;
    out[i] = b;
  }
  const drift = length > 1 ? (out[length - 1] - out[0]) / (length - 1) : 0;
  let peak = 0;
  for (let i = 0; i < length; i++) {
    out[i] -= drift * i;
    peak = Math.max(peak, Math.abs(out[i]));
  }
  if (peak > 0) for (let i = 0; i < length; i++) out[i] /= peak;
  return out;
}

// What the ambience needs of an AudioContext, so a test can hand it a fake.
export type Ctx = Pick<
  AudioContext,
  | "state"
  | "currentTime"
  | "sampleRate"
  | "destination"
  | "createBuffer"
  | "createBufferSource"
  | "createBiquadFilter"
  | "createGain"
  | "createOscillator"
  | "resume"
  | "suspend"
  | "close"
>;

type Voice = { source: AudioBufferSourceNode; drift: OscillatorNode; level: GainNode; nodes: AudioNode[] };

// The water: the loop through the drifting low-pass into a level faded in from silence.
function voice(c: Ctx): Voice {
  const length = Math.round(AMBIENCE_SECONDS * c.sampleRate);
  const buffer = c.createBuffer(1, length, c.sampleRate);
  buffer.getChannelData(0).set(brownNoise(AMBIENCE_SEED, length));
  const source = c.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  const lowpass = c.createBiquadFilter();
  lowpass.type = "lowpass";
  lowpass.frequency.value = AMBIENCE_CUTOFF_HZ;
  lowpass.Q.value = AMBIENCE_Q;
  const drift = c.createOscillator();
  drift.type = "sine";
  drift.frequency.value = AMBIENCE_DRIFT_RATE;
  const depth = c.createGain();
  depth.gain.value = AMBIENCE_DRIFT_HZ;
  drift.connect(depth).connect(lowpass.frequency);
  const level = c.createGain();
  const t0 = c.currentTime + 0.005;
  level.gain.setValueAtTime(0, t0);
  level.gain.linearRampToValueAtTime(dbToGain(AMBIENCE_DB), t0 + AMBIENCE_FADE);
  source.connect(lowpass).connect(level).connect(c.destination);
  source.start(t0);
  drift.start(t0);
  return { source, drift, level, nodes: [source, lowpass, drift, depth, level] };
}

// Lets a voice go: a short fade to silence, then its nodes stop and come apart.
function release(c: Ctx, v: Voice) {
  try {
    const t = c.currentTime;
    v.level.gain.cancelScheduledValues(t);
    v.level.gain.setValueAtTime(v.level.gain.value, t);
    v.level.gain.linearRampToValueAtTime(0, t + AMBIENCE_RELEASE);
    v.source.onended = () => v.nodes.forEach((n) => n.disconnect());
    v.source.stop(t + AMBIENCE_RELEASE);
    v.drift.stop(t + AMBIENCE_RELEASE);
  } catch {
    // the context is already closed: nothing is playing
  }
}

export type StoreLike = Pick<Storage, "getItem" | "setItem">;
export type Status = "off" | "waiting" | "playing" | "unsupported";

/** The palace's sound, one per page. `make` builds the AudioContext (null or a throw: no Web Audio); `available` says
 * up front whether the browser has one at all; `storage` is localStorage, or null where it is blocked. Every method is
 * safe to call at any time and never throws. */
export function createAmbience({ make, available = true, storage }: { make: () => Ctx | null; available?: boolean; storage: StoreLike | null }) {
  let enabled = false;
  try {
    enabled = parsePalaceSound(storage?.getItem(PALACE_SOUND_KEY));
  } catch {
    enabled = false; // storage blocked: off
  }
  let ctx: Ctx | null = null;
  let current: Voice | null = null;
  let unsupported = !available;
  let hidden = false;
  let closed = false;
  const listeners = new Set<() => void>();
  let status: Status = "off";

  const update = () => {
    const next: Status = unsupported ? "unsupported" : !enabled ? "off" : current ? "playing" : "waiting";
    if (next === status) return;
    status = next;
    listeners.forEach((l) => l());
  };
  update();

  const fail = () => {
    unsupported = true;
    stopVoice();
    const c = ctx;
    ctx = null;
    void Promise.resolve(c?.close()).catch(() => {});
    update();
  };

  function stopVoice() {
    const v = current;
    current = null;
    if (v && ctx) release(ctx, v);
  }

  function context(): Ctx | null {
    if (ctx) return ctx;
    if (unsupported) return null;
    try {
      ctx = make();
    } catch {
      ctx = null;
    }
    if (!ctx) unsupported = true;
    return ctx;
  }

  // Starts the water inside a gesture, if it is wanted and can be heard.
  function begin() {
    if (closed || !enabled || current || hidden) return update();
    const c = context();
    if (!c) return update();
    try {
      current = voice(c);
    } catch {
      return fail();
    }
    if (c.state !== "running") Promise.resolve(c.resume()).catch(fail);
    update();
  }

  function persist(on: boolean) {
    try {
      storage?.setItem(PALACE_SOUND_KEY, storePalaceSound(on));
    } catch {
      // storage blocked: the choice lasts this visit
    }
  }

  return {
    status: () => status,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
    /** The palace's sound button. Call from its click only: turning on starts the water inside that gesture. */
    toggle() {
      if (closed || unsupported) return;
      if (enabled) {
        enabled = false;
        persist(false);
        stopVoice();
        return update();
      }
      // a browser that turns out to have no working Web Audio keeps the preference as it was
      if (!context()) return update();
      enabled = true;
      persist(true);
      begin();
    },
    /** Any other click or key press in the palace: if sound was already on, this is the gesture that may start it. */
    gesture() {
      if (status === "waiting") begin();
    },
    /** The preference changed elsewhere (Pocket, in another tab). Off stops at once; on waits for a gesture here. */
    stored(value: string | null) {
      if (closed) return;
      enabled = parsePalaceSound(value);
      if (!enabled) stopVoice();
      update();
    },
    /** The page was hidden or shown again: the context sleeps while nobody can see the palace. */
    visibility(isHidden: boolean) {
      hidden = isHidden;
      if (!ctx || closed) return;
      if (hidden) Promise.resolve(ctx.suspend()).catch(() => {});
      else if (current) Promise.resolve(ctx.resume()).catch(fail);
    },
    /** The palace is being left (unmount, pagehide): the water stops and the context closes for good. */
    close() {
      if (closed) return;
      closed = true;
      stopVoice();
      const c = ctx;
      ctx = null;
      void Promise.resolve(c?.close()).catch(() => {});
      enabled = false; // only this page's view of it: the stored preference stands for the next visit
      update();
    },
  };
}

export type Ambience = ReturnType<typeof createAmbience>;

/** One mounted palace's ambience across back/forward-cache visits. Leaving (pagehide) closes it for good, but a page
 * the browser restores from its cache (pageshow, persisted) keeps the mounted button, so it gets a fresh ambience that
 * reads the stored preference again and, like any first visit, waits for a gesture. `onChange` hears every status. */
export function ambienceSession(open: () => Ambience, onChange: () => void) {
  let a = open();
  let unsubscribe = a.subscribe(onChange);
  return {
    current: () => a,
    hide: () => a.close(),
    show(persisted: boolean) {
      if (!persisted) return;
      unsubscribe();
      a.close();
      a = open();
      unsubscribe = a.subscribe(onChange);
      onChange();
    },
    dispose() {
      unsubscribe();
      a.close();
    },
  };
}

// The button's words for each status. Never claims to play when the browser cannot.
export function soundLabel(status: Status): { text: string; pressed: boolean; disabled: boolean; note: string } {
  switch (status) {
    case "playing":
      return { text: "Sea sound: on", pressed: true, disabled: false, note: "The sea is playing, quietly." };
    case "waiting":
      return { text: "Sea sound: on", pressed: true, disabled: false, note: "Sound is on: click or press a key and the sea starts." };
    case "unsupported":
      return { text: "Sea sound: unavailable", pressed: false, disabled: true, note: "This browser has no Web Audio, so the palace stays silent." };
    default:
      return { text: "Sea sound: off", pressed: false, disabled: false, note: "" };
  }
}
