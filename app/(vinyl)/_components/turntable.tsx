"use client";

import { useId, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent, type Ref } from "react";
import type { Tonearm } from "../_lib/deck.ts";
import { PLATTER, TONEARM_PIVOT, TURNTABLE_VIEW } from "../_lib/geometry.ts";
import { labelArt, type Rpm, type VinylRecord } from "../_lib/records.ts";
import { ARM_LENGTH, armAngle, pointerToAngle, progressOf, scrubSeconds } from "../_lib/tonearm.ts";

// The turntable, one SVG in geometry's 500 × 400 view: plinth, platter with
// its strobe dots, the record and its label, spindle, power LED, playing lamp
// and the tonearm. The rAF loop in vinyl-app.tsx turns the platter through
// platterRef (a transform, never a re-render). The arm's angle is a CSS
// variable: at rest, or (hovering, down or lifted) at the playback position
// between the first and last grooves (_lib/tonearm.ts), so the arm is also
// the seek bar. It can be dragged (pointer capture, touch included: only the
// arm has touch-action: none) and it is a keyboard slider; letting it go or
// pressing Enter runs tonearm.dropAction. The platter's rim is the drop
// target for sleeves dragged from the crate. The cell clips everything
// (overflow: hidden), so neither the arm nor its shadow can reach the monitor.

const { cx, cy, r: R } = PLATTER;
const { x: PX, y: PY } = TONEARM_PIVOT;
const ARM = ARM_LENGTH;
const GRAB_PX = 4; // a press on the arm that moves less than this is not a drag
const GROOVES = Array.from({ length: 16 }, (_, i) => 72 + i * 6);
const STROBE = Array.from({ length: 72 }, (_, i) => (i * 360) / 72);
const LABEL_R = 58;

const ARM_WORDS: Record<Tonearm, string> = {
  rest: "the tonearm is at rest",
  hover: "the tonearm hovers over the record",
  down: "the needle is on the record",
  lifted: "the tonearm is lifted",
};

export type ArmSlider = { now: number; max: number; text: string };

