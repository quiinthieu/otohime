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

const rad = (deg: number) => (deg * Math.PI) / 180;
// A point on a circle round the Sun, turned so that "up" in its group points away from the Sun.
const radial = (deg: number, r: number) =>
  `translate(${n(CX + r * Math.sin(rad(deg)))} ${n(CY - r * Math.cos(rad(deg)))}) rotate(${deg})`;
const delay = (s: number) => ({ "--d": `${n(s)}s` }) as CSSProperties;

// radiative: a dot field in the lens and the photon's zig-zag through it
const ZIG = [[-52, 42], [-22, 22], [-38, 0], [-4, -12], [-20, -38], [18, -28], [14, -50], [46, -64]].map(([x, y]) => ({
  x: CORE_AT.x + x,
  y: CORE_AT.y + y,
}));
const SPECKS = (() => {
  const out: { x: number; y: number }[] = [];
  for (let iy = -5; iy <= 5; iy++) {
    for (let ix = -5; ix <= 5; ix++) {
      const x = ix * 15 + (iy % 2 ? 7 : 0) + (((ix * 7 + iy * 13) % 5) - 2);
      const y = iy * 15 + (((ix * 11 + iy * 3) % 5) - 2);
      if (Math.hypot(x, y) < 76) out.push({ x: CORE_AT.x + x, y: CORE_AT.y + y });
    }
  }
  return out;
})();

// convective: four cells in a box, neighbours turning opposite ways
const BOX = { x: 565, y: 295, w: 170, h: 110 };
const CELLS = [0, 1, 2, 3].map((i) => ({ cx: BOX.x + (BOX.w / 4) * (i + 0.5), cy: BOX.y + BOX.h / 2, sign: i % 2 ? -1 : 1 }));

// photosphere: granules over the visible three quarters of the disc, two sunspots on the lower half
const GRANULES = (() => {
  const out: { x: number; y: number }[] = [];
  for (let iy = -5; iy <= 5; iy++) {
    for (let ix = -5; ix <= 5; ix++) {
      const x = CX + ix * 32 + (iy % 2 ? 16 : 0) + (((ix * 5 + iy * 9) % 7) - 3);
      const y = CY + iy * 28 + (((ix * 3 + iy * 7) % 7) - 3);
      const cutAway = x > CX - 8 && y < CY + 8;
      if (!cutAway && Math.hypot(x - CX, y - CY) < R - 14) out.push({ x: n(x), y: n(y) });
    }
  }
  return out;
})();

// chromosphere: spicules round the rim
const SPICULES = Array.from({ length: 24 }, (_, i) => ({ deg: i * 15, len: [22, 30, 16, 26, 20, 34][i % 6] }));

// corona
const STREAMERS = [
  { deg: 10, len: 62 }, { deg: 38, len: 48 }, { deg: 66, len: 66 }, { deg: 104, len: 52 }, { deg: 132, len: 60 },
  { deg: 160, len: 46 }, { deg: 196, len: 64 }, { deg: 224, len: 50 }, { deg: 312, len: 58 }, { deg: 342, len: 66 },
];
const TOWARD_EARTH = (() => {
  const dx = EARTH_AT.x - CX;
  const dy = EARTH_AT.y - CY;
  const d = Math.hypot(dx, dy);
  return { x: dx / d, y: dy / d };
})();
const WIND = [-60, -36, -12, 12].map((off) => {
  const along = (t: number) => ({
    x: n(CX + TOWARD_EARTH.x * t - TOWARD_EARTH.y * off),
    y: n(CY + TOWARD_EARTH.y * t + TOWARD_EARTH.x * off),
  });
  return { a: along(185), b: along(450) };
});
const CME_AT = { x: n(CX + TOWARD_EARTH.x * 165), y: n(CY + TOWARD_EARTH.y * 165) };

// life: three sizes of one star on a timeline
const LIFE_Y = 370;
const AXIS_Y = 470;
const AXIS = { birth: 450, sun: 530, giant: 650, dwarf: 745 };

