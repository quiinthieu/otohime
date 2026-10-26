import { inkFilter, MATERIALS, type Hand } from "@/lib/ink-modes";
import type { ConsoleItem } from "@/lib/pages";
import { createElement, useId, ViewTransition } from "react";

// The reference's colour swatches. Figures take one; FigurePlayground and
// Machine swap it.
export const swatches = {
  yellow: "#f4b829",
  coral: "#ef6a4c",
  mint: "#93d3b0",
  blue: "#76a0e2",
  pink: "#f3a6bb",
} as const;

export type Swatch = keyof typeof swatches;

export type Point = [x: number, y: number, z: number];
type Origin = [x: number, y: number];

// Isometric projection: x runs down-right, y down-left, z up.
const COS30 = Math.cos(Math.PI / 6);
const fixed = (n: number) => n.toFixed(1);
export const screen = ([ox, oy]: Origin, [x, y, z]: Point): Origin => [
  ox + (x - y) * COS30,
  oy + (x + y) / 2 - z,
];
export const at = (origin: Origin) => (point: Point) => screen(origin, point).map(fixed).join(",");

// A box with its back corner at `base` (the ground origin by default), lit
// from the back right: the shadow falls towards the viewer's left, like the
// reference. `cast` is the height the shadow falls from, so tall machines
// keep their shadow inside the picture.
export function box(origin: Origin, w: number, d: number, h: number, base: Point = [0, 0, 0], cast = h) {
  const p = (q: Point) => at(origin)([q[0] + base[0], q[1] + base[1], q[2] + base[2]]);
  const poly = (points: Point[]) => points.map(p).join(" ");
  // Draws flat artwork onto a face: (0, 0) is the face's bottom-left corner
  // as seen, x runs along the face and y runs down, so up is negative.
  const onto = (skew: number, corner: Point) => {
    const [x, y] = screen(origin, [corner[0] + base[0], corner[1] + base[1], corner[2] + base[2]]);
    return `matrix(${fixed(COS30)} ${skew} 0 1 ${fixed(x)} ${fixed(y)})`;
  };
  // The top's outline on the ground, shifted by (-k, +l); the hull of that
  // and the footprint is the shadow.
  const [k, l] = [cast * 0.4, cast * 0.75];
  return {
    p,
    poly,
    shadow: poly([[0, 0, 0], [w, 0, 0], [w, d, 0], [w - k, d + l, 0], [-k, d + l, 0], [-k, l, 0]]),
    top: poly([[0, 0, h], [w, 0, h], [w, d, h], [0, d, h]]),
    shaded: poly([[0, d, 0], [w, d, 0], [w, d, h], [0, d, h]]),
    lit: poly([[w, 0, 0], [w, d, 0], [w, d, h], [w, 0, h]]),
    onShaded: onto(0.5, [0, d, 0]),
    onLit: onto(-0.5, [w, d, 0]),
  };
}

const ring = (centre: (t: number) => Point, steps = 16) =>
  Array.from({ length: steps }, (_, i) => centre((2 * Math.PI * i) / steps));

const arc = (from: number, to: number, steps: number, point: (t: number) => Point) =>
  Array.from({ length: steps + 1 }, (_, i) => point(from + ((to - from) * i) / steps));

// Padlock: 56 deep (x) and 120 wide (y), so the wide face is the lit front.
// Open lifts the shackle and swings it back around its right leg.
function Lock({ open }: { open: boolean }) {
  const H = 104;
  const b = box([266, 205], 56, 120, H);
  const shackle: Point[] = open
    ? [
        [28, 26, H - 6],
        ...arc(0, Math.PI, 12, (t) => [-6 + 34 * Math.cos(t), 26, H + 62 + 34 * Math.sin(t)]),
        [-40, 26, H + 18],
      ]
    : [
        [28, 26, H - 6],
        ...arc(0, Math.PI, 12, (t) => [28, 60 - 34 * Math.cos(t), H + 44 + 34 * Math.sin(t)]),
        [28, 94, H - 6],
      ];
  const d = `M${shackle.map(b.p).join("L")}`;
  return (
    <>
      <polygon className="fig-shade" points={b.shadow} />
      <path d={d} fill="none" strokeWidth={17} />
      <path d={d} fill="none" className="fig-metal" strokeWidth={11} />
      <polygon className="fig-top" points={b.top} />
      <polygon className="fig-shaded" points={b.shaded} />
      <polygon className="fig-lit" points={b.lit} />
      <polyline fill="none" points={b.poly([[0, 120, H - 16], [56, 120, H - 16], [56, 0, H - 16]])} />
      <polygon
        className="fig-ink"
        points={b.poly(ring((t) => [56, 60 + 8 * Math.cos(t), 52 + 8 * Math.sin(t)]))}
      />
      <polygon className="fig-ink" points={b.poly([[56, 57, 50], [56, 63, 50], [56, 64, 30], [56, 56, 30]])} />
    </>
  );
}

