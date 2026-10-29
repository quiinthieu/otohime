"use client";

import { useEffect, useRef } from "react";
import { brushPath } from "@/lib/brush";
import { paintMarks } from "@/lib/brush-canvas";
import "./ink-toys.css";

/** The same bristle deposition as the desk; readable text exists before enhancement. */
export function BrushHeading({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current!, ctx = canvas.getContext("2d"); if (!ctx) return;
    const marks = brushPath(Array.from({ length: 60 }, (_, i) => ({ x: 10 + i * 9.8, y: 17 + Math.sin(i / 8) * 3, t: i * 16, pressure: .4 + Math.sin(i / 60 * Math.PI) * .4 })));
    ctx.clearRect(0, 0, 600, 40); paintMarks(ctx, marks, "#a54f3e");
  }, []);
  return <span className="brush-heading">{children}<canvas ref={ref} width="600" height="40" className="brush-heading-ink" aria-hidden="true" /></span>;
}
