// The Pocket console's switch for Ryugu-jo's sea sound (components/handheld.tsx). The palace makes the sound itself
// (app/(ryugu)/_lib/ambience.ts) and may not import the site, nor the site the palace, so the two share only this
// preference: localStorage[PALACE_SOUND_KEY] = "on" or "off", off unless it says exactly "on". This side never makes
// a sound or an AudioContext: switching on here only lets the palace start on the visitor's next gesture there, and
// switching off reaches an open palace in another tab through the storage event, which stops its water at once.
// It is apart from the site's own beeps (lib/sound.ts SOUND_KEY), so turning those on never wakes the palace.

export const PALACE_SOUND_KEY = "ryugu-sound";
export const parsePalaceSound = (stored: string | null | undefined): boolean => stored === "on";
export const storePalaceSound = (on: boolean) => (on ? "on" : "off");

type StoreLike = Pick<Storage, "getItem" | "setItem">;
type Target = Pick<Window, "addEventListener" | "removeEventListener">;

/** An external store for useSyncExternalStore over the preference. `storage` is localStorage, or null (or a throw)
 * where it is blocked; `target` is the window whose storage events say another tab changed it. */
export function palaceSoundStore(storage: () => StoreLike | null, target: () => Target) {
  let on = false;
  let loaded = false;
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((l) => l());

  function load() {
    if (loaded) return;
    loaded = true;
    try {
      on = parsePalaceSound(storage()?.getItem(PALACE_SOUND_KEY));
    } catch {
      on = false;
    }
  }
  function onStorage(event: StorageEvent) {
    if (event.key !== PALACE_SOUND_KEY && event.key !== null) return;
    on = parsePalaceSound(event.key === null ? null : event.newValue);
    emit();
  }

  return {
    subscribe(listener: () => void) {
      load();
      if (listeners.size === 0) target().addEventListener("storage", onStorage);
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) target().removeEventListener("storage", onStorage);
      };
    },
    get: () => on,
    // The server, and the first client render, show it off.
    getServer: () => false,
    set(next: boolean) {
      load();
      on = next;
      try {
        storage()?.setItem(PALACE_SOUND_KEY, storePalaceSound(next));
      } catch {
        // storage blocked: the choice lasts until reload, and the palace (another page) will not hear of it
      }
      emit();
    },
  };
}

const store = palaceSoundStore(
  () => localStorage,
  () => window,
);
export const subscribePalaceSound = store.subscribe;
export const getPalaceSound = store.get;
export const getServerPalaceSound = store.getServer;
export const setPalaceSound = store.set;
