"use client";

// The season dial beside the theme toggle: Auto (the visitor's clock and zone,
// lib/seasons.ts) or one of the four seasons, pinned. A pick sets data-season on
// <html> at once, so seasons.css and the ambient layer follow, and is kept in
// localStorage "season", which the pre-paint script reads on the next load. Auto
// clears it. Storage that is blocked or throws reads as Auto and keeps a pick in
// memory until reload. Native radios, so the arrow keys move the pick and wrap.
// On a phone the dial folds to one button (globals.css), and a tap turns it.
// scripts/probe-seasons.sh checks all of this in a browser.
import { isSeason, resolveSeason, SEASON_ATTR, SEASON_KEY, visitorZone, type Season } from "@/lib/seasons";
import { useLayoutEffect, useSyncExternalStore } from "react";

type Choice = Season | "auto";

let choice: Choice = "auto";
let loaded = false;
const listeners = new Set<() => void>();

const parse = (value: unknown): Choice => (isSeason(value) ? value : "auto");

function load() {
  if (loaded) return;
  loaded = true;
  try {
    choice = parse(localStorage.getItem(SEASON_KEY));
  } catch {
    choice = "auto"; // storage blocked: the clock, as the pre-paint script did
  }
}

// The season the choice stands for, on <html>.
function paint(c: Choice) {
  document.documentElement.setAttribute(SEASON_ATTR, resolveSeason(c, new Date(), visitorZone()));
}

const emit = () => listeners.forEach((listener) => listener());

// Another tab turned the dial.
function onStorage(event: StorageEvent) {
  if (event.key !== SEASON_KEY && event.key !== null) return;
  choice = parse(event.newValue);
  paint(choice);
  emit();
}

function subscribe(listener: () => void) {
  load();
  if (listeners.size === 0) addEventListener("storage", onStorage);
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) removeEventListener("storage", onStorage);
  };
}
const getChoice = () => choice;
// The server cannot know the pick: no radio is checked until hydration.
const getServerChoice = () => null;

function setChoice(next: Choice) {
  load();
  choice = next;
  try {
    if (next === "auto") localStorage.removeItem(SEASON_KEY);
    else localStorage.setItem(SEASON_KEY, next);
  } catch {
    // storage blocked: the choice lasts until reload
  }
  paint(next);
  emit();
}

const OPTIONS: { value: Choice; label: string; glyph: React.ReactNode }[] = [
  {
    value: "auto",
    label: "Auto, by your clock",
    glyph: (
      <>
        <path d="M10 3.4c3.7-.1 6.7 2.9 6.6 6.6-.1 3.6-3 6.6-6.7 6.5-3.6 0-6.5-3-6.5-6.6.1-3.6 3-6.4 6.6-6.5" />
        <path d="M10 6.3v3.9l2.6 1.6" />
      </>
    ),
  },
  { value: "spring", label: "Spring", glyph: <path d="M10 3.6c3.9 2.6 4 9.4.1 12.8-4-3.3-4-10.1-.1-12.8ZM10 7v6" /> },
  {
    value: "summer",
    label: "Summer",
    glyph: (
      <>
        <path d="M10 6.9c1.8 0 3.1 1.4 3.1 3.1 0 1.8-1.4 3.1-3.2 3.1-1.7 0-3-1.4-3-3.2 0-1.7 1.4-3 3.1-3" />
        <path d="M10 2.8v1.9M10 15.3v1.9M2.8 10h1.9M15.3 10h1.9M4.9 4.9l1.3 1.3M13.8 13.8l1.3 1.3M4.9 15.1l1.3-1.3M13.8 6.2l1.3-1.3" />
      </>
    ),
  },
  { value: "autumn", label: "Autumn", glyph: <path d="M4.6 15.4C4.2 8.9 8.2 4.6 15.4 4.5c.1 6.6-4.4 11.3-10.8 10.9ZM4.6 15.4l6.3-6.2" /> },
  { value: "winter", label: "Winter", glyph: <path d="M10 3.2v13.6M4.1 6.6l11.8 6.8M4.1 13.4l11.8-6.8" /> },
];

// The width globals.css folds the dial at: only the pick shows, so clicking it turns to the next stop.
const DIAL_FOLDED = "(max-width: 39.99rem)";

// A click on the stop already picked: on a folded dial that is the only one showing, so turn it.
function turn(value: Choice) {
  if (!matchMedia(DIAL_FOLDED).matches) return;
  const at = OPTIONS.findIndex((o) => o.value === value);
  setChoice(OPTIONS[(at + 1) % OPTIONS.length].value);
}

export function SeasonDial() {
  const current = useSyncExternalStore(subscribe, getChoice, getServerChoice);

  // React's dev remount clears attributes it didn't set; put it back.
  // A no-op in production: the pre-paint script set the same season.
  useLayoutEffect(() => {
    load();
    paint(choice);
  }, []);

  return (
    <div role="radiogroup" aria-label="Season" className="season-dial" data-season-dial>
      {OPTIONS.map(({ value, label, glyph }) => (
        <label key={value} title={label}>
          <input
            type="radio"
            name="season-dial"
            value={value}
            checked={current === value}
            onChange={() => setChoice(value)}
            // the pick as rendered: a stop this same click has just picked does not turn on
            onClick={() => current === value && turn(value)}
            className="sr-only"
          />
          <svg
            viewBox="0 0 20 20"
            className="size-3.5"
            aria-hidden="true"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {glyph}
          </svg>
          <span className="sr-only">{label}</span>
        </label>
      ))}
    </div>
  );
}
