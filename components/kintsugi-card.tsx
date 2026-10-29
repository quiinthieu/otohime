"use client";

import { useEffect, useRef, useState } from "react";
import { KintsugiSeams } from "./kintsugi-seams";
import { MAX_SEAMS, rageClick, validSeam, type MendedCard, type Seam } from "@/lib/kintsugi";
import { play } from "@/lib/sound-client";
import "@/app/(site)/kintsugi.css";

let shared: Promise<MendedCard[]> | undefined;
function loadShared(): Promise<MendedCard[]> {
  return shared ??= fetch("/api/kintsugi").then(r => r.json()).then(v => Array.isArray(v.cards) ? v.cards : []).catch(() => []);
}

export function KintsugiCard({ id }: { id: string }) {
  const root = useRef<HTMLDivElement>(null);
  const [seams, setSeams] = useState<Seam[]>([]);
  const [phase, setPhase] = useState("rest");
  const [status, setStatus] = useState("");
  const breakCard = useRef<(x: number, y: number) => void>(() => {});
  useEffect(() => {
    const host = root.current?.parentElement;
    if (!host) return;
    const events = new AbortController();
    const { signal } = events;
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    let local: Seam[] = [], hits: { at: number; x: number; y: number }[] = [], busy = false, disposed = false;
    let mendTimer: ReturnType<typeof setTimeout>, restTimer: ReturnType<typeof setTimeout>;
    try { const value = JSON.parse(localStorage.getItem(`kintsugi:${id}`) ?? "[]"); if (Array.isArray(value)) local = value.filter(validSeam).slice(-MAX_SEAMS); } catch {}
    void loadShared().then(cards => {
      if (disposed || busy) return;
      const remote = cards.find(c => c.id === id)?.seams ?? [];
      const merged = [...remote.filter(validSeam), ...local].filter((s, i, all) => all.findIndex(v => v.seed === s.seed) === i).slice(-MAX_SEAMS);
      local = merged; setSeams(merged);
    });
    const settle = () => { busy = false; setPhase("rest"); delete host.dataset.kintsugiPhase; };
    const breakPaper = (x: number, y: number) => {
      if (busy || document.hidden || host.getClientRects().length === 0) return;
      busy = true;
      const seam = { seed: crypto.getRandomValues(new Uint32Array(1))[0], x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) };
      local = [...local, seam].slice(-MAX_SEAMS); setSeams(local);
      try { localStorage.setItem(`kintsugi:${id}`, JSON.stringify(local)); } catch {}
      setPhase(motion.matches ? "mend" : "break"); host.dataset.kintsugiPhase = motion.matches ? "mend" : "break";
      play("rustle");
      setStatus("Paper repaired on this device. Saving the shared seam…");
      if (!motion.matches) mendTimer = setTimeout(() => { setPhase("mend"); host.dataset.kintsugiPhase = "mend"; }, 550);
      restTimer = setTimeout(settle, motion.matches ? 600 : 2100);
      void fetch("/api/kintsugi", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, seam }), signal }).then(r => {
        if (r.ok) { shared = undefined; setStatus("Repaired in gold. Your seam is now part of the shared web."); }
        else setStatus(r.status === 429 ? "Repaired on this device. The shared web is resting; try again in an hour." : "Repaired on this device. Shared seams are temporarily unavailable.");
      }).catch(() => { if (!disposed) setStatus("Repaired on this device. Shared seams are temporarily unavailable."); });
    };
    breakCard.current = breakPaper;
    host.addEventListener("click", e => {
      if (!(e.target instanceof Element) || e.target.closest("a,button,input,textarea,select,[contenteditable=true],[data-paper-controls],[data-no-kintsugi]")) return;
      const result = rageClick(hits, { at: performance.now(), x: e.clientX, y: e.clientY }); hits = result.hits;
      if (result.triggered) { hits = []; const b = host.getBoundingClientRect(); breakPaper((e.clientX - b.left) / b.width * 100, (e.clientY - b.top) / b.height * 100); }
    }, { signal });
    const cancel = () => { clearTimeout(mendTimer); clearTimeout(restTimer); settle(); };
    motion.addEventListener("change", cancel, { signal });
    return () => { disposed = true; events.abort(); clearTimeout(mendTimer); clearTimeout(restTimer); delete host.dataset.kintsugiPhase; };
  }, [id]);
  return <div ref={root} className="kintsugi-layer" data-kintsugi-id={id} data-phase={phase}>
    <KintsugiSeams seams={seams} active={phase !== "rest"} />
    {phase === "break" && <svg className="kintsugi-shards" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">{Array.from({ length: 4 }, (_, i) => <path key={i} d={`M50 50 L${i < 2 ? 0 : 100} ${i % 2 ? 100 : 0} L${i % 2 ? 0 : 100} ${i < 2 ? 0 : 100} Z`} style={{ transform: `translate(${i < 2 ? -2 : 2}px,${i % 2 ? 2 : -2}px)` }} />)}</svg>}
    <button className="kintsugi-mend" type="button" onClick={() => breakCard.current(50, 50)} aria-label="Mend this card in gold" title="Four quick clicks on the paper reveal a golden seam">金</button>
    <span className="sr-only" role="status">{status}</span>
  </div>;
}

/** Permission is requested only by an explicit gesture on the gallery. */
export function KintsugiShake() {
  const [message, setMessage] = useState("Enable shake to mend");
  async function enable() {
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    if (motion.matches) { setMessage("Shake is off with reduced motion"); return; }
    if (typeof DeviceMotionEvent === "undefined") { setMessage("Motion is unavailable; use the gold button"); return; }
    try {
      const api = DeviceMotionEvent as typeof DeviceMotionEvent & { requestPermission?: () => Promise<string> };
      if (api.requestPermission && await api.requestPermission() !== "granted") { setMessage("Motion permission declined; use the gold button"); return; }
      window.dispatchEvent(new Event("kintsugi-enable-shake"));
      setMessage("Shake enabled · gently shake to mend");
    } catch { setMessage("Motion is unavailable; use the gold button"); }
  }
  return <button type="button" className="link" onClick={enable}>{message}</button>;
}

/** Lives in the shared site layout so an enabled shake follows navigation. */
export function KintsugiMotion() {
  useEffect(() => {
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    let enabled = false, last = -3500;
    const shake = (e: DeviceMotionEvent) => {
      if (!enabled || motion.matches || document.hidden || performance.now() - last < 3500 || document.querySelector('[aria-modal="true"],dialog[open]')) return;
      const a = e.acceleration;
      if (Math.hypot(a?.x ?? 0, a?.y ?? 0, a?.z ?? 0) < 22) return;
      const button = [...document.querySelectorAll<HTMLButtonElement>(".kintsugi-mend")].find(b => { const r = b.getBoundingClientRect(); return r.top > 0 && r.top < innerHeight && r.width > 0; });
      button?.click(); last = performance.now();
    };
    const enable = () => { if (!motion.matches) { enabled = true; window.addEventListener("devicemotion", shake); } };
    const stop = () => { enabled = false; window.removeEventListener("devicemotion", shake); };
    window.addEventListener("kintsugi-enable-shake", enable);
    motion.addEventListener("change", stop);
    return () => { stop(); window.removeEventListener("kintsugi-enable-shake", enable); motion.removeEventListener("change", stop); };
  }, []);
  return null;
}
