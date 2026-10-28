import { site } from "../../../../../content/site.ts";

/** Match the published slug exactly; titles can change without moving a note. */
export function noteBySlug(slug: string) {
  return site.notes.find((note) => note.slug === slug);
}
