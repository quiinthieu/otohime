import { useId } from "react";
import { inkEllipse, inkLine, inkPath, type InkOptions, type InkPath } from "../_lib/art/ink.ts";
import { CORAL, EDGE, grainFilter, mix } from "../_lib/art/svg.ts";
import { PALETTE } from "../_lib/art/types.ts";
import { OPEN_FRAMES, TURN_FRAMES, type Machine as MachineState } from "../_lib/machine.ts";

// The capsule machine, printed in the cards' ink and posed from machine.ts
// state: a glass dome of capsules, a coin slot, a crank that turns on twos and
// a chute. The ink is drawn once, at module level, with fixed seeds (so the
// server and the browser draw the same bytes); a pose is only a transform on a
// group, so no frame redraws it. Every frame is a pure function of (phase,
// frame), so reduced motion just skips to the last one.
//
// Every capsule is the same shell, coral over paper, in the dome and out of it:
// its colour says nothing about the card inside.

const { ink: INK, paper: PAPER, white: WHITE } = PALETTE;
const SLATE = EDGE.rare;
const GOLD = EDGE.legend;
const CORAL_SHADE = mix(CORAL, "#000000", 0.3);
const COLLAR = mix(CORAL, INK, 0.28);
const GLASS = mix(PAPER, SLATE, 0.1);
const CHUTE = mix(INK, PAPER, 0.18);

const hatch = (d: string, colour: string, o: InkOptions = {}) =>
  inkPath(d, { stroke: "none", fill: colour, fillStyle: "hachure", hachureGap: 2.4, hachureAngle: -48, fillWeight: 0.9, roughness: 0.7, ...o });

// The shapes, in the machine's 0 0 200 262 space.
const DOME = { cx: 100, cy: 80, w: 126, h: 122 };
const COLLAR_D = "M 62 134 Q 100 140 138 134 L 140 150 Q 100 154 60 150 Z";
const BODY_D = "M 46 150 Q 100 146 154 150 C 158 180 158 216 155 248 Q 100 252 45 248 C 42 216 42 180 46 150 Z";
const SLOT_D = "M 124 162 Q 134 161 140 163 L 139 186 Q 132 187 125 186 Z";
const COIN_D = "M 126 171 C 126 163 138 163 138 171 Z";
const CHUTE_D = "M 70 214 Q 100 211 130 214 L 131 242 Q 100 244 69 242 Z";
const HANDLE_D = "M 66 183 Q 82 181 98 183 L 98 189 Q 82 191 66 189 Z";
// The shell's halves, centred on 0 0 and parting along y = 0.
const TOP_D = "M -12 0 C -12 -16 12 -16 12 0 Z";
const BOTTOM_D = "M -12 0 C -12 16 12 16 12 0 Z";

const ART = {
  shadow: hatch("M 30 252 C 30 244 170 244 170 252 C 170 260 30 260 30 252 Z", INK, { hachureGap: 3.2, fillWeight: 0.6, hachureAngle: -30, seed: "machine:shadow" }),
  dome: inkEllipse(DOME.cx, DOME.cy, DOME.w, DOME.h, { seed: "machine:dome", strokeWidth: 1.7 }),
  reflection: hatch("M 50 74 C 50 50 68 32 94 27 C 76 38 64 54 62 76 Z", SLATE, { hachureGap: 2.2, fillWeight: 0.8, hachureAngle: 40, seed: "machine:shine" }),
  glint: inkLine(132, 40, 140, 50, { seed: "machine:glint", stroke: WHITE, strokeWidth: 2.4 }),
  collar: inkPath(COLLAR_D, { seed: "machine:collar" }),
  body: inkPath(BODY_D, { seed: "machine:body" }),
  bodyShade: hatch("M 140 153 C 145 184 145 216 142 245 L 154 247 C 157 216 157 182 153 151 Z", CORAL_SHADE, { seed: "machine:edge" }),
  seam: inkLine(52, 206, 148, 206, { seed: "machine:seam", strokeWidth: 0.8 }),
  slot: inkPath(SLOT_D, { seed: "machine:slot", strokeWidth: 1.5 }),
  slotMouth: inkLine(132, 167, 132, 181, { seed: "machine:mouth", strokeWidth: 2.2 }),
  coin: inkPath(COIN_D, { seed: "machine:coin", strokeWidth: 1.2 }),
  dial: inkEllipse(82, 186, 40, 40, { seed: "machine:dial" }),
  dialRing: inkEllipse(82, 186, 31, 31, { seed: "machine:ring", strokeWidth: 0.7 }),
  handle: inkPath(HANDLE_D, { seed: "machine:handle", strokeWidth: 1.5 }),
  chute: inkPath(CHUTE_D, { seed: "machine:chute" }),
  chuteLip: inkLine(73, 219, 127, 219, { seed: "machine:lip", stroke: mix(INK, PAPER, 0.45), strokeWidth: 0.8 }),
  shellTop: inkPath(TOP_D, { seed: "shell:top", strokeWidth: 1.5 }),
  shellBottom: inkPath(BOTTOM_D, { seed: "shell:bottom", strokeWidth: 1.5 }),
};

