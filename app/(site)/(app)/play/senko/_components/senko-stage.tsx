"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type PointerEvent } from "react";
import { seeded } from "@/lib/ink-particles";
import { buildSenkoCrackleCue, canPlaySenkoCrackle, createSenkoPool, createSenkoState, describeSenkoStatus,
  jumpToSenkoStage, SENKO_STAGES, stepSenkoParticles, stepSenkoState, stepSenkoSteadiness,
  type SenkoBurningStage, type SenkoStage as Stage } from "../_lib/senko";
import { getServerSound, getSound, playCustomCue, setSound, subscribeSound } from "@/lib/sound-client";

type Hand = { id: number; x: number; y: number; at: number; type: string };
type Controls = {
  down: (hand: Hand) => void; move: (hand: Hand) => void; up: (id: number) => void;
  key: (key: string, down: boolean) => void; latch: () => void;
  select: (stage: SenkoBurningStage) => void; jolt: () => void; reset: () => void; cancel: () => void;
};
const flowers = SENKO_STAGES.filter((s) => ["botan", "matsuba", "yanagi", "chiri-giku"].includes(s.id));
const live = (stage: Stage) => !["idle", "out", "dropped"].includes(stage);

export default function SenkoStage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const controls = useRef<Controls | null>(null);
  const [stage, setStage] = useState<Stage>("idle");
  const [latched, setLatched] = useState(false);
  const [paused, setPaused] = useState(false);
  const [reduced, setReduced] = useState(false);
  const sound = useSyncExternalStore(subscribeSound, getSound, getServerSound);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const c = canvas.getContext("2d");
    if (!c) return;
    let state = createSenkoState(), pool = createSenkoPool(), rng = seeded(state.seed);
    let hand: Hand | null = null, heldKey: string | null = null, latch = false;
    let frame: number | null = null, lastAt = 0, lastCrackle: number | null = null;
    let focused = true, disposed = false, width = 1, height = 1;
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    let calm = motion.matches;
    const available = () => focused && !document.hidden && !disposed;
    const publish = () => {
      canvas.dataset.stage = state.stage;
      canvas.dataset.heldMs = String(Math.round(state.heldMs));
      canvas.dataset.particles = String(pool.activeCount);
      canvas.dataset.tremor = String(pool.tremor);
      setStage(state.stage);
    };
    function draw() {
      const ctx = c!;
      const styles = getComputedStyle(canvas);
      const ink = styles.color;
      const ember = styles.getPropertyValue("--senko-ember").trim() || "#b74729";
      const x = width / 2 + pool.tremor, y = height * .47;
      ctx.clearRect(0, 0, width, height);
      ctx.lineCap = "round";
      ctx.globalAlpha = .8; ctx.strokeStyle = ink; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(width / 2 - 18, 36);
      ctx.quadraticCurveTo(width / 2 - 7, y * .5, x, y); ctx.stroke();
      ctx.lineWidth = 4; ctx.globalAlpha = .25;
      ctx.beginPath(); ctx.moveTo(width / 2 - 17, 43); ctx.lineTo(width / 2 - 14, 76); ctx.stroke();
      for (const p of pool.particles) {
        if (!p.active) continue;
        ctx.globalAlpha = (1 - p.ageMs / p.lifeMs) * .8;
        ctx.strokeStyle = p.parentId === null ? ink : ember; ctx.lineWidth = p.width;
        const trail = Math.min(p.ageMs / 1000, p.stage === "yanagi" ? .6 : .09);
        ctx.beginPath();
        ctx.moveTo(x + p.x - p.vx * trail, y + p.y - p.vy * trail + .5 * p.gravity * trail ** 2);
        ctx.quadraticCurveTo(x + p.x - p.vx * trail / 2, y + p.y - p.vy * trail / 2, x + p.x, y + p.y);
        ctx.stroke();
      }
      if (state.beadGlow > 0) {
        // A detached bead rests below the stem; no animation loop survives a drop.
        const beadY = y + (state.stage === "dropped" ? 38 : state.beadY);
        ctx.globalAlpha = state.beadGlow * .12; ctx.fillStyle = ember;
        ctx.beginPath(); ctx.arc(x, beadY, 17, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = state.beadGlow; ctx.beginPath(); ctx.arc(x, beadY, state.beadRadius, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#efbe65"; ctx.beginPath(); ctx.arc(x - .5, beadY - .6, state.beadRadius * .4, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    function stop() {
      if (frame !== null) cancelAnimationFrame(frame);
      frame = null; lastAt = 0;
      canvas.dataset.loopRunning = "false";
    }
    function crackle(now: number) {
      if (live(state.stage) && canPlaySenkoCrackle(lastCrackle, now, getSound()) &&
        playCustomCue(buildSenkoCrackleCue(state.stage, state.seed + Math.floor(state.heldMs)))) lastCrackle = now;
    }
    function tick(now: number) {
      frame = null;
      if (!available() || !live(state.stage)) { stop(); return; }
      const dt = lastAt ? Math.min(100, now - lastAt) : 0;
      lastAt = now;
      state = stepSenkoState(state, { dtMs: dt, holding: !!hand || !!heldKey, steadyLatch: latch, pointerType: heldKey ? "keyboard" : hand?.type });
      stepSenkoParticles(pool, state.stage, dt, rng, calm);
      publish(); draw(); crackle(now);
      if (live(state.stage)) frame = requestAnimationFrame(tick);
      else stop();
    }
    function start() {
      if (available() && live(state.stage) && frame === null) {
        lastAt = 0; canvas.dataset.loopRunning = "true";
        frame = requestAnimationFrame(tick);
      }
    }
    function fresh() {
      state = createSenkoState(); pool = createSenkoPool(); rng = seeded(state.seed); lastCrackle = null;
    }
    function light() {
      if (!available()) return;
      setPaused(false);
      if (!live(state.stage)) fresh();
      state = stepSenkoState(state, { dtMs: 0, holding: true, steadyLatch: latch });
      publish(); draw(); start();
    }
    function release() {
      if (latch || hand || heldKey || !live(state.stage)) return;
      state = stepSenkoState(state, { dtMs: 0, holding: false });
      stop(); publish(); draw();
    }
    function cancel() {
      hand = null; heldKey = null; latch = false; setLatched(false);
      release(); stop();
    }
    const api: Controls = {
      down(next) { if (!available() || hand) return; hand = next; light(); },
      move(next) {
        if (!hand || hand.id !== next.id || !available()) return;
        state = stepSenkoSteadiness(state, { dx: next.x - hand.x, dy: next.y - hand.y,
          dtMs: next.at - hand.at, pointerType: heldKey ? "keyboard" : next.type, steadyLatch: latch || calm });
        hand = next;
        if (state.stage === "dropped") { hand = null; heldKey = null; stop(); publish(); draw(); }
      },
      up(id) { if (hand?.id === id) { hand = null; release(); } },
      key(key, down) {
        if (down) { if (!heldKey) { heldKey = key; light(); } }
        else if (heldKey === key) { heldKey = null; release(); }
      },
      latch() { latch = !latch; setLatched(latch); if (latch) light(); else release(); },
      select(next) {
        latch = true; hand = null; heldKey = null; setLatched(true); setPaused(false);
        state = jumpToSenkoStage(state, next); pool = createSenkoPool();
        publish(); draw(); crackle(performance.now()); start();
      },
      jolt() {
        if (!live(state.stage)) return;
        // The explicit negative control works in calm mode and through the latch.
        state = stepSenkoSteadiness(state, { dx: 100, dy: 0, dtMs: 0, pointerType: "mouse" });
        hand = null; heldKey = null; latch = false; setLatched(false);
        stop(); publish(); draw();
      },
      reset() { cancel(); fresh(); setPaused(false); publish(); draw(); }, cancel,
    };
    controls.current = api;
    const resize = () => {
      const rect = canvas.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1);
      width = rect.width; height = rect.height;
      canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
      c.setTransform(dpr, 0, 0, dpr, 0, 0); draw();
    };
    const observer = new ResizeObserver(resize); observer.observe(canvas);
    const updateMotion = () => {
      calm = motion.matches; setReduced(calm); canvas.dataset.reducedMotion = String(calm);
      stepSenkoParticles(pool, state.stage, 0, rng, calm); draw();
    };
    const pause = () => {
      hand = null; heldKey = null; stop();
      if (live(state.stage)) setPaused(true);
    };
    const resume = () => {
      if (available() && latch && live(state.stage)) { setPaused(false); start(); }
    };
    const visibility = () => { if (document.hidden) pause(); else resume(); };
    const blur = () => { focused = false; pause(); };
    const focus = () => { focused = true; resume(); };
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("blur", blur); window.addEventListener("focus", focus);
    window.addEventListener("pagehide", pause);
    motion.addEventListener("change", updateMotion);
    updateMotion(); resize(); api.reset();
    return () => {
      disposed = true; stop(); controls.current = null; observer.disconnect();
      motion.removeEventListener("change", updateMotion);
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("blur", blur); window.removeEventListener("focus", focus);
      window.removeEventListener("pagehide", pause);
    };
  }, []);

  const hand = (e: PointerEvent): Hand => ({ id: e.pointerId, x: e.clientX, y: e.clientY, at: e.timeStamp, type: e.pointerType });
  const pointerHandlers = {
    onPointerDown(e: PointerEvent<HTMLElement>) {
      if (!e.isPrimary || e.button !== 0) return;
      e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId);
      controls.current?.down(hand(e));
    },
    onPointerMove(e: PointerEvent<HTMLElement>) { controls.current?.move(hand(e)); },
    onPointerUp(e: PointerEvent<HTMLElement>) { controls.current?.up(e.pointerId); },
    onLostPointerCapture(e: PointerEvent<HTMLElement>) { controls.current?.up(e.pointerId); },
    onPointerCancel() { controls.current?.cancel(); },
    onContextMenu(e: React.MouseEvent) { e.preventDefault(); },
  };
  const description = SENKO_STAGES.find((s) => s.id === stage)!;
  return (
    <section className="senko-island" aria-label="Senko Hanabi sparkler">
      <div className="senko-paper">
        <canvas ref={canvasRef} className="senko-canvas" data-testid="senko-canvas" data-stage="idle" data-loop-running="false"
          role="img" aria-label="Ink sparkler on paper. Use the hold button below to light it." aria-describedby="senko-help" {...pointerHandlers} />
        <span className="senko-margin" aria-hidden="true">線香花火 · 夏の余韻</span>
        <span className="senko-caption" aria-hidden="true">{description.japaneseTitle} / {stage.toUpperCase()}</span>
      </div>
      <div className="senko-controls">
        <button type="button" className="btn senko-hold" data-testid="senko-hold-btn" {...pointerHandlers}
          onKeyDown={(e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); if (!e.repeat) controls.current?.key(e.key, true); } }}
          onKeyUp={(e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); controls.current?.key(e.key, false); } }}
          onBlur={() => { controls.current?.key(" ", false); controls.current?.key("Enter", false); }}>
          Hold to light
        </button>
        <button type="button" className="btn" data-testid="senko-steady-btn" aria-pressed={latched} onClick={() => controls.current?.latch()}>Steady hold</button>
        <button type="button" className="btn" data-testid="senko-shake-btn" onClick={() => controls.current?.jolt()}>Jolt hand</button>
        <button type="button" className="btn" onClick={() => controls.current?.reset()}>New sparkler</button>
        <button type="button" className="btn" data-testid="senko-sound-toggle" aria-pressed={sound} onClick={() => setSound(!sound)}>Sound {sound ? "on" : "off"}</button>
      </div>
      <p className="senko-status" data-testid="senko-status" role="status" aria-live="polite" aria-atomic="true">
        {paused ? "Paused while away. Hold again, or return with Steady hold on, to continue." : describeSenkoStatus({ ...createSenkoState(), stage })}
      </p>
      <p id="senko-help" className="senko-help">Press and hold the paper or hold button. With a keyboard, hold Space or Enter. Keep your pointer still; a sudden move drops the ember. Steady hold lets you play without holding or balancing.</p>
      {reduced && <p className="senko-help">Calm mode: fewer sparks, a still stem, and no accidental shake. Jolt hand still lets you try the falling ember.</p>}
      <div className="senko-guide" aria-labelledby="senko-guide-title">
        <h2 id="senko-guide-title" className="caption">Four flowers, one summer</h2>
        <p className="senko-help">Let them unfold in a single hold, or choose a flower to study it with Steady hold.</p>
        <ol>{flowers.map((flower, i) => (
          <li key={flower.id}>
            <button type="button" className="btn" data-testid={`senko-stage-${flower.id}`} aria-pressed={stage === flower.id}
              onClick={() => controls.current?.select(flower.id as SenkoBurningStage)}>
              <span><small>0{i + 1} · {flower.japaneseTitle}</small>{flower.title}</span>
            </button>
            <p>{flower.description}</p>
          </li>
        ))}</ol>
      </div>
    </section>
  );
}
