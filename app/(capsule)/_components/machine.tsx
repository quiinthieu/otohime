import { useId } from "react";
import type { Tier } from "../_lib/cards.ts";
import { OPEN_FRAMES, TURN_FRAMES, type Machine as MachineState } from "../_lib/machine.ts";

// The capsule machine, drawn by hand in SVG and posed from machine.ts state:
// a glass dome of capsules, a coin slot, a crank that turns on twos and a chute.
// Every frame is a pure function of (phase, frame), so reduced motion just
// skips to the last one.

const INK = "#3a2a28";
const line = { stroke: INK, strokeWidth: 3.5, strokeLinejoin: "round", strokeLinecap: "round" } as const;

// The capsule's top half hints at the tier inside.
const CAPSULE: Record<Tier, string> = { common: "#8fcbb8", rare: "#97b4ea", legend: "#efc64a" };

// Capsules waiting in the dome: x, y, colour.
const DOME: [number, number, string][] = [
  [68, 104, "#8fcbb8"],
  [94, 110, "#f3a6bb"],
  [122, 104, "#97b4ea"],
  [134, 80, "#8fcbb8"],
  [80, 80, "#efc64a"],
  [108, 86, "#f3a6bb"],
  [60, 78, "#97b4ea"],
  [100, 62, "#8fcbb8"],
];

function Capsule({ x, y, colour, tilt = 0 }: { x: number; y: number; colour: string; tilt?: number }) {
  return (
    <g transform={`rotate(${tilt} ${x} ${y})`}>
      <path d={`M ${x - 12} ${y} C ${x - 12} ${y - 16} ${x + 12} ${y - 16} ${x + 12} ${y} Z`} fill={colour} {...line} />
      <path d={`M ${x - 12} ${y} C ${x - 12} ${y + 16} ${x + 12} ${y + 16} ${x + 12} ${y} Z`} fill="#fffdf8" {...line} />
    </g>
  );
}

export function Machine({ state, tier, coinIn }: { state: MachineState; tier: Tier | null; coinIn: boolean }) {
  const { phase, frame } = state;
  const turning = phase === "turning";
  // On twos: the pose changes every other frame, a sixth of a turn each time.
  const crank = turning ? Math.floor(frame / 2) * (360 / (TURN_FRAMES / 2)) : 0;
  const jiggle = turning ? (Math.floor(frame / 2) % 2 === 0 ? -2 : 2) : 0;
  // The capsule drops into the chute over the last frames of the turn.
  const dropping = turning && frame >= TURN_FRAMES - 4;
  const out = phase === "ready" || phase === "opening" || phase === "revealed";
  const capsuleY = dropping ? 204 + (frame - (TURN_FRAMES - 4)) * 6 : 226;
  const part = phase === "opening" ? (frame + 1) / OPEN_FRAMES : phase === "revealed" ? 1 : 0;
  const colour = tier ? CAPSULE[tier] : CAPSULE.common;
  const filterId = `wobble${useId().replace(/[^A-Za-z0-9_-]/g, "")}`;

  return (
    <svg className="machine" viewBox="0 0 200 262" role="img" aria-label={`Capsule machine, ${phase}`}>
      <defs>
        <filter id={filterId} x="-4%" y="-4%" width="108%" height="108%">
          <feTurbulence type="fractalNoise" baseFrequency="0.03" numOctaves={2} seed={3} result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale={2.6} xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </defs>
      <g filter={`url(#${filterId})`}>
      {/* the glass dome and what waits inside */}
      <path
        d="M 100 18 C 138 17 164 46 163 82 C 163 116 136 142 100 141 C 63 142 37 116 37 81 C 38 46 63 18 100 18 Z"
        fill="#e6f1ee"
        {...line}
      />
      <g transform={`translate(0 ${jiggle})`}>
        {DOME.map(([x, y, c], i) => (
          <Capsule key={i} x={x} y={y} colour={c} tilt={(i % 3) * 25 - 25 + (turning ? jiggle * 4 : 0)} />
        ))}
      </g>
      <path d="M 58 52 C 66 38 80 31 94 30" fill="none" stroke="#fffdf8" strokeWidth={5} strokeLinecap="round" />

      {/* collar and body */}
      <path d="M 62 134 Q 100 140 138 134 L 140 150 Q 100 154 60 150 Z" fill="#d9604a" {...line} />
      <path
        d="M 46 150 Q 100 146 154 150 C 158 180 158 216 155 248 Q 100 252 45 248 C 42 216 42 180 46 150 Z"
        fill="#ef8a72"
        {...line}
      />
      <path d="M 146 156 C 150 184 150 216 147 244 L 154 246 C 157 216 157 182 153 152 Z" fill="#d9604a" />

      {/* coin slot, with the coin showing once it is in */}
      <path d="M 124 162 Q 134 161 140 163 L 139 186 Q 132 187 125 186 Z" fill="#fffdf8" {...line} />
      <path d="M 130 167 L 131 181" fill="none" {...line} />
      {coinIn && <path d="M 126 170 C 126 162 136 162 136 170 Z" fill="#efc64a" {...line} />}

      {/* the crank */}
      <path
        d="M 82 166 C 94 166 102 175 102 186 C 102 198 93 206 82 206 C 70 206 62 197 62 186 C 62 175 71 166 82 166 Z"
        fill="#fffdf8"
        {...line}
      />
      <g transform={`rotate(${crank} 82 186)`}>
        <path d="M 66 183 Q 82 181 98 183 L 98 189 Q 82 191 66 189 Z" fill="#efc64a" {...line} />
        <path d="M 93 186 C 93 180 101 180 101 186 C 101 192 93 192 93 186 Z" fill="#d9604a" {...line} />
      </g>

      {/* the chute */}
      <path d="M 70 214 Q 100 211 130 214 L 131 242 Q 100 244 69 242 Z" fill="#5b4542" {...line} />

      {(dropping || out) && (
        <g>
          <g
            transform={`translate(${-14 * part} ${-22 * part}) rotate(${-30 * part} 100 ${capsuleY})`}
            className="capsule-half"
          >
            <path
              d={`M 88 ${capsuleY} C 88 ${capsuleY - 16} 112 ${capsuleY - 16} 112 ${capsuleY} Z`}
              fill={colour}
              {...line}
            />
          </g>
          <g transform={`translate(${14 * part} ${6 * part}) rotate(${24 * part} 100 ${capsuleY})`} className="capsule-half">
            <path
              d={`M 88 ${capsuleY} C 88 ${capsuleY + 16} 112 ${capsuleY + 16} 112 ${capsuleY} Z`}
              fill="#fffdf8"
              {...line}
            />
          </g>
        </g>
      )}
      </g>
    </svg>
  );
}
