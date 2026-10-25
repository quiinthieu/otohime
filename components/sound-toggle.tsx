"use client";

import { getServerSound, getSound, setSound, subscribeSound } from "@/lib/sound-client";
import { useSyncExternalStore } from "react";

// The speaker beside the theme toggle: off until pressed. The waves and the
// cross swap in CSS on aria-pressed, so the button never changes size.
export function SoundToggle({ label }: { label: string }) {
  const on = useSyncExternalStore(subscribeSound, getSound, getServerSound);

  return (
    <button
      type="button"
      className="icon-btn sound-toggle"
      aria-pressed={on}
      aria-label={label}
      title={label}
      onClick={() => setSound(!on)}
    >
      <svg viewBox="0 0 20 20" className="size-4" aria-hidden="true">
        <path d="M3.2 7.6h3l4-3.4v11.6l-4-3.4h-3Z" fill="currentColor" stroke="currentColor" strokeWidth={1.2} strokeLinejoin="round" />
        <g fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round">
          <path className="sound-waves" d="M13.1 7.4c1.2 1.4 1.2 3.8 0 5.2M15.4 5.3c2.3 2.7 2.4 6.7.1 9.4" />
          <path className="sound-off" d="M13.2 7.6l4.2 4.8M17.4 7.6l-4.2 4.8" />
        </g>
      </svg>
    </button>
  );
}
