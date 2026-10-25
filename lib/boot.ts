// The pocket console's boot, once a session, as data: each step names a part of the console figure
// (components/handheld.tsx), when it starts and how long it moves, in ms from the page's first paint. The
// timings go inline on the parts; the keyframes live in globals.css (.boot-*). The base style is the booted
// console, so a returning visit drops the animations and shows the menu at once. Pure, apart from the two
// helpers at the end that take the document and storage as arguments, so a test can read every step.

export type BootPart = "cart" | "lamp" | "lcd" | "scan" | "print" | "menu";
export type BootStep = { part: BootPart; at: number; ms: number };

// sessionStorage key, and the attribute the root layout's script sets on <html> before first paint.
export const BOOT_KEY = "console:booted";
export const BOOT_ATTR = "data-booted";

// The figure prints itself in first (.figure, 0.6 s); the boot starts after it.
export const BOOT_START = 600;
export const MAX_BOOT_MS = 2400;
export const MAX_STEP_MS = 400;

export const BOOT: readonly BootStep[] = [
  // the cartridge clicks into its slot
  { part: "cart", at: 600, ms: 240 },
  // the power lamp lights
  { part: "lamp", at: 880, ms: 40 },
  // the screen flickers on, in steps
  { part: "lcd", at: 940, ms: 320 },
  // a scan line runs down it
  { part: "scan", at: 1280, ms: 360 },
  // OTOHIME types out, one letter a step, and the chime plays (if it may)
  { part: "print", at: 1660, ms: 280 },
  // the name goes and the menu comes up
  { part: "menu", at: 2200, ms: 120 },
];

export const step = (part: BootPart) => BOOT.find((s) => s.part === part)!;
export const stepEnd = (s: BootStep) => s.at + s.ms;
export const BOOT_END = Math.max(...BOOT.map(stepEnd));

// The inline timing for a part.
export const bootStyle = (part: BootPart) => {
  const s = step(part);
  return { animationDelay: `${s.at}ms`, animationDuration: `${s.ms}ms` };
};

// The name shows from its first printed letter until the menu replaces it. A hold, not a movement.
export const splashStyle = () => {
  const from = step("print").at;
  return { animationDelay: `${from}ms`, animationDuration: `${step("menu").at - from}ms` };
};

// Runs in <head> before first paint: a console that already booted this session skips its boot. Storage
// that throws (blocked, or sandboxed) leaves the attribute off, and the boot plays.
export const bootScript = `try{if(sessionStorage.getItem(${JSON.stringify(BOOT_KEY)}))document.documentElement.setAttribute(${JSON.stringify(BOOT_ATTR)},"")}catch(e){}`;

type Root = Pick<Element, "hasAttribute" | "setAttribute">;
type Session = () => Pick<Storage, "setItem">;

export const booted = (root: Root) => root.hasAttribute(BOOT_ATTR);

// Booted for the rest of this document (a client-side return to Home skips it even when storage is denied)
// and, when storage works, for the rest of the session.
export function finishBoot(root: Root, session: Session) {
  root.setAttribute(BOOT_ATTR, "");
  try {
    session().setItem(BOOT_KEY, "1");
  } catch {
    // storage denied: this document only
  }
}

// The chime plays only on a boot that runs, with motion allowed, in a document the visitor has already
// clicked or typed in (sticky user activation, so the browser lets audio start). A cold load never has
// that. The sound preference itself is checked when the cue plays (lib/sound-client.ts).
export const chimeAllowed = ({ booted, reduced, activated }: { booted: boolean; reduced: boolean; activated: boolean }) =>
  !booted && !reduced && activated;
