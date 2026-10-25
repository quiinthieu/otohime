// Builds public/ask-index.json, the only thing the console's Ask answers from:
// the words in content/site.ts and the Gazette's articles, cut into passages of
// at most 60 words, each with the page it came from. It lives in scripts/
// because nothing in lib/ or components/ may import the Gazette.
//   npm run ask:index   write the index
//   npm run ask:check   exit 1 if the committed index differs from a fresh build or
//                       does not cover Work, Projects and Notes; prints the coverage
// --file=<path> reads or writes another file (the tests check a tampered copy).
import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { ARTICLES } from "../app/(articles)/_lib/articles.ts";
import { site } from "../content/site.ts";
import { MAX_PASSAGE_WORDS, tokenize, type AskIndex, type Passage, type PassageKind } from "../lib/ask.ts";

const DEFAULT_FILE = join(import.meta.dirname, "../public/ask-index.json");

const wordCount = (text: string) => text.split(/\s+/).filter(Boolean).length;

// Whole sentences, packed greedily into chunks of at most `max` words. A single
// sentence longer than that is cut at word boundaries.
export function chunks(text: string, max = MAX_PASSAGE_WORDS): string[] {
  const sentences = text.split(/(?<=[.!?])\s+/).flatMap((s) => {
    const w = s.split(/\s+/).filter(Boolean);
    const out: string[] = [];
    for (let i = 0; i < w.length; i += max) out.push(w.slice(i, i + max).join(" "));
    return out;
  });
  const out: string[] = [];
  let current = "";
  for (const s of sentences) {
    const next = current ? `${current} ${s}` : s;
    if (current && wordCount(next) > max) {
      out.push(current);
      current = s;
    } else current = next;
  }
  if (current) out.push(current);
  return out;
}

const slug = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export function buildIndex(): AskIndex {
  const passages: Passage[] = [];
  const add = (id: string, title: string, href: string, kind: PassageKind, text: string) => {
    chunks(text).forEach((part, i, all) => {
      passages.push({ id: all.length > 1 ? `${id}-${i + 1}` : id, title, href, kind, text: part, tokens: tokenize(`${title} ${part}`) });
    });
  };

  add("bio-tagline", "Bio", "/", "bio", site.tagline);
  site.bio.forEach((text, i) => add(`bio-${i + 1}`, "Bio", "/", "bio", text));
  for (const n of site.now) add(`now-${slug(n.what)}`, "Now", "/", "now", `${n.what}: ${n.note}`);
  for (const l of site.lines) add(`line-${slug(l.label)}`, l.label, "/", "line", `${l.label}: ${l.handle} (${l.href})`);
  add("work", "Work", "/work", "work", site.work);
  for (const s of site.stack) add(`stack-${slug(s.what)}`, "Work", "/work", "stack", `${s.what}: ${s.tools}, ${s.note}.`);
  add("play", "Play", "/play", "page", site.play);
  for (const g of site.games) add(`game-${slug(g.title)}`, g.title, "/play", "game", `${g.title}: ${g.note}`);
  add("projects", "Projects", "/projects", "page", site.projects);
  for (const p of site.projectList) {
    add(`project-${slug(p.title)}`, p.title, p.href ?? "/projects", "project", `${p.title}: ${p.note}`);
  }
  for (const n of site.notes) add(`note-${slug(n.title)}`, n.title, "/notes", "note", `${n.title}. ${n.body}`);
  for (const a of ARTICLES) {
    const href = `/articles/${a.slug}`;
    add(`article-${a.slug}`, a.headline, href, "article", `${a.headline}. ${a.deck}`);
    a.body.forEach((p, i) => add(`article-${a.slug}-p${i + 1}`, a.headline, href, "article", p));
  }

  const ids = new Set<string>();
  for (const p of passages) {
    if (ids.has(p.id)) throw new Error(`duplicate passage id ${p.id}`);
    ids.add(p.id);
  }
  return { version: 1, passages };
}

// The pages Ask must be able to answer from: at least one passage on the page itself, and for Projects at
// least one project too (a project's passage links to the project, not to /projects).
export const REQUIRED_SOURCES: { name: string; href: string; items?: PassageKind }[] = [
  { name: "Work", href: "/work" },
  { name: "Projects", href: "/projects", items: "project" },
  { name: "Notes", href: "/notes" },
];

export type Coverage = { name: string; href: string; passages: number; ok: boolean };

export function coverage(index: AskIndex): Coverage[] {
  return REQUIRED_SOURCES.map(({ name, href, items }) => {
    const onPage = index.passages.filter((p) => p.href === href).length;
    const itemCount = items ? index.passages.filter((p) => p.kind === items && p.href !== href).length : 0;
    return { name, href, passages: onPage + itemCount, ok: onPage > 0 && (!items || index.passages.some((p) => p.kind === items)) };
  });
}

// One passage per line, so a content change is a readable diff.
export function serialize(index: AskIndex): string {
  return `{"version":${index.version},"passages":[\n${index.passages.map((p) => JSON.stringify(p)).join(",\n")}\n]}\n`;
}

function main(argv: string[]): number {
  const fileArg = argv.find((a) => a.startsWith("--file="));
  const file = fileArg ? resolve(fileArg.slice("--file=".length)) : DEFAULT_FILE;
  const fresh = serialize(buildIndex());
  if (argv.includes("--check")) {
    let committed = "";
    try {
      committed = readFileSync(file, "utf8");
    } catch {
      console.error(`ask:check: ${file} is missing; run npm run ask:index`);
      return 1;
    }
    let parsed: AskIndex;
    try {
      parsed = JSON.parse(committed);
    } catch {
      console.error(`ask:check: ${file} is not JSON; run npm run ask:index`);
      return 1;
    }
    const covered = coverage(parsed);
    const missing = covered.filter((c) => !c.ok);
    if (missing.length > 0) {
      console.error(`ask:check: ${file} does not cover ${missing.map((c) => `${c.name} (${c.href})`).join(", ")}`);
      return 1;
    }
    console.log(`ask:check: covers ${covered.map((c) => `${c.name} ${c.href} (${c.passages} passages)`).join(", ")}`);
    if (committed !== fresh) {
      console.error(`ask:check: ${file} is stale; run npm run ask:index and commit it`);
      return 1;
    }
    console.log(`ask:check: ${file} is up to date`);
    return 0;
  }
  writeFileSync(file, fresh);
  console.log(`ask:index: wrote ${JSON.parse(fresh).passages.length} passages to ${file}`);
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === import.meta.filename) process.exitCode = main(process.argv.slice(2));
