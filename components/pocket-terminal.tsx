"use client";

import { RisoText } from "@/components/riso-heading";

// The Pocket Terminal: a small ink-drawn command line in a native modal dialog, loaded by
// components/pocket-terminal-loader.tsx on the first "/" or Cmd/Ctrl-K. The prompt is a combobox over a palette
// that filters as you type; the arrows pick a line and Enter runs it, or runs what is typed when nothing is picked.
// lib/terminal.ts reads the line; this file applies its effect and prints its lines into a live log. After
// `adventure`, lines go to lib/adventure.ts instead until its quit, and the walk is saved after every one.
//
// Keys: the loader stops every keydown at window while this is open (so nothing behind it reacts), which also
// keeps React's onKeyDown from firing, so the keys arrive through bind() instead. Enter is the form's submit and
// typing is the input's change event, neither of them a keydown. Tab wraps inside the dialog; Escape closes it.
import { begin, loadProgress, moves, saveProgress, step, UNSAVED, type AdventureState, type StoreLike } from "@/lib/adventure";
import { PrintRunSwitch, printRunKey, selectPrintRun } from "@/components/print-run-switch";
import { appearanceStore } from "@/lib/appearance-client";
import { getSound, setSound, subscribeSound, play } from "@/lib/sound-client";
import { getShimiEnabled, setShimiEnabled } from "@/shimi/pref-client";
import { resolveSeason, SEASON_ATTR, SEASON_KEY, visitorZone } from "@/lib/seasons";
import {
  moveActive,
  parseSeasonChoice,
  parseStamps,
  printRunStatus,
  run,
  STAMPS_KEY,
  suggest,
  type Effect,
  type SeasonChoice,
  type TerminalState,
  type Theme,
} from "@/lib/terminal";
import { useRouter } from "next/navigation";
import { useEffect, useEffectEvent, useRef, useState, type FormEvent } from "react";
import "./pocket-terminal.css";

export type TerminalProps = {
  open: boolean;
  onClose: () => void;
  bind: (handler: ((event: KeyboardEvent) => void) | null) => void;
};

type Entry = { id: number; input?: string; lines: string[] };

const GREETING = ["pocket terminal. type a page name, or help."];

function stored(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

// localStorage itself, or null where even reaching for it throws (storage blocked).
function storage(): StoreLike | null {
  try {
    return localStorage;
  } catch {
    return null;
  }
}

function store(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // storage blocked: the choice lasts until reload
  }
}

// The page as the commands see it, read at the moment a line runs.
function readState(): TerminalState {
  const pinned = document.documentElement.dataset.theme;
  const theme: Theme =
    pinned === "light" || pinned === "dark" ? pinned : matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  // subscribing loads the stored switch, if no sound toggle on this page has yet
  const off = subscribeSound(() => {});
  const sound = getSound();
  off();
  return { theme, sound, season: parseSeasonChoice(stored(SEASON_KEY)), stamps: parseStamps(stored(STAMPS_KEY)), appearance: appearanceStore().getSnapshot(), shimi: getShimiEnabled() };
}

// The theme toggle (components/theme-toggle.tsx) watches data-theme, so it follows.
function setTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  store("theme", theme);
}

// The season dial (components/season-dial.tsx) keeps its pick in memory and follows a storage event, the way it
// follows another tab, so one is sent here too.
function setSeason(season: SeasonChoice) {
  const value = season === "auto" ? null : season;
  store(SEASON_KEY, value);
  document.documentElement.setAttribute(SEASON_ATTR, resolveSeason(season, new Date(), visitorZone()));
  dispatchEvent(new StorageEvent("storage", { key: SEASON_KEY, newValue: value }));
}

