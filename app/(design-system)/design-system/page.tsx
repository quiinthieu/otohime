import type { Metadata } from "next";
import { Board } from "../_components/board";
import { Colophon, TopBar } from "../_components/chrome";
import { Figure } from "../_components/figure";
import { PARTS, PATTERNS, POTS } from "../_lib/board.ts";
import { body, captions, deck, PART_TITLES, parts, sources, title, type Parts } from "../_lib/copy.ts";
import { boxFigure } from "../_lib/figures/box.ts";
import { followFigure, followTurns } from "../_lib/figures/follow.ts";
import { hereFigure } from "../_lib/figures/here.ts";
import { readingMinutes } from "../_lib/readability.ts";
import { CREAMS, INK_COUNT, PAPER_COUNT, SIBLINGS } from "../_lib/siblings.ts";
import { textWords } from "../_lib/words.ts";

// /design-system: one page, drawn once at build. The box (what a design
// system holds), the board (the one island: turn a knob and watch the parts
// follow), the follow card (one knob, nine parts, against nine hands), the
// here card (this site's own sheets, which share no system), the four parts,
// the sources and the colophon. Every number is the engine's.
export const ensureStatic = "navigation";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: { absolute: title }, description: deck,
    openGraph: {
      images: [{ url: `/og?${new URLSearchParams({ title, path: "/design-system" })}`, width: 1200, height: 630, alt: `${title}, stamped on paper by otohime.dev` }],
    },
    twitter: { card: "summary_large_image" },
  };
}

const ORDER = Object.keys(PART_TITLES) as (keyof Parts)[];

export default function DesignSystemPage() {
  const minutes = readingMinutes(textWords(body().join(" ")));
  const { on, off } = followTurns();
  const here = hereFigure();
  const boxLabel = `A painter's box: a rulebook on the lid, then a shelf of ${POTS.length} pots (${POTS.join(", ")}), a shelf of ${PARTS.length} parts and a shelf of ${PATTERNS.length} patterns. An arrow runs from the spot pot through a part into a pattern.`;
  const followLabel = `Two columns. With a system, 1 pot and ${on.followed.length} parts followed. Without one, ${PARTS.length} pots and ${PARTS.length} hands, and ${off.followed.length} followed.`;
  const hereLabel = `This site's ${SIBLINGS.length} other style sheets as paper scraps: ${SIBLINGS.map((s) => `${s.group}, ${s.paper ?? "no paper"}, ${s.decisions} decisions`).join("; ")}. ${PAPER_COUNT} name a paper, ${INK_COUNT} an ink, in ${CREAMS} creams.`;
  return (
    <div className="notebook">
      <TopBar />
      <main>
        <article>
          <header className="page-head">
            <h1 className="title">{title}</h1>
            <p className="deck">{deck}</p>
            <p className="byline">{minutes} min read</p>
          </header>
          <Figure name="box" figure={boxFigure()} label={boxLabel} caption={captions.box} />
          <Board />
          <Figure name="follow" figure={followFigure()} label={followLabel} caption={captions.follow} />
          <Figure name="here" figure={here} scraps={here.scraps} label={hereLabel} caption={captions.here} />
          <div className="parts">
            {ORDER.map((part) => (
              <section key={part} aria-labelledby={`part-${part}`}>
                <h2 id={`part-${part}`}>{PART_TITLES[part]}</h2>
                {parts[part].map((para) => (
                  <p key={para}>{para}</p>
                ))}
              </section>
            ))}
          </div>
          <aside className="sources" data-sources="" aria-labelledby="sources">
            <h2 id="sources">Sources</h2>
            <ol>
              {sources.map((s) => (
                <li key={s.url}>
                  <a href={s.url}>{s.label}</a>
                </li>
              ))}
            </ol>
          </aside>
        </article>
      </main>
      <Colophon />
    </div>
  );
}