// Parcel: 150 × 110 × 90, taped over the top, with a shipping label.
function Parcel() {
  const H = 90;
  const b = box([200, 172], 150, 110, H);
  return (
    <>
      <polygon className="fig-shade" points={b.shadow} />
      <polygon className="fig-top" points={b.top} />
      <polygon className="fig-shaded" points={b.shaded} />
      <polygon className="fig-lit" points={b.lit} />
      <polygon className="fig-tape" points={b.poly([[64, 0, H], [86, 0, H], [86, 110, H], [64, 110, H]])} />
      <polygon className="fig-tape" points={b.poly([[64, 110, H], [86, 110, H], [86, 110, H - 32], [64, 110, H - 32]])} />
      <polygon className="fig-paper" points={b.poly([[150, 22, 18], [150, 76, 18], [150, 76, 56], [150, 22, 56]])} />
      <polyline
        fill="none"
        strokeWidth={1.6}
        points={b.poly([[150, 30, 47], [150, 68, 47]])}
      />
      <polyline fill="none" strokeWidth={1.6} points={b.poly([[150, 30, 38], [150, 60, 38]])} />
      <polyline fill="none" strokeWidth={1.6} points={b.poly([[150, 30, 29], [150, 52, 29]])} />
    </>
  );
}

// Hand-inked, isometric and grainy. Decorative: hidden from assistive tech.
// wobble is how far the line work strays, the reference's slider. hand picks
// the material and seed re-rolls its strokes (lib/ink-modes.ts); left out,
// they draw the house ink.
export function Inked({
  viewBox,
  wobble = 3.5,
  hand = "ink",
  seed = 0,
  className = "",
  style,
  children,
}: {
  viewBox: string;
  wobble?: number;
  hand?: Hand;
  seed?: number;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  const id = `fig${useId().replace(/[^\w-]/g, "")}`;
  return (
    <svg viewBox={viewBox} aria-hidden="true" className={`figure ${className}`} style={style}>
      <filter id={id} x="-5%" y="-5%" width="110%" height="110%">
        {/* wobble the line work, then speckle it like a riso print */}
        {inkFilter(hand, seed, wobble).map((p, i) =>
          p.tag === "feMerge" ? (
            <feMerge key={i}>
              {p.nodes.map((node) => (
                <feMergeNode key={node} in={node} />
              ))}
            </feMerge>
          ) : (
            createElement(p.tag, { key: i, ...p.attrs })
          ),
        )}
      </filter>
      <g
        filter={`url(#${id})`}
        stroke="currentColor"
        strokeWidth={MATERIALS[hand].stroke}
        strokeLinejoin="round"
        strokeLinecap="round"
      >
        {children}
      </g>
    </svg>
  );
}

// color="inherit" takes --fig from a FigurePlayground around it.
export function Figure({
  kind,
  color,
  className = "",
}: {
  kind: "lock" | "open-lock" | "parcel";
  color?: Swatch | "inherit";
  className?: string;
}) {
  const fill = color ?? (kind === "parcel" ? "yellow" : "mint");
  return (
    <Inked
      viewBox="0 0 400 360"
      className={className}
      style={fill === "inherit" ? undefined : ({ "--fig": swatches[fill] } as React.CSSProperties)}
    >
      {kind === "parcel" ? <Parcel /> : <Lock open={kind === "open-lock"} />}
    </Inked>
  );
}

// The pages the pocket console opens. Its chosen label (an HTML line over the LCD, components/handheld.tsx) and
// the page's h1 share one name, title-<page>, so a console navigation morphs the one into the other. Each name
// sits on one heading only, and pages with different names never pair, so the sidebar's moves keep their fade.
// default="none": the pair moves only when it forms; share without it would stop the morph.
export type ConsolePage = ConsoleItem["href"];
export const CONSOLE_TRANSITION = "console";
export const titleName = (page: ConsolePage) => `title-${page.slice(1)}`;

export function TitleMorph({ page, children }: { page: ConsolePage; children: React.ReactNode }) {
  return (
    <ViewTransition name={titleName(page)} share="console-title" default="none">
      {children}
    </ViewTransition>
  );
}

// "Fig. 03 — Users", the reference's heading style. The number is decoration. morph names the h1 for the
// console's label (TitleMorph); the gated rooms and the auth pages leave it out.
export function FigTitle({
  n,
  hint,
  morph,
  children,
}: {
  n: string;
  hint?: React.ReactNode;
  morph?: ConsolePage;
  children: React.ReactNode;
}) {
  const h1 = (
    <h1>
      <span aria-hidden="true">Fig. {n} — </span>
      {children}
    </h1>
  );
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-8 gap-y-1">
      {morph ? <TitleMorph page={morph}>{h1}</TitleMorph> : h1}
      {hint ? <p className="text-muted">{hint}</p> : null}
    </div>
  );
}

// A figure with a caption: 404, 403, errors and empty states.
export function Notice({
  n,
  title,
  figure,
  color,
  heading: Heading = "h1",
  children,
}: {
  n: string;
  title: string;
  figure: "lock" | "parcel";
  color?: Swatch;
  heading?: "h1" | "h2";
  children?: React.ReactNode;
}) {
  return (
    <div className="rise mx-auto grid max-w-md justify-items-center gap-3 py-8 text-center">
      <Figure kind={figure} color={color} className="w-64 max-w-full" />
      <Heading>
        <span aria-hidden="true">Fig. {n} — </span>
        {title}
      </Heading>
      {children}
    </div>
  );
}
