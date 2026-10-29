// The Pocket Terminal's commands, pure: a typed line and what the page looks like now go in, the lines to print
// and at most one effect come out. components/pocket-terminal.tsx applies the effect (a navigation, the theme, the
// sound, the season) and prints the lines; components/pocket-terminal-loader.tsx opens it with opensTerminal.
import { PUBLIC_PAGES } from "./pages.ts";
import type { AppearanceSnapshot, AppearanceWriteResult } from "./ink-lab.ts";
import { isPrintRunId, PRINT_RUN_IDS, PRINT_RUNS, type PrintRunId } from "./print-runs.ts";
import { isSeason, SEASONS, type Season } from "./seasons.ts";

export type Theme = "light" | "dark";
export type SeasonChoice = Season | "auto";

// What the commands read: the theme showing, the sound switch, the season dial's choice and the stamps won.
export type TerminalState = { theme: Theme; sound: boolean; season: SeasonChoice; stamps: readonly string[]; appearance: AppearanceSnapshot; shimi?: boolean };

export type Effect =
  | { kind: "go"; href: string }
  | { kind: "theme"; theme: Theme }
  | { kind: "sound"; on: boolean }
  | { kind: "season"; season: SeasonChoice }
  | { kind: "print-run"; printRun: PrintRunId }
  | { kind: "shimi"; on: boolean }
  | { kind: "clear" }
  | { kind: "adventure" }
  | { kind: "close" };

export type Reply = { lines: string[]; effect?: Effect };

export type Place = { name: string; href: string; label: string };

// Where `go` and a bare word lead: the public pages, in nav order, then the Ask chip (on Home) and the postcards.
export const PLACES: readonly Place[] = [
  ...PUBLIC_PAGES.map((p) => ({ name: p.href === "/lab" ? "lab" : p.label.toLowerCase(), href: p.href, label: p.label })),
  { name: "ask", href: "/", label: "Ask the console" },
  { name: "postcard", href: "/postcard", label: "Postcard" },
  { name: "guestbook", href: "/guestbook", label: "Ink Guestbook" },
  { name: "fortune", href: "/fortune", label: "Origami Fortune Teller" },
];

export function describePrintRun(snapshot: AppearanceSnapshot): string {
  const id = snapshot.lab?.printRun ?? snapshot.printRun;
  return `print run: ${PRINT_RUNS[id].label} (${id})${snapshot.lab ? "; Ink Lab override active" : ""}`;
}

// Shared by both visible controls and command effects. Report the actual storage result, never an optimistic save.
export function printRunStatus(result: AppearanceWriteResult): string {
  return `${describePrintRun(result.snapshot)}. ${result.persisted
    ? "Saved for reload; Ink Lab override cleared."
    : "Storage is blocked; active on this page only. Reload may not retain this choice."}`;
}

// The stamps won, kept by lib/adventure.ts as a JSON array of names.
export const STAMPS_KEY = "terminal-stamps";

export function parseStamps(stored: string | null | undefined): string[] {
  if (!stored) return [];
  try {
    const value: unknown = JSON.parse(stored);
    return Array.isArray(value) ? value.filter((s): s is string => typeof s === "string" && s.length > 0) : [];
  } catch {
    return [];
  }
}

export const parseSeasonChoice = (value: unknown): SeasonChoice => (isSeason(value) ? value : "auto");

// A word to a place: "" or "/" is Home, an exact name wins, else a prefix that only one place has.
// "notes", "/notes", "NO" and "n" all lead to /notes; "p" is play, projects or postcard, so it is a list.
export function findPlace(word: string): Place | Place[] | null {
  const w = word.trim().toLowerCase().replace(/^\/+/, "");
  if (w === "") return PLACES[0];
  const exact = PLACES.find((p) => p.name === w || p.href === `/${w}`);
  if (exact) return exact;
  const hits = PLACES.filter((p) => p.name.startsWith(w));
  if (hits.length === 1) return hits[0];
  return hits.length ? hits : null;
}

const names = (places: readonly Place[]) => places.map((p) => p.name).join(", ");

function go(word: string): Reply {
  const found = findPlace(word);
  if (found === null) return { lines: [`no page called "${word}". try: ${names(PLACES)}`] };
  if (Array.isArray(found)) return { lines: [`"${word}" could be ${names(found)}`] };
  return { lines: [`opening ${found.name}…`], effect: { kind: "go", href: found.href } };
}

export const HELP = [
  "help                    this list",
  "go <page>               open a page; a bare name works too",
  `                        ${names(PLACES)}`,
  "theme [light|dark]      flip or pin the paper",
  "sound [on|off]          flip or set the beeps",
  `season [auto|${SEASONS.join("|")}]`,
  "print run [house|sumi|riso|indigo]   report or choose the print run",
  "lab                     open Ink Lab (/lab)",
  "stamps                  the stamps you have won",
  "shimi [on|off]          paper silverfish on the page",
  "adventure               a walk through the data world",
  "clear                   wipe the screen",
  "exit                    close the terminal (or Esc)",
];

