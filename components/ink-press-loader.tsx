"use client";

// The Ink Poster Press's slot on /play. The press (components/ink-press.tsx: the WebGL2 shader, its SVG fallback and
// the PNG export, its own chunk) loads only once the slot comes near the viewport; until then, and without
// JavaScript, the slot holds a blank sheet of the poster's shape and says what it is. Nothing from lib/ink-press.ts
// is imported here, so none of it rides the page's first load.
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";

const InkPress = dynamic(() => import("@/components/ink-press"), {
  ssr: false,
  loading: () => <Waiting />,
});

function Waiting() {
  return (
    <div className="grid items-start gap-6 md:grid-cols-[minmax(0,24rem)_1fr]" data-press="waiting">
      <div aria-hidden="true" className="aspect-[4/5] w-full border border-ink bg-[#f2efe7]" />
      <p className="text-muted">Inking the press…</p>
    </div>
  );
}

export function InkPressLoader() {
  const slot = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);

  useEffect(() => {
    const el = slot.current;
    if (!el) return;
    const seen = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setNear(true);
        seen.disconnect();
      },
      { rootMargin: "400px 0px" },
    );
    seen.observe(el);
    return () => seen.disconnect();
  }, []);

  return <div ref={slot}>{near ? <InkPress /> : <Waiting />}</div>;
}
