// One Enigma I, as pure functions: the page's server render, its no-JavaScript
// form and the island all encode through here, so they cannot disagree.
// Rotors are listed left to right as they sit in the machine (the right one
// steps on every key). Rings and positions are three letters, left to right.
// The settings travel in a URL as ?r=I-II-III&ring=AAA&pos=AAA&ref=B&plug=AB-CD&m=…
// and each field that does not parse falls back to its default on its own.
import { ALPHABET, REFLECTORS, ROTORS, type ReflectorName, type RotorName } from "./wiring.ts";

export type Settings = {
  rotors: readonly [RotorName, RotorName, RotorName];
  rings: string;
  positions: string;
  reflector: ReflectorName;
  plugs: readonly string[]; // pairs such as "AB", disjoint
};

/** Settings as read from a query, with the message that came with them. */
export type Parsed = Settings & { message: string };

export const MAX_PLUGS = 10;
export const MESSAGE_CAP = 250;

export const DEFAULTS: Settings = {
  rotors: ["I", "II", "III"],
  rings: "AAA",
  positions: "AAA",
  reflector: "B",
  plugs: [],
};

const index = (letter: string) => letter.charCodeAt(0) - 65;
const letterAt = (i: number) => ALPHABET[((i % 26) + 26) % 26];
const isLetter = (c: string) => c.length === 1 && c >= "A" && c <= "Z";

/**
 * The windows after one key press. The right rotor always steps. A rotor
 * sitting on its turnover carries the one to its left; the middle rotor,
 * on its own turnover, steps again with the left one (the double step), so
 * I-II-III from ADU reads ADV, AEW, BFX, BFY.
 */
export function step(positions: string, rotors: Settings["rotors"]): string {
  const [l, m, r] = [...positions];
  const middleAtTurnover = m === ROTORS[rotors[1]].turnover;
  const rightAtTurnover = r === ROTORS[rotors[2]].turnover;
  const next = (c: string) => letterAt(index(c) + 1);
  return (middleAtTurnover ? next(l) : l) + (middleAtTurnover || rightAtTurnover ? next(m) : m) + next(r);
}

function swap(plugs: readonly string[], c: string): string {
  for (const [a, b] of plugs) {
    if (c === a) return b;
    if (c === b) return a;
  }
  return c;
}

// The contact a signal leaves a rotor on, entering at contact i. The ring
// turns the wiring against the letters, so only position − ring matters.
function through(wiring: string, shift: number, i: number, inverse: boolean): number {
  const j = (i + shift + 26) % 26;
  const out = inverse ? wiring.indexOf(letterAt(j)) : index(wiring[j]);
  return (out - shift + 26) % 26;
}

/**
 * One key: the rotors step first, then the current runs through the
 * plugboard, the rotors right to left, the reflector, back left to right and
 * through the plugboard again. A non-letter lights nothing and steps nothing.
 */
export function encodeLetter(state: Settings, letter: string): [Settings, string] {
  const key = letter.toUpperCase();
  if (!isLetter(key)) return [state, letter];
  const positions = step(state.positions, state.rotors);
  const shifts = [0, 1, 2].map((k) => index(positions[k]) - index(state.rings[k]));
  let c = index(swap(state.plugs, key));
  for (const k of [2, 1, 0]) c = through(ROTORS[state.rotors[k]].wiring, shifts[k], c, false);
  c = index(REFLECTORS[state.reflector].wiring[c]);
  for (const k of [0, 1, 2]) c = through(ROTORS[state.rotors[k]].wiring, shifts[k], c, true);
  return [{ ...state, positions }, swap(state.plugs, letterAt(c))];
}

/** The code for `text` and the windows after its last letter. */
export function run(settings: Settings, text: string): { code: string; positions: string } {
  let state = settings;
  let code = "";
  for (const ch of text.toUpperCase()) {
    const [next, lamp] = encodeLetter(state, ch);
    state = next;
    code += lamp;
  }
  return { code, positions: state.positions };
}

/** Uppercases; letters are enciphered, anything else passes through unchanged. */
export const encode = (settings: Settings, text: string): string => run(settings, text).code;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

function parseRotors(v: string | undefined): Settings["rotors"] {
  const names = (v ?? "").toUpperCase().split("-");
  const ok = names.length === 3 && names.every((n) => n in ROTORS) && new Set(names).size === 3;
  return ok ? (names as unknown as Settings["rotors"]) : DEFAULTS.rotors;
}

const parseLetters = (v: string | undefined, fallback: string) => (/^[A-Za-z]{3}$/.test(v ?? "") ? v!.toUpperCase() : fallback);

function parseReflector(v: string | undefined): ReflectorName {
  const name = (v ?? "").toUpperCase();
  return name in REFLECTORS ? (name as ReflectorName) : DEFAULTS.reflector;
}

/** At most ten pairs of two different letters, no letter in two pairs; else no plugs. */
export function parsePlugs(v: string | undefined): readonly string[] {
  if (!v) return DEFAULTS.plugs;
  const pairs = v.toUpperCase().split("-");
  const letters = pairs.join("");
  const ok =
    pairs.length <= MAX_PLUGS && pairs.every((p) => /^[A-Z]{2}$/.test(p)) && new Set(letters).size === letters.length;
  return ok ? pairs : DEFAULTS.plugs;
}

export function parseSettings(query: Record<string, string | string[] | undefined>): Parsed {
  return {
    rotors: parseRotors(first(query.r)),
    rings: parseLetters(first(query.ring), DEFAULTS.rings),
    positions: parseLetters(first(query.pos), DEFAULTS.positions),
    reflector: parseReflector(first(query.ref)),
    plugs: parsePlugs(first(query.plug)),
    message: Array.from(first(query.m) ?? "").slice(0, MESSAGE_CAP).join(""),
  };
}

/** The canonical query, without the "?"; plug and m are left out when empty. */
export function toQuery(settings: Settings, message = ""): string {
  const q = new URLSearchParams({
    r: settings.rotors.join("-"),
    ring: settings.rings,
    pos: settings.positions,
    ref: settings.reflector,
  });
  if (settings.plugs.length) q.set("plug", settings.plugs.join("-"));
  if (message) q.set("m", Array.from(message).slice(0, MESSAGE_CAP).join(""));
  return q.toString();
}
