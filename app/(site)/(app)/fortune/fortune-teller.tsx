"use client";
import Link from "next/link";
import { useEffect, useReducer, useRef, useState, type KeyboardEvent } from "react";
import { createFortuneState, FORTUNE_COLOURS, fortuneReducer, visibleNumbers } from "@/lib/fortune";
import type { FortuneTarget } from "@/lib/fortune-targets";
import { play } from "@/lib/sound-client";

export function FortuneTeller({ targets }: { targets: FortuneTarget[] }) {
  const [state, dispatch] = useReducer(fortuneReducer, targets, (items) => createFortuneState("first-fold", items));
  const [reduced, setReduced] = useState(false);
  const revealed = useRef<HTMLHeadingElement>(null);
  useEffect(() => { dispatch({ type: "reset", seed: crypto.randomUUID(), targets }); }, [targets]);
  useEffect(() => {
    const query = matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(query.matches);
    update(); query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    if (state.phase !== "count-colour" && state.phase !== "count-number") return;
    if (reduced) { dispatch({ type: "finish-counting" }); return; }
    const timer = window.setTimeout(() => dispatch({ type: "tick" }), 240);
    return () => window.clearTimeout(timer);
  }, [state.phase, state.remaining, reduced]);
  useEffect(() => { if (state.phase === "revealed") revealed.current?.focus(); }, [state.phase]);
  const count = state.phase === "count-colour" || state.phase === "count-number";
  const prompt = state.phase === "choose-colour" ? "Choose a colour." : count ? `${state.remaining} folds to count.` : state.phase === "choose-first-number" ? "Pick a number showing on the paper." : state.phase === "choose-final-number" ? "Pick the final number." : state.phase === "ready-reveal" ? "Lift the flap to find your fortune." : "Your fortune is open.";
  function pinch() { if (count || state.phase === "revealed") return; dispatch({ type: "pinch" }); play("fold"); }
  function keys(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") { event.preventDefault(); pinch(); }
  }
  return <div className={`fortune-game mt-8 ${reduced ? "fortune-flat" : ""}`} onKeyDown={keys}>
    <div className="fortune-stage">
      <button type="button" className="fortune-paper-button" aria-label="Pinch the paper open or closed" aria-pressed={state.axis === 1} onClick={pinch} disabled={count || state.phase === "revealed"}>
        <svg viewBox="0 0 240 240" className={`fortune-paper axis-${state.axis}`} aria-hidden="true" focusable="false">
          <defs><linearGradient id="fortune-crease" x2="1" y2="1"><stop stopColor="#fffaf0" /><stop offset=".55" stopColor="#ded0b5" /><stop offset="1" stopColor="#fff7e7" /></linearGradient></defs>
          <path d="M120 8 232 120 120 232 8 120Z" fill="url(#fortune-crease)" stroke="#6c5943" strokeWidth="2" />
          <path className="fortune-facet facet-1" d="M120 8 120 120 8 120Z" fill="#ef6a4c" />
          <path className="fortune-facet facet-2" d="M120 8 232 120 120 120Z" fill="#76a0e2" />
          <path className="fortune-facet facet-3" d="M232 120 120 232 120 120Z" fill="#93d3b0" />
          <path className="fortune-facet facet-4" d="M120 232 8 120 120 120Z" fill="#f4b829" />
          <path d="M120 8V232M8 120H232M40 40 200 200M200 40 40 200" fill="none" stroke="#6c5943" strokeWidth="1" strokeOpacity=".45" />
          <circle cx="120" cy="120" r="11" fill="#f9efd9" stroke="#6c5943" />
        </svg>
      </button>
      <p className="text-xs text-muted">Click the paper or press ← / → while the toy is focused to pinch it.</p>
    </div>
    <div className="fortune-controls">
      <p role="status" aria-live="polite" className="font-semibold">{prompt}</p>
      {state.phase === "choose-colour" && <div className="fortune-choices" role="group" aria-label="Choose a colour">{FORTUNE_COLOURS.map(({ id }) => <button key={id} type="button" className={`btn fortune-colour ${id}`} onClick={() => { dispatch({ type: "choose-colour", colour: id }); play("fold"); }}>{id}</button>)}</div>}
      {(state.phase === "choose-first-number" || state.phase === "choose-final-number") && <div className="fortune-choices" role="group" aria-label="Choose a number">{visibleNumbers(state).map((number) => <button key={number} type="button" className="btn" onClick={() => { dispatch({ type: state.phase === "choose-first-number" ? "choose-first-number" : "choose-final-number", number }); play("fold"); }}>{number}</button>)}</div>}
      {count && <div><p>Counted {state.count}; {state.remaining} to go.</p><button type="button" className="btn btn-sm mt-3" onClick={() => dispatch({ type: "finish-counting" })}>Finish counting</button></div>}
      {state.phase === "ready-reveal" && <button type="button" className="btn" onClick={() => { dispatch({ type: "reveal" }); play("fold"); }}>Lift the flap</button>}
      {state.phase === "revealed" && state.target && <div className="fortune-result"><h2 ref={revealed} tabIndex={-1} className="text-xl font-bold">A paper whisper</h2><p>Your next little discovery is {state.target.label}.</p><Link className="link" href={state.target.href}>Visit {state.target.label} →</Link></div>}
      {state.phase === "revealed" && <button type="button" className="btn btn-sm" onClick={() => dispatch({ type: "reset", seed: crypto.randomUUID(), targets })}>Fold again</button>}
    </div>
  </div>;
}
