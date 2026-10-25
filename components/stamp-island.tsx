"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";

// The board and its solver (lib/stamps.ts) are one chunk, asked for on the first press of the chip or the heading.
const StampBoard = dynamic(() => import("./stamp-board"), { ssr: false });
const warm = () => void import("./stamp-board");

const LONG_PRESS_MS = 500;
// A press that wanders this far is a scroll or a text selection, not a long-press.
const PRESS_SLOP = 10;
const REDUCE = "(prefers-reduced-motion: reduce)";

// The "Stamp it" chip and the long-press on the heading of the StampHeading it sits in, and the board once
// either is used. The live line lives here, mounted from the start, so the announcement is not lost to a
// region that appears with its own text.
export function StampIsland() {
  const chip = useRef<HTMLButtonElement>(null);
  const [root, setRoot] = useState<HTMLElement | null>(null);
  const [stamped, setStamped] = useState<{ reduced: boolean } | null>(null);
  const returning = useRef(false);

  useEffect(() => {
    setRoot(chip.current?.closest<HTMLElement>(".stamp-heading") ?? null);
  }, []);

  const stamp = useCallback(() => {
    setStamped((now) => now ?? { reduced: matchMedia(REDUCE).matches });
  }, []);

  const done = useCallback(() => {
    returning.current = true;
    setStamped(null);
  }, []);

  useEffect(() => {
    if (stamped || !returning.current) return;
    returning.current = false;
    chip.current?.focus();
  }, [stamped]);

  // A 500 ms press on the heading stamps it too.
  useEffect(() => {
    const title = root?.querySelector("h1");
    if (!title) return;
    let timer = 0;
    let start: { x: number; y: number } | null = null;
    const cancel = () => {
      window.clearTimeout(timer);
      start = null;
      title.removeAttribute("data-pressing");
    };
    const down = (e: PointerEvent) => {
      if (!e.isPrimary || e.button !== 0 || root?.hasAttribute("data-stamped")) return;
      start = { x: e.clientX, y: e.clientY };
      title.setAttribute("data-pressing", "");
      warm();
      timer = window.setTimeout(() => {
        cancel();
        stamp();
      }, LONG_PRESS_MS);
    };
    const move = (e: PointerEvent) => {
      if (start && Math.hypot(e.clientX - start.x, e.clientY - start.y) > PRESS_SLOP) cancel();
    };
    // a held finger would otherwise open the callout or the context menu
    const menu = (e: Event) => {
      if (start) e.preventDefault();
    };
    title.addEventListener("pointerdown", down);
    title.addEventListener("pointermove", move);
    title.addEventListener("contextmenu", menu);
    for (const type of ["pointerup", "pointercancel", "pointerleave"]) title.addEventListener(type, cancel);
    return () => {
      cancel();
      title.removeEventListener("pointerdown", down);
      title.removeEventListener("pointermove", move);
      title.removeEventListener("contextmenu", menu);
      for (const type of ["pointerup", "pointercancel", "pointerleave"]) title.removeEventListener(type, cancel);
    };
  }, [root, stamp]);

  return (
    <>
      <button
        ref={chip}
        type="button"
        className="chip stamp-chip"
        aria-disabled={stamped ? "true" : undefined}
        onPointerEnter={warm}
        onFocus={warm}
        onClick={stamp}
      >
        Stamp it
      </button>
      <p className="sr-only" aria-live="polite">
        {stamped ? "Letters loose. Tidy puts them back." : ""}
      </p>
      {stamped && root ? <StampBoard root={root} reduced={stamped.reduced} onDone={done} /> : null}
    </>
  );
}