export function Turntable({
  record,
  arm,
  rpm,
  playing,
  time,
  duration,
  slider,
  drop,
  onRpm,
  onArmDrop,
  onArmKey,
  onScrub,
  platterRef,
}: {
  record: VinylRecord | null;
  arm: Tonearm;
  rpm: Rpm | null;
  playing: boolean;
  time: number;
  duration: number;
  slider: ArmSlider;
  drop: "ready" | "over" | null; // a sleeve is being dragged (and is over the platter)
  onRpm: (rpm: Rpm) => void;
  onArmDrop: (angle: number) => void;
  onArmKey: (key: string) => boolean; // true when the arm used the key
  onScrub: (seconds: number | null) => void; // the time a held arm points at, for the seek bar
  platterRef: Ref<SVGGElement>;
}) {
  const id = useId();
  const svgRef = useRef<SVGSVGElement>(null);
  const grab = useRef<{ pointer: number; x: number; y: number; moved: boolean; angle: number } | null>(null);
  const [held, setHeld] = useState<number | null>(null); // the angle while the arm is held
  const angle = held ?? armAngle(arm, progressOf(time, duration));

  // Pointer to view units: the SVG keeps the view's 5:4 shape, so one scale fits both axes.
  function toView(e: PointerEvent) {
    const box = svgRef.current?.getBoundingClientRect();
    if (!box || box.width === 0) return null;
    const k = TURNTABLE_VIEW.w / box.width;
    return { x: (e.clientX - box.left) * k, y: (e.clientY - box.top) * k };
  }
  function onPointerDown(e: PointerEvent<SVGGElement>) {
    if (!record || !e.isPrimary || (e.pointerType === "mouse" && e.button !== 0)) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    e.currentTarget.focus({ preventScroll: true });
    grab.current = { pointer: e.pointerId, x: e.clientX, y: e.clientY, moved: false, angle };
  }
  function onPointerMove(e: PointerEvent<SVGGElement>) {
    const g = grab.current;
    if (!g || e.pointerId !== g.pointer) return;
    if (!g.moved && Math.hypot(e.clientX - g.x, e.clientY - g.y) < GRAB_PX) return;
    const point = toView(e);
    if (!point) return;
    g.moved = true;
    g.angle = pointerToAngle(TONEARM_PIVOT, point);
    setHeld(g.angle);
    onScrub(scrubSeconds(g.angle, duration));
  }
  function release(e: PointerEvent<SVGGElement>, commit: boolean) {
    const g = grab.current;
    if (!g || e.pointerId !== g.pointer) return;
    grab.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    setHeld(null);
    onScrub(null);
    if (commit && g.moved) onArmDrop(g.angle);
  }
  function onKeyDown(e: KeyboardEvent<SVGGElement>) {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    if (onArmKey(e.key)) e.preventDefault(); // and the deck leaves the key alone
  }

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
    <div
      className="turntable"
      data-arm={arm}
      data-held={held === null ? undefined : "true"}
      data-drop={drop ?? undefined}
      data-playing={playing ? "true" : "false"}
      style={{ "--arm": `${angle.toFixed(2)}deg` } as CSSProperties}
    >
      <svg ref={svgRef} viewBox={`0 0 ${TURNTABLE_VIEW.w} ${TURNTABLE_VIEW.h}`} role="group" aria-label={description}>
        <defs>
          <linearGradient id={wood} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#6b4529" />
            <stop offset="1" stopColor="#3b2414" />
          </linearGradient>
        </defs>
        <rect className="plinth" x="2" y="2" width="496" height="396" rx="22" fill={`url(#${wood})`} aria-hidden="true" />
        {/* The still rim under the platter is where a dragged sleeve lands. */}
        <circle data-drop-target="platter" cx={cx} cy={cy} r={R + 12} fill="#1d1d1f" />
        <circle className="drop-ring" cx={cx} cy={cy} r={R + 8} fill="none" aria-hidden="true" />

        <g className="platter" ref={platterRef} aria-hidden="true">
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
          <path aria-hidden="true" d={`M ${cx - 120} ${cy - 110} A 165 165 0 0 1 ${cx + 40} ${cy - 160}`} fill="none" stroke="#4a4a50" strokeWidth="5" strokeLinecap="round" opacity="0.5" />
        )}
        <circle cx={cx} cy={cy} r="5" fill="#d9d9d9" stroke="#8a8a8a" aria-hidden="true" />

        <g className="lamps" aria-hidden="true">
          <circle className="led" cx="34" cy="372" r="7" data-on={record ? "true" : "false"} />
          <text x="48" y="376" fill="#f3ece2" fontSize="11">
            POWER
          </text>
          <circle className="playing-lamp" cx="120" cy="372" r="7" data-on={playing ? "true" : "false"} />
          <text x="134" y="376" fill="#f3ece2" fontSize="11">
            PLAYING
          </text>
        </g>

        <circle cx={PX} cy={PY} r="26" fill="#2b2b2e" stroke="#555" aria-hidden="true" />
        <rect x={PX + 6} y={PY + ARM - 64} width="18" height="26" rx="4" fill="#2b2b2e" aria-hidden="true" />
        <g className="arm-shadow" aria-hidden="true">
          <line x1={PX} y1={PY} x2={PX} y2={PY + ARM} stroke="#000" strokeWidth="7" strokeLinecap="round" />
          <rect x={PX - 9} y={PY + ARM - 8} width="18" height="26" rx="3" fill="#000" />
        </g>
        <g
          className="tonearm"
          role="slider"
          tabIndex={record ? 0 : -1}
          aria-label="Tonearm"
          aria-orientation="horizontal"
          aria-valuemin={0}
          aria-valuemax={slider.max}
          aria-valuenow={slider.now}
          aria-valuetext={slider.text}
          aria-disabled={record ? undefined : "true"}
          aria-keyshortcuts="Enter ArrowLeft ArrowRight PageUp PageDown Home End"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={(e) => release(e, true)}
          onPointerCancel={(e) => release(e, false)}
          onLostPointerCapture={(e) => release(e, false)}
          onKeyDown={onKeyDown}
        >
          <line className="arm-focus" x1={PX} y1={PY - 20} x2={PX} y2={PY + ARM + 10} strokeWidth="16" strokeLinecap="round" />
          <rect x={PX - 11} y={PY - 44} width="22" height="26" rx="4" fill="#9a9aa0" />
          <line x1={PX} y1={PY - 20} x2={PX} y2={PY + ARM} stroke="#d6d6da" strokeWidth="6" strokeLinecap="round" />
          <rect x={PX - 9} y={PY + ARM - 8} width="18" height="26" rx="3" fill="#c9a227" />
          <circle cx={PX} cy={PY} r="12" fill="#bdbdc2" stroke="#6d6d72" />
          {/* A wide, invisible grab line, so a finger can find the arm. */}
          <line className="arm-grab" x1={PX} y1={PY - 20} x2={PX} y2={PY + ARM - 6} strokeWidth="28" strokeLinecap="round" />
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
