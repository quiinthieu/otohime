import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import Anthropic from "@anthropic-ai/sdk";
import { answer, editDistance, MAX_PASSAGE_WORDS, search, stem, TEMPLATES, tokenize, words, type AskIndex } from "./ask.ts";
import { handleGet, handlePost, llmEnabled, OFFLINE, type AskDeps, type AskEnv } from "./ask-llm.ts";

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

test("the check shows the index covers Work, Projects and Notes", () => {
  const run = runIndexScript("--check");
  assert.equal(run.status, 0, run.stderr);
  for (const [name, href] of [["Work", "/work"], ["Projects", "/projects"], ["Notes", "/notes"]]) {
    assert.match(run.stdout, new RegExp(`${name} ${href} \\([1-9]\\d* passages\\)`), name);
  }
});

test("the check fails when a required source is missing from the index", () => {
  const dir = mkdtempSync(join(tmpdir(), "ask-index-"));
  try {
    for (const [name, drop] of [
      ["Notes", (p: { href: string }) => p.href === "/notes"],
      ["Work", (p: { href: string }) => p.href === "/work"],
      ["Projects", (p: { kind: string }) => p.kind === "project"],
    ] as const) {
      const file = join(dir, `${name}.json`);
      const thin: AskIndex = { ...index, passages: index.passages.filter((p) => !drop(p as never)) };
      writeFileSync(file, JSON.stringify(thin));
      const run = runIndexScript("--check", `--file=${file}`);
      assert.equal(run.status, 1, name);
      assert.match(run.stderr, new RegExp(`does not cover ${name}`), name);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
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
  assert.equal(answer(index, "kafka work").intent, "search");
});

test("canned answers cover Work and Notes, each citing its page", () => {
  const work = ["what is your work", "what do you work on", "what stack do you use", "what tools do you use", "tell me about your data engineering work"];
  for (const q of work) {
    const reply = answer(index, q);
    assert.equal(reply.intent, "work", q);
    assert.equal(reply.lines[0], TEMPLATES.work, q);
    assert.deepEqual(reply.sources, [{ title: "Work", href: "/work" }], q);
  }
  const workReply = answer(index, "what is your work");
  const workTexts = index.passages.filter((p) => p.kind === "work" || p.kind === "stack").map((p) => p.text);
  assert.deepEqual(workReply.lines.slice(1), workTexts);
  assert.ok(workReply.lines.some((l) => l.includes("Kafka")), "the stack is in the answer");

  for (const q of ["what do you write about", "show me your notes", "what have you written", "latest notes"]) {
    const reply = answer(index, q);
    assert.equal(reply.intent, "notes", q);
    assert.equal(reply.lines[0], TEMPLATES.notes, q);
    assert.deepEqual(reply.sources, [{ title: "Notes", href: "/notes" }], q);
  }
  const notesTexts = index.passages.filter((p) => p.kind === "note").map((p) => p.text);
  assert.deepEqual(answer(index, "notes").lines.slice(1), notesTexts);
});

test("every stock answer cites the page its lines came from", () => {
  const stock: [string, string][] = [
    ["who are you", "bio"],
    ["what are you playing now", "now"],
    ["what projects have you built", "projects"],
    ["how do I contact you", "contact"],
    ["what is your work", "work"],
    ["show me your notes", "notes"],
  ];
  for (const [q, intent] of stock) {
    const reply = answer(index, q);
    assert.equal(reply.intent, intent, q);
    assert.ok(reply.sources.length > 0, `${q} cites a page`);
    const pages = new Set(index.passages.filter((p) => reply.lines.slice(1).includes(p.text)).map((p) => p.href));
    for (const s of reply.sources) assert.ok(pages.has(s.href), `${q} cites ${s.href}, a page its lines came from`);
  }
});

// The model tier, faked. With no key the route is off and the console answers offline; with a key, a failed
// call still prints the canned answer, under (OFFLINE).
type Message = Awaited<ReturnType<AskDeps["complete"]>>;
const ORIGIN = "https://otohime.dev";
const KEYED: AskEnv = { ASK_LLM: "1", ANTHROPIC_API_KEY: "sk-test-not-a-key", BETTER_AUTH_URL: ORIGIN, BETTER_AUTH_SECRET: "s" };
function counter() {
  const counts = new Map<string, number>();
  return { hit: async (b: string) => (counts.set(b, (counts.get(b) ?? 0) + 1), counts.get(b)!) };
}
const askPost = (question: string) =>
  new Request(`${ORIGIN}/api/ask`, { method: "POST", headers: { origin: ORIGIN, "content-type": "application/json" }, body: JSON.stringify({ question }) });

test("with no API key the model tier is off and the canned answer is the answer", async () => {
  let calls = 0;
  const complete = async (): Promise<Message> => {
    calls++;
    throw new Error("never called");
  };
  for (const env of [{ ...KEYED, ANTHROPIC_API_KEY: undefined }, { ...KEYED, ANTHROPIC_API_KEY: "" }, { ...KEYED, ASK_LLM: undefined }]) {
    assert.equal(llmEnabled(env), false);
    assert.equal(handleGet({ env }).status, 404);
    assert.equal((await handlePost(askPost("what is your work"), { env, index, store: counter(), complete })).status, 404);
  }
  assert.equal(calls, 0);
  const reply = answer(index, "what is your work");
  assert.equal(reply.lines[0], TEMPLATES.work);
  assert.deepEqual(reply.sources, [{ title: "Work", href: "/work" }]);
});

test("a failed or refused model call falls back to the canned answer, marked (OFFLINE)", async () => {
  const failures: (() => Promise<Message>)[] = [
    async () => Promise.reject(new Anthropic.APIConnectionError({ message: "down" })),
    async () => Promise.reject(new Anthropic.AuthenticationError(401, undefined, "bad key", new Headers())),
    async () => ({ stop_reason: "refusal", content: [] }) as unknown as Message,
    async () => ({ stop_reason: "end_turn", content: [{ type: "text", text: "not json", citations: null }] }) as unknown as Message,
  ];
  const original = console.error;
  console.error = () => {};
  try {
    for (const [i, complete] of failures.entries()) {
      for (const q of ["what is your work", "show me your notes"]) {
        const res = await handlePost(askPost(q), { env: KEYED, index, store: counter(), complete });
        assert.equal(res.status, 200, `${i} ${q}`);
        const body = await res.json();
        const canned = answer(index, q);
        assert.equal(body.mode, "offline", `${i} ${q}`);
        assert.deepEqual(body.lines, [OFFLINE, ...canned.lines], `${i} ${q}`);
        assert.deepEqual(body.sources, canned.sources, `${i} ${q}`);
        assert.ok(body.sources.length > 0, `${i} ${q} cites its page`);
      }
    }
  } finally {
    console.error = original;
  }
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
    "what is your work",
    "what stack do you use",
    "show me your notes",
    "what have you written",
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
    // A source is a passage's page under the passage's title, or a stock answer's named page.
    for (const s of reply.sources) {
      assert.ok(index.passages.some((p) => p.href === s.href && (p.title === s.title || reply.intent === "notes")), q);
    }
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
