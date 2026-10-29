import type { Metadata } from "next";
import Link from "next/link";
import { Drawing } from "../_components/figure";
import { Colophon, TopBar } from "../_components/chrome";
import { PAGES } from "../_lib/copy.ts";
import { BAND_WORDS, costRows } from "../_lib/costs.ts";
import { lifeFigure } from "../_lib/life/index.ts";
import type { Band } from "../_lib/machine.ts";

// /structures: the index, drawn once at build. The eight pages in teaching
// order on one ruled list, each with its In life drawing as a thumbnail, its
// title (the link), its deck and its three costs as dots: one dot for "about
// the same, whatever the size", two for "a few", three for "every one".
export const ensureStatic = "navigation";

const DOTS: Record<Band, number> = { one: 1, few: 2, all: 3 };

function CostDots({ slug }: { slug: string }) {
  return (
    <ul className="dots" aria-label="Steps with 8 things inside">
      {costRows(slug).map((r) => (
        <li key={r.name} data-band={r.band}>
          <span className="dot-name">{r.name}</span>{" "}
          <span className="dot-row" aria-hidden="true">
            {[1, 2, 3].map((n) => (
              <span key={n} className={n <= DOTS[r.band] ? "dot on" : "dot"} />
            ))}
          </span>
          <span className="visually-hidden">: {BAND_WORDS[r.band]}</span>
        </li>
      ))}
    </ul>
  );
}

export const metadata: Metadata = {
  openGraph: {
    images: [{ url: "/og?title=Structures&path=%2Fstructures", width: 1200, height: 630, alt: "Structures, stamped on paper by otohime.dev" }],
  },
  twitter: { card: "summary_large_image" },
};

export default function StructuresIndex() {
  return (
    <div className="notebook">
      <TopBar />
      <main className="index">
        <header className="page-head">
          <h1 className="title">Structures</h1>
          <p className="deck">Eight ways to keep things, drawn so you can poke them.</p>
        </header>
        <ol className="pages">
          {PAGES.map((p, i) => (
            <li key={p.slug} data-page={p.slug}>
              <Drawing figure={lifeFigure(p.slug)} className="thumb life" />
              <div className="page-row">
                <p className="page-number">{i + 1} of {PAGES.length}</p>
                <h2 className="row-title">
                  <Link href={`/structures/${p.slug}`}>{p.title}</Link>
                </h2>
                <p className="row-deck">{p.deck}</p>
                <CostDots slug={p.slug} />
              </div>
            </li>
          ))}
        </ol>
        <p className="key">
          The dots: one is about the same, whatever the size; two is a few steps; three is every one, with 8 things inside.
        </p>
      </main>
      <Colophon />
    </div>
  );
}
