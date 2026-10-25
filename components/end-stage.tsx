"use client";

import { SwatchPicker } from "@/components/figure-playground";
import { box, Inked, swatches, type Point, type Swatch } from "@/components/figures";
import { press, useTick } from "@/components/machine";
import { site } from "@/content/site";
import { end, endBusy, endReadout, lcdRows, newEnd } from "@/lib/end";
import { LCD } from "@/lib/pages";
import {
  useEffect,
  useEffectEvent,
  useId,
  useLayoutEffect,
  useReducer,
  useRef,
  useState,
} from "react";

export const ACHIEVEMENT_STORAGE_KEY = "end:achievement";

const VIEWBOX = "0 0 520 310";
const CO: [number, number] = [336, 190];

// Ground slab at the edge of the paper world (top plane z = 0).
const slab = box(CO, 90, 156, 14, [-48, -12, -14], 16);
const stepA = box(CO, 14, 24, 10, [44, 18, -12], 10);
const stepB = box(CO, 12, 20, 8, [46, 78, -14], 8);

// Ragged deckle edge along the slab's front-right cliff (x = 76 in local slab coords, world x = 42).
const TORN_EDGE: Point[] = [
  [90, 0, 14],
  [94, 16, 14],
  [89, 32, 14],
  [95, 48, 14],
  [90, 64, 14],
  [94, 80, 14],
  [89, 96, 14],
  [95, 112, 14],
  [90, 128, 14],
  [93, 144, 14],
  [90, 156, 14],
];

// Directional signpost on the left of the slab, clear of the console silhouette.
const post = box(CO, 8, 8, 108, [-34, 116, 0], 28);
const signTop = box(CO, 6, 48, 16, [-33, 94, 84], 0);
const signBot = box(CO, 40, 6, 14, [-50, 117, 60], 0);

// The familiar pocket console from the homepage (24 × 112 × 176), resting as a save point.
const body = box(CO, 24, 112, 176, [0, 0, 0], 48);
const cartridge = box(CO, 12, 76, 14, [2, 18, 176], 0);

const STARS: readonly { x: number; y: number; r: number; swatch: Swatch; delay: string }[] = [
  { x: 54, y: 84, r: 2.6, swatch: "yellow", delay: "0s" },
  { x: 116, y: 40, r: 2.2, swatch: "coral", delay: "-0.3s" },
  { x: 168, y: 74, r: 2.8, swatch: "mint", delay: "-0.7s" },
  { x: 226, y: 32, r: 2.2, swatch: "blue", delay: "-1.1s" },
  { x: 408, y: 36, r: 2.6, swatch: "pink", delay: "-0.5s" },
  { x: 462, y: 84, r: 2.4, swatch: "yellow", delay: "-1.4s" },
  { x: 484, y: 44, r: 2.2, swatch: "mint", delay: "-0.9s" },
];

const CLOUDS: readonly { x: number; y: number; scale: number; duration: string; delay: string }[] = [
  { x: 64, y: 52, scale: 1, duration: "28s", delay: "-4s" },
  { x: 176, y: 30, scale: 0.85, duration: "36s", delay: "-14s" },
  { x: 426, y: 58, scale: 0.9, duration: "32s", delay: "-9s" },
];

const PACKETS: readonly { x: number; y: number; swatch: Swatch; delay: string }[] = [
  { x: 396, y: 206, swatch: "yellow", delay: "0s" },
  { x: 422, y: 226, swatch: "mint", delay: "-1.1s" },
  { x: 448, y: 248, swatch: "coral", delay: "-2.2s" },
];

