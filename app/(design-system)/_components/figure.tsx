import type { Figure as Drawn } from "../_lib/kit.ts";
import { INK, type InkPath } from "../_lib/ink.ts";
import type { Scrap } from "../_lib/figures/here.ts";

// A drawing from _lib (the box, the follow card, the here card), drawn on the
// server: Structures' figure, copied. Ink and spot paths take currentColor
// from their group, so the stylesheet recolours them per scheme (--ink,
// --spot) and a page without CSS still prints them in the text colour; a path
// filled with a sheet's own paper keeps that hex, because the paper is the
// point. pathLength="1" lets a stroke be drawn on with stroke-dashoffset; the
// resting pose is the whole drawing.
//
// The page ships every path twice (the HTML and the payload React hydrates
// from), so paths that paint alike are joined into one <path> and their
// numbers rounded to whole units (0.75 px on a phone), finer than the wobble.

const whole = (d: string) => d.replace(/-?\d+\.\d+/g, (n) => String(Math.round(Number(n))));

type Run = { fill: string; strokeWidth: number; d: string[] };

function runs(paths: InkPath[]): Run[] {
  const byKey = new Map<string, Run>();
  for (const p of paths) {
    const fill = !p.fill || p.fill === "none" ? "none" : p.fill === INK ? "currentColor" : p.fill;
    const strokeWidth = p.stroke === "none" ? 0 : p.strokeWidth;
    const key = `${fill}|${strokeWidth}`;
    const run = byKey.get(key) ?? { fill, strokeWidth, d: [] };
    run.d.push(whole(p.d));
    byKey.set(key, run);
  }
  // fills under strokes, so a scrap's paper never covers another's outline
  return [...byKey.values()].sort((a, b) => Number(a.fill === "none") - Number(b.fill === "none"));
}

function Paths({ paths }: { paths: InkPath[] }) {
  return runs(paths).map((r, i) => (
    <path
      key={i}
      d={r.d.join(" ")}
      pathLength="1"
      fill={r.fill}
      stroke={r.strokeWidth ? "currentColor" : "none"}
      strokeWidth={r.strokeWidth || undefined}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ));
}

/** The drawing alone: role="img" with a label. Scraps, if any, are marked data-sheet under the ink. */
export function Drawing({ figure, label, scraps }: { figure: Drawn; label: string; scraps?: Scrap[] }) {
  const [width, height] = figure.viewBox;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label}>
      {scraps && (
        <g className="sheets">
          {scraps.map((s) => (
            <rect key={s.sheet} data-sheet={s.sheet} x={s.x} y={s.y} width={s.w} height={s.h} fill={s.paper ?? "none"} />
          ))}
        </g>
      )}
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

export function Figure({ name, figure, label, caption, scraps }: { name: string; figure: Drawn; label: string; caption: string; scraps?: Scrap[] }) {
  return (
    <figure className="figure draw" data-figure={name}>
      <Drawing figure={figure} label={label} scraps={scraps} />
      <figcaption>{caption}</figcaption>
    </figure>
  );
}
