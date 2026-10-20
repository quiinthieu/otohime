import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DEFAULTS,
  encode,
  encodeLetter,
  MESSAGE_CAP,
  parseSettings,
  run,
  step,
  toQuery,
  type Settings,
} from "./enigma.ts";
import { ALPHABET } from "./wiring.ts";

const with_ = (o: Partial<Settings>): Settings => ({ ...DEFAULTS, ...o });
const asQuery = (q: string) => Object.fromEntries(new URLSearchParams(q));

// mulberry32: the same 1,000 messages every run
function random(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const ROTOR_ORDERS: Settings["rotors"][] = [
  ["I", "II", "III"],
  ["II", "IV", "V"],
  ["V", "III", "I"],
  ["IV", "I", "V"],
  ["III", "V", "II"],
];

function randomSettings(rand: () => number): Settings {
  const letter = () => ALPHABET[Math.floor(rand() * 26)];
  const shuffled = [...ALPHABET].sort(() => rand() - 0.5);
  const plugs = Array.from({ length: Math.floor(rand() * 11) }, (_, i) => shuffled[2 * i] + shuffled[2 * i + 1]);
  return {
    rotors: ROTOR_ORDERS[Math.floor(rand() * ROTOR_ORDERS.length)],
    rings: letter() + letter() + letter(),
    positions: letter() + letter() + letter(),
    reflector: rand() < 0.5 ? "B" : "C",
    plugs,
  };
}

test("AAAAA → BDZGO (I-II-III, reflector B, rings AAA, start AAA, no plugs)", () => {
  assert.equal(encode(DEFAULTS, "AAAAA"), "BDZGO");
  assert.equal(encode(DEFAULTS, "BDZGO"), "AAAAA");
});

test("the double step: ADU → ADV → AEW → BFX → BFY on four presses", () => {
  const seen = ["ADU"];
  for (let i = 0; i < 4; i++) seen.push(step(seen[seen.length - 1], DEFAULTS.rotors));
  assert.deepEqual(seen, ["ADU", "ADV", "AEW", "BFX", "BFY"]);
  // and the same through encodeLetter, as five presses from ADT
  let state = with_({ positions: "ADT" });
  const windows: string[] = [];
  for (let i = 0; i < 5; i++) {
    [state] = encodeLetter(state, "A");
    windows.push(state.positions);
  }
  assert.deepEqual(windows, ["ADU", "ADV", "AEW", "BFX", "BFY"]);
  assert.equal(run(with_({ positions: "ADU" }), "AAAA").positions, "BFY");
});

test("a normal carry: AAU → AAV → ABW → ABX", () => {
  assert.equal(step("AAU", DEFAULTS.rotors), "AAV");
  assert.equal(step("AAV", DEFAULTS.rotors), "ABW");
  assert.equal(step("ABW", DEFAULTS.rotors), "ABX");
  assert.equal(step("AAZ", ["I", "II", "V"]), "ABA"); // V turns over from Z to A
});

// The independent vectors below were produced with py-enigma, Brian Neal's
// simulator, run as `uv run --with py-enigma` (EnigmaMachine.from_key_sheet,
// set_display, process_text): https://pypi.org/project/py-enigma/
// It also gives AAAAA → BDZGO for the defaults.
test("independent vector: IV-I-V, reflector C, rings GMY, six plugs, start KQZ", () => {
  const s = with_({ rotors: ["IV", "I", "V"], reflector: "C", rings: "GMY", positions: "KQZ", plugs: ["AT", "BL", "CK", "DY", "EW", "FX"] });
  const out = run(s, "ROTORTURNSTHEROTORSTEPSANDTHELAMPLIGHTS");
  assert.equal(out.code, "OVAMGHXARPMUIPNVNZMNACJNHQHSICOZFHHXFRV");
  assert.equal(out.positions, "LSM");
});

// The 1941 "Barbarossa" message (II-IV-V, reflector B, rings BUL, ten plugs,
// start BLA), published by Frode Weierud and Tony Sale; py-enigma (URL above)
// deciphers it to the same text.
test("independent vector: the 1941 message, II-IV-V, rings BUL, ten plugs", () => {
  const s = with_({
    rotors: ["II", "IV", "V"],
    rings: "BUL",
    positions: "BLA",
    plugs: ["AV", "BS", "CG", "DL", "FU", "HZ", "IN", "KM", "OW", "RX"],
  });
  const code =
    "EDPUDNRGYSZRCXNUYTPOMRMBOFKTBZREZKMLXLVEFGUEYSIOZVEQMIKUBPMMYLKLTTDEISMDICAGYKUACTCDOMOHWXMUUIAUBSTSLRNBZSZWNRFXWFYSSXJZVIJHIDISHPRKLKAYUPADTXQSPINQMATLPIFSVKDASCTACDPBOPVHJK";
  const plain =
    "AUFKLXABTEILUNGXVONXKURTINOWAXKURTINOWAXNORDWESTLXSEBEZXSEBEZXUAFFLIEGERSTRASZERIQTUNGXDUBROWKIXDUBROWKIXOPOTSCHKAXOPOTSCHKAXUMXEINSAQTDREINULLXUHRANGETRETENXANGRIFFXINFXRGTX";
  assert.equal(encode(s, code), plain);
  assert.equal(encode(s, plain), code);
});

test("encode is its own inverse: 1,000 seeded random messages and settings", () => {
  const rand = random(202);
  for (let n = 0; n < 1000; n++) {
    const s = randomSettings(rand);
    const length = 1 + Math.floor(rand() * 80);
    const m = Array.from({ length }, () => ALPHABET[Math.floor(rand() * 26)]).join("");
    const c = encode(s, m);
    assert.equal(encode(s, c), m, `${toQuery(s, m)}`);
    for (let i = 0; i < m.length; i++) assert.notEqual(c[i], m[i], "no letter encodes to itself");
  }
});

test("no letter ever encodes to itself, at any position", () => {
  const s = with_({ plugs: ["AB", "CD", "EF"], rings: "QRS" });
  for (const pos of ["AAA", "ADV", "QEV", "ZZZ"]) {
    for (const letter of ALPHABET) {
      const [, lamp] = encodeLetter({ ...s, positions: pos }, letter);
      assert.notEqual(lamp, letter, `${pos} ${letter}`);
    }
  }
});

test("a plug pair swaps both ways", () => {
  // with A plugged to Q, pressing A is pressing Q on the bare machine, and the
  // lamp passes through the same cable on the way out
  const swapAQ = (c: string) => (c === "A" ? "Q" : c === "Q" ? "A" : c);
  const plugged = with_({ plugs: ["AQ"] });
  for (const letter of ALPHABET) {
    const [, bare] = encodeLetter(DEFAULTS, swapAQ(letter));
    const [, x] = encodeLetter(plugged, letter);
    assert.equal(x, swapAQ(bare), letter);
    assert.equal(encodeLetter(plugged, x)[1], letter, letter);
  }
  assert.equal(encode(with_({ plugs: ["AQ"] }), "AQAQ"), encode(with_({ plugs: ["QA"] }), "AQAQ"));
});

test("a non-letter passes through and leaves the state alone", () => {
  for (const ch of [" ", "1", ".", "é", "\n"]) {
    const [state, lamp] = encodeLetter(DEFAULTS, ch);
    assert.equal(lamp, ch);
    assert.equal(state, DEFAULTS);
  }
  assert.equal(encode(DEFAULTS, "aa aaa!"), "BD ZGO!");
  assert.equal(encode(DEFAULTS, "Hello, world 42"), encode(DEFAULTS, "HELLO, WORLD 42"));
  assert.equal(run(DEFAULTS, "A A.A").positions, "AAD");
});

test("rings turn the wiring against the letters: only position minus ring matters", () => {
  assert.notEqual(encode(with_({ rings: "BBB" }), "AAAAA"), "BDZGO");
  // the same shift on the left and middle rotors, and no turnover on the way: the same code
  assert.equal(encode(with_({ rings: "BBA", positions: "BBA" }), "AAAAA"), "BDZGO");
});

test("parseSettings(toQuery(s, m)) round-trips", () => {
  const rand = random(7);
  for (let n = 0; n < 200; n++) {
    const s = randomSettings(rand);
    const m = n % 3 === 0 ? "" : `Hello world & co. #${n} — 50%`;
    const back = parseSettings(asQuery(toQuery(s, m)));
    assert.deepEqual(back, { ...s, plugs: [...s.plugs], rotors: [...s.rotors], message: m });
  }
  assert.equal(toQuery(DEFAULTS), "r=I-II-III&ring=AAA&pos=AAA&ref=B");
  assert.equal(toQuery(with_({ plugs: ["AB", "CD"] }), "HI"), "r=I-II-III&ring=AAA&pos=AAA&ref=B&plug=AB-CD&m=HI");
});

test("an empty query gives the defaults", () => {
  assert.deepEqual(parseSettings({}), { ...DEFAULTS, message: "" });
});

test("each bad field falls back to its default on its own", () => {
  const good = { r: "II-IV-V", ring: "BUL", pos: "XYZ", ref: "C", plug: "AV-BS-CG", m: "hello" };
  const parsed = parseSettings(good);
  assert.deepEqual(parsed, { rotors: ["II", "IV", "V"], rings: "BUL", positions: "XYZ", reflector: "C", plugs: ["AV", "BS", "CG"], message: "hello" });
  const bad: Record<string, string[]> = {
    r: ["nope", "I-I-II", "I-II", "I-II-III-IV", "I-II-VI", ""],
    ring: ["AA", "AAAA", "A1A", "ÄAA", ""],
    pos: ["ZZ", "123", "A A"],
    ref: ["Z", "A", "BC", ""],
    plug: ["AA", "AB-BC", "A-BC", "ABC", "AB--CD", "AB-CD-EF-GH-IJ-KL-MN-OP-QR-ST-UV", "1B"],
  };
  const field: Record<string, keyof Settings> = { r: "rotors", ring: "rings", pos: "positions", ref: "reflector", plug: "plugs" };
  for (const [key, values] of Object.entries(bad)) {
    for (const v of values) {
      const out = parseSettings({ ...good, [key]: v });
      assert.deepEqual(out, { ...parsed, [field[key]]: DEFAULTS[field[key]] }, `${key}=${v}`);
    }
  }
  assert.deepEqual(parseSettings({ ...good, plug: "AB-CD-EF-GH-IJ-KL-MN-OP-QR-ST" }).plugs.length, 10);
  assert.deepEqual(parseSettings({ r: "v-iv-iii", ring: "abc", ref: "c", plug: "ab-cd" }).rotors, ["V", "IV", "III"]);
  assert.deepEqual(parseSettings({ r: ["II-I-III", "nope"], ref: ["C"] }).rotors, ["II", "I", "III"]);
});

test("a 300-character message is cut to 250", () => {
  assert.equal(MESSAGE_CAP, 250);
  const m = "ABCDEFGHIJ".repeat(30);
  assert.equal(parseSettings({ m }).message.length, 250);
  assert.equal(parseSettings({ m }).message, m.slice(0, 250));
  assert.equal(new URLSearchParams(toQuery(DEFAULTS, m)).get("m")?.length, 250);
});
