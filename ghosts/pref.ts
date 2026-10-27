/** The only persisted ghost data is this opt-out. No visitor identity or history. */
export const GHOSTS_KEY = "ghosts";
export const parseGhostsHidden = (value: string | null | undefined) => value === "hidden";
export const storeGhostsHidden = (hidden: boolean) => hidden ? "hidden" : null;

type StoragePort = Pick<Storage, "getItem" | "setItem" | "removeItem">;
type EventPort = Pick<EventTarget, "addEventListener" | "removeEventListener">;

/** Browser-independent external store; the adapter supplies localStorage and window. */
export function ghostsPreferenceStore(storage: () => StoragePort | null, target: () => EventPort) {
  let hidden = false, loaded = false, memoryOnly = false;
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach(listener => listener());
  function load(refresh = false) {
    if (memoryOnly || (loaded && !refresh)) return;
    loaded = true;
    try {
      const port = storage();
      if (!port) { memoryOnly = true; return; }
      hidden = parseGhostsHidden(port.getItem(GHOSTS_KEY));
    } catch { memoryOnly = true; }
  }
  const onStorage: EventListener = event => {
    const change = event as StorageEvent;
    if (change.key !== GHOSTS_KEY && change.key !== null) return;
    // sessionStorage shares the event name, but must never change this preference.
    try { if (change.storageArea && change.storageArea !== storage()) return; }
    catch { return; }
    hidden = parseGhostsHidden(change.key === null ? null : change.newValue);
    loaded = true;
    emit();
  };
  return {
    get() { load(); return hidden; },
    // SSR and hydration never fetch config or expose ghosts before reading the choice.
    getServer: () => true,
    subscribe(listener: () => void) {
      if (listeners.size === 0) {
        load(true);
        target().addEventListener("storage", onStorage);
      }
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) target().removeEventListener("storage", onStorage);
      };
    },
    set(next: boolean) {
      load(); hidden = next;
      // Transport/drawing subscribers stop within the click, before storage or React effects.
      emit();
      try {
        const port = storage();
        if (!port) { memoryOnly = true; return; }
        const value = storeGhostsHidden(next);
        if (value === null) port.removeItem(GHOSTS_KEY);
        else port.setItem(GHOSTS_KEY, value);
      } catch { memoryOnly = true; }
    },
  };
}
