import assert from "node:assert/strict";
import { test } from "node:test";
import { DEFAULTS, encode, MESSAGE_CAP, toQuery, type Settings } from "./enigma.ts";
import { FPS, FRAME_MS, KEY_FRAMES, LAMP_FRAMES, machine, newMachine, pending, restore, type Machine, type MachineAction } from "./machine.ts";

const play = (s: Machine, ...actions: MachineAction[]) => actions.reduce(machine, s);
const press = (letter: string): MachineAction => ({ type: "press", letter });
const release: MachineAction = { type: "release" };
const typeOn = (s: Machine, text: string) => [...text].reduce((m, c) => play(m, press(c), release), s);

test("frames run at 12 fps", () => {
  assert.equal(FPS, 12);
  assert.equal(FRAME_MS, 1000 / 12);
});

test("a press lights exactly one lamp, steps once and adds to the tape", () => {
  const s = play(newMachine(DEFAULTS), press("a"));
  assert.equal(s.lamp, "B");
  assert.equal(s.down, "A");
  assert.equal(s.positions, "AAB");
  assert.equal(s.plain, "A");
  assert.equal(s.code, "B");
});

test("release puts the key up and the lamp out", () => {
  const s = play(newMachine(DEFAULTS), press("A"), release);
  assert.equal(s.lamp, null);
  assert.equal(s.down, null);
  assert.equal(s.code, "B");
  const fresh = newMachine(DEFAULTS);
  assert.equal(play(fresh, release), fresh, "a release with no key down changes nothing");
});

test("a held key ignores a second press", () => {
  const once = play(newMachine(DEFAULTS), press("A"));
  assert.equal(play(once, press("A")), once);
  assert.equal(play(once, press("B")), once);
  assert.equal(play(once, release, press("A")).code, "BD");
});

test("typing AAAAA gives BDZGO, and from ADU four keys show BFY", () => {
  assert.equal(typeOn(newMachine(DEFAULTS), "AAAAA").code, "BDZGO");
  assert.equal(typeOn(newMachine({ ...DEFAULTS, positions: "ADU" }), "AAAA").positions, "BFY");
});

test("non-letters and the 250-letter cap are ignored", () => {
  const s = newMachine(DEFAULTS);
  for (const k of [" ", "1", "Enter", "é"]) assert.equal(play(s, press(k)), s, k);
  const full = newMachine(DEFAULTS, "A".repeat(MESSAGE_CAP));
  assert.equal(play(full, press("A")), full);
});

test("tick advances the key and lamp frames, then stops", () => {
  let s = play(newMachine(DEFAULTS), press("A"));
  assert.equal(s.keyFrame, 0);
  assert.ok(pending(s));
  for (let i = 0; i < 10; i++) s = play(s, { type: "tick" });
  assert.equal(s.keyFrame, KEY_FRAMES);
  assert.equal(s.lampFrame, LAMP_FRAMES);
  assert.ok(!pending(s));
  assert.equal(play(s, { type: "tick" }), s);
  assert.ok(!pending(newMachine(DEFAULTS)));
});

test("under reduced motion the frames jump to their end", () => {
  const s = play(newMachine(DEFAULTS, "", true), press("A"));
  assert.equal(s.keyFrame, KEY_FRAMES);
  assert.equal(s.lampFrame, LAMP_FRAMES);
  assert.ok(!pending(s));
  const mid = play(newMachine(DEFAULTS), press("A"), { type: "motion", reduced: true });
  assert.ok(!pending(mid));
});

test("the server's message is already typed: the island picks up where the page left off", () => {
  const s = newMachine(DEFAULTS, "hello world");
  assert.equal(s.plain, "HELLO WORLD");
  assert.equal(s.code, encode(DEFAULTS, "HELLO WORLD"));
  assert.equal(play(s, press("X")).code, encode(DEFAULTS, "HELLO WORLDX"));
});

