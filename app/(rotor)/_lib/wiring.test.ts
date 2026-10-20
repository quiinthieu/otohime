import assert from "node:assert/strict";
import { test } from "node:test";
import { ALPHABET, REFLECTOR_NAMES, REFLECTORS, ROTOR_NAMES, ROTORS, SOURCES } from "./wiring.ts";

const ALLOWED = new Set(["en.wikipedia.org", "www.cryptomuseum.com"]);

test("the Enigma I's five rotors and two reflectors, nothing else", () => {
  assert.deepEqual(ROTOR_NAMES, ["I", "II", "III", "IV", "V"]);
  assert.deepEqual(REFLECTOR_NAMES, ["B", "C"]);
});

test("every rotor is a permutation of A–Z", () => {
  for (const r of Object.values(ROTORS)) assert.equal([...r.wiring].sort().join(""), ALPHABET, r.name);
});

test("every reflector pairs letters: an involution with no fixed point", () => {
  for (const r of Object.values(REFLECTORS)) {
    assert.equal([...r.wiring].sort().join(""), ALPHABET, r.name);
    for (let i = 0; i < 26; i++) {
      const out = r.wiring[i];
      assert.notEqual(out, ALPHABET[i], `${r.name} ${ALPHABET[i]}`);
      assert.equal(r.wiring[ALPHABET.indexOf(out)], ALPHABET[i], `${r.name} ${ALPHABET[i]}`);
    }
  }
});

test("turnovers are single letters, as published: I Q, II E, III V, IV J, V Z", () => {
  const turnovers = Object.fromEntries(Object.values(ROTORS).map((r) => [r.name, r.turnover]));
  assert.deepEqual(turnovers, { I: "Q", II: "E", III: "V", IV: "J", V: "Z" });
  for (const r of Object.values(ROTORS)) assert.match(r.turnover, /^[A-Z]$/);
});

test("the wiring is the published wiring (spot checks against the sources)", () => {
  assert.equal(ROTORS.I.wiring, "EKMFLGDQVZNTOWYHXUSPAIBRCJ");
  assert.equal(ROTORS.III.wiring[0], "B");
  assert.equal(REFLECTORS.B.wiring.slice(0, 5), "YRUHQ");
  assert.equal(REFLECTORS.C.wiring.slice(0, 5), "FVPJI");
});

test("every source is https on the allowlist", () => {
  const all = [...SOURCES, ...Object.values(ROTORS).map((r) => r.source), ...Object.values(REFLECTORS).map((r) => r.source)];
  for (const s of all) {
    const url = new URL(s);
    assert.equal(url.protocol, "https:", s);
    assert.ok(ALLOWED.has(url.hostname), s);
  }
  assert.deepEqual(new Set(SOURCES.map((s) => new URL(s).hostname)), ALLOWED);
});
