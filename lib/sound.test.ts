import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";
import {
  CUES,
  cueGain,
  cueLength,
  dbToGain,
  envelope,
  MAX_DB,
  noteEnd,
  parseSound,
  SOUND_KEY,
  storeSound,
  PURR,
  SHUTTER,
  SHUTTER_SEED,
  shutterClackSamples,
  type Cue,
  type CueName,
} from "./sound.ts";
import { play, setSound, startPurr, stopPurr } from "./sound-client.ts";

const NAMES: CueName[] = ["move", "open", "back", "chime", "eat", "burst", "stamp", "rustle", "press", "shuffle", "shutter", "fold"];
const OLD = NAMES.filter((name) => name !== "press" && name !== "fold");

test("the twelve cues the console and the ink toys need are all there", () => {
  assert.deepEqual(Object.keys(CUES).sort(), [...NAMES].sort());
});

test("every cue is short, audible and quick to start and stop", () => {
  for (const name of NAMES) {
    const cue = CUES[name];
    assert.ok(cue.notes.length > 0, name);
    assert.ok(cueLength(cue) <= (name === "chime" ? 0.5 : 0.3), `${name} lasts ${cueLength(cue)} s`);
    for (const n of cue.notes) {
      assert.ok(n.hz >= (name === "press" ? 80 : 100) && n.hz <= 2000, `${name} ${n.hz} Hz`);
      assert.ok(n.at >= 0, name);
      assert.ok(n.attack > 0 && n.attack <= 0.01, `${name} attack ${n.attack}`);
      assert.ok(n.decay > 0 && n.decay <= 0.2, `${name} decay ${n.decay}`);
    }
  }
});

test("a cue's notes run in order", () => {
  for (const name of NAMES) {
    const starts = CUES[name].notes.map((n) => n.at);
    assert.deepEqual(starts, [...starts].sort((a, b) => a - b), name);
  }
});

test("gain is capped at -18 dB", () => {
  assert.equal(MAX_DB, -18);
  assert.ok(Math.abs(dbToGain(-18) - 0.1259) < 1e-4);
  assert.equal(dbToGain(0), 1);
  for (const name of NAMES) assert.ok(cueGain(CUES[name]) <= dbToGain(MAX_DB) + 1e-12, name);
  const loud: Cue = { db: 0, notes: [{ hz: 440, at: 0, attack: 0.01, decay: 0.01 }] };
  assert.equal(cueGain(loud), dbToGain(MAX_DB));
  assert.equal(cueGain({ ...loud, db: -30 }), dbToGain(-30));
});

test("an envelope starts and ends silent and peaks after the attack", () => {
  const n = CUES.open.notes[1];
  const points = envelope(n, 2, 0.1);
  assert.deepEqual(points, [
    [2 + n.at, 0],
    [2 + n.at + n.attack, 0.1],
    [2 + noteEnd(n), 0],
  ]);
  const times = points.map(([t]) => t);
  assert.deepEqual(times, [...times].sort((a, b) => a - b));
});

test("the table is not changed by reading it", () => {
  const before = JSON.stringify(CUES);
  for (const name of NAMES) for (const n of CUES[name].notes) envelope(n, 0, cueGain(CUES[name]));
  assert.equal(JSON.stringify(CUES), before);
});

test("the stored preference is off unless it says on", () => {
  assert.equal(SOUND_KEY, "sound");
  assert.equal(parseSound("on"), true);
  for (const v of [null, undefined, "", "off", "true", "ON", "1"]) assert.equal(parseSound(v), false, String(v));
  assert.equal(parseSound(storeSound(true)), true);
  assert.equal(parseSound(storeSound(false)), false);
});

