// The site's sound switch and its one Web Audio context. Off by default: the
// preference is localStorage.sound ("on" or "off"), read when the first
// toggle subscribes or a cue is asked for, never during render. The context
// is made on the first cue or enable, both of which only ever run inside a
// click or key press, so the browser's autoplay rule is met; it is reused
// after that and closed on pagehide. Anything Web Audio refuses (no API, a
// throwing constructor, a rejected resume) leaves the page silent and working.
//
// The pond's water (startWater / stopWater) is the one looped layer: seeded brown noise under a 500 Hz low-pass,
// swelling slowly, about -36 dB. It starts only from a click while sound is on and stops when the page is hidden,
// on pagehide, when sound is switched off, or when the pond asks (out of view, unmounted). No audio files.
import { CLAPPER, CUES, cueGain, dbToGain, envelope, noteEnd, parseSound, PURR, SOUND_KEY, storeSound, type Cue, type CueName, type Note } from "./sound.ts";

let on = false;
let loaded = false;
const listeners = new Set<() => void>();

function load() {
  if (loaded) return;
  loaded = true;
  try {
    on = parseSound(localStorage.getItem(SOUND_KEY));
  } catch {
    on = false; // storage blocked: off, until the toggle says otherwise
  }
}

const emit = () => listeners.forEach((listener) => listener());

function onStorage(event: StorageEvent) {
  if (event.key !== SOUND_KEY && event.key !== null) return;
  on = parseSound(event.newValue);
  if (!on) {
    stopPurr();
    stopWater();
    stopStoryVoice();
    mute();
  }
  emit();
}

// For useSyncExternalStore. The server, and the first client render, hear nothing.
export function subscribeSound(listener: () => void) {
  load();
  if (listeners.size === 0) addEventListener("storage", onStorage);
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) removeEventListener("storage", onStorage);
  };
}
export const getSound = () => on;
export const getServerSound = () => false;

// Call from a click or key press only.
export function setSound(next: boolean) {
  load();
  on = next;
  try {
    localStorage.setItem(SOUND_KEY, storeSound(next));
  } catch {
    // storage blocked: the choice lasts until reload
  }
  emit();
  if (next) play("open");
  else {
    stopPurr();
    stopWater();
    stopStoryVoice();
    mute();
  }
}

let ctx: AudioContext | null = null;

function close() {
  stopPurr();
  stopStoryVoice();
  const c = ctx;
  ctx = null;
  void c?.close().catch(() => {});
}

function mute() {
  void ctx?.suspend().catch(() => {});
}

function unlock(): AudioContext | null {
  if (!ctx) {
    if (typeof AudioContext !== "function") return null;
    try {
      ctx = new AudioContext();
    } catch {
      return null;
    }
    addEventListener("pagehide", close, { once: true });
  }
  return ctx;
}

function schedule(c: AudioContext, cue: Cue, delay = 0) {
  const voices: { osc: OscillatorNode; gain: GainNode }[] = [];
  try {
    const peak = cueGain(cue);
    const t0 = c.currentTime + 0.005 + delay;
    for (const n of cue.notes) {
      const osc = c.createOscillator();
      osc.type = cue.wave ?? "square";
      osc.frequency.value = n.hz;
      const gain = c.createGain();
      voices.push({ osc, gain });
      envelope(n, t0, peak).forEach(([t, v], i) => {
        if (i === 0) gain.gain.setValueAtTime(v, t);
        else gain.gain.linearRampToValueAtTime(v, t);
      });
      osc.connect(gain).connect(c.destination);
      osc.onended = () => {
        osc.disconnect();
        gain.disconnect();
      };
      osc.start(t0 + n.at);
      osc.stop(t0 + noteEnd(n) + 0.01);
    }
  } catch {
    // a context closed under us: skip the beep
  }
  return () => voices.forEach(({ osc, gain }) => {
    try { gain.disconnect(); osc.stop(); osc.disconnect(); } catch { /* already ended */ }
  });
}

let cancelPurr: (() => void) | null = null;
let purrGeneration = 0;
function hiddenPurr() { if (document.hidden) stopPurr(); }
export function stopPurr() {
  purrGeneration++;
  cancelPurr?.(); cancelPurr = null;
  if (typeof document !== "undefined") document.removeEventListener("visibilitychange", hiddenPurr);
}

// Called at gesture-down, so unlocking stays inside the browser's user activation.
// Schedule the quiet cue after the hold threshold; release cancels even pending resumes/notes.
export function startPurr(delay = 0.5): boolean {
  stopPurr(); load();
  if (!on || (typeof document !== "undefined" && document.hidden)) return false;
  const c = unlock();
  if (!c) return false;
  const generation = purrGeneration;
  const asked = performance.now();
  const begin = () => {
    if (generation !== purrGeneration || !on || ctx !== c) return;
    cancelPurr = schedule(c, PURR, Math.max(0, Math.min(0.5, delay)));
  };
  if (typeof document !== "undefined") document.addEventListener("visibilitychange", hiddenPurr);
  if (c.state === "running") begin();
  else void c.resume().then(() => { if (performance.now() - asked < 250) begin(); }, () => stopPurr());
  return true;
}

// Plays a cue if sound is on. Call from a click or key press only.
export function play(name: CueName) {
  load();
  if (!on) return;
  const c = unlock();
  if (!c) return;
  if (c.state === "running") return schedule(c, CUES[name]);
  // Suspended (a fresh context, or muted earlier): resume, and play only if
  // that is quick, so a late resume never fires a stale beep. A refused
  // resume (autoplay blocked) is silence.
  const asked = performance.now();
  c.resume().then(
    () => {
      if (ctx === c && on && c.state === "running" && performance.now() - asked < 250) schedule(c, CUES[name]);
    },
    () => {},
  );
}

