import { site } from "@/content/site";
import { POSTCARD_SKETCHES } from "@/lib/postcard";
import { CELLS, PAPERS, guides, parsePaper, zinePages, type Paper } from "@/lib/zine";
import type { Metadata } from "next";
import { Suspense } from "react";
import { PrintButton } from "../_components/print-button";
import { Sheet } from "../_components/sheet";

// absolute: the layout's template would otherwise make this "Fold-a-Zine · Fold-a-Zine".
export const metadata: Metadata = { title: { absolute: "Fold-a-Zine" } };

/** The one @page rule, per paper: the sheet is the page, edge to edge. */
const PAGE_SIZE: Record<Paper, string> = { a4: "210mm 297mm", letter: "8.5in 11in" };

// The sketches the zine may carry, by the postcards' short ids; only those the site still has.
const SKETCHES = POSTCARD_SKETCHES.filter((s) => site.sketches.some((k) => k.title === s.title));
const DEFAULT_SKETCH = SKETCHES.find((s) => s.title === site.zine.sketch) ?? SKETCHES[0];

function parseSketch(raw: unknown) {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const key = typeof value === "string" ? value.trim().toLowerCase() : "";
  return SKETCHES.find((s) => s.id === key) ?? DEFAULT_SKETCH;
}

// /zine?paper=a4|letter&sketch=<id>: the one-sheet fold zine. Anything else in the query draws the default, 200.
export default function ZinePage({ searchParams }: PageProps<"/zine">) {
  return (
    <main className="zine">
      <header className="zine-head screen-only">
        <nav className="ways-out" aria-label="Site">
          {/* Plain <a>s: the site is another root layout, which needs a full page load. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a href="/">otohime.dev</a>
        </nav>
        <h1>Fold-a-Zine</h1>
        <p className="lead">
          Eight little pages on one sheet: who I am, four projects, a sketch and the latest note. Print it, fold it, cut
          once, and it is a book.
        </p>
      </header>
      {/* The sheet reads the query, so it streams in after the static shell, into a hidden holder that only a script
         swaps into place. With JavaScript off, this shows the holder where it lies (the end of <body>) and drops the
         fallback, so the sheet, its form and its print still work. */}
      <noscript>
        <style>{".zine-wait{display:none}div[hidden]:has(.zine-layout){display:block!important}"}</style>
      </noscript>
      <Suspense fallback={<p className="zine-wait screen-only">Laying out the sheet…</p>}>
        <Zine searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Zine({ searchParams }: Pick<PageProps<"/zine">, "searchParams">) {
  const query = await searchParams;
  const paper = parsePaper(query.paper);
  const sketch = parseSketch(query.sketch);
  const pages = zinePages({ ...site, zine: { ...site.zine, sketch: sketch.title } });

  return (
    <>
      <style>{`@page{size:${PAGE_SIZE[paper]};margin:0}`}</style>
      <div className="zine-layout">
        <div className="preview" data-preview={paper}>
          <Sheet paper={paper} pages={pages} />
        </div>

        <aside className="controls screen-only" aria-label="Print settings">
          <form method="get" action="/zine" className="zine-form">
            <fieldset>
              <legend>Paper</legend>
              {(Object.keys(PAPERS) as Paper[]).map((key) => (
                <label key={key} className="choice">
                  <input type="radio" name="paper" value={key} defaultChecked={key === paper} />
                  <span>{PAPERS[key].label}</span>
                </label>
              ))}
            </fieldset>
            <label className="field">
              <span>Sketch on page 7</span>
              <select name="sketch" defaultValue={sketch.id}>
                {SKETCHES.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit">Lay it out</button>
          </form>

          <div className="print-row">
            <PrintButton />
            <noscript>
              <p className="hint" data-js-off-hint="">
                JavaScript is off, so there is no Print button: use your browser&rsquo;s own Print (Ctrl+P or ⌘P).
              </p>
            </noscript>
            <p className="hint">
              Print on {PAPERS[paper].label}, portrait, at 100% scale with no margins. The rule on page 8 should
              measure 100 mm.
            </p>
          </div>

          <FoldDiagram paper={paper} />
        </aside>
      </div>
    </>
  );
}

/** The sheet in miniature, with its page numbers, and the five steps from flat sheet to book. */
function FoldDiagram({ paper }: { paper: Paper }) {
  const { width: w, height: h } = PAPERS[paper];
  const { folds, cut } = guides(paper);
  return (
    <figure className="fold-diagram">
      <svg viewBox={`-2 -2 ${w + 4} ${h + 4}`} role="img" aria-label="The sheet's eight pages, its folds and its cut">
        <rect x={0} y={0} width={w} height={h} className="diagram-sheet" />
        {folds.map((f, i) => (
          <line key={i} className="fold" x1={f.x1} y1={f.y1} x2={f.x2} y2={f.y2} />
        ))}
        <line className="cut" x1={cut.x1} y1={cut.y1} x2={cut.x2} y2={cut.y2} />
        {CELLS.map((c) => {
          const x = (c.col + 0.5) * (w / 2);
          const y = (c.row + 0.5) * (h / 4);
          return (
            <text key={c.page} x={x} y={y} transform={`rotate(${c.rotate} ${x} ${y})`} textAnchor="middle" dominantBaseline="central">
              {c.page}
            </text>
          );
        })}
      </svg>
      <figcaption>
        <ol>
          <li>Print it. The dashed lines are folds, the solid line is the one cut.</li>
          <li>Crease every dashed line, then open the sheet flat.</li>
          <li>Fold it in half top to bottom and cut from the fold along the solid line, one page deep.</li>
          <li>Open it, fold it in half the long way, and push the top and bottom ends together so the cut opens.</li>
          <li>Keep pushing until the pages meet, wrap them round with the cover outside, and press it flat.</li>
        </ol>
      </figcaption>
    </figure>
  );
}
