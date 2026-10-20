import type { ReactNode } from "react";
import type { Body, Stage } from "../_lib/bodies.ts";
import { inkCircle, inkRect } from "../_lib/ink.ts";
import { Cutaway } from "./cutaway";
import { Ink } from "./ink";

// A poster for any body but the Sun (which keeps its own, sun-poster.tsx), in
// the Sun poster's grid and CSS: title, the cutaway, one callout per layer, four
// badges, a life strip for a star, then steps (Previous / Next) and the credit.
// Every word is in _lib/bodies.ts, where bodies.test.ts keeps each poster's
// data within 170 words; the walk counts the served page (cap 220).

const FRAME = (i: number) => inkRect(4, 4, 192, 112, { seed: `badge-${i}`, strokeWidth: 2, roughness: 1.2 });

// The credit names a source by its key; the records only say "NASA" or "Wikipedia".
const SOURCE_LABEL: Record<string, (name: string) => string> = {
  factsheet: () => "NASA fact sheet",
  nssdc: (name) => `NASA ${name} sheet`,
  nasa: (name) => `NASA ${name} facts`,
  wikipedia: () => "Wikipedia",
  "nasa-stars": () => "NASA on stars",
};

// A star's life in three discs, sized by what it becomes. "today" takes the
// star's own colour, and a supergiant starts big.
function lifeInk(body: Body, stage: Stage): { r: number; colour: string } {
  const surface = body.layers.find((l) => l.id === "photosphere")?.colour ?? "#f4b400";
  const look: Record<string, { r: number; colour: string }> = {
    today: { r: /supergiant/i.test(stage.label) ? 40 : 15, colour: surface },
    giant: { r: 44, colour: "#d6453d" },
    shed: { r: 44, colour: "#f2c14e" },
    supernova: { r: 46, colour: "#f4b400" },
    "blue-dwarf": { r: 13, colour: "#6f9be0" },
    dwarf: { r: 5, colour: "#9cc3e6" },
    "white-dwarf": { r: 5, colour: "#9cc3e6" },
    "neutron-star": { r: 3, colour: "#9cc3e6" },
  };
  return look[stage.id] ?? { r: 15, colour: surface };
}

export function BodyPoster({ body, steps }: { body: Body; steps: ReactNode }) {
  const { poster } = body;
  const layerName = (id: string) => body.layers.find((l) => l.id === id)?.name ?? id;
  const cited = new Set([...poster.callouts, ...poster.badges, ...(poster.life ?? [])].map((x) => x.source));
  const credits = Object.entries(body.sources).filter(([key]) => cited.has(key));
  return (
    <>
      <main className="poster">
        <header className="title">
          <h1>{poster.title}</h1>
          <p className="tagline">{poster.tagline}</p>
        </header>

        <figure className="cutaway">
          <Cutaway body={body} />
        </figure>

        <ol className="callouts" data-callouts="">
          {poster.callouts.map((c) => (
            <li key={c.layer} data-callout={c.layer}>
              <span className="num">{c.n}</span>
              <p>
                <strong>{layerName(c.layer)}</strong> {c.text}
              </p>
            </li>
          ))}
        </ol>

        <ul className="badges">
          {poster.badges.map((b, i) => (
            <li key={b.big} data-badge={i + 1}>
              <svg className="frame" viewBox="0 0 200 120" preserveAspectRatio="none" aria-hidden="true">
                <Ink paths={FRAME(i)} scaleFree />
              </svg>
              <strong>{b.big}</strong>
              <span>{b.small}</span>
            </li>
          ))}
        </ul>

        {poster.life && (
          <ol className="life" data-life="">
            {poster.life.map((s) => {
              const ink = lifeInk(body, s);
              return (
                <li key={s.id} data-stage={s.id}>
                  <svg viewBox="0 0 100 100" aria-hidden="true">
                    <Ink
                      paths={inkCircle(50, 50, ink.r, {
                        seed: `${body.slug}-life-${s.id}`,
                        fill: ink.colour,
                        fillStyle: "hachure",
                        hachureGap: 4,
                      })}
                    />
                  </svg>
                  <strong>{s.label}</strong>
                  {s.note && <span>{s.note}</span>}
                </li>
              );
            })}
          </ol>
        )}
      </main>
      {steps}
      <footer className="credit">
        <p>
          {poster.footer}
          {credits.map(([key, s]) => (
            <span key={key}>
              {" · "}
              <a href={s.url} rel="noreferrer">
                {(SOURCE_LABEL[key] ?? (() => s.name))(body.name)}
              </a>
            </span>
          ))}
        </p>
      </footer>
    </>
  );
}
