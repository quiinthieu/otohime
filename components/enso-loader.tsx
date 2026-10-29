"use client";

import { useEffect, useRef } from "react";
import { brushPath } from "@/lib/brush";
import { paintMarks } from "@/lib/brush-canvas";
import "./ink-toys.css";

export function EnsoLoader() {
  const ref = useRef<HTMLCanvasElement>(null);
  const fallback = useRef<SVGSVGElement>(null);
  useEffect(() => {
    const canvas = ref.current!, ctx = canvas.getContext("2d"); if (!ctx) return;
    canvas.hidden = false;
    if (fallback.current) fallback.current.style.display = "none";
    const marks = brushPath(Array.from({ length: 90 }, (_, i) => { const a = -.8 + i / 90 * Math.PI * 1.86; return { x: 300 + Math.cos(a) * 230, y: 300 + Math.sin(a) * 230, t: i * 14, pressure: .5 + Math.sin(i / 90 * Math.PI) * .5 }; }));
    let frame = 0, start = 0;
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    const final = () => { cancelAnimationFrame(frame); ctx.clearRect(0, 0, 600, 600); paintMarks(ctx, marks); };
    const draw = (t: number) => { start ||= t; ctx.clearRect(0, 0, 600, 600); paintMarks(ctx, marks.slice(0, Math.ceil(marks.length * Math.min(1, (t - start) / 1400)))); if (t - start < 1400) frame = requestAnimationFrame(draw); };
    if (motion.matches) final(); else frame = requestAnimationFrame(draw);
    motion.addEventListener("change", final);
    return () => { cancelAnimationFrame(frame); motion.removeEventListener("change", final); };
  }, []);
  return <div className="enso-loading" role="status"><span style={{ width: 56, height: 56 }}>
    <svg ref={fallback} viewBox="0 0 100 100" aria-hidden="true"><path d="M79 24C46-4 3 28 14 65S85 105 89 56C90 43 85 32 81 29" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" /></svg>
    <canvas ref={ref} hidden width="600" height="600" style={{ width: 56, height: 56 }} aria-hidden="true" />
  </span><span>Preparing a little ink…</span></div>;
}
