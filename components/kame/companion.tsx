"use client";

import { afterPaperHydration } from "@/lib/paper-hydration";
import { createPortal } from "react-dom";
import { useCallback, useEffect, useRef, useState } from "react";
import { createKame, PET_MS, type Kame, type KameState } from "@/lib/kame";
import { startPurr, stopPurr, subscribeSound } from "@/lib/sound-client";
import { bindKame, emitKameCompletion } from "./commands";
import { ARRIVAL_PX, FETCH_SPEED, FETCH_LIMIT_MS } from "@/lib/kame-fetch";

type View = { state: KameState; name: string; streak: number; mood: string; friendly: boolean; reduced: boolean; paused: boolean };
const editing = (target: EventTarget | null) => target instanceof HTMLElement && !!target.closest("input,textarea,select,[contenteditable]:not([contenteditable=false])");

export default function Companion() {
  const engine = useRef<Kame | null>(null);
  const sprite = useRef<HTMLDivElement>(null);
  const position = useRef({ x: 0, y: 0 });
  const attachSprite = useCallback((node: HTMLDivElement | null) => {
    sprite.current = node;
    // The initial policy snapshot mounts this node after the effect's first placement.
    if (node) node.style.transform = `translate3d(${position.current.x}px,${position.current.y}px,0)`;
  }, []);
  const capture = useRef<{ element: HTMLButtonElement; pointerId: number } | null>(null);
  const focusAfter = useRef<"call" | "restore" | null>(null);
  const actions = useRef<{ call(): void; hold(): void; release(): void; dismiss(value: boolean): void; name(value: string): void } | null>(null);
  const [view, setView] = useState<View | null>(null);
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => afterPaperHydration(() => {
    let storage;
    try { storage = localStorage; } catch { /* memory-only */ }
    const kame = createKame({ now: () => performance.now(), calendar: () => new Date(), storage });
    engine.current = kame;
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    let reduced = media.matches;
    let paused = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let holding = false;
    let frame = 0;
    let edgeFrame = 0;
    let idleTimer: ReturnType<typeof setTimeout> | null = null;
    let previous = performance.now();
    const point = position.current;
    point.x = innerWidth - 48; point.y = innerHeight * 0.4;
    const cursor = { ...point };
    let fetchLeg: { id: string; arrived: boolean; elapsed: number } | null = null;
    const actualCenter = () => {
      const rect = sprite.current?.getBoundingClientRect();
      return rect ? { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 } : { x: point.x + 23, y: point.y + 32 };
    };
    const cancelFetchLeg = () => {
      const old = fetchLeg; fetchLeg = null;
      if (old) emitKameCompletion({ type: 'cancelled', id: old.id, position: actualCenter() });
    };
    const canMove = () => !paused && !reduced && ["follow", "fetch"].includes(kame.state());
    const paint = () => { if (sprite.current) sprite.current.style.transform = `translate3d(${point.x}px,${point.y}px,0)`; };
    const draw = (now: number) => {
      frame = 0;
      if (!canMove()) return;
      const elapsed = Math.max(0, now - previous);
      const dt = Math.min(50, elapsed); previous = now;
      const fetching = kame.state() === "fetch";
      if (fetching && (!sprite.current || sprite.current.hidden)) { kame.fetch({ type: 'cancel' }); publish(); return; }
      const target = fetching ? kame.target()! : cursor;
      const x = Math.max(0, Math.min(innerWidth - 48, target.x - (fetching ? 23 : 0)));
      const y = Math.max(fetching ? 0 : 80, Math.min(innerHeight - (fetching ? 64 : 72), target.y - (fetching ? 32 : 0)));
      const distance = Math.hypot(x - point.x, y - point.y);
      const scale = fetching ? Math.min(1, FETCH_SPEED * dt / 1000 / (distance || 1)) : Math.min(1, dt / 700);
      point.x += (x - point.x) * scale; point.y += (y - point.y) * scale;
      paint();
      const leg = fetchLeg;
      if (fetching && leg) {
        leg.elapsed += elapsed;
        if (leg.elapsed >= FETCH_LIMIT_MS) { kame.fetch({ type: 'cancel' }); publish(); return; }
        const actual = actualCenter();
        emitKameCompletion({ type: 'position', id: leg.id, position: actual });
        if (!leg.arrived && Math.hypot(actual.x - target.x, actual.y - target.y) <= ARRIVAL_PX) {
          leg.arrived = true;
          emitKameCompletion({ type: 'arrived', id: leg.id, position: actual });
        }
      }
      if (!frame && canMove() && !fetchLeg?.arrived) frame = requestAnimationFrame(draw);
    };
    const placeEdge = () => {
      point.x = innerWidth - 48;
      point.y = reduced ? innerHeight - 72 : innerHeight * 0.4 + Math.min(60, scrollY * 0.03);
      paint();
    };
    const publish = () => {
      if (fetchLeg && kame.state() !== "fetch") cancelFetchLeg();
      const next = { state: kame.state(), ...kame.memory(), mood: kame.mood(), friendly: kame.friendly(), reduced, paused };
      setView((old) => old && JSON.stringify(old) === JSON.stringify(next) ? old : next);
      if (canMove() && !frame && !fetchLeg?.arrived) { previous = performance.now(); frame = requestAnimationFrame(draw); }
      if (!canMove()) { cancelAnimationFrame(frame); frame = 0; }
      if (reduced || kame.state() === "swim") placeEdge();
      armIdle();
    };
    const armIdle = () => {
      if (idleTimer !== null) clearTimeout(idleTimer);
      idleTimer = null;
      if (!paused && !reduced && ["swim", "follow"].includes(kame.state())) {
        idleTimer = setTimeout(() => { idleTimer = null; kame.tick(); publish(); }, Math.max(1, kame.idleIn()));
      }
    };
    const release = () => {
      if (timer !== null) clearTimeout(timer);
      timer = null; stopPurr();
      if (holding) kame.pet(false);
      holding = false;
      const held = capture.current; capture.current = null;
      if (held?.element.hasPointerCapture(held.pointerId)) held.element.releasePointerCapture(held.pointerId);
      publish();
    };
    const blocked = () => document.hidden || !!document.querySelector('dialog[open], [role="dialog"][aria-modal="true"]');
    const syncPause = () => {
      const next = blocked();
      if (next === paused) return;
      paused = next; release(); kame.pause(paused); publish();
    };
    const preference = () => { reduced = media.matches; release(); kame.reduced(reduced); publish(); };
    const pageHide = () => { paused = true; kame.pause(true); release(); };
    const call = () => {
      if (blocked() || kame.state() === "shell") return;
      release(); kame.call();
      setMessage(reduced ? `${kame.memory().name} sends a sleepy hello.` : `${kame.memory().name} is following. Move your pointer.`);
      publish();
    };
    actions.current = {
      call, release,
      hold: () => {
        if (blocked() || holding || kame.state() === "shell") return;
        holding = true;
        startPurr(PET_MS / 1000);
        timer = setTimeout(() => {
          timer = null; if (!holding || blocked()) return;
          kame.pet(true); setMessage(`${kame.memory().name} enjoys the gentle pet.`); publish();
        }, PET_MS);
      },
      dismiss: (value) => { if (blocked()) return; release(); kame.dismiss(value); focusAfter.current = value ? "restore" : "call"; setMessage(value ? "Kame is resting in the footer shell." : "Kame is back."); publish(); },
      name: (name) => { kame.name(name); publish(); },
    };
    const activity = () => {
      if (paused) return;
      const before = kame.state(); kame.activity();
      if (before !== kame.state()) publish(); else armIdle();
    };
    const scroll = () => {
      activity();
      if (reduced || paused || kame.state() !== "swim" || edgeFrame) return;
      edgeFrame = requestAnimationFrame(() => { edgeFrame = 0; if (kame.state() === "swim" && !paused && !reduced) placeEdge(); });
    };
    const resize = () => { kame.fetch({ type: "cancel" }); release(); placeEdge(); };
    const pointer = (event: PointerEvent) => { if (paused) return; cursor.x = event.clientX + 18; cursor.y = event.clientY + 18; activity(); };
    const key = (event: KeyboardEvent) => {
      if (event.defaultPrevented || blocked()) return;
      if (event.key === "Escape") { release(); kame.fetch({ type: "cancel" }); publish(); return; }
      if (event.key.toLowerCase() === "k" && !event.repeat && !event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey && !editing(event.target)) call();
      else activity();
    };
    const observer = new MutationObserver(syncPause);
    observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["open", "aria-modal"] });
    const unbind = bindKame((command) => {
      if (command.type === 'cancel') { kame.fetch(command); cancelFetchLeg(); publish(); return true; }
      if (blocked() || !sprite.current || sprite.current.hidden) return false;
      const accepted = kame.fetch(command);
      if (accepted) {
        cancelFetchLeg();
        if (command.id) {
          fetchLeg = { id: command.id, arrived: false, elapsed: 0 };
          emitKameCompletion({ type: 'accepted', id: command.id, position: actualCenter() });
        }
      }
      publish(); return accepted;
    });
    // A sound preference change ends this pet's audio, including an asynchronous resume.
    const unsubscribe = subscribeSound(stopPurr);
    kame.reduced(reduced); paused = blocked(); kame.pause(paused);
    // Subscribe to the first browser frame rather than cascading a render inside the effect.
    const mounted = requestAnimationFrame(() => { setSlot(document.getElementById("kame-shell")); publish(); });
    addEventListener("pointermove", pointer, { passive: true });
    addEventListener("scroll", scroll, { passive: true });
    addEventListener("resize", resize, { passive: true });
    addEventListener("keydown", key);
    addEventListener("pointerup", release);
    addEventListener("pointercancel", release);
    addEventListener("blur", release);
    addEventListener("pagehide", pageHide);
    addEventListener("pageshow", syncPause);
    document.addEventListener("visibilitychange", syncPause);
    media.addEventListener("change", preference);
    return () => {
      cancelFetchLeg(); release(); cancelAnimationFrame(mounted); cancelAnimationFrame(frame); cancelAnimationFrame(edgeFrame);
      if (idleTimer !== null) clearTimeout(idleTimer);
      observer.disconnect(); unbind(); unsubscribe();
      actions.current = null; engine.current = null;
      removeEventListener("pointermove", pointer); removeEventListener("scroll", scroll); removeEventListener("resize", resize); removeEventListener("keydown", key);
      removeEventListener("pointerup", release); removeEventListener("pointercancel", release); removeEventListener("blur", release); removeEventListener("pagehide", pageHide); removeEventListener("pageshow", syncPause);
      document.removeEventListener("visibilitychange", syncPause); media.removeEventListener("change", preference);
    };
  }), []);

  useEffect(() => {
    if (!focusAfter.current || !slot) return;
    slot.querySelector<HTMLButtonElement>(`[data-kame-action="${focusAfter.current}"]`)?.focus();
    focusAfter.current = null;
  }, [view?.state, slot]);

  if (!view) return null;
  return <>
    <div ref={attachSprite} className="kame-ink" data-kame="" data-state={view.state} data-motion={view.reduced || view.paused ? "still" : "on"} hidden={view.state === "shell" || view.paused} aria-hidden="true">
      <svg viewBox="0 0 64 84" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <g className="kame-flippers"><path d="M18 40Q1 28 4 42L17 50M44 40Q61 28 60 43L47 51M20 63Q9 77 17 77L26 67M41 63Q54 76 47 77L35 68" /></g>
        <path d="M25 28C14 32 12 48 17 60C21 71 40 72 47 60C54 47 49 33 39 28M27 29C17 11 44 9 39 28M29 68L32 76L36 68" fill="var(--paper)" />
        <path d="M32 32L42 39L42 53L33 62L22 54L22 40ZM32 32L32 27M42 39L49 36M42 53L49 59M33 62L33 69M22 54L17 60M22 40L17 36M24 30Q13 45 19 59Q27 73 43 63" />
        <path d={view.state === "nap" ? "M28 22l3 1M35 23l3-1" : "M29 22h.1M36 22h.1"} strokeWidth="2.5" />
        {view.state === "nap" && <g strokeWidth="1"><path d="M42 12h5l-5 5h5M49 2h8l-8 7h8" /><circle cx="41" cy="21" r="1" /></g>}
        {view.state === "pet" && <path d="M48 24C41 17 51 12 53 18C58 12 64 18 53 26Z" />}
      </svg>
    </div>
    {slot && createPortal(<section className="kame-tools" aria-label="Kame companion" data-own-sound="">
      <p className="caption">{view.name} · {view.mood} · day {view.streak}{view.friendly ? " · happy to see you again" : ""}</p>
      <fieldset disabled={view.paused}>
        <legend className="sr-only">Companion controls</legend>
        {view.state === "shell" ? <button type="button" className="kame-button" data-kame-action="restore" onClick={() => actions.current?.dismiss(false)}><svg width="24" height="20" viewBox="0 0 32 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M3 20C1 0 30 0 29 20ZM7 20Q5 7 16 5Q27 8 25 20M16 5V20M8 12L16 16L24 12" /></svg>Restore Kame from shell</button> : <>
          <button type="button" className="kame-button" data-kame-action="call" onClick={() => actions.current?.call()}>Call Kame</button>
          <button type="button" className="kame-button kame-pet" data-kame-action="pet" aria-label="Hold to pet Kame" aria-describedby="kame-pet-hint"
            onPointerDown={(e) => { if (e.button !== 0 || !e.isPrimary) return; capture.current = { element: e.currentTarget, pointerId: e.pointerId }; e.currentTarget.setPointerCapture(e.pointerId); actions.current?.hold(); }}
            onPointerUp={() => actions.current?.release()} onPointerCancel={() => actions.current?.release()} onLostPointerCapture={() => actions.current?.release()}
            onKeyDown={(e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); if (!e.repeat) actions.current?.hold(); } }}
            onKeyUp={(e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); actions.current?.release(); } }}
            onBlur={() => actions.current?.release()}>Hold to pet</button>
          <button type="button" className="kame-button" data-kame-action="hide" onClick={() => actions.current?.dismiss(true)}>Hide Kame in shell</button>
        </>}
        <label className="kame-name">Name <input aria-label="Kame name" defaultValue={view.name} onBlur={(e) => { actions.current?.name(e.currentTarget.value); e.currentTarget.value = engine.current?.memory().name ?? "Kame"; }} onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }} /></label>
      </fieldset>
      <p id="kame-pet-hint" className="caption">Hold for half a second. Space or Enter works too. Purr uses the site sound switch.</p>
      <p role="status" className="caption">{message}</p>
    </section>, slot)}
  </>;
}