// One typed line. Words are split on spaces and the command is matched without case.
export function run(line: string, state: TerminalState): Reply {
  const [head = "", ...rest] = line.trim().split(/\s+/).filter(Boolean);
  const cmd = head.toLowerCase();
  const arg = rest.join(" ").toLowerCase();

  switch (cmd) {
    case "":
      return { lines: [] };
    case "help":
    case "?":
      return { lines: HELP };
    case "go":
    case "cd":
    case "open":
      return arg ? go(arg) : { lines: [`go where? ${names(PLACES)}`] };
    case "theme": {
      if (arg && arg !== "light" && arg !== "dark" && arg !== "toggle") return { lines: ["theme: light, dark or nothing to flip"] };
      const theme: Theme = arg === "light" || arg === "dark" ? arg : state.theme === "dark" ? "light" : "dark";
      return { lines: [`theme: ${theme}`], effect: { kind: "theme", theme } };
    }
    case "sound": {
      if (arg && arg !== "on" && arg !== "off" && arg !== "toggle") return { lines: ["sound: on, off or nothing to flip"] };
      const on = arg === "on" ? true : arg === "off" ? false : !state.sound;
      return { lines: [`sound: ${on ? "on" : "off"}`], effect: { kind: "sound", on } };
    }
    case "season": {
      if (!arg) return { lines: [`season: ${state.season}. pick auto, ${SEASONS.join(", ")}`] };
      if (arg !== "auto" && !isSeason(arg)) return { lines: [`season: auto, ${SEASONS.join(", ")}`] };
      const season = parseSeasonChoice(arg);
      return { lines: [`season: ${season}`], effect: { kind: "season", season } };
    }
    case "print": {
      if (arg === "run") return { lines: [describePrintRun(state.appearance)] };
      const [sub, id, ...extra] = rest.map((word) => word.toLowerCase());
      if (sub !== "run" || !isPrintRunId(id) || extra.length) return { lines: ["print run: house, sumi, riso or indigo; use print run to see the current choice"] };
      return { lines: [], effect: { kind: "print-run", printRun: id } };
    }
    case "stamps":
      return state.stamps.length
        ? { lines: [`stamps (${state.stamps.length}):`, ...state.stamps.map((s) => `  [*] ${s}`)] }
        : { lines: ["no stamps yet. the adventure hides one."] };
    case "shimi":
    case "bookworms": {
      if (arg && arg !== "on" && arg !== "off" && arg !== "toggle") return { lines: ["shimi: on, off or nothing to flip"] };
      const on = arg === "on" ? true : arg === "off" ? false : !(state.shimi ?? false);
      return { lines: [`shimi: ${on ? "on" : "off"}`], effect: { kind: "shimi", on } };
    }
    case "clear":
    case "cls":
      return { lines: [], effect: { kind: "clear" } };
    // The terminal hands every line to lib/adventure.ts until its quit.
    case "adventure":
      return { lines: [], effect: { kind: "adventure" } };
    case "exit":
    case "quit":
    case "close":
    case "q":
      return { lines: [], effect: { kind: "close" } };
    default: {
      // A bare page name, or the start of one, is a go.
      if (rest.length === 0) {
        const found = findPlace(cmd);
        if (found) return go(cmd);
      }
      return { lines: [`unknown command: ${head}. type help`] };
    }
  }
}

export type Suggestion = { line: string; label: string; hint: string };

// The palette under the prompt, in order: every place, then the switches and the rest.
export const SUGGESTIONS: readonly Suggestion[] = [
  ...PLACES.map((p) => ({ line: `go ${p.name}`, label: p.label, hint: p.href })),
  { line: "theme", label: "Flip theme", hint: "light / dark" },
  { line: "sound", label: "Flip sound", hint: "on / off" },
  { line: "print run", label: "Current print run", hint: "appearance" },
  ...PRINT_RUN_IDS.map((id) => ({ line: `print run ${id}`, label: PRINT_RUNS[id].label, hint: "print run" })),
  ...(["auto", ...SEASONS] as const).map((s) => ({ line: `season ${s}`, label: `Season: ${s}`, hint: "season" })),
  { line: "stamps", label: "Stamps", hint: "your collection" },
  { line: "shimi", label: "Shimi bookworms", hint: "on / off" },
  { line: "adventure", label: "Adventure", hint: "the data world" },
  { line: "help", label: "Help", hint: "every command" },
  { line: "clear", label: "Clear screen", hint: "clear" },
];

// The palette, filtered as you type: lines that start with what is typed come first, then lines or labels with a
// word that starts with it. Nothing typed shows them all.
export function suggest(query: string): Suggestion[] {
  const q = query.trim().toLowerCase().replace(/\s+/g, " ");
  if (!q) return [...SUGGESTIONS];
  const words = (s: Suggestion) => `${s.line} ${s.label}`.toLowerCase().split(/[\s:/]+/);
  const first = SUGGESTIONS.filter((s) => s.line.startsWith(q));
  const then = SUGGESTIONS.filter((s) => !first.includes(s) && words(s).some((w) => w.startsWith(q)));
  return [...first, ...then];
}

// Arrow keys over the palette: -1 is the prompt itself, and the ends wrap through it.
export function moveActive(active: number, count: number, step: 1 | -1): number {
  if (count <= 0) return -1;
  const next = active + step;
  if (next >= count) return -1;
  if (next < -1) return count - 1;
  return next;
}

// The keys that open it live apart, so the loader on every page carries only them.
export { opensTerminal, type KeyLike } from "./terminal-keys.ts";
