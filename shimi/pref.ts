export const SHIMI_KEY = "shimi";
export const parseShimiEnabled = (value: string | null | undefined) => value === "on";
export const storeShimiEnabled = (on: boolean) => on ? "on" : null;

export type ShimiStoragePort = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};
export type ShimiStorageChange = { key: string | null; newValue: string | null; storageArea?: unknown };
export type ShimiEventPort = {
  addEventListener(type: "storage", listener: (event: ShimiStorageChange) => void): void;
  removeEventListener(type: "storage", listener: (event: ShimiStorageChange) => void): void;
};

/** No browser globals: the eventual canvas adapter supplies localStorage and window. */
export function shimiPreferenceStore(storage: () => ShimiStoragePort | null, target: () => ShimiEventPort) {
  let on = false, loaded = false, memoryOnly = false;
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach(listener => listener());
  function load(refresh = false) {
    if (memoryOnly || (loaded && !refresh)) return;
    loaded = true;
    try {
      const port = storage();
      if (!port) { memoryOnly = true; return; }
      on = parseShimiEnabled(port.getItem(SHIMI_KEY));
    } catch { memoryOnly = true; }
  }
  const onStorage = (change: ShimiStorageChange) => {
    if (change.key !== SHIMI_KEY && change.key !== null) return;
    try { if (change.storageArea && change.storageArea !== storage()) return; }
    catch { return; }
    on = parseShimiEnabled(change.key === null ? null : change.newValue);
    loaded = true;
    emit();
  };
  return {
    get() { load(); return on; },
    getServer: () => false,
    subscribe(listener: () => void) {
      if (!listeners.size) { load(true); target().addEventListener("storage", onStorage); }
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
        if (!listeners.size) target().removeEventListener("storage", onStorage);
      };
    },
    set(next: boolean) {
      load(); on = next;
      emit();
      try {
        const port = storage();
        if (!port) { memoryOnly = true; return; }
        const value = storeShimiEnabled(next);
        if (value === null) port.removeItem(SHIMI_KEY);
        else port.setItem(SHIMI_KEY, value);
      } catch { memoryOnly = true; }
    },
  };
}
export type ShimiPreferenceStore = ReturnType<typeof shimiPreferenceStore>;

/** The adapter ignores editable targets and consumes keys only once progress >= 2.
 * Returns 5 on a complete match; the next key starts a fresh sequence.
 */
export function shimiKeyStep(progress: number, key: string): number {
  const sequence = "shimi", lower = key.toLowerCase();
  const index = Number.isInteger(progress) && progress >= 0 && progress < sequence.length ? progress : 0;
  return lower === sequence[index] ? index + 1 : lower === sequence[0] ? 1 : 0;
}