test("a stamp is a low falling thud and a rustle is quiet high ticks", () => {
  const { stamp, rustle } = CUES;
  for (const cue of [stamp, rustle]) assert.ok(cue.db <= MAX_DB, `asks for ${cue.db} dB`);
  const thud = stamp.notes.map((n) => n.hz);
  assert.ok(thud.every((hz) => hz <= 220), `stamp ${thud}`);
  assert.deepEqual(thud, [...thud].sort((a, b) => b - a), "stamp falls");
  assert.ok(rustle.notes.length >= 4, "a rustle is several ticks");
  assert.ok(rustle.notes.every((n) => n.hz >= 1000 && n.decay <= 0.03), "rustle ticks are high and short");
  const gaps = rustle.notes.slice(1).map((n, i) => +(n.at - rustle.notes[i].at).toFixed(3));
  assert.ok(new Set(gaps).size > 1, `rustle ticks are unevenly spaced: ${gaps}`);
  assert.ok(cueGain(rustle) < cueGain(stamp), "a rustle sits under a stamp");

  const { shuffle, shutter } = CUES;
  assert.ok(shuffle.db <= MAX_DB, `shuffle asks for ${shuffle.db} dB`);
  assert.ok(shuffle.notes.length >= 5, "a shuffle is a quick cascade of paper ticks");
  assert.ok(cueLength(shuffle) <= 0.25, "shuffle finishes crisply");
  assert.ok(cueGain(shuffle) < cueGain(stamp), "a shuffle sits under a stamp");

  assert.equal(SHUTTER, shutter);
  assert.ok(shutter.db <= MAX_DB, `shutter asks for ${shutter.db} dB`);
  assert.ok(cueGain(shutter) <= dbToGain(MAX_DB) + 1e-12, "shutter capped at <= -18 dB");
  assert.ok(cueLength(shutter) <= 0.15, "shutter clack is crisp and short");
  const burstNotes = shutter.notes.slice(0, 3);
  const clickNotes = shutter.notes.slice(3);
  assert.ok(burstNotes.every((n) => n.hz >= 1400 && n.decay <= 0.02), "shutter begins with a short high noise-burst");
  assert.ok(clickNotes.length === 2 && clickNotes[0].hz > clickNotes[1].hz && clickNotes[0].hz <= 300, "shutter ends with a falling mechanical click");
});

test("a press is a soft falling thunk, quieter than every other cue", () => {
  const { press } = CUES;
  assert.ok(press.db <= MAX_DB, `asks for ${press.db} dB`);
  assert.equal(press.db, -28);
  assert.ok(cueGain(press) < cueGain(CUES.move), "a press sits under a cursor tick");
  for (const name of OLD) assert.ok(cueGain(press) < cueGain(CUES[name]), `a press sits under ${name}`);
  assert.ok(press.wave === "sine" || press.wave === "triangle", `press is ${press.wave}`);
  assert.deepEqual(press.notes, [
    { hz: 140, at: 0, attack: 0.003, decay: 0.07 },
    { hz: 90, at: 0.015, attack: 0.003, decay: 0.07 },
  ]);
  // The old cues name no wave, so they stay square.
  for (const name of OLD) assert.equal(CUES[name].wave, undefined, name);
});

// A Web Audio stand-in: each oscillator it makes remembers its pitch, wave and
// the gain values its envelope was set to.
type Voice = { hz: number; wave: string; gains: number[]; started: boolean; disconnected: boolean };
class FakeAudioContext {
  static made = 0;
  static current: FakeAudioContext;
  static voices: Voice[] = [];
  state: "running" | "suspended" | "closed" = "running";
  currentTime = 1;
  destination = {};
  constructor() {
    FakeAudioContext.made++;
    FakeAudioContext.current = this;
  }
  createOscillator() {
    const voice: Voice = { hz: 0, wave: "", gains: [], started: false, disconnected: false };
    FakeAudioContext.voices.push(voice);
    return {
      set type(w: string) {
        voice.wave = w;
      },
      frequency: {
        set value(hz: number) {
          voice.hz = hz;
        },
      },
      onended: null,
      connect: (gain: { values: number[] }) => ((voice.gains = gain.values), gain),
      start: () => (voice.started = true),
      stop: () => {},
      disconnect: () => { voice.disconnected = true; },
    };
  }
  createGain() {
    const values: number[] = [];
    return {
      values,
      gain: {
        setValueAtTime: (v: number) => values.push(v),
        linearRampToValueAtTime: (v: number) => values.push(v),
      },
      connect: () => this.destination,
      disconnect: () => {},
    };
  }
  resume() {
    this.state = "running";
    return Promise.resolve();
  }
  suspend() {
    this.state = "suspended";
    return Promise.resolve();
  }
  close() {
    this.state = "closed";
    return Promise.resolve();
  }
}

const heard = () => FakeAudioContext.voices.splice(0).filter((v) => v.started);
const peakOf = (voices: Voice[]) => Math.max(...voices.flatMap((v) => v.gains));

