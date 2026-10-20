import type { ReactNode } from "react";
import { Ink } from "./ink";
import { Stage } from "./stage";
import { inkCircle, inkRect } from "../_lib/ink.ts";
import { BADGES, CALLOUTS, FOOTER, LIFE, TAGLINE, TITLE, type LifeStage } from "../_lib/poster.ts";
import { LAYERS, SOURCES } from "../_lib/sun.ts";

// The Sun's poster, the pm-189 page moved here unchanged: one server-rendered
// poster, no client component. Every word is in _lib/poster.ts; the walk counts
// them on the served HTML (cap 220). The page around it (orrery/[body]) gives
// the top bar, and steps (Previous / Next) sits between the poster and the credit.

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

export function SunPoster({ steps }: { steps: ReactNode }) {
  return (
    <>
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
      {steps}
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
    </>
  );
}
