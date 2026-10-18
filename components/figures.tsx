import { useId } from "react";

// The reference's colour swatches. Figures take one; FigurePlayground swaps it.
export const swatches = {
  yellow: "#f4b829",
  coral: "#ef6a4c",
  mint: "#93d3b0",
  blue: "#76a0e2",
  pink: "#f3a6bb",
} as const;

export type Swatch = keyof typeof swatches;

type Point = [x: number, y: number, z: number];

// Isometric projection: x runs down-right, y down-left, z up.
const COS30 = Math.cos(Math.PI / 6);
const at =
  ([ox, oy]: [number, number]) =>
  ([x, y, z]: Point) =>
    `${(ox + (x - y) * COS30).toFixed(1)},${(oy + (x + y) / 2 - z).toFixed(1)}`;

// A box standing on the ground, lit from the back right: the shadow falls
// towards the viewer's left, like the reference.
function box(origin: [number, number], w: number, d: number, h: number) {
  const p = at(origin);
  const poly = (points: Point[]) => points.map(p).join(" ");
  // The top's outline on the ground, shifted by (-k, +l); the hull of that
  // and the footprint is the shadow.
  const [k, l] = [h * 0.4, h * 0.75];
  return {
    p,
    poly,
    shadow: poly([[0, 0, 0], [w, 0, 0], [w, d, 0], [w - k, d + l, 0], [-k, d + l, 0], [-k, l, 0]]),
    top: poly([[0, 0, h], [w, 0, h], [w, d, h], [0, d, h]]),
    shaded: poly([[0, d, 0], [w, d, 0], [w, d, h], [0, d, h]]),
    lit: poly([[w, 0, 0], [w, d, 0], [w, d, h], [w, 0, h]]),
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
  const id = `fig${useId().replace(/[^\w-]/g, "")}`;
  const fill = color ?? (kind === "parcel" ? "yellow" : "mint");
  return (
    <svg
      viewBox="0 0 400 360"
      aria-hidden="true"
      className={`figure ${className}`}
      style={fill === "inherit" ? undefined : ({ "--fig": swatches[fill] } as React.CSSProperties)}
    >
      <filter id={id} x="-5%" y="-5%" width="110%" height="110%">
        {/* wobble the line work, then speckle it like a riso print */}
        <feTurbulence type="turbulence" baseFrequency="0.035" numOctaves="2" seed="3" result="warp" />
        <feDisplacementMap in="SourceGraphic" in2="warp" scale="3.5" xChannelSelector="R" yChannelSelector="G" result="inked" />
        <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="1" seed="8" result="noise" />
        <feColorMatrix in="noise" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1.6 0 0 0 -0.82" result="specks" />
        <feComposite in="specks" in2="inked" operator="in" result="grain" />
        <feMerge>
          <feMergeNode in="inked" />
          <feMergeNode in="grain" />
        </feMerge>
      </filter>
      <g
        filter={`url(#${id})`}
        stroke="currentColor"
        strokeWidth={2.4}
        strokeLinejoin="round"
        strokeLinecap="round"
      >
        {kind === "parcel" ? <Parcel /> : <Lock open={kind === "open-lock"} />}
      </g>
    </svg>
  );
}

// "Fig. 03 — Users", the reference's heading style. The number is decoration.
export function FigTitle({
  n,
  hint,
  children,
}: {
  n: string;
  hint?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-8 gap-y-1">
      <h1>
        <span aria-hidden="true">Fig. {n} — </span>
        {children}
      </h1>
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
