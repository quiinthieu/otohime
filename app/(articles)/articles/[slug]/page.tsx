import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { minutesOf } from "../../_components/card";
import { Figure } from "../../_components/figure";
import { Colophon, MastheadLine, TopBar } from "../../_components/masthead";
import { ARTICLES, bySlug, neighbours } from "../../_lib/articles.ts";
import { longDate } from "../../_lib/edition.ts";

// /articles/<slug>: one story. All six are prerendered. An unknown slug renders
// at request time (ensureStatic, as Orrery's posters do) and calls notFound(),
// which shows app/(articles)/not-found.tsx with a 404.
export const ensureStatic = "navigation";

export function generateStaticParams() {
  return ARTICLES.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({ params }: PageProps<"/articles/[slug]">): Promise<Metadata> {
  const article = bySlug((await params).slug);
  return article ? { title: article.headline, description: article.deck } : {};
}

export default async function ArticlePage({ params }: PageProps<"/articles/[slug]">) {
  const article = bySlug((await params).slug);
  if (!article) notFound();
  const { prev, next } = neighbours(article.slug);
  return (
    <div className="gazette">
      <TopBar />
      <MastheadLine />
      <main className="story">
        <article>
          <header className="story-head">
            <p className="kicker">{article.kicker}</p>
            <h1 className="headline">{article.headline}</h1>
            <p className="deck">{article.deck}</p>
            <p className="byline">
              By Otohime <span aria-hidden="true">·</span> <time dateTime={article.published}>{longDate(article.published)}</time>{" "}
              <span aria-hidden="true">·</span> {minutesOf(article)} min read
            </p>
          </header>
          <Figure article={article} />
          <div className="body">
            {article.body.map((p) => (
              <p key={p}>{p}</p>
            ))}
          </div>
          <aside className="sources" data-sources="" aria-labelledby="sources">
            <h2 id="sources">Sources</h2>
            <ol>
              {Object.entries(article.sources).map(([key, s]) => (
                <li key={key}>
                  <a href={s.url}>{s.title}</a>
                </li>
              ))}
            </ol>
          </aside>
        </article>
        <nav className="turn" aria-label="Other stories">
          {prev ? (
            <Link href={`/articles/${prev.slug}`} rel="prev">
              <span aria-hidden="true">←</span> Previous: {prev.headline}
            </Link>
          ) : (
            <span />
          )}
          {next && (
            <Link href={`/articles/${next.slug}`} rel="next">
              Next: {next.headline} <span aria-hidden="true">→</span>
            </Link>
          )}
        </nav>
      </main>
      <Colophon />
    </div>
  );
}
