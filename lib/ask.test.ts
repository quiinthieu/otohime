import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { answer, editDistance, MAX_PASSAGE_WORDS, search, stem, TEMPLATES, tokenize, words, type AskIndex } from "./ask.ts";

const ROOT = join(import.meta.dirname, "..");
const INDEX_FILE = join(ROOT, "public/ask-index.json");
const index: AskIndex = JSON.parse(readFileSync(INDEX_FILE, "utf8"));
const TEMPLATE_LINES = new Set<string>(Object.values(TEMPLATES));

// The index is built by a script, not imported: lib/ may not reach the Gazette.
function runIndexScript(...args: string[]) {
  return spawnSync(
    process.execPath,
    [
      "--experimental-strip-types",
      "--disable-warning=ExperimentalWarning",
      "--disable-warning=MODULE_TYPELESS_PACKAGE_JSON",
      join(ROOT, "scripts/ask-index.ts"),
      ...args,
    ],
    { cwd: ROOT, encoding: "utf8" },
  );
}

test("the committed index matches a fresh build", () => {
  const run = runIndexScript("--check");
  assert.equal(run.status, 0, run.stderr);
});

test("the check fails on a stale or missing index", () => {
  const dir = mkdtempSync(join(tmpdir(), "ask-index-"));
  try {
    const stale = join(dir, "ask-index.json");
    copyFileSync(INDEX_FILE, stale);
    assert.equal(runIndexScript("--check", `--file=${stale}`).status, 0, "an untouched copy passes");
    writeFileSync(stale, readFileSync(stale, "utf8").replace("sea glass", "sea grass"));
    const run = runIndexScript("--check", `--file=${stale}`);
    assert.equal(run.status, 1);
    assert.match(run.stderr, /stale/);
    assert.equal(runIndexScript("--check", `--file=${join(dir, "missing.json")}`).status, 1);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("the index covers the site and the Gazette with short passages", () => {
  const kinds = new Set(index.passages.map((p) => p.kind));
  for (const k of ["bio", "now", "note", "stack", "work", "game", "project", "article", "line"]) assert.ok(kinds.has(k as never), k);
  for (const p of index.passages) {
    assert.ok(p.text.split(/\s+/).length <= MAX_PASSAGE_WORDS, `${p.id} is over ${MAX_PASSAGE_WORDS} words`);
    assert.deepEqual(p.tokens, tokenize(`${p.title} ${p.text}`), p.id);
    assert.ok(p.tokens.every((t) => /^[a-z0-9]+$/.test(t)), p.id);
    assert.ok(p.href.startsWith("/"), p.id);
  }
  const href = (id: string) => index.passages.find((p) => p.id === id)?.href;
  assert.equal(href("project-shore"), "/shore");
  assert.equal(href("article-why-the-sky-is-blue"), "/articles/why-the-sky-is-blue");
  assert.equal(href("note-backfills-are-a-feature"), "/notes");
  assert.equal(href("stack-streaming"), "/work");
  assert.equal(href("work"), "/work");
  assert.equal(href("game-celeste"), "/play");
  assert.equal(href("bio-1"), "/");
  assert.equal(href("now-playing"), "/");
});

test("'what is shore' ranks /shore first", () => {
  assert.equal(search(index, "what is shore")[0].passage.href, "/shore");
  const reply = answer(index, "what is shore");
  assert.equal(reply.sources[0].href, "/shore");
});

test("'celest' forgives the typo and ranks Celeste first", () => {
  assert.equal(search(index, "celest")[0].passage.title, "Celeste");
  assert.equal(answer(index, "celest").sources[0].title, "Celeste");
});

test("'pizza recipe' is NO MATCH", () => {
  assert.deepEqual(search(index, "pizza recipe"), []);
  const reply = answer(index, "pizza recipe");
  assert.equal(reply.intent, "none");
  assert.equal(reply.lines[0], TEMPLATES.noMatch);
  assert.deepEqual(reply.sources, []);
});

test("short words get no typo tolerance", () => {
  assert.equal(search(index, "tetri")[0].passage.id, "game-tetris-effect", "five letters: one edit away still matches");
  assert.deepEqual(search(index, "sae"), [], "three letters: no fuzzy match for 'sea'");
});

test("intents answer the stock questions", () => {
  assert.equal(answer(index, "who are you").intent, "bio");
  assert.equal(answer(index, "what do you do").intent, "bio");
  assert.equal(answer(index, "what are you playing now").intent, "now");
  const projects = answer(index, "what projects have you built");
  assert.equal(projects.intent, "projects");
  assert.ok(projects.sources.some((s) => s.href === "/shore"));
  const contact = answer(index, "how do I contact you");
  assert.equal(contact.intent, "contact");
  assert.ok(contact.lines.some((l) => l.includes("hello@otohime.dev")));
  // A question with its own subject is a search, not the stock answer.
  assert.equal(answer(index, "what games do you play").intent, "search");
});

test("every reply line is a passage's text or a fixed template", () => {
  const texts = index.passages.map((p) => p.text);
  const queries = [
    "what is shore",
    "celest",
    "pizza recipe",
    "who are you",
    "what do you do",
    "what are you playing",
    "projects",
    "contact",
    "why is the sky blue",
    "leap day",
    "kafka backfills",
    "how does gps know where I am",
    "Outer Wilds",
    "ADÉLA",
    "",
    "!!!",
  ];
  for (const q of queries) {
    const reply = answer(index, q);
    assert.ok(reply.lines.length > 0, q);
    for (const line of reply.lines) {
      assert.ok(TEMPLATE_LINES.has(line) || texts.some((t) => t.includes(line)), `${JSON.stringify(q)} said ${JSON.stringify(line)}`);
    }
    for (const s of reply.sources) assert.ok(index.passages.some((p) => p.href === s.href && p.title === s.title), q);
  }
});

test("the tokenizer folds, lowercases, drops stopwords and stems lightly", () => {
  assert.deepEqual(words("ADÉLA's Café!"), ["adela", "s", "cafe"]);
  assert.deepEqual(tokenize("What are the projects I'm playing?"), ["project", "play"]);
  assert.equal(stem("stories"), "story");
  assert.equal(stem("glass"), "glass");
  assert.equal(stem("status"), "status");
  assert.equal(stem("backfills"), "backfill");
  assert.equal(editDistance("celest", "celeste"), 1);
  assert.equal(editDistance("shore", "sohre"), 1, "a swap is one edit");
  assert.ok(editDistance("pizza", "piece") > 1);
});
