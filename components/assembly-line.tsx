"use client";

import { useEffect, useRef, useState, type CSSProperties, type FormEvent } from "react";
import { assemblyStations } from "@/content/assembly";
import { assemblyProgress, CRATE_LIMIT, processCrate } from "@/lib/assembly";
import "./assembly-line.css";

function Gear({ x, y, angle }: { x: number; y: number; angle: number }) {
  return <g transform={`translate(${x} ${y}) rotate(${angle})`}><path d="M-7 -17h14l2 7 7 3v14l-7 2-3 7h-14l-2-7-7-3v-14l7-2Z" fill="var(--paper-2)" /><circle r="6" fill="var(--paper)" /></g>;
}

function Factory({ progress, word, vertical = false, still = false }: { progress: number; word: string; vertical?: boolean; still?: boolean }) {
  const active = Math.round(progress);
  return <svg className={vertical ? "assembly-vertical" : "assembly-horizontal"} viewBox={vertical ? "0 0 140 950" : "0 0 1000 330"} aria-hidden="true">
    {!vertical && <><text x="20" y="28" className="assembly-small">FIG. 02 / INK ASSEMBLY LINE</text><text x="980" y="28" textAnchor="end" className="assembly-small">RAW → READY</text></>}
    <g stroke="var(--ink)" strokeWidth="2" strokeLinejoin="round">
      {vertical ? <path d="M70 45V855" strokeWidth="32" stroke="var(--paper-2)" /> : <><path d="M35 231H965" strokeWidth="34" stroke="var(--paper-2)" /><rect x="24" y="213" width="952" height="36" rx="18" fill="none" /></>}
      <path d={vertical ? "M70 45V855" : "M45 231H955"} fill="none" strokeDasharray="3 17" strokeDashoffset={still ? 0 : -progress * 70} />
      {assemblyStations.map((station, i) => {
        const x = vertical ? 70 : 110 + i * 195, y = vertical ? 65 + i * 185 : 110;
        const pressed = !still && Math.abs(progress - i) < .22;
        return <g key={station.id} transform={`translate(${x} ${y})`}>
          <path d="M-53 74l3-69 20-9H41l11 14-1 64Z" fill={`var(${station.colour})`} />
          <path d="M-53 74H51v10H-53ZM-44 84v12m82-12v12" fill="var(--paper)" />
          {i === 0 && <path d="M-31 -4l-11-32H35L24-4" fill="var(--paper)" />}
          {i === 1 && <path d="M-26 11l43 35m-43 0l43-35" fill="none" strokeWidth="4" />}
          {i === 2 && <path d="M-30 10h60l-11 16v21h-39V26Z" fill="var(--paper)" />}
          {i === 3 && <path d="M-27 8h56v43h-56Zm0 14h56m-56 15h56" fill="var(--paper)" />}
          {i === 4 && <><rect x="-28" y="7" width="57" height="39" fill="var(--paper)" /><path d="M-20 35l10-9 10 3L19 15" fill="none" /></>}
          <Gear x={-32} y={62} angle={still ? 0 : progress * 110 + i * 30} />
          <g transform={`translate(18 ${pressed ? 9 : 0})`}><path d="M-8 49h16v26h10v7h-36v-7h10Z" fill="var(--ink)" /></g>
          <text y={vertical ? 116 : 177} textAnchor="middle" stroke="none" fill="var(--ink)" className="assembly-machineLabel">{String(i + 1).padStart(2, "0")} {station.title.toUpperCase()}</text>
          {(still || i <= active) && <g transform="translate(46 -12) rotate(-12)"><circle r="14" fill="var(--paper)" /><path d="M-7 0l5 6L8-6" fill="none" /></g>}
        </g>;
      })}
      {!still && <g data-testid={vertical ? "assembly-crate-mobile" : "assembly-crate"} transform={vertical ? `translate(70 ${102 + progress * 185})` : `translate(${110 + progress * 195} 206)`}>
        <path d="M-34 -24l67 2-1 40-64 2Z" fill="var(--paper)" /><path d="M-30 -17l58 2M-29 12l54-1M-17-22v38m34-37v37" strokeWidth="1" fill="none" />
        <rect x="-28" y="-10" width="56" height="17" fill="var(--paper-2)" strokeWidth="1" />
        <text textAnchor="middle" y="2" fill="var(--ink)" stroke="none" className="assembly-crateLabel">{word.slice(0, 8) || "DATA"}</text>
      </g>}
    </g>
  </svg>;
}

