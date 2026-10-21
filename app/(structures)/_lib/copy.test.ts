// The pages' words, checked: eight in the series' order, each short and
// written to a general reader's level (Flesch-Kincaid grade 8 or under, short
// sentences, measured with fkGrade, not trusted), plain text with no Big-O,
// sources https on the allowlist, and every "N steps" a step count the
// machine really takes.
import assert from "node:assert/strict";
import { test } from "node:test";
import { allowedSource, body, neighbours, pageFor, PAGES, PART_TITLES } from "./copy.ts";
import type { Action, Structure } from "./machine.ts";
import { fkGrade, longestSentence, meanSentence, sentences } from "./readability.ts";
import { STRUCTURES } from "./structures/index.ts";
import { textWords } from "./words.ts";

// Moves a page talks about beyond its worked example and its costs.
const DEMOS: Record<string, Action[][]> = {
  array: [[{ move: "set", value: 4, to: "0" }, { move: "read", value: 0 }]],
  "binary-search-tree": [[{ move: "line" }, { move: "find", value: 5 }]],
};

// Every step count the machine takes in its example, its costs and its demos.
function measured(s: Structure<unknown>): Set<number> {
  const out = new Set<number>();
  for (const actions of [s.example, ...(DEMOS[s.slug] ?? [])]) {
    let state = s.empty();
    for (const a of actions) {
      const m = s.reduce(state, a);
      out.add(m.steps);
      state = m.state;
    }
  }
  const c = s.costs();
  for (const cost of [c.find, c.add, c.remove]) out.add(cost.steps);
  return out;
}

const quoted = (text: string) => [...text.matchAll(/(\d+) steps?\b/g)].map((m) => Number(m[1]));

test("eight pages in the order of STRUCTURES", () => {
  assert.deepEqual(
    PAGES.map((p) => p.slug),
    STRUCTURES.map((s) => s.slug),
  );
  assert.equal(new Set(PAGES.map((p) => p.slug)).size, 8);
});

for (const [i, p] of PAGES.entries()) {
  const text = body(p).join(" ");
  const words = textWords(text);
  const grade = fkGrade(text);
  const structure = STRUCTURES[i];

  test(`${p.slug}: ${words} words at grade ${grade.toFixed(1)}, mean sentence ${meanSentence(text).toFixed(1)}, longest ${longestSentence(text)}`, () => {
    assert.ok(words >= 180 && words <= 350, `${words} words`);
    assert.ok(grade <= 8, `grade ${grade}`);
    assert.ok(meanSentence(text) <= 20, `mean sentence ${meanSentence(text)}`);
    assert.ok(longestSentence(text) <= 35, `longest sentence ${longestSentence(text)}`);
  });

  test(`${p.slug}: a short title, a one-sentence deck and a one-sentence caption`, () => {
    assert.ok(textWords(p.title) <= 4, p.title);
    assert.ok(textWords(p.deck) <= 30, p.deck);
    assert.equal(sentences(p.deck).length, 1, p.deck);
    assert.equal(sentences(p.caption).length, 1, p.caption);
    for (const key of Object.keys(PART_TITLES) as (keyof typeof PART_TITLES)[]) {
      assert.ok(p.parts[key].length > 0, `${key} has words`);
    }
  });

  test(`${p.slug}: plain text, no Big-O, no markup, no links in the prose`, () => {
    for (const s of [p.title, p.deck, p.caption, ...body(p)]) {
      assert.doesNotMatch(s, /O\(|[<>]|http/, s);
      assert.equal(s.trim(), s);
    }
  });

  test(`${p.slug}: every step count in the words is one the machine takes`, () => {
    const real = measured(structure);
    const claims = body(p).flatMap(quoted);
    assert.ok(quoted(p.parts.how.join(" ")).length > 0, "How a move works quotes a step count");
    for (const n of claims) assert.ok(real.has(n), `${n} steps is not a count the ${p.slug} takes (${[...real].sort((a, b) => a - b).join(", ")})`);
  });

  test(`${p.slug}: at least two sources, every one https on the allowlist`, () => {
    assert.ok(p.sources.length >= 2, `${p.sources.length} sources`);
    assert.equal(new Set(p.sources.map((s) => s.url)).size, p.sources.length);
    for (const s of p.sources) {
      assert.equal(new URL(s.url).protocol, "https:", s.url);
      assert.ok(allowedSource(s.url), s.url);
      assert.ok(s.label.length > 0);
    }
  });
}

test("the readability caps are measured with fkGrade, not trusted", () => {
  const hard =
    "A self-balancing binary search tree guarantees logarithmic worst-case complexity for insertion, deletion and retrieval operations, consequently outperforming unbalanced alternatives considerably.";
  assert.ok(fkGrade(hard) > 8, String(fkGrade(hard)));
});

test("quoted finds every step count written with digits", () => {
  assert.deepEqual(quoted("It takes 1 step. That is 5 steps, not 12 stepsons, and 3 hops."), [1, 5]);
});

test("the allowlist refuses look-alikes and plain http", () => {
  for (const ok of [
    "https://en.wikipedia.org/wiki/Hash_table",
    "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map",
    "https://docs.python.org/3/library/heapq.html",
    "https://en.cppreference.com/w/cpp/container/vector",
  ]) {
    assert.ok(allowedSource(ok), ok);
  }
  for (const bad of [
    "http://en.wikipedia.org/wiki/Hash_table",
    "https://fr.wikipedia.org/wiki/Table_de_hachage",
    "https://developer.mozilla.org.evil.example/",
    "https://evil-docs.python.org/",
    "https://www.geeksforgeeks.org/",
    "not a url",
  ]) {
    assert.ok(!allowedSource(bad), bad);
  }
});

test("pageFor and neighbours walk the series' order", () => {
  assert.equal(pageFor("stack")?.title, "The stack");
  assert.equal(pageFor("nope"), undefined);
  const first = neighbours(PAGES[0].slug);
  assert.equal(first.prev, undefined);
  assert.equal(first.next?.slug, "linked-list");
  const last = neighbours(PAGES[7].slug);
  assert.equal(last.prev?.slug, "heap");
  assert.equal(last.next, undefined);
  assert.deepEqual(neighbours("nope"), {});
});
