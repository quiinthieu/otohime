"use client";
import { lazy, Suspense, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { InkFilter } from "./art";
import "./theatre.css";
const Stage = lazy(() => import("./stage"));
const query = "(prefers-reduced-motion: reduce)";
const subscribe = (change: () => void) => {
  const media = matchMedia(query); media.addEventListener("change", change);
  return () => media.removeEventListener("change", change);
};
export function TheatreLoader({ children }: { children: ReactNode }) {
  const [theatre, setTheatre] = useState(false);
  const reduced = useSyncExternalStore(subscribe, () => matchMedia(query).matches, () => true);
  const active = theatre && !reduced;
  const heading = useRef<HTMLHeadingElement>(null);
  const readAll = () => {
    setTheatre(false);
    requestAnimationFrame(() => heading.current?.focus());
  };
  return <section className="kamishibai" aria-labelledby="kamishibai-title" data-mode={active ? "theatre" : "list"}>
    <InkFilter />
    <h2 id="kamishibai-title">Paper theatre · project stories</h2>
    <p>Eleven small machines, told in ink. Read the cards, or pull up a seat at the wooden stage.</p>
    <button className="btn kamishibai-enable" type="button" aria-pressed={active} disabled={reduced} onClick={() => setTheatre(!theatre)}>
      {active ? "Read all cards" : "Theatre mode"}
    </button>
    <noscript><p>The complete story cards are printed below. Follow any project title to visit.</p></noscript>
    {reduced && <p className="kamishibai-motion-note">All cards are shown with reduced motion.</p>}
    {active && <Suspense fallback={<p role="status">Setting the paper stage…</p>}><Stage readAll={readAll} /></Suspense>}
    <div hidden={active} className="kamishibai-list">
      <h2 ref={heading} tabIndex={-1}>All project story cards</h2>
      {children}
    </div>
  </section>;
}