export default function PocketTerminal({ open, onClose, bind }: TerminalProps) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(-1);
  const [log, setLog] = useState<Entry[]>([{ id: 0, lines: GREETING }]);
  // the adventure while it is being played, else null
  const [game, setGame] = useState<AdventureState | null>(null);
  // the walk could not be saved and the visitor has been told so
  const warned = useRef(false);
  const next = useRef(1);
  const screen = useRef<HTMLDivElement>(null);
  // set while shut() closes the dialog, so its late close event is not a second close
  const quiet = useRef(false);

  const items = game ? moves(game, query) : suggest(query);

  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    if (open && !el.open) {
      el.showModal();
      input.current?.focus();
      play("open");
    } else if (!open && el.open) el.close();
  }, [open]);

  // the newest output in view
  useEffect(() => {
    const el = screen.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [log]);

  useEffect(() => {
    if (active >= 0) document.getElementById(`pt-opt-${active}`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  // Every way out ends here, and tells the loader at once: the dialog's own close event comes a task later, and a
  // key pressed in between would still be held for a terminal that is gone.
  function shut() {
    if (dialog.current?.open) {
      quiet.current = true;
      dialog.current.close();
    }
    play("back");
    onClose();
  }

  function apply(effect: Effect | undefined) {
    switch (effect?.kind) {
      case "go":
        router.push(effect.href);
        shut();
        break;
      case "theme":
        setTheme(effect.theme);
        break;
      case "sound":
        setSound(effect.on);
        break;
      case "season":
        setSeason(effect.season);
        break;
      case "shimi":
        setShimiEnabled(effect.on);
        break;
      case "clear":
        setLog([]);
        break;
      case "close":
        shut();
        break;
    }
  }

  // Save the walk (and the stamp, once won); say once if storage will not keep it.
  function keep(state: AdventureState): string[] {
    if (saveProgress(storage(), state).saved || warned.current) return [];
    warned.current = true;
    return [UNSAVED];
  }

  function execute(line: string) {
    if (!line.trim()) return;
    let lines: string[];
    let effect: Effect | undefined;
    if (game) {
      const turn = step(game, line);
      lines = [...turn.lines, ...keep(turn.state)];
      setGame(turn.quit ? null : turn.state);
    } else {
      ({ lines, effect } = run(line, readState()));
      if (effect?.kind === "print-run") lines = [printRunStatus(selectPrintRun(effect.printRun))];
      if (effect?.kind === "adventure") {
        const state = loadProgress(storage());
        lines = [...lines, ...begin(state)];
        setGame(state);
      }
    }
    if (effect?.kind !== "clear") setLog((l) => [...l, { id: next.current++, input: line, lines }]);
    setQuery("");
    setActive(-1);
    play("press");
    apply(effect);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    execute(active >= 0 && items[active] ? items[active].line : query);
  }

  const onKey = useEffectEvent((event: KeyboardEvent) => {
    const el = dialog.current;
    if (!el) return;
    if (event.key === "Escape") {
      event.preventDefault();
      shut();
    } else if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      input.current?.focus();
    } else if ((event.key === "ArrowDown" || event.key === "ArrowUp") && event.target === input.current) {
      event.preventDefault();
      setActive((a) => moveActive(a, items.length, event.key === "ArrowDown" ? 1 : -1));
      play("move");
    } else if (printRunKey(event)) {
      // The shared switch handled selection through bind(), before the loader stops propagation.
    } else if (event.key === "Tab") {
      const stops = [...el.querySelectorAll<HTMLElement>("input:not(:disabled), button:not(:disabled)")]
        .filter((stop) => !(stop instanceof HTMLInputElement) || stop.type !== "radio" || stop.checked);
      const first = stops[0];
      const last = stops[stops.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  });

  useEffect(() => {
    bind((event) => onKey(event));
    return () => bind(null);
  }, [bind]);

  return (
    <dialog
      ref={dialog}
      className="dialog pocket-terminal"
      aria-labelledby="pt-title"
      // closed some other way (a browser close request) tells the loader here
      onClose={() => {
        if (quiet.current) quiet.current = false;
        else onClose();
      }}
    >
      <div className="pt-head">
        <h2 id="pt-title" className="caption"><RisoText>Pocket terminal</RisoText></h2>
        <button type="button" className="chip" onClick={shut}>
          Esc
        </button>
      </div>
      <div className="pt-settings">
        <PrintRunSwitch onSelect={(result) => setLog((l) => [...l, { id: next.current++, lines: [printRunStatus(result)] }])} />
      </div>
      <div ref={screen} className="pt-screen" role="log" aria-live="polite" aria-label="Terminal output">
        {log.map((entry) => (
          <div key={entry.id} className="pt-entry">
            {entry.input !== undefined && <p className="pt-echo">&gt; {entry.input}</p>}
            {entry.lines.map((line, i) => (
              <p key={i} className="pt-line">
                {line}
              </p>
            ))}
          </div>
        ))}
      </div>
      <form className="pt-prompt" onSubmit={submit}>
        <label htmlFor="pt-in" className="sr-only">
          Command
        </label>
        <span aria-hidden="true">&gt;</span>
        <input
          ref={input}
          id="pt-in"
          type="text"
          role="combobox"
          aria-expanded={items.length > 0}
          aria-controls="pt-list"
          aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? `pt-opt-${active}` : undefined}
          enterKeyHint="go"
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          maxLength={80}
          placeholder={game ? "look, go north, take…" : "notes, theme, help…"}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(-1);
          }}
        />
      </form>
      <ul id="pt-list" className="pt-list" role="listbox" aria-label="Commands">
        {items.map((item, i) => (
          <li
            key={item.line}
            id={`pt-opt-${i}`}
            role="option"
            aria-selected={i === active}
            className="pt-option"
            // keep focus on the prompt; the click runs the line
            onPointerDown={(e) => e.preventDefault()}
            onClick={() => execute(item.line)}
          >
            <span>{item.label}</span>
            <span className="pt-hint">{item.hint}</span>
          </li>
        ))}
      </ul>
    </dialog>
  );
}
