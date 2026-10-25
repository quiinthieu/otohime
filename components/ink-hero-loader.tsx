"use client";

// The ink hero's box on the home page: a fixed-ratio, aria-hidden frame that always holds the static SVG mark,
// and loads the particle canvas (components/ink-hero.tsx, its own chunk) only once the box is in view, the page
// is idle, and motion is welcome (no reduced-motion preference, no Save-Data). Until the canvas has drawn, and
// for good if it fails or loses its WebGL context, the SVG is what shows. Turning reduced motion on unmounts the
// canvas again; the box never changes size, so nothing shifts.
import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { INK_MARK_PATH, INK_MARK_STROKE, INK_MARK_VIEWBOX } from "@/components/ink-hero-mark";

const InkHero = dynamic(() => import("@/components/ink-hero"), { ssr: false });

const MOTION = "(prefers-reduced-motion: no-preference)";

type Mode = "mark" | "ink" | "gone";

export function InkHeroLoader() {
  const box = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<Mode>("mark");
  const [live, setLive] = useState(false);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const motion = matchMedia(MOTION);
    const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData === true;
    let inView = false;
    let cancel = () => {};

    const decide = () => {
      cancel();
      cancel = () => {};
      if (!motion.matches || saveData) {
        setLive(false);
        setMode((m) => (m === "gone" ? m : "mark"));
        return;
      }
      if (!inView) return;
      const go = () => setMode((m) => (m === "mark" ? "ink" : m));
      if (typeof requestIdleCallback === "function") {
        const id = requestIdleCallback(go, { timeout: 2000 });
        cancel = () => cancelIdleCallback(id);
      } else {
        const id = setTimeout(go, 200);
        cancel = () => clearTimeout(id);
      }
    };

    const seen = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      decide();
    });
    seen.observe(el);
    motion.addEventListener("change", decide);
    return () => {
      cancel();
      seen.disconnect();
      motion.removeEventListener("change", decide);
    };
  }, []);

  const onLive = useCallback(() => setLive(true), []);
  const onLost = useCallback(() => {
    setLive(false);
    setMode("gone");
  }, []);

  return (
    <div ref={box} className="ink-hero" aria-hidden="true" data-ink={mode === "ink" && live ? "live" : "mark"}>
      <svg className="ink-hero-mark" viewBox={INK_MARK_VIEWBOX} focusable="false">
        <path d={INK_MARK_PATH} fill="none" stroke="currentColor" strokeWidth={INK_MARK_STROKE} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {mode === "ink" && <InkHero onLive={onLive} onLost={onLost} />}
    </div>
  );
}
