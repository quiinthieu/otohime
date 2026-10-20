// The words on /rotor. The explainer is capped at WORD_CAP (words.ts), and
// it is about the mechanism: copy.test.ts keeps war words out.

export const TAGLINE = "An Enigma, drawn by hand. Type and watch the lamps.";

export const EXPLAINER_TITLE = "How it works";

export const EXPLAINER = [
  "Each key closes a circuit. The current runs through the plugboard, the three rotors and the reflector, then back by a different path to one lamp.",
  "Before it flows, the right rotor turns one step, so the same key lights a different lamp next time. A rotor passing its notch carries its neighbour; the middle rotor then moves twice in a row, the double step.",
  "Why the same settings decode: the reflector turns the current round, so the path from A to G is the path from G to A, run backwards. Set the machine the same way, type the code, and the message comes back. It is also why no letter ever lights itself.",
] as const;
