// Ask the console, offline: a pure answerer over public/ask-index.json, which
// scripts/ask-index.ts builds from content/site.ts and the Gazette. No network,
// no model. It ranks passages with BM25, forgives one typo in a long word,
// answers a few stock questions by rule with canned answers that cite their
// page, and says NO MATCH when nothing scores. Every reply line is a passage's
// text or one of TEMPLATES, so the console can only ever repeat the site.

export type PassageKind = "bio" | "now" | "note" | "stack" | "work" | "page" | "game" | "project" | "article" | "line";
export type Passage = { id: string; title: string; href: string; kind: PassageKind; text: string; tokens: string[] };
export type AskIndex = { version: 1; passages: Passage[] };

export type Hit = { passage: Passage; score: number };
export type Source = { title: string; href: string };
export type StockIntent = "contact" | "now" | "projects" | "bio" | "work" | "notes";
export type Reply = { intent: StockIntent | "search" | "none"; lines: string[]; sources: Source[] };

// The only words the console says on its own.
export const TEMPLATES = {
  noMatch: "NO MATCH.",
  hint: "TRY A PROJECT, A GAME, A NOTE OR 'CONTACT'.",
  bio: "WHO:",
  now: "NOW:",
  projects: "PROJECTS:",
  contact: "LINES OPEN:",
  work: "WORK:",
  notes: "NOTES:",
  found: "FOUND:",
} as const;

export const MAX_PASSAGE_WORDS = 60;
const K1 = 1.2;
const B = 0.75;
// A hit below this is noise. One exact match on a word the site uses once scores
// about 2; a fuzzy match on a common word scores well under 1.
export const SCORE_FLOOR = 0.8;
// A typo'd term counts for less than the word itself.
const FUZZY_WEIGHT = 0.7;
const FUZZY_MIN_LENGTH = 5;
// Further hits are shown only when they score this close to the best.
const RUNNER_UP = 0.6;
const MAX_HITS = 3;

const STOPWORDS = new Set(
  (
    "a an and any are as at be been but by can could did do does doing for from had has have how i if in into is it its " +
    "me my of on or our so some than that the their them then there these they this those to too was we were what when " +
    "where which while who whom why will with would you your yours about tell show please"
  ).split(" "),
);

// ASCII-folded, lowercase words: "ADÉLA's" -> ["adela", "s"].
export function words(text: string): string[] {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
}

// Light stemming: enough that "projects", "playing" and "stories" meet their stems.
export function stem(word: string): string {
  if (word.length <= 3 || /^\d/.test(word)) return word;
  if (word.endsWith("ies") && word.length > 4) return word.slice(0, -3) + "y";
  if (word.endsWith("sses")) return word.slice(0, -2);
  if (word.endsWith("ing") && word.length > 5) return word.slice(0, -3);
  if (word.endsWith("ed") && word.length > 4) return word.slice(0, -2);
  if (word.endsWith("s") && !/(?:ss|us|is)$/.test(word)) return word.slice(0, -1);
  return word;
}

export function tokenize(text: string): string[] {
  return words(text)
    .filter((w) => w.length > 1 && !STOPWORDS.has(w))
    .map(stem);
}

// Optimal string alignment distance, stopping early once it passes max.
export function editDistance(a: string, b: string, max = 1): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const rows: number[][] = [];
  for (let i = 0; i <= a.length; i++) {
    rows.push([i]);
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      if (i === 0) {
        rows[0].push(j);
        continue;
      }
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let d = Math.min(rows[i - 1][j] + 1, rows[i][j - 1] + 1, rows[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d = Math.min(d, rows[i - 2][j - 2] + 1);
      rows[i].push(d);
      best = Math.min(best, d);
    }
    if (i > 0 && best > max) return max + 1;
  }
  return rows[a.length][b.length];
}

type Model = { index: AskIndex; df: Map<string, number>; tf: Map<string, number>[]; lengths: number[]; avgdl: number };

const models = new WeakMap<AskIndex, Model>();

function model(index: AskIndex): Model {
  const cached = models.get(index);
  if (cached) return cached;
  const df = new Map<string, number>();
  const tf = index.passages.map((p) => {
    const counts = new Map<string, number>();
    for (const t of p.tokens) counts.set(t, (counts.get(t) ?? 0) + 1);
    for (const t of counts.keys()) df.set(t, (df.get(t) ?? 0) + 1);
    return counts;
  });
  const lengths = index.passages.map((p) => p.tokens.length);
  const avgdl = lengths.reduce((s, n) => s + n, 0) / Math.max(1, lengths.length);
  const m = { index, df, tf, lengths, avgdl };
  models.set(index, m);
  return m;
}

