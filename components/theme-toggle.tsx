"use client";

import { useLayoutEffect, useSyncExternalStore } from "react";

type Theme = "light" | "dark";

const dark = () => matchMedia("(prefers-color-scheme: dark)");

function stored(): string | null {
  try {
    return localStorage.getItem("theme");
  } catch {
    return null;
  }
}

// data-theme on <html> when pinned, else the OS preference.
function current(): Theme {
  const pinned = document.documentElement.dataset.theme;
  if (pinned === "light" || pinned === "dark") return pinned;
  return dark().matches ? "dark" : "light";
}

function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributeFilter: ["data-theme"] });
  const media = dark();
  media.addEventListener("change", onChange);
  return () => {
    observer.disconnect();
    media.removeEventListener("change", onChange);
  };
}

// The inline script in app/(site)/layout.tsx applies a pinned theme before paint;
// this button pins one. The icon turns over in CSS, so it never flashes.
// ponytail: once pinned there is no "follow the OS" option; clearing
// localStorage.theme brings it back.
export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, current, () => null);

  // React's dev remount clears attributes it didn't set; put it back.
  // A no-op in production.
  useLayoutEffect(() => {
    const pinned = stored();
    if (pinned === "light" || pinned === "dark") document.documentElement.dataset.theme = pinned;
  }, []);

  function toggle(event: React.MouseEvent<HTMLButtonElement>) {
    const root = document.documentElement;
    const next: Theme = current() === "dark" ? "light" : "dark";
    const apply = () => {
      root.dataset.theme = next;
      try {
        localStorage.setItem("theme", next);
      } catch {
        // storage blocked: the choice lasts until reload
      }
    };
    if (!document.startViewTransition) return apply();

    // The new paper spreads from the button (ink-spread in globals.css).
    const { left, top, width, height } = event.currentTarget.getBoundingClientRect();
    const x = left + width / 2;
    const y = top + height / 2;
    const reach = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    root.style.setProperty("--tx", `${x}px`);
    root.style.setProperty("--ty", `${y}px`);
    root.style.setProperty("--tr", `${Math.ceil(reach)}px`);
    root.classList.add("theming");
    document.startViewTransition(apply).finished.catch(() => {}).finally(() => root.classList.remove("theming"));
  }

  return (
    <button
      type="button"
      className="icon-btn theme-toggle"
      aria-pressed={theme === null ? undefined : theme === "dark"}
      title="Dark theme"
      onClick={toggle}
    >
      <svg viewBox="0 0 20 20" className="size-4" aria-hidden="true">
        <path
          d="M10 3.1c3.9-.1 7 3 6.9 6.9-.1 3.8-3.1 6.9-7 6.9-3.8 0-6.8-3.1-6.8-7 0-3.8 3.1-6.7 6.9-6.8"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
        />
        <path d="M10 3.1c3.9-.1 7 3 6.9 6.9-.1 3.8-3.1 6.9-7 6.9Z" fill="currentColor" />
      </svg>
    </button>
  );
}
