"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { shimiKeyStep } from "./pref.ts";
import { getShimiEnabled, setShimiEnabled, useShimiEnabled } from "./pref-client.ts";

const ShimiCanvas = dynamic(() => import("./canvas"), { ssr: false });

export function ShimiLoader() {
  const enabled = useShimiEnabled();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let progress = 0;
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.repeat) return;
      if (event.metaKey || event.ctrlKey || event.altKey) { progress = 0; return; }
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest("input, textarea, select, dialog[open], [contenteditable]:not([contenteditable='false'])")) return;
      if (target instanceof HTMLElement && target.isContentEditable) return;
      const next = shimiKeyStep(progress, event.key);
      if (progress >= 2 && next > progress) event.preventDefault();
      if (next === 5) {
        progress = 0;
        setShimiEnabled(!getShimiEnabled());
        return;
      }
      progress = next;
    };
    addEventListener("keydown", onKey, true);
    document.body.dataset.shimiKeys = "ready";
    return () => {
      removeEventListener("keydown", onKey, true);
      delete document.body.dataset.shimiKeys;
    };
  }, []);

  useEffect(() => {
    if (!enabled || ready) return;
    const load = () => { if (getShimiEnabled()) setReady(true); };
    if (typeof requestIdleCallback === "function") {
      const id = requestIdleCallback(load, { timeout: 2000 });
      return () => cancelIdleCallback(id);
    }
    const id = window.setTimeout(load, 200);
    return () => window.clearTimeout(id);
  }, [enabled, ready]);

  return ready && enabled ? <ShimiCanvas /> : null;
}
