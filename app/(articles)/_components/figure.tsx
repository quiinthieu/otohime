import type { Article } from "../_lib/articles.ts";
import { FIGURES } from "../_lib/figures/index.ts";
import type { InkPath } from "../_lib/ink.ts";

// One article's infographic, drawn on the server from its facts. Ink and spot
// paths take currentColor from their group, so the stylesheet recolours them
// per scheme (--ink, --spot) and a page without CSS still prints them in the
// text colour. pathLength="1" lets a stroke be drawn on with stroke-dashoffset;
// the resting pose is the whole drawing.

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

export function Figure({ article }: { article: Article }) {
  const figure = FIGURES[article.slug](article);
  const [width, height] = figure.viewBox;
  return (
    <figure className="figure" data-figure={article.slug}>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={article.figure.alt}>
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
      <figcaption>{article.figure.caption}</figcaption>
    </figure>
  );
}
