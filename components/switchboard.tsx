"use client";

import { box, screen, swatches, type Point } from "@/components/figures";
import { Chip, Machine, press, Stat, useTick } from "@/components/machine";
import { site, type Line } from "@/content/site";
import { away } from "@/lib/end";
import {
  boardBusy,
  cordSag,
  newBoard,
  PLUG,
  springAt,
  switchboard,
  type BoardAction,
  type XY,
} from "@/lib/machines";
import { useEffect, useReducer, useRef, type PointerEvent } from "react";

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
// Each jack's hole as drawn: panel.onLit's matrix(0.9 -0.5 0 1) from the
// panel face's corner, so a dropped or swung plug lands in the hole itself.
const FACE = xy([14, D, DESK]);
const JACK_AT: XY[] = JACKS.map((u) => [FACE[0] + 0.9 * u, FACE[1] - 0.5 * u - (JACK_Z - DESK)]);
const VIEW = [400, 320];

// The plug can be carried to a jack by mouse, pen or finger (lib/machines.ts
// decides where it lands). Pointer capture keeps the drag when the pointer
// outruns the handle, and the pointer is read in figure units through the
// svg's inverse screen matrix. touch-action does not apply inside an <svg>,
// so a non-passive touchstart listener on the handle alone stops a finger
// panning the page; anywhere else on the figure a finger still scrolls.
function toFigure(e: PointerEvent<SVGElement>): XY | null {
  const m = e.currentTarget.ownerSVGElement?.getScreenCTM();
  if (!m) return null;
  const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
  return [Math.min(VIEW[0], Math.max(0, p.x)), Math.min(VIEW[1], Math.max(0, p.y))];
}

export function Switchboard({ lines }: { lines: Line[] }) {
  const [s, dispatch] = useReducer(switchboard, undefined, newBoard);
  const busy = boardBusy(s);
  useTick(busy, dispatch);
  const handle = useRef<SVGCircleElement>(null);

  useEffect(() => {
    const el = handle.current;
    if (!el) return;
    const hold = (e: TouchEvent) => {
      if (e.cancelable) e.preventDefault();
    };
    el.addEventListener("touchstart", hold, { passive: false });
    return () => el.removeEventListener("touchstart", hold);
  }, []);

  // Under reduced motion a dropped plug is home at once.
  const letGo = (action: BoardAction) => {
    dispatch(action);
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) dispatch("settle");
  };
  const jacks = JACK_AT.slice(0, lines.length);

  const line = s.line === null ? null : lines[s.line];
  const connected = line !== null && !busy;
  // The plug lifts off the desk and swings across, then sits in the jack.
  const f = s.line === null ? 0 : Math.min(s.t / PLUG, 1);
  const [jx, jy] = s.line === null ? REST : JACK_AT[s.line];
  const hx = REST[0] + (jx - REST[0]) * f;
  const hy = REST[1] + (jy - REST[1]) * f - Math.sin(Math.PI * f) * 34;
  // In hand it follows the pointer; let go, it springs from there to home.
  const k = springAt(s);
  const [px, py] = s.held ?? (s.from ? [s.from[0] + (hx - s.from[0]) * k, s.from[1] + (hy - s.from[1]) * k] : [hx, hy]);
  const sag = cordSag(Math.hypot(px - HOLE[0], py - HOLE[1]));
  const cord = `M${HOLE[0]} ${HOLE[1]}Q${(HOLE[0] + px) / 2} ${Math.max(HOLE[1], py) + sag} ${px} ${py}`;

  const readout = s.held
    ? site.switchboard.held
    : line === null
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
              <circle cx={u} cy={DESK - JACK_Z} r={10} className="fig-paper" />
              <circle cx={u} cy={DESK - JACK_Z} r={5} className="fig-dark" data-jack={i} />
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
      {/* the handle: a finger-sized ring round the plug, carried by hand */}
      <circle
        ref={handle}
        cx={px}
        cy={py}
        r={16}
        className="plug-handle"
        data-held={s.held ? "" : undefined}
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          const at = toFigure(e);
          if (!at) return;
          e.preventDefault();
          e.currentTarget.setPointerCapture(e.pointerId);
          dispatch({ type: "grab", at });
        }}
        onPointerMove={(e) => {
          if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
          const at = toFigure(e);
          if (at) dispatch({ type: "move", at });
        }}
        onPointerUp={(e) => {
          const at = toFigure(e);
          letGo(at ? { type: "release", at, jacks } : { type: "cancel" });
        }}
        onPointerCancel={() => letGo({ type: "cancel" })}
        onLostPointerCapture={() => letGo({ type: "cancel" })}
      />
    </Machine>
  );
}
