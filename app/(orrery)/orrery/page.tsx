import type { Metadata } from "next";
import Link from "next/link";
import { TopBar } from "../_components/chrome";
import { Ink } from "../_components/ink";
import { BODIES, ORRERY, bodyBySlug, type Body } from "../_lib/bodies.ts";
import { inkCircle } from "../_lib/ink.ts";

// absolute: the layout's template would otherwise make this "Orrery · Orrery".
export const metadata: Metadata = { title: { absolute: "Orrery" } };

// The index: one tile per body, each a rough outline with a solid wash (never
// hachure, which would weigh about 1 MB for fourteen) and its name, linking its
// poster. The Sun leads the planets; the stars list links it again as plain text,
// so data-body="sun" appears once.

// A body's colour as we see it: a star's photosphere, else its outermost interior layer.
const colourOf = (b: Body) =>
  (b.layers.find((l) => l.id === "photosphere") ?? b.layers.filter((l) => l.region === "interior").at(-1))?.colour ?? "#f4b400";

function Tile({ body }: { body: Body }) {
  return (
    <li data-body={body.slug}>
      <Link href={`/orrery/${body.slug}`}>
        <svg viewBox="0 0 100 100" aria-hidden="true">
          <Ink paths={inkCircle(50, 50, 38, { seed: `tile-${body.slug}`, fill: colourOf(body), fillStyle: "solid", strokeWidth: 2.2 })} />
        </svg>
        <span>{body.name}</span>
      </Link>
    </li>
  );
}

const sun = bodyBySlug("sun")!;
const planets = BODIES.filter((b) => b.kind === "planet");
const stars = BODIES.filter((b) => b.kind === "star" && b.slug !== "sun");

export default function OrreryIndex() {
  return (
    <div className="orrery">
      <TopBar orrery={false} />
      <main className="index">
        <header className="title">
          <h1>{ORRERY.title}</h1>
          <p className="tagline">{ORRERY.tagline}</p>
        </header>

        <section aria-labelledby="planets">
          <h2 id="planets">The planets</h2>
          <ul className="tiles">
            <Tile body={sun} />
            {planets.map((b) => (
              <Tile key={b.slug} body={b} />
            ))}
          </ul>
        </section>

        <section aria-labelledby="stars">
          <h2 id="stars">The stars</h2>
          <ul className="tiles">
            <li className="also">
              <Link href="/orrery/sun">The Sun</Link> is one too
            </li>
            {stars.map((b) => (
              <Tile key={b.slug} body={b} />
            ))}
          </ul>
        </section>
      </main>
      <footer className="credit">
        <p>{ORRERY.footer}</p>
      </footer>
    </div>
  );
}
