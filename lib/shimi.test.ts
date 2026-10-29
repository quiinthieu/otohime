import assert from "node:assert/strict";
import { test } from "node:test";
import { spawnSync } from "node:child_process";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import {
  shimiRng, shimiSeedFromString, createShimiSwarm, stepShimiSwarm, restoreShimiNibblesNear,
  restoreAllShimiNibbles, SHIMI_TRAIL_ALPHA, SHIMI_TRAIL_CAP, SHIMI_NIBBLE_CAP,
  SHIMI_SKIP_TAGS, shouldSkipShimiElement, extractCrawlableWords, createShimiDiet,
  ingestWords, generateShimiBurp, SHIMI_PENTATONIC_HZ, charToPentatonicHz,
  buildShimiChirpCue, createShimiChirpLimiter, SHIMI_KEY, parseShimiEnabled,
  storeShimiEnabled, shimiPreferenceStore, shimiKeyStep, useShimiEnabled,
  type ShimiStorageChange, type ShimiWordTarget, type ShimiNibble, type ShimiSwarm,
} from "./shimi.ts";
import { cueLength } from "./sound.ts";

test("Mulberry32 matches a known vector and string seeds are stable uint32 values", () => {
  assert.equal(shimiRng(1)(), 0.6270739405881613);
  for (const seed of [0, 1, -1, 0xffffffff, shimiSeedFromString("紙魚")]) {
    const a = shimiRng(seed), b = shimiRng(seed);
    for (let i = 0; i < 1000; i++) {
      const value = a(); assert.equal(value, b()); assert.ok(value >= 0 && value < 1);
    }
  }
  assert.equal(shimiSeedFromString("hello"), 0x4f9f2cab);
  assert.notEqual(shimiSeedFromString("紙魚"), shimiSeedFromString("紙"));
});

test("seeded swarms have 3–5 distinct silverfish with tapered anatomy and deterministic appendages", () => {
  for (let seed = 0; seed < 100; seed++) {
    const swarm = createShimiSwarm(seed);
    assert.deepEqual(swarm, createShimiSwarm(seed));
    assert.equal(swarm.creatures.length, 4);
    assert.equal(new Set(swarm.creatures.map(creature => creature.seed)).size, 4);
    for (const creature of swarm.creatures) {
      assert.ok(creature.segmentCount >= 7 && creature.segmentCount <= 9);
      assert.equal(creature.segments.length, creature.segmentCount);
      for (let i = 1; i < creature.segmentCount; i++) {
        assert.ok(creature.segments[i].radius > 0);
        assert.ok(creature.segments[i].radius < creature.segments[i - 1].radius);
        assert.ok(creature.segments[i].x < creature.segments[i - 1].x);
      }
      assert.ok(creature.legs.length >= 3 && creature.legs.length <= 4);
      assert.equal(new Set(creature.legs.map(leg => leg.phase)).size, creature.legs.length);
      assert.equal(creature.antennae.length, 2); assert.equal(creature.cerci.length, 3);
      assert.ok(creature.antennae[0].angle < 0 && creature.antennae[1].angle > 0);
      assert.equal(creature.trail.length, 0);
    }
  }
  assert.notDeepEqual(createShimiSwarm(1), createShimiSwarm(2));
  for (const [count, expected] of [[-1, 3], [3, 3], [5, 5], [100, 5], [NaN, 4], [Infinity, 4]]) {
    assert.equal(createShimiSwarm(1, count).creatures.length, expected);
  }
});

const viewport = { width: 800, height: 600 };
const word: ShimiWordTarget = { id: "word", text: "paper", x: 40, y: 40, width: 40, height: 16 };
function restingSwarm(): ShimiSwarm {
  const swarm = createShimiSwarm(4, 5);
  return { ...swarm, creatures: swarm.creatures.map(creature => ({ ...creature, x: 60, y: 48 })) };
}

