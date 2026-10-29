"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { collectStrokes } from "@/lib/plotter-browser";
import { optimiseStrokes, plotterSvg, type PlotStroke } from "@/lib/plotter";
import { brownNoise, getSound, subscribeSound } from "@/lib/sound-client";

type Drawing = ReturnType<typeof optimiseStrokes> & { width: number; height: number; limited: boolean };

/** Own, quiet noise source: releasing playback tears down every node and context. */
function scratch() {
  if (!getSound() || document.hidden || typeof AudioContext !== "function") return () => {};
  try {
    const ctx = new AudioContext();
    const buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    buffer.getChannelData(0).set(brownNoise(282, ctx.sampleRate));
    const source = ctx.createBufferSource(); source.buffer = buffer; source.loop = true;
    const filter = ctx.createBiquadFilter(); filter.type = "highpass"; filter.frequency.value = 900;
    const gain = ctx.createGain(); gain.gain.value = 0.025;
    source.connect(filter).connect(gain).connect(ctx.destination); source.start();
    void ctx.resume().catch(() => {});
    let stopped = false;
    const stop = () => { if (stopped) return; stopped = true; source.stop(); source.disconnect(); filter.disconnect(); gain.disconnect(); void ctx.close().catch(() => {}); };
    const unsub = subscribeSound(() => { if (!getSound()) stop(); });
    return () => { unsub(); stop(); };
  } catch { return () => {}; }
}

