import { labelArt, type VinylRecord } from "../_lib/records.ts";

// A record's sleeve, drawn from its colours and a seed from its id: a band of
// stripes, the disc peeking out and its label. No image is ever fetched, so
// no thumbnail is ever reused. Decorative: the title is text beside it.
export function Sleeve({ record }: { record: VinylRecord }) {
  const art = labelArt(record);
  const stripes = 3 + (art.seed % 4);
  const tilt = (art.seed >>> 4) % 2 ? -18 : 18;
  return (
    <svg className="sleeve-art" viewBox="0 0 100 100" aria-hidden="true" focusable="false">
      <rect width="100" height="100" fill={record.accentColor} />
      <g transform={`rotate(${tilt} 50 50)`}>
        {Array.from({ length: stripes }, (_, i) => (
          <rect key={i} x="-30" y={8 + i * (84 / stripes)} width="160" height={84 / stripes / 2.4} fill={record.labelColor} opacity={0.35 + (i % 2) * 0.3} />
        ))}
      </g>
      <circle cx="64" cy="58" r="34" fill="#141414" />
      {art.rings.map((r, i) => (
        <circle key={i}cx="64" cy="58" r={34 * r} fill="none" stroke="#2c2c2c" strokeWidth="0.6" />
      ))}
      <circle cx="64" cy="58" r="12" fill={art.background} />
      <circle cx="64" cy="58" r="8" fill="none" stroke={art.accent} strokeWidth="1.2" />
      <circle cx="64" cy="58" r="1.4" fill={art.text} />
    </svg>
  );
}