// Each query term becomes the index terms it stands for, with a weight: itself
// if the site uses it, else any term one edit away when it is long enough.
function expand(m: Model, term: string): [string, number][] {
  if (m.df.has(term)) return [[term, 1]];
  if (term.length < FUZZY_MIN_LENGTH) return [];
  const near: [string, number][] = [];
  for (const t of m.df.keys()) if (editDistance(term, t) <= 1) near.push([t, FUZZY_WEIGHT]);
  return near;
}

export function search(index: AskIndex, query: string): Hit[] {
  const m = model(index);
  const n = index.passages.length;
  const terms = [...new Set(tokenize(query))].flatMap((t) => expand(m, t));
  if (terms.length === 0) return [];
  const hits: Hit[] = [];
  index.passages.forEach((passage, i) => {
    let score = 0;
    for (const [term, weight] of terms) {
      const f = m.tf[i].get(term);
      if (!f) continue;
      const df = m.df.get(term) ?? 0;
      const idf = Math.log(1 + (n - df + 0.5) / (df + 0.5));
      score += weight * idf * ((f * (K1 + 1)) / (f + K1 * (1 - B + (B * m.lengths[i]) / m.avgdl)));
    }
    if (score > 0) hits.push({ passage, score });
  });
  // Ties keep index order, so the answer is stable.
  return hits.sort((a, b) => b.score - a.score);
}

// The stock questions: a trigger word, and nothing else in the question but allowed words. Each canned answer
// is its head template over every passage of its kinds, and cites the page those passages live on: the
// first passage's page, each passage's own page, or a named page.
type Cite = "first" | "each" | Source;
const INTENTS: { intent: StockIntent; trigger: RegExp; allowed: Set<string>; kinds: PassageKind[]; cite: Cite }[] = [
  { intent: "contact", trigger: /\b(?:contact|email|reach|message|dm)\b/, allowed: new Set(["contact", "email", "reach", "message", "dm", "get", "touch"]), kinds: ["line"], cite: "each" },
  { intent: "now", trigger: /\b(?:now|playing|currently)\b/, allowed: new Set(["now", "play", "currently", "right", "day"]), kinds: ["now"], cite: "first" },
  { intent: "projects", trigger: /\bprojects?\b/, allowed: new Set(["project", "list", "built", "build", "made", "make", "all"]), kinds: ["project"], cite: "each" },
  { intent: "bio", trigger: /\b(?:who|do)\b/, allowed: new Set(["otohime", "job", "yourself", "living"]), kinds: ["bio"], cite: "first" },
  {
    intent: "work",
    trigger: /\b(?:work|stack|tools?|tech)\b/,
    allowed: new Set(["work", "stack", "tool", "tech", "use", "data", "engineer", "day"]),
    kinds: ["work", "stack"],
    cite: "first",
  },
  {
    intent: "notes",
    trigger: /\b(?:notes?|write|writing|written|wrote)\b/,
    allowed: new Set(["note", "write", "writ", "written", "wrote", "read", "list", "all", "latest"]),
    kinds: ["note"],
    cite: { title: "Notes", href: "/notes" },
  },
];

const sourcesOf = (passages: Passage[]): Source[] => {
  const seen = new Set<string>();
  return passages.flatMap((p) => (seen.has(p.href) ? [] : (seen.add(p.href), [{ title: p.title, href: p.href }])));
};

function byKinds(index: AskIndex, kinds: PassageKind[]): Passage[] {
  return index.passages.filter((p) => kinds.includes(p.kind));
}

function cited(passages: Passage[], cite: Cite): Source[] {
  if (cite === "each") return sourcesOf(passages);
  if (cite === "first") return sourcesOf(passages.slice(0, 1));
  return [cite];
}

export function answer(index: AskIndex, query: string): Reply {
  const raw = words(query).join(" ");
  const content = tokenize(query);
  for (const { intent, trigger, allowed, kinds, cite } of INTENTS) {
    if (!trigger.test(raw) || !content.every((t) => allowed.has(t))) continue;
    const passages = byKinds(index, kinds);
    if (passages.length === 0) continue;
    return { intent, lines: [TEMPLATES[intent], ...passages.map((p) => p.text)], sources: cited(passages, cite) };
  }
  const hits = search(index, query);
  if (hits.length === 0 || hits[0].score < SCORE_FLOOR) return { intent: "none", lines: [TEMPLATES.noMatch, TEMPLATES.hint], sources: [] };
  const best = hits[0].score;
  const shown = hits.filter((h) => h.score >= best * RUNNER_UP).slice(0, MAX_HITS).map((h) => h.passage);
  return { intent: "search", lines: [TEMPLATES.found, ...shown.map((p) => p.text)], sources: sourcesOf(shown) };
}
