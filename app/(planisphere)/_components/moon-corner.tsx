import { inkCircle } from "../_lib/ink.ts";
import { age, illuminated, litPath, phaseWords } from "../_lib/moon.ts";

// The Moon in a corner: an inked outline, the lit part in plain SVG and the
// phase in words. Waxing is lit on the right, waning on the left, as seen from
// the northern hemisphere.

export function MoonCorner({ phaseDeg }: { phaseDeg: number }) {
  const percent = Math.round(illuminated(phaseDeg) * 100);
  const days = age(phaseDeg).toFixed(1);
  return (
    <section className="moon-corner" data-phase={phaseDeg.toFixed(1)} aria-labelledby="moon-head">
      <svg viewBox="0 0 120 120" width="96" height="96" aria-hidden="true">
        <g transform="translate(60 60)">
          <circle className="moon-dark" r="44" />
          <path className="moon-lit" d={litPath(phaseDeg, 44)} />
        </g>
        <g className="ink">
          {inkCircle(60, 60, 44, { seed: "moon-corner", strokeWidth: 2.2, roughness: 1 }).map((p, i) => (
            <path key={i} d={p.d} fill="none" stroke={p.stroke} strokeWidth={p.strokeWidth} strokeLinecap="round" />
          ))}
        </g>
      </svg>
      <div>
        <h2 id="moon-head">The Moon</h2>
        <p>
          {phaseWords(phaseDeg)}, {percent} % lit, {days} days old.
        </p>
      </div>
    </section>
  );
}
