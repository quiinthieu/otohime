import { useId } from "react";
import { inkEllipse, inkLine, inkPath, type InkOptions, type InkPath } from "../_lib/art/ink.ts";
import { CORAL, EDGE, grainFilter, mix } from "../_lib/art/svg.ts";
import { PALETTE } from "../_lib/art/types.ts";
import { DROP_FRAMES, type Machine as MachineState } from "../_lib/machine.ts";
import { revealView } from "../_lib/reveal.ts";

// The capsule machine, printed in the cards' ink and posed from machine.ts
// state: a glass dome of capsules, a coin slot, a crank that turns on twos and
// a chute. The ink is drawn once, at module level, with fixed seeds (so the
// server and the browser draw the same bytes); a pose is only a transform on a
// group, so no frame redraws it. Every frame is a pure function of the
// machine state (phase, frame, the turn's length and which capsule drops), so
// reduced motion just skips to the last one. Nothing here reads the tier: up
// to the open shell, every round of every tier is posed the same.
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
// While the crank turns, each capsule cycles through these nudges, out of step
// with its neighbours: a tilt and a small bounce, on twos.
const TUMBLE: [number, number][] = [
  [-16, 1],
  [12, -3],
  [24, -1],
  [-8, -4],
];
// The chute capsule rocking in the shake stage, one pose a frame.
const SHAKE: [number, number][] = [
  [-10, -1.5],
  [9, 1.5],
  [-8, -1],
  [6, 1],
  [-4, -0.5],
  [2, 0],
];
const MOUTH: [number, number] = [100, 128]; // the dome's floor, over the collar
const REST: [number, number] = [100, 226]; // in the chute

// Where the falling capsule is k frames into the drop (0..5): down the dome
// on a short curve to the mouth, through the collar (hidden behind it), then
// into the chute, a little low, before it settles at REST.
function dropPose(k: number, [x0, y0, tilt]: [number, number, number]): { x: number; y: number; r: number; inDome: boolean } {
  if (k <= 2) {
    const t = (k + 1) / 3;
    // a quadratic from the capsule's place to the mouth, bending in under it
    const cx = x0;
    const cy = MOUTH[1];
    const x = (1 - t) ** 2 * x0 + 2 * (1 - t) * t * cx + t * t * MOUTH[0];
    const y = (1 - t) ** 2 * y0 + 2 * (1 - t) * t * cy + t * t * MOUTH[1];
    return { x, y, r: tilt + 55 * (k + 1), inDome: true };
  }
  if (k === 3) return { x: 100, y: 152, r: 0, inDome: true };
  return k === 4 ? { x: 100, y: 214, r: 30, inDome: false } : { x: 100, y: 229, r: -6, inDome: false };
}

const Shell = ({ x, y, r }: { x: number; y: number; r: number }) => (
  <g data-shell="" transform={`translate(${x} ${y}) rotate(${r})`}>
    <Top />
    <Bottom />
  </g>
);

export function Machine({ state, coinIn }: { state: MachineState; coinIn: boolean }) {
  const { phase, frame, length, drop } = state;
  const view = revealView(state);
  const turning = phase === "turning";
  const dropAt = length - DROP_FRAMES;
  const cranking = view.stage === "turning";
  // On twos: the crank poses every other frame and ends on a whole turn as the
  // capsule falls, however long this round's turn is.
  const poses = Math.max(1, Math.ceil(dropAt / 2));
  const turns = Math.max(1, Math.round(poses / 6));
  const pose = Math.floor(frame / 2);
  const crank = cranking ? Math.round(((pose + 1) / poses) * turns * 360) : 0;
  const jiggle = cranking ? (pose % 2 === 0 ? -2 : 2) : 0;
  // The capsule that falls leaves a gap in the dome until the next Insert.
  const gone = turning ? frame >= dropAt : phase === "ready" || phase === "opening" || phase === "revealed";
  const falling = view.shell === "dropping" ? dropPose(frame - dropAt, WAITING[drop % WAITING.length]) : null;
  const out = view.shell === "closed" || view.shell === "shake" || view.shell === "open";
  const [rock, sway] = view.shell === "shake" ? SHAKE[Math.min(frame, SHAKE.length - 1)] : [0, 0];
  const part = view.stage === "part" ? view.progress : view.shell === "open" ? 1 : 0;
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
          {WAITING.map(([x, y, tilt], i) => {
            if (gone && i === drop) return null;
            const [nudge, bounce] = cranking ? TUMBLE[(pose + i) % TUMBLE.length] : [0, 0];
            return <Shell key={i} x={x} y={y + bounce} r={tilt + nudge} />;
          })}
        </g>
        {/* the falling capsule, behind the collar and the body until it reaches the chute */}
        {falling?.inDome && <Shell x={falling.x} y={falling.y} r={falling.r} />}
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

        {falling && !falling.inDome && <Shell x={falling.x} y={falling.y} r={falling.r} />}
        {out && (
          <g data-shell="" transform={`translate(${REST[0] + sway} ${REST[1]}) rotate(${rock})`}>
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
