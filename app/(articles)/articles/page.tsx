import { Card, minutesOf, ReadOn } from "../_components/card";
import { Figure } from "../_components/figure";
import { Colophon, Masthead, TopBar } from "../_components/masthead";
import { ARTICLES } from "../_lib/articles.ts";
import { dateline } from "../_lib/edition.ts";

// /articles: the front page, drawn once at build. The masthead is the page's
// one h1 (the row title on /projects travels into it on the hop); the lead
// story sits above the fold with its figure, and the other five follow in
// ruled columns. Nothing here reads the request, so the whole page is static.
export const ensureStatic = "navigation";

export default function FrontPage() {
  const [lead, ...rest] = ARTICLES;
  return (
    <div className="gazette">
      <TopBar />
      <Masthead dateline={dateline(ARTICLES)} />
      <main className="front">
        <article className="lead" data-article={lead.slug}>
          <header className="lead-head">
            <p className="kicker">{lead.kicker}</p>
            <h2 className="headline">{lead.headline}</h2>
            <p className="deck">{lead.deck}</p>
            <p className="byline">
              By Otohime <span aria-hidden="true">·</span> {minutesOf(lead)} min read
            </p>
          </header>
          <Figure article={lead} />
          <div className="lead-body">
            {lead.body.slice(0, 2).map((p) => (
              <p key={p}>{p}</p>
            ))}
            <ReadOn article={lead} />
          </div>
        </article>
        <section className="stories" aria-label="More stories">
          {rest.map((a) => (
            <Card key={a.slug} article={a} />
          ))}
        </section>
      </main>
      <Colophon />
    </div>
  );
}
