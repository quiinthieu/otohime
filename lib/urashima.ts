// The way down to Ryugu-jo (app/(ryugu)/): typing "urashima" anywhere on the site, outside a form field.
// components/urashima-keys.tsx feeds each keydown through urashimaStep and goes down when it completes.
//
// The word holds two a's, and A on the Pocket console (components/handheld.tsx) opens a page. Once "ur" is typed,
// every further key that keeps the word going is taken (take: true), so the listener prevents its default and the
// console, which skips handled keys, never sees it. "u" or "ur" on their own take nothing.
export const SECRET = "urashima";
export const PALACE_HREF = "/ryugu";
// Keys from this far into the word on are taken.
export const TAKE_FROM = 2;

export type Step = { progress: number; take: boolean; done: boolean };

// One key against the progress so far (how many letters of SECRET are already typed). A wrong key starts again,
// and counts as the first letter if it is one ("uurashima" still works). Case is ignored; a key that is not one
// character (Shift, an arrow) breaks the word.
export function urashimaStep(progress: number, key: string): Step {
  const k = key.length === 1 ? key.toLowerCase() : "";
  const at = progress >= 0 && progress < SECRET.length ? progress : 0;
  if (k !== "" && k === SECRET[at]) {
    const next = at + 1;
    const done = next === SECRET.length;
    return { progress: done ? 0 : next, take: at >= TAKE_FROM, done };
  }
  return { progress: k === SECRET[0] ? 1 : 0, take: false, done: false };
}

// Keys the word ignores entirely, so they neither count nor break it: modifiers held alone.
export const IGNORED = new Set(["Shift", "CapsLock"]);
