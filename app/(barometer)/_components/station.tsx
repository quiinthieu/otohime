import type { City } from "../_lib/cities.ts";
import { cupLevel, DIAL_WORDS, mercuryHeight, needleAngle, QUIET, vaneAngle } from "../_lib/dial.ts";
import { inkCircle, inkLine, inkPath, inkRect, type InkPath } from "../_lib/ink.ts";
import { describe, type Reading } from "../_lib/reading.ts";

// The brass station, drawn on the server in rough.js ink. Every shape is made
// once per process from the constants below; only the needle, the mercury, the
// vane and the water move, by a transform or a height, so the ink never
// reaches the browser. Strokes take their colour from barometer.css (.ink on
// the wood, .dial-ink on the instruments), so the same drawing reads in light
// and in dark.

const VIEW = { w: 640, h: 400 };
const DIAL = { x: 200, y: 200, bezel: 172, face: 150 };
const TUBE = { x: 400, top: 62, bottom: 300, w: 16 };
const BULB = { x: 400, y: 322, r: 22 };
const VANE = { x: 524, y: 104, r: 62 };
const CUP = { x: 520, top: 262, bottom: 366, w: 84 };
const CUP_INNER = { top: CUP.top + 8, bottom: CUP.bottom - 6, w: CUP.w - 12 };

const polar = (r: number, deg: number) => {
  const a = (deg * Math.PI) / 180;
  return { x: DIAL.x + r * Math.sin(a), y: DIAL.y - r * Math.cos(a) };
};

