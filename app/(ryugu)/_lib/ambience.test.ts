// The palace's sea sound against a fake AudioContext that records every node, ramp, start, stop, resume and close:
// silent until the visitor asks, stopped by its own button or by Pocket's preference, asleep while hidden, closed
// when the palace is left, and quiet (never an error) where Web Audio is missing or refuses.
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { test } from "node:test";
import {
  AMBIENCE_CUTOFF_HZ,
  AMBIENCE_DB,
  AMBIENCE_SEED,
  brownNoise,
  createAmbience,
  dbToGain,
  PALACE_SOUND_KEY,
  parsePalaceSound,
  soundLabel,
  storePalaceSound,
  type Ctx,
} from "./ambience.ts";

const ROOT = resolve(import.meta.dirname, "../../..");
const read = (path: string) => readFileSync(join(ROOT, path), "utf8");

type Ramp = [kind: string, value: number, at: number];
class FakeParam {
  value: number;
  ramps: Ramp[] = [];
  constructor(value = 0) {
    this.value = value;
  }
  setValueAtTime(v: number, t: number) {
    this.ramps.push(["set", v, t]);
    this.value = v;
  }
  linearRampToValueAtTime(v: number, t: number) {
    this.ramps.push(["ramp", v, t]);
  }
  cancelScheduledValues(t: number) {
    this.ramps.push(["cancel", 0, t]);
  }
}

class FakeNode {
  kind: string;
  outputs: unknown[] = [];
  disconnected = 0;
  started: number[] = [];
  stopped: number[] = [];
  onended: (() => void) | null = null;
  [key: string]: unknown;
  constructor(kind: string, extra: Record<string, unknown> = {}) {
    this.kind = kind;
    Object.assign(this, extra);
  }
  connect<T>(to: T): T {
    this.outputs.push(to);
    return to;
  }
  disconnect() {
    this.disconnected++;
  }
  start(t: number) {
    this.started.push(t);
  }
  stop(t: number) {
    this.stopped.push(t);
  }
}

type Fake = Ctx & {
  nodes: FakeNode[];
  calls: string[];
  buffers: Float32Array[];
};

function fakeContext(opts: { state?: AudioContextState; resume?: () => Promise<void>; createBuffer?: () => never } = {}): Fake {
  const nodes: FakeNode[] = [];
  const calls: string[] = [];
  const buffers: Float32Array[] = [];
  const node = (kind: string, extra: Record<string, unknown> = {}) => {
    const n = new FakeNode(kind, extra);
    nodes.push(n);
    return n;
  };
  const c = {
    state: opts.state ?? "suspended",
    currentTime: 10,
    sampleRate: 8000,
    destination: { kind: "destination" },
    nodes,
    calls,
    buffers,
    createBuffer(_channels: number, length: number) {
      if (opts.createBuffer) opts.createBuffer();
      const data = new Float32Array(length);
      buffers.push(data);
      return { getChannelData: () => data };
    },
    createBufferSource: () => node("source", { buffer: null, loop: false }),
    createBiquadFilter: () => node("filter", { type: "", frequency: new FakeParam(350), Q: new FakeParam(1) }),
    createGain: () => node("gain", { gain: new FakeParam(1) }),
    createOscillator: () => node("osc", { type: "", frequency: new FakeParam(440) }),
    resume() {
      calls.push("resume");
      if (opts.resume) return opts.resume();
      c.state = "running";
      return Promise.resolve();
    },
    suspend() {
      calls.push("suspend");
      c.state = "suspended";
      return Promise.resolve();
    },
    close() {
      calls.push("close");
      c.state = "closed";
      return Promise.resolve();
    },
  };
  return c as unknown as Fake;
}

function memory(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
  };
}

// An ambience whose context factory counts how often it was asked.
function rig(opts: { stored?: string; ctx?: Fake; make?: () => Ctx | null; available?: boolean } = {}) {
  const storage = memory(opts.stored === undefined ? {} : { [PALACE_SOUND_KEY]: opts.stored });
  const ctx = opts.ctx ?? fakeContext();
  let made = 0;
  const a = createAmbience({
    make: () => {
      made++;
      return opts.make ? opts.make() : ctx;
    },
    available: opts.available,
    storage,
  });
  return { a, ctx, storage, made: () => made };
}

const of = (ctx: Fake, kind: string) => ctx.nodes.filter((n) => n.kind === kind);
const flush = () => new Promise((r) => setTimeout(r, 0));

