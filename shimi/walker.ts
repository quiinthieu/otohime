/** The DOM adapter must apply this predicate to EVERY ancestor up to main. */
export const SHIMI_SKIP_TAGS: ReadonlySet<string> = new Set([
  "SCRIPT", "STYLE", "NOSCRIPT", "INPUT", "TEXTAREA", "SELECT", "OPTION",
  "CODE", "PRE", "KBD", "SAMP", "BUTTON", "NAV", "FORM", "DIALOG", "SVG", "CANVAS",
]);
export type ShimiAttributes = Readonly<Record<string, string | boolean | null | undefined>>;

export function shouldSkipShimiElement(tagName: string, attrs: ShimiAttributes = {}): boolean {
  const present = (key: string) => attrs[key] !== undefined && attrs[key] !== null;
  return SHIMI_SKIP_TAGS.has(tagName.toUpperCase()) || present("contenteditable") ||
    String(attrs["aria-hidden"]).toLowerCase() === "true" || present("data-shimi-ignore") ||
    present("hidden") || present("inert");
}

/** Strip addresses BEFORE tokenizing, so their component words cannot enter the diet. */
export function extractCrawlableWords(text: string): string[] {
  const readable = text.normalize("NFKC")
    .replace(/(?:\b[a-z][a-z\d+.-]*:\/\/|\bwww\.|\bmailto:)\S+/giu, " ")
    .replace(/[\p{L}\p{N}._%+-]+@[\p{L}\p{N}.-]+(?:\.[\p{L}]{2,})?/gu, " ")
    .replace(/\b(?:[a-z\d](?:[a-z\d-]*[a-z\d])?\.)+[a-z]{2,}(?:[/:?#]\S*)?/giu, " ");
  return readable.match(/[\p{L}\p{N}][\p{L}\p{M}\p{N}]*(?:['’\-][\p{L}\p{N}][\p{L}\p{M}\p{N}]*)*/gu) ?? [];
}
