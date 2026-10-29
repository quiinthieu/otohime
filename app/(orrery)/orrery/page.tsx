import type { Metadata } from "next";
import { TopBar } from "../_components/chrome";
import { Ink } from "../_components/ink";
import { ORRERY, bodyBySlug, type Body } from "../_lib/bodies.ts";
import { RINGS, ringArcs } from "../_lib/cutaway.ts";
import { inkCircle, inkPath } from "../_lib/ink.ts";
import { ROW_VIEW, edgeArc, edgeArea, planetRow, starRow, type Disc, type Edge, type Row } from "../_lib/rows.ts";

// absolute: the layout's template would otherwise make this "Orrery · Orrery".
export const metadata: Metadata = {
  openGraph: {
    images: [{ url: "/og?title=Orrery&path=%2Forrery", width: 1200, height: 630, alt: "Orrery, stamped on paper by otohime.dev" }],
  },
  twitter: { card: "summary_large_image" },
  title: { absolute: "Orrery" },
};

// The index: two size rows, each at one true scale of its own (rows.ts). Every
// disc is a rough outline with a solid wash (never hachure, which would weigh
// about 1 MB for fourteen) and its name, linking its poster. What does not fit is
// its edge: the Sun's beside the planets, Betelgeuse's and Polaris's beside the
// stars. The Sun's disc is in the stars row, so data-body="sun" appears once;
// Polaris and Betelgeuse are their edges, so each body has one data-body.

// A body's colour as we see it: a star's photosphere, else its outermost interior layer.
const colourOf = (b: Body) =>
  (b.layers.find((l) => l.id === "photosphere") ?? b.layers.filter((l) => l.region === "interior").at(-1))?.colour ?? "#f4b400";

const body = (slug: string) => bodyBySlug(slug)!;

// Saturn's rings, outline only, at the poster's tilt: as wide as the room
// between Jupiter and Uranus allows. True scale (2.27 of its radius) would cover
// both, so here only the discs are to scale.
function SaturnRings({ row, disc }: { row: Row; disc: Disc }) {
  const at = (slug: string) => row.discs.find((d) => d.slug === slug);
  const [left, right] = [at("jupiter"), at("uranus")];
  if (!left || !right) return null;
  const a = Math.min(disc.cx - (left.cx + left.r), right.cx - right.r - disc.cx) - 8;
  const { km, open, tilt } = RINGS.saturn;
  const outer = Math.max(...km);
  return (
    <g data-mark="rings">
      {km.map((k, i) => (
        <Ink
          key={k}
          paths={ringArcs(disc.cx, disc.cy, (a * k) / outer, open, tilt, disc.r).flatMap((d, j) =>
            inkPath(d, { seed: `row-ring-${i}-${j}`, strokeWidth: k === outer || i === 0 ? 1.8 : 1.1, roughness: 0.8 }),
          )}
        />
      ))}
    </g>
  );
}

function DiscLink({ disc, row }: { disc: Disc; row: Row }) {
  const b = body(disc.slug);
  return (
    <a href={`/orrery/${disc.slug}`} data-body={disc.slug}>
      <Ink paths={inkCircle(disc.cx, disc.cy, disc.r, { seed: `row-${disc.slug}`, fill: colourOf(b), fillStyle: "solid", strokeWidth: 2 })} />
      {disc.slug === "saturn" && <SaturnRings row={row} disc={disc} />}
      <text x={disc.label.x} y={disc.label.y} textAnchor="middle">
        {disc.name}
      </text>
    </a>
  );
}

// An edge: the wash of the part of the disc on the page, then its inked limb.
// Polaris and Betelgeuse have no disc, so their edge is their link and body.
function EdgeLink({ edge }: { edge: Edge }) {
  const b = body(edge.slug);
  const ownsBody = edge.slug !== "sun";
  return (
    <a href={`/orrery/${edge.slug}`} data-edge={edge.slug} data-body={ownsBody ? edge.slug : undefined}>
      <path d={edgeArea(edge)} fill={colourOf(b)} />
      <Ink paths={inkPath(edgeArc(edge), { seed: `edge-${edge.slug}`, strokeWidth: 2.2 })} />
      <text x={edge.labelAt.x} y={edge.labelAt.y} textAnchor={edge.labelAt.anchor}>
        {edge.label}
      </text>
    </a>
  );
}

function SizeRow({ row }: { row: Row }) {
  return (
    <section aria-labelledby={`row-${row.id}`}>
      <h2 id={`row-${row.id}`}>{row.title}</h2>
      <div className="row">
        <svg data-row={row.id} viewBox={`0 0 ${ROW_VIEW.w} ${ROW_VIEW.h}`} role="group" aria-labelledby={`row-${row.id}`}>
          {row.edges.map((e) => (
            <EdgeLink key={e.slug} edge={e} />
          ))}
          {row.discs.map((d) => (
            <DiscLink key={d.slug} disc={d} row={row} />
          ))}
        </svg>
      </div>
    </section>
  );
}

export default function OrreryIndex() {
  return (
    <div className="orrery">
      <TopBar orrery={false} />
      <main className="index">
        <header className="title">
          <h1>{ORRERY.title}</h1>
          <p className="tagline">{ORRERY.tagline}</p>
        </header>
        <SizeRow row={planetRow()} />
        <SizeRow row={starRow()} />
      </main>
      <footer className="credit">
        <p>{ORRERY.footer}</p>
      </footer>
    </div>
  );
}
