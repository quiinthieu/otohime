"use client";

import { useState, useSyncExternalStore } from "react";

// The page's one client island. Print waits until the type and the sketch are ready to draw, so the first print is
// never missing its picture, then opens the browser's print dialog; the sheet's own @page rule sets the paper. It
// renders nothing on the server: with JavaScript off the page shows its hint to use the browser's Print instead.

const noop = () => () => {};

export function PrintButton() {
  const hydrated = useSyncExternalStore(noop, () => true, () => false);
  const [busy, setBusy] = useState(false);
  if (!hydrated) return null;

  async function print() {
    setBusy(true);
    try {
      await document.fonts.ready;
      const images = [...document.querySelectorAll<HTMLImageElement>(".sheet img")];
      // A picture that fails to decode still prints as its alt box; it must not block the dialog.
      await Promise.all(images.map((img) => img.decode().catch(() => undefined)));
      window.print();
    } finally {
      setBusy(false);
    }
  }

  return (
    <button type="button" className="print-button" data-print="" onClick={print} disabled={busy}>
      {busy ? "Getting the sheet ready…" : "Print the zine"}
    </button>
  );
}