export function Stage({ chapter, title }: { chapter: ChapterId; title: string }) {
  const uid = useId();
  const wobble = `${uid}-wobble`;
  const glow = `${uid}-glow`;
  const corona = LAYERS.find((l) => l.id === "corona");
  const warm = `${uid}-warm`;

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
        <linearGradient id={warm} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3b5b92" />
          <stop offset="1" stopColor="#e0702f" />
        </linearGradient>
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
      {/* Scene: radiative. A photon zig-zags through a dense field of dots. */}
      <g className="scene" data-scene="radiative">
        <line className="path" x1={CX + 54} y1={CY - 54} x2={CORE_AT.x - 62} y2={CORE_AT.y - 62} />
        <circle className="lens" cx={CORE_AT.x} cy={CORE_AT.y} r="88" />
        {SPECKS.map((p, i) => (
          <circle key={i} className="speck" cx={p.x} cy={p.y} r="2.2" />
        ))}
        <polyline className="walk" pathLength="1" points={ZIG.map((p) => `${p.x},${p.y}`).join(" ")} />
        <circle className="walker" cx={ZIG[0].x} cy={ZIG[0].y} r="5.5" />
        <text x={CORE_AT.x} y={CORE_AT.y + 118} textAnchor="middle" fontSize="17">
          Radiative zone, magnified
        </text>
      </g>

      {/* Scene: convective. Four cells roll: rise on the warm side, sink on the cool side. */}
      <g className="scene" data-scene="convective">
        <line className="path" x1={CX + 96} y1={CY - 96} x2={BOX.x} y2={BOX.y + 5} />
        <rect className="box" x={BOX.x} y={BOX.y} width={BOX.w} height={BOX.h} rx="10" fill={`url(#${warm})`} />
        {CELLS.map((c, i) => (
          <g key={i}>
            <ellipse className={`cell ${c.sign > 0 ? "cw" : "ccw"}`} cx={c.cx} cy={c.cy} rx="19" ry="25" />
            <path
              className="arrow"
              d={`M${n(c.cx - 5 * c.sign)},${c.cy - 30}L${n(c.cx + 6 * c.sign)},${c.cy - 25}L${n(c.cx - 5 * c.sign)},${c.cy - 20}ZM${n(c.cx + 5 * c.sign)},${c.cy + 20}L${n(c.cx - 6 * c.sign)},${c.cy + 25}L${n(c.cx + 5 * c.sign)},${c.cy + 30}Z`}
            />
          </g>
        ))}
        <text className="hint" x={BOX.x + BOX.w / 2} y={BOX.y + 14} textAnchor="middle" fontSize="13">
          cooler: sinks
        </text>
        <text className="hint" x={BOX.x + BOX.w / 2} y={BOX.y + BOX.h - 6} textAnchor="middle" fontSize="13">
          hotter: rises
        </text>
        <text x={BOX.x + BOX.w / 2} y={BOX.y + BOX.h + 30} textAnchor="middle" fontSize="17">
          Convection cells, magnified
        </text>
      </g>

      {/* Scene: photosphere. Granules shimmer; the equator sunspot overtakes the high-latitude one. */}
      <g className="scene" data-scene="photosphere">
        {GRANULES.map((g, i) => (
          <circle key={i} className="granule" cx={g.x} cy={g.y} r="7" style={delay(-(i % 7) * 0.45)} />
        ))}
        <g className="spot spot-eq">
          <circle className="penumbra" cx="130" cy="272" r="12" />
          <circle className="umbra" cx="130" cy="272" r="5.5" />
        </g>
        <g className="spot spot-hi">
          <circle className="penumbra" cx="170" cy="372" r="12" />
          <circle className="umbra" cx="170" cy="372" r="5.5" />
        </g>
        <text x="520" y="300" fontSize="17">
          <tspan x="520">Granules shimmer.</tspan>
          <tspan x="520" dy="24">Spots near the equator</tspan>
          <tspan x="520" dy="24">cross the disc faster</tspan>
          <tspan x="520" dy="24">than spots near the poles.</tspan>
        </text>
      </g>

      {/* Scene: chromosphere. Spicules jet up from the rim and fall back. */}
      <g className="scene" data-scene="chromosphere">
        <circle className="rim" cx={CX} cy={CY} r="165" />
        {SPICULES.map((sp, i) => (
          <g key={sp.deg} transform={radial(sp.deg, 164)}>
            <line className="spicule" x1="0" y1="0" x2="0" y2={-sp.len} style={delay(-(i * 0.37) % 2.4)} />
          </g>
        ))}
        <text x="520" y="300" fontSize="17">
          <tspan x="520">Spicules jet up from</tspan>
          <tspan x="520" dy="24">the rim and fall back.</tspan>
        </text>
      </g>

      {/* Scene: corona. Streamers, a prominence, a CME and the wind past Earth's bubble. */}
      <g className="scene" data-scene="corona">
        {STREAMERS.map((st, i) => (
          <g key={st.deg} transform={radial(st.deg, 164)}>
            <path className="streamer" d={`M-8,0L0,${-st.len}L8,0Z`} style={delay(-(i * 0.6) % 4)} />
          </g>
        ))}
        <g transform={radial(270, 156)}>
          <path className="glow" d="M-18,0C-22,-62 22,-62 18,0" />
          <path className="prominence" d="M-18,0C-22,-62 22,-62 18,0" />
        </g>
        <text x="24" y="214" fontSize="17">
          Prominence
        </text>
        {WIND.map((w, i) => (
          <line key={i} className="wind" x1={w.a.x} y1={w.a.y} x2={w.b.x} y2={w.b.y} />
        ))}
        <circle className="bubble" cx={EARTH_AT.x} cy={EARTH_AT.y} r="26" />
        <circle className="earth" cx={EARTH_AT.x} cy={EARTH_AT.y} r="3" />
        <g className="cme">
          <circle cx={CME_AT.x} cy={CME_AT.y} r="24" />
          <circle cx={CME_AT.x} cy={CME_AT.y} r="12" />
        </g>
        <text x="700" y="330" textAnchor="middle" fontSize="17">
          Solar wind
        </text>
        <text x="612" y="448" fontSize="14">
          <tspan x="612">Earth and its</tspan>
          <tspan x="612" dy="17">magnetic bubble</tspan>
        </text>
        <text x="380" y="448" fontSize="14">
          Coronal mass ejection
        </text>
      </g>

      {/* Scene: life. A timeline from birth: the Sun swells to a red giant and shrinks to a white dwarf. */}
      <g className="scene" data-scene="life">
        <line className="axis" x1={AXIS.birth} y1={AXIS_Y} x2="780" y2={AXIS_Y} />
        <path className="axis" d={`M772,${AXIS_Y - 6}L782,${AXIS_Y}L772,${AXIS_Y + 6}`} />
        {[AXIS.birth, AXIS.sun, AXIS.giant, AXIS.dwarf].map((x) => (
          <circle key={x} className="tick" cx={x} cy={AXIS_Y} r="3.5" />
        ))}
        <g className="stage-sun">
          <circle className="body-sun" cx={AXIS.sun} cy={LIFE_Y} r="22" />
          <text x={AXIS.sun} y="452" textAnchor="middle" fontSize="16">
            Today
          </text>
        </g>
        <g className="stage-giant">
          <circle className="body-giant" cx={AXIS.giant} cy={LIFE_Y} r="56" />
          <text x={AXIS.giant} y="452" textAnchor="middle" fontSize="16">
            Red giant
          </text>
        </g>
        <g className="stage-dwarf">
          <circle className="body-dwarf" cx={AXIS.dwarf} cy={LIFE_Y} r="6" />
          <text x={AXIS.dwarf} y="452" textAnchor="middle" fontSize="16">
            White dwarf
          </text>
        </g>
        <circle className="marker" cx={AXIS.birth} cy={AXIS_Y} r="7" />
        <text x={AXIS.birth} y="492" fontSize="14">
          Born 4.6 billion years ago
        </text>
        <text x="780" y="492" textAnchor="end" fontSize="14">
          later
        </text>
      </g>
    </svg>
  );
}
