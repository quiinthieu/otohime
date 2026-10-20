import type { ReactNode } from "react";
import { inkCircle, inkPath, inkRect, type InkPath } from "../_lib/ink.ts";
import { LINES } from "../_lib/lines.ts";
import { litPath, moonPosition, phase } from "../_lib/moon.ts";
import { dateTickAngle, discPoint, discRotation, framePoint, hemisphereOf, hourTickAngle, horizon, horizonPoints, type Hemisphere, type Point } from "../_lib/sky.ts";
import { STARS } from "../_lib/stars.ts";
import { eclipticPoints, sunPosition } from "../_lib/sun.ts";
import { localToUtc, lstHours } from "../_lib/time.ts";
import { placeName, type State } from "../_lib/wheel.ts";

// The star wheel as server-drawn SVG: a fixed frame with an oval window (the
// horizon) and an hour ring, over a disc of stars that one rotate() turns.
// Ink (rough.js, seed 203) draws only the frame, the rims and the compass
// marks; the stars, lines, ecliptic and markers are plain SVG. Everything
// takes its colour from planisphere.css, so it reads on cream and in the dark.

export const VIEW = { w: 720, h: 760 };
const CX = VIEW.w / 2;
const CY = 380;
/** radius of the star disc: the farthest star that ever rises sits on it */
const R = 250;
const RIM = 24;
const RING_IN = R + RIM + 6;
const RING_OUT = RING_IN + 36;
const NAME_MAG = 2.1;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const COMPASS = [
  { letter: "N", index: 0 },
  { letter: "E", index: 18 },
  { letter: "S", index: 36 },
  { letter: "W", index: 54 },
] as const;

const r1 = (n: number) => String(Number(n.toFixed(1)) + 0);
const pad2 = (n: number) => String(n).padStart(2, "0");
const RAD = Math.PI / 180;

export function clock(hour: number): string {
  const minutes = Math.round(hour * 60);
  return `${pad2(Math.floor(minutes / 60) % 24)}:${pad2(minutes % 60)}`;
}

