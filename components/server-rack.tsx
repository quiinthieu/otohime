"use client";

import { box } from "@/components/figures";
import { Chip, Machine, press, Stat, useTick } from "@/components/machine";
import { useReducer } from "react";

// A rack that runs the nightly job: lights blink, the tape reels turn and
// the log prints a line every half second.
const O: [number, number] = [230, 222];
const W = 60; // depth
const D = 96; // the front's width
const H = 196;
const rack = box(O, W, D, H, [0, 0, 0], 70);
const FRAMES_PER_LINE = 6;

const rowsFor = (job: number) => 1000 + ((job * 7919) % 9000);
const log = (job: number) => [
  `$ run nightly #${job}`,
  "extract   orders, events",
  "transform 41 models",
  `load      ${rowsFor(job).toLocaleString("en-US")} rows`,
  "done",
];

type Rack = { jobs: number; t: number; rows: number }; // t < 0: idle
type RackAction = "run" | "tick" | "settle";

function step(s: Rack, action: RackAction): Rack {
  if (action === "run") return s.t < 0 ? { ...s, jobs: s.jobs + 1, t: 0 } : s;
  if (s.t < 0) return s;
  const end = (log(s.jobs).length - 1) * FRAMES_PER_LINE;
  if (action === "settle" || s.t + 1 >= end) return { ...s, t: -1, rows: s.rows + rowsFor(s.jobs) };
  return { ...s, t: s.t + 1 };
}

// Status lights: x on the faceplate, and a colour.
const LEDS: [number, string][] = [
  [70, "var(--mint)"],
  [77, "var(--mint)"],
  [84, "var(--yellow)"],
];

function Server({ y, h = 26 }: { y: number; h?: number }) {
  return (
    <g>
      <rect x={8} y={y} width={80} height={h} rx={2} className="fig-dark" />
      <path d={`M16 ${y + 7}h22M16 ${y + 13}h22M16 ${y + 19}h22`} className="fig-belt" />
      {LEDS.map(([x, colour], i) => (
        <circle
          key={x}
          cx={x}
          cy={y + h / 2}
          r={2.2}
          className="led"
          fill={colour}
          style={{ animationDelay: `${-((y * 7 + i * 5) % 16) / 10}s` }}
        />
      ))}
    </g>
  );
}

function Reel({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <circle r={11} className="fig-paper" />
      <g className="reel">
        <path d="M0 -9V9M-9 0H9M-6.4 -6.4 6.4 6.4" fill="none" strokeWidth={1.6} />
      </g>
      <circle r={3} className="fig-dark" />
    </g>
  );
}

export function ServerRack() {
  const [s, dispatch] = useReducer(step, { jobs: 0, t: -1, rows: 0 });
  const busy = s.t >= 0;
  useTick(busy, dispatch);

  const lines = s.jobs ? log(s.jobs).slice(0, busy ? Math.floor(s.t / FRAMES_PER_LINE) + 1 : undefined) : ["idle"];
  const readout = s.jobs && !busy ? `Job ${s.jobs} done: ${rowsFor(s.jobs).toLocaleString("en-US")} rows.` : "Run the nightly job.";

  return (
    <Machine
      label="Server rack"
      caption="Rack"
      colour="yellow"
      viewBox="0 0 360 330"
      busy={busy}
      readout={readout}
      controls={
        <Chip aria-disabled={busy || undefined} onClick={() => press(dispatch, "run")}>
          Run job
        </Chip>
      }
      stats={
        <>
          <Stat k="Rows" v={s.rows.toLocaleString("en-US")} />
          <Stat k="Jobs" v={s.jobs} small />
        </>
      }
      below={
        <ol className="log" aria-hidden="true" data-running={busy || undefined}>
          {lines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ol>
      }
    >
      <polygon className="fig-shade" points={rack.shadow} />
      <polygon className="fig-top" points={rack.top} />
      <polygon className="fig-shaded" points={rack.shaded} />
      <polygon className="fig-lit" points={rack.lit} />
      {/* vents on the lid and the side */}
      {[18, 34, 50, 66, 82].map((y) => (
        <polyline key={y} points={rack.poly([[12, y, H], [W - 12, y, H]])} fill="none" strokeWidth={1.6} />
      ))}
      <g transform={rack.onShaded}>
        <path d="M14 -170v60M24 -170v60M34 -170v60" fill="none" strokeWidth={1.6} />
      </g>
      {/* the front: servers, a tape drive, a switch, feet */}
      <g transform={rack.onLit}>
        <Server y={-184} />
        <Server y={-152} />
        <rect x={8} y={-120} width={80} height={40} rx={2} className="fig-dark" />
        <Reel x={30} y={-100} />
        <Reel x={66} y={-100} />
        <rect x={8} y={-74} width={80} height={20} rx={2} className="fig-dark" />
        {[14, 23, 32, 41, 50, 59].map((x) => (
          <rect key={x} x={x} y={-68} width={6} height={7} className="fig-paper" strokeWidth={1.2} />
        ))}
        <circle cx={76} cy={-64} r={2.2} className="led" fill="var(--blue)" />
        <Server y={-48} />
        <path d="M10 -6v6M86 -6v6" fill="none" strokeWidth={5} />
      </g>
    </Machine>
  );
}
