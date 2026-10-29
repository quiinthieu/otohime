import { useId } from "react";
import { fractures, type Seam } from "@/lib/kintsugi";

export function KintsugiSeams({ seams, active = false }: { seams: Seam[]; active?: boolean }) {
  const id = `gold-${useId().replace(/[^a-z0-9]/gi, "")}`;
  return <svg className="kintsugi-seams" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
    <defs>
      <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
        <stop stopColor="#8b651c" /><stop offset=".4" stopColor="#d7aa42" /><stop offset=".5" stopColor="#fff0a2" /><stop offset=".64" stopColor="#bc8929" /><stop offset="1" stopColor="#e3c26b" />
      </linearGradient>
      <filter id={`${id}-sheen`}><feGaussianBlur stdDeviation=".16" /><feMerge><feMergeNode /><feMergeNode in="SourceGraphic" /></feMerge></filter>
    </defs>
    {seams.slice(-12).map((seam, i) => <g key={`${seam.seed}-${i}`} className={active && i === seams.length - 1 ? "kintsugi-new" : undefined}>
      {fractures(seam).map((d, j) => <path key={j} d={d} pathLength="1" fill="none" stroke={`url(#${id})`} strokeWidth=".65" vectorEffect="non-scaling-stroke" filter={`url(#${id}-sheen)`} />)}
    </g>)}
  </svg>;
}
