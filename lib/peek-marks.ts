// The server half of fan-out peeks: the attributes that mark a link or button
// for components/peek-layer.tsx. A key the committed index does not know marks
// nothing, so a new song or project stays a plain link until npm run
// peeks:index runs. Server pages only: the client fetches /peeks.json itself.
import committed from "../public/peeks.json";
import { PEEK_HINT_ID, peeksFor, type PeekIndex } from "./peeks.ts";

const index = committed as unknown as PeekIndex;

export type PeekMark = { "data-peek": string; "aria-describedby": string };

export function peekMark(key: string): PeekMark | null {
  return peeksFor(index, key).length ? { "data-peek": key, "aria-describedby": PEEK_HINT_ID } : null;
}

// The Gazette's desks as the index has them: tag:sky -> { key, label: "Sky" }.
export function peekTags(): { key: string; label: string }[] {
  return Object.keys(index.peeks)
    .filter((k) => k.startsWith("tag:"))
    .map((key) => {
      const slug = key.slice("tag:".length).replace(/-/g, " ");
      return { key, label: slug.charAt(0).toUpperCase() + slug.slice(1) };
    });
}
