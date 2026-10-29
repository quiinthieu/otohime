/** Browser predicate shared with the motion probe's real Chromium regression. */
export function motionLandingSettled() {
  return window.__probe?.done === true &&
    !document.querySelector('template[id^="B:"]') &&
    !document.__reactViewTransition &&
    document.getAnimations()
      // Scroll/view timelines are driven by viewport progress and can stay
      // running indefinitely. Only time-driven document animations settle.
      .filter(a => a.timeline === document.timeline && a.effect?.getComputedTiming().endTime !== Infinity)
      .every(a => a.playState === "finished" || a.playState === "idle");
}
