"use client";

import { play } from "@/lib/sound-client";
import { useEffect } from "react";

// The letterpress keys' paper thunk (app/(site)/letterpress.css), wired once for the whole site: one click listener
// on the document plays the press cue for a button, a nav item or a cartridge's title. A control that already makes
// its own sound (the speaker, the console, the toys, the desk) or sits inside one carries data-own-sound and stays
// as it was, so nothing sounds twice. A click is a press or a keyboard activation, so the autoplay rule is met;
// play() itself stays silent while sound is off. Presses closer than THROTTLE_MS apart sound once.
const KEYS = ".btn, .nav-item, .cartridge .project-title";
const THROTTLE_MS = 60;

export function PressSound() {
  useEffect(() => {
    let last = -Infinity;
    const onClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const key = target.closest(KEYS);
      if (!key || key.closest("[data-own-sound]")) return;
      if (key.matches(":disabled, [aria-disabled='true']")) return;
      const now = performance.now();
      if (now - last < THROTTLE_MS) return;
      last = now;
      play("press");
    };
    // Capture, so a control that stops the click's propagation still sounds.
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);
  return null;
}
