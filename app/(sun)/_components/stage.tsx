import { inkCircle, inkLine, inkPath, type InkOptions } from "../_lib/ink.ts";
import { EARTH_LABEL } from "../_lib/poster.ts";
import { LAYERS, type LayerId } from "../_lib/sun.ts";
import { Ink } from "./ink";

// The cutaway, inked on the server with rough.js (ink.ts, fixed seeds), so the
// page ships no script for it. A quarter is cut away (upper right, facing the
// callouts) to show the three interior layers at their real fractions of R;
// the atmosphere is drawn far thicker than true scale. Earth is at the true
// ratio: 1/109 of the Sun's width. No filter, image or canvas: only paths.

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
        return (
          <g key={l.id} data-layer={l.id}>
            <path className="wash" d={d} pathLength="1" fill={PEN[l.id].colour} fillRule="evenodd" />
            <Ink paths={hatch(l.id, d)} />
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
