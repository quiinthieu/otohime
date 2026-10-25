// One sound on /music at a time: the Television and Ink Radio each claim the air when they start playing,
// and stop when the other claims it. No DOM; the components wire their players to it.

export type Source = "tv" | "radio";

export type Air = {
  /** Who holds the air, or null when nothing plays. */
  owner(): Source | null;
  /** Start playing: the source that held the air, if another, hears it and stops. */
  claim(source: Source): void;
  /** Stopped of its own accord; a no-op unless `source` holds the air. */
  release(source: Source): void;
  /** Called with the new owner when someone else takes this source's air. Returns the unsubscribe. */
  subscribe(source: Source, stop: (by: Source) => void): () => void;
};

export function createAir(): Air {
  let owner: Source | null = null;
  const listeners = new Set<{ source: Source; stop: (by: Source) => void }>();
  return {
    owner: () => owner,
    claim(source) {
      const held = owner;
      owner = source;
      if (held === null || held === source) return;
      for (const l of [...listeners]) if (l.source === held) l.stop(source);
    },
    release(source) {
      if (owner === source) owner = null;
    },
    subscribe(source, stop) {
      const entry = { source, stop };
      listeners.add(entry);
      return () => {
        listeners.delete(entry);
        if (owner === source && ![...listeners].some((l) => l.source === source)) owner = null;
      };
    },
  };
}

/** The page's one air, shared by components/television.tsx and components/ink-radio.tsx. */
export const air = createAir();
