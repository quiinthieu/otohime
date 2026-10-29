// Serialized into Chromium by waitForFunction. Keep this function self-contained.
export function streamedLandingSettled() {
  return window.__probe?.done === true &&
    !document.querySelector('template[id^="B:"]') &&
    !document.__reactViewTransition &&
    document.getAnimations()
      // Scroll/view timelines report CSS percentages rather than milliseconds.
      // They describe the current scroll position, not an unfinished page entry.
      .filter(a => Number.isFinite(a.effect?.getComputedTiming().endTime))
      .every(a => a.playState === "finished" || a.playState === "idle");
}