// The water: a few seconds of brown noise looped, low-passed, its level breathing on a slow sine.
export const WATER_DB = -36;
export const WATER_LOWPASS_HZ = 500;
export const WATER_SWELL_HZ = 0.07; // one slow swell every ~14 s
export const WATER_SWELL_DEPTH = 0.3; // of the level, up and down
export const WATER_SECONDS = 4;
export const WATER_SEED = 0x5e1ca7;
const WATER_FADE = 1.2; // seconds in
const WATER_RELEASE = 0.25; // seconds out

// mulberry32: the n-th draw of a seeded sequence, in [-1, 1). No Math.random.
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
 * click where the loop wraps), then scaled to a peak of 1. The same seed and length always give the same samples. */
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

type Water = { c: AudioContext; source: AudioBufferSourceNode; swell: OscillatorNode; level: GainNode; nodes: AudioNode[] };
let water: Water | null = null;

function onVisibility() {
  if (document.visibilityState === "hidden") stopWater();
}

/** Starts the pond's water if sound is on and it is not already running; returns whether it is running. Call from a
 * click or key press only. */
export function startWater(): boolean {
  load();
  if (!on) return false;
  if (water && water.c === ctx && ctx?.state !== "closed") return true;
  water = null;
  const c = unlock();
  if (!c) return false;
  try {
    const length = Math.round(WATER_SECONDS * c.sampleRate);
    const buffer = c.createBuffer(1, length, c.sampleRate);
    buffer.getChannelData(0).set(brownNoise(WATER_SEED, length));
    const source = c.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const lowpass = c.createBiquadFilter();
    lowpass.type = "lowpass";
    lowpass.frequency.value = WATER_LOWPASS_HZ;
    // the swell: a gain of 1 that a slow sine pushes WATER_SWELL_DEPTH up and down
    const breath = c.createGain();
    breath.gain.value = 1;
    const swell = c.createOscillator();
    swell.type = "sine";
    swell.frequency.value = WATER_SWELL_HZ;
    const depth = c.createGain();
    depth.gain.value = WATER_SWELL_DEPTH;
    swell.connect(depth).connect(breath.gain);
    // the level: faded in from silence, so the water never starts with a click
    const level = c.createGain();
    const t0 = c.currentTime + 0.005;
    level.gain.setValueAtTime(0, t0);
    level.gain.linearRampToValueAtTime(dbToGain(WATER_DB), t0 + WATER_FADE);
    source.connect(lowpass).connect(breath).connect(level).connect(c.destination);
    source.start(t0);
    swell.start(t0);
    water = { c, source, swell, level, nodes: [source, lowpass, breath, swell, depth, level] };
  } catch {
    return false; // a context closed under us: the pond stays quiet
  }
  document.addEventListener("visibilitychange", onVisibility);
  addEventListener("pagehide", stopWater);
  if (c.state !== "running") void c.resume().catch(() => stopWater());
  return true;
}

/** Fades the water out and lets it go. Safe to call at any time, as often as you like. */
export function stopWater() {
  const w = water;
  water = null;
  if (typeof document !== "undefined") document.removeEventListener("visibilitychange", onVisibility);
  removeEventListener("pagehide", stopWater);
  if (!w) return;
  try {
    const t = w.c.currentTime;
    w.level.gain.cancelScheduledValues(t);
    w.level.gain.setValueAtTime(w.level.gain.value, t);
    w.level.gain.linearRampToValueAtTime(0, t + WATER_RELEASE);
    w.source.onended = () => w.nodes.forEach((n) => n.disconnect());
    w.source.stop(t + WATER_RELEASE);
    w.swell.stop(t + WATER_RELEASE);
  } catch {
    // the context is already closed: nothing is playing
  }
}

// The theatre supplies pure notes only after deliberate input; no second context.
let voiceGeneration = 0;
let cancelVoice: (() => void) | null = null;
let voiceTimer: ReturnType<typeof setTimeout> | undefined;
function hiddenVoice() { if (document.visibilityState === "hidden") stopStoryVoice(); }
export function stopStoryVoice() {
  voiceGeneration++;
  cancelVoice?.(); cancelVoice = null;
  clearTimeout(voiceTimer); voiceTimer = undefined;
  if (typeof document !== "undefined") document.removeEventListener("visibilitychange", hiddenVoice);
  removeEventListener("pagehide", stopStoryVoice);
}
/** At most 28 babble + two clapper oscillators, each with one gain. */
export function startStoryVoice(notes: readonly Note[]): boolean {
  stopStoryVoice(); load();
  if (!on || (typeof document !== "undefined" && document.visibilityState === "hidden")) return false;
  // Fail closed for malformed callers as well as capping nodes and time.
  const bounded = notes.slice(0, 28).filter(n => Object.values(n).every(Number.isFinite) &&
    n.hz >= 100 && n.hz <= 1000 && n.at >= 0.1 && n.attack > 0 && n.decay > 0 && noteEnd(n) <= 2.3);
  const c = unlock();
  if (!c) return false;
  const generation = voiceGeneration;
  const asked = performance.now();
  const begin = () => {
    if (generation !== voiceGeneration || !on || ctx !== c || performance.now() - asked >= 250) return;
    const clapper = schedule(c, CLAPPER);
    const voice = schedule(c, { db: -32, wave: "triangle", notes: bounded });
    cancelVoice = () => { clapper(); voice(); };
    voiceTimer = setTimeout(stopStoryVoice, 2400);
  };
  document.addEventListener("visibilitychange", hiddenVoice);
  addEventListener("pagehide", stopStoryVoice);
  if (c.state === "running") begin();
  else void c.resume().then(begin, () => { if (generation === voiceGeneration) stopStoryVoice(); });
  return true;
}
