"use client";

import { SwatchPicker } from "@/components/figure-playground";
import { Inked, swatches, type Swatch } from "@/components/figures";
import { useEffect, useId, useRef, useState, type ComponentProps, type RefObject } from "react";

// Frames on twos: 12 a second, like hand-drawn animation. Pages hidden by
// <Activity> run effect cleanups, so nothing ticks off screen.
export function useTick(running: boolean, dispatch: (action: "tick") => void) {
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => dispatch("tick"), 1000 / 12);
    return () => clearInterval(id);
  }, [running, dispatch]);
}

// Under reduced motion a press jumps straight to where the machine rests.
export function press<A extends string | number>(dispatch: (action: A | "settle") => void, action: A) {
  dispatch(action);
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) dispatch("settle");
}

// A tilting figure leans toward a hovering pointer, at most six degrees from
// rest, with its shadow sliding the other way, and stands straight again on
// leave. Only a hover-capable pointer with no reduced-motion preference tilts
// it. Pointer moves write custom properties on the figure; the transform sits
// on a wrapper outside the ink's filter, so the compositor turns the drawing
// without redrawing it (.machine-tilt in globals.css).
const TILT = 6;
const TILT_QUERY = "(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)";

function useTilt(ref: RefObject<HTMLDivElement | null>, enabled: boolean) {
  useEffect(() => {
    const el = ref.current;
    if (!enabled || !el) return;
    const query = matchMedia(TILT_QUERY);
    const rest = () => {
      delete el.dataset.tilting;
      for (const name of ["--tilt-x", "--tilt-y", "--tilt-shadow-x", "--tilt-shadow-y"]) el.style.removeProperty(name);
    };
    const move = (event: PointerEvent) => {
      if (event.pointerType === "touch" || !query.matches) return rest();
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) return;
      let x = ((event.clientX - r.left) / r.width) * 2 - 1;
      let y = ((event.clientY - r.top) / r.height) * 2 - 1;
      // within the unit circle, so a corner leans no further than an edge
      const reach = Math.hypot(x, y);
      if (reach > 1) [x, y] = [x / reach, y / reach];
      el.style.setProperty("--tilt-x", `${(-y * TILT).toFixed(2)}deg`);
      el.style.setProperty("--tilt-y", `${(x * TILT).toFixed(2)}deg`);
      el.style.setProperty("--tilt-shadow-x", `${(-x * TILT).toFixed(1)}px`);
      el.style.setProperty("--tilt-shadow-y", `${(-y * TILT).toFixed(1)}px`);
      el.dataset.tilting = "";
    };
    const hide = () => {
      if (document.hidden) rest();
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerleave", rest);
    el.addEventListener("pointercancel", rest);
    query.addEventListener("change", rest);
    document.addEventListener("visibilitychange", hide);
    return () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerleave", rest);
      el.removeEventListener("pointercancel", rest);
      query.removeEventListener("change", rest);
      document.removeEventListener("visibilitychange", hide);
      rest();
    };
  }, [ref, enabled]);
}

// The figure is line work in an Inked, or, when it needs its own markup
// (the television holds an iframe), whatever `figure` draws at a wobble.
type Figure =
  | { viewBox: string; children: React.ReactNode; figure?: never }
  | { figure: (wobble: number) => React.ReactNode; viewBox?: never; children?: never };

// The reference's stage: controls on the left, the figure, readouts on the
// right, then the wobble slider and the swatches under a hairline.
export function Machine({
  label,
  caption,
  colour,
  busy,
  controls,
  stats,
  below,
  readout,
  tilt = false,
  ...art
}: {
  label: string;
  caption: string;
  colour: Swatch;
  busy: boolean;
  controls: React.ReactNode;
  stats?: React.ReactNode;
  below?: React.ReactNode;
  readout: string;
  tilt?: boolean;
} & Figure) {
  const [fig, setFig] = useState(colour);
  const [wobble, setWobble] = useState(3.5);
  const wobbleId = useId();
  const figureRef = useRef<HTMLDivElement>(null);
  useTilt(figureRef, tilt);

  const drawing = art.figure ? (
    art.figure(wobble)
  ) : (
    <Inked viewBox={art.viewBox} wobble={wobble} className="block w-full">
      {art.children}
    </Inked>
  );

  return (
    <section
      aria-label={label}
      className="machine"
      style={{ "--fig": swatches[fig] } as React.CSSProperties}
    >
      <div className="machine-stage">
        <div className="machine-controls">
          <p className="caption">{caption}</p>
          {controls}
        </div>
        <div ref={figureRef} className="machine-figure" data-busy={busy || undefined} data-tilt={tilt || undefined}>
          {tilt ? <div className="machine-tilt">{drawing}</div> : drawing}
        </div>
        {stats ? <dl className="machine-stats">{stats}</dl> : null}
      </div>
      {below}
      <p className="readout" aria-live="polite">
        {readout}
      </p>
      <div className="machine-knobs">
        <div>
          <label htmlFor={wobbleId} className="caption mb-2 block">
            Hand-drawn wobble
          </label>
          <input
            id={wobbleId}
            type="range"
            min={0}
            max={7}
            step={0.1}
            value={wobble}
            onChange={(event) => setWobble(Number(event.target.value))}
          />
        </div>
        <SwatchPicker value={fig} onChange={setFig} />
      </div>
    </section>
  );
}

export function Chip(props: ComponentProps<"button">) {
  return <button type="button" className="chip" {...props} />;
}

// The value remounts when it changes, so the bump plays again.
export function Stat({ k, v, small }: { k: string; v: string | number; small?: boolean }) {
  return (
    <div className={small ? "stat stat-small" : "stat"}>
      <dt>{k}</dt>
      <dd key={v} className="bump">
        {v}
      </dd>
    </div>
  );
}
