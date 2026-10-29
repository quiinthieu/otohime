import type { Sticker } from "@/content/stickers";

export function InkSticker({ sticker }: { sticker: Sticker }) {
  return <svg viewBox="0 0 100 120" aria-hidden="true" className="ink-sticker-art">
    <path d="M5 8 94 5 97 111 7 115Z" fill="#faf3df" stroke={sticker.colour} strokeWidth="1.2" />
    <g fill="none" stroke={sticker.colour} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" transform="translate(8 5) scale(.84)">
      {sticker.paths.map((d, i) => <path key={i} d={d} />)}
    </g>
    <text x="50" y="104" textAnchor="middle" fontFamily="monospace" fontSize="7" fill={sticker.colour}>{sticker.name}</text>
  </svg>;
}