test("the preference is on only for the exact word on, and is stored as on or off", () => {
  assert.equal(PALACE_SOUND_KEY, "ryugu-sound");
  for (const v of [null, undefined, "", "off", "On", "true", "1", " on"]) assert.equal(parsePalaceSound(v), false, String(v));
  assert.equal(parsePalaceSound("on"), true);
  assert.equal(storePalaceSound(true), "on");
  assert.equal(storePalaceSound(false), "off");
});

test("Pocket and the palace share one key, which is not the site's beeps", () => {
  const site = read("lib/palace-sound.ts");
  assert.match(site, new RegExp(`export const PALACE_SOUND_KEY = "${PALACE_SOUND_KEY}";`));
  assert.match(site, /export const parsePalaceSound = \(stored: string \| null \| undefined\): boolean => stored === "on";/);
  assert.match(read("lib/sound.ts"), /export const SOUND_KEY = "sound";/);
  assert.notEqual(PALACE_SOUND_KEY, "sound");
});

test("off by default: a first visit, a stored off, garbage or blocked storage make no context and no sound", async () => {
  for (const stored of [undefined, "off", "loud"]) {
    const { a, ctx, made } = rig({ stored });
    assert.equal(a.status(), "off", String(stored));
    a.gesture();
    a.visibility(false);
    await flush();
    assert.equal(made(), 0, `${stored}: no context before the visitor asks`);
    assert.equal(ctx.nodes.length, 0);
  }
  let made = 0;
  const blocked = createAmbience({
    make: () => (made++, fakeContext()),
    storage: {
      getItem: () => {
        throw new Error("SecurityError");
      },
      setItem: () => {
        throw new Error("SecurityError");
      },
    },
  });
  assert.equal(blocked.status(), "off");
  blocked.gesture();
  assert.equal(made, 0);
  // and pressing the button still plays, for this visit
  blocked.toggle();
  assert.equal(blocked.status(), "playing");
});

test("the button turns it on inside its click: one quiet low-passed brown-noise loop, faded in from silence", async () => {
  const { a, ctx, storage, made } = rig();
  const seen: string[] = [];
  a.subscribe(() => seen.push(a.status()));
  a.toggle();
  assert.equal(made(), 1);
  assert.equal(storage.data.get(PALACE_SOUND_KEY), "on");
  assert.equal(a.status(), "playing");
  assert.deepEqual(seen, ["playing"]);
  assert.deepEqual(ctx.calls, ["resume"], "a suspended context is resumed inside the gesture");

  const [source] = of(ctx, "source");
  assert.equal(source.loop, true);
  assert.equal(source.started.length, 1);
  assert.equal(ctx.buffers.length, 1);
  assert.equal(ctx.buffers[0].length, 6 * ctx.sampleRate);
  assert.deepEqual(ctx.buffers[0], brownNoise(AMBIENCE_SEED, ctx.buffers[0].length), "the seeded sea, no audio file");

  const [filter] = of(ctx, "filter");
  assert.equal(filter.type, "lowpass");
  assert.equal((filter.frequency as FakeParam).value, AMBIENCE_CUTOFF_HZ);
  assert.ok(AMBIENCE_CUTOFF_HZ <= 500, "filtered water, not hiss");
  // the drift: a slow sine through a depth gain into the cutoff
  const [drift] = of(ctx, "osc");
  assert.equal(drift.type, "sine");
  assert.ok((drift.frequency as FakeParam).value < 0.2, "slower than a breath");
  const depth = drift.outputs[0] as FakeNode;
  assert.equal(depth.outputs[0], filter.frequency);

  // the chain: source -> low-pass -> level -> speakers
  assert.equal(source.outputs[0], filter);
  const level = filter.outputs[0] as FakeNode;
  assert.equal(level.outputs[0], ctx.destination);
  const ramps = (level.gain as FakeParam).ramps;
  assert.deepEqual(ramps[0].slice(0, 2), ["set", 0], "starts from silence: no click");
  assert.equal(ramps[1][0], "ramp");
  assert.equal(ramps[1][1], dbToGain(AMBIENCE_DB));
  assert.ok(ramps[1][2] - ramps[0][2] >= 1, "faded in over a second or more");
  assert.ok(AMBIENCE_DB <= -30 && dbToGain(AMBIENCE_DB) < 0.03, "quiet");

  // a second gesture adds no second sea
  a.gesture();
  a.toggle(); // ...and the button again turns it off
  a.gesture();
  assert.equal(of(ctx, "source").length, 1);
  await flush();
});

