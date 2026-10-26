"use client";

import { useEffect, useRef, useState } from "react";
import { createAmbience, PALACE_SOUND_KEY, soundLabel, type Ambience, type Ctx, type Status } from "../_lib/ambience";

type AudioCtor = new () => AudioContext;
const audioCtor = (): AudioCtor | null => {
  const w = window as typeof window & { webkitAudioContext?: AudioCtor };
  const ctor = w.AudioContext ?? w.webkitAudioContext;
  return typeof ctor === "function" ? ctor : null;
};

function storage(): Storage | null {
  try {
    return localStorage;
  } catch {
    return null;
  }
}

// The palace's sound button, on the paper strip beside the way back up. Served off; the stored preference is read
// after hydration (../_lib/ambience.ts). Nothing plays until a click or key press in the palace, and the water stops
// when sound is switched off here or in Pocket, sleeps while the page is hidden, and ends when the palace is left.
export function AmbienceToggle() {
  const ambience = useRef<Ambience>(null);
  const [status, setStatus] = useState<Status>("off");

  useEffect(() => {
    const ctor = audioCtor();
    const a = createAmbience({ make: () => (ctor ? (new ctor() as Ctx) : null), available: ctor !== null, storage: storage() });
    const sync = () => setStatus(a.status());
    const unsubscribe = a.subscribe(sync);
    ambience.current = a;
    sync();

    // The first click or key press anywhere in the palace may start it, but not the press that is the button's own
    // click (a click on it, or Enter or Space while it has focus): the button has its own say. Escape is no gesture.
    const gesture = (event: Event) => {
      const key = event instanceof KeyboardEvent ? event.key : null;
      if (key === "Escape") return;
      const own = event.target instanceof Element && event.target.closest("[data-ambience]");
      if (own && (key === null || key === "Enter" || key === " ")) return;
      a.gesture();
    };
    const stored = (event: StorageEvent) => {
      if (event.key === PALACE_SOUND_KEY) a.stored(event.newValue);
      else if (event.key === null) a.stored(null); // storage cleared
    };
    const visibility = () => a.visibility(document.hidden);
    addEventListener("click", gesture);
    addEventListener("keydown", gesture);
    addEventListener("storage", stored);
    addEventListener("pagehide", a.close);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      removeEventListener("click", gesture);
      removeEventListener("keydown", gesture);
      removeEventListener("storage", stored);
      removeEventListener("pagehide", a.close);
      document.removeEventListener("visibilitychange", visibility);
      unsubscribe();
      a.close();
      ambience.current = null;
    };
  }, []);

  const view = soundLabel(status);
  return (
    <span className="ambience" data-ambience={status}>
      <button
        type="button"
        className="sound"
        aria-pressed={view.pressed}
        aria-disabled={view.disabled || undefined}
        aria-describedby="ryugu-sound-note"
        onClick={() => ambience.current?.toggle()}
      >
        <span aria-hidden="true">{view.pressed ? "♪ " : "· "}</span>
        {view.text}
      </button>
      <span id="ryugu-sound-note" className="sound-note" role="status">
        {view.note}
      </span>
    </span>
  );
}
