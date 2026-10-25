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

const NAMES: CueName[] = ["move", "open", "back", "chime", "eat", "burst"];

test("the six cues later tasks need are all there", () => {
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
