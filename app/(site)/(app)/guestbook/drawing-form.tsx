"use client";
import { useEffect, useRef, useState, type PointerEvent } from "react";
import type { Stroke } from "@/lib/guestbook";
import { brushWidth, drawingPoint, DRAWING_LIMIT_MS, readyStrokes } from "@/lib/guestbook-drawing";

const colours = ["#231e16", "#ef6a4c", "#76a0e2"] as const;
const labels = ["Sumi", "Coral", "Blue"] as const;

export function DrawingForm() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const start = useRef<number | null>(null);
  const current = useRef<Stroke | null>(null);
  const lastMove = useRef(0);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [colour, setColour] = useState<0 | 1 | 2>(0);
  const [seconds, setSeconds] = useState(60);
  const [started, setStarted] = useState(false);
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [website, setWebsite] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [done, setDone] = useState(false);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const element = canvas.current;
    const context = element?.getContext("2d");
    if (!element || !context) return;
    context.clearRect(0, 0, 240, 160);
    context.fillStyle = "#fbf6ea";
    context.fillRect(0, 0, 240, 160);
    for (const stroke of [...strokes, ...(current.current ? [current.current] : [])]) {
      context.strokeStyle = colours[stroke.c];
      context.lineCap = "round";
      context.lineJoin = "round";
      for (let i = 1; i < stroke.w.length; i++) {
        context.lineWidth = 0.5 + 0.3 * stroke.w[i];
        context.beginPath();
        context.moveTo(stroke.p[2 * i - 2], stroke.p[2 * i - 1]);
        context.lineTo(stroke.p[2 * i], stroke.p[2 * i + 1]);
        context.stroke();
      }
    }
  }, [strokes, version]);

  useEffect(() => {
    if (!started || done) return;
    const timer = window.setInterval(() => {
      const left = Math.max(0, Math.ceil((DRAWING_LIMIT_MS - (performance.now() - start.current!)) / 1000));
      setSeconds(left);
      if (left === 0) {
        const stroke = current.current;
        if (stroke) {
          if (stroke.w.length === 1) { stroke.p.push(...stroke.p); stroke.w.push(stroke.w[0]); }
          stroke.d = Math.max(1, DRAWING_LIMIT_MS - stroke.t0);
          setStrokes((value) => [...value, stroke]);
        }
        current.current = null;
        window.clearInterval(timer);
      }
    }, 200);
    return () => window.clearInterval(timer);
  }, [started, done]);

  function position(event: PointerEvent<HTMLCanvasElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    return drawingPoint((event.clientX - rect.left) * 240 / rect.width, (event.clientY - rect.top) * 160 / rect.height);
  }
  function pointerDown(event: PointerEvent<HTMLCanvasElement>) {
    if (busy || done || seconds === 0 || strokes.length >= 40) return;
    if (start.current === null) { start.current = performance.now(); setStarted(true); }
    const t0 = Math.min(59999, Math.round(performance.now() - start.current));
    const [x, y] = position(event);
    current.current = { c: colour, p: [x, y], w: [brushWidth(event.pressure, 0)], t0, d: 1 };
    lastMove.current = performance.now();
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function pointerMove(event: PointerEvent<HTMLCanvasElement>) {
    const stroke = current.current;
    if (!stroke || start.current === null) return;
    if (performance.now() - start.current >= DRAWING_LIMIT_MS) { pointerUp(event); return; }
    const [x, y] = position(event);
    const last = stroke.p.length - 2;
    const distance = Math.hypot(x - stroke.p[last], y - stroke.p[last + 1]);
    if (distance < 2 || strokes.reduce((total, item) => total + item.w.length, stroke.w.length) >= 300) return;
    const now = performance.now();
    const elapsed = Math.max(1, now - start.current - stroke.t0);
    const speed = distance / Math.max(1, now - lastMove.current) * 16;
    lastMove.current = now;
    stroke.p.push(x, y);
    stroke.w.push(brushWidth(event.pressure, speed));
    stroke.d = Math.min(DRAWING_LIMIT_MS - stroke.t0, Math.max(1, Math.round(elapsed)));
    setVersion((value) => value + 1);
  }
  function pointerUp(event: PointerEvent<HTMLCanvasElement>) {
    const stroke = current.current;
    if (!stroke) return;
    if (stroke.w.length === 1) { stroke.p.push(...stroke.p); stroke.w.push(stroke.w[0]); }
    stroke.d = Math.min(DRAWING_LIMIT_MS - stroke.t0, Math.max(1, Math.round(performance.now() - (start.current ?? performance.now()) - stroke.t0)));
    current.current = null;
    setStrokes((value) => [...value, stroke]);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }
  async function submit() {
    if (!strokes.length || busy) return;
    setBusy(true);
    setMessage("");
    const durationMs = Math.min(DRAWING_LIMIT_MS, Math.max(1, ...strokes.map((stroke) => stroke.t0 + stroke.d)));
    try {
      const response = await fetch("/api/guestbook", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ v: 1, name, note, website, durationMs, strokes: readyStrokes(strokes) }),
      });
      const result = await response.json();
      if (!response.ok) throw Error(result.message || "Please try again.");
      setDone(true);
      setMessage("Thank you. Your drawing is waiting for the owner to pin it to the wall.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Please try again."); }
    finally { setBusy(false); }
  }
  return <section className="guestbook-desk" aria-label="Draw a guestbook doodle">
    <h2 className="caption">Leave a little ink</h2>
    <p className="text-sm text-muted">Draw for up to 60 seconds. Your sketch stays private until it is approved.</p>
    <div className="guestbook-tools" role="group" aria-label="Ink colour">
      {labels.map((label, index) => <button key={label} type="button" className="btn btn-sm" aria-pressed={colour === index} onClick={() => setColour(index as 0 | 1 | 2)}>{label}</button>)}
      <button type="button" className="btn btn-sm" disabled={!strokes.length || busy || done} onClick={() => setStrokes((value) => value.slice(0, -1))}>Undo</button>
      <span className="text-sm" role="timer">{seconds}s left</span>
    </div>
    <canvas ref={canvas} width={240} height={160} className="guestbook-canvas" role="img" aria-label="Drawing area, 240 by 160 pixels" onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerUp} />
    <div className="guestbook-fields">
      <label>Name (optional)<input className="field" maxLength={24} value={name} onChange={(event) => setName(event.target.value)} /></label>
      <label>One-line note (optional)<input className="field" maxLength={80} value={note} onChange={(event) => setNote(event.target.value)} /></label>
      <label className="guestbook-trap" aria-hidden="true">Website<input tabIndex={-1} autoComplete="off" value={website} onChange={(event) => setWebsite(event.target.value)} /></label>
    </div>
    <button type="button" className="btn" disabled={!strokes.length || busy || done} onClick={() => void submit()}>{busy ? "Sending…" : "Pin for review"}</button>
    <p role="status" className="mt-3">{message}</p>
  </section>;
}
