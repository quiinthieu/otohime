import type { Figure as Drawn } from "../_lib/kit.ts";
import type { InkPath } from "../_lib/ink.ts";

// A drawing from _lib (an In life picture or a costs card), drawn on the
// server: the Gazette's figure, copied. Ink and spot paths take currentColor
// from their group, so the stylesheet recolours them per scheme (--ink,
// --spot) and a page without CSS still prints them in the text colour.
// pathLength="1" lets a stroke be drawn on with stroke-dashoffset; the resting
// pose is the whole drawing.

function Paths({ paths }: { paths: InkPath[] }) {
  return paths.map((p, i) => (
    <path
      key={i}
      d={p.d}
      pathLength="1"
      fill={p.fill && p.fill !== "none" ? "currentColor" : "none"}
      stroke={p.stroke === "none" ? "none" : "currentColor"}
      strokeWidth={p.strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ));
}

/** The drawing alone: role="img" with a label, or hidden when the words beside it say it all. */
export function Drawing({ figure, label, className }: { figure: Drawn; label?: string; className?: string }) {
  const [width, height] = figure.viewBox;
  const a11y = label ? { role: "img", "aria-label": label } : { "aria-hidden": true };
  return (
    <svg className={className} viewBox={`0 0 ${width} ${height}`} {...a11y}>
      <g className="ink">
        <Paths paths={figure.paths} />
      </g>
      <g className="spot">
        <Paths paths={figure.spot} />
      </g>
      <g className="labels">
        {figure.labels.map((l, i) => (
          <text key={i} x={l.x} y={l.y} fontSize={l.size} textAnchor={l.anchor} className={l.spot ? "spot-label" : undefined}>
            {l.text}
          </text>
        ))}
      </g>
    </svg>
  );
}

export function Figure({ name, figure, label, caption, className }: { name: string; figure: Drawn; label: string; caption: string; className?: string }) {
  return (
    <figure className={`figure ${className ?? ""}`.trim()} data-figure={name}>
      <Drawing figure={figure} label={label} />
      <figcaption>{caption}</figcaption>
    </figure>
  );
}
