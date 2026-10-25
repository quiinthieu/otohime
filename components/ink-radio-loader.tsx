"use client";

// Ink Radio's slot on /music. The set and its 240 stations (components/ink-radio.tsx, its own chunk) load only
// once the slot comes near the viewport; until then, and without JavaScript, the slot says what it is.
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";

const InkRadio = dynamic(() => import("@/components/ink-radio"), {
  ssr: false,
  loading: () => <Waiting />,
});

function Waiting() {
  return (
    <p className="readout" data-radio="waiting">
      Warming up the valves…
    </p>
  );
}

export function InkRadioLoader() {
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

  return (
    <div ref={slot} className="radio-slot" data-radio="slot">
      {near ? <InkRadio /> : <Waiting />}
    </div>
  );
}
