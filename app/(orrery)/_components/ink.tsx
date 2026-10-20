import type { InkPath } from "../_lib/ink.ts";

// Renders ink.ts paths. A hachure or outline is a stroke; a solid fill is a
// fill. pathLength="1" lets a stroke be drawn on with stroke-dashoffset.
export function Ink({ paths, scaleFree = false }: { paths: InkPath[]; scaleFree?: boolean }) {
  return paths.map((p, i) => (
    <path
      key={i}
      d={p.d}
      pathLength="1"
      fill={p.fill ?? "none"}
      stroke={p.stroke}
      strokeWidth={p.strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      vectorEffect={scaleFree ? "non-scaling-stroke" : undefined}
    />
  ));
}
