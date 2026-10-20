// The Enigma I's wheels, as published. Each wiring is the letter that A..Z
// leaves as, at ring A and position A. The turnover is the letter in the
// window when the wheel, stepping on, carries the wheel to its left (I steps
// from Q to R, and so on). Copied from Wikipedia's rotor table and checked
// letter for letter against the Crypto Museum's: both are cited below and in
// the page's credit line. Rotors VI–VIII and the M4's thin wheels are not here.

export const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

export const SOURCES = [
  "https://en.wikipedia.org/wiki/Enigma_rotor_details",
  "https://www.cryptomuseum.com/crypto/enigma/wiring.htm",
] as const;

export type RotorName = "I" | "II" | "III" | "IV" | "V";
export type ReflectorName = "B" | "C";

export type Rotor = { name: RotorName; wiring: string; turnover: string; source: string };
export type Reflector = { name: ReflectorName; wiring: string; source: string };

export const ROTORS: Record<RotorName, Rotor> = {
  I: { name: "I", wiring: "EKMFLGDQVZNTOWYHXUSPAIBRCJ", turnover: "Q", source: SOURCES[0] },
  II: { name: "II", wiring: "AJDKSIRUXBLHWTMCQGZNPYFVOE", turnover: "E", source: SOURCES[0] },
  III: { name: "III", wiring: "BDFHJLCPRTXVZNYEIWGAKMUSQO", turnover: "V", source: SOURCES[0] },
  IV: { name: "IV", wiring: "ESOVPZJAYQUIRHXLNFTGKDCMWB", turnover: "J", source: SOURCES[0] },
  V: { name: "V", wiring: "VZBRGITYUPSDNHLXAWMJQOFECK", turnover: "Z", source: SOURCES[0] },
};

export const REFLECTORS: Record<ReflectorName, Reflector> = {
  B: { name: "B", wiring: "YRUHQSLDPXNGOKMIEBFZCWVJAT", source: SOURCES[1] },
  C: { name: "C", wiring: "FVPJIAOYEDRZXWGCTKUQSBNMHL", source: SOURCES[1] },
};

export const ROTOR_NAMES = Object.keys(ROTORS) as RotorName[];
export const REFLECTOR_NAMES = Object.keys(REFLECTORS) as ReflectorName[];
