import type { ReactNode } from "react";
import { DIVIDER_Y, LAMP_R, LAMPS, ROWS, VIEW, WINDOW, WINDOWS } from "../_lib/board.ts";
import { inkCircle, inkLine, inkRect, type InkPath } from "../_lib/ink.ts";

// The box's ink, drawn on the server with rough.js (ink.ts, seed 202): the
// case, the rotor bank and its three windows, a rim per lamp and a cap per key.
// It is handed to the island as finished SVG, so the island lights and turns
// things without ever loading rough.js. Strokes take var(--ink) from rotor.css,
// so the same ink reads on cream and in the dark scheme.

function Ink({ paths }: { paths: InkPath[] }) {
  return paths.map((p, i) => (
    <path key={i} d={p.d} fill="none" stroke={p.stroke} strokeWidth={p.strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
  ));
}

export type BoxInk = {
  /** The case, the rotor bank, the windows and the divider: one <g>. */
  frame: ReactNode;
  /** A lamp's rim, by letter. */
  rims: Record<string, ReactNode>;
  /** A key's cap, by letter: a whole small <svg>. */
  caps: Record<string, ReactNode>;
};

function draw(): BoxInk {
  const bankLeft = WINDOWS[0].x - WINDOW.w / 2 - 34;
  const bankRight = WINDOWS[2].x + WINDOW.w / 2 + 34;
  const frame = (
    <g className="ink">
      <Ink paths={inkRect(8, 8, VIEW.w - 16, VIEW.h - 16, { seed: "case", strokeWidth: 2.6 })} />
      <Ink paths={inkRect(bankLeft, WINDOW.top - 12, bankRight - bankLeft, WINDOW.h + 46, { seed: "bank", strokeWidth: 1.8, roughness: 1 })} />
      {WINDOWS.map((w, i) => (
        <g key={i}>
          <Ink paths={inkRect(w.x - WINDOW.w / 2, WINDOW.top, WINDOW.w, WINDOW.h, { seed: `window-${i}`, strokeWidth: 2.2, roughness: 1 })} />
          {/* the thumbwheel's ridges, right of the window */}
          {[0, 1, 2, 3].map((k) => (
            <Ink
              key={k}
              paths={inkLine(w.x + WINDOW.w / 2 + 6, WINDOW.top + 8 + k * 11, w.x + WINDOW.w / 2 + 14, WINDOW.top + 8 + k * 11, {
                seed: `ridge-${i}-${k}`,
                strokeWidth: 1.4,
                roughness: 0.6,
              })}
            />
          ))}
        </g>
      ))}
      <Ink paths={inkLine(24, DIVIDER_Y, VIEW.w - 24, DIVIDER_Y, { seed: "divider", strokeWidth: 1.6, roughness: 0.9 })} />
    </g>
  );
  const rims = Object.fromEntries(
    LAMPS.map((l) => [
      l.letter,
      <g key={l.letter} className="ink">
        <Ink paths={inkCircle(l.x, l.y, LAMP_R, { seed: `lamp-${l.letter}`, strokeWidth: 2, roughness: 0.9, disableMultiStroke: true })} />
      </g>,
    ]),
  );
  const caps = Object.fromEntries(
    ROWS.join("")
      .split("")
      .map((letter) => [
        letter,
        <svg key={letter} className="cap ink" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
          <Ink paths={inkCircle(24, 24, 19, { seed: `key-${letter}`, strokeWidth: 2.2, roughness: 1, disableMultiStroke: true })} />
        </svg>,
      ]),
  );
  return { frame, rims, caps };
}

let drawn: BoxInk | undefined;

/** The same ink for every request: the seed fixes the wobble, so draw it once. */
export function boxInk(): BoxInk {
  drawn ??= draw();
  return drawn;
}
