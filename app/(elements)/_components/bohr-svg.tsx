import { nucleus, neutronsOf, project2d, rings } from "../_lib/atom.ts";
import { categoryOf } from "../_lib/categories.ts";
import type { Element } from "../_lib/elements.ts";
import { diagramLabel } from "../_lib/format.ts";
import { tint } from "./tint.ts";

const SIZE = 240;
const ELECTRON_R = 4;

// Two decimals keep the markup small and identical on server and client.
const r2 = (n: number) => Math.round(n * 100) / 100;

// The flat Bohr diagram: the nucleus cluster seen from the front, one circle
// per shell and its electrons at t = 0. No hooks, so it renders on the server
// (static pages) and in the dialog alike; task 3 keeps it as the 3D fallback.
export function BohrSvg({ el }: { el: Element }) {
  const nuc = nucleus(el.number, neutronsOf(el));
  const d = project2d(rings(el.shells), nuc, SIZE);
  return (
    <figure className="bohr tint" style={tint(categoryOf(el))}>
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} role="img" aria-label={diagramLabel(el)}>
        <g className="bohr-shells">
          {d.rings.map((ring, i) => (
            <circle key={i} cx={d.centre} cy={d.centre} r={r2(ring.radius)} />
          ))}
        </g>
        <g className="bohr-nucleus">
          {d.nucleus.map((p, i) => (
            <circle key={i} className={p.kind} cx={r2(p.x)} cy={r2(p.y)} r={r2(p.r)} />
          ))}
        </g>
        <g className="bohr-electrons">
          {d.rings.flatMap((ring, i) =>
            ring.electrons.map((e, k) => <circle key={`${i}-${k}`} cx={r2(e.x)} cy={r2(e.y)} r={ELECTRON_R} />),
          )}
        </g>
      </svg>
      {nuc.label && <figcaption>{`Nucleus ${nuc.label}`}</figcaption>}
    </figure>
  );
}
