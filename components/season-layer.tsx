"use client";

// The paper almanac's ambient layer: one fixed SVG behind the page, drifting a
// handful of ink bits for the season on <html data-season> (lib/seasons.ts pins
// it before paint; a later dial may change it, and the layer follows). Petals in
// spring, rain streaks in summer, leaves in autumn, snow specks in winter, at
// most MAX_ELEMENTS elements in the whole layer, filter included. Each bit is one
// element drawn around the origin: a static CSS translate scatters it across the
// width and the almanac-* keyframes in app/(site)/seasons.css move it, transform
// and opacity only. The bits run only while the tab is visible, and under
// prefers-reduced-motion there are no bits at all, only the tint.
// scripts/probe-seasons.sh checks all of this in a browser.
import { appearanceTags } from "@/lib/appearance-client";
import { inkFilter } from "@/lib/ink-modes";
import { isSeason, SEASON_ATTR, type Season } from "@/lib/seasons";
import { createElement, useId, useSyncExternalStore, type CSSProperties } from "react";

export const MAX_ELEMENTS = 40;

type Bit = { kind: "petal" | "rain" | "leaf" | "snow"; count: number; seconds: [number, number] };

// Up to 28 bits, plus the svg, its filter and the filter's two primitives: 32 elements at most.
const BITS: Record<Season, Bit> = {
  spring: { kind: "petal", count: 16, seconds: [14, 22] },
  summer: { kind: "rain", count: 28, seconds: [1.2, 2] },
  autumn: { kind: "leaf", count: 14, seconds: [16, 26] },
  winter: { kind: "snow", count: 28, seconds: [12, 22] },
};

// Low-discrepancy scatter (golden and plastic ratios): spread evenly, the same on every render.
const frac = (n: number) => n - Math.floor(n);
const spread = (i: number) => frac((i + 0.5) * 0.6180339887);
const pace = (i: number) => frac((i + 0.5) * 0.7548776662);

function shape(kind: Bit["kind"], i: number) {
  switch (kind) {
    case "petal":
      return { tag: "path", d: "M0 -6C4 -4 4 3 0 6C-4 3 -4 -4 0 -6Z", fill: "var(--pink)", fillOpacity: 0.45, stroke: "currentColor", strokeOpacity: 0.45, strokeWidth: 0.8 };
    case "leaf":
      return { tag: "path", d: "M0 -8C6 -4 6 4 0 8C-6 4 -6 -4 0 -8ZM0 -8L0 10", fill: "var(--coral)", fillOpacity: 0.35, stroke: "currentColor", strokeOpacity: 0.5, strokeWidth: 0.9 };
    case "rain":
      return { tag: "line", x1: 0, y1: 0, x2: -2, y2: 14 + Math.round(pace(i) * 10), stroke: "currentColor", strokeOpacity: 0.3, strokeWidth: 1, strokeLinecap: "round" };
    case "snow":
      return { tag: "circle", r: 1.2 + Math.round(spread(i * 3) * 18) / 10, fill: "currentColor", fillOpacity: 0.35 };
  }
}

function subscribeSeason(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributeFilter: [SEASON_ATTR] });
  return () => observer.disconnect();
}
function currentSeason(): Season | null {
  const s = document.documentElement.getAttribute(SEASON_ATTR);
  return isSeason(s) ? s : null;
}

function subscribeHidden(onChange: () => void) {
  document.addEventListener("visibilitychange", onChange);
  return () => document.removeEventListener("visibilitychange", onChange);
}
const hidden = () => document.hidden;

const reduce = () => matchMedia("(prefers-reduced-motion: reduce)");
function subscribeReduced(onChange: () => void) {
  const media = reduce();
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}
const reduced = () => reduce().matches;

// The server draws an empty layer; the bits arrive on the client, for the season the pre-paint script pinned.
export function SeasonLayer() {
  const season = useSyncExternalStore(subscribeSeason, currentSeason, () => null);
  const paused = useSyncExternalStore(subscribeHidden, hidden, () => false);
  const still = useSyncExternalStore(subscribeReduced, reduced, () => true);
  const id = `almanac${useId().replace(/[^\w-]/g, "")}`;
  const bit = season && !still ? BITS[season] : null;
  return (
    <svg className="season-layer" aria-hidden="true" focusable="false" data-season-layer={bit ? season : "still"} data-paused={paused || undefined}>
      {bit && (
        <>
          {/* The ink hand's wobble, without its grain: bits a few pixels wide have nothing to speckle. */}
          <filter id={id} filterUnits="userSpaceOnUse" x="-24" y="-24" width="48" height="60">
            {inkFilter("ink", 0, 2)
              .slice(0, 2)
              .map((p, i) => p.tag !== "feMerge" && createElement(p.tag, { key: i, ...p.attrs, ...appearanceTags(p) }))}
          </filter>
          {Array.from({ length: bit.count }, (_, i) => {
            const { tag, ...attrs } = shape(bit.kind, i);
            const [lo, hi] = bit.seconds;
            const seconds = lo + pace(i) * (hi - lo);
            const style = {
              "--x": `${(spread(i) * 100).toFixed(2)}vw`,
              "--d": `${seconds.toFixed(2)}s`,
              // a negative delay starts every bit part-way down, so the layer opens already falling
              "--delay": `${(-spread(i * 7 + 3) * seconds).toFixed(2)}s`,
            } as CSSProperties;
            return createElement(tag, { key: i, className: `almanac-bit almanac-${bit.kind}`, filter: `url(#${id})`, style, ...attrs });
          })}
        </>
      )}
    </svg>
  );
}