export function PlotterPanel({ onClose }: { onClose: () => void }) {
  const pathname = usePathname();
  const initialPath = useRef(pathname);
  const [drawing, setDrawing] = useState<Drawing | null>(null);
  const [done, setDone] = useState(false);
  const [size, setSize] = useState<"A4" | "A5">("A4");
  const [error, setError] = useState("");
  const ink = useRef<SVGSVGElement>(null);
  const abort = useRef<() => void>(() => {});
  const stopSound = useRef<() => void>(() => {});
  useEffect(() => { if (pathname !== initialPath.current) onClose(); }, [pathname, onClose]);
  const start = () => {
    abort.current(); stopSound.current();
    const result = collectStrokes(document.querySelector("main") ?? document);
    setDrawing({ ...optimiseStrokes(result.strokes), limited: result.limited, width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight });
    setDone(false); setError("");
    if (!matchMedia("(prefers-reduced-motion: reduce)").matches) stopSound.current = scratch();
  };
  useEffect(() => {
    // Only collect after the portal and its ignore marker have committed.
    const timer = setTimeout(start, 0);
    const leave = () => { abort.current(); stopSound.current(); onClose(); };
    const hide = () => { if (document.hidden) { abort.current(); stopSound.current(); setDone(true); } };
    const key = (event: KeyboardEvent) => { if (event.key === "Escape") leave(); };
    addEventListener("keydown", key); addEventListener("pagehide", leave); addEventListener("popstate", leave);
    document.addEventListener("visibilitychange", hide);
    return () => { clearTimeout(timer); abort.current(); stopSound.current(); removeEventListener("keydown", key); removeEventListener("pagehide", leave); removeEventListener("popstate", leave); document.removeEventListener("visibilitychange", hide); };
    // onClose is intentionally captured for this playback session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!drawing || !ink.current) return;
    const paths = [...ink.current.querySelectorAll<SVGPolylineElement>("polyline")];
    const pen = ink.current.querySelector<SVGGElement>("[data-carriage]")!;
    pen.style.display = "";
    const lengths = paths.map(p => p.getTotalLength());
    const total = lengths.reduce((a, b) => a + b, 0);
    const lift = total / Math.max(1, paths.length) * .15;
    const travel = total + lift * Math.max(0, paths.length - 1);
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    let raf = 0, stopped = false;
    const finish = () => {
      if (stopped) return;
      stopped = true; cancelAnimationFrame(raf);
      paths.forEach(p => { p.style.strokeDashoffset = "0"; });
      pen.style.display = "none"; stopSound.current(); setDone(true);
    };
    abort.current = finish;
    paths.forEach((p, i) => { p.style.strokeDasharray = `${lengths[i]}`; p.style.strokeDashoffset = `${lengths[i]}`; });
    const at = performance.now(), duration = Math.min(12000, Math.max(1600, total * 1.2));
    const tick = (now: number) => {
      const ratio = Math.min(1, (now - at) / duration);
      let left = ratio * travel;
      for (let i = 0; i < paths.length; i++) {
        const progress = Math.max(0, Math.min(lengths[i], left));
        paths[i].style.strokeDashoffset = `${lengths[i] - progress}`;
        if (left >= 0 && left <= lengths[i]) {
          const point = paths[i].getPointAtLength(progress);
          pen.setAttribute("transform", `translate(${point.x} ${point.y})`);
          pen.style.opacity = "1";
        } else if (left > lengths[i] && left <= lengths[i] + lift && paths[i + 1]) {
          const from = paths[i].getPointAtLength(lengths[i]), to = paths[i + 1].getPointAtLength(0);
          const t = (left - lengths[i]) / lift;
          pen.setAttribute("transform", `translate(${from.x + (to.x - from.x) * t} ${from.y + (to.y - from.y) * t - 5})`);
          pen.style.opacity = ".45";
        }
        left -= lengths[i] + (i < paths.length - 1 ? lift : 0);
      }
      if (ratio >= 1) finish(); else raf = requestAnimationFrame(tick);
    };
    if (reduced.matches || !paths.length || document.hidden) finish(); else raf = requestAnimationFrame(tick);
    const change = () => { if (reduced.matches) finish(); };
    reduced.addEventListener("change", change);
    return () => { stopped = true; cancelAnimationFrame(raf); reduced.removeEventListener("change", change); };
  }, [drawing]);

  const download = (strokes: PlotStroke[]) => {
    try {
      const blob = new Blob([plotterSvg(strokes, size)], { type: "image/svg+xml" });
      const url = URL.createObjectURL(blob), a = document.createElement("a");
      a.href = url; a.download = `otohime-${location.pathname.replace(/[^a-z0-9-]/gi, "-").replace(/^-|-$/g, "") || "home"}-${size}.svg`;
      a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) { setError(String(e)); }
  };
  return createPortal(<div data-plotter-ui="" className="plotter-session" data-complete={done}>
    {drawing && drawing.strokes.length > 0 && <svg ref={ink} className="plotter-overlay" width={drawing.width} height={drawing.height} viewBox={`0 0 ${drawing.width} ${drawing.height}`} aria-hidden="true">
      {drawing.strokes.map(s => <polyline key={s.id} points={s.points.map(p => p.join(",")).join(" ")} fill="none" stroke={s.colour} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />)}
      <g data-carriage="" fill="#ef6a4c" stroke="#231e16" strokeWidth="1.5"><path d="M-8-30H8V-8L0 0-8-8Z"/><path d="M-5-25H5M0-8V0" fill="none"/></g>
    </svg>}
    <section className="plotter-controls" aria-label="Pen plotter controls">
      <div><strong>Pen plotter</strong><p role="status">{!drawing ? "Collecting ink…" : !drawing.strokes.length ? "No inline vector strokes on this page." : `${done ? "Drawn" : "Drawing"} · ${drawing.strokes.length} strokes · ${Math.round(Math.max(0, drawing.before - drawing.after))} px less pen travel${drawing.limited ? " · drawing limit reached" : ""}`}</p></div>
      <p className="plotter-note">Inline SVG ink only. Photos, raster sketches and type stay on the page.</p>
      <div className="plotter-actions">
        <button type="button" onClick={start}>Replay</button>
        <button type="button" onClick={() => abort.current()} disabled={done}>Skip drawing</button>
        <label htmlFor="plotter-paper">Paper</label><select id="plotter-paper" value={size} onChange={e => setSize(e.target.value as "A4" | "A5")}><option>A4</option><option>A5</option></select>
        <button type="button" disabled={!drawing?.strokes.length} onClick={() => download(drawing!.strokes)}>Export SVG</button>
        <button type="button" onClick={onClose}>Exit plotter</button>
      </div>
      {error && <p role="alert">{error}</p>}
    </section>
  </div>, document.body);
}
