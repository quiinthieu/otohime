"use client";

// The Suminagashi Pond's box on /play: a fixed-ratio frame that always holds the still print (components/pond-
// static.tsx, rendered on the server and passed in as children), and loads the live pond (components/pond.tsx, its
// own chunk) only once the box is in view, the page is idle, and motion is welcome (no reduced-motion preference, no
// Save-Data). This is the ink hero's gate (components/ink-hero-loader.tsx). Until the pond has drawn, and for good if
// it loses its WebGL context, the print is what shows; turning reduced motion on unmounts the pond again. The frame
// never changes size, and the row under it holds a note until the pond's tools take its place.
import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

const Pond = dynamic(() => import("@/components/pond"), { ssr: false });

const MOTION = "(prefers-reduced-motion: no-preference)";

type Mode = "still" | "pond" | "gone";

export function PondLoader({ children }: { children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<Mode>("still");
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
        setMode((m) => (m === "gone" ? m : "still"));
        return;
      }
      if (!inView) return;
      const go = () => setMode((m) => (m === "still" ? "pond" : m));
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

  const on = mode === "pond" && live;
  return (
    <div ref={box} className="pond" data-pond={on ? "live" : "still"}>
      <div className="pond-print" aria-hidden={on || undefined}>
        {children}
      </div>
      {mode === "pond" && <Pond onLive={onLive} onLost={onLost} />}
      {!on && (
        <p className="pond-note caption">
          {mode === "gone" ? "The pond went still. Reload to play again." : "A still print. With motion on, the pond comes alive here."}
        </p>
      )}
    </div>
  );
}
