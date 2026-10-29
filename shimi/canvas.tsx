"use client";

import { playShimiChirp } from "@/lib/sound-client";
import { cueLength } from "@/lib/sound";
import { usePathname } from "next/navigation";
import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";
import { buildShimiChirpCue, createShimiChirpLimiter } from "./audio.ts";
import {
  createShimiSwarm,
  restoreAllShimiNibbles,
  restoreShimiNibblesNear,
  stepShimiSwarm,
  type ShimiCreature,
  type ShimiSwarm,
  type ShimiWordTarget,
} from "./body.ts";
import { createShimiDiet, generateShimiBurp, ingestWords, type ShimiDiet } from "./markov.ts";
import { setShimiEnabled } from "./pref-client.ts";
import { shimiRng, shimiSeedFromString } from "./rng.ts";
import { shouldSkipShimiElement, extractCrawlableWords } from "./walker.ts";
import "./shimi.css";

const REDUCED = "(prefers-reduced-motion: reduce)";
const FRAME_MS = 1000 / 30;

function skipAttrs(el: Element) {
  const attrs: Record<string, string | boolean | null> = {};
  for (const key of ["contenteditable", "aria-hidden", "data-shimi-ignore", "hidden", "inert"]) {
    if (el.hasAttribute(key)) attrs[key] = el.getAttribute(key) ?? true;
  }
  return shouldSkipShimiElement(el.tagName, attrs);
}

function blocked(node: Node, main: Element) {
  for (let el = node.parentElement; el; el = el.parentElement) {
    if (skipAttrs(el)) return true;
    if (el === main) break;
  }
  return false;
}

