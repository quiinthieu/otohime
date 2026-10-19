"use client";

import { useId, type Ref } from "react";
import type { Tonearm } from "../_lib/deck.ts";
import { PLATTER, TONEARM_PIVOT, TURNTABLE_VIEW } from "../_lib/geometry.ts";
import { labelArt, type Rpm, type VinylRecord } from "../_lib/records.ts";

// The turntable, one SVG in geometry's 500 × 400 view: plinth, platter with
// its strobe dots, the record and its label, spindle, power LED, playing lamp
// and the tonearm. The rAF loop in vinyl-app.tsx turns the platter through
// platterRef (a transform, never a re-render); the arm's angle is CSS, keyed
// by deck.tonearm(). The cell clips everything (overflow: hidden), so the arm
// can never reach the monitor.

const { cx, cy, r: R } = PLATTER;
const { x: PX, y: PY } = TONEARM_PIVOT;
const ARM = 290; // pivot to stylus; at the "down" angle the stylus sits in the grooves
const GROOVES = Array.from({ length: 16 }, (_, i) => 72 + i * 6);
const STROBE = Array.from({ length: 72 }, (_, i) => (i * 360) / 72);
const LABEL_R = 58;

const ARM_WORDS: Record<Tonearm, string> = {
  rest: "the tonearm is at rest",
  hover: "the tonearm hovers over the record",
  down: "the needle is on the record",
  lifted: "the tonearm is lifted",
};

export function Turntable({
  record,
  arm,
  rpm,
  playing,
  onRpm,
  platterRef,
}: {
  record: VinylRecord | null;
  arm: Tonearm;
  rpm: Rpm | null;
  playing: boolean;
  onRpm: (rpm: Rpm) => void;
  platterRef: Ref<SVGGElement>;
}) {
  const id = useId();
  const arc = `${id}-arc`;
  const wood = `${id}-wood`;
  const art = record ? labelArt(record) : null;
  const description = record
    ? `Turntable: ${record.title} by ${record.artist} on the platter at ${rpm} rpm; ${ARM_WORDS[arm]}.`
    : "Turntable: the platter is empty.";

  // The title is set on a circle around the label, starting where labelArt says.
  const a0 = art ? (art.arc.start * Math.PI) / 180 : 0;
  const tr = LABEL_R - 14;
  const arcPath = `M ${cx + tr * Math.cos(a0)} ${cy + tr * Math.sin(a0)} A ${tr} ${tr} 0 1 1 ${cx + tr * Math.cos(a0 + 2 * Math.PI - 0.01)} ${cy + tr * Math.sin(a0 + 2 * Math.PI - 0.01)}`;

  return (
    <div className="turntable" data-arm={arm} data-playing={playing ? "true" : "false"}>
      <svg viewBox={`0 0 ${TURNTABLE_VIEW.w} ${TURNTABLE_VIEW.h}`} role="img" aria-label={description}>
        <defs>
          <linearGradient id={wood} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#6b4529" />
            <stop offset="1" stopColor="#3b2414" />
          </linearGradient>
        </defs>
        <rect className="plinth" x="2" y="2" width="496" height="396" rx="22" fill={`url(#${wood})`} />
        <circle cx={cx} cy={cy} r={R + 12} fill="#1d1d1f" />

        <g className="platter" ref={platterRef}>
          {STROBE.map((deg) => (
            <circle key={deg} cx={cx + (R + 6) * Math.cos((deg * Math.PI) / 180)} cy={cy + (R + 6) * Math.sin((deg * Math.PI) / 180)} r="2.2" fill="#b9b9b9" />
          ))}
          <circle cx={cx} cy={cy} r={R} fill="#2a2a2c" />
          {record && art ? (
            <g className="record">
              <circle cx={cx} cy={cy} r={R - 6} fill="#0e0e0f" />
              {GROOVES.map((g) => (
                <circle key={g} cx={cx} cy={cy} r={g} fill="none" stroke="#232325" strokeWidth="1.2" />
              ))}
              <g transform={`rotate(${art.rotation} ${cx} ${cy})`}>
                <circle cx={cx} cy={cy} r={LABEL_R} fill={art.background} />
                {art.rings.map((k, i) => (
                  <circle key={i} cx={cx} cy={cy} r={LABEL_R * k} fill="none" stroke={art.accent} strokeWidth="1.5" />
                ))}
                <path id={arc} d={arcPath} fill="none" />
                <text fill={art.text} fontSize="10" fontWeight="700" letterSpacing="1">
                  <textPath href={`#${arc}`}>{record.title.toUpperCase()}</textPath>
                </text>
                <text x={cx} y={cy + 24} fill={art.text} fontSize="8" textAnchor="middle">
                  {record.artist}
                </text>
                <text x={cx} y={cy + 34} fill={art.text} fontSize="7" textAnchor="middle">
                  {`${record.rpm} RPM · ${record.year}`}
                </text>
              </g>
            </g>
          ) : (
            <g className="mat">
              {[150, 110, 70].map((k) => (
                <circle key={k} cx={cx} cy={cy} r={k} fill="none" stroke="#3a3a3e" strokeWidth="1" />
              ))}
            </g>
          )}
        </g>
        {/* The sheen stays put while the record turns under it. */}
        {record && (
          <path d={`M ${cx - 120} ${cy - 110} A 165 165 0 0 1 ${cx + 40} ${cy - 160}`} fill="none" stroke="#4a4a50" strokeWidth="5" strokeLinecap="round" opacity="0.5" />
        )}
        <circle cx={cx} cy={cy} r="5" fill="#d9d9d9" stroke="#8a8a8a" />

        <g className="lamps">
          <circle className="led" cx="34" cy="372" r="7" data-on={record ? "true" : "false"} />
          <text x="48" y="376" fill="#f3ece2" fontSize="11">
            POWER
          </text>
          <circle className="playing-lamp" cx="120" cy="372" r="7" data-on={playing ? "true" : "false"} />
          <text x="134" y="376" fill="#f3ece2" fontSize="11">
            PLAYING
          </text>
        </g>

        <circle cx={PX} cy={PY} r="26" fill="#2b2b2e" stroke="#555" />
        <rect x={PX + 6} y={PY + ARM - 64} width="18" height="26" rx="4" fill="#2b2b2e" />
        <g className="arm-shadow" aria-hidden="true">
          <line x1={PX} y1={PY} x2={PX} y2={PY + ARM} stroke="#000" strokeWidth="7" strokeLinecap="round" />
          <rect x={PX - 9} y={PY + ARM - 8} width="18" height="26" rx="3" fill="#000" />
        </g>
        <g className="tonearm">
          <rect x={PX - 11} y={PY - 44} width="22" height="26" rx="4" fill="#9a9aa0" />
          <line x1={PX} y1={PY - 20} x2={PX} y2={PY + ARM} stroke="#d6d6da" strokeWidth="6" strokeLinecap="round" />
          <rect x={PX - 9} y={PY + ARM - 8} width="18" height="26" rx="3" fill="#c9a227" />
          <circle cx={PX} cy={PY} r="12" fill="#bdbdc2" stroke="#6d6d72" />
        </g>
      </svg>
      <fieldset className="speed" disabled={!record}>
        <legend>Speed</legend>
        {([33, 45] as const).map((n) => (
          <label key={n}>
            <input type="radio" name={`${id}-rpm`} value={n} checked={rpm === n} onChange={() => onRpm(n)} />
            <span>{n === 33 ? "33⅓" : "45"}</span>
          </label>
        ))}
      </fieldset>
    </div>
  );
}
