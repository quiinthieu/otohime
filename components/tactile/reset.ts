// Later paper toys share this route-local recovery port; no window events.
let reset: (() => void) | null = null;
export function resetPaper() { reset?.(); }
export function bindPaperReset(next: () => void) {
  reset = next;
  return () => { if (reset === next) reset = null; };
}
