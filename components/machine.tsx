"use client";

import { SwatchPicker } from "@/components/figure-playground";
import { Inked, swatches, type Swatch } from "@/components/figures";
import { site } from "@/content/site";
import { boilOwner, HANDS, INK, ink, type Hand } from "@/lib/ink-modes";
import {
  useEffect,
  useId,
  useReducer,
  useRef,
  useState,
  useSyncExternalStore,
  type ComponentProps,
  type RefObject,
} from "react";

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

// Boiling lines: the figure's strokes re-roll six times a second on the 12 fps
// clock, while its Boil chip is pressed. One figure on the page boils at a
// time; pressing another hands it over. It holds off while the figure is
// scrolled away or the page is hidden, lets go when the figure unmounts (or
// <Activity> hides its page), and is never on under reduced motion: a live
// switch to it lets go too. Hand and Re-roll still work without it.
const boiling = boilOwner();
const REDUCED = "(prefers-reduced-motion: reduce)";
const onReducedChange = (listener: () => void) => {
  const query = matchMedia(REDUCED);
  query.addEventListener("change", listener);
  return () => query.removeEventListener("change", listener);
};

function useBoil(ref: RefObject<HTMLDivElement | null>, id: string) {
  const owned = useSyncExternalStore(boiling.subscribe, () => boiling.get() === id, () => false);
  const reduced = useSyncExternalStore(onReducedChange, () => matchMedia(REDUCED).matches, () => false);
  // nothing boils until the observer has seen the figure on screen
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    if (reduced) boiling.release(id);
  }, [reduced, id]);
  useEffect(() => () => boiling.release(id), [id]);
  useEffect(() => {
    const el = ref.current;
    if (!owned || !el) return;
    let onscreen = true;
    const update = () => setSeen(onscreen && !document.hidden);
    const view = new IntersectionObserver(([entry]) => {
      onscreen = entry.isIntersecting;
      update();
    });
    view.observe(el);
    document.addEventListener("visibilitychange", update);
    return () => {
      view.disconnect();
      document.removeEventListener("visibilitychange", update);
      setSeen(false);
    };
  }, [ref, owned]);
  const toggle = () => {
    if (!reduced) boiling.toggle(id);
  };
  return { owned, reduced, running: owned && !reduced && seen, toggle };
}

// The hand a machine is drawn in, for a figure that draws its own Inked.
export type Pen = { hand: Hand; seed: number };

// The figure is line work in an Inked, or, when it needs its own markup
// (the television holds an iframe), whatever `figure` draws at a wobble.
type Figure =
  | { viewBox: string; children: React.ReactNode; figure?: never }
  | { figure: (wobble: number, pen: Pen) => React.ReactNode; viewBox?: never; children?: never };

// The reference's stage: controls on the left, the figure, readouts on the
// right, then the wobble slider, the hand, re-roll and boil, and the swatches
// under a hairline.
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
  ownSound = false,
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
  // The toy plays its own cues (lib/sound-client.ts), so its keys skip the press cue (components/press-sound.tsx).
  ownSound?: boolean;
} & Figure) {
  const [fig, setFig] = useState(colour);
  const [wobble, setWobble] = useState(3.5);
  const [state, dispatchInk] = useReducer(ink, INK);
  const pen: Pen = { hand: state.hand, seed: state.seed };
  const wobbleId = useId();
  const handName = useId();
  const stillId = useId();
  const figureRef = useRef<HTMLDivElement>(null);
  useTilt(figureRef, tilt);
  const boil = useBoil(figureRef, wobbleId);
  useTick(boil.running, dispatchInk);

  const drawing = art.figure ? (
    art.figure(wobble, pen)
  ) : (
    <Inked viewBox={art.viewBox} wobble={wobble} hand={pen.hand} seed={pen.seed} className="block w-full">
      {art.children}
    </Inked>
  );

  return (
    <section
      aria-label={label}
      className="machine"
      style={{ "--fig": swatches[fig] } as React.CSSProperties}
      data-hand={pen.hand}
      data-seed={pen.seed}
      data-boil={boil.running ? "on" : boil.owned ? "held" : undefined}
      data-own-sound={ownSound ? "" : undefined}
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
        <div className="machine-pen">
          <fieldset>
            <legend className="caption mb-2">{site.ink.hand}</legend>
            <div className="flex flex-wrap gap-2">
              {HANDS.map((hand) => (
                <label key={hand} className="chip">
                  <input
                    type="radio"
                    name={handName}
                    value={hand}
                    checked={pen.hand === hand}
                    onChange={() => dispatchInk({ type: "hand", hand })}
                    className="sr-only"
                  />
                  {site.ink.hands[hand]}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="flex gap-2">
            <Chip aria-label={site.ink.rerollLabel} onClick={() => dispatchInk("reroll")}>
              <span aria-hidden="true">↻{"\u00a0"}</span>
              {site.ink.reroll}
            </Chip>
            <Chip
              aria-label={site.ink.boilLabel}
              aria-pressed={boil.owned && !boil.reduced}
              aria-disabled={boil.reduced || undefined}
              aria-describedby={boil.reduced ? stillId : undefined}
              onClick={boil.toggle}
            >
              {site.ink.boil}
            </Chip>
          </div>
          {boil.reduced ? (
            <p id={stillId} className="sr-only">
              {site.ink.still}
            </p>
          ) : null}
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
