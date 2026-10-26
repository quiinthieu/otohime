"use client";

// The Pocket Terminal's key, on every site page. Nothing of the terminal loads with the page: "/" (outside a field)
// or Cmd/Ctrl-K import()s components/pocket-terminal.tsx on the first press and keeps it mounted after. The one
// keydown listener runs in the capture phase on window, ahead of the handheld's (the layout mounts this before the
// pages), and while the terminal is open it hands every key to the terminal and stops it there, so the console,
// the footer's Konami listener and the stamp board never see them. Closing puts focus back where it was.
import type { TerminalProps } from "@/components/pocket-terminal";
import { opensTerminal } from "@/lib/terminal-keys";
import { useCallback, useEffect, useRef, useState, type ComponentType } from "react";

const editing = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.isContentEditable || !!t.closest("input, textarea, select, [contenteditable]:not([contenteditable='false'])"));

export function PocketTerminalLoader() {
  const [Terminal, setTerminal] = useState<ComponentType<TerminalProps> | null>(null);
  const [open, setOpen] = useState(false);
  const shown = useRef(false);
  const keys = useRef<((event: KeyboardEvent) => void) | null>(null);
  const back = useRef<HTMLElement | null>(null);

  const close = useCallback(() => {
    shown.current = false;
    setOpen(false);
    back.current?.focus?.();
  }, []);

  const bind = useCallback((handler: ((event: KeyboardEvent) => void) | null) => {
    keys.current = handler;
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (shown.current) {
        event.stopPropagation();
        if (keys.current) keys.current(event);
        else if (event.key === "Escape") close(); // still loading
        return;
      }
      if (!opensTerminal(event, editing(event.target))) return;
      event.preventDefault();
      event.stopPropagation();
      back.current = document.activeElement as HTMLElement | null;
      shown.current = true;
      setOpen(true);
      import("@/components/pocket-terminal").then(
        (m) => setTerminal(() => m.default),
        () => close(), // offline: the next press tries again
      );
    };
    addEventListener("keydown", onKey, true);
    return () => removeEventListener("keydown", onKey, true);
  }, [close]);

  return Terminal && <Terminal open={open} onClose={close} bind={bind} />;
}