test("kinematics are deterministic immutable snapshots with sine-phase legs and bounded trail rings", () => {
  let a = createShimiSwarm(2), b = createShimiSwarm(2);
  const original = structuredClone(a), rngA = shimiRng(3), rngB = shimiRng(3);
  const input = a;
  for (let i = 0; i < 200; i++) {
    a = stepShimiSwarm(a, [word], 0.04, viewport, rngA);
    b = stepShimiSwarm(b, [word], 0.04, viewport, rngB);
  }
  assert.deepEqual(a, b); assert.deepEqual(input, original);
  for (const creature of a.creatures) {
    assert.equal(creature.trail.length, SHIMI_TRAIL_CAP);
    assert.equal(creature.trailHead, 200 % SHIMI_TRAIL_CAP);
    assert.ok(creature.trail.every(point => point.alpha >= 0 && point.alpha <= 0.15));
    assert.ok(SHIMI_TRAIL_ALPHA <= 0.15);
    assert.ok(creature.x >= 0 && creature.x <= viewport.width && creature.y >= 0 && creature.y <= viewport.height);
    for (const leg of creature.legs) {
      assert.equal(leg.leftAngle, Math.PI / 2 + Math.sin(a.elapsed * 12 + leg.phase) * 0.45);
      assert.equal(leg.rightAngle, -Math.PI / 2 + Math.sin(a.elapsed * 12 + leg.phase + Math.PI) * 0.45);
    }
  }
});

test("static/invalid steps neither move nor consume randomness; stalled frames and edges stay bounded", () => {
  const swarm = createShimiSwarm(1), noDraw = () => { throw Error("unexpected random draw"); };
  for (const dt of [0, -1, NaN, Infinity]) assert.equal(stepShimiSwarm(swarm, [], dt, viewport, noDraw), swarm);
  for (const width of [0, -1, NaN, Infinity]) {
    assert.equal(stepShimiSwarm(swarm, [], 0.05, { width, height: 10 }, noDraw), swarm);
  }
  const next = stepShimiSwarm(swarm, [], 10000, { width: 1, height: 1 }, noDraw);
  assert.equal(next.elapsed, 0.1);
  assert.ok(next.creatures.every(creature => creature.x >= 0 && creature.x <= 1 && creature.y >= 0 && creature.y <= 1));
  assert.ok(next.creatures.every(creature => creature.trail.every(point => point.x <= 1 && point.y <= 1)));
});

test("overlay-only nibbles cap at 12, age out, and never modify target text or source state", () => {
  let swarm = restingSwarm(); const original = structuredClone(swarm), target = Object.freeze({ ...word });
  const rng = shimiRng(3); let peak = 0;
  for (let i = 0; i < 80; i++) {
    swarm = stepShimiSwarm(swarm, [target], 0.1, viewport, rng);
    peak = Math.max(peak, swarm.nibbles.length);
    assert.ok(swarm.nibbles.length <= SHIMI_NIBBLE_CAP);
    assert.equal(new Set(swarm.nibbles.map(nibble => nibble.id)).size, swarm.nibbles.length);
    for (const nibble of swarm.nibbles) {
      assert.equal(nibble.targetId, word.id); assert.ok(word.text.includes(nibble.char));
      assert.ok(nibble.alpha >= 0 && nibble.alpha <= 1);
      assert.ok(nibble.x >= word.x && nibble.x + nibble.width <= word.x + word.width);
      assert.ok(nibble.y >= word.y && nibble.y + nibble.height <= word.y + word.height);
    }
  }
  assert.equal(peak, 12); assert.equal(target.text, "paper"); assert.deepEqual(restingSwarm(), original);
  for (let i = 0; i < 41; i++) swarm = stepShimiSwarm(swarm, [], 0.1, viewport, rng);
  assert.equal(swarm.nibbles.length, 0);
});

test("hover restores notches at rectangle edges; focus clears all without mutating prior snapshots", () => {
  const nibble: ShimiNibble = { id: 1, targetId: "one", char: "p", x: 10, y: 20, width: 8, height: 12, alpha: 1, born: 0 };
  const far = { ...nibble, id: 2, x: 300 }, nibbles = Object.freeze([Object.freeze(nibble), far]);
  assert.deepEqual(restoreShimiNibblesNear(nibbles, 18, 32, 0), [far]);
  assert.deepEqual(restoreShimiNibblesNear(nibbles, 19, 32, 1), [far]);
  assert.deepEqual(restoreShimiNibblesNear(nibbles, 19, 32, 0), nibbles);
  assert.deepEqual(restoreShimiNibblesNear(nibbles, NaN, 32), nibbles);
  assert.deepEqual(restoreAllShimiNibbles(nibbles), []); assert.equal(nibbles.length, 2);
});