function Ink({ paths }: { paths: InkPath[] }) {
  return paths.map((p, i) => (
    <path key={i} d={p.d} fill="none" stroke={p.stroke} strokeWidth={p.strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
  ));
}

/** A point on the rim of the disc (radius r) at a right ascension, unturned. */
function rimPoint(ra: number, r: number, hemisphere: Hemisphere): Point {
  const a = ra * RAD;
  return { x: -r * Math.sin(a), y: (hemisphere === "north" ? 1 : -1) * r * Math.cos(a) };
}

const pointText = (pts: Point[]) => pts.map((p) => `${r1(p.x)},${r1(p.y)}`).join(" ");

/** Runs of consecutive points the disc can hold; a polyline breaks where a point never rises here. */
function runs<T>(items: readonly T[], at: (item: T) => Point | null): Point[][] {
  const out: Point[][] = [];
  let run: Point[] = [];
  for (const item of items) {
    const p = at(item);
    if (p) run.push(p);
    else {
      if (run.length > 1) out.push(run);
      run = [];
    }
  }
  if (run.length > 1) out.push(run);
  return out;
}

export function Wheel({ state, daylight }: { state: State; daylight: boolean }) {
  const { place } = state;
  const hemisphere = hemisphereOf(place.lat);
  const ms = localToUtc(state.date, state.hour, place.tz);
  const rotation = discRotation(lstHours(ms, place.lon), hemisphere);
  const name = placeName(state);
  const year = Number(state.date.slice(0, 4));
  const window = horizon(place.lat, R);
  const rim = horizonPoints(place.lat, R);
  const cx = rim.reduce((s, p) => s + p.x, 0) / rim.length;
  const cy = rim.reduce((s, p) => s + p.y, 0) / rim.length;

  const stars = STARS.flatMap((s) => {
    const p = discPoint(s[1], s[2], place.lat, R);
    return p ? [{ s, p }] : [];
  });
  const lines = LINES.flatMap((c) => c.segments.flatMap((seg) => runs(seg, (pt) => discPoint(pt[0], pt[1], place.lat, R)).map((pts) => ({ id: c.id, rank: c.rank, pts }))));
  const loop = eclipticPoints(72);
  const ecliptic = runs([...loop, loop[0]], (e) => discPoint(e.ra, e.dec, place.lat, R));

  const sun = sunPosition(ms);
  const sunAt = discPoint(sun.ra, sun.dec, place.lat, R);
  const moon = moonPosition(ms);
  const moonAt = discPoint(moon.ra, moon.dec, place.lat, R);
  const moonPhase = phase(ms);

  const marks = MONTHS.map((m, i) => {
    const first = `${year}-${pad2(i + 1)}-01`;
    const mid = `${year}-${pad2(i + 1)}-16`;
    return { m, tick: dateTickAngle(first, place.tz), mid: dateTickAngle(mid, place.tz) };
  });
  const todayRa = dateTickAngle(state.date, place.tz);

  const hours = Array.from({ length: 24 }, (_, h) => ({ h, angle: hourTickAngle(h, place, state.date) }));
  const hourNow = hourTickAngle(state.hour, place, state.date);

  const frame = inkRect(8, 8, VIEW.w - 16, VIEW.h - 16, { seed: "frame", strokeWidth: 2.6 });
  const ringOuter = inkCircle(0, 0, RING_OUT, { seed: "ring-out", strokeWidth: 2, roughness: 0.8 });
  const ringInner = inkCircle(0, 0, RING_IN, { seed: "ring-in", strokeWidth: 1.6, roughness: 0.8 });
  const rimOuter = inkCircle(0, 0, R + RIM, { seed: "rim-out", strokeWidth: 1.6, roughness: 0.8 });
  const windowRim = inkPath(window, { seed: "window", strokeWidth: 2.4, roughness: 1 });

  const compass: ReactNode[] = COMPASS.map(({ letter, index }) => {
    const p = rim[index];
    const dx = cx - p.x;
    const dy = cy - p.y;
    const d = Math.hypot(dx, dy) || 1;
    const x = p.x + (dx / d) * 15;
    const y = p.y + (dy / d) * 15;
    return (
      <g key={letter} transform={`translate(${r1(x)} ${r1(y)})`}>
        <g className="ink">
          <Ink paths={inkCircle(0, 0, 11, { seed: `compass-${letter}`, strokeWidth: 1.4, roughness: 0.8 })} />
        </g>
        <text data-compass={letter} className="compass" textAnchor="middle" dominantBaseline="central">
          {letter}
        </text>
      </g>
    );
  });

  const coords = `${r1(Math.abs(place.lat))}° ${place.lat >= 0 ? "N" : "S"}, ${r1(Math.abs(place.lon))}° ${place.lon >= 0 ? "E" : "W"}`;
  const when = `${state.date} ${clock(state.hour)}`;

  return (
    <svg
      className="wheel"
      viewBox={`0 0 ${VIEW.w} ${VIEW.h}`}
      role="group"
      aria-labelledby="wheel-title wheel-desc"
      data-hemisphere={hemisphere}
      {...(daylight ? { "data-daylight": "" } : {})}
    >
      <title id="wheel-title">{`Star wheel for ${name}, ${when}`}</title>
      <desc id="wheel-desc">
        {`A planisphere for ${name} (${coords}) on ${state.date} at ${clock(state.hour)} local time. The oval window is the horizon: the stars shown in it are above the horizon at that moment, with the ${hemisphere === "north" ? "north" : "south"} celestial pole at the centre of the disc. ${daylight ? "The Sun is up, so the window is pale." : "The Sun is down."}`}
      </desc>
      <defs>
        <clipPath id="window-clip">
          <path d={window} />
        </clipPath>
      </defs>
      <rect className="frame-paper" x="8" y="8" width={VIEW.w - 16} height={VIEW.h - 16} />
      <g className="ink">
        <Ink paths={frame} />
      </g>

      <g transform={`translate(${CX} ${CY})`}>
        {/* the disc's rim: the date scale, turning with the stars */}
        <g data-rim="" transform={`rotate(${r1(rotation)})`} aria-hidden="true">
          <circle className="rim-paper" r={R + RIM} />
          {marks.map(({ m, tick, mid }) => {
            const a = rimPoint(tick, R, hemisphere);
            const b = rimPoint(tick, R + 10, hemisphere);
            const t = rimPoint(mid, R + 17, hemisphere);
            const turn = (Math.atan2(t.y, t.x) / RAD + 90).toFixed(1);
            return (
              <g key={m}>
                <line className="tick" x1={r1(a.x)} y1={r1(a.y)} x2={r1(b.x)} y2={r1(b.y)} />
                <text className="month" transform={`translate(${r1(t.x)} ${r1(t.y)}) rotate(${turn})`} textAnchor="middle" dominantBaseline="central">
                  {m}
                </text>
              </g>
            );
          })}
          {(() => {
            const p = rimPoint(todayRa, R + 3, hemisphere);
            return <circle className="date-mark" cx={r1(p.x)} cy={r1(p.y)} r="4" data-date-mark="" />;
          })()}
        </g>
        <g className="ink" aria-hidden="true">
          <Ink paths={rimOuter} />
        </g>

        <circle className="frame-face" r={R} />
        <path className="window-fill" d={window} />

        <g clipPath="url(#window-clip)">
          <g
            data-disc=""
            role="slider"
            tabIndex={0}
            aria-label="Hour"
            aria-valuemin={0}
            aria-valuemax={23.75}
            aria-valuenow={state.hour}
            aria-valuetext={clock(state.hour)}
            transform={`rotate(${r1(rotation)})`}
          >
            <circle className="disc-hit" r={R + RIM} />
            <g aria-hidden="true" className="ecliptic-layer">
              {ecliptic.map((pts, i) => (
                <polyline key={i} data-ecliptic="" points={pointText(pts)} />
              ))}
            </g>
            <g aria-hidden="true" className="line-layer">
              {lines.map((l, i) => (
                <polyline key={i} data-line="" className={`rank-${l.rank}`} points={pointText(l.pts)} />
              ))}
            </g>
            <g aria-hidden="true" className="star-layer">
              {stars.map(({ s, p }) => (
                <circle key={s[0]} data-star="" cx={r1(p.x)} cy={r1(p.y)} r={r1(1.2 + 0.7 * (4.5 - s[3]))} />
              ))}
            </g>
            <g aria-hidden="true" className="name-layer">
              {stars
                .filter(({ s }) => s[4] && s[3] <= NAME_MAG)
                .map(({ s, p }) => (
                  <text key={s[0]} data-name="" x={r1(p.x + 7)} y={r1(p.y - 5)}>
                    {s[4]}
                  </text>
                ))}
            </g>
            <g aria-hidden="true">
              {/* always drawn: the island moves them, and one may rise into the disc on another date */}
              <g data-sun="" transform={`translate(${r1(sunAt?.x ?? 0)} ${r1(sunAt?.y ?? 0)})`} visibility={sunAt ? undefined : "hidden"}>
                <circle className="sun" r="8" />
                <circle className="sun-halo" r="13" />
              </g>
              <g data-moon="" transform={`translate(${r1(moonAt?.x ?? 0)} ${r1(moonAt?.y ?? 0)})`} visibility={moonAt ? undefined : "hidden"}>
                <circle className="moon-dark" r="9" />
                <path className="moon-lit" d={litPath(moonPhase, 9)} />
                <circle className="moon-rim" r="9" />
              </g>
            </g>
          </g>
        </g>

        <g className="ink" aria-hidden="true">
          <Ink paths={windowRim} />
        </g>
        <g>{compass}</g>
      </g>

      {/* the hour ring: fixed to the frame, read against the date scale */}
      <g transform={`translate(${CX} ${CY})`}>
        <path className="ring-paper" fillRule="evenodd" d={`M${RING_OUT} 0A${RING_OUT} ${RING_OUT} 0 1 0 ${-RING_OUT} 0A${RING_OUT} ${RING_OUT} 0 1 0 ${RING_OUT} 0ZM${RING_IN} 0A${RING_IN} ${RING_IN} 0 1 0 ${-RING_IN} 0A${RING_IN} ${RING_IN} 0 1 0 ${RING_IN} 0Z`} />
        <g className="ink" aria-hidden="true">
          <Ink paths={ringOuter} />
          <Ink paths={ringInner} />
        </g>
        <g aria-hidden="true">
          {hours.map(({ h, angle }) => {
            const a = framePoint(angle, RING_IN, hemisphere);
            const b = framePoint(angle, RING_IN + 8, hemisphere);
            const t = framePoint(angle, RING_IN + 20, hemisphere);
            return (
              <g key={h}>
                <line className="tick" x1={r1(a.x)} y1={r1(a.y)} x2={r1(b.x)} y2={r1(b.y)} />
                <text className="hour" x={r1(t.x)} y={r1(t.y)} textAnchor="middle" dominantBaseline="central">
                  {h}
                </text>
              </g>
            );
          })}
          {(() => {
            const a = framePoint(hourNow, RING_IN - 2, hemisphere);
            const b = framePoint(hourNow, RING_OUT, hemisphere);
            return <line className="hour-mark" data-hour-mark="" x1={r1(a.x)} y1={r1(a.y)} x2={r1(b.x)} y2={r1(b.y)} />;
          })()}
        </g>
      </g>

      <text className="caption" x={CX} y="42" textAnchor="middle">
        {`${name} · ${coords}`}
      </text>
      <text className="caption soft" x={CX} y={VIEW.h - 26} textAnchor="middle">
        {`${when} · ${place.tz}`}
      </text>
    </svg>
  );
}
