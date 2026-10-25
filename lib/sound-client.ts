// The site's sound switch and its one Web Audio context. Off by default: the
// preference is localStorage.sound ("on" or "off"), read when the first
// toggle subscribes or a cue is asked for, never during render. The context
// is made on the first cue or enable, both of which only ever run inside a
// click or key press, so the browser's autoplay rule is met; it is reused
// after that and closed on pagehide. Anything Web Audio refuses (no API, a
// throwing constructor, a rejected resume) leaves the page silent and working.
import { CUES, cueGain, envelope, noteEnd, parseSound, SOUND_KEY, storeSound, type Cue, type CueName } from "@/lib/sound";

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
  if (!on) mute();
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
  else mute();
}

let ctx: AudioContext | null = null;

function close() {
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

function schedule(c: AudioContext, cue: Cue) {
  try {
    const peak = cueGain(cue);
    const t0 = c.currentTime + 0.005;
    for (const n of cue.notes) {
      const osc = c.createOscillator();
      osc.type = "square";
      osc.frequency.value = n.hz;
      const gain = c.createGain();
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