test("play() sounds stamp and rustle only while the toggle is on, never above MAX_DB", async () => {
  const stored = new Map<string, string>();
  Object.assign(globalThis, {
    AudioContext: FakeAudioContext,
    localStorage: { getItem: (k: string) => stored.get(k) ?? null, setItem: (k: string, v: string) => stored.set(k, v) },
    addEventListener: () => {},
    removeEventListener: () => {},
  });

  // Off by default: nothing is made and nothing sounds.
  play("stamp");
  play("rustle");
  play("press");
  play("shuffle");
  play("shutter");
  assert.equal(FakeAudioContext.made, 0);
  assert.deepEqual(heard(), []);

  setSound(true);
  assert.equal(stored.get(SOUND_KEY), "on");
  heard(); // the "open" beep that confirms the switch

  play("stamp");
  const stamp = heard();
  assert.deepEqual(stamp.map((v) => v.hz), CUES.stamp.notes.map((n) => n.hz));
  assert.ok(stamp.every((v) => v.wave === "square" && v.gains[0] === 0 && v.gains.at(-1) === 0));
  assert.equal(peakOf(stamp), dbToGain(CUES.stamp.db));

  play("rustle");
  const rustle = heard();
  assert.deepEqual(rustle.map((v) => v.hz), CUES.rustle.notes.map((n) => n.hz));
  assert.equal(peakOf(rustle), dbToGain(CUES.rustle.db));

  play("shuffle");
  const shuffle = heard();
  assert.deepEqual(shuffle.map((v) => v.hz), CUES.shuffle.notes.map((n) => n.hz));
  assert.equal(peakOf(shuffle), dbToGain(CUES.shuffle.db));
  assert.ok(peakOf(shuffle) <= dbToGain(MAX_DB));

  play("shutter");
  const shutter = heard();
  assert.deepEqual(shutter.map((v) => v.hz), CUES.shutter.notes.map((n) => n.hz));
  assert.equal(peakOf(shutter), dbToGain(CUES.shutter.db));
  assert.ok(peakOf(shutter) <= dbToGain(MAX_DB));

  // A press plays its own wave, quietly; every old cue is still square.
  play("press");
  const press = heard();
  assert.deepEqual(press.map((v) => v.hz), [140, 90]);
  assert.ok(press.every((v) => v.wave === CUES.press.wave && v.wave !== "square"), `press is ${press.map((v) => v.wave)}`);
  assert.equal(peakOf(press), dbToGain(-28));
  assert.ok(peakOf(press) <= dbToGain(MAX_DB));
  for (const name of OLD) {
    play(name);
    const voices = heard();
    assert.equal(voices.length, CUES[name].notes.length, name);
    assert.ok(voices.every((v) => v.wave === "square"), `${name} is ${voices.map((v) => v.wave)}`);
  }
  // The wave comes from the cue: take it away and the press falls back to square.
  const realPress = CUES.press;
  CUES.press = { ...realPress, wave: undefined };
  try {
    play("press");
    assert.ok(heard().every((v) => v.wave === "square"));
  } finally {
    CUES.press = realPress;
  }

  // A cue asking for full volume still plays at MAX_DB.
  const real = CUES.stamp;
  CUES.stamp = { ...real, db: 0 };
  try {
    play("stamp");
    assert.equal(peakOf(heard()), dbToGain(MAX_DB));
  } finally {
    CUES.stamp = real;
  }

  // Switched off: silence again.
  setSound(false);
  assert.equal(stored.get(SOUND_KEY), "off");
  play("stamp");
  play("rustle");
  play("press");
  play("shuffle");
  await new Promise((r) => setImmediate(r));
  assert.deepEqual(heard(), []);

  // Back on: the muted context resumes and the cues play through it.
  setSound(true);
  await new Promise((r) => setImmediate(r));
  heard();
  play("rustle");
  assert.equal(heard().length, CUES.rustle.notes.length);
  assert.equal(FakeAudioContext.made, 1, "one context, reused");
});

const source = (file: string) => readFileSync(resolve(import.meta.dirname, "..", file), "utf8");

test("pet purr is bounded, quiet, shared, gated and cancellable", async () => {
  assert.ok(PURR.db <= -34);
  assert.ok(cueLength(PURR) < 0.3);
  assert.equal(PURR.wave, "triangle");
  setSound(false); heard();
  const made = FakeAudioContext.made;
  assert.equal(startPurr(), false);
  assert.equal(FakeAudioContext.made, made);
  assert.deepEqual(heard(), []);
  setSound(true); await new Promise((r) => setImmediate(r)); heard();
  assert.equal(startPurr(), true);
  const first = heard();
  assert.equal(first.length, PURR.notes.length);
  assert.equal(peakOf(first), cueGain(PURR));
  stopPurr(); assert.ok(first.every((v) => v.disconnected));
  startPurr(); const second = heard();
  setSound(false); assert.ok(second.every((v) => v.disconnected));
  stopPurr();
  assert.equal(FakeAudioContext.made, made, "reuses the context already made by the toggle");
});

