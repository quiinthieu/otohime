"use client";

import { useEffect, useId, useRef, useState } from "react";
import { eventX, inkTimeRange, magnitude, parseInkEvents, stripSvg, tracePath, visibleEvents, WINDOW_MS, type InkArchive } from "@/lib/seismograph";

const stamp = (n: number) => new Date(n).toISOString().slice(0, 16).replace("T", " ") + " UTC";
export function InkSeismograph({ archive }: { archive: InkArchive }) {
  const [events, setEvents] = useState(() => parseInkEvents(archive.events));
  const { latest, minEnd, maxEnd } = inkTimeRange(events,archive.generated);
  const [end, setEnd] = useState(latest);
  const [playing, setPlaying] = useState(true);
  const [source, setSource] = useState(`Saved trace · ${stamp(Date.parse(archive.generated))}`);
  const [selected, setSelected] = useState<string | null>(null);
  const [reduced, setReduced] = useState(false);
  const root = useRef<HTMLElement>(null);
  const drag = useRef<{x:number;end:number} | null>(null);
  const filter = `ink-${useId().replace(/[^a-z0-9]/gi, "")}`;
  const clamp = (value: number) => Math.max(minEnd, Math.min(maxEnd, value));
  const shown = visibleEvents(events, end);
  const chosen = events.find(e => e.id === selected);
  useEffect(() => {
    const controller = new AbortController();
    const refresh = () => {
      if (document.hidden) return;
      void fetch("/api/seismograph", { signal:controller.signal }).then(r => r.ok ? r.json() : null).then(v => {
        if (!v) return;
        const parsed = parseInkEvents(v.events);
        if (parsed.length) {
          const next = inkTimeRange(parsed,archive.generated);
          setEvents(parsed);
          setEnd(current => Math.max(next.minEnd,Math.min(next.maxEnd,current)));
          setSource(String(v.source));
        }
      }).catch(() => {});
    };
    refresh(); const timer = setInterval(refresh, 300_000);
    return () => { controller.abort(); clearInterval(timer); };
  }, [archive.generated]);
  useEffect(() => {
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    const change = () => setReduced(motion.matches);
    change(); motion.addEventListener("change", change);
    let visible = false;
    const observer = new IntersectionObserver(entries => { visible = entries[0].isIntersecting; });
    if (root.current) observer.observe(root.current);
    const timer = setInterval(() => {
      if (motion.matches || document.hidden || !visible || !playing || drag.current) return;
      setEnd(value => value >= maxEnd ? maxEnd - WINDOW_MS * .75 : value + 12000);
    }, 200);
    return () => { clearInterval(timer); observer.disconnect(); motion.removeEventListener("change", change); };
  }, [playing, maxEnd]);
  function tear() {
    const blob = new Blob([stripSvg(events,end)], { type:"image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `otohime-ink-${new Date(end).toISOString().slice(0,10)}.svg`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <section ref={root} className="seismograph" aria-labelledby="seismo-title" data-playing={playing && !reduced} data-end={end}>
    <header className="seismo-header"><div><p className="caption">Field instrument No. 02</p><h2 id="seismo-title">Ink Seismograph</h2></div><span className="seismo-badge">{playing && !reduced ? "● archive rolling" : "○ paper held"}</span></header>
    <p className="text-muted seismo-intro">Small commits, larger tremors. A paper record of public GitHub activity and real CI job runtimes. Failed runs leave red ink.</p>
    <div className="seismo-roll">
      <div className="seismo-ruler" aria-hidden="true"><span>{stamp(end-WINDOW_MS)}</span><span>{stamp(end)}</span></div>
      <svg viewBox="0 0 900 220" className="seismo-chart" role="group" aria-label="Six-hour ink trace. Drag paper to scrub; select a spike for details." data-no-kintsugi=""
        onPointerDown={e => { if (e.button !== 0 || (e.target instanceof Element && e.target.closest("[data-spike]"))) return; drag.current={x:e.clientX,end}; setPlaying(false); e.currentTarget.setPointerCapture(e.pointerId); }}
        onPointerMove={e => { if (!drag.current) return; setEnd(clamp(drag.current.end-(e.clientX-drag.current.x)/e.currentTarget.getBoundingClientRect().width*WINDOW_MS)); }}
        onPointerUp={e => { drag.current=null; if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId); }}
        onPointerCancel={() => { drag.current=null; }} onLostPointerCapture={() => { drag.current=null; }}>
        <defs><filter id={filter} x="-2%" y="-5%" width="104%" height="110%"><feTurbulence baseFrequency=".035 .12" numOctaves="2" seed="28" result="grain" /><feDisplacementMap in="SourceGraphic" in2="grain" scale=".7" /></filter></defs>
        <g className="seismo-grid" aria-hidden="true">{[30,70,110,150,190].map(y => <path key={y} d={`M0 ${y}H900`} />)}{Array.from({length:19},(_,i) => <path key={i} d={`M${i*50} 0V220`} />)}</g>
        <path className="seismo-trace" d={tracePath(events,end)} filter={`url(#${filter})`} />
        {shown.map(e => <g key={e.id} data-spike={e.id} role="button" tabIndex={0} aria-label={`${e.failed ? "Failed: " : ""}${e.label}, ${stamp(Date.parse(e.at))}`} aria-pressed={selected===e.id}
          onClick={() => { setSelected(e.id); setPlaying(false); }} onKeyDown={key => { if (key.key === "Enter" || key.key === " ") { key.preventDefault(); setSelected(e.id); setPlaying(false); } }}>
          <title>{`${e.label} · ${e.kind} · ${e.failed ? "failed" : "recorded"}`}</title>
          <circle cx={eventX(e,end)} cy={110} r={e.failed ? 7 : 3} className={e.failed ? "seismo-blot" : "seismo-point"} />
          {e.failed && <path className="seismo-blot" d={`M${eventX(e,end)-8} 104l12 2 4 8-14 4-6-9Z`} />}
          <circle cx={eventX(e,end)} cy={110} r={Math.min(15,8+magnitude(e)/10)} fill="transparent" stroke={selected===e.id ? "currentColor" : "none"} />
        </g>)}
        <g className="seismo-needle" aria-hidden="true"><path d="M882 0L870 110l12-8" /><circle cx="870" cy="110" r="2" /></g>
      </svg>
      <div className="seismo-perforation" aria-hidden="true" />
    </div>
    <div className="seismo-controls" data-no-kintsugi="">
      <label className="seismo-scrub">Scrub time<input type="range" min={minEnd} max={maxEnd} step="60000" value={end} aria-label="Scrub ink history" aria-valuetext={stamp(end)} onChange={e => { setPlaying(false); setEnd(Number(e.target.value)); }} /></label>
      <button type="button" onClick={() => setPlaying(!playing)} disabled={reduced}>{playing ? "Hold paper" : "Roll paper"}</button>
      <button type="button" onClick={() => { setPlaying(false); setEnd(latest); }}>Latest</button>
      <button type="button" onClick={tear}>Tear off SVG ↗</button>
      <button type="button" onClick={() => window.print()}>Print strip</button>
    </div>
    <p className="caption mt-3">{source} · {shown.length} marks · UTC · drag the paper or use the time slider</p>
    <div className="seismo-detail" aria-live="polite">{chosen ? <><strong>{chosen.failed ? "Red ink · " : ""}{chosen.label}</strong><p>{stamp(Date.parse(chosen.at))} · {chosen.kind}{chosen.durationMs ? ` · ${(chosen.durationMs/1000).toFixed(0)} seconds` : ""}{chosen.rows ? ` · ${chosen.rows.toLocaleString("en-US")} rows` : ""}</p><a className="link" href={chosen.url} target="_blank" rel="noreferrer">Open public record ↗</a></> : <p>Select a mark to read its public record. Tremor size follows job runtime; these CI jobs do not report row counts.</p>}</div>
    <details className="seismo-events"><summary>Read the activity log ({events.length} events)</summary><ol>{events.slice().reverse().map(e => <li key={e.id}><time dateTime={e.at}>{stamp(Date.parse(e.at))}</time> · <a className="link" href={e.url}>{e.failed ? "Failed · " : ""}{e.label}</a>{e.durationMs ? ` · ${Math.round(e.durationMs/1000)}s` : ""}</li>)}</ol></details>
    <noscript><p>The saved trace and activity log above work without JavaScript. Enable JavaScript for scrubbing and SVG keepsakes.</p><style>{".seismo-controls{display:none}"}</style></noscript>
  </section>;
}