export function EndStage() {
  const [s, dispatch] = useReducer(end, site.end.lines.length, newEnd);
  const busy = endBusy(s);
  useTick(busy, dispatch);

  const [fig, setFig] = useState<Swatch>("mint");
  const [wobble, setWobble] = useState(3.5);
  const [seen, setSeen] = useState(false);
  const [inView, setInView] = useState(false);
  const [docHidden, setDocHidden] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [eye, setEye] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const stageRef = useRef<HTMLDivElement>(null);
  const consoleBtnRef = useRef<HTMLButtonElement>(null);
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const rafRef = useRef<number | null>(null);
  const pointerRef = useRef<{ x: number; y: number } | null>(null);

  const wobbleId = useId();
  const readoutId = useId();

  // Keep the mobile disclosure closed below 40rem and open from 40rem up before paint.
  useLayoutEffect(() => {
    const media = window.matchMedia("(min-width: 40rem)");
    const sync = () => {
      if (detailsRef.current) detailsRef.current.open = media.matches;
    };
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  // Restore persisted achievement after hydration without touching storage during SSR.
  useEffect(() => {
    try {
      if (window.localStorage.getItem(ACHIEVEMENT_STORAGE_KEY) === "1") {
        dispatch("restore");
      }
    } catch {
      // Blocked storage degrades to an ephemeral achievement for this visit.
    }
  }, []);

  useEffect(() => {
    if (!s.unlocked) return;
    try {
      window.localStorage.setItem(ACHIEVEMENT_STORAGE_KEY, "1");
    } catch {
      // Blocked storage is ignored.
    }
  }, [s.unlocked]);

  // Subscribe to reduced-motion preference on load and when toggled live.
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => {
      const isReduced = media.matches;
      setReduced(isReduced);
      if (isReduced) {
        dispatch("settle");
        if (rafRef.current !== null) {
          window.cancelAnimationFrame(rafRef.current);
          rafRef.current = null;
        }
        setEye((prev) => (prev.x === 0 && prev.y === 0 ? prev : { x: 0, y: 0 }));
      }
    };
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  // Track document visibility so ambient loops pause and partial key progress clears when hidden.
  useEffect(() => {
    const sync = () => {
      const hidden = document.visibilityState === "hidden" || document.hidden;
      setDocHidden(hidden);
      if (hidden) {
        dispatch("leave");
        if (rafRef.current !== null) {
          window.cancelAnimationFrame(rafRef.current);
          rafRef.current = null;
        }
        setEye((prev) => (prev.x === 0 && prev.y === 0 ? prev : { x: 0, y: 0 }));
      }
    };
    sync();
    document.addEventListener("visibilitychange", sync);
    return () => document.removeEventListener("visibilitychange", sync);
  }, []);

  // Observe stage intersection: set data-seen once per mount, track live visibility separately.
  useEffect(() => {
    const node = stageRef.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const visible = entry.isIntersecting;
          setInView(visible);
          if (visible) {
            setSeen(true);
          } else {
            dispatch("leave");
            setEye((prev) => (prev.x === 0 && prev.y === 0 ? prev : { x: 0, y: 0 }));
          }
        }
      },
      { threshold: 0.05 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const active = inView && !docHidden && !reduced;

  // Mirror data-seen and data-active onto the enclosing <footer class="end"> element.
  useEffect(() => {
    const footer = stageRef.current?.closest("footer.end");
    if (!(footer instanceof HTMLElement)) return;
    if (seen) footer.dataset.seen = "true";
    if (active) footer.dataset.active = "true";
    else delete footer.dataset.active;
  }, [seen, active]);

  // Cancel any pending rAF on unmount.
  useEffect(() => {
    return () => {
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, []);

  const onKey = useEffectEvent((event: KeyboardEvent) => {
    if (event.defaultPrevented || event.repeat) return;
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.key === "Shift" || event.key === "CapsLock") return;
    if (event.shiftKey && event.key.length !== 1) return;
    const target = event.target instanceof Element ? event.target : null;
    if (
      target?.closest("input, textarea, select, [contenteditable]:not([contenteditable='false'])") ||
      (target instanceof HTMLElement && target.isContentEditable)
    ) {
      return;
    }
    dispatch({ key: event.key });
  });

  // Listen for the Konami sequence only while the footer stage is in view and visible.
  useEffect(() => {
    if (!inView || docHidden) return;
    const listener = (event: KeyboardEvent) => onKey(event);
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, [inView, docHidden]);

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (event.pointerType === "touch" || reduced) return;
    if (!window.matchMedia("(min-width: 40rem) and (hover: hover) and (pointer: fine)").matches) {
      return;
    }
    pointerRef.current = { x: event.clientX, y: event.clientY };
    if (rafRef.current !== null) return;
    rafRef.current = window.requestAnimationFrame(() => {
      rafRef.current = null;
      const pt = pointerRef.current;
      const btn = consoleBtnRef.current;
      if (!pt || !btn) return;
      const rect = btn.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      const cx = rect.left + rect.width * 0.5;
      const cy = rect.top + rect.height * 0.34;
      const nx = Math.max(-1, Math.min(1, (pt.x - cx) / 140));
      const ny = Math.max(-1, Math.min(1, (pt.y - cy) / 110));
      const x = Math.round(nx * 2.2 * 100) / 100;
      const y = Math.round(ny * 1.8 * 100) / 100;
      setEye((prev) => (prev.x === x && prev.y === y ? prev : { x, y }));
    });
  }

  function onPointerLeave() {
    pointerRef.current = null;
    if (rafRef.current !== null) {
      window.cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    setEye((prev) => (prev.x === 0 && prev.y === 0 ? prev : { x: 0, y: 0 }));
  }

  const rows = lcdRows(s, site.end);
  const readout = endReadout(s, site.end);

  return (
    <div
      ref={stageRef}
      data-end-stage=""
      data-seen={seen ? "true" : undefined}
      data-active={active ? "true" : undefined}
      data-busy={busy ? "true" : undefined}
      data-unlocked={s.unlocked ? "true" : "false"}
      className="end-stage"
      style={{ "--fig": swatches[fig] } as React.CSSProperties}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
    >
      <div className="end-canvas">
        {/* Static ground slab and signpost inside Inked, wrapped so scroll entrance never repaints the filter */}
        <div className="end-ground-wrap">
          <Inked viewBox={VIEWBOX} wobble={wobble} className="end-svg end-ink">
            <polygon className="fig-shade" points={slab.shadow} />
            <polygon className="fig-shade" points={stepA.shadow} />
            <polygon className="fig-shade" points={stepB.shadow} />

            <polygon className="fig-shaded" points={stepA.shaded} />
            <polygon className="fig-lit" points={stepA.lit} />
            <polygon className="fig-floor" points={stepA.top} />

            <polygon className="fig-shaded" points={stepB.shaded} />
            <polygon className="fig-lit" points={stepB.lit} />
            <polygon className="fig-floor" points={stepB.top} />

            <polygon className="fig-shaded" points={slab.shaded} />
            <polygon className="fig-lit" points={slab.lit} />
            <polygon className="fig-floor" points={slab.top} />
            <polyline fill="none" points={slab.poly(TORN_EDGE)} />

            <polygon className="fig-shade" points={post.shadow} />
            <polygon className="fig-shaded" points={signBot.shaded} />
            <polygon className="fig-lit" points={signBot.lit} />
            <polygon className="fig-top" points={signBot.top} />
            <g transform={signBot.onShaded}>
              <rect x={4} y={-11} width={32} height={7} rx={1.5} className="fig-paper" />
              <path d="M8 -7.5h20" fill="none" strokeWidth={1.6} />
            </g>

            <polygon className="fig-shaded" points={post.shaded} />
            <polygon className="fig-lit" points={post.lit} />
            <polygon className="fig-top" points={post.top} />

            <polygon className="fig-shaded" points={signTop.shaded} />
            <polygon className="fig-lit" points={signTop.lit} />
            <polygon className="fig-top" points={signTop.top} />
            <g transform={signTop.onLit}>
              <rect x={4} y={-12} width={40} height={8} rx={1.5} className="fig-paper" />
              <path d="M9 -8h22M28 -10.5l4 2.5-4 2.5" fill="none" strokeWidth={1.6} />
            </g>
          </Inked>
        </div>

        {/* Static pocket console line work inside Inked */}
        <div className="end-console-wrap">
          <Inked viewBox={VIEWBOX} wobble={wobble} className="end-svg end-ink">
            <polygon className="fig-shade" points={body.shadow} />
            <g style={{ "--fig": "#a39e93" } as React.CSSProperties}>
              <polygon className="fig-shaded" points={cartridge.shaded} />
              <polygon className="fig-lit" points={cartridge.lit} />
              <polygon className="fig-top" points={cartridge.top} />
            </g>
            <polygon className="fig-top" points={body.top} />
            <polygon className="fig-shaded" points={body.shaded} />
            <polygon className="fig-lit" points={body.lit} />
            <g transform={body.onShaded}>
              <path d="M8 -120h8M8 -112h8M8 -104h8" fill="none" strokeWidth={1.6} />
            </g>
            <g transform={body.onLit}>
              <rect x={10} y={-166} width={92} height={74} rx={4} className="fig-dark" />
              <rect x={24} y={LCD.y} width={64} height={LCD.h} rx={1.5} className="fig-lcd" />
              <text x={12} y={-80} className="fig-text" style={{ fontSize: 7 }}>
                POCKET
              </text>
              <rect x={16} y={-57} width={28} height={10} rx={1.5} className="fig-dark" />
              <rect x={25} y={-66} width={10} height={28} rx={1.5} className="fig-dark" />
              <circle cx={72} cy={-46} r={7.5} className="fig-dark" />
              <circle cx={90} cy={-58} r={7.5} className="fig-dark" />
              <path d="M40 -18l10 -4M56 -18l10 -4" fill="none" strokeWidth={4} />
              <path d="M80 -6l12 -16M86 -6l12 -16M92 -6l12 -16" fill="none" strokeWidth={2} />
            </g>
          </Inked>
        </div>

        {/* Unfiltered sky, packet trail, lamp, eyes and LCD lines outside any SVG filter */}
        <svg viewBox={VIEWBOX} aria-hidden="true" className="figure end-svg end-sky">
          <g className="end-clouds" stroke="currentColor" strokeWidth={2} strokeLinejoin="round">
            {CLOUDS.map((cloud, i) => (
              <g
                key={i}
                data-end-cloud={i}
                className="end-cloud"
                style={
                  {
                    "--cloud-dur": cloud.duration,
                    "--cloud-delay": cloud.delay,
                  } as React.CSSProperties
                }
              >
                <g transform={`translate(${cloud.x} ${cloud.y}) scale(${cloud.scale})`}>
                  <path
                    d="M12 20h34a9 9 0 0 0 1-17.9A13 13 0 0 0 22 0a11 11 0 0 0-10 20Z"
                    className="fig-paper"
                  />
                </g>
              </g>
            ))}
          </g>

          <g className="end-stars">
            {STARS.map((star, i) => (
              <circle
                key={i}
                cx={star.x}
                cy={star.y}
                r={star.r}
                data-end-star={i}
                className="end-star"
                fill={s.unlocked ? swatches[star.swatch] : "currentColor"}
                stroke={s.unlocked ? "currentColor" : "none"}
                strokeWidth={s.unlocked ? 1.2 : 0}
                style={{ animationDelay: star.delay }}
              />
            ))}
          </g>

          <g className="end-packets" stroke="currentColor" strokeWidth={1.8} strokeLinejoin="round">
            <path
              d="M384 202q38 14 76 62"
              fill="none"
              strokeDasharray="4 5"
              className="fig-belt"
            />
            {PACKETS.map((pkt, i) => (
              <g
                key={i}
                data-end-packet={i}
                className="end-packet"
                style={{ animationDelay: pkt.delay }}
              >
                <rect
                  x={pkt.x}
                  y={pkt.y}
                  width={10}
                  height={10}
                  rx={1.5}
                  fill={swatches[pkt.swatch]}
                />
              </g>
            ))}
          </g>

          <g transform={body.onLit}>
            <rect
              data-lcd-screen=""
              x={24}
              y={LCD.y}
              width={64}
              height={LCD.h}
              rx={1.5}
              fill="none"
              stroke="none"
            />
            <circle
              cx={17}
              cy={-140}
              r={2.5}
              data-end-lamp=""
              className="fig-lamp end-lamp"
              style={s.pressed || s.unlocked ? { fill: "var(--yellow)" } : undefined}
            />
            {s.pressed ? (
              <circle
                cx={90}
                cy={-58}
                r={7.5}
                className="fig-lamp"
                stroke="currentColor"
                strokeWidth={2}
              />
            ) : null}

            {/* Expressive LCD eyes: squint on poke, follow pointer within bounds on desktop */}
            <g data-end-eyes="" className="end-eyes">
              <rect
                x={35}
                y={-151}
                width={15}
                height={15}
                rx={2.5}
                className="fig-paper"
                stroke="currentColor"
                strokeWidth={1.8}
              />
              <rect
                x={62}
                y={-151}
                width={15}
                height={15}
                rx={2.5}
                className="fig-paper"
                stroke="currentColor"
                strokeWidth={1.8}
              />
              <g
                data-end-pupils=""
                className="end-pupils"
                style={{ transform: `translate(${eye.x}px, ${eye.y}px)` }}
              >
                {s.pressed ? (
                  <g fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M38.5 -142l4 -4 4 4" />
                    <path d="M65.5 -142l4 -4 4 4" />
                  </g>
                ) : (
                  <>
                    <rect x={39.5} y={-146.5} width={6} height={7} rx={1} className="fig-dark" />
                    <rect x={66.5} y={-146.5} width={6} height={7} rx={1} className="fig-dark" />
                    <rect x={41} y={-145.5} width={2} height={2} className="fig-paper" />
                    <rect x={68} y={-145.5} width={2} height={2} className="fig-paper" />
                  </>
                )}
              </g>
            </g>

            {/* Two short LCD rows that always stay well inside the 64-unit screen */}
            <text
              x={56}
              y={-121}
              textAnchor="middle"
              data-lcd-line="0"
              className="fig-text lcd end-lcd-text"
            >
              {rows[0]}
            </text>
            <text
              x={56}
              y={-110}
              textAnchor="middle"
              data-lcd-line="1"
              className="fig-text lcd end-lcd-text"
            >
              {rows[1]}
            </text>
          </g>
        </svg>

        <button
          ref={consoleBtnRef}
          type="button"
          data-end-mascot=""
          className="end-console"
          aria-label="Poke the save-point console"
          aria-describedby={readoutId}
          aria-pressed={s.pressed}
          onClick={() => press(dispatch, "poke")}
        >
          <span className="sr-only">Poke the save-point console</span>
        </button>
      </div>

      <div className="end-stage-bar">
        <p id={readoutId} data-end-readout="" className="readout end-readout" aria-live="polite">
          {readout}
        </p>
        <span
          data-end-badge=""
          data-unlocked={s.unlocked ? "true" : "false"}
          aria-hidden={!s.unlocked || undefined}
          title="You found the end"
          className="badge end-badge"
        >
          {site.end.badge}
        </span>
      </div>

      <details ref={detailsRef} open className="end-knobs-details">
        <summary data-end-disclosure="" className="btn btn-sm end-knobs-summary">
          Customize scene
        </summary>
        <div className="machine-knobs end-knobs">
          <div>
            <label htmlFor={wobbleId} className="caption mb-2 block">
              Hand-drawn wobble
            </label>
            <input
              id={wobbleId}
              data-end-wobble=""
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
      </details>
    </div>
  );
}

export function EndTop() {
  return (
    <a
      href="#main"
      data-end-top=""
      className="btn btn-sm end-top"
      onClick={(event) => {
        if (
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey ||
          event.button !== 0
        ) {
          return;
        }
        event.preventDefault();
        const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
        const main = document.getElementById("main");
        main?.focus({ preventScroll: true });
      }}
    >
      <span aria-hidden="true">▲</span> Back to top
    </a>
  );
}