export function AssemblyLine() {
  const root = useRef<HTMLElement>(null);
  const cards = useRef<HTMLOListElement>(null);
  const [scroll, setScroll] = useState(0);
  const [run, setRun] = useState<number | null>(null);
  const [input, setInput] = useState("");
  const [crate, setCrate] = useState<ReturnType<typeof processCrate> | null>(null);
  const [reduced, setReduced] = useState(false);
  const [ready, setReady] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => {
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    function update() {
      frame = 0;
      if (media.matches || !cards.current) return;
      const centers = [...cards.current.children].map(node => { const rect = node.getBoundingClientRect(); return rect.top + rect.height / 2; });
      setScroll(assemblyProgress(centers, innerHeight * .72));
    }
    function queue() { if (!frame) frame = requestAnimationFrame(update); }
    function motion() {
      setReady(true);
      setReduced(media.matches);
      if (root.current) root.current.dataset.motion = media.matches ? "reduced" : "scroll";
      if (media.matches) { timers.current.forEach(clearTimeout); setRun(value => value === null ? null : 4); }
      queue();
    }
    motion();
    window.addEventListener("scroll", queue, { passive: true });
    window.addEventListener("resize", queue);
    media.addEventListener("change", motion);
    return () => { cancelAnimationFrame(frame); timers.current.forEach(clearTimeout); window.removeEventListener("scroll", queue); window.removeEventListener("resize", queue); media.removeEventListener("change", motion); };
  }, []);
  const progress = run ?? scroll;
  const active = Math.round(progress);
  function drop(event: FormEvent) {
    event.preventDefault();
    timers.current.forEach(clearTimeout);
    const result = processCrate(input);
    setCrate(result);
    if (reduced) { setRun(4); return; }
    setRun(0);
    timers.current = [1, 2, 3, 4].map(step => setTimeout(() => setRun(step), step * 700));
  }
  return <section ref={root} className="assembly-line" aria-labelledby="assembly-title" data-testid="assembly-line" data-active-station={assemblyStations[active].id}>
    <header className="assembly-heading">
      <p className="caption">A field guide to my data work</p>
      <h2 id="assembly-title">From a little mess to something useful.</h2>
      <p>Five stations. One paper data crate. Scroll to follow the work.</p>
    </header>
    <form className="assembly-form" onSubmit={drop}>
      <label htmlFor="visitor-crate">Drop your own crate <span className="text-muted">— a word, any word</span></label>
      <div className="assembly-inputRow"><input id="visitor-crate" name="crate" value={input} disabled={!ready} maxLength={CRATE_LIMIT} onChange={event => setInput(event.target.value)} placeholder="paperwork" autoComplete="off" /><button type="submit" disabled={!ready} className="chip">Run my crate →</button></div>
      <p className="assembly-readout" role="status" aria-live="polite">{crate && run !== null ? `${assemblyStations[run].title}: ${crate.stages[run]}${run === 4 ? ` · ${crate.count} characters packed.` : ""}` : "Your word stays on this page. The machines trim, chop, sort and box it."}</p>
      {crate && <ol className="assembly-receipt" aria-label="Your crate receipt">{crate.stages.map((value, i) => <li key={i}><strong>{assemblyStations[i].title}</strong><span>{value}</span></li>)}</ol>}
      {run !== null && <button type="button" className="link" onClick={() => { timers.current.forEach(clearTimeout); setRun(null); }}>Follow the scroll again</button>}
      <noscript>JavaScript runs the word crate. The complete factory guide below is readable without it.</noscript>
    </form>
    <div className="assembly-story">
      <div className="assembly-stage">
        <div className="assembly-moving"><Factory progress={progress} word={crate && run !== null ? crate.stages[run] : "DATA"} /><Factory vertical progress={progress} word={crate && run !== null ? crate.stages[run] : "DATA"} /></div>
        <div className="assembly-static"><Factory progress={0} word="DATA" still /><Factory vertical progress={0} word="DATA" still /></div>
        <p className="assembly-stageCaption">{String(active + 1).padStart(2, "0")} / {assemblyStations[active].machine}</p>
      </div>
      <ol ref={cards} className="assembly-cards">
        {assemblyStations.map((station, i) => <li key={station.id} data-assembly-station={station.id} data-active={active === i} style={{ "--station-colour": `var(${station.colour})` } as CSSProperties}>
          <span className="assembly-number">{String(i + 1).padStart(2, "0")}</span><p className="caption">{station.machine}</p>
          <h3>{station.title}</h3><p className="assembly-project">{station.project}</p><p>{station.detail}</p>
          <dl><dt>Tools</dt><dd>{station.tech}</dd><dt>Impact</dt><dd>{station.impact}</dd></dl>
        </li>)}
      </ol>
    </div>
  </section>;
}
