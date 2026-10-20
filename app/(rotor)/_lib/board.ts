// Where things sit on the drawn box, in the SVG's own units: the three rotor
// windows across the top, then the lampboard in the machine's own order
// (QWERTZU…, three rows, the middle one set in by half a lamp). The keyboard
// below uses the same rows. box.tsx inks these places on the server and the
// island lights them, so both read them from here.

export const VIEW = { w: 600, h: 314 } as const;

export const ROWS = ["QWERTZUIO", "ASDFGHJK", "PYXCVBNML"] as const;

export const LAMP_R = 22;
const LAMP_GAP = 62;
const LAMP_Y = [156, 214, 272];

export type Spot = { letter: string; x: number; y: number };

export const LAMPS: Spot[] = ROWS.flatMap((row, r) =>
  [...row].map((letter, i) => ({ letter, x: VIEW.w / 2 + (i - (row.length - 1) / 2) * LAMP_GAP, y: LAMP_Y[r] })),
);

export const WINDOW = { w: 48, h: 50, top: 30 } as const;
export const WINDOWS = [0, 1, 2].map((i) => ({ x: VIEW.w / 2 + (i - 1) * 84, y: WINDOW.top + WINDOW.h / 2 }));

/** The lamps' panel under the rotor bank. */
export const DIVIDER_Y = 112;