test("switched off, the water fades out and stops; the next gesture brings nothing back", () => {
  const { a, ctx, storage } = rig();
  a.toggle();
  const [source] = of(ctx, "source");
  const [drift] = of(ctx, "osc");
  const level = (of(ctx, "filter")[0].outputs[0] as FakeNode).gain as FakeParam;
  a.toggle();
  assert.equal(a.status(), "off");
  assert.equal(storage.data.get(PALACE_SOUND_KEY), "off");
  assert.deepEqual(level.ramps.at(-1)?.slice(0, 2), ["ramp", 0], "faded to silence");
  assert.equal(source.stopped.length, 1);
  assert.equal(drift.stopped.length, 1);
  source.onended?.();
  assert.ok(ctx.nodes.every((n) => n.disconnected > 0), "every node let go");
  a.gesture();
  assert.equal(of(ctx, "source").length, 1);
  assert.equal(a.status(), "off");
});

test("stored on from an earlier visit: it waits for a click or key in the palace, never plays on load", () => {
  const { a, ctx, made } = rig({ stored: "on" });
  assert.equal(a.status(), "waiting");
  assert.equal(made(), 0, "no context on load: autoplay would be refused");
  assert.equal(ctx.nodes.length, 0);
  a.gesture();
  assert.equal(made(), 1);
  assert.equal(a.status(), "playing");
  assert.equal(of(ctx, "source").length, 1);
});

test("Pocket switching it off (a storage event) stops the water at once; switching on waits for a gesture", () => {
  const { a, ctx } = rig({ stored: "on" });
  a.gesture();
  const [source] = of(ctx, "source");
  a.stored("off");
  assert.equal(a.status(), "off");
  assert.equal(source.stopped.length, 1);
  a.gesture();
  assert.equal(of(ctx, "source").length, 1, "off means off");
  a.stored("on");
  assert.equal(a.status(), "waiting");
  assert.equal(of(ctx, "source").length, 1, "Pocket's on does not start it by itself");
  a.gesture();
  assert.equal(of(ctx, "source").length, 2);
  a.stored(null); // storage cleared
  assert.equal(a.status(), "off");
  assert.equal(of(ctx, "source")[1].stopped.length, 1);
});

test("hidden, the context sleeps; seen again, it wakes only if the water was playing", () => {
  const { a, ctx } = rig({ stored: "on" });
  a.visibility(true);
  a.gesture();
  assert.equal(of(ctx, "source").length, 0, "no start while hidden");
  a.visibility(false);
  a.gesture();
  ctx.calls.length = 0;
  a.visibility(true);
  a.visibility(false);
  assert.deepEqual(ctx.calls, ["suspend", "resume"]);
  a.toggle();
  ctx.calls.length = 0;
  a.visibility(true);
  a.visibility(false);
  assert.deepEqual(ctx.calls, ["suspend"], "switched off: it stays asleep");
});

test("leaving the palace stops the water and closes the context, and keeps the preference for next time", () => {
  const { a, ctx, storage } = rig();
  a.toggle();
  const [source] = of(ctx, "source");
  a.close();
  assert.equal(source.stopped.length, 1);
  assert.ok(ctx.calls.includes("close"));
  assert.equal(a.status(), "off");
  assert.equal(storage.data.get(PALACE_SOUND_KEY), "on");
  a.close();
  a.toggle();
  a.gesture();
  a.stored("on");
  assert.equal(of(ctx, "source").length, 1, "nothing after close");
  assert.equal(ctx.calls.filter((c) => c === "close").length, 1);
});

test("no Web Audio: the button says so, nothing is stored, nothing throws", async () => {
  const none = rig({ available: false });
  assert.equal(none.a.status(), "unsupported");
  none.a.toggle();
  none.a.gesture();
  assert.equal(none.made(), 0);
  assert.equal(none.storage.data.size, 0);

  for (const make of [() => null, () => { throw new Error("NotSupportedError"); }]) {
    const r = rig({ make });
    assert.doesNotThrow(() => r.a.toggle());
    assert.equal(r.a.status(), "unsupported");
    assert.equal(r.storage.data.size, 0, "the preference is left as it was");
    r.a.toggle();
    assert.equal(r.made(), 1, "asked once");
  }

  // stored on, but the constructor fails at the first gesture
  const late = rig({ stored: "on", make: () => null });
  late.a.gesture();
  assert.equal(late.a.status(), "unsupported");

  // a context that cannot build the graph
  const broken = rig({ ctx: fakeContext({ createBuffer: () => { throw new Error("InvalidStateError"); } }) });
  assert.doesNotThrow(() => broken.a.toggle());
  assert.equal(broken.a.status(), "unsupported");
  assert.ok(broken.ctx.calls.includes("close"));

  // a resume the browser refuses: silent, the context let go
  const refused = rig({ ctx: fakeContext({ resume: () => Promise.reject(new Error("NotAllowedError")) }) });
  refused.a.toggle();
  assert.equal(refused.a.status(), "playing");
  await flush();
  assert.equal(refused.a.status(), "unsupported");
  assert.ok(refused.ctx.calls.includes("close"));
  assert.equal(of(refused.ctx, "source")[0].stopped.length, 1);
});

