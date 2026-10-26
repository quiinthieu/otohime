"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type ComponentType } from "react";
import type { BottlePanelProps } from "./panel";
import "./button.css";

const subscribe = () => () => {};
let owner: symbol | null = null;

/** The only eager Bottle code: no content, request, hover prefetch or panel import. */
export function BottleButton({ entry }: { entry: "footer" | "pocket" }) {
  const ready = useSyncExternalStore(subscribe, () => true, () => false);
  const button = useRef<HTMLButtonElement>(null);
  const token = useRef(Symbol());
  const [Panel, setPanel] = useState<ComponentType<BottlePanelProps> | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const close = useCallback(() => {
    if (owner === token.current) owner = null;
    setPanel(null);
    setBusy(false);
    if (!document.querySelector("dialog[open]")) button.current?.focus({ preventScroll: true });
  }, []);
  useEffect(() => {
    const id = token.current;
    const cancel = (e: KeyboardEvent) => {
      if (!Panel && owner === id && e.key === "Escape") close();
    };
    window.addEventListener("keydown", cancel);
    return () => {
      window.removeEventListener("keydown", cancel);
    };
  }, [close, Panel]);
  useEffect(() => {
    const id = token.current;
    return () => { if (owner === id) owner = null; };
  }, []);
  async function show() {
    if (owner || document.querySelector("dialog[open]")) return;
    const id = token.current;
    owner = id;
    setBusy(true);
    setError("");
    try {
      const loaded = await import("./panel");
      if (owner !== id) return;
      if (document.querySelector("dialog[open]")) return close();
      setPanel(() => loaded.default);
      setBusy(false);
    } catch {
      if (owner !== id) return;
      close();
      setError("Bottle could not load. Please try again.");
    }
  }
  return <>
    <button ref={button} type="button" className={`chip bottle-entry${entry === "footer" ? " bottle-footer-entry" : ""}`} data-bottle-entry={entry}
      aria-haspopup="dialog" aria-expanded={!!Panel} aria-busy={busy} disabled={!ready || busy} onClick={show}>
      <span className="bottle-icon" aria-hidden="true" />Bottle
    </button>
    {error && <span role="status">{error}</span>}
    <noscript><span className="caption">Bottle needs JavaScript to wash up a link.</span></noscript>
    {Panel && <Panel onClose={close} />}
  </>;
}
