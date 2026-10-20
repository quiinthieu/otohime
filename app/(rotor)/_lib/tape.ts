// The paper tape under the lampboard: plain text above, code below, both in
// groups of five. Only the last 60 letters stay on the tape; `cut` says how
// many fell off the left. Groups are counted from the first letter ever
// typed, so typing on past 60 does not reshuffle them (the first group left
// on the tape may be short).

export const TAPE_LETTERS = 60;
export const GROUP = 5;

export type Tape = { plain: string; code: string; cut: number };

const letters = (s: string) => s.toUpperCase().replace(/[^A-Z]/g, "");

function groups(s: string, from: number): string {
  let out = "";
  for (let i = 0; i < s.length; i++) {
    if (i > 0 && (from + i) % GROUP === 0) out += " ";
    out += s[i];
  }
  return out;
}

export function tape(plain: string, code: string): Tape {
  const p = letters(plain);
  const c = letters(code);
  const cut = Math.max(0, p.length - TAPE_LETTERS);
  return { plain: groups(p.slice(cut), cut), code: groups(c.slice(cut), cut), cut };
}
