"use client";

import { IGNORED, PALACE_HREF, urashimaStep } from "@/lib/urashima";
import { useEffect } from "react";

// Typing "urashima" anywhere on the site goes down to Ryugu-jo (lib/urashima.ts). The root layout mounts this ahead
// of the pages, so its capture-phase listener on window runs before the Pocket console's and can take the word's
// a's before the console opens a page with them. Form fields, an open dialog (the Pocket Terminal), modifiers and keys
// already handled are left alone.
// The palace is its own root layout, so the way down is a full page load.
export function UrashimaKeys() {
  useEffect(() => {
    let progress = 0;
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.repeat || IGNORED.has(event.key)) return;
      if (event.metaKey || event.ctrlKey || event.altKey) {
        progress = 0;
        return;
      }
      const target = event.target instanceof Element ? event.target : null;
      if (
        target?.closest("input, textarea, select, dialog[open], [contenteditable]:not([contenteditable='false'])") ||
        (target instanceof HTMLElement && target.isContentEditable)
      )
        return;
      const step = urashimaStep(progress, event.key);
      progress = step.progress;
      if (step.take) event.preventDefault();
      if (step.done) location.assign(PALACE_HREF);
    };
    addEventListener("keydown", onKey, true);
    return () => removeEventListener("keydown", onKey, true);
  }, []);
  return null;
}
