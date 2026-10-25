// Builds public/peeks.json, the three items each marked link fans out: every
// sketch, note, project and Gazette article, plus the Gazette's kickers as tags
// and the songs' artists as credits. lib/peeks.ts does the ranking; this file
// only gathers content, and lives in scripts/ because nothing in lib/ or
// components/ may import the Gazette.
//   npm run peeks:index   write the index
//   npm run peeks:check   exit 1 if the committed index differs from a fresh build
// --file=<path> reads or writes another file (the tests check a tampered copy).
import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { ARTICLES } from "../app/(articles)/_lib/articles.ts";
import { site } from "../content/site.ts";
import { buildPeekIndex, peekSlug, serializePeeks, type PeekCandidate, type PeekIndex, type PeekTarget } from "../lib/peeks.ts";

const DEFAULT_FILE = join(import.meta.dirname, "../public/peeks.json");

// The section of /sketches each kind sits in (its h2 id).
const SKETCH_SECTION = { place: "places", object: "objects", person: "people" } as const;

export function candidates(): PeekCandidate[] {
  const out: PeekCandidate[] = [];
  site.sketches.forEach((s, order) => {
    out.push({
      id: `sketch:${peekSlug(s.title)}`,
      item: { kind: "sketch", title: s.title, href: `/sketches#${SKETCH_SECTION[s.kind]}`, blurb: s.note, src: s.src },
      text: `${s.title} ${s.kind} ${s.note}`,
      order,
    });
  });
  site.notes.forEach((n, order) => {
    out.push({
      id: `note:${peekSlug(n.title)}`,
      item: { kind: "note", title: n.title, href: "/notes", blurb: n.body },
      text: `${n.title} ${n.body}`,
      order,
      date: n.date,
    });
  });
  site.projectList.forEach((p, order) => {
    out.push({
      id: `project:${peekSlug(p.title)}`,
      item: { kind: "project", title: p.title, href: p.href ?? "/projects", blurb: p.note },
      text: `${p.title} ${p.note}`,
      order,
    });
  });
  ARTICLES.forEach((a, order) => {
    out.push({
      id: `article:${a.slug}`,
      item: { kind: "article", title: a.headline, href: `/articles/${a.slug}`, blurb: a.deck },
      text: `${a.kicker} ${a.headline} ${a.deck}`,
      order,
      date: a.published,
    });
  });
  return out;
}

export function targets(items: readonly PeekCandidate[]): PeekTarget[] {
  const out: PeekTarget[] = items.map((c) => ({ key: c.id, text: c.text }));
  for (const kicker of [...new Set(ARTICLES.map((a) => a.kicker))]) {
    const tagged = items.filter((c) => c.item.kind === "article" && c.text.startsWith(`${kicker} `));
    out.push({ key: `tag:${peekSlug(kicker)}`, text: [kicker, ...tagged.map((c) => c.text)].join(" ") });
  }
  for (const song of site.songs) {
    out.push({ key: `credit:${peekSlug(song.artist)}`, text: `${song.artist} ${song.title} ${song.note}` });
  }
  return out;
}

export function buildIndex(): PeekIndex {
  const items = candidates();
  return buildPeekIndex(items, targets(items));
}

function main(argv: string[]): number {
  const fileArg = argv.find((a) => a.startsWith("--file="));
  const file = fileArg ? resolve(fileArg.slice("--file=".length)) : DEFAULT_FILE;
  const fresh = serializePeeks(buildIndex());
  if (argv.includes("--check")) {
    let committed = "";
    try {
      committed = readFileSync(file, "utf8");
    } catch {
      console.error(`peeks:check: ${file} is missing; run npm run peeks:index`);
      return 1;
    }
    if (committed !== fresh) {
      console.error(`peeks:check: ${file} is stale; run npm run peeks:index and commit it`);
      return 1;
    }
    console.log(`peeks:check: ${file} is up to date`);
    return 0;
  }
  writeFileSync(file, fresh);
  console.log(`peeks:index: wrote ${Object.keys(JSON.parse(fresh).peeks).length} peeks to ${file}`);
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === import.meta.filename) process.exitCode = main(process.argv.slice(2));
