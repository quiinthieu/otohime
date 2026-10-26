import { PAPERS, cellFor, cellRect, guides, pageSize, type Paper, type ZinePage } from "@/lib/zine";
import type { CSSProperties, ReactNode } from "react";

// The printed sheet, in mm, exactly as lib/zine.ts lays it out: eight [data-page] cells in reading order (each placed
// by its cell, so the DOM reads 1 to 8 while the paper reads 6, 5, 7, 4, …), each page turned a quarter so its head
// faces the centre line, then the dashed folds and the solid cut drawn over the lot. Server-only: no state, no script.

/** Every page keeps its words 6 mm inside its edges: clear of the folds, the cut and a printer's unprintable rim. */
export const SAFE_MM = 6;
/** The calibration rule on page 8: measure it to check the print came out at 100%. */
export const RULE_MM = 100;

const mm = (n: number) => `${Math.round(n * 1000) / 1000}mm`;

export function Sheet({ paper, pages }: { paper: Paper; pages: ZinePage[] }) {
  const sheet = PAPERS[paper];
  const page = pageSize(paper);
  const { folds, cut } = guides(paper);

  return (
    <div
      className="sheet"
      data-sheet={paper}
      style={{ width: mm(sheet.width), height: mm(sheet.height) } as CSSProperties}
    >
      {pages.map((p) => {
        const cell = cellFor(p.no);
        const rect = cellRect(cell, paper);
        return (
          <div
            key={p.no}
            className="cell"
            data-page={p.no}
            data-rotate={cell.rotate}
            style={{ left: mm(rect.x), top: mm(rect.y), width: mm(rect.width), height: mm(rect.height) }}
          >
            <section
              className={`page page-${p.kind}`}
              aria-label={`Page ${p.no}`}
              style={{ width: mm(page.width), height: mm(page.height), "--turn": `${cell.rotate}deg` } as CSSProperties}
            >
              <div className="page-body" style={{ padding: mm(SAFE_MM) }}>
                <PageBody page={p} paper={paper} />
              </div>
            </section>
          </div>
        );
      })}

      <svg
        className="guides"
        viewBox={`0 0 ${sheet.width} ${sheet.height}`}
        width={mm(sheet.width)}
        height={mm(sheet.height)}
        aria-hidden="true"
      >
        {folds.map((f, i) => (
          <line key={i} data-guide="fold" className="fold" x1={f.x1} y1={f.y1} x2={f.x2} y2={f.y2} />
        ))}
        <line data-guide="cut" className="cut" x1={cut.x1} y1={cut.y1} x2={cut.x2} y2={cut.y2} />
        <Scissors x={cut.x1} y={cut.y1 + 7} />
      </svg>
    </div>
  );
}

/** A scissors mark sitting on the cut line, blades pointing down the line. */
function Scissors({ x, y }: { x: number; y: number }) {
  return (
    <g data-guide="scissors" className="scissors" transform={`translate(${x} ${y})`}>
      <rect x={-2.6} y={-5.4} width={5.2} height={8.2} className="scissors-gap" />
      <circle cx={-1.5} cy={-3.6} r={1.2} />
      <circle cx={1.5} cy={-3.6} r={1.2} />
      <path d="M -0.9 -2.6 L 1.1 2.4 M 0.9 -2.6 L -1.1 2.4" />
    </g>
  );
}

