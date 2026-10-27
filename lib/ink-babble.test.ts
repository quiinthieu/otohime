import assert from "node:assert/strict";
import { test } from "node:test";
import { babble, PENTATONIC } from "./ink-babble.ts";
import { cueGain, noteEnd } from "./sound.ts";
test("seeded pentatonic babble is deterministic, finite and bounded", () => {
  const a = babble('A small paper theatre.', 21);
  assert.deepEqual(a, babble('A small paper theatre.',21));
  assert.notDeepEqual(a, babble('A small paper theatre.',22));
  assert.deepEqual(babble('',1), []); assert.deepEqual(babble('  ... ',1), []);
  for (const text of ['a'.repeat(100000), 'Hello, world!', '海の宮殿', 'x']) {
    const notes = babble(text, NaN);
    assert.ok(notes.length * 2 + 4 <= 64);
    assert.ok(notes.every(n => PENTATONIC.includes(n.hz as typeof PENTATONIC[number]) && Object.values(n).every(Number.isFinite) && noteEnd(n) <= 2.3));
  }
  assert.ok(Number.isFinite(cueGain({db:-30,notes:a})));
});
test("punctuation pauses the next syllable", () => {
  assert.ok(babble('a,b',1)[1].at - babble('ab',1)[1].at >= 0.149);
});
