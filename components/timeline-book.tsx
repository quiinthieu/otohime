"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { turnYear, type TimelineYear } from "@/lib/timeline";

const subscribeMotion = (fn: () => void) => {
  const media = matchMedia("(prefers-reduced-motion: reduce)"); media.addEventListener("change", fn);
  return () => media.removeEventListener("change", fn);
};
const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const subscribeReady = () => () => {};

function PaperSpread({ entry }: { entry: TimelineYear }) {
  const [pulled, setPulled] = useState(false);
  const [wheel, setWheel] = useState(0);
  const piece = entry.pieces[wheel % (entry.pieces.length || 1)];
  return <article className="book-spread" aria-labelledby={`year-${entry.year}`}>
    <div className="book-art">
      <svg viewBox="0 0 560 390" role="img" aria-label={`Open paper book for ${entry.year}${entry.pieces.length ? ", with a pop-up workshop" : ", with an empty archive envelope"}`}>
        <g stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round">
          <path d="m29 252 247-77 257 70-230 127Z" fill="currentColor" opacity=".09" stroke="none" />
          <path d="m38 203 230-78 252 70v57l-217 111L38 272Z" fill="var(--paper-2)" />
          <path d="m38 255 265 95 217-110M38 247l265 94 217-110M38 239l265 94 217-110" fill="none" opacity=".5" />
          <path d="m38 203 230-78 33 177L38 258Z" fill="var(--field)" />
          <path d="m268 125 252 70v48L301 302Z" fill="var(--field)" />
          <path d="m268 125 33 177" fill="none" strokeDasharray="3 4" opacity=".5" />
          <g opacity=".25" fill="none"><path d="m76 220 149-43m-137 54 149-43m-136 54 149-43m111 54 118-34m-109 44 118-34" /></g>
          <g className="paper-hinge paper-hinge-back">
            <path d="m305 218 57-93 97 26-44 97Z" fill="#76a0e2" />
            <path d="m320 219 45-77 72 20-34 72Z" fill="var(--field)" />
            <path d="m352 189 16-29 15 4m-23 45 53-15" fill="none" />
          </g>
          <g className="paper-hinge">
            {entry.pieces.length ? <>
              <path d="m106 230 5-114 109-20 30 107Z" fill="#93d3b0" />
              <path d="m111 116 51-53 58 33-50 52Z" fill="var(--field)" />
              <path d="m162 63 8 85 80 55-30-107Z" fill="#f4b829" />
              <path d="m128 154 27-5 2 34-27 6Zm48 6 31 12 10 33-38-14Z" fill="var(--field)" />
              <path d="m138 154 1 32m-9-14 25-5m32 18 16 5" fill="none" />
              <path d="m101 231 153-26-3 17-147 29Z" fill="var(--paper)" />
            </> : <>
              <path d="m111 226 9-111 123 13 3 113Z" fill="#f4b829" />
              <path d="m120 115 61 63 62-50m-128 88 44-62m82 76-37-67" fill="none" />
              <path d="m165 181 32 4-2 19-31-4Z" fill="var(--field)" />
              <path d="m175 190 13 1" fill="none" />
            </>}
          </g>
          <g className="paper-hinge paper-hinge-front">
            <path d="m284 290 3-53 62-18 3 49Z" fill="#ef6a4c" />
            <path d="m298 251 36-10m-35 21 23-7" fill="none" />
          </g>
          <path d="m404 280 54-15 26 9-56 18Z" fill="#f3a6bb" />
          <path d="m439 279 19-5" fill="none" />
        </g>
        <text x="72" y="295" fill="currentColor" fontFamily="Georgia, serif" fontSize="20" transform="rotate(18 72 295)">{entry.year}</text>
      </svg>
      <span className="book-edition">ARCHIVE / {String(entry.year - 2017).padStart(2, "0")}</span>
    </div>
    <div className="book-copy">
      <p className="book-kicker">A YEAR IN PAPER</p>
      <h2 id={`year-${entry.year}`}>{entry.year}</h2>
      <h3>{entry.title}</h3>
      <p>{entry.note}</p>
      <button className="book-pull" type="button" aria-expanded={pulled} aria-controls={`tab-${entry.year}`} onClick={() => setPulled(v => !v)}>↔ {pulled ? "Tuck away" : "Pull the archive tab"}</button>
      <div id={`tab-${entry.year}`} hidden={!pulled} className="book-tab">
        {entry.pieces.length ? <ul>{entry.pieces.filter(p => p.kind === "project").map(p => <li key={p.title}>{p.href ? <a className="link" href={p.href}>{p.title}</a> : p.title} — {p.detail}</li>)}</ul> : <p>Roles · projects · places · tools<br />No dated entries recorded for {entry.year}.</p>}
      </div>
      <noscript><ul>{entry.pieces.map(p => <li key={p.title}>{p.title} — {p.detail}</li>)}</ul></noscript>
      {entry.pieces.length > 0 && <div className="book-wheel">
        <label htmlFor={`wheel-${entry.year}`}>Detail wheel <span aria-hidden="true">◉</span></label>
        <input id={`wheel-${entry.year}`} type="range" min="0" max={entry.pieces.length - 1} value={wheel} onChange={e => setWheel(Number(e.target.value))} />
        <p aria-live="polite"><strong>{piece.title}</strong><br />{piece.detail}</p>
      </div>}
    </div>
  </article>;
}

