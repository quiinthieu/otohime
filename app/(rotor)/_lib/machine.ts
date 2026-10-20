// Pure state for the page's machine: (state, action) => state, so the island
// runs it with useReducer and a test can type on it without a browser. Copied
// in the style of Capsule's machine, not imported: Rotor owes nothing to it.
// A press steps the rotors once, lights one lamp and adds a letter to both
// lines of the tape; release puts the key back up and the lamp out. "tick"
// advances the key-sink and lamp-glow frames at 12 fps; under reduced motion
// they jump straight to their last frame. A settings change sends the windows
// back to the start positions and enciphers the tape again from there, so
// the tape always matches the share URL.
import { encodeLetter, MAX_PLUGS, MESSAGE_CAP, run, type Settings } from "./enigma.ts";
import type { ReflectorName, RotorName } from "./wiring.ts";

export const FPS = 12;
export const FRAME_MS = 1000 / FPS;
export const KEY_FRAMES = 2; // the key sinks
export const LAMP_FRAMES = 3; // the lamp warms up

export type Slot = 0 | 1 | 2;

export type Machine = {
  settings: Settings; // settings.positions are the start positions
  positions: string; // the windows now
  plain: string;
  code: string;
  down: string | null; // the key held down
  lamp: string | null; // the lamp lit
  keyFrame: number;
  lampFrame: number;
  reduced: boolean;
};

export type MachineAction =
  | { type: "press"; letter: string }
  | { type: "release" }
  | { type: "set-rotor"; slot: Slot; name: RotorName }
  | { type: "set-ring"; slot: Slot; letter: string }
  | { type: "set-start"; slot: Slot; letter: string }
  | { type: "plug"; a: string; b: string }
  | { type: "unplug"; a: string }
  | { type: "reflector"; name: ReflectorName }
  | { type: "motion"; reduced: boolean }
  | { type: "clear" }
  | { type: "tick" };

const isLetter = (c: string) => /^[A-Z]$/.test(c);
const put = (s: string, slot: Slot, c: string) => s.slice(0, slot) + c + s.slice(slot + 1);

/** The machine as the server left it: `message` already typed from the start positions. */
export function newMachine(settings: Settings, message = "", reduced = false): Machine {
  const plain = Array.from(message.toUpperCase()).slice(0, MESSAGE_CAP).join("");
  const { code, positions } = run(settings, plain);
  return { settings, positions, plain, code, down: null, lamp: null, keyFrame: 0, lampFrame: 0, reduced };
}

/** Whether a tick would change anything: the island's timer runs only while this holds. */
export const pending = (s: Machine) =>
  (s.down !== null && s.keyFrame < KEY_FRAMES) || (s.lamp !== null && s.lampFrame < LAMP_FRAMES);

const resettle = (s: Machine, settings: Settings): Machine => newMachine(settings, s.plain, s.reduced);

export function machine(s: Machine, action: MachineAction): Machine {
  switch (action.type) {
    case "press": {
      const letter = action.letter.toUpperCase();
      if (s.down !== null || !isLetter(letter) || s.plain.length >= MESSAGE_CAP) return s;
      const [next, lamp] = encodeLetter({ ...s.settings, positions: s.positions }, letter);
      return {
        ...s,
        positions: next.positions,
        plain: s.plain + letter,
        code: s.code + lamp,
        down: letter,
        lamp,
        keyFrame: s.reduced ? KEY_FRAMES : 0,
        lampFrame: s.reduced ? LAMP_FRAMES : 0,
      };
    }
    case "release":
      return s.down === null ? s : { ...s, down: null, lamp: null, keyFrame: 0, lampFrame: 0 };
    case "tick":
      return pending(s)
        ? {
            ...s,
            keyFrame: s.down !== null ? Math.min(KEY_FRAMES, s.keyFrame + 1) : s.keyFrame,
            lampFrame: s.lamp !== null ? Math.min(LAMP_FRAMES, s.lampFrame + 1) : s.lampFrame,
          }
        : s;
    case "motion":
      return {
        ...s,
        reduced: action.reduced,
        keyFrame: action.reduced && s.down !== null ? KEY_FRAMES : s.keyFrame,
        lampFrame: action.reduced && s.lamp !== null ? LAMP_FRAMES : s.lampFrame,
      };
    case "clear":
      return resettle({ ...s, plain: "" }, s.settings);
    case "set-rotor": {
      const rotors = [...s.settings.rotors];
      const other = rotors.indexOf(action.name);
      if (other === action.slot) return s;
      if (other >= 0) rotors[other] = rotors[action.slot]; // the wheel already in use swaps places
      rotors[action.slot] = action.name;
      return resettle(s, { ...s.settings, rotors: rotors as unknown as Settings["rotors"] });
    }
    case "set-ring":
    case "set-start": {
      const letter = action.letter.toUpperCase();
      if (!isLetter(letter)) return s;
      const field = action.type === "set-ring" ? "rings" : "positions";
      return resettle(s, { ...s.settings, [field]: put(s.settings[field], action.slot, letter) });
    }
    case "plug": {
      const [a, b] = [action.a.toUpperCase(), action.b.toUpperCase()];
      if (!isLetter(a) || !isLetter(b) || a === b) return s;
      // re-plugging a letter pulls its old cable first
      const kept = s.settings.plugs.filter((p) => !p.includes(a) && !p.includes(b));
      if (kept.length >= MAX_PLUGS) return s;
      return resettle(s, { ...s.settings, plugs: [...kept, [a, b].sort().join("")] });
    }
    case "unplug": {
      const a = action.a.toUpperCase();
      const plugs = s.settings.plugs.filter((p) => !p.includes(a));
      return plugs.length === s.settings.plugs.length ? s : resettle(s, { ...s.settings, plugs });
    }
    case "reflector":
      return action.name === s.settings.reflector ? s : resettle(s, { ...s.settings, reflector: action.name });
  }
}
