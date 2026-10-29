"use client";

import { createElement, useEffect, useId, useRef, useState, useSyncExternalStore, type PointerEvent } from "react";
import { appearanceTags } from "@/lib/appearance-client";
import { inkFilter } from "@/lib/ink-modes";
import { blankPattern, decodePattern, demoPattern, encodePattern, hasBlot, ROWS, SCORE, scoreBlots, toggleBlot, type Pattern } from "@/lib/loom";
import { startLoom } from "@/lib/loom-client";
import { canvasPng, downloadBlob } from "@/lib/ink-download";
import { getServerSound, getSound, setSound, subscribeSound } from "@/lib/sound-client";
import "../ink-toys.css";

function PaperDial({ name, value, min, max, unit, onChange }: { name: string; value: number; min: number; max: number; unit: string; onChange: (value: number) => void }) {
  const angle = -135 + (value - min) / (max - min) * 270;
  function turn(event: PointerEvent<HTMLSpanElement>) {
    const box = event.currentTarget.getBoundingClientRect();
    const degrees = Math.atan2(event.clientX - box.left - box.width / 2, box.top + box.height / 2 - event.clientY) * 180 / Math.PI;
    onChange(Math.round(min + (Math.max(-135, Math.min(135, degrees)) + 135) / 270 * (max - min)));
  }
  return <label className="ink-dial">
    <span className="caption">{name} <output>{value}{unit}</output></span>
    <span className="ink-dialFace" data-dial={name}
      onClick={event => event.preventDefault()}
      onPointerDown={event => { if (event.button !== 0) return; event.preventDefault(); event.currentTarget.querySelector("input")?.focus(); event.currentTarget.setPointerCapture(event.pointerId); turn(event); }}
      onPointerMove={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) turn(event); }}
      onPointerUp={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); }}>
      <svg viewBox="0 0 100 100" aria-hidden="true">
        {[-135, -90, -45, 0, 45, 90, 135].map(tick => <path key={tick} d="M50 6v5" transform={`rotate(${tick} 50 50)`} />)}
        <circle cx="50" cy="52" r="33" className="ink-dialShadow" />
        <circle cx="50" cy="50" r="33" className="ink-dialPaper" />
        <path d="M50 49V25" transform={`rotate(${angle} 50 50)`} className="ink-dialNeedle" />
        <circle cx="50" cy="50" r="3" className="ink-dialPivot" />
      </svg>
      <input aria-label={name} aria-valuetext={`${value}${unit}`} title="Drag around the dial, or use the arrow keys" type="range" min={min} max={max} value={value} onChange={event => onChange(Number(event.target.value))} />
    </span>
  </label>;
}

