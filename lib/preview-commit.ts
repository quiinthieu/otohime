export interface PreviewClock {
  frame(callback: () => void): number;
  cancelFrame(id: number): void;
  later(callback: () => void, ms: number): number;
  cancelLater(id: number): void;
}

/** Coalesce input at the next frame, or after 16ms when the browser withholds it. */
export function createPreviewCommit(clock: PreviewClock) {
  let pending: (() => void) | undefined;
  let frame: number | undefined;
  let deadline: number | undefined;
  let generation = 0;
  const cancel = () => {
    generation++;
    pending = undefined;
    if (frame !== undefined) clock.cancelFrame(frame);
    if (deadline !== undefined) clock.cancelLater(deadline);
    frame = deadline = undefined;
  };
  return {
    cancel,
    schedule(commit: () => void) {
      pending = commit;
      if (frame !== undefined) return;
      const token = generation;
      const run = () => {
        if (token !== generation || !pending) return;
        const commit = pending;
        cancel();
        commit();
      };
      frame = clock.frame(run);
      deadline = clock.later(run, 16);
    },
  };
}
