import { useId } from "react";
import { SEAL_FONT, SEAL_RED, sealModel, type SealChoice } from "@/lib/hanko";

export function HankoSeal({ choice, className }: { choice: SealChoice; className?: string }) {
  const id = `seal-${useId().replace(/:/g, "")}`, m = sealModel(choice);
  return <svg viewBox="0 0 200 200" role="img" aria-label={`${m.name} seal`} className={className} data-hanko-name={m.name}>
    <defs><mask id={id}>
      <rect width="200" height="200" fill="white" />
      <g fill="black">
        {m.chips.map((c, i) => <circle key={i} cx={c.x} cy={c.y} r={c.r} />)}
        {m.glyphs.map((g, i) => <text key={i} x={g.x} y={g.y} fontFamily={SEAL_FONT} fontWeight="700" fontSize={g.size} textAnchor="middle">{g.text}</text>)}
      </g>
    </mask></defs>
    <path d={m.edge} fill={SEAL_RED} mask={`url(#${id})`} />
  </svg>;
}
