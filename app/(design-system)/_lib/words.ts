// The one word counter for Design system, copied from Structures' (a group owes
// nothing to another): the tests count a page's words with textWords and the
// walk counts the served page with visibleWords, so the two cannot drift. A word is a whitespace-separated token with a letter or digit
// in it, so "·" and "—" separators are free. Attributes (aria-label) are not
// visible and not counted.

// The page: the four parts, the captions, the knobs and the counter.
export const WORD_CAP = 700;

const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&#x27;": "'",
  "&nbsp;": " ",
};

export function textWords(text: string): number {
  return text.split(/\s+/).filter((t) => /[\p{L}\p{N}]/u.test(t)).length;
}

export function visibleWords(html: string): number {
  let s = html
    .replace(/<script\b[\s\S]*?<\/script\s*>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style\s*>/gi, " ")
    .replace(/<template\b[\s\S]*?<\/template\s*>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ");
  const body = s.search(/<body\b/i);
  if (body >= 0) s = s.slice(body);
  s = s.replace(/<[^>]*>/g, " ").replace(/&(?:amp|lt|gt|quot|#39|#x27|nbsp);/gi, (e) => ENTITIES[e.toLowerCase()]);
  return textWords(s);
}