test("unusable, offscreen and address targets cannot produce nibbles", () => {
  for (const bad of [
    { text: "https://example.com/secret" }, { text: "x@y.example" }, { text: "!!!" },
    { text: "two words" }, { x: -10 }, { width: 0 }, { height: NaN }, { x: 9999 },
  ]) {
    let swarm = restingSwarm();
    for (let i = 0; i < 20; i++) swarm = stepShimiSwarm(swarm, [{ ...word, ...bad }], 0.1, viewport, shimiRng(i));
    assert.deepEqual(swarm.nibbles, []);
  }
});

test("a travelling creature retains its word target during nibble cooldown", () => {
  const swarm = createShimiSwarm(1);
  const cooling = { ...swarm, creatures: swarm.creatures.map(creature => ({ ...creature, nibbleIn: 1 })) };
  const targets = [word, { ...word, id: "distant", x: 700 }];
  const first = stepShimiSwarm(cooling, targets, 0.05, viewport, () => 0.99);
  assert.ok(first.creatures.every(creature => creature.targetId === "distant"));
  const next = stepShimiSwarm(first, targets, 0.05, viewport, () => { throw Error("must retain the current target"); });
  assert.ok(next.creatures.every(creature => creature.targetId === "distant"));
});

test("walker rejects the entire skip-list, editable/hidden/ignored ancestors and accepts ordinary prose", () => {
  const required = ["SCRIPT", "STYLE", "NOSCRIPT", "INPUT", "TEXTAREA", "SELECT", "OPTION", "CODE", "PRE", "KBD", "SAMP", "BUTTON", "NAV", "FORM", "DIALOG", "SVG", "CANVAS"];
  assert.deepEqual([...SHIMI_SKIP_TAGS], required);
  for (const tag of required) {
    assert.equal(shouldSkipShimiElement(tag), true); assert.equal(shouldSkipShimiElement(tag.toLowerCase()), true);
  }
  for (const attrs of [{ contenteditable: "" }, { contenteditable: "false" }, { "aria-hidden": "true" },
    { "data-shimi-ignore": "" }, { hidden: "" }, { inert: true }]) {
    assert.equal(shouldSkipShimiElement("p", attrs), true);
  }
  for (const tag of ["MAIN", "article", "p", "span", "a"]) {
    assert.equal(shouldSkipShimiElement(tag, { "aria-hidden": "false", contenteditable: null }), false);
  }
});

test("word extraction strips full URLs/emails and punctuation while retaining Unicode prose", () => {
  assert.deepEqual(extractCrawlableWords("Quiet ink https://example.com/private?q=fish https://例え.jp/秘密 " +
    "www.site.test/a ftp://host.test/z mailto:name@example.com name+tag@example.com " +
    "example.org/path?q=secret — paper's 紙魚 café co-operate !!!"),
  ["Quiet", "ink", "paper's", "紙魚", "café", "co-operate"]);
  assert.deepEqual(extractCrawlableWords(""), []);
  assert.deepEqual(extractCrawlableWords("... ? @ #"), []);
  assert.deepEqual(extractCrawlableWords("Ｐａｐｅｒ cafe\u0301"), ["Paper", "café"]);
});

test("diet is a bounded FIFO order-1 model with evicted transitions removed", () => {
  const empty = createShimiDiet();
  const diet = ingestWords(empty, Array.from({ length: 2010 }, (_, i) => `word${i}`));
  assert.equal(empty.tokens.length, 0); assert.equal(diet.tokens.length, 2000);
  assert.equal(diet.tokens[0], "word10"); assert.equal(diet.tokens.at(-1), "word2009");
  assert.equal(diet.next.has("word9"), false); assert.deepEqual(diet.next.get("word10"), ["word11"]);
  assert.equal([...diet.next.values()].reduce((sum, next) => sum + next.length, 0), 1999);
  const smaller = ingestWords(createShimiDiet(4), ["a", "b", "a", "c"]);
  assert.deepEqual(smaller.next.get("a"), ["b", "c"]);
  assert.deepEqual(ingestWords(smaller, ["d", "e", "f", "g"]).tokens, ["d", "e", "f", "g"]);
  assert.equal(ingestWords(smaller, ["d", "e", "f", "g"]).next.has("a"), false);
  assert.equal(createShimiDiet(99999).maxTokens, 2000);
  assert.equal(createShimiDiet(NaN).maxTokens, 2000); assert.equal(createShimiDiet(0).maxTokens, 1);
});

