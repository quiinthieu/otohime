import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";
import { dbToGain, MAX_DB, SOUND_KEY } from "./sound.ts";
import {
  brownNoise,
  playCustomCue,
  openSoundSession,
  startStoryVoice,
  stopStoryVoice,
  setSound,
  startWater,
  stopWater,
  WATER_DB,
  WATER_LOWPASS_HZ,
  WATER_SECONDS,
  WATER_SEED,
  WATER_SWELL_DEPTH,
  WATER_SWELL_HZ,
} from "./sound-client.ts";

// A Web Audio stand-in that remembers every node it makes: buffer sources (with their samples), filters, gains and
// oscillators, and whether each was started and stopped.
type Param = { value: number; points: number[] };
const param = (value = 0): Param & Record<string, unknown> => {
  const p: Param & Record<string, unknown> = {
    value,
    points: [],
    setValueAtTime: (v: number) => p.points.push(v),
    linearRampToValueAtTime: (v: number) => p.points.push(v),
    cancelScheduledValues: () => {},
  };
  return p;
};
type Node = { kind: string; started: boolean; stopped: boolean; [k: string]: unknown };

class FakeAudioContext {
  static made = 0;
  static holdResume = false;
  static releaseResume: (() => void) | null = null;
  static nodes: Node[] = [];
  state: "running" | "suspended" | "closed" = "suspended";
  currentTime = 1;
  sampleRate = 8000;
  destination = { kind: "destination" };
  constructor() {
    FakeAudioContext.made++;
  }
  node(kind: string, extra: Record<string, unknown> = {}): Node {
    const n: Node = {
      kind,
      started: false,
      stopped: false,
      connect: (to: unknown) => to,
      disconnect: () => { n.disconnected = true; },
      start: () => (n.started = true),
      stop: () => (n.stopped = true),
      ...extra,
    };
    FakeAudioContext.nodes.push(n);
    return n;
  }
  createBuffer(channels: number, length: number, rate: number) {
    const data = new Float32Array(length);
    return { channels, length, rate, data, getChannelData: () => data };
  }
  createBufferSource() {
    return this.node("source", { buffer: null, loop: false, onended: null });
  }
  createBiquadFilter() {
    return this.node("filter", { type: "lowpass", frequency: param(350) });
  }
  createGain() {
    return this.node("gain", { gain: param(1) });
  }
  createOscillator() {
    return this.node("osc", { type: "sine", frequency: param(440), onended: null });
  }
  resume() {
    if (FakeAudioContext.holdResume) return new Promise<void>(resolve => { FakeAudioContext.releaseResume = () => { this.state = "running"; resolve(); }; });
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

// window and document as event targets the test can fire on.
const target = () => {
  const on = new Map<string, Set<() => void>>();
  return {
    addEventListener: (type: string, fn: () => void) => on.set(type, (on.get(type) ?? new Set()).add(fn)),
    removeEventListener: (type: string, fn: () => void) => on.get(type)?.delete(fn),
    fire: (type: string) => [...(on.get(type) ?? [])].forEach((fn) => fn()),
    count: (type: string) => on.get(type)?.size ?? 0,
  };
};
const win = target();
const doc = Object.assign(target(), { visibilityState: "visible" as DocumentVisibilityState });
const stored = new Map<string, string>();
Object.assign(globalThis, {
  AudioContext: FakeAudioContext,
  localStorage: { getItem: (k: string) => stored.get(k) ?? null, setItem: (k: string, v: string) => stored.set(k, v) },
  addEventListener: win.addEventListener,
  removeEventListener: win.removeEventListener,
  document: doc,
});

const take = () => FakeAudioContext.nodes.splice(0);
const sources = (nodes: Node[]) => nodes.filter((n) => n.kind === "source");
const tick = () => new Promise((r) => setImmediate(r));

// The node test runner runs each file in its own process, so the client's module state starts fresh here. The
// tests run in order and share it.

test("with sound off the pond's water makes nothing", () => {
  assert.equal(startWater(), false);
  assert.equal(startWater(), false);
  assert.equal(FakeAudioContext.made, 0, "no context opened");
  assert.deepEqual(take(), []);
  assert.equal(doc.count("visibilitychange"), 0);
  stopWater(); // harmless with nothing playing
});

test("a silent preference update persists opt-in without constructing audio or playing confirmation", async () => {
  setSound(true, { silent: true });
  await tick();
  assert.equal(stored.get(SOUND_KEY), "on");
  assert.equal(FakeAudioContext.made, 0);
  assert.deepEqual(take(), []);
  setSound(false, { silent: true });
  assert.equal(stored.get(SOUND_KEY), "off");
});

test("with sound on a click starts one looped, low-passed, quiet water source", async () => {
  setSound(true);
  assert.equal(stored.get(SOUND_KEY), "on");
  await tick();
  take(); // the "open" beep that confirms the switch

  assert.equal(startWater(), true);
  assert.equal(startWater(), true, "a second click keeps the same water");
  await tick();
  const nodes = take();
  const src = sources(nodes);
  assert.equal(src.length, 1, "exactly one source");
  assert.ok(src[0].started && !src[0].stopped);
  assert.equal(src[0].loop, true);
  const buffer = src[0].buffer as { length: number; rate: number; data: Float32Array };
  assert.equal(buffer.length, WATER_SECONDS * 8000);
  assert.deepEqual(buffer.data, brownNoise(WATER_SEED, WATER_SECONDS * 8000), "the buffer is the seeded noise");

  const filter = nodes.find((n) => n.kind === "filter")!;
  assert.equal(filter.type, "lowpass");
  assert.equal((filter.frequency as Param).value, WATER_LOWPASS_HZ);
  assert.equal(WATER_LOWPASS_HZ, 500);

  // The swell is a slow sine; the level fades in from silence to WATER_DB, and with the swell on top it stays
  // well under every cue.
  const swell = nodes.filter((n) => n.kind === "osc");
  assert.equal(swell.length, 1);
  assert.equal(swell[0].type, "sine");
  assert.ok(WATER_SWELL_HZ > 0 && WATER_SWELL_HZ <= 0.2, `swell ${WATER_SWELL_HZ} Hz`);
  assert.ok(swell[0].started);
  const level = nodes.filter((n) => n.kind === "gain").map((n) => (n.gain as Param).points).find((p) => p.length > 0)!;
  assert.deepEqual(level, [0, dbToGain(WATER_DB)]);
  assert.equal(WATER_DB, -36);
  const loudest = dbToGain(WATER_DB) * (1 + WATER_SWELL_DEPTH);
  assert.ok(20 * Math.log10(loudest) < -33, `peaks at ${(20 * Math.log10(loudest)).toFixed(1)} dB`);
  assert.ok(loudest < dbToGain(-28) && loudest < dbToGain(MAX_DB), "quieter than a press");

  assert.equal(doc.count("visibilitychange"), 1);
  assert.ok(win.count("pagehide") >= 1);
  assert.equal(FakeAudioContext.made, 1, "the cues' context, reused");
});

test("the water stops when the page is hidden, and a later click starts it again", () => {
  doc.visibilityState = "visible";
  doc.fire("visibilitychange");
  assert.deepEqual(take(), [], "visible again changes nothing");
  assert.equal(doc.count("visibilitychange"), 1, "still listening");
  // The water from the last test is still running, so a click makes nothing new.
  assert.equal(startWater(), true);
  assert.deepEqual(take(), [], "still the one source");

  doc.visibilityState = "hidden";
  doc.fire("visibilitychange");
  assert.equal(doc.count("visibilitychange"), 0, "the listener goes with the water");

  doc.visibilityState = "visible";
  assert.equal(startWater(), true);
  const again = sources(take());
  assert.equal(again.length, 1, "a new source after the click");
  stopWater();
  assert.equal(again[0].stopped, true);
});

test("hidden, pagehide and sound off each stop the playing source", () => {
  const stops: [string, () => void][] = [
    [
      "hidden",
      () => {
        doc.visibilityState = "hidden";
        doc.fire("visibilitychange");
        doc.visibilityState = "visible";
      },
    ],
    ["pagehide", () => win.fire("pagehide")],
    ["sound off", () => setSound(false)],
  ];
  for (const [why, stop] of stops) {
    setSound(true);
    take();
    assert.equal(startWater(), true, why);
    const nodes = take();
    const [src] = sources(nodes);
    const swell = nodes.find((n) => n.kind === "osc")!;
    assert.ok(src.started && !src.stopped, why);
    stop();
    assert.equal(src.stopped, true, `${why} stops the source`);
    assert.equal(swell.stopped, true, `${why} stops the swell`);
    assert.equal(doc.count("visibilitychange"), 0, why);
  }
  // pagehide also closed the context; sound is now off, so a click makes nothing.
  assert.equal(startWater(), false);
  assert.deepEqual(sources(take()), []);
});

test("the brown noise is deterministic, loops without a jump, and is mostly low", () => {
  const n = 32000;
  const a = brownNoise(WATER_SEED, n);
  assert.deepEqual(a, brownNoise(WATER_SEED, n), "same seed, same samples");
  assert.notDeepEqual(a, brownNoise(WATER_SEED + 1, n), "another seed, other samples");
  assert.equal(a.length, n);
  assert.equal(Math.max(...a.map(Math.abs)), 1, "peak 1");
  assert.ok(Math.abs(a[n - 1] - a[0]) < 1e-6, "the loop's ends meet");
  // Brown: neighbouring samples barely move, unlike white noise, whose steps are bigger than the signal.
  const roughness = (x: Float32Array) => {
    let step = 0;
    let size = 0;
    for (let i = 1; i < x.length; i++) {
      step += Math.abs(x[i] - x[i - 1]);
      size += Math.abs(x[i]);
    }
    return step / size;
  };
  assert.ok(roughness(a) < 0.25, `mean step is ${roughness(a).toFixed(3)} of the mean level`);
  const whiteNoise = Float32Array.from({ length: n }, (_, i) => {
    const h = Math.sin(i * 12.9898) * 43758.5453;
    return (h - Math.floor(h)) * 2 - 1;
  });
  assert.ok(roughness(whiteNoise) > 1, `negative control: white noise is rough (${roughness(whiteNoise).toFixed(3)})`);
  assert.deepEqual(brownNoise(1, 0), new Float32Array(0));
});

const source = (file: string) => readFileSync(resolve(import.meta.dirname, "..", file), "utf8");

test("the water is made, not loaded, and the pond stops it out of view", () => {
  const client = source("lib/sound-client.ts").replace(/^\s*\/\/.*$/gm, "");
  assert.ok(!/Math\.random/.test(client), "seeded, no Math.random");
  assert.ok(!/fetch\(|decodeAudioData|new Audio\(|\.(mp3|ogg|wav|m4a)\b/.test(client), "no audio files");
  const pond = source("components/pond.tsx");
  assert.match(pond, /addEventListener\("click", onClick\)/);
  assert.match(pond, /isIntersecting\) stopWater\(\)/);
  assert.match(pond, /seen\.disconnect\(\);\s*stopWater\(\);/, "unmount stops the water");
  // The pond's controls sound on their own terms, so the site-wide press cue skips them.
  assert.match(pond, /className="pond-stage" data-own-sound=""/);
  assert.match(pond, /className="pond-tools" data-own-sound=""/);
});


test("theatre voice is bounded and every cancellation disconnects scheduled notes immediately", async () => {
  const notes = Array.from({length:100}, (_,i) => ({hz:220, at:.12+i*.065, attack:.008, decay:.045}));
  setSound(false); take();
  assert.equal(startStoryVoice(notes), false); assert.deepEqual(take(), []);
  setSound(true); await tick(); take();
  const made = FakeAudioContext.made;
  for (const stop of [stopStoryVoice, () => setSound(false), () => {
    doc.visibilityState = "hidden"; doc.fire("visibilitychange"); doc.visibilityState = "visible";
  }, () => win.fire("pagehide")]) {
    setSound(true); await tick(); take();
    assert.equal(startStoryVoice(notes), true); await tick();
    const nodes = take();
    assert.ok(nodes.length <= 64); assert.equal(nodes.filter(n=>n.kind==='osc').length,30);
    stop();
    for (const node of nodes) assert.equal(node.disconnected, true, `${node.kind} disconnected`);
    assert.equal(doc.count("visibilitychange"),0);
  }
  assert.equal(FakeAudioContext.made, made, "all speech shares the original context until pagehide");
  setSound(true); await tick(); take();
  startStoryVoice(notes); const old = take();
  startStoryVoice(notes); const replacement = take();
  assert.ok(old.every(n=>n.disconnected)); assert.ok(replacement.some(n=>!n.disconnected));
  stopStoryVoice(); take(); setSound(false);
});

test("a pending resume never revives a cancelled or muted voice", async () => {
  setSound(true); await tick(); take(); setSound(false);
  FakeAudioContext.holdResume = true;
  setSound(true); // holds the ordinary open cue too
  startStoryVoice([{hz:220,at:.12,attack:.008,decay:.045}]);
  const release = FakeAudioContext.releaseResume!;
  stopStoryVoice(); setSound(false); release(); await tick();
  assert.deepEqual(take(), []);
  FakeAudioContext.holdResume = false;
});

test("custom cue policy is rechecked after a pending audio resume", async () => {
  setSound(false); take();
  setSound(true, { silent: true });
  FakeAudioContext.holdResume = true;
  let allowed = true;
  const cue = { db: -24, notes: [{ hz: 1640, at: 0, attack: .001, decay: .007 }] };
  assert.equal(playCustomCue(cue, () => false), false);
  assert.equal(playCustomCue(cue, () => allowed), true);
  allowed = false; FakeAudioContext.releaseResume!(); await tick();
  assert.deepEqual(take(), [], "a reduced-motion change while resuming cannot schedule a stale clack");
  FakeAudioContext.holdResume = false;
  setSound(false);
});

test("shared audio sessions cancel on mute, hide, disposal and before a late resume", async () => {
  setSound(false);
  let starts = 0, stops = 0;
  const begin = () => { starts++; return () => { stops++; }; };
  openSoundSession(begin)(); assert.equal(starts, 0);
  for (const why of ["dispose", "mute", "hidden", "pagehide"]) {
    setSound(true, { silent: true });
    const cancel = openSoundSession(begin); await tick();
    const before = stops;
    if (why === "dispose") cancel();
    if (why === "mute") setSound(false);
    if (why === "hidden") { Object.assign(doc, { hidden: true }); doc.fire("visibilitychange"); Object.assign(doc, { hidden: false }); }
    if (why === "pagehide") win.fire("pagehide");
    assert.equal(stops, before + 1, why);
    cancel(); assert.equal(stops, before + 1, "idempotent cleanup");
    assert.equal(doc.count("visibilitychange"), 0);
  }
  setSound(false); setSound(true, { silent: true });
  FakeAudioContext.holdResume = true;
  const before = starts, cancel = openSoundSession(begin);
  cancel(); FakeAudioContext.releaseResume!(); await tick();
  assert.equal(starts, before);
  FakeAudioContext.holdResume = false; setSound(false);
});
