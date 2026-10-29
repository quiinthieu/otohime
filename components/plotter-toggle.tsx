"use client";

import { Suspense, useState, type ComponentType } from "react";
import "./plotter.css";

export function PlotterToggle({ fallback = false }: { fallback?: boolean }) {
  const [Panel, setPanel] = useState<ComponentType<{ onClose: () => void }> | null>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  return <span className={fallback ? "plotter-fallback" : "plotter-toggle"} data-plotter-ui="">
    <button type="button" className="btn" aria-label="Pen plotter" aria-pressed={open} onClick={async () => {
      try {
        const { PlotterPanel } = await import("./plotter-panel");
        setPanel(() => PlotterPanel); setOpen(v => !v); setError("");
      } catch { setError("Plotter could not load. Try again."); }
    }}><svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><path d="M2 3h16M4 3v14m12-14v14M4 9h12M8 7h4v5l-2 3-2-3Z" fill="none" stroke="currentColor" strokeWidth="1.3" /></svg><span className="plotter-label">Plotter</span></button>
    {error && <span role="status">{error}</span>}
    {open && Panel && <Suspense fallback={null}><Panel onClose={() => setOpen(false)} /></Suspense>}
  </span>;
}
