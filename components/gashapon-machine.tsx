"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { STICKERS, stickerById } from "@/content/stickers";
import { drawSticker, nextBatch, stockBoard } from "@/lib/gashapon";
import { updateCollection, useCollection } from "@/lib/sticker-store";
import { playCustomCue, play } from "@/lib/sound-client";
import { InkSticker } from "./ink-sticker";
import { HoloFoil } from "./holo-foil";
import "./ink-toys.css";

const crankCue = { db: -28, wave: "triangle" as const, notes: [{ hz: 260, at: 0, attack: .002, decay: .025 }] };
export function GashaponMachine() {
  const { collection: s, durable } = useCollection();
  const [inserted, setInserted] = useState(false);
  const [angle, setAngle] = useState(0);
  const [phase, setPhase] = useState("idle");
  const [message, setMessage] = useState("");
  const drag = useRef<{ angle: number; total: number; cx: number; cy: number; pointer: number } | null>(null);
  const locked = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const board = stockBoard(s), remaining = board.reduce((n, x) => n + x.remaining, 0);
  const sticker = s.last ? stickerById(s.last) : null;
  function turn() {
    if (!inserted || locked.current) return;
    locked.current = true; drag.current = null;
    playCustomCue(crankCue);
    let drawn = false;
    const result = updateCollection(state => { const next = drawSticker(state, crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296); drawn = next !== state; return next; });
    setInserted(false); setAngle(360);
    if (!drawn || !result.last) { locked.current = false; setMessage("No coin or stock left. Explore another page for a paper coin."); return; }
    const item = stickerById(result.last)!;
    setMessage(`${item.name} · ${item.rarity}${result.owned[item.id] > 1 ? ` · duplicate, ${result.owned[item.id]} copies kept` : " · a new find!"}`);
    play("stamp");
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) { setPhase("open"); locked.current = false; }
    else { setPhase("rolling"); timer.current = setTimeout(() => { setPhase("capsule"); locked.current = false; }, 850); }
  }
  function insert() {
    if (!s.coins || !remaining || locked.current) return;
    setInserted(true); setAngle(0); setPhase("idle"); setMessage("Paper coin in. Turn clockwise once, or press Enter on the crank."); play("open");
  }
  return <div className="ink-toy">
    <div className="toy-toolbar"><p><strong data-testid="coin-count">{s.coins}</strong> paper coins</p><Link href="/play/gashapon/album" className="btn">Open sticker book →</Link></div>
    <p className="toy-note">One free coin per different page each day, up to 12. Hidden finds earn one more. No purchases. Collection and stock belong to this browser.</p>
    {!durable && <p role="status">Storage is unavailable. You can play, but this collection lasts only until you leave.</p>}
    <div className="gasha-layout">
      <div className="gasha-machine">
        <svg viewBox="0 0 340 420" aria-hidden="true" className="machine-drawing">
          <path d="M62 26Q170 5 278 27L286 204 54 205Z" fill="#e4cbbb" stroke="#493b35" strokeWidth="3" />
          <path d="M73 36Q169 21 267 38L271 184 69 188Z" fill="#f4ead6" stroke="#493b35" strokeWidth="2" />
          {Array.from({ length: 13 }, (_, i) => <g key={i} transform={`translate(${93 + (i % 4) * 50} ${64 + Math.floor(i / 4) * 34}) rotate(${i * 17})`}>
            <circle r="22" fill={["#bccbc1", "#dbb28d", "#ceb5ca", "#e3cd91"][i % 4]} stroke="#57473b" strokeWidth="1.5" /><path d="M-22 0h44" stroke="#57473b" /></g>)}
          <path d="m53 203 235-3 8 187-252 4Z" fill="#a95142" stroke="#493b35" strokeWidth="3" />
          <path d="M66 216h205v153H62Z" fill="#eddec2" stroke="#493b35" strokeWidth="2" />
          <text x="168" y="244" textAnchor="middle" fontFamily="serif" fontSize="18" fill="#493b35">INK GASHAPON</text>
          <path d="M96 337q70-22 148 0v28H94Z" fill="#4a423a" />
          <path d="M127 397v12m89-12v12M71 19l6-9m183 9-6-9" stroke="#493b35" strokeWidth="5" />
        </svg>
        <button type="button" className="paper-coin" disabled={!s.coins || !remaining || inserted || phase === "rolling"} onClick={insert} aria-label="Insert paper coin">{inserted ? "↓ in!" : "① drop coin"}</button>
        <button type="button" className="gasha-crank" aria-label="Turn crank clockwise" data-own-sound="" disabled={!inserted || phase === "rolling"}
          onClick={e => { if (e.detail === 0) turn(); }}
          onPointerDown={e => { if (!inserted || locked.current) return; e.currentTarget.setPointerCapture(e.pointerId); const b = e.currentTarget.getBoundingClientRect(); const cx = b.left + b.width / 2, cy = b.top + b.height / 2; drag.current = { angle: Math.atan2(e.clientY - cy, e.clientX - cx), total: 0, cx, cy, pointer: e.pointerId }; }}
          onPointerMove={e => { const d = drag.current; if (!d || d.pointer !== e.pointerId) return; const a = Math.atan2(e.clientY - d.cy, e.clientX - d.cx); let delta = (a - d.angle) * 180 / Math.PI; if (delta > 180) delta -= 360; if (delta < -180) delta += 360; const previous = Math.floor(d.total / 30); d.total = Math.max(0, d.total + delta); d.angle = a; setAngle(d.total); if (Math.floor(d.total / 30) > previous) playCustomCue(crankCue); if (d.total >= 350) turn(); }}
          onPointerUp={() => { drag.current = null; setAngle(0); }} onPointerCancel={() => { drag.current = null; setAngle(0); }}>
          <span style={{ transform: `rotate(${angle}deg)` }}>━</span><small>TURN ↻</small>
        </button>
        {phase === "rolling" && <span className="rolling-capsule" aria-hidden="true">◒</span>}
      </div>
      <div>
        <p className="toy-kicker">A small surprise, in ink</p>
        <h2 className="toy-subtitle">Turn a little curiosity<br />into something to keep.</h2>
        <p className="toy-note">Drop a paper coin, then drag the handle clockwise through one full turn. Keyboard: Tab to the crank, then Enter or Space.</p>
        <div className="gasha-reveal" aria-live="polite">
          {phase === "rolling" ? <p>The capsule is rolling…</p> : phase === "capsule" ? <button type="button" className="capsule-open" onClick={() => { setPhase("open"); play("rustle"); }}>◒<span>Crack open your capsule</span></button> : sticker && !inserted ? <>
            <div className={`sticker-display ${sticker.rarity === "secret" ? "secret-sticker" : ""}`}><InkSticker sticker={sticker} />{sticker.rarity === "secret" && <HoloFoil />}</div>
            <p>{message || `${sticker.name} · ${sticker.rarity} · ${s.owned[sticker.id]} kept`}</p>
          </> : <p>{inserted ? "A paper coin, a clockwise turn…" : "Your next ink companion is waiting."}</p>}
        </div>
        <p role="status" className="toy-note">{inserted ? message : "Every duplicate stays in your book. Nothing is discarded."}</p>
      </div>
    </div>
    <section className="kuji-board" aria-labelledby="stock-heading">
      <div className="toy-toolbar"><h2 id="stock-heading">The honest kuji board</h2><span>Local batch {s.batch} · <strong data-testid="stock-total">{remaining}</strong> left</span></div>
      <table><caption className="toy-note">Drawn without replacement. These are the odds of your next capsule.</caption><thead><tr><th>Ink tier</th><th>Left / start</th><th>Next draw</th></tr></thead><tbody>
        {board.map(row => <tr key={row.rarity}><th>{row.rarity === "secret" ? "Secret · holo foil" : row.rarity}</th><td>{row.remaining} / {row.initial}</td><td>{(row.odds * 100).toFixed(2)}%</td></tr>)}
      </tbody></table>
      {!remaining && <button type="button" className="btn" onClick={() => updateCollection(nextBatch)}>Open a fresh batch</button>}
      <details><summary>See every sticker and its exact stock</summary><ul className="stock-list">{STICKERS.filter(x => !x.hidden).map(x => <li key={x.id}>{x.name} <span>{s.stock[x.id]} left · {remaining ? (100 * s.stock[x.id] / remaining).toFixed(2) : "0.00"}%</span></li>)}</ul></details>
    </section>
    <p className="toy-note">Scavenger’s hint: peek in the margins of Notes, Sketches, and a lost page. The old ↑ ↑ ↓ ↓ ← → ← → B A trick remembers you, too.</p>
  </div>;
}
