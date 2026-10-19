import { useId, type CSSProperties } from "react";
import { LAYERS, type ChapterId, type Layer } from "../_lib/sun.ts";

// The cutaway, drawn from LAYERS. Inside the Sun the radii are the real
// fractions of R. The atmosphere is drawn far thicker than true scale (the
// photosphere is 500 km on a 695,700 km radius) and the legend says so.
// The wobble filter sits on the static layers only: never on a group that
// moves, because a filtered animation is re-rasterised every frame.
// Every scene group is always rendered; sun.css shows the one that matches
// data-chapter, so the server HTML carries all of them.

const W = 800;
const H = 500;
const CX = 240;
const CY = 250;
const R = 160;

const DRAWN_OUTER: Record<string, number> = { photosphere: 1.012, chromosphere: 1.06, corona: 1.4 };
const outer = (l: Layer) => (l.region === "interior" ? l.to * R : R * (DRAWN_OUTER[l.id] ?? 1));
const inner = (l: Layer, i: number) =>
  l.region === "interior" ? l.from * R : l.id === "photosphere" ? R : outer(LAYERS[i - 1]);

const n = (x: number) => +x.toFixed(2);

// A full annulus (even-odd fill)
function annulus(ri: number, ro: number): string {
  const circle = (r: number) => `M${n(CX - r)},${CY}a${n(r)},${n(r)} 0 1,0 ${n(2 * r)},0a${n(r)},${n(r)} 0 1,0 ${n(-2 * r)},0Z`;
  return circle(ro) + (ri > 0 ? circle(ri) : "");
}

// The cut-away quarter (upper right): a quarter annulus
function quarter(ri: number, ro: number): string {
  const back = ri > 0 ? `A${n(ri)},${n(ri)} 0 0,0 ${CX},${n(CY - ri)}` : `L${CX},${CY}`;
  return `M${CX},${n(CY - ro)}A${n(ro)},${n(ro)} 0 0,1 ${n(CX + ro)},${CY}L${n(CX + ri)},${CY}${back}Z`;
}

// The rest of the disc: three quarters, the surface we see
const SURFACE = `M${CX},${CY}L${CX},${CY - R}A${R},${R} 0 1,0 ${CX + R},${CY}Z`;

const INK = "#1b1208";

// Earth at the true ratio: the Sun is 109 Earths across.
const EARTH_R = R / 109;
const INSET_ZOOM = 30;
const EARTH_AT = { x: 575, y: 452 };
const INSET_AT = { x: 690, y: 345 };
const PULSE_FROM = (() => {
  const dx = EARTH_AT.x - CX;
  const dy = EARTH_AT.y - CY;
  const d = Math.hypot(dx, dy);
  const r = R * 1.46;
  return { x: n(CX + (dx / d) * r), y: n(CY + (dy / d) * r) };
})();

const CORE_AT = { x: 650, y: 350 };

