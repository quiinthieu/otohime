import type { CSSProperties } from "react";
import { inkCircle, inkLine, inkPath, type InkOptions } from "../_lib/ink.ts";
import { EARTH_LABEL } from "../_lib/poster.ts";
import { LAYERS, type LayerId } from "../_lib/sun.ts";
import { Ink } from "./ink";

// The cutaway, inked on the server with rough.js (ink.ts, fixed seeds), so the
// page ships no script for it. A quarter is cut away (upper right, facing the
// callouts) to show the three interior layers at their real fractions of R;
// the atmosphere is drawn far thicker than true scale. Earth is at the true
// ratio: 1/109 of the Sun's width. No filter, image or canvas: only paths.
// Motion is sun.css's: every <path> carries pathLength="1" to be drawn on, and
// the three data-loop groups below are drawn in their resting pose, so the
// still (reduced motion, or no CSS at all) is the complete poster.

const W = 640;
const H = 600;
const CX = 270;
const CY = 290;
const R = 180;

const n = (x: number) => +x.toFixed(2);

// Drawn radii of the atmosphere, in R; the interior uses LAYERS' own fractions.
const ATMOSPHERE: Partial<Record<LayerId, [number, number]>> = {
  chromosphere: [1, 1.07],
  corona: [1.07, 1.3],
};

// One pen per layer: a colour, a hachure angle and a gap.
const PEN: Record<LayerId, { colour: string; angle: number; gap: number }> = {
  core: { colour: "#f4b400", angle: 0, gap: 4.5 },
  radiative: { colour: "#f59f2a", angle: 60, gap: 6.5 },
  convective: { colour: "#e0672c", angle: -30, gap: 6 },
  photosphere: { colour: "#f2b33d", angle: -41, gap: 7.5 },
  chromosphere: { colour: "#d6453d", angle: 90, gap: 4.5 },
  corona: { colour: "#e9a23b", angle: 20, gap: 9 },
};

// Where each number badge sits: degrees clockwise from 12 o'clock, radius in R.
const BADGE_AT: Record<LayerId, [number, number]> = {
  core: [45, 0.12],
  radiative: [45, 0.48],
  convective: [45, 0.86],
  photosphere: [215, 0.55],
  chromosphere: [250, 1.035],
  corona: [302, 1.2],
};

const at = (deg: number, r: number) => {
  const a = (deg * Math.PI) / 180;
  return { x: n(CX + r * Math.sin(a)), y: n(CY - r * Math.cos(a)) };
};

const circle = (r: number) =>
  `M${n(CX - r)},${CY}a${n(r)},${n(r)} 0 1,0 ${n(2 * r)},0a${n(r)},${n(r)} 0 1,0 ${n(-2 * r)},0Z`;
const ring = (ri: number, ro: number) => circle(ro) + circle(ri);

// The cut-away quarter of a shell: from 12 o'clock to 3 o'clock.
function quarter(ri: number, ro: number): string {
  const back = ri > 0 ? `A${n(ri)},${n(ri)} 0 0,0 ${CX},${n(CY - ri)}` : `L${CX},${CY}`;
  return `M${CX},${n(CY - ro)}A${n(ro)},${n(ro)} 0 0,1 ${n(CX + ro)},${CY}L${n(CX + ri)},${CY}${back}Z`;
}

// The other three quarters of the disc: the surface we see.
const SURFACE = `M${CX},${CY}L${CX},${CY - R}A${R},${R} 0 1,0 ${CX + R},${CY}Z`;

function shape(id: LayerId, from: number, to: number): string {
  if (id === "photosphere") return SURFACE;
  const shell = ATMOSPHERE[id];
  return shell ? ring(shell[0] * R, shell[1] * R) : quarter(from * R, to * R);
}

function hatch(id: LayerId, d: string) {
  const pen = PEN[id];
  const o: InkOptions = { seed: id, fill: pen.colour, fillStyle: "hachure", hachureAngle: pen.angle, hachureGap: pen.gap };
  return inkPath(d, o);
}