function PageBody({ page, paper }: { page: ZinePage; paper: Paper }) {
  switch (page.kind) {
    case "cover":
      return (
        <>
          <p className="kicker">a fold zine from</p>
          <h2 className="masthead">{page.title}</h2>
          <p className="tagline">{page.tagline}</p>
          <Enso />
          <p className="issue">{page.issue}</p>
        </>
      );
    case "bio":
      return (
        <>
          <h2 className="page-title">Hello</h2>
          {page.paragraphs.map((text) => (
            <p key={text} className="prose">
              {text}
            </p>
          ))}
          <Folio no={page.no} />
        </>
      );
    case "project":
      return (
        <>
          <p className="kicker">Project {page.no - 2} of 4</p>
          <h2 className="page-title">{page.title}</h2>
          <p className="prose">{page.note}</p>
          {page.href ? <p className="href">{page.href}</p> : null}
          <Folio no={page.no} />
        </>
      );
    case "sketch":
      return (
        <>
          <p className="kicker">From the sketchbook</p>
          {/* A plain, eager <img>: printing must not wait on a lazy loader or an optimiser's srcset. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={page.src} alt={`The ${page.title} sketch`} width={1248} height={832} loading="eager" decoding="async" />
          <h2 className="page-title">{page.title}</h2>
          <p className="prose">{page.note}</p>
          <Folio no={page.no} />
        </>
      );
    case "back":
      return (
        <>
          <Rule paper={paper} />
          {page.note ? (
            <>
              <p className="kicker">
                Latest note · <time dateTime={page.note.date}>{page.note.date}</time>
              </p>
              <h2 className="page-title">{page.note.title}</h2>
              <p className="prose">{page.note.body}</p>
            </>
          ) : (
            <h2 className="page-title">Thanks for reading</h2>
          )}
          <p className="back-url">{page.url}</p>
        </>
      );
  }
}

function Folio({ no }: { no: number }): ReactNode {
  return (
    <span className="folio" aria-hidden="true">
      {no}
    </span>
  );
}

/** One brush circle for the cover, left open at the top. */
function Enso() {
  return (
    <svg className="enso" viewBox="0 0 40 40" aria-hidden="true">
      <path d="M 24 4.6 A 16 16 0 1 1 13.5 5.6" />
    </svg>
  );
}

/**
 * The 100 mm rule. Inside the safe area page 8 is 62.25 x 93 mm (A4) or 57.85 x 95.95 mm (Letter), too small for
 * 100 mm either way, so the rule runs centred along the diagonal from the top right to the bottom left, ticks every
 * 10 mm on its lower side. A right float shaped like the lower triangle keeps the words above the line.
 */
function Rule({ paper }: { paper: Paper }) {
  const page = pageSize(paper);
  const w = page.width - 2 * SAFE_MM;
  const h = page.height - 2 * SAFE_MM;
  const diagonal = Math.hypot(w, h);
  // Unit vector along the rule, from the bottom left up to the top right, and the normal to its lower right.
  const ux = w / diagonal;
  const uy = -h / diagonal;
  const nx = h / diagonal;
  const ny = w / diagonal;
  const inset = (diagonal - RULE_MM) / 2;
  const x0 = ux * inset;
  const y0 = h + uy * inset;
  const at = (along: number, off: number) => ({ x: x0 + ux * along + nx * off, y: y0 + uy * along + ny * off });
  const end = at(RULE_MM, 0);
  const mid = at(RULE_MM / 2, 4.6);
  const angle = (Math.atan2(uy, ux) * 180) / Math.PI;
  const r = (n: number) => Math.round(n * 1000) / 1000;

  return (
    <>
      <span className="rule-shape" aria-hidden="true" />
      <svg
        className="rule"
        data-rule-mm={RULE_MM}
        viewBox={`0 0 ${r(w)} ${r(h)}`}
        width={mm(w)}
        height={mm(h)}
        style={{ left: mm(SAFE_MM), top: mm(SAFE_MM) }}
        aria-hidden="true"
      >
        <line x1={r(x0)} y1={r(y0)} x2={r(end.x)} y2={r(end.y)} />
        {Array.from({ length: RULE_MM / 10 + 1 }, (_, i) => {
          const a = at(i * 10, 0);
          const b = at(i * 10, i % 5 === 0 ? 2.6 : 1.4);
          return <line key={i} x1={r(a.x)} y1={r(a.y)} x2={r(b.x)} y2={r(b.y)} />;
        })}
        <circle data-rule-end="0" cx={r(x0)} cy={r(y0)} r={0.4} />
        <circle data-rule-end="100" cx={r(end.x)} cy={r(end.y)} r={0.4} />
        <text x={r(mid.x)} y={r(mid.y)} transform={`rotate(${r(angle)} ${r(mid.x)} ${r(mid.y)})`} textAnchor="middle">
          100 mm at 100% scale
        </text>
      </svg>
    </>
  );
}