test("diet cannot learn URL and email fragments", () => {
  const diet = ingestWords(createShimiDiet(), ["paper", "https://a.test/secret", "b@c.test", "www.site.test", "quiet ink dreams"]);
  assert.deepEqual(diet.tokens, ["paper", "quiet", "ink", "dreams"]);
  for (let seed = 0; seed < 30; seed++) assert.doesNotMatch(generateShimiBurp(diet, seed), /secret|site|https|@/);
});

test("burps follow observed first-order transitions, are deterministic and stay at 4–10 words", () => {
  const diet = ingestWords(createShimiDiet(), ["paper", "dreams", "ink", "sleeps", "paper"]);
  const transitions = new Map([["paper", "dreams"], ["dreams", "ink"], ["ink", "sleeps"], ["sleeps", "paper"]]);
  const phrases = new Set<string>();
  for (let seed = 0; seed < 100; seed++) {
    const phrase = generateShimiBurp(diet, seed), words = phrase.split(" "); phrases.add(phrase);
    assert.equal(phrase, generateShimiBurp(diet, seed)); assert.ok(words.length >= 4 && words.length <= 10);
    for (let i = 1; i < words.length; i++) assert.equal(words[i], transitions.get(words[i - 1]));
    for (const [min, max] of [[-1, 100], [10, 4], [NaN, Infinity]]) {
      const length = generateShimiBurp(diet, seed, min, max).split(" ").length;
      assert.ok(length >= 4 && length <= 10);
    }
  }
  assert.ok(phrases.size > 10);
  assert.equal(generateShimiBurp(diet, 1, 6, 6).split(" ").length, 6);
});

test("sparse and empty diets yield a deterministic 4–10 word murmur", () => {
  for (let size = 0; size < 4; size++) {
    const diet = ingestWords(createShimiDiet(), ["one", "two", "three"].slice(0, size));
    const burp = generateShimiBurp(diet, 1);
    assert.equal(burp, generateShimiBurp(diet, 1));
    assert.ok(burp.split(" ").length >= 4 && burp.split(" ").length <= 10);
    assert.doesNotMatch(burp, /undefined|one|two|three/);
  }
});

test("character pitches use exactly ten Yo pentatonic notes within 260–880 Hz", () => {
  assert.equal(SHIMI_PENTATONIC_HZ.length, 10);
  assert.equal(new Set(SHIMI_PENTATONIC_HZ).size, 10);
  assert.deepEqual(SHIMI_PENTATONIC_HZ.map(hz => Math.round(69 + 12 * Math.log2(hz / 440))),
    [60, 62, 65, 67, 69, 72, 74, 77, 79, 81]);
  for (let code = 0; code <= 0x10ffff; code += 37) {
    const char = String.fromCodePoint(code), hz = charToPentatonicHz(char);
    assert.ok(hz >= 260 && hz <= 880); assert.equal(hz, SHIMI_PENTATONIC_HZ[code % 10]);
  }
  assert.equal(charToPentatonicHz(""), SHIMI_PENTATONIC_HZ[0]);
  assert.equal(charToPentatonicHz("紙魚"), charToPentatonicHz("紙"));
});

test("chirp cues integrate with the real sound Cue model at -28 dB and 30–80 ms", () => {
  for (const char of ["", "a", "b", "紙", "🐟"]) for (const duration of [-1, 0, 30, 48, 80, 9999, NaN, Infinity]) {
    const cue = buildShimiChirpCue(char, duration);
    assert.equal(cue.db, -28); assert.ok(cue.wave === "sine" || cue.wave === "triangle");
    assert.equal(cue.notes.length, 1); assert.equal(cue.notes[0].hz, charToPentatonicHz(char));
    assert.ok(cueLength(cue) >= 0.03 && cueLength(cue) <= 0.08);
    assert.deepEqual(cue, buildShimiChirpCue(char, duration));
  }
});

test("chirp limiter rejects a fourth simultaneous voice and reopens at actual voice expiry", () => {
  const limiter = createShimiChirpLimiter();
  assert.equal(limiter.tryChirp(0, 100), true); assert.equal(limiter.tryChirp(0, 100), true);
  assert.equal(limiter.tryChirp(0, 100), true); assert.equal(limiter.tryChirp(0, 100), false);
  assert.equal(limiter.tryChirp(99, 100), false); assert.equal(limiter.tryChirp(100, 100), true);
});

