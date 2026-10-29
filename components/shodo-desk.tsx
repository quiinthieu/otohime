"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type PointerEvent } from "react";
import { KANJI, KANJIVG_CREDIT } from "@/content/kanji";
import { localDay } from "@/lib/gashapon";
import { dailyKanji, scoreSheet } from "@/lib/shodo";
import { brushLoad, createBrush, deposit, fibreBleed, type InkMark, type InkPoint } from "@/lib/brush";
import { paintMarks, paintSeal, paintWashi } from "@/lib/brush-canvas";
import { keepPng } from "@/lib/ink-export";
import { play } from "@/lib/sound-client";
import { EnsoLoader } from "./enso-loader";
import "./ink-toys.css";

type Stroke = { points: InkPoint[]; marks: InkMark[] };
const subscribeDay = (fn: () => void) => { const id = setInterval(fn, 60000); return () => clearInterval(id); };
export function ShodoDesk() {
  const day = useSyncExternalStore(subscribeDay, () => localDay(), () => "");
  const kanji = day ? dailyKanji(day) : KANJI[0];
  const canvas = useRef<HTMLCanvasElement>(null), paper = useRef<HTMLCanvasElement>(null);
  const brush = useRef(createBrush());
  const history = useRef<Stroke[]>([]), current = useRef<Stroke | null>(null);
  const pointer = useRef<number | null>(null);
  const [ink, setInk] = useState(100), [count, setCount] = useState(0);
  const [ghost, setGhost] = useState(true), [name, setName] = useState("");
  const [seal, setSeal] = useState<string | null>(null), [message, setMessage] = useState("");
  const [feedback, setFeedback] = useState("Follow the numbered ghost, one unhurried stroke at a time.");
  useEffect(() => { const ctx = paper.current?.getContext("2d"); if (ctx) paintWashi(ctx); }, [day]);
  function redraw(nextSeal = seal) {
    const ctx = canvas.current?.getContext("2d"); if (!ctx) return;
    ctx.clearRect(0, 0, 600, 600);
    history.current.forEach(stroke => paintMarks(ctx, stroke.marks));
    if (nextSeal !== null) paintSeal(ctx, nextSeal);
  }
  function point(e: { clientX: number; clientY: number; timeStamp: number; pressure: number; pointerType: string }): InkPoint {
    const b = canvas.current!.getBoundingClientRect();
    return { x: Math.max(0, Math.min(600, (e.clientX - b.left) / b.width * 600)), y: Math.max(0, Math.min(600, (e.clientY - b.top) / b.height * 600)), t: e.timeStamp, pressure: e.pointerType === "pen" ? Math.max(.02, e.pressure) : undefined };
  }
  function add(p: InkPoint) {
    const stroke = current.current;
    if (!stroke || stroke.points.length >= 512 || stroke.marks.length >= 16000) return;
    const a = stroke.points.at(-1)!;
    const result = deposit(brush.current, a, p);
    brush.current = result.brush; stroke.points.push(p); stroke.marks.push(...result.marks);
    paintMarks(canvas.current!.getContext("2d")!, result.marks);
  }
  function begin(e: PointerEvent<HTMLCanvasElement>) {
    if (pointer.current !== null || (e.pointerType === "mouse" && e.button !== 0)) return;
    if (history.current.length >= 64 || history.current.reduce((n, s) => n + s.marks.length, 0) > 100000) { setMessage("This sheet is full of ink. Save it, then start a fresh sheet."); return; }
    e.currentTarget.setPointerCapture(e.pointerId); pointer.current = e.pointerId;
    const p = point(e); current.current = { points: [p], marks: [] };
    add({ ...p, x: p.x + .1, t: p.t + 8 });
  }
  function move(e: PointerEvent<HTMLCanvasElement>) {
    if (pointer.current !== e.pointerId) return;
    const coalesced = e.nativeEvent.getCoalescedEvents?.() ?? [];
    for (const event of (coalesced.length ? coalesced : [e]).slice(-24)) add(point(event));
  }
  function finish(e: PointerEvent<HTMLCanvasElement>) {
    if (pointer.current !== e.pointerId || !current.current) return;
    const p = point(e); add({ ...p, pressure: .02 });
    const stroke = current.current;
    const bleed = fibreBleed(stroke.points, history.current.length + 17);
    stroke.marks.push(...bleed); paintMarks(canvas.current!.getContext("2d")!, bleed);
    history.current.push(stroke); current.current = null; pointer.current = null;
    setCount(history.current.length); setInk(Math.round(brushLoad(brush.current) * 100));
    const score = scoreSheet(history.current.map(s => s.points.map(p => ({ x: p.x / 600 * 109, y: p.y / 600 * 109 }))), kanji);
    setFeedback(`${"★".repeat(score.stars)}${"☆".repeat(3 - score.stars)} ${score.hint}`);
    if (seal !== null) paintSeal(canvas.current!.getContext("2d")!, seal);
  }
  function clear() { history.current = []; current.current = null; pointer.current = null; brush.current = createBrush(); setCount(0); setInk(100); setSeal(null); setFeedback("A fresh sheet. Take your time."); redraw(null); }
  async function save(share: boolean) {
    try {
      const image = document.createElement("canvas"); image.width = 1200; image.height = 1320;
      const ctx = image.getContext("2d")!;
      ctx.fillStyle = "#f6eed8"; ctx.fillRect(0, 0, image.width, image.height); ctx.save(); ctx.scale(2, 2);
      paintWashi(ctx);
      if (ghost) { ctx.save(); ctx.scale(600 / 109, 600 / 109); ctx.strokeStyle = "#736755"; ctx.globalAlpha = .13; ctx.lineWidth = 1.2; kanji.paths.forEach(d => ctx.stroke(new Path2D(d))); ctx.restore(); }
      ctx.drawImage(canvas.current!, 0, 0); ctx.fillStyle = "#625740"; ctx.font = "12px serif";
      ctx.fillText(`${kanji.character} · ${kanji.meaning} · ${day} · otohime.dev`, 22, 620);
      ctx.font = "8px monospace"; ctx.fillText(KANJIVG_CREDIT, 22, 644); ctx.restore();
      setMessage(await keepPng(image, `otohime-shodo-${day}.png`, share));
    } catch (e) { setMessage((e as Error).message); }
  }
  if (!day) return <EnsoLoader />;
  return <div className="ink-toy">
    <div className="toy-toolbar"><h2 className="toy-subtitle">{kanji.character} <small>— {kanji.meaning}</small></h2><span className="toy-kicker">{day || "Daily practice"} · {kanji.reading} · {kanji.paths.length} strokes</span></div>
    <p className="toy-note">Trace the faint numbered strokes. A pen’s pressure spreads the bristles; mouse and touch use speed to taper. The brush runs dry as you work. Dip it often. There is no perfect score to chase.</p>
    <div className="shodo-workspace">
      <div className="shodo-paper">
        <canvas ref={paper} width="600" height="600" aria-hidden="true" style={{ pointerEvents: "none" }} />
        {ghost && <svg className="kanji-ghost" viewBox="0 0 109 109" aria-hidden="true"><path d="M54.5 5v99M5 54.5h99" stroke="#8e7c5c" strokeDasharray="1 2" opacity=".15" />
          {kanji.paths.map((d, i) => <g key={d}><path d={d} fill="none" stroke="#5c5142" strokeWidth="1.2" opacity=".16" /><text x={kanji.strokes[i][0].x - 5} y={kanji.strokes[i][0].y} fontSize="4" fill="#9d4a3a" opacity=".7">{i + 1}</text><circle cx={kanji.strokes[i][0].x} cy={kanji.strokes[i][0].y} r=".8" fill="#9d4a3a" opacity=".4" /></g>)}
        </svg>}
        <canvas ref={canvas} width="600" height="600" role="img" aria-label={`Practice canvas for ${kanji.character}, ${kanji.meaning}. Draw with a pen, mouse, or touch.`} data-testid="shodo-canvas"
          onPointerDown={begin} onPointerMove={move} onPointerUp={finish} onPointerCancel={finish} onLostPointerCapture={e => { if (pointer.current === e.pointerId) finish(e); }} />
      </div>
      <div className="shodo-tools">
        <label>Ink in the bristles <meter value={ink} min="0" max="100" aria-label="Brush ink remaining" /><span data-testid="ink-load">{ink}% · {ink < 20 ? "time to dip" : "ready for a mark"}</span></label>
        <button type="button" className="btn" onClick={() => { brush.current = createBrush(); setInk(100); setMessage("Fresh ink in every bristle."); play("open"); }}>Dip brush in ink</button>
        <label><span><input type="checkbox" checked={ghost} onChange={e => setGhost(e.target.checked)} /> Show stroke guide</span></label>
        <button type="button" className="btn" disabled={!count} onClick={() => { history.current.pop(); setCount(history.current.length); redraw(); setFeedback("One mark lifted. Try it once more."); }}>Undo last stroke</button>
        <button type="button" className="btn" onClick={clear}>Fresh sheet</button>
        <label>Your seal (up to 4 characters)<input type="text" value={name} maxLength={12} onChange={e => setName(Array.from(e.target.value).slice(0, 4).join(""))} placeholder="印" autoComplete="off" /></label>
        <button type="button" className="btn" onClick={() => { const value = name.trim() || "印"; setSeal(value); redraw(value); play("stamp"); setMessage("Signed in vermilion. A small mark of being here."); }}>Press red seal</button>
        <button type="button" className="btn" onClick={() => save(false)}>Save sheet PNG</button>
        <button type="button" className="btn" onClick={() => save(true)}>Share sheet image</button>
      </div>
    </div>
    <div className="shodo-score" role="status"><p>{feedback}</p><p className="toy-note">{count} brush strokes · Every sheet can be saved, whatever its stars.</p></div>
    <p role="status">{message}</p>
    <p className="toy-note">Stroke guides: <a href="https://kanjivg.tagaini.net/" className="underline">KanjiVG, Ulrich Apel</a>, <a href="https://creativecommons.org/licenses/by-sa/3.0/" className="underline">CC BY-SA 3.0</a>. <a href={`/kanji/${kanji.id}.svg`} className="underline">Original SVG</a> · <a href="/kanji/COPYING.txt" className="underline">Bundled license</a>. Your drawing and seal stay on this device.</p>
  </div>;
}