// Extra marks: two sunspots on the surface, rays off the corona.
const SPOTS = [
  { x: 150, y: 318, r: 9 },
  { x: 176, y: 342, r: 5.5 },
];
const RAYS = [10, 100, 128, 156, 184, 212, 240, 268, 296, 324, 352].map((deg, i) => ({
  deg,
  from: 1.33,
  to: 1.33 + [0.1, 0.06, 0.12, 0.07][i % 4],
}));

function extras(id: LayerId) {
  if (id === "photosphere") {
    return SPOTS.flatMap((s, i) => inkCircle(s.x, s.y, s.r, { seed: `spot-${i}`, fill: "#5a3a2a", fillStyle: "solid", strokeWidth: 1.6 }));
  }
  if (id === "corona") {
    return RAYS.flatMap((ray) => {
      const a = at(ray.deg, ray.from * R);
      const b = at(ray.deg, ray.to * R);
      return inkLine(a.x, a.y, b.x, b.y, { seed: `ray-${ray.deg}`, stroke: PEN.corona.colour, strokeWidth: 2.4 });
    });
  }
  return [];
}

// Loop 1, convection: two rolling cells in the convection band of the cut,
// either side of the number badge, turning opposite ways as real cells do.
// Each is a 290° arrow round its own centre; sun.css spins it about that centre.
const CELLS = [
  { deg: 17, cw: true },
  { deg: 73, cw: false },
].map((c) => ({ ...at(c.deg, 0.85 * R), cw: c.cw }));

function cycle(cx: number, cy: number, r: number, cw: boolean, seed: string) {
  const sweep = ((cw ? 290 : -290) * Math.PI) / 180;
  const t0 = -Math.PI / 2; // from 12 o'clock on the cell
  const t1 = t0 + sweep;
  const p = (t: number, rr = r) => ({ x: n(cx + rr * Math.cos(t)), y: n(cy + rr * Math.sin(t)) });
  const a = p(t0);
  const b = p(t1);
  const arc = `M${a.x},${a.y}A${r},${r} 0 1,${cw ? 1 : 0} ${b.x},${b.y}`;
  // the arrowhead: two strokes back along the arc, one either side of it
  const back = t1 - (cw ? 0.55 : -0.55);
  const head = [p(back, r + 5), p(back, r - 5)];
  return [
    ...inkPath(arc, { seed, strokeWidth: 2, roughness: 1 }),
    ...head.flatMap((h, i) => inkLine(b.x, b.y, h.x, h.y, { seed: `${seed}-head-${i}`, strokeWidth: 2, roughness: 0.8 })),
  ];
}

// Loop 2, photon: a random walk out through the radiative zone, from the
// core's edge to the convection zone's, clear of badge 2. A dot walks it.
const PHOTON_DEG = 68;
const ZIGZAG = (() => {
  const a = (PHOTON_DEG * Math.PI) / 180;
  const out = { x: Math.sin(a), y: -Math.cos(a) };
  const side = { x: Math.cos(a), y: Math.sin(a) };
  const swing = [0, 8, -7, 9, -8, 6, -9, 7, 0];
  const pts = swing.map((s, i) => {
    const r = 0.27 * R + (i * (0.69 - 0.27) * R) / (swing.length - 1);
    return `${n(CX + r * out.x + s * side.x)},${n(CY + r * out.y + s * side.y)}`;
  });
  return `M${pts.join("L")}`;
})();
const PHOTON_INK = inkPath(ZIGZAG, { seed: "photon", strokeWidth: 1.6, roughness: 0.8 });
// The dot rides the first of rough.js's two strokes. A 0.01 dash in a 1.01
// pattern on a pathLength of 1 shows one round-capped dot; its offset says where.
const PHOTON_TRACK = PHOTON_INK[0].d.split(/(?=M)/)[0].trim();
const PHOTON_REST = -0.6;