function Ink({ paths }: { paths: InkPath[] }) {
  return paths.map((p, i) =>
    p.fill ? (
      <path key={i} d={p.d} fill={p.fill} />
    ) : (
      <path key={i} d={p.d} fill="none" stroke={p.stroke} strokeWidth={p.strokeWidth} />
    ),
  );
}

const Top = () => (
  <>
    <path d={TOP_D} fill={CORAL} />
    <Ink paths={ART.shellTop} />
  </>
);
const Bottom = () => (
  <>
    <path d={BOTTOM_D} fill={WHITE} />
    <Ink paths={ART.shellBottom} />
  </>
);

// Capsules waiting in the dome: x, y, tilt.
const WAITING: [number, number, number][] = [
  [68, 104, -25],
  [94, 110, 0],
  [122, 104, 25],
  [134, 80, -25],
  [80, 80, 0],
  [108, 86, 25],
  [60, 78, -25],
  [100, 62, 0],
];

export function Machine({ state, coinIn }: { state: MachineState; coinIn: boolean }) {
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
  // useId may contain characters a url(#...) reference does not like.
  const id = useId().replace(/[^A-Za-z0-9_-]/g, "");
  const grain = `grain${id}`;
  const clip = `machine${id}`;

  return (
    <svg className="machine" viewBox="0 0 200 262" role="img" aria-label={`Capsule machine, ${phase}`}>
      <defs dangerouslySetInnerHTML={{ __html: grainFilter(grain) }} />
      <clipPath id={clip}>
        <ellipse cx={DOME.cx} cy={DOME.cy} rx={DOME.w / 2} ry={DOME.h / 2} />
        <path d={COLLAR_D} />
        <path d={BODY_D} />
      </clipPath>
      <g strokeLinejoin="round" strokeLinecap="round">
        <Ink paths={ART.shadow} />

        {/* the glass dome and what waits inside */}
        <ellipse cx={DOME.cx} cy={DOME.cy} rx={DOME.w / 2} ry={DOME.h / 2} fill={GLASS} />
        <g transform={`translate(0 ${jiggle})`}>
          {WAITING.map(([x, y, tilt], i) => (
            <g key={i} data-shell="" transform={`translate(${x} ${y}) rotate(${tilt + (turning ? jiggle * 4 : 0)})`}>
              <Top />
              <Bottom />
            </g>
          ))}
        </g>
        <Ink paths={ART.reflection} />
        <Ink paths={ART.glint} />
        <Ink paths={ART.dome} />

        {/* collar and body */}
        <path d={COLLAR_D} fill={COLLAR} />
        <Ink paths={ART.collar} />
        <path d={BODY_D} fill={CORAL} />
        <Ink paths={ART.bodyShade} />
        <Ink paths={ART.seam} />
        <Ink paths={ART.body} />

        {/* coin slot, with the coin showing once it is in */}
        <path d={SLOT_D} fill={PAPER} />
        <Ink paths={ART.slot} />
        <Ink paths={ART.slotMouth} />
        {coinIn && (
          <>
            <path d={COIN_D} fill={GOLD} />
            <Ink paths={ART.coin} />
          </>
        )}

        {/* the crank */}
        <circle cx={82} cy={186} r={20} fill={PAPER} />
        <Ink paths={ART.dial} />
        <Ink paths={ART.dialRing} />
        <g transform={`rotate(${crank} 82 186)`}>
          <path d={HANDLE_D} fill={PAPER} />
          <Ink paths={ART.handle} />
          <circle cx={97} cy={186} r={4} fill={INK} />
          <circle cx={82} cy={186} r={2.6} fill={INK} />
        </g>

        {/* the chute */}
        <path d={CHUTE_D} fill={CHUTE} />
        <Ink paths={ART.chuteLip} />
        <Ink paths={ART.chute} />

        {/* the paper grain over the machine, not the page around it */}
        <rect x="0" y="0" width="200" height="262" filter={`url(#${grain})`} clipPath={`url(#${clip})`} opacity={0.07} pointerEvents="none" />

        {(dropping || out) && (
          <g data-shell="" transform={`translate(100 ${capsuleY})`}>
            <g transform={`translate(${-14 * part} ${-22 * part}) rotate(${-30 * part})`} className="capsule-half">
              <Top />
            </g>
            <g transform={`translate(${14 * part} ${6 * part}) rotate(${24 * part})`} className="capsule-half">
              <Bottom />
            </g>
          </g>
        )}
      </g>
    </svg>
  );
}