test("chirp limiter rejects a ninth rolling-second start including across second boundaries", () => {
  const limiter = createShimiChirpLimiter();
  for (let i = 0; i < 8; i++) assert.equal(limiter.tryChirp(900 + i * 35, 30), true);
  assert.equal(limiter.tryChirp(1180, 30), false);
  assert.equal(limiter.tryChirp(1899, 30), false); assert.equal(limiter.tryChirp(1900, 30), true);
  assert.equal(limiter.tryChirp(1901, 30), false);
});

test("limiter options cannot raise hard caps, lower limits work, malformed/backward clocks fail closed", () => {
  for (const options of [{ maxVoices: 999, maxPerSecond: 999 }, { maxVoices: NaN, maxPerSecond: Infinity }]) {
    const limiter = createShimiChirpLimiter(options);
    for (let i = 0; i < 3; i++) assert.equal(limiter.tryChirp(0), true);
    assert.equal(limiter.tryChirp(0), false);
    for (let i = 1; i <= 5; i++) assert.equal(limiter.tryChirp(i * 100), true);
    assert.equal(limiter.tryChirp(600), false);
  }
  const limiter = createShimiChirpLimiter({ maxVoices: 1, maxPerSecond: 2 });
  assert.equal(limiter.tryChirp(NaN), false); assert.equal(limiter.tryChirp(Infinity), false);
  assert.equal(limiter.tryChirp(0, NaN), false); assert.equal(limiter.tryChirp(0, 0), false);
  assert.equal(limiter.tryChirp(100), true); assert.equal(limiter.tryChirp(99), false);
  assert.equal(limiter.tryChirp(179), false); assert.equal(limiter.tryChirp(180), true);
  assert.equal(limiter.tryChirp(1000), false); assert.equal(limiter.tryChirp(1100), true);
});

function preferenceHarness(initial: string | null = null) {
  let value = initial, denied = "", attached = 0;
  const listeners = new Set<(event: ShimiStorageChange) => void>();
  const storage = {
    getItem(key: string) { assert.equal(key, SHIMI_KEY); if (denied === "read") throw Error("blocked"); return value; },
    setItem(key: string, next: string) { assert.equal(key, SHIMI_KEY); if (denied === "write") throw Error("quota"); value = next; },
    removeItem(key: string) { assert.equal(key, SHIMI_KEY); if (denied === "write") throw Error("quota"); value = null; },
  };
  const make = () => shimiPreferenceStore(() => {
    if (denied === "getter") throw Error("blocked getter");
    return denied === "absent" ? null : storage;
  }, () => ({
    addEventListener(_type, listener) { attached++; listeners.add(listener); },
    removeEventListener(_type, listener) { attached--; listeners.delete(listener); },
  }));
  const store = make();
  return { store, make, storage,
    get value() { return value; }, get attached() { return attached; },
    deny(mode: string) { denied = mode; },
    external(next: string | null, key: string | null = SHIMI_KEY, storageArea: unknown = storage) {
      if (storageArea === storage && (key === SHIMI_KEY || key === null)) value = next;
      listeners.forEach(listener => listener({ key, newValue: next, storageArea }));
    },
  };
}

test("preference is strictly opt-in, with a false SSR and React hydration snapshot", () => {
  assert.equal(SHIMI_KEY, "shimi");
  for (const value of [null, undefined, "", "true", "off", "ON", '"on"', "garbage"]) assert.equal(parseShimiEnabled(value), false);
  assert.equal(parseShimiEnabled("on"), true); assert.equal(storeShimiEnabled(true), "on"); assert.equal(storeShimiEnabled(false), null);
  assert.equal(preferenceHarness().store.get(), false); assert.equal(preferenceHarness("off").store.get(), false);
  const store = preferenceHarness("on").store;
  assert.equal(store.get(), true); assert.equal(store.getServer(), false);
  function Probe() { return createElement("span", null, String(useShimiEnabled(store))); }
  function FallbackProbe() { return createElement("span", null, String(useShimiEnabled())); }
  assert.equal(renderToString(createElement(Probe)), "<span>false</span>");
  assert.equal(renderToString(createElement(FallbackProbe)), "<span>false</span>");
});

test("same-tab changes notify synchronously, persist and share one removable storage listener", () => {
  const h = preferenceHarness(), seen: boolean[] = [];
  const offA = h.store.subscribe(() => seen.push(h.store.get()));
  const offB = h.store.subscribe(() => seen.push(h.store.get()));
  assert.equal(h.attached, 1); h.store.set(true); assert.deepEqual(seen, [true, true]);
  assert.equal(h.value, "on"); assert.equal(h.make().get(), true);
  h.store.set(false); assert.equal(h.value, null); assert.equal(h.make().get(), false);
  offA(); assert.equal(h.attached, 1); offB(); assert.equal(h.attached, 0);
});

