import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from "react";
import { boxOf, distance, dragStep, ghostAllowed, ghostBox, insideDisc, LONG_PRESS_MS, type Point } from "../_lib/flight.ts";
import type { Box } from "../_lib/geometry.ts";

// Dragging a sleeve from the crate onto the platter, with pointer events so
// mouse, pen and touch all work (the HTML drag-and-drop API does not do
// touch). A mouse or pen drag starts once the pointer moves; a touch drag
// starts after a long press, so a swipe still scrolls the crate (sleeves
// keep touch-action: auto). Once a drag has begun, its touchmoves are
// cancelled so the page holds still; that listener is on the crate for its
// whole life, because Chrome only lets a touchmove be cancelled when a
// blocking listener was already there at touchstart.
//
// The disc under the pointer is a fixed-position ghost, moved by transform,
// and it is not drawn while its box meets the monitor's: nothing is ever
// drawn over the player. Letting go over the platter's [data-drop-target]
// calls onDrop; anywhere else, Escape or a cancelled pointer drops nothing.
// "Place on turntable" stays the non-drag way to do the same thing.

export type SleeveDrag = { index: number; over: boolean };

export function useSleeveDrag({
  rootRef,
  crateRef,
  ghostRef,
  onDrop,
}: {
  rootRef: RefObject<HTMLElement | null>;
  crateRef: RefObject<HTMLElement | null>;
  ghostRef: RefObject<HTMLElement | null>;
  onDrop: (index: number, from: Box) => void;
}) {
  const [drag, setDrag] = useState<SleeveDrag | null>(null);
  const active = useRef(false);
  const finish = useRef<(() => void) | null>(null);
  const dropRef = useRef(onDrop);
  useEffect(() => {
    dropRef.current = onDrop;
  });

  useEffect(() => {
    const crate = crateRef.current;
    if (!crate) return;
    const onTouchMove = (e: TouchEvent) => {
      if (active.current && e.cancelable) e.preventDefault();
    };
    crate.addEventListener("touchmove", onTouchMove, { passive: false });
    return () => crate.removeEventListener("touchmove", onTouchMove);
  }, [crateRef]);

  // Unmounting mid-drag removes its listeners and its long-press timer.
  useEffect(() => () => finish.current?.(), []);

  const start = useCallback(
    (e: ReactPointerEvent, index: number) => {
      if (!e.isPrimary || (e.pointerType === "mouse" && e.button !== 0)) return;
      finish.current?.();
      const pointer = e.pointerId;
      const type = e.pointerType;
      const t0 = performance.now();
      const origin: Point = { x: e.clientX, y: e.clientY };
      let last = origin;
      let over = false;
      let timer: ReturnType<typeof setTimeout> | undefined;
      const find = (selector: string) => boxOf(rootRef.current?.querySelector(selector));

      function place(p: Point) {
        const ghost = ghostRef.current;
        if (ghost) {
          const box = ghostBox(p);
          ghost.style.transform = `translate(${box.x.toFixed(1)}px, ${box.y.toFixed(1)}px)`;
          if (ghostAllowed(box, find("[data-monitor]"))) ghost.dataset.show = "true";
          else delete ghost.dataset.show;
        }
        const target = find("[data-drop-target]");
        const now = target !== null && insideDisc(p, target);
        if (now !== over) {
          over = now;
          setDrag({ index, over });
        }
      }
      function begin() {
        if (active.current) return;
        clearTimeout(timer);
        active.current = true;
        setDrag({ index, over: false });
        place(last);
      }
      function onMove(ev: PointerEvent) {
        if (ev.pointerId !== pointer) return;
        last = { x: ev.clientX, y: ev.clientY };
        if (active.current) return place(last);
        const step = dragStep(type, distance(origin, last), performance.now() - t0);
        if (step === "start") begin();
        else if (step === "cancel") end();
      }
      function onUp(ev: PointerEvent) {
        if (ev.pointerId !== pointer) return;
        const dropped = active.current && over;
        end();
        if (dropped) dropRef.current(index, ghostBox(last));
      }
      function onCancel(ev: PointerEvent) {
        if (ev.pointerId === pointer) end();
      }
      // Capture phase, so the deck's Escape (eject) never sees it.
      function onKey(ev: KeyboardEvent) {
        if (ev.key !== "Escape" || !active.current) return;
        ev.preventDefault();
        ev.stopPropagation();
        end();
      }
      // A long press would otherwise open the context menu.
      function onContextMenu(ev: Event) {
        if (active.current || type === "touch") ev.preventDefault();
      }
      function end() {
        clearTimeout(timer);
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onCancel);
        window.removeEventListener("keydown", onKey, true);
        window.removeEventListener("contextmenu", onContextMenu, true);
        const ghost = ghostRef.current;
        if (ghost) delete ghost.dataset.show;
        active.current = false;
        finish.current = null;
        setDrag(null);
      }

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onCancel);
      window.addEventListener("keydown", onKey, true);
      window.addEventListener("contextmenu", onContextMenu, true);
      if (type === "touch") timer = setTimeout(begin, LONG_PRESS_MS);
      finish.current = end;
    },
    [rootRef, ghostRef],
  );

  return { drag, start };
}