export function Loom() {
  const [pattern, setPattern] = useState(blankPattern);
  const [ready, setReady] = useState(false), [playing, setPlaying] = useState(false), [step, setStep] = useState(-1);
  const [status, setStatus] = useState("Stamp a cell, or try a little starter loop. Sound is off until you choose it.");
  const latest = useRef(pattern), cancel = useRef<(() => void) | null>(null);
  const sound = useSyncExternalStore(subscribeSound, getSound, getServerSound);
  const id = `loom-${useId().replace(/:/g, "")}`;
  function change(next: Pattern) { latest.current = next; setPattern(next); }
  function stop() { cancel.current?.(); cancel.current = null; setPlaying(false); setStep(-1); }
  useEffect(() => {
    const restore = () => {
      const restored = decodePattern(location.hash) ?? blankPattern();
      latest.current = restored; setPattern(restored); setReady(true);
    };
    restore(); addEventListener("hashchange", restore);
    return () => removeEventListener("hashchange", restore);
  }, []);
  useEffect(() => {
    if (!ready) return;
    const timer = setTimeout(() => history.replaceState(history.state, "", `${location.pathname}${location.search}${encodePattern(pattern)}`), 180);
    return () => clearTimeout(timer);
  }, [pattern, ready]);
  useEffect(() => {
    const halt = () => { cancel.current?.(); cancel.current = null; setPlaying(false); setStep(-1); };
    halt(); // A cached route re-enters at rest after React Activity cleaned up its clock.
    const hidden = () => { if (document.hidden) halt(); };
    const unsub = subscribeSound(() => { if (!getSound()) halt(); });
    document.addEventListener("visibilitychange", hidden); addEventListener("pagehide", halt);
    return () => { cancel.current?.(); cancel.current = null; unsub(); document.removeEventListener("visibilitychange", hidden); removeEventListener("pagehide", halt); };
  }, []);
  function start() {
    stop(); setPlaying(true);
    cancel.current = startLoom(() => latest.current, setStep);
    setStatus(sound ? "Weaving your loop. Stop whenever you like." : "Weaving silently. Enable sound, then press Play to hear your loop.");
  }
  async function share() {
    const url = `${location.origin}${location.pathname}${encodePattern(latest.current)}`;
    history.replaceState(history.state, "", url);
    try { await navigator.clipboard.writeText(url); setStatus("Loop link copied. Anyone with it can weave this pattern."); }
    catch { setStatus("Your pattern is in the address bar. Copy that URL to share your loop."); }
  }
  async function print() {
    try {
      const p = latest.current, canvas = document.createElement("canvas");
      canvas.width = SCORE.width; canvas.height = SCORE.height;
      const ctx = canvas.getContext("2d"); if (!ctx) throw Error("Canvas unavailable");
      ctx.fillStyle = "#f5eddf"; ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#26231e"; ctx.font = "bold 56px serif"; ctx.fillText("Ink Loom", 65, 100);
      ctx.font = "24px monospace"; ctx.fillText(`${p.tempo} BPM · ${p.swing}% swing · 16 steps / 8 voices`, 65, 150);
      ctx.strokeStyle = "#c9bda8"; ctx.lineWidth = 1;
      for (let r = 0; r < 8; r++) {
        ctx.fillStyle = "#26231e"; ctx.font = "20px serif"; ctx.fillText(ROWS[r].label, 65, SCORE.top + r * SCORE.row + 36);
        for (let s = 0; s < 16; s++) ctx.strokeRect(SCORE.left + s * SCORE.cell, SCORE.top + r * SCORE.row, SCORE.cell, SCORE.row);
      }
      ctx.font = "17px monospace";
      for (let s = 0; s < 16; s++) ctx.fillText(String(s + 1), SCORE.left + s * SCORE.cell + 22, SCORE.top - 16);
      for (const blot of scoreBlots(p)) {
        ctx.beginPath(); ctx.ellipse(blot.x, blot.y, 15 + blot.row % 3, 12 + blot.step % 4, blot.row * .2, 0, Math.PI * 2); ctx.fill();
      }
      ctx.font = "18px monospace"; ctx.fillText("otohime.dev/play/loom · a rhythm woven in ink", 65, 790);
      downloadBlob(await canvasPng(canvas), "ink-loom-score.png"); setStatus("Your score is printed. A little loop, kept on paper.");
    } catch { setStatus("The print could not be prepared. Your pattern is safe here; try again."); }
  }
  return <section className="ink-toy" aria-label="Ink Loom sequencer" data-own-sound="" data-playing={playing} data-step={step} data-testid="loom">
    <div className="ink-tools">
      <button className="btn" type="button" aria-pressed={playing} disabled={!ready} onClick={playing ? stop : start}>{playing ? "Stop" : "Play"}</button>
      <button className="btn" type="button" aria-pressed={sound} onClick={() => { stop(); setSound(!sound, { silent: true }); }}>Sound {sound ? "on" : "off"}</button>
      <button className="btn" type="button" disabled={!ready} onClick={() => { stop(); change(demoPattern()); }}>Try a pattern</button>
      <button className="btn" type="button" disabled={!ready} onClick={() => { stop(); change(blankPattern()); }}>Clear</button>
    </div>
    <div className="ink-dials">
      <PaperDial name="Tempo" min={60} max={180} value={pattern.tempo} unit=" BPM" onChange={tempo => change({ ...latest.current, tempo })} />
      <PaperDial name="Swing" min={0} max={50} value={pattern.swing} unit="%" onChange={swing => change({ ...latest.current, swing })} />
    </div>
    <p id="loom-help" className="mb-3 text-sm text-muted">Tap or use Tab and Space to stamp. On a phone, scroll the paper sideways to reach all sixteen steps.</p>
    <div className="ink-scoreScroll" role="region" aria-label="Sixteen-step score, scroll horizontally" tabIndex={0}>
      <svg width="0" height="0" aria-hidden="true"><defs><filter id={id} x="-30%" y="-30%" width="160%" height="160%">
        {inkFilter().map((p, i) => p.tag === "feMerge" ? <feMerge key={i}>{p.nodes.map(n => <feMergeNode key={n} in={n} />)}</feMerge> : createElement(p.tag, { key: i, ...p.attrs, ...appearanceTags(p) }))}
      </filter></defs></svg>
      <table className="ink-score" aria-describedby="loom-help">
        <caption className="sr-only">Eight voices. Each row has sixteen stamp buttons.</caption>
        <thead><tr><th scope="col">Voice</th>{Array.from({ length: 16 }, (_, s) => <th key={s} scope="col" data-current={step === s} aria-current={step === s ? "step" : undefined}>{String(s + 1).padStart(2, "0")}</th>)}</tr></thead>
        <tbody>{ROWS.map((voice, r) => <tr key={voice.label}><th scope="row">{voice.label}</th>{Array.from({ length: 16 }, (_, s) => <td key={s} data-current={step === s}>
          <button type="button" disabled={!ready} aria-label={`${voice.label}, step ${s + 1}`} aria-pressed={hasBlot(pattern, r, s)} onClick={() => change(toggleBlot(latest.current, r, s))}>
            <svg viewBox="0 0 44 44" aria-hidden="true" className="ink-blot" style={{ filter: `url(#${id})` }}><path d={`M10 13Q${20 + r % 3} 5 33 14Q41 ${25 + s % 4} 29 34Q12 41 8 26Q5 20 10 13Z`} /></svg>
            <span aria-hidden="true" className="ink-empty">·</span>
          </button>
        </td>)}</tr>)}</tbody>
      </table>
    </div>
    <div className="ink-tools">
      <button type="button" className="btn" disabled={!ready} onClick={() => void share()}>Copy loop link ↗</button>
      <button type="button" className="btn" disabled={!ready} onClick={() => void print()}>Press to print ↓</button>
      <span className="caption" data-testid="loom-step">{playing && step >= 0 ? `Step ${step + 1} / 16` : "Paper at rest"}</span>
    </div>
    <p role="status" className="mt-4 text-sm text-muted">{status}</p>
  </section>;
}
