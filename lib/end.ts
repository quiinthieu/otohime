// Pure state for the footer save-point console: poke cycling, two-frame button
// press on twos, and the ten-key Konami sequence. No browser APIs.

export const KONAMI = [
  "ArrowUp",
  "ArrowUp",
  "ArrowDown",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "ArrowLeft",
  "ArrowRight",
  "b",
  "a",
] as const;

export const TENTH_POKE = 10;
export const LCD_ROW_CAP = 8;

const IGNORED_KEYS = new Set(["Shift", "Control", "Alt", "Meta", "CapsLock"]);

export type EndCueShape = {
  lcd: readonly [string, string];
  readout: string;
};

export type EndCopyShape = {
  idle: EndCueShape;
  tenth: EndCueShape;
  unlocked: EndCueShape;
  lines: readonly EndCueShape[];
};

export type EndMode = "idle" | "poke" | "tenth" | "unlocked";

export type End = {
  items: number;
  line: number;
  pokes: number;
  pressed: boolean;
  hold: number;
  progress: number;
  unlocked: boolean;
  cue: EndMode;
};

export type EndAction = "poke" | "tick" | "settle" | "leave" | "restore" | { key: string };

export const newEnd = (items = 6, unlocked = false): End => ({
  items: Math.max(1, items),
  line: 0,
  pokes: 0,
  pressed: false,
  hold: 0,
  progress: 0,
  unlocked,
  cue: unlocked ? "unlocked" : "idle",
});

export const endBusy = (s: End): boolean => s.pressed;

function endFrame(s: End): End {
  if (!s.pressed) return s;
  return s.hold > 1 ? { ...s, hold: s.hold - 1 } : { ...s, pressed: false, hold: 0 };
}

function settleEnd(state: End): End {
  for (let i = 0; i < 64 && endBusy(state); i++) {
    state = endFrame(state);
  }
  return state;
}

// KMP-style prefix overlap: returns the longest prefix of KONAMI that matches
// the suffix of keys typed so far when rawKey is appended.
export function konamiStep(progress: number, rawKey: string): number {
  if (!rawKey || IGNORED_KEYS.has(rawKey)) return progress;
  const key = rawKey.length === 1 ? rawKey.toLowerCase() : rawKey;
  const clamped = Math.max(0, Math.min(progress, KONAMI.length - 1));
  const stream = [...KONAMI.slice(0, clamped), key];
  for (let len = Math.min(stream.length, KONAMI.length); len > 0; len--) {
    let matches = true;
    for (let i = 0; i < len; i++) {
      if (KONAMI[i] !== stream[stream.length - len + i]) {
        matches = false;
        break;
      }
    }
    if (matches) return len;
  }
  return 0;
}

export function end(s: End, action: EndAction): End {
  if (action === "tick") return endFrame(s);
  if (action === "settle") return settleEnd(s);
  if (action === "leave") {
    return s.progress === 0 ? s : { ...s, progress: 0 };
  }
  if (action === "restore") {
    if (s.unlocked) return s;
    return {
      ...s,
      unlocked: true,
      cue: s.cue === "idle" ? "unlocked" : s.cue,
    };
  }
  if (action === "poke") {
    const pokes = s.pokes + 1;
    // On the 10th poke, show the special 10th-poke line without consuming a
    // regular cycle slot so the 11th poke continues smoothly.
    const line = pokes === TENTH_POKE ? s.line : (s.line + 1) % s.items;
    const cue: EndMode = pokes === TENTH_POKE ? "tenth" : "poke";
    return {
      ...s,
      line,
      pokes,
      pressed: true,
      hold: 2,
      cue,
    };
  }
  if (IGNORED_KEYS.has(action.key)) return s;
  const next = konamiStep(s.progress, action.key);
  if (next >= KONAMI.length) {
    return {
      ...s,
      progress: 0,
      unlocked: true,
      cue: "unlocked",
    };
  }
  return next === s.progress ? s : { ...s, progress: next };
}

export function endCue(s: End, copy: EndCopyShape): EndCueShape {
  if (s.cue === "unlocked") return copy.unlocked;
  if (s.cue === "tenth") return copy.tenth;
  if (s.cue === "idle") return copy.idle;
  return copy.lines[s.line % copy.lines.length] ?? copy.idle;
}

export function lcdRows(s: End, copy: EndCopyShape): readonly [string, string] {
  return endCue(s, copy).lcd;
}

export function lcdLine(s: End, copy: EndCopyShape): string {
  return lcdRows(s, copy).join(" ");
}

export function endReadout(s: End, copy: EndCopyShape): string {
  return endCue(s, copy).readout;
}

// Mail goes to a mail app; the rest open in a new tab.
export const away = (href: string) =>
  href.startsWith("mailto:") ? {} : ({ target: "_blank", rel: "me noreferrer" } as const);
