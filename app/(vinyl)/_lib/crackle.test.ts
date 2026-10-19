// The crackle: its pop envelope, its level never above -30 dB, when it plays,
// that it never starts before a gesture, and that it never touches the player.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { PHASES } from "./deck.ts";
import {
  CRACKLE_ENABLED,
  crackleGain,
  crackleSamples,
  crackleShouldPlay,
  createCrackle,
  DEFAULT_DB,
  HISS,
  LOOP_S,
  MAX_DB,
  MIN_DB,
  POP_ATTACK_S,
  POP_DECAY_S,
  POPS_PER_S,
  popEnvelope,
  type CrackleContext,
} from "./crackle.ts";

test("off unless NEXT_PUBLIC_VINYL_CRACKLE is 1", () => {
  assert.equal(CRACKLE_ENABLED, process.env.NEXT_PUBLIC_VINYL_CRACKLE === "1");
  if (process.env.NEXT_PUBLIC_VINYL_CRACKLE === undefined) assert.equal(CRACKLE_ENABLED, false);
});

test("a pop rises at once and dies away", () => {
  assert.equal(popEnvelope(-0.001), 0);
  assert.equal(popEnvelope(Number.NaN), 0);
  assert.equal(popEnvelope(0), 0);
  assert.ok(Math.abs(popEnvelope(POP_ATTACK_S) - 1) < 1e-12);
  assert.ok(popEnvelope(POP_ATTACK_S / 2) > 0.49 && popEnvelope(POP_ATTACK_S / 2) < 0.51);
  let last = 1;
  for (let t = POP_ATTACK_S; t < 0.05; t += 0.0005) {
    const v = popEnvelope(t);
    assert.ok(v <= last && v >= 0, `${t}`);
    last = v;
  }
  assert.ok(popEnvelope(POP_ATTACK_S + 5 * POP_DECAY_S) < 0.01);
});

test("the level is clamped: never louder than -30 dB", () => {
  const ceiling = 10 ** (MAX_DB / 20);
  assert.ok(ceiling < 0.032);
  for (const db of [0, -10, -29.9, MAX_DB, 6, Number.POSITIVE_INFINITY]) assert.ok(crackleGain(db) <= ceiling + 1e-12, `${db}`);
  assert.ok(Math.abs(crackleGain(DEFAULT_DB) - 10 ** (DEFAULT_DB / 20)) < 1e-12);
  assert.ok(DEFAULT_DB <= MAX_DB);
  assert.equal(crackleGain(-200), 10 ** (MIN_DB / 20));
  assert.equal(crackleGain(Number.NaN), 10 ** (MIN_DB / 20));
});

test("the loop is soft hiss and a few pops a second, within [-1, 1], the same every time", () => {
  const rate = 8000;
  const { samples, pops } = crackleSamples(rate);
  assert.equal(samples.length, rate * LOOP_S);
  assert.equal(pops.length, POPS_PER_S * LOOP_S);
  let peak = 0;
  let quiet = 0;
  for (const s of samples) {
    assert.ok(s >= -1 && s <= 1);
    peak = Math.max(peak, Math.abs(s));
    if (Math.abs(s) <= HISS) quiet++;
  }
  assert.ok(peak > 0.2, "there are audible pops");
  assert.ok(quiet / samples.length > 0.9, "mostly hiss");
  assert.deepEqual(crackleSamples(rate).samples, samples);
  assert.notDeepEqual(crackleSamples(rate, LOOP_S, 7).samples, samples);
  assert.equal(crackleSamples(rate, 0).samples.length, 0);
});

test("it plays only while the record plays, in a visible tab, with the flag and the toggle on", () => {
  for (const phase of PHASES) {
    for (const enabled of [true, false]) {
      for (const on of [true, false]) {
        for (const hidden of [true, false]) {
          const want = phase === "playing" && enabled && on && !hidden;
          assert.equal(crackleShouldPlay({ enabled, on, phase, hidden }), want, `${phase} ${enabled} ${on} ${hidden}`);
        }
      }
    }
  }
});

// A stand-in for the Web Audio context that logs what is asked of it.
function fakeContext() {
  const log: string[] = [];
  const node = (name: string) => ({
    connect: (to: { name?: string }) => log.push(`${name}.connect(${to?.name ?? "?"})`),
    disconnect: () => log.push(`${name}.disconnect`),
    name,
  });
  const gain = { ...node("gain"), gain: { value: 1 } };
  const ctx = {
    sampleRate: 8000,
    destination: { name: "destination" },
    createBuffer: (ch: number, length: number, rate: number) => {
      log.push(`createBuffer(${ch},${length},${rate})`);
      return { copyToChannel: () => log.push("copy") };
    },
    createBufferSource: () => {
      log.push("createBufferSource");
      return { ...node("source"), buffer: null, loop: false, start: () => log.push("start"), stop: () => log.push("stop") };
    },
    createGain: () => gain,
    resume: async () => void log.push("resume"),
    suspend: async () => void log.push("suspend"),
    close: async () => void log.push("close"),
  };
  return { ctx: ctx as unknown as CrackleContext, log, gain };
}

test("nothing starts before a gesture unlocks it; then one loop at a time, stopped and closed", () => {
  const { ctx, log, gain } = fakeContext();
  let made = 0;
  const crackle = createCrackle(() => {
    made++;
    return ctx;
  });
  crackle.set(true);
  assert.equal(made, 0, "no context without a gesture");
  assert.equal(log.length, 0);

  crackle.unlock();
  crackle.unlock();
  assert.equal(made, 1, "one context");
  assert.ok(gain.gain.value <= 10 ** (MAX_DB / 20));
  assert.ok(log.includes("gain.connect(destination)"));

  crackle.set(true);
  crackle.set(true);
  assert.equal(log.filter((l) => l === "start").length, 1, "one loop");
  assert.ok(log.includes("source.connect(gain)"));

  crackle.set(false);
  assert.equal(log.filter((l) => l === "stop").length, 1);
  assert.ok(log.includes("suspend"));

  crackle.set(true);
  crackle.close();
  assert.equal(log.filter((l) => l === "stop").length, 2);
  assert.equal(log.at(-1), "close");
  crackle.set(true);
  assert.equal(log.filter((l) => l === "start").length, 2, "closed means closed");
});

test("without Web Audio the crackle stays silent and throws nothing", () => {
  const crackle = createCrackle(() => {
    throw new Error("no audio");
  });
  assert.doesNotThrow(() => {
    crackle.unlock();
    crackle.set(true);
    crackle.close();
  });
});

test("it never reads from or routes the YouTube player", () => {
  // The code, with its comments (which explain all this) stripped.
  const code = readFileSync(join(import.meta.dirname, "crackle.ts"), "utf8").replace(/\/\/[^\n]*/g, "");
  for (const bad of ["createMediaElementSource", "createMediaStreamSource", "captureStream", "getUserMedia", "iframe", "document", "querySelector"]) {
    assert.ok(!code.includes(bad), bad);
  }
  // no audio file is fetched or shipped
  assert.ok(!/\.(mp3|wav|ogg)\b/.test(code));
  assert.ok(!/\bfetch\(/.test(code));
});
