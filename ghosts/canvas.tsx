"use client";

import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";
import { canvasSize, GhostSession, paintGhosts, pointerPoint, type Snapshot } from "./client.ts";
import type { GhostRoom } from "./config.ts";
import { getGhostsHidden, subscribeGhostsHidden } from "./pref-client.ts";

export default function GhostCanvas({ room }: { room: GhostRoom }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [snapshot, setSnapshot] = useState<Snapshot>({ state: "off", others: 0, ripples: 0 });

  useEffect(() => {
    const node = canvas.current;
    const ctx = node?.getContext("2d");
    if (!node || !ctx) return;
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    let width = 1, height = 1;
    const session = new GhostSession({
      now: () => performance.now(),
      config: async signal => {
        const response = await fetch("/api/ghosts?probe=1", { cache: "no-store", credentials: "omit", signal });
        if (response.status === 404) return null;
        if (!response.ok) throw new Error("Ghost configuration unavailable");
        return response.json();
      },
      connect: url => new WebSocket(url),
      later: (fn, ms) => window.setTimeout(fn, ms),
      cancelLater: handle => window.clearTimeout(handle),
      frame: fn => requestAnimationFrame(fn),
      cancelFrame: handle => cancelAnimationFrame(handle),
      draw: (model, now) => paintGhosts(ctx, model, now, width, height),
      clear: () => ctx.clearRect(0, 0, width, height),
      publish: setSnapshot,
    }, room, location.origin);

    const resize = () => {
      width = window.innerWidth; height = window.innerHeight;
      const size = canvasSize(width, height, window.devicePixelRatio);
      node.width = size.width; node.height = size.height;
      ctx.setTransform(size.ratio, 0, 0, size.ratio, 0, 0);
      session.redraw();
    };
    const pointer = (event: PointerEvent) => {
      // Touch moves can still scroll; these passive observers never cancel browser input.
      const point = pointerPoint(event.clientX, event.clientY, width, height);
      if (point) session.pointer(event.type === "pointerdown" ? "c" : "m", point);
    };
    let listening = false;
    const detach = () => {
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", pointer);
      window.removeEventListener("pointerdown", pointer);
      listening = false;
    };
    const reconcile = () => {
      const eligible = !getGhostsHidden() && !motion.matches && !document.hidden && navigator.onLine;
      if (eligible && !listening) {
        resize();
        window.addEventListener("resize", resize, { passive: true });
        window.addEventListener("pointermove", pointer, { passive: true });
        window.addEventListener("pointerdown", pointer, { passive: true });
        listening = true;
      } else if (!eligible) detach();
      session.setEligible(eligible);
    };
    motion.addEventListener("change", reconcile);
    document.addEventListener("visibilitychange", reconcile);
    window.addEventListener("online", reconcile);
    window.addEventListener("offline", reconcile);
    const unsubscribe = subscribeGhostsHidden(reconcile);
    reconcile();
    return () => {
      detach(); session.dispose();
      unsubscribe();
      motion.removeEventListener("change", reconcile);
      document.removeEventListener("visibilitychange", reconcile);
      window.removeEventListener("online", reconcile);
      window.removeEventListener("offline", reconcile);
    };
  }, [room]);

  // The Home entrance animation creates a fixed-position containing block.
  // Keep ownership on the page, but paint in viewport space outside animated ancestors.
  return createPortal(
    <div aria-hidden="true" data-ghosts-state={snapshot.state} data-ghosts={snapshot.others} data-ghosts-ripples={snapshot.ripples}
      style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 30 }}>
      <canvas ref={canvas} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }} />
      {snapshot.state === "on" && snapshot.others > 0 && (
        <span style={{ position: "absolute", right: 16, bottom: 16, font: "11px Georgia, serif", color: "#948578", opacity: 0.65 }}>
          {snapshot.others} here
        </span>
      )}
    </div>,
    document.body,
  );
}
