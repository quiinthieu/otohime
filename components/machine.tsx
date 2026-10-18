"use client";

import { SwatchPicker } from "@/components/figure-playground";
import { Inked, swatches, type Swatch } from "@/components/figures";
import { useEffect, useId, useState, type ComponentProps } from "react";

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
export function press<A extends string>(dispatch: (action: A | "settle") => void, action: A) {
  dispatch(action);
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) dispatch("settle");
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
} & Figure) {
  const [fig, setFig] = useState(colour);
  const [wobble, setWobble] = useState(3.5);
  const wobbleId = useId();

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
        <div className="machine-figure" data-busy={busy || undefined}>
          {art.figure ? (
            art.figure(wobble)
          ) : (
            <Inked viewBox={art.viewBox} wobble={wobble} className="block w-full">
              {art.children}
            </Inked>
          )}
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
