// Serialized by Playwright: keep this predicate self-contained and browser-only.
export function landingSettled() {
  return window.__probe?.done === true &&
    !document.querySelector('template[id^="B:"]') &&
    !document.__reactViewTransition &&
    document.getAnimations()
      // View/scroll timelines wait for visitor input; wall-clock waiting cannot finish them.
      .filter(a => (a.timeline == null || a.timeline === document.timeline) && a.effect?.getComputedTiming().endTime !== Infinity)
      .every(a => a.playState === "finished" || a.playState === "idle");
}