export function Stage({ chapter, title }: { chapter: ChapterId; title: string }) {
  const uid = useId();
  const wobble = `${uid}-wobble`;
  const glow = `${uid}-glow`;
  const corona = LAYERS.find((l) => l.id === "corona");

  return (
    <svg
      className="sun-svg"
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={`Cutaway of the Sun. Showing: ${title}`}
      data-chapter={chapter}
    >
      <defs>
        <filter id={wobble} x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="0.025" numOctaves="2" seed="4" result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="4" />
        </filter>
        <radialGradient id={glow} gradientUnits="userSpaceOnUse" cx={CX} cy={CY} r={n(R * 1.4)}>
          <stop offset={n(1.06 / 1.4)} stopColor={corona?.colour} stopOpacity="0.85" />
          <stop offset="1" stopColor={corona?.colour} stopOpacity="0" />
        </radialGradient>
      </defs>

      <rect className="sky" x="0" y="0" width={W} height={H} />

      {LAYERS.map((l, i) => {
        const ri = inner(l, i);
        const ro = outer(l);
        const fill = l.id === "corona" ? `url(#${glow})` : l.colour;
        return (
          <g key={l.id} className="layer" data-layer={l.id}>
            <g filter={`url(#${wobble})`}>
              {l.region === "interior" ? (
                <path d={quarter(ri, ro)} fill={fill} stroke={INK} strokeWidth="1.5" strokeLinejoin="round" />
              ) : (
                <>
                  {l.id === "photosphere" && <path d={SURFACE} fill={l.colour} stroke={INK} strokeWidth="1.5" />}
                  <path d={annulus(ri, ro)} fill={fill} fillRule="evenodd" stroke={l.id === "corona" ? "none" : INK} strokeWidth="1.5" />
                </>
              )}
            </g>
          </g>
        );
      })}

      <g className="legend" fontSize="17">
        {LAYERS.map((l, i) => (
          <g key={l.id} data-legend={l.id} transform={`translate(520 ${40 + i * 26})`}>
            <circle r="7" cx="7" cy="-5" fill={l.colour} stroke={INK} strokeWidth="1" />
            <text x="24" y="0">
              {l.name}
            </text>
          </g>
        ))}
        <text className="note" x="520" y="198" fontSize="14">
          <tspan x="520">A quarter cut away.</tspan>
          <tspan x="520" dy="18">Atmosphere drawn thicker</tspan>
          <tspan x="520" dy="18">than true scale.</tspan>
        </text>
      </g>

      {/* Scene: scale. Earth at the true ratio, an enlarged inset, a pulse of light. */}
      <g className="scene" data-scene="scale">
        <line className="path" x1={PULSE_FROM.x} y1={PULSE_FROM.y} x2={EARTH_AT.x} y2={EARTH_AT.y} />
        <circle className="earth" cx={EARTH_AT.x} cy={EARTH_AT.y} r={n(EARTH_R)} />
        <circle className="ring" cx={EARTH_AT.x} cy={EARTH_AT.y} r="9" />
        <line className="path" x1={EARTH_AT.x + 7} y1={EARTH_AT.y - 6} x2={INSET_AT.x - 33} y2={INSET_AT.y + 33} />
        <circle className="inset" cx={INSET_AT.x} cy={INSET_AT.y} r={n(EARTH_R * INSET_ZOOM)} />
        <path
          className="land"
          d={`M${INSET_AT.x - 22},${INSET_AT.y - 10}q10,-14 24,-8q8,10 -2,18q-14,6 -22,-10ZM${INSET_AT.x + 6},${INSET_AT.y + 14}q12,-6 18,4q-4,14 -16,10Z`}
        />
        <text x={INSET_AT.x} y={INSET_AT.y - 58} textAnchor="middle" fontSize="17">
          Earth, enlarged {INSET_ZOOM}×
        </text>
        <text x={EARTH_AT.x} y={EARTH_AT.y + 30} textAnchor="middle" fontSize="14">
          Earth, true size
        </text>
        <text x="260" y="486" textAnchor="middle" fontSize="14">
          The gap is shortened: Earth is really 215 Sun-radii away.
        </text>
        <circle
          className="pulse"
          cx={PULSE_FROM.x}
          cy={PULSE_FROM.y}
          r="6"
          style={{ "--dx": `${n(EARTH_AT.x - PULSE_FROM.x)}px`, "--dy": `${n(EARTH_AT.y - PULSE_FROM.y)}px` } as CSSProperties}
        />
      </g>

      {/* Scene: core. Four protons fuse into helium and a photon leaves. */}
      <g className="scene" data-scene="core">
        <line className="path" x1={CX + 22} y1={CY - 22} x2={CORE_AT.x - 64} y2={CORE_AT.y - 62} />
        <circle className="lens" cx={CORE_AT.x} cy={CORE_AT.y} r="88" />
        <text x={CORE_AT.x} y={CORE_AT.y + 118} textAnchor="middle" fontSize="17">
          Core, magnified
        </text>
        <circle className="helium" cx={CORE_AT.x} cy={CORE_AT.y} r="25" />
        <circle className="proton p1" cx={CORE_AT.x} cy={CORE_AT.y} r="11" />
        <circle className="proton p2" cx={CORE_AT.x} cy={CORE_AT.y} r="11" />
        <circle className="proton p3" cx={CORE_AT.x} cy={CORE_AT.y} r="11" />
        <circle className="proton p4" cx={CORE_AT.x} cy={CORE_AT.y} r="11" />
        <circle className="photon" cx={CORE_AT.x} cy={CORE_AT.y} r="6" />
      </g>
    </svg>
  );
}
