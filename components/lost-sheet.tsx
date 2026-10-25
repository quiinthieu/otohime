"use client";

// The 404's rub (app/(site)/not-found.tsx draws the sheet). Rubbing the sheet with a pressed pointer, or pressing
// "Smooth it out", feeds lib/lost.ts; the crumple level goes to the sheet as --crumple, and the crumple filter's
// displacement shrinks with it. Nothing renders on the server or under reduced motion, so a visitor without
// JavaScript, or who asked for less motion, never meets a button that does nothing; the ways back are plain links
// outside this island and never wait for it.
import { applyStroke, createLostSheet, crumpleLevel, isSmoothed, progress, SMOOTH_DISTANCE, type LostPoint } from "@/lib/lost";
import { useEffect, useState, useSyncExternalStore } from "react";

const MOTION = "(prefers-reduced-motion: no-preference)";
// One press of the button rubs a fifth of the sheet.
const PRESS = [
  { x: 0, y: 0 },
  { x: SMOOTH_DISTANCE / 5, y: 0 },
];

function subscribe(onChange: () => void) {
  const media = matchMedia(MOTION);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

export function LostSheet({ sheet }: { sheet: string }) {
  const motion = useSyncExternalStore(
    subscribe,
    () => matchMedia(MOTION).matches,
    () => false,
  );
  return motion ? <Rub sheet={sheet} /> : null;
}

function Rub({ sheet }: { sheet: string }) {
  const [state, setState] = useState(createLostSheet);

  // Pointer strokes on the sheet, in screen px.
  useEffect(() => {
    const el = document.getElementById(sheet);
    if (!el) return;
    let last: LostPoint | null = null;
    const down = (e: PointerEvent) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      last = { x: e.clientX, y: e.clientY };
      el.setPointerCapture?.(e.pointerId);
    };
    const move = (e: PointerEvent) => {
      if (!last) return;
      const from = last;
      const to = { x: e.clientX, y: e.clientY };
      last = to;
      setState((s) => applyStroke(s, [from, to]));
    };
    const up = () => {
      last = null;
    };
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    return () => {
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
    };
  }, [sheet]);

  // The level, onto the sheet. The cleanup puts the server's drawing back, so each run starts from the full
  // displacement, and unmounting (reduced motion turned on) hands the sheet back to the CSS.
  useEffect(() => {
    const el = document.getElementById(sheet);
    if (!el) return;
    const map = el.querySelector("feDisplacementMap");
    const full = map?.getAttribute("scale") ?? null;
    const level = crumpleLevel(state);
    el.style.setProperty("--crumple", String(level));
    el.dataset.progress = String(progress(state));
    el.toggleAttribute("data-smoothed", isSmoothed(state));
    if (map && full !== null) map.setAttribute("scale", String(Number(full) * level));
    return () => {
      el.style.removeProperty("--crumple");
      delete el.dataset.progress;
      el.removeAttribute("data-smoothed");
      if (map && full !== null) map.setAttribute("scale", full);
    };
  }, [sheet, state]);

  const done = isSmoothed(state);
  const pct = Math.floor(progress(state) * 10) * 10;
  return (
    <div className="lost-tools">
      <button
        type="button"
        className="btn btn-sm"
        aria-disabled={done || undefined}
        onClick={() => setState((s) => applyStroke(s, PRESS))}
      >
        Smooth it out
      </button>
      <p className="text-muted" role="status">
        {done ? "Flat again. Pick a way back." : pct === 0 ? "Rub the sheet to smooth it out." : `${pct}% smooth.`}
      </p>
    </div>
  );
}