export function TimelineBook({ years }: { years: TimelineYear[] }) {
  const [index, setIndex] = useState(years.length - 1);
  const [flat, setFlat] = useState(false);
  const reduced = useSyncExternalStore(subscribeMotion, reducedMotion, () => true);
  const ready = useSyncExternalStore(subscribeReady, () => true, () => false);
  const book = useRef<HTMLElement>(null);
  const wheelState = useRef({ sum: 0, last: 0 });
  const enhanced = ready && !reduced && !flat;
  useEffect(() => {
    const node = book.current;
    if (!node || !enhanced) return;
    const scroll = (event: WheelEvent) => {
      if (!node.contains(document.activeElement) || (event.target as Element).closest("input, button, a") || event.ctrlKey) return;
      wheelState.current.sum += event.deltaY;
      if (Math.abs(wheelState.current.sum) < 80) return;
      const dir = wheelState.current.sum > 0 ? 1 : -1; wheelState.current.sum = 0;
      if ((index === 0 && dir < 0) || (index === years.length - 1 && dir > 0)) return;
      event.preventDefault();
      if (performance.now() - wheelState.current.last < 650) return;
      wheelState.current.last = performance.now(); setIndex(i => turnYear(i, dir > 0 ? "ArrowRight" : "ArrowLeft"));
    };
    node.addEventListener("wheel", scroll, { passive: false });
    return () => node.removeEventListener("wheel", scroll);
  }, [enhanced, index, years.length]);
  return <section ref={book} className="timeline-book" aria-label="Career archive, 2018 to 2026" tabIndex={0} data-enhanced={enhanced} onKeyDown={e => {
    if ((e.target as Element).closest("input, textarea, select") || !enhanced || !["ArrowLeft", "ArrowRight", "Home", "End", "PageUp", "PageDown"].includes(e.key)) return;
    e.preventDefault(); setIndex(i => turnYear(i, e.key));
  }}>
    <div className="book-toolbar">
      <div className="book-years" aria-label="Choose a year">{years.map((y, i) => <button key={y.year} type="button" aria-pressed={index === i} onClick={() => { setIndex(i); if (!enhanced) document.getElementById(`year-${y.year}`)?.scrollIntoView({ block: "center" }); }}>{y.year}</button>)}</div>
      <label><input type="checkbox" checked={flat} onChange={e => setFlat(e.target.checked)} /> Flat list</label>
    </div>
    <p className="book-instructions">{enhanced ? "Focus the book: ← → to turn, Home / End to jump. Scroll over the focused book to turn a page." : "The illustrated archive, laid flat. Every year is open."}</p>
    <ol className="book-spreads">{years.map((entry, i) => <li key={entry.year} data-active={i === index}><PaperSpread entry={entry} /></li>)}</ol>
    {enhanced && <div className="book-turner"><button className="btn" type="button" disabled={index === 0} onClick={() => setIndex(i => turnYear(i, "ArrowLeft"))}>← Previous year</button><span aria-live="polite">{years[index].year} · {index + 1} / {years.length}</span><button className="btn" type="button" disabled={index === years.length - 1} onClick={() => setIndex(i => turnYear(i, "ArrowRight"))}>Next year →</button></div>}
  </section>;
}
