// A scroll-driven animation has a finite duration but advances only with scroll.
// It cannot finish merely because a navigation has finished. Keep checking every
// finite wall-clock animation, the hop, and React's streamed boundaries.
export function landingSettled() {
  const Scroll = globalThis.ScrollTimeline;
  return window.__probe?.done === true &&
    !document.querySelector('template[id^="B:"]') &&
    !document.__reactViewTransition &&
    document.getAnimations()
      .filter(a => !(typeof Scroll === "function" && a.timeline instanceof Scroll))
      .filter(a => a.effect?.getComputedTiming().endTime !== Infinity)
      .every(a => a.playState === "finished" || a.playState === "idle");
}
