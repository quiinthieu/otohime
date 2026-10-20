"use client";

import { useState, useSyncExternalStore, type ChangeEvent, type CSSProperties, type ReactNode } from "react";
import type { CitySlug } from "../_lib/cities.ts";
import { needleAngle } from "../_lib/dial.ts";
import { normalizeHand, serializeHand, STORAGE_KEY } from "../_lib/hand.ts";

// The one client island. The board arrives as finished server HTML (children),
// so with JavaScript off the page is complete and the city form is a plain GET.
// Hydrated, this adds two things: the city select reads on change, and Set
// moves the dial's second brass hand to the needle and remembers it in
// localStorage, so the next visit shows whether the pressure rose or fell.
// The hand's angle reaches the drawing as the CSS custom property --hand; the
// island imports no ink and does no fetching and no timing.

const listeners = new Set<() => void>();
const subscribe = (notify: () => void) => {
  listeners.add(notify);
  window.addEventListener("storage", notify);
  return () => {
    listeners.delete(notify);
    window.removeEventListener("storage", notify);
  };
};
const readRaw = () => {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
};
const writeRaw = (raw: string | null) => {
  try {
    if (raw === null) window.localStorage.removeItem(STORAGE_KEY);
    else window.localStorage.setItem(STORAGE_KEY, raw);
  } catch {
    // Storage is blocked: the hand lasts until the next reload.
  }
  listeners.forEach((l) => l());
};

export function HandApp({
  city,
  reading,
  children,
}: {
  city: CitySlug;
  /** The sea-level pressure and local time on the board, or null on the quiet face. */
  reading: { hpa: number; at: string } | null;
  children: ReactNode;
}) {
  const raw = useSyncExternalStore(subscribe, readRaw, () => null);
  const hydrated = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const [said, setSaid] = useState("");

  const stored = normalizeHand(raw);
  const hand = stored && stored.city === city ? stored : null;

  const set = () => {
    if (!reading) return;
    writeRaw(serializeHand({ city, hpa: reading.hpa, at: reading.at }));
    setSaid(`Hand set at ${reading.hpa.toFixed(1)} hPa.`);
  };
  const clear = () => {
    writeRaw(null);
    setSaid("Hand cleared.");
  };
  // A delegated listener: the select sits in the server-rendered form.
  const onChange = (e: ChangeEvent<HTMLElement>) => {
    const t = e.target;
    if (t instanceof HTMLSelectElement && t.name === "city") t.form?.requestSubmit();
  };

  const style = hand ? ({ "--hand": `${needleAngle(hand.hpa).toFixed(2)}deg` } as CSSProperties) : undefined;

  return (
    <div data-station="" data-hand={hand ? "set" : undefined} style={style} onChange={onChange}>
      {children}
      <div className="hand-bar">
        {hydrated && reading && (
          <button type="button" className="hand-button" onClick={set}>
            Set
          </button>
        )}
        {hydrated && hand && (
          <button type="button" className="hand-button quiet-button" onClick={clear}>
            Clear
          </button>
        )}
        {hand && reading && <p className="hand-note">{`The brass hand marks ${hand.hpa.toFixed(1)} hPa, set ${hand.at.replace("T", " ")} local.`}</p>}
        {hand && !reading && <p className="hand-note">{`Last reading: ${hand.hpa.toFixed(1)} hPa on your last visit.`}</p>}
        <p className="visually-hidden" role="status" aria-live="polite">
          {said}
        </p>
      </div>
    </div>
  );
}
