import type { StoryCard } from "@/lib/kamishibai";
export function CardArt({ card }: { card: StoryCard }) {
  return <svg className="kamishibai-art" viewBox="0 0 214 150" aria-hidden="true" focusable="false">
    <g fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" filter="url(#kamishibai-ink)">
      {card.art.map((d, i) => <path key={i} d={d} />)}
    </g>
  </svg>;
}
export function InkFilter() {
  return <svg width="0" height="0" aria-hidden="true" className="kamishibai-filter"><defs>
    <filter id="kamishibai-ink" x="-4%" y="-4%" width="108%" height="108%">
      <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="269" result="grain" />
      <feDisplacementMap in="SourceGraphic" in2="grain" scale="0.7" xChannelSelector="R" yChannelSelector="G" />
    </filter>
  </defs></svg>;
}