function Ink({ paths, className = "ink" }: { paths: InkPath[]; className?: string }) {
  return (
    <g className={className}>
      {paths.map((p, i) => (
        <path key={i} d={p.d} fill="none" strokeWidth={p.strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      ))}
    </g>
  );
}

const BOARD = inkRect(8, 8, VIEW.w - 16, VIEW.h - 16, { seed: "board", strokeWidth: 2.8 });
const BEZEL = inkCircle(DIAL.x, DIAL.y, DIAL.bezel, { seed: "bezel", strokeWidth: 2.6 });
const RIM = inkCircle(DIAL.x, DIAL.y, DIAL.face, { seed: "face", strokeWidth: 1.8, roughness: 0.9 });
const TICKS = [950, 960, 970, 980, 990, 1000, 1010, 1020, 1030, 1040, 1050].map((hpa) => {
  const a = needleAngle(hpa);
  const major = hpa % 50 === 0;
  const from = polar(DIAL.face - (major ? 22 : 14), a);
  const to = polar(DIAL.face - 5, a);
  return { hpa, major, path: inkLine(from.x, from.y, to.x, to.y, { seed: `tick-${hpa}`, strokeWidth: major ? 2.4 : 1.5, roughness: 0.6 }) };
});
const WORDS = DIAL_WORDS.map((w) => ({ ...w, at: polar(92, needleAngle(w.hpa)) }));
const NUMBERS = [950, 1000, 1050].map((hpa) => ({ hpa, at: polar(DIAL.face - 34, needleAngle(hpa)) }));
// Pointing straight up; the transform turns it to the reading.
const NEEDLE_D = `M${DIAL.x - 5} ${DIAL.y} L${DIAL.x} ${DIAL.y - 128} L${DIAL.x + 5} ${DIAL.y} L${DIAL.x} ${DIAL.y + 26} Z`;
const NEEDLE = inkPath(NEEDLE_D, {
  seed: "needle",
  strokeWidth: 1.8,
  roughness: 0.6,
});
const SET_D = `M${DIAL.x - 6} ${DIAL.y} L${DIAL.x} ${DIAL.y - 100} L${DIAL.x + 6} ${DIAL.y} L${DIAL.x} ${DIAL.y + 14} Z`;
const SET_HAND = inkPath(SET_D, {
  seed: "set-hand",
  strokeWidth: 1.8,
  roughness: 0.6,
});
const HUB = inkCircle(DIAL.x, DIAL.y, 11, { seed: "hub", strokeWidth: 1.6, roughness: 0.6 });

const TUBE_INK = inkRect(TUBE.x - TUBE.w / 2, TUBE.top, TUBE.w, TUBE.bottom - TUBE.top, { seed: "tube", strokeWidth: 2, roughness: 0.8 });
const BULB_INK = inkCircle(BULB.x, BULB.y, BULB.r, { seed: "bulb", strokeWidth: 2, roughness: 0.8 });
const SCALE = [-20, -10, 0, 10, 20, 30, 40].map((c) => {
  const y = TUBE.bottom - mercuryHeight(c) * (TUBE.bottom - TUBE.top);
  return { c, y, path: inkLine(TUBE.x + TUBE.w / 2 + 4, y, TUBE.x + TUBE.w / 2 + (c % 20 === 0 ? 20 : 13), y, { seed: `scale-${c}`, strokeWidth: 1.4, roughness: 0.5 }) };
});

const VANE_RING = inkCircle(VANE.x, VANE.y, VANE.r, { seed: "vane-ring", strokeWidth: 1.6, roughness: 0.9 });
const COMPASS = [
  { letter: "N", dx: 0, dy: -1 },
  { letter: "E", dx: 1, dy: 0 },
  { letter: "S", dx: 0, dy: 1 },
  { letter: "W", dx: -1, dy: 0 },
].map((c) => ({ letter: c.letter, x: VANE.x + c.dx * (VANE.r + 14), y: VANE.y + c.dy * (VANE.r + 14) + 5 }));
// The arrow points at where the wind comes from; the tail carries the vane.
const ARROW_D = `M${VANE.x} ${VANE.y - 48} L${VANE.x + 9} ${VANE.y - 32} L${VANE.x + 3} ${VANE.y - 32} L${VANE.x + 3} ${VANE.y + 34} L${VANE.x + 12} ${VANE.y + 46} L${VANE.x - 12} ${VANE.y + 46} L${VANE.x - 3} ${VANE.y + 34} L${VANE.x - 3} ${VANE.y - 32} L${VANE.x - 9} ${VANE.y - 32} Z`;
const ARROW = inkPath(
  ARROW_D,
  { seed: "arrow", strokeWidth: 1.6, roughness: 0.6 },
);

const CUP_OUTLINE = `M${CUP.x - CUP.w / 2} ${CUP.top} L${CUP.x - CUP.w / 2 + 8} ${CUP.bottom} L${CUP.x + CUP.w / 2 - 8} ${CUP.bottom} L${CUP.x + CUP.w / 2} ${CUP.top}`;
const CUP_INK = inkPath(CUP_OUTLINE, { seed: "cup", strokeWidth: 2.2, roughness: 0.8 });
const CUP_RIM = inkLine(CUP.x - CUP.w / 2 - 4, CUP.top, CUP.x + CUP.w / 2 + 4, CUP.top, { seed: "cup-rim", strokeWidth: 2.2, roughness: 0.6 });
const CUP_MARKS = [0.25, 0.5, 0.75].map((f) => {
  const y = CUP_INNER.bottom - f * (CUP_INNER.bottom - CUP_INNER.top);
  return inkLine(CUP.x - CUP.w / 2 + 12, y, CUP.x - CUP.w / 2 + 26, y, { seed: `cup-mark-${f}`, strokeWidth: 1.2, roughness: 0.4 });
});

export function Station({ city, reading }: { city: City; reading: Reading | null }) {
  const angles = reading
    ? { needle: needleAngle(reading.pressureHpa), mercury: mercuryHeight(reading.temperatureC), vane: vaneAngle(reading.windFromDeg), cup: cupLevel(reading.rainMm) }
    : QUIET;
  const sentence = reading ? describe(city, reading) : "The station is quiet.";
  const column = angles.mercury * (TUBE.bottom - TUBE.top);
  const water = angles.cup * (CUP_INNER.bottom - CUP_INNER.top);
  const needle = angles.needle.toFixed(2);

  return (
    <svg
      className="station"
      viewBox={`0 0 ${VIEW.w} ${VIEW.h}`}
      role="img"
      aria-labelledby="station-title station-desc"
      data-face={reading ? "reading" : "quiet"}
    >
      <title id="station-title">{`Barometer: ${city.name}`}</title>
      <desc id="station-desc">{sentence}</desc>
      <rect className="wood" x={8} y={8} width={VIEW.w - 16} height={VIEW.h - 16} rx={6} />
      <Ink paths={BOARD} />

      <g className="dial">
        <circle className="dial-brass" cx={DIAL.x} cy={DIAL.y} r={DIAL.bezel} />
        <circle className="dial-face" cx={DIAL.x} cy={DIAL.y} r={DIAL.face} />
        <Ink paths={BEZEL} className="dial-ink" />
        <Ink paths={RIM} className="dial-ink" />
        {TICKS.map((t) => (
          <Ink key={t.hpa} paths={t.path} className="dial-ink" />
        ))}
        {NUMBERS.map((n) => (
          <text key={n.hpa} className="dial-number" x={n.at.x} y={n.at.y + 4} textAnchor="middle">
            {n.hpa}
          </text>
        ))}
        {WORDS.map((w) => (
          <text key={w.word} className="dial-word" x={w.at.x} y={w.at.y + 5} textAnchor="middle">
            {w.word}
          </text>
        ))}
        <text className="dial-unit" x={DIAL.x} y={DIAL.y + 62} textAnchor="middle">
          hPa
        </text>
        <g className="set-hand" data-set-hand="">
          <path className="hand-fill" d={SET_D} />
          <Ink paths={SET_HAND} className="dial-ink" />
        </g>
        <g className="needle" data-needle={needle} style={{ transform: `rotate(${needle}deg)` }}>
          <path className="needle-fill" d={NEEDLE_D} />
          <Ink paths={NEEDLE} className="dial-ink" />
        </g>
        <circle className="dial-brass" cx={DIAL.x} cy={DIAL.y} r={11} />
        <Ink paths={HUB} className="dial-ink" />
      </g>

      <g className="thermometer">
        <rect className="glass" x={TUBE.x - TUBE.w / 2} y={TUBE.top} width={TUBE.w} height={TUBE.bottom - TUBE.top} rx={8} />
        <circle className="mercury" cx={BULB.x} cy={BULB.y} r={BULB.r - 4} />
        <rect className="mercury" data-mercury={angles.mercury.toFixed(4)} x={TUBE.x - 4} y={TUBE.bottom - column} width={8} height={column + 6} />
        <Ink paths={TUBE_INK} className="dial-ink" />
        <Ink paths={BULB_INK} className="dial-ink" />
        {SCALE.map((s) => (
          <g key={s.c}>
            <Ink paths={s.path} className="on-wood-ink" />
            {s.c % 20 === 0 && (
              <text className="scale-number" x={TUBE.x + TUBE.w / 2 + 24} y={s.y + 4}>
                {s.c}
              </text>
            )}
          </g>
        ))}
        <text className="unit" x={TUBE.x} y={TUBE.top - 12} textAnchor="middle">
          °C
        </text>
      </g>

      <g className="vane">
        <circle className="vane-face" cx={VANE.x} cy={VANE.y} r={VANE.r} />
        <Ink paths={VANE_RING} className="dial-ink" />
        {COMPASS.map((c) => (
          <text key={c.letter} className="compass" x={c.x} y={c.y} textAnchor="middle">
            {c.letter}
          </text>
        ))}
        <g className="arrow" data-vane={angles.vane.toFixed(1)} style={{ transform: `rotate(${angles.vane}deg)` }}>
          <path
            className="hand-fill"
            d={ARROW_D}
          />
          <Ink paths={ARROW} className="dial-ink" />
        </g>
      </g>

      <g className="cup">
        <path className="tin" d={`${CUP_OUTLINE} Z`} />
        <rect className="water" data-cup={angles.cup.toFixed(3)} x={CUP.x - CUP_INNER.w / 2} y={CUP_INNER.bottom - water} width={CUP_INNER.w} height={water} />
        <Ink paths={CUP_INK} className="dial-ink" />
        <Ink paths={CUP_RIM} className="dial-ink" />
        {CUP_MARKS.map((m, i) => (
          <Ink key={i} paths={m} className="dial-ink" />
        ))}
        <text className="unit" x={CUP.x} y={CUP.bottom + 22} textAnchor="middle">
          rain, mm
        </text>
      </g>

      {!reading && (
        <text className="quiet-note" x={VIEW.w / 2} y={VIEW.h - 22} textAnchor="middle">
          The station is quiet.
        </text>
      )}
    </svg>
  );
}