test("a settings change goes back to the start positions and enciphers the tape again", () => {
  const typed = typeOn(newMachine(DEFAULTS), "HELLO");
  const check = (s: Machine, settings: Settings) => {
    assert.deepEqual(s.settings, settings);
    assert.equal(s.plain, "HELLO");
    assert.equal(s.code, encode(settings, "HELLO"));
    assert.equal(s.lamp, null);
  };
  check(play(typed, { type: "set-rotor", slot: 0, name: "IV" }), { ...DEFAULTS, rotors: ["IV", "II", "III"] });
  check(play(typed, { type: "set-rotor", slot: 0, name: "III" }), { ...DEFAULTS, rotors: ["III", "II", "I"] }); // swaps
  check(play(typed, { type: "set-ring", slot: 2, letter: "q" }), { ...DEFAULTS, rings: "AAQ" });
  check(play(typed, { type: "set-start", slot: 1, letter: "D" }), { ...DEFAULTS, positions: "ADA" });
  check(play(typed, { type: "reflector", name: "C" }), { ...DEFAULTS, reflector: "C" });
  check(play(typed, { type: "plug", a: "h", b: "e" }), { ...DEFAULTS, plugs: ["EH"] });
  assert.equal(play(typed, { type: "set-rotor", slot: 1, name: "II" }), typed);
  assert.equal(play(typed, { type: "set-ring", slot: 1, letter: "1" }), typed);
  // after the change, typing on continues from where the new tape ends
  const after = play(typed, { type: "set-start", slot: 2, letter: "U" }, press("A"));
  assert.equal(after.code, encode({ ...DEFAULTS, positions: "AAU" }, "HELLOA"));
});

test("plug, unplug: pairs stay disjoint, at most ten", () => {
  let s = play(newMachine(DEFAULTS), { type: "plug", a: "A", b: "B" }, { type: "plug", a: "C", b: "D" });
  assert.deepEqual(s.settings.plugs, ["AB", "CD"]);
  s = play(s, { type: "plug", a: "B", b: "C" }); // B and C leave their old cables
  assert.deepEqual(s.settings.plugs, ["BC"]);
  assert.equal(play(s, { type: "plug", a: "A", b: "A" }), s);
  s = play(s, { type: "unplug", a: "c" });
  assert.deepEqual(s.settings.plugs, []);
  assert.equal(play(s, { type: "unplug", a: "Z" }), s);
  for (const pair of ["AB", "CD", "EF", "GH", "IJ", "KL", "MN", "OP", "QR", "ST"]) s = play(s, { type: "plug", a: pair[0], b: pair[1] });
  assert.equal(s.settings.plugs.length, 10);
  assert.equal(play(s, { type: "plug", a: "U", b: "V" }), s);
  assert.deepEqual(play(s, { type: "plug", a: "A", b: "U" }).settings.plugs.length, 10); // replaces AB
  assert.match(toQuery(s.settings), /plug=AB-CD-EF-GH-IJ-KL-MN-OP-QR-ST/);
});

test("clear empties the tape and goes back to the start", () => {
  const s = play(typeOn(newMachine({ ...DEFAULTS, positions: "QEV" }), "ABC"), { type: "clear" });
  assert.equal(s.plain, "");
  assert.equal(s.code, "");
  assert.equal(s.positions, "QEV");
});

test("a named release lets go of that key only", () => {
  const down = play(newMachine(DEFAULTS), press("A"));
  assert.equal(play(down, { type: "release", letter: "B" }), down);
  assert.equal(play(down, { type: "release", letter: "a" }).down, null);
});

test("restore lights the last lamp, warm, and the next key carries on", () => {
  const s = restore(DEFAULTS, "AAAAA");
  assert.equal(s.lamp, "O");
  assert.equal(s.lampFrame, LAMP_FRAMES);
  assert.equal(s.positions, "AAF");
  assert.ok(!pending(s));
  assert.equal(restore(DEFAULTS, "").lamp, null);
  assert.equal(restore(DEFAULTS, "AB!").lamp, encode(DEFAULTS, "AB")[1], "the last letter, not the last character");
  assert.equal(play(s, press("A")).code, encode(DEFAULTS, "AAAAAA"));
});

test("plugs rewires the whole board, and a bad board keeps the old one", () => {
  const typed = typeOn(newMachine(DEFAULTS), "HELLO");
  const s = play(typed, { type: "plugs", pairs: ["ab", "CD"] });
  assert.deepEqual(s.settings.plugs, ["AB", "CD"]);
  assert.equal(s.code, encode({ ...DEFAULTS, plugs: ["AB", "CD"] }, "HELLO"));
  assert.equal(play(s, { type: "plugs", pairs: ["AB", "BC"] }), s);
  assert.equal(play(s, { type: "plugs", pairs: ["AB", "CD"] }), s);
  assert.deepEqual(play(s, { type: "plugs", pairs: [] }).settings.plugs, []);
});

test("message retypes the tape from the start positions", () => {
  const s = play(typeOn(newMachine(DEFAULTS), "XYZ"), { type: "message", text: "aaaaa" });
  assert.equal(s.plain, "AAAAA");
  assert.equal(s.code, "BDZGO");
  assert.equal(s.positions, "AAF");
  assert.equal(play(s, { type: "message", text: "A".repeat(300) }).plain.length, MESSAGE_CAP);
});