test("storage sync handles cross-tab updates/clear, ignores unrelated keys/areas, refreshes on resubscribe", () => {
  const h = preferenceHarness(); let calls = 0;
  const off = h.store.subscribe(() => calls++);
  h.external("on"); assert.equal(h.store.get(), true); assert.equal(calls, 1);
  h.external(null, "sound"); h.external(null, SHIMI_KEY, {});
  assert.equal(h.store.get(), true); assert.equal(calls, 1);
  h.external("garbage"); assert.equal(h.store.get(), false);
  h.external("on"); h.external("on", null); assert.equal(h.store.get(), false);
  off(); assert.equal(h.attached, 0); h.external("on");
  const again = h.store.subscribe(() => calls++); assert.equal(h.store.get(), true);
  again(); assert.equal(h.attached, 0);
});

test("blocked getters/reads/writes and absent storage retain a usable session choice", () => {
  for (const mode of ["getter", "read", "write", "absent"]) {
    const h = preferenceHarness(); h.deny(mode); assert.equal(h.store.get(), false);
    const off = h.store.subscribe(() => {});
    h.store.set(true); assert.equal(h.store.get(), true); off();
    const again = h.store.subscribe(() => {}); assert.equal(h.store.get(), true);
    h.store.set(false); assert.equal(h.store.get(), false); again();
  }
});

test("shimi key sequence is case-insensitive, restarts on overlap and completes only at five keys", () => {
  let progress = 0;
  const states = [..."sHiMi"].map(key => progress = shimiKeyStep(progress, key));
  assert.deepEqual(states, [1, 2, 3, 4, 5]);
  assert.equal(shimiKeyStep(5, "s"), 1); assert.equal(shimiKeyStep(3, "s"), 1);
  assert.equal(shimiKeyStep(2, "Escape"), 0); assert.equal(shimiKeyStep(0, "i"), 0);
  assert.equal(shimiKeyStep(NaN, "s"), 1); assert.equal(shimiKeyStep(-1, "h"), 0);
  for (const key of ["Shift", "Control", "ArrowLeft", "shimi", "Dead"]) assert.equal(shimiKeyStep(0, key), 0);
});

test("all production modules import and construct with browser globals absent and no clock/random access", () => {
  // Real Node imports, including React; no DOM shim or fake module runner.
  const script = `
    for (const key of ['window','document','localStorage','AudioContext']) {
      Object.defineProperty(globalThis, key, { get() { throw Error('browser global: ' + key); } });
    }
    Math.random = () => { throw Error('ambient randomness'); };
    Date.now = () => { throw Error('ambient clock'); };
    for (const key of ['window','document','localStorage','AudioContext']) {
      let rejected = false;
      try { globalThis[key]; } catch { rejected = true; }
      if (!rejected) throw Error('negative control did not reject ' + key);
    }
    const shimi = await import('./lib/shimi.ts');
    await import('./shimi/pref-client.ts');
    const rng = shimi.shimiRng(1);
    const swarm = shimi.createShimiSwarm(1);
    shimi.stepShimiSwarm(swarm, [], 0.03, { width: 800, height: 600 }, rng);
    const diet = shimi.ingestWords(shimi.createShimiDiet(), ['quiet', 'paper', 'ink', 'dreams']);
    if (!shimi.generateShimiBurp(diet, 1)) throw Error('missing burp');
    shimi.buildShimiChirpCue('紙');
    if (!shimi.createShimiChirpLimiter().tryChirp(0)) throw Error('limiter construction');
    const store = shimi.shimiPreferenceStore(() => null, () => ({ addEventListener() {}, removeEventListener() {} }));
    if (store.get() || store.getServer()) throw Error('preference must start off');
    store.subscribe(() => {})();
    store.set(true); if (!store.get()) throw Error('session choice');
  `;
  const result = spawnSync(process.execPath, ["--experimental-strip-types", "--disable-warning=ExperimentalWarning",
    "--disable-warning=MODULE_TYPELESS_PACKAGE_JSON", "--input-type=module", "-e", script],
  { cwd: new URL("..", import.meta.url), encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
});
