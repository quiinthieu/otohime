"use client";

// The Ask chip under the pocket console. Nothing of the dialog loads with the page: a pointer over the chip or
// focus on it prefetches its chunk (components/ask-console.tsx), the first press mounts it and fetches
// public/ask-index.json, once; closing the dialog puts focus back on the chip.
import type { AskIndex } from "@/lib/ask";
import dynamic from "next/dynamic";
import { useRef, useState } from "react";

const load = () => import("@/components/ask-console");
const AskConsole = dynamic(load, { ssr: false });

let index: Promise<AskIndex> | null = null;
const fetchIndex = () =>
  (index ??= fetch("/ask-index.json").then((r) => {
    if (!r.ok) throw new Error(`ask-index.json: ${r.status}`);
    return r.json() as Promise<AskIndex>;
  }));

export function AskConsoleLoader() {
  const chip = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [asked, setAsked] = useState<Promise<AskIndex> | null>(null);

  function prefetch() {
    load().catch(() => {});
  }

  function show() {
    const promise = fetchIndex();
    // a failed fetch is tried again on the next open
    promise.catch(() => {
      index = null;
    });
    setAsked(promise);
    setOpen(true);
  }

  function close() {
    setOpen(false);
    chip.current?.focus();
  }

  return (
    <div className="mt-3 flex justify-center">
      <button
        ref={chip}
        type="button"
        className="chip"
        aria-haspopup="dialog"
        onPointerEnter={prefetch}
        onFocus={prefetch}
        onClick={show}
      >
        &gt; Ask the console
      </button>
      {asked && <AskConsole open={open} index={asked} onClose={close} />}
    </div>
  );
}
