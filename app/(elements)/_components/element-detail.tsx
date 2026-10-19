import type { ReactNode } from "react";
import { categoryOf } from "../_lib/categories.ts";
import type { Element } from "../_lib/elements.ts";
import { factOf, isNeedsReview } from "../_lib/facts.ts";
import { mass, sourceHost, temperature } from "../_lib/format.ts";
import { tint } from "./tint.ts";

export const CC_BY_SA = "https://creativecommons.org/licenses/by-sa/3.0/";

// One element in full: the viewport (the Bohr diagram, later the 3D atom), the
// name, symbol, number and category chip, the "Did you know?" card, the key
// stats and the attributed Wikipedia summary. No hooks: the dialog and the
// static page render the same thing.
export function ElementDetail({
  el,
  viewport,
  headingId,
  Heading = "h2",
}: {
  el: Element;
  viewport: ReactNode;
  headingId?: string;
  Heading?: "h1" | "h2";
}) {
  const cat = categoryOf(el);
  const fact = factOf(el.number);
  return (
    <article className="detail tint" style={tint(cat)}>
      <div className="detail-viewport">{viewport}</div>
      <div className="detail-text">
        <header className="detail-head">
          <p className="detail-symbol" aria-hidden="true">
            {el.symbol}
          </p>
          <div>
            <Heading id={headingId} className="detail-name">
              {el.name}
            </Heading>
            <p className="detail-meta">
              <span>{`Symbol ${el.symbol}`}</span>
              <span>{`Atomic number ${el.number}`}</span>
              <span className="chip">{cat.label}</span>
            </p>
          </div>
        </header>

        <aside className="fact" aria-label="Did you know?">
          <p className="fact-label">Did you know?</p>
          <p className="fact-text">{fact.fact}</p>
          <p className="fact-source">
            <a href={fact.sourceUrl} rel="noopener">{`Source: ${sourceHost(fact.sourceUrl)}`}</a>
            {isNeedsReview(el.number) && <span className="fact-review"> · awaiting a second check</span>}
          </p>
        </aside>

        <dl className="stats">
          <div>
            <dt>Atomic mass</dt>
            <dd>{`${mass(el)} u`}</dd>
          </div>
          <div>
            <dt>Phase at room temperature</dt>
            <dd>{el.phase}</dd>
          </div>
          <div>
            <dt>Electron configuration</dt>
            <dd>{el.electron_configuration_semantic}</dd>
          </div>
          <div>
            <dt>Discovered by</dt>
            <dd>{el.discovered_by ?? "not known"}</dd>
          </div>
          <div>
            <dt>Melting point</dt>
            <dd>{temperature(el.melt)}</dd>
          </div>
          <div>
            <dt>Boiling point</dt>
            <dd>{temperature(el.boil)}</dd>
          </div>
        </dl>

        <blockquote className="summary" cite={el.source}>
          <p>{el.summary}</p>
          <footer>
            {"Summary from "}
            <a href={el.source} rel="noopener">
              Wikipedia
            </a>
            {", "}
            <a href={CC_BY_SA} rel="license noopener">
              CC BY-SA 3.0
            </a>
          </footer>
        </blockquote>
      </div>
    </article>
  );
}
