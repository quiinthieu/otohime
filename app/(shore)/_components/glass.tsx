"use client";

import { useEffect, useRef, useState, type ComponentPropsWithoutRef } from "react";
import {
  DEFAULT_SETTINGS,
  mountGlass,
  type PaletteName,
  type Renderer,
  type Shape,
} from "../_lib/sea-glass.mjs";

type GlassProps = ComponentPropsWithoutRef<"button"> & {
  as?: "button" | "div";
  shape: Shape;
  palette: PaletteName;
  seed: number;
  // Sink a little on pointerdown. Default: on for buttons.
  press?: boolean;
};

// The canvas is mounted after hydration, so the server HTML has the element
// (and its text) but no canvas, and nothing can mismatch. Never put
// overflow:hidden on a parent: the glow reaches 48px outside the box.
export function Glass({ as = "button", shape, palette, seed, press = as === "button", className, ...rest }: GlassProps) {
  const [el, setEl] = useState<HTMLElement | null>(null);
  const renderer = useRef<Renderer | null>(null);

  useEffect(() => {
    if (!el) return;
    const r = mountGlass(el, { shape, palette, seed });
    renderer.current = r;
    return () => {
      r.destroy();
      renderer.current = null;
    };
  }, [el, shape, palette, seed]);

  const sink = () => renderer.current?.update({ elevation: DEFAULT_SETTINGS.elevation - 3 });
  const rise = () => renderer.current?.update({ elevation: DEFAULT_SETTINGS.elevation });

  // A div takes the same props, minus the button-only ones, which callers do not pass.
  const Tag = as as "button";
  return (
    <Tag
      {...rest}
      ref={setEl}
      className={className ? `glass ${className}` : "glass"}
      type={as === "button" ? (rest.type ?? "button") : undefined}
      {...(press ? { onPointerDown: sink, onPointerUp: rise, onPointerCancel: rise, onPointerLeave: rise } : {})}
    />
  );
}