test("purr cancels on hide and a late resume cannot revive a released gesture", async () => {
  const documentBefore = Object.getOwnPropertyDescriptor(globalThis, "document");
  const doc = Object.assign(new EventTarget(), { hidden: false });
  Object.defineProperty(globalThis, "document", { configurable: true, value: doc });
  const context = FakeAudioContext.current;
  const resume = context.resume;
  try {
    setSound(true); await new Promise((r) => setImmediate(r)); heard();
    startPurr(); const purr = heard();
    doc.hidden = true; doc.dispatchEvent(new Event("visibilitychange"));
    assert.ok(purr.every((v) => v.disconnected));
    assert.equal(startPurr(), false, "hidden pages cannot start pet audio");
    doc.hidden = false;
    setSound(false); heard();
    const pending: (() => void)[] = [];
    context.resume = () => new Promise<void>((resolve) => pending.push(() => { context.state = "running"; resolve(); }));
    setSound(true); startPurr(); stopPurr();
    pending.forEach((resolve) => resolve());
    await new Promise((r) => setImmediate(r));
    assert.ok(heard().every((voice) => voice.hz !== 147 && voice.hz !== 165), "no stale pet notes after resume");
  } finally {
    context.resume = resume; setSound(false); stopPurr(); heard();
    if (documentBefore) Object.defineProperty(globalThis, "document", documentBefore);
    else Reflect.deleteProperty(globalThis, "document");
  }
});

test("only the client adapter opens an AudioContext, and only from unlock", () => {
  const client = source("lib/sound-client.ts");
  assert.equal(client.match(/new AudioContext\(/g)?.length, 1);
  assert.match(client, /\.type = cue\.wave \?\? "square"/);
  assert.match(client, /addEventListener\("pagehide"/);
  assert.ok(!/AudioContext/.test(source("lib/sound.ts").replace(/^\/\/.*$/gm, "")), "lib/sound.ts stays pure");
  for (const file of ["components/sound-toggle.tsx", "components/handheld.tsx"]) {
    assert.ok(!/AudioContext/.test(source(file)), `${file} goes through lib/sound-client.ts`);
  }
});

test("the toggle reads storage only through the external store", () => {
  const toggle = source("components/sound-toggle.tsx");
  assert.ok(!/localStorage/.test(toggle), "no storage in the component");
  assert.match(toggle, /useSyncExternalStore/);
  assert.match(toggle, /aria-pressed/);
});


test("the wooden clapper is bounded and quieter than console cues", async () => {
  const { CLAPPER, cueLength } = await import("./sound.ts");
  assert.equal(CLAPPER.notes.length,2); assert.equal(CLAPPER.wave,"triangle");
  assert.ok(CLAPPER.db <= -30); assert.ok(cueLength(CLAPPER) < .1);
});

test("shutterClackSamples synthesizes a deterministic noise-burst plus mechanical click capped at <= -18 dB", () => {
  const a = shutterClackSamples(SHUTTER_SEED, 8000);
  const b = shutterClackSamples(SHUTTER_SEED, 8000);
  const c = shutterClackSamples(SHUTTER_SEED + 1, 8000);
  assert.deepEqual(a, b, "deterministic for identical seed");
  assert.notDeepEqual(a, c, "varies with seed");
  const maxAmp = Math.max(...a.map(Math.abs));
  assert.ok(maxAmp > 0 && maxAmp <= dbToGain(MAX_DB) + 1e-6, `peak ${maxAmp} <= -18 dB`);
  const burstEnergy = a.slice(0, Math.floor(0.022 * 8000)).reduce((acc, v) => acc + Math.abs(v), 0);
  const clickEnergy = a.slice(Math.floor(0.024 * 8000), Math.floor(0.075 * 8000)).reduce((acc, v) => acc + Math.abs(v), 0);
  assert.ok(burstEnergy > 0, "contains initial noise-burst energy");
  assert.ok(clickEnergy > 0, "contains mechanical click energy");
});
