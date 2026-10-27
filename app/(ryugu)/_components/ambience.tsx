"use client";

import { useEffect, useRef, useState } from "react";
import { ambienceSession, createAmbience, PALACE_SOUND_KEY, soundLabel, type Ambience, type Ctx, type Status } from "../_lib/ambience";

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
// when sound is switched off here or in Pocket, sleeps while the page is hidden, and ends when the palace is left. A
// palace brought back by the browser's Back button (bfcache) starts again from the stored preference.
export function AmbienceToggle() {
  const ambience = useRef<Ambience>(null);
  const [status, setStatus] = useState<Status>("off");

  useEffect(() => {
    const ctor = audioCtor();
    const sync = () => setStatus(session.current().status());
    const session = ambienceSession(
      () => createAmbience({ make: () => (ctor ? (new ctor() as Ctx) : null), available: ctor !== null, storage: storage() }),
      sync,
    );
    const a = () => session.current();
    ambience.current = a();
    sync();

    // The first click or key press anywhere in the palace may start it, but not the press that is the button's own
    // click (a click on it, or Enter or Space while it has focus): the button has its own say. Escape is no gesture.
    const gesture = (event: Event) => {
      const key = event instanceof KeyboardEvent ? event.key : null;
      if (key === "Escape") return;
      const own = event.target instanceof Element && event.target.closest("[data-ambience]");
      if (own && (key === null || key === "Enter" || key === " ")) return;
      a().gesture();
    };
    const stored = (event: StorageEvent) => {
      if (event.key === PALACE_SOUND_KEY) a().stored(event.newValue);
      else if (event.key === null) a().stored(null); // storage cleared
    };
    const visibility = () => a().visibility(document.hidden);
    const show = (event: PageTransitionEvent) => {
      session.show(event.persisted);
      ambience.current = a();
    };
    addEventListener("click", gesture);
    addEventListener("keydown", gesture);
    addEventListener("storage", stored);
    addEventListener("pagehide", session.hide);
    addEventListener("pageshow", show);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      removeEventListener("click", gesture);
      removeEventListener("keydown", gesture);
      removeEventListener("storage", stored);
      removeEventListener("pagehide", session.hide);
      removeEventListener("pageshow", show);
      document.removeEventListener("visibilitychange", visibility);
      session.dispose();
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