function collectTargets(): ShimiWordTarget[] {
  const main = document.querySelector("main");
  if (!main) return [];
  const walker = document.createTreeWalker(main, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!node.nodeValue?.trim() || blocked(node, main)) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  const targets: ShimiWordTarget[] = [];
  const range = document.createRange();
  let id = 0;
  while (walker.nextNode()) {
    const text = walker.currentNode as Text;
    const value = text.nodeValue ?? "";
    const re = /[\p{L}\p{N}][\p{L}\p{M}\p{N}]*(?:['’\-][\p{L}\p{N}][\p{L}\p{M}\p{N}]*)*/gu;
    for (const match of value.matchAll(re)) {
      const word = match[0], index = match.index ?? 0;
      if (extractCrawlableWords(word)[0] !== word) continue;
      range.setStart(text, index);
      range.setEnd(text, index + word.length);
      for (const rect of range.getClientRects()) {
        if (rect.width <= 0 || rect.height <= 0) continue;
        targets.push({ id: `w${id++}`, text: word, x: rect.left, y: rect.top, width: rect.width, height: rect.height });
      }
    }
  }
  return targets;
}

function world(creature: ShimiCreature, lx: number, ly: number) {
  const cos = Math.cos(creature.heading), sin = Math.sin(creature.heading);
  return { x: creature.x + cos * lx - sin * ly, y: creature.y + sin * lx + cos * ly };
}

function paint(ctx: CanvasRenderingContext2D, swarm: ShimiSwarm, width: number, height: number, ink: string, paper: string) {
  ctx.clearRect(0, 0, width, height);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = ink;
  ctx.fillStyle = ink;
  for (const creature of swarm.creatures) {
    ctx.save();
    for (const dot of creature.trail) {
      if (!dot) continue;
      ctx.globalAlpha = dot.alpha;
      ctx.beginPath();
      ctx.arc(dot.x, dot.y, 1.4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.lineWidth = 1;
    for (const feeler of [...creature.antennae, ...creature.cerci]) {
      const base = world(creature, feeler.x, 0);
      const angle = creature.heading + feeler.angle;
      ctx.beginPath();
      ctx.moveTo(base.x, base.y);
      ctx.lineTo(base.x + Math.cos(angle) * feeler.length, base.y + Math.sin(angle) * feeler.length);
      ctx.stroke();
    }
    for (const leg of creature.legs) {
      const base = world(creature, leg.x, 0);
      for (const angle of [leg.leftAngle, leg.rightAngle]) {
        const dir = creature.heading + angle;
        ctx.beginPath();
        ctx.moveTo(base.x, base.y);
        ctx.lineTo(base.x + Math.cos(dir) * leg.length, base.y + Math.sin(dir) * leg.length);
        ctx.stroke();
      }
    }
    for (const segment of creature.segments) {
      const at = world(creature, segment.x, 0);
      ctx.beginPath();
      ctx.arc(at.x, at.y, Math.max(0.6, segment.radius), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
  ctx.fillStyle = paper;
  for (const nibble of swarm.nibbles) {
    ctx.globalAlpha = nibble.alpha;
    ctx.fillRect(nibble.x, nibble.y, nibble.width, nibble.height);
  }
  ctx.globalAlpha = 1;
}

export default function ShimiCanvas() {
  const path = usePathname();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const swarmRef = useRef<ShimiSwarm>(createShimiSwarm(1));
  const dietRef = useRef<ShimiDiet>(createShimiDiet());
  const targetsRef = useRef<ShimiWordTarget[]>([]);
  const limiter = useRef(createShimiChirpLimiter());
  const rngRef = useRef(shimiRng(1));
  const [nibbles, setNibbles] = useState(0);
  const [mode, setMode] = useState<"live" | "static">("live");
  const [bubble, setBubble] = useState<{ text: string; x: number; y: number } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const motion = matchMedia(REDUCED);
    const seed = shimiSeedFromString(path);
    swarmRef.current = createShimiSwarm(seed);
    dietRef.current = createShimiDiet();
    rngRef.current = shimiRng(seed);
    let width = innerWidth, height = innerHeight, raf = 0, last = 0, bubbleTimer = 0, burpTimer = 0, scanTimer = 0;
    const colors = () => {
      const body = getComputedStyle(document.body);
      return { ink: body.color, paper: body.backgroundColor };
    };
    const size = () => {
      width = innerWidth;
      height = innerHeight;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.ceil(width * dpr);
      canvas.height = Math.ceil(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const scan = () => {
      targetsRef.current = collectTargets();
      dietRef.current = ingestWords(dietRef.current, targetsRef.current.map((target) => target.text));
    };
    const draw = () => {
      const { ink, paper } = colors();
      paint(ctx, swarmRef.current, width, height, ink, paper);
      setNibbles(swarmRef.current.nibbles.length);
    };
    const chirpNew = (previous: ShimiSwarm, next: ShimiSwarm) => {
      const seen = new Set(previous.nibbles.map((nibble) => nibble.id));
      for (const nibble of next.nibbles) {
        if (seen.has(nibble.id)) continue;
        const cue = buildShimiChirpCue(nibble.char);
        if (limiter.current.tryChirp(performance.now(), (cueLength(cue) + 0.01) * 1000)) playShimiChirp(cue);
      }
    };
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      if (document.hidden || now - last < FRAME_MS) return;
      const dt = last ? Math.min(0.1, (now - last) / 1000) : 0.03;
      last = now;
      const previous = swarmRef.current;
      swarmRef.current = stepShimiSwarm(previous, targetsRef.current, dt, { width, height }, rngRef.current);
      chirpNew(previous, swarmRef.current);
      draw();
    };
    const showBurp = () => {
      const creature = swarmRef.current.creatures[0];
      const text = generateShimiBurp(dietRef.current, shimiSeedFromString(`${path}:${swarmRef.current.elapsed}`));
      setBubble({ text, x: creature?.x ?? 24, y: Math.max(12, (creature?.y ?? 48) - 28) });
      window.clearTimeout(bubbleTimer);
      bubbleTimer = window.setTimeout(() => setBubble(null), 3000);
    };
    const startLoop = () => {
      cancelAnimationFrame(raf);
      last = 0;
      raf = requestAnimationFrame(tick);
    };
    const stopLoop = () => { cancelAnimationFrame(raf); raf = 0; };
    const applyMode = () => {
      const reduced = motion.matches;
      setMode(reduced ? "static" : "live");
      size();
      scan();
      draw();
      window.clearInterval(burpTimer);
      if (reduced) { stopLoop(); return; }
      startLoop();
      if (path === "/notes" || path.startsWith("/notes/")) burpTimer = window.setInterval(showBurp, 8000);
    };
    const onResize = () => {
      size();
      window.clearTimeout(scanTimer);
      scanTimer = window.setTimeout(() => { scan(); if (motion.matches) draw(); }, 120);
    };
    const onPointer = (event: PointerEvent) => {
      const next = restoreShimiNibblesNear(swarmRef.current.nibbles, event.clientX, event.clientY);
      if (next.length === swarmRef.current.nibbles.length) return;
      swarmRef.current = { ...swarmRef.current, nibbles: next };
      setNibbles(next.length);
      if (motion.matches) draw();
    };
    const onFocus = (event: FocusEvent) => {
      const main = document.querySelector("main");
      if (!main || !(event.target instanceof Node) || !main.contains(event.target)) return;
      swarmRef.current = { ...swarmRef.current, nibbles: restoreAllShimiNibbles(swarmRef.current.nibbles) };
      setNibbles(0);
      if (motion.matches) draw();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented || document.querySelector("dialog[open]")) return;
      event.preventDefault();
      setShimiEnabled(false);
    };
    const onVis = () => {
      if (motion.matches) return;
      if (document.hidden) stopLoop();
      else startLoop();
    };
    applyMode();
    motion.addEventListener("change", applyMode);
    addEventListener("resize", onResize, { passive: true });
    addEventListener("scroll", onResize, { passive: true });
    addEventListener("pointermove", onPointer, { passive: true });
    addEventListener("keydown", onKey);
    document.addEventListener("focusin", onFocus);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      stopLoop();
      window.clearTimeout(scanTimer);
      window.clearTimeout(bubbleTimer);
      window.clearInterval(burpTimer);
      motion.removeEventListener("change", applyMode);
      removeEventListener("resize", onResize);
      removeEventListener("scroll", onResize);
      removeEventListener("pointermove", onPointer);
      removeEventListener("keydown", onKey);
      document.removeEventListener("focusin", onFocus);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [path]);

  return createPortal(
    <>
      <canvas
        ref={canvasRef}
        data-shimi-canvas=""
        data-shimi-mode={mode}
        data-shimi-nibbles={nibbles}
        aria-hidden="true"
      />
      <div data-shimi-pill="" role="region" aria-label="Shimi bookworms">
        <button type="button" className="btn" data-shimi-burp-trigger="" onClick={() => {
          const creature = swarmRef.current.creatures[0];
          const text = generateShimiBurp(dietRef.current, shimiSeedFromString(`${path}:burp:${Date.now()}`));
          setBubble({ text, x: creature?.x ?? 24, y: Math.max(12, (creature?.y ?? 48) - 28) });
          window.setTimeout(() => setBubble(null), 3000);
        }}>Burp phrase</button>
        <button type="button" className="btn" data-shimi-toggle="" aria-pressed="true" onClick={() => setShimiEnabled(false)}>Shimi on</button>
      </div>
      {bubble ? <div data-shimi-bubble="" aria-hidden="true" style={{ left: bubble.x, top: bubble.y }}>{bubble.text}</div> : null}
    </>,
    document.body,
  );
}
