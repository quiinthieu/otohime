"use client";

import { box, screen, swatches, type Point } from "@/components/figures";
import { Chip, Machine, press, Stat, useTick } from "@/components/machine";
import type { Line } from "@/content/site";
import { boardBusy, newBoard, PLUG, switchboard } from "@/lib/machines";
import { useReducer } from "react";

// An operator's switchboard: a desk, and a panel of jacks and lamps standing
// at its back. W is the desk's depth, D the front's width.
const O: [number, number] = [290, 160];
const W = 70;
const D = 210;
const DESK = 44;
const desk = box(O, W, D, DESK, [0, 0, 0], 70);
const panel = box(O, 14, D, 110, [0, 0, DESK]);
const JACKS = [36, 82, 128, 174]; // along the panel's face
const JACK_Z = DESK + 58;
const xy = (point: Point) => screen(O, point);
const HOLE = xy([54, 192, DESK]); // where the cord comes up through the desk
const REST = xy([52, 150, DESK]); // where the plug lies between calls

// Mail goes to a mail app; the rest open in a new tab.
const away = (href: string) => (href.startsWith("mailto:") ? {} : { target: "_blank", rel: "me noreferrer" });

export function Switchboard({ lines }: { lines: Line[] }) {
  const [s, dispatch] = useReducer(switchboard, undefined, newBoard);
  const busy = boardBusy(s);
  useTick(busy, dispatch);

  const line = s.line === null ? null : lines[s.line];
  const connected = line !== null && !busy;
  // The plug lifts off the desk and swings across, then sits in the jack.
  const f = s.line === null ? 0 : Math.min(s.t / PLUG, 1);
  const [jx, jy] = s.line === null ? REST : xy([14, D - JACKS[s.line], JACK_Z]);
  const px = REST[0] + (jx - REST[0]) * f;
  const py = REST[1] + (jy - REST[1]) * f - Math.sin(Math.PI * f) * 34;
  const cord = `M${HOLE[0]} ${HOLE[1]}Q${(HOLE[0] + px) / 2} ${Math.max(HOLE[1], py) + 26} ${px} ${py}`;

  const readout =
    line === null
      ? "Pick a line and the operator connects you."
      : s.t < PLUG
        ? `Connecting you to ${line.label}…`
        : busy
          ? "Ringing…"
          : `${line.handle} picked up on ${line.label}.`;

  return (
    <Machine
      label="Switchboard"
      caption="Lines"
      colour="pink"
      viewBox="0 0 400 320"
      busy={busy}
      readout={readout}
      controls={lines.map((l, i) => (
        <Chip key={l.label} aria-pressed={s.line === i} onClick={() => press(dispatch, i)}>
          {l.label}
        </Chip>
      ))}
      stats={
        <>
          <Stat k="Line" v={s.line === null ? "—" : s.line + 1} />
          <Stat k="Picked up" v={connected ? line.handle : "—"} small />
        </>
      }
      below={
        <>
          {connected ? (
            <p className="mb-3 text-center">
              <a href={line.href} className="btn btn-primary" {...away(line.href)}>
                Open {line.label} <span aria-hidden="true">→</span>
              </a>
            </p>
          ) : null}
          {/* Every line as a plain link, for screen readers; they show when tabbed to. */}
          <nav aria-label="Elsewhere" className="sr-only focus-within:not-sr-only">
            <ul className="flex flex-wrap justify-center gap-2 pb-3">
              {lines.map((l) => (
                <li key={l.label}>
                  <a href={l.href} className="btn btn-sm" {...away(l.href)}>
                    {l.label}: {l.handle}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </>
      }
    >
      <polygon className="fig-shade" points={desk.shadow} />
      <polygon className="fig-shaded" points={desk.shaded} />
      <polygon className="fig-lit" points={desk.lit} />
      <polygon className="fig-top" points={desk.top} />
      {/* a drawer under the shelf, a handset on the side */}
      <g transform={desk.onLit}>
        <rect x={92} y={-27} width={34} height={7} rx={3.5} className="fig-dark" />
      </g>
      <g transform={desk.onShaded}>
        <path d="M14 -24q21 -16 42 0" fill="none" strokeWidth={6} />
        <circle cx={14} cy={-22} r={5.5} className="fig-dark" />
        <circle cx={56} cy={-22} r={5.5} className="fig-dark" />
      </g>
      <polygon className="fig-shaded" points={panel.shaded} />
      <polygon className="fig-lit" points={panel.lit} />
      <polygon className="fig-top" points={panel.top} />
      {/* each line: a lamp, a jack, a label. Lamps ring together while
          nobody's calling, the called one blinks, then stays lit. */}
      <g transform={panel.onLit}>
        {lines.map((l, i) => {
          const u = JACKS[i];
          const lit = s.line === null || s.line === i;
          return (
            <g key={l.label}>
              <circle
                cx={u}
                cy={-90}
                r={7}
                className={lit && !connected ? "led" : lit ? undefined : "fig-dark"}
                fill={lit ? swatches[l.colour] : undefined}
                style={s.line === null ? { animationDelay: `${-i * 0.4}s` } : undefined}
              />
              <circle cx={u} cy={-58} r={10} className="fig-paper" />
              <circle cx={u} cy={-58} r={5} className="fig-dark" />
              <rect x={u - 15} y={-36} width={30} height={14} rx={2} className="fig-paper" />
              <text x={u} y={-25.5} textAnchor="middle" className="fig-text" style={{ fontSize: 8 }}>
                {l.code}
              </text>
            </g>
          );
        })}
      </g>
      {/* the cord, rubber with an ink edge so it shows on dark paper, and its plug */}
      <ellipse cx={HOLE[0]} cy={HOLE[1]} rx={6} ry={3.5} className="fig-dark" />
      <path d={cord} fill="none" strokeWidth={6} />
      <path d={cord} fill="none" className="fig-belt" />
      <circle cx={px} cy={py} r={7} className="fig-dark" />
      <circle cx={px} cy={py} r={2.6} className="fig-paper" strokeWidth={1.2} />
    </Machine>
  );
}