test("negative control: a running context is not resumed again, so the resume above is the gesture's doing", () => {
  const { a, ctx } = rig({ ctx: fakeContext({ state: "running" }) });
  a.toggle();
  assert.deepEqual(ctx.calls, []);
  assert.equal(a.status(), "playing");
});

test("the sea's noise is seeded, peaks at 1 and meets itself where the loop wraps", () => {
  const n = 8000;
  const a = brownNoise(AMBIENCE_SEED, n);
  assert.deepEqual(a, brownNoise(AMBIENCE_SEED, n));
  assert.notDeepEqual(a, brownNoise(AMBIENCE_SEED + 1, n));
  assert.equal(Math.max(...a.map(Math.abs)), 1);
  assert.ok(Math.abs(a[n - 1] - a[0]) < 0.01, "no click at the wrap");
  assert.equal(brownNoise(1, 0).length, 0);
});

test("the button never claims a sound the browser cannot make", () => {
  assert.deepEqual(soundLabel("off"), { text: "Sea sound: off", pressed: false, disabled: false, note: "" });
  assert.equal(soundLabel("playing").pressed, true);
  assert.equal(soundLabel("waiting").pressed, true);
  assert.match(soundLabel("waiting").note, /click or press a key/);
  assert.deepEqual(
    [soundLabel("unsupported").pressed, soundLabel("unsupported").disabled],
    [false, true],
  );
});

test("the palace mounts the button, opens audio only through make, and lets it go on every way out", () => {
  const page = read("app/(ryugu)/ryugu/page.tsx");
  assert.match(page, /<\/nav>\s*\{\/\*[^*]*\*\/\}\s*<AmbienceToggle \/>/);
  const ui = read("app/(ryugu)/_components/ambience.tsx");
  assert.equal(ui.match(/new ctor\(\)/g)?.length, 1, "one place makes a context");
  assert.doesNotMatch(ui, /new AudioContext|resume\(|localStorage\.setItem/, "the engine does the rest");
  for (const [target, event] of [["", "click"], ["", "keydown"], ["", "storage"], ["", "pagehide"], ["document.", "visibilitychange"]]) {
    assert.match(ui, new RegExp(`${target.replace(".", "\\.")}addEventListener\\("${event}"`), event);
    assert.match(ui, new RegExp(`${target.replace(".", "\\.")}removeEventListener\\("${event}"`), `${event} let go`);
  }
  assert.match(ui, /a\.close\(\);\s*ambience\.current = null;/, "unmount closes it");
  assert.match(ui, /aria-pressed=\{view\.pressed\}/);
  assert.match(ui, /closest\("\[data-ambience\]"\)/, "the button's own click is not also a gesture");
  // ...but only its click and the keys that make one: an arrow pressed while it has focus is still a gesture
  assert.match(ui, /if \(own && \(key === null \|\| key === "Enter" \|\| key === " "\)\) return;/);
});

test("no audio file, no network and no autoplay anywhere in the palace", () => {
  const files = (dir: string): string[] =>
    readdirSync(join(ROOT, dir), { withFileTypes: true }).flatMap((e) =>
      e.isDirectory() ? files(join(dir, e.name)) : /\.(tsx?|css)$/.test(e.name) && !e.name.endsWith(".test.ts") ? [join(dir, e.name)] : [],
    );
  const palace = files("app/(ryugu)");
  assert.ok(palace.some((f) => f.endsWith("ambience.tsx")));
  for (const f of palace) {
    const src = read(f);
    assert.doesNotMatch(src, /\.(mp3|ogg|wav|m4a|flac|opus)\b|<audio|new Audio\(|autoPlay|autoplay=|fetch\(|sendBeacon/, f);
  }
  const lib = read("app/(ryugu)/_lib/ambience.ts").replace(/^\s*(\/\/|\*).*$/gm, "");
  assert.doesNotMatch(lib, /AudioContext\(|window|document|localStorage/, "the engine touches the browser only through what it is given");
});
