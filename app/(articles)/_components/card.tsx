import Link from "next/link";
import type { Article } from "../_lib/articles.ts";
import { readingMinutes } from "../_lib/readability.ts";
import { textWords } from "../_lib/words.ts";

// A story's reading time, from the same word counter the tests use.
export const minutesOf = (a: Article) => readingMinutes(textWords(a.body.join(" ")));

// "Read on →", the one link to a story: its headline is in the link's name, so
// a list of links still says where each goes.
export function ReadOn({ article }: { article: Article }) {
  return (
    <p className="read-on">
      <Link href={`/articles/${article.slug}`}>
        Read on<span className="visually-hidden">: {article.headline}</span> <span aria-hidden="true">→</span>
      </Link>
    </p>
  );
}

// A below-the-fold story on the front page: kicker, headline, deck, the
// opening paragraph and the way in.
export function Card({ article }: { article: Article }) {
  return (
    <article className="card" data-article={article.slug}>
      <p className="kicker">{article.kicker}</p>
      <h2 className="headline">{article.headline}</h2>
      <p className="deck">{article.deck}</p>
      <p className="byline">{minutesOf(article)} min read</p>
      <p className="opening">{article.body[0]}</p>
      <ReadOn article={article} />
    </article>
  );
}
