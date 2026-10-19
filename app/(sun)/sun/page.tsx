import type { Metadata } from "next";
import { Ink } from "../_components/ink";
import { Stage } from "../_components/stage";
import { inkCircle, inkRect } from "../_lib/ink.ts";
import { BADGES, CALLOUTS, FOOTER, LIFE, TAGLINE, TITLE, type LifeStage } from "../_lib/poster.ts";
import { LAYERS, SOURCES } from "../_lib/sun.ts";

// absolute: the layout's template would otherwise make this "Sun · Sun".
export const metadata: Metadata = { title: { absolute: "Sun" } };

// The poster: one server-rendered page, no client component. Every word is in
// _lib/poster.ts; the walk counts them on the served HTML (cap 220).

const layerName = (id: string) => LAYERS.find((l) => l.id === id)?.name ?? id;

// A stretchy hand-drawn frame for a badge: the SVG fills the box and the
// stroke keeps its width however the box is sized.
const FRAME = (i: number) => inkRect(4, 4, 192, 112, { seed: `badge-${i}`, strokeWidth: 2, roughness: 1.2 });

// The three stages in size order: small, large, small.
const LIFE_INK: Record<LifeStage["id"], { r: number; colour: string }> = {
  today: { r: 15, colour: "#f4b400" },
  giant: { r: 44, colour: "#d6453d" },
  dwarf: { r: 5, colour: "#9cc3e6" },
};

export default function SunPage() {
  return (
    <div className="sun">
      <header className="topbar">
        {/* A plain <a>: / is in another root layout, which needs a full page load. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a className="home-link" href="/">
          otohime.dev
        </a>
      </header>
      <main className="poster">
        <header className="title">
          <h1>{TITLE}</h1>
          <p className="tagline">{TAGLINE}</p>
        </header>

        <figure className="cutaway">
          <Stage />
        </figure>

        <ol className="callouts" data-callouts="">
          {CALLOUTS.map((c) => (
            <li key={c.layer} data-callout={c.layer}>
              <span className="num">{c.n}</span>
              <p>
                <strong>{layerName(c.layer)}</strong> {c.text}
              </p>
            </li>
          ))}
        </ol>

        <ul className="badges">
          {BADGES.map((b, i) => (
            <li key={b.big} data-badge={i + 1}>
              <svg className="frame" viewBox="0 0 200 120" preserveAspectRatio="none" aria-hidden="true">
                <Ink paths={FRAME(i)} scaleFree />
              </svg>
              <strong>{b.big}</strong>
              <span>{b.small}</span>
            </li>
          ))}
        </ul>

        <ol className="life" data-life="">
          {LIFE.map((s) => (
            <li key={s.id} data-stage={s.id}>
              <svg viewBox="0 0 100 100" aria-hidden="true">
                <Ink
                  paths={inkCircle(50, 50, LIFE_INK[s.id].r, {
                    seed: `life-${s.id}`,
                    fill: LIFE_INK[s.id].colour,
                    fillStyle: "hachure",
                    hachureGap: 4,
                  })}
                />
              </svg>
              <strong>{s.label}</strong>
              {s.note && <span>{s.note}</span>}
            </li>
          ))}
        </ol>
      </main>
      <footer className="credit">
        <p>
          {FOOTER}
          {" · "}
          <a href={SOURCES.nssdc.url} rel="noreferrer">
            NASA fact sheet
          </a>
          {" · "}
          <a href={SOURCES["nasa-facts"].url} rel="noreferrer">
            NASA Sun facts
          </a>
          {" · "}
          <a href={SOURCES["wikipedia-sun"].url} rel="noreferrer">
            Wikipedia
          </a>
        </p>
      </footer>
    </div>
  );
}