// Loop 3, wind: four streams of dashes leaving the corona on the cut side,
// toward the callouts. Each stream slides outward and fades; at rest the dashes
// sit mid-stream.
const WIND = [30, 48, 66, 84].map((deg, i) => {
  const a = (deg * Math.PI) / 180;
  const start = 1.36 + [0, 0.05, 0.02, 0.07][i];
  const dashes = [0, 1, 2].flatMap((k) => {
    const p = at(deg, (start + k * 0.13) * R);
    const q = at(deg, (start + k * 0.13 + 0.07) * R);
    return inkLine(p.x, p.y, q.x, q.y, { seed: `wind-${deg}-${k}`, stroke: PEN.corona.colour, strokeWidth: 2.4, roughness: 0.9 });
  });
  const step = 0.2 * R;
  const style = { "--i": i, "--wx": `${n(step * Math.sin(a))}px`, "--wy": `${n(-step * Math.cos(a))}px` } as CSSProperties;
  return { deg, dashes, style };
});

// Earth at the true ratio, bottom right, ringed so the eye can find it.
const EARTH = { x: 584, y: 520, r: n(R / 109) };
const EARTH_RING = inkCircle(EARTH.x, EARTH.y, 11, { seed: "earth-ring", strokeWidth: 1.6, roughness: 1 });
const EARTH_LEAD = inkLine(EARTH.x - 4, EARTH.y + 15, EARTH.x - 14, EARTH.y + 34, { seed: "earth-lead", strokeWidth: 1.6 });

const LABEL = `Cutaway of the Sun with a quarter removed, six layers numbered from the centre: ${LAYERS.map(
  (l, i) => `${i + 1} ${l.name.toLowerCase()}`,
).join(", ")}; Earth drawn beside it to scale, a dot 1/109 of the Sun's width.`;

export function Stage() {
  return (
    <svg className="sun-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={LABEL}>
      {LAYERS.map((l, i) => {
        const d = shape(l.id, l.from, l.to);
        const [deg, r] = BADGE_AT[l.id];
        const pin = at(deg, r * R);
        // rough.js returns the fill strokes first and the outline last
        const hachure = hatch(l.id, d);
        return (
          <g key={l.id} data-layer={l.id}>
            <path className="wash" d={d} pathLength="1" fill={PEN[l.id].colour} fillRule="evenodd" />
            <g className="hachure">
              <Ink paths={hachure.slice(0, -1)} />
            </g>
            <Ink paths={hachure.slice(-1)} />
            <Ink paths={extras(l.id)} />
            <g className="pin">
              <Ink paths={inkCircle(pin.x, pin.y, 15, { seed: `pin-${l.id}`, fill: "#fffaf0", fillStyle: "solid", strokeWidth: 1.8, roughness: 1 })} />
              <text x={pin.x} y={pin.y + 8} textAnchor="middle">
                {i + 1}
              </text>
            </g>
          </g>
        );
      })}

      <g data-loop="convection">
        {CELLS.map((c, i) => (
          <g key={i} className={c.cw ? "cell" : "cell ccw"} style={{ transformOrigin: `${c.x}px ${c.y}px` }}>
            <Ink paths={cycle(c.x, c.y, 16, c.cw, `cell-${i}`)} />
          </g>
        ))}
      </g>

      <g data-loop="photon">
        <Ink paths={PHOTON_INK} />
        <g className="walker" strokeDasharray="0.01 1" strokeDashoffset={PHOTON_REST} strokeLinecap="round" fill="none">
          <path d={PHOTON_TRACK} pathLength="1" stroke="#3a2a28" strokeWidth="11" />
          <path d={PHOTON_TRACK} pathLength="1" stroke="#fff6c9" strokeWidth="7" />
        </g>
      </g>

      <g data-loop="wind">
        {WIND.map((w) => (
          <g key={w.deg} className="stream" style={w.style}>
            <Ink paths={w.dashes} />
          </g>
        ))}
      </g>

      <g className="earth">
        <circle cx={EARTH.x} cy={EARTH.y} r={EARTH.r} fill="#2f6fd0" />
        <Ink paths={EARTH_RING} />
        <Ink paths={EARTH_LEAD} />
        <text x={EARTH.x + 40} y={EARTH.y + 58} textAnchor="end">
          {EARTH_LABEL}
        </text>
      </g>
    </svg>
  );
}
