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
  type Cue,
  type CueName,
} from "./sound.ts";
import { play, setSound } from "./sound-client.ts";

const NAMES: CueName[] = ["move", "open", "back", "chime", "eat", "burst", "stamp", "rustle"];

test("the eight cues the console and the ink toys need are all there", () => {
  assert.deepEqual(Object.keys(CUES).sort(), [...NAMES].sort());
});

test("every cue is short, audible and quick to start and stop", () => {
  for (const name of NAMES) {
    const cue = CUES[name];
    assert.ok(cue.notes.length > 0, name);
    assert.ok(cueLength(cue) <= (name === "chime" ? 0.5 : 0.3), `${name} lasts ${cueLength(cue)} s`);
    for (const n of cue.notes) {
      assert.ok(n.hz >= 100 && n.hz <= 2000, `${name} ${n.hz} Hz`);
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
});

// A Web Audio stand-in: each oscillator it makes remembers its pitch, wave and
// the gain values its envelope was set to.
type Voice = { hz: number; wave: string; gains: number[]; started: boolean };
class FakeAudioContext {
  static made = 0;
  static voices: Voice[] = [];
  state: "running" | "suspended" | "closed" = "running";
  currentTime = 1;
  destination = {};
  constructor() {
    FakeAudioContext.made++;
  }
  createOscillator() {
    const voice: Voice = { hz: 0, wave: "", gains: [], started: false };
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
      disconnect: () => {},
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

test("only the client adapter opens an AudioContext, and only from unlock", () => {
  const client = source("lib/sound-client.ts");
  assert.equal(client.match(/new AudioContext\(/g)?.length, 1);
  assert.match(client, /type: "square"|\.type = "square"/);
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
