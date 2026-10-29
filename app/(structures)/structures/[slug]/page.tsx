import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Colophon, TopBar, Turn } from "../../_components/chrome";
import { Figure } from "../../_components/figure";
import { Machine } from "../../_components/machine";
import { body, neighbours, PAGES, pageFor, PART_TITLES, type Parts } from "../../_lib/copy.ts";
import { BAND_WORDS, costRows, costsFigure } from "../../_lib/costs.ts";
import { lifeFigure } from "../../_lib/life/index.ts";
import { stepsWord } from "../../_lib/machine.ts";
import { readingMinutes } from "../../_lib/readability.ts";
import { textWords } from "../../_lib/words.ts";

// /structures/<slug>: one page. All eight are prerendered. An unknown slug
// renders at request time (ensureStatic, as the Gazette's stories do) and calls
// notFound(), which shows app/(structures)/not-found.tsx with a 404.
export const ensureStatic = "navigation";

export function generateStaticParams() {
  return PAGES.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: PageProps<"/structures/[slug]">): Promise<Metadata> {
  const page = pageFor((await params).slug);
  return page ? {
    title: page.title,
    description: page.deck,
    openGraph: {
      images: [{ url: `/og?${new URLSearchParams({ title: page.title, path: `/structures/${page.slug}` })}`, width: 1200, height: 630, alt: `${page.title}, stamped on paper by otohime.dev` }],
    },
    twitter: { card: "summary_large_image" },
  } : {};
}

const PARTS = Object.keys(PART_TITLES) as (keyof Parts)[];

export default async function StructurePage({ params }: PageProps<"/structures/[slug]">) {
  const page = pageFor((await params).slug);
  if (!page) notFound();
  const { prev, next } = neighbours(page.slug);
  const n = PAGES.indexOf(page) + 1;
  const minutes = readingMinutes(textWords(body(page).join(" ")));
  const costs = costRows(page.slug);
  const costsLabel = `How many steps each move takes with 8 things inside: ${costs.map((r) => `${r.name}, ${stepsWord(r.steps)}, ${BAND_WORDS[r.band]}`).join("; ")}.`;
  return (
    <div className="notebook">
      <TopBar />
      <main className="sheet">
        <article>
          <header className="page-head">
            <p className="crumbs">
              <Link href="/structures">
                <span aria-hidden="true">←</span> All pages
              </Link>{" "}
              <span aria-hidden="true">·</span> {n} of {PAGES.length}
            </p>
            <h1 className="title">{page.title}</h1>
            <p className="deck">{page.deck}</p>
            <p className="byline">{minutes} min read</p>
          </header>
          <Figure name="life" className="life" figure={lifeFigure(page.slug)} label={page.picture} caption={`In life: ${page.caption}`} />
          <Machine slug={page.slug} />
          <Figure
            name="costs"
            className="costs"
            figure={costsFigure(page.slug)}
            label={costsLabel}
            caption="The costs, with 8 things inside, counted by running the machine above: one box a step."
          />
          <div className="parts">
            {PARTS.map((part) => (
              <section key={part} aria-labelledby={`part-${part}`}>
                <h2 id={`part-${part}`}>{PART_TITLES[part]}</h2>
                {page.parts[part].map((para) => (
                  <p key={para}>{para}</p>
                ))}
              </section>
            ))}
          </div>
          <aside className="sources" data-sources="" aria-labelledby="sources">
            <h2 id="sources">Sources</h2>
            <ol>
              {page.sources.map((s) => (
                <li key={s.url}>
                  <a href={s.url}>{s.label}</a>
                </li>
              ))}
            </ol>
          </aside>
        </article>
        <Turn prev={prev} next={next} />
      </main>
      <Colophon />
    </div>
  );
}
