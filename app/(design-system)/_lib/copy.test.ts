// The page's words, checked: short and written to a general reader's level
// (Flesch-Kincaid grade 8 or under, short sentences, measured with fkGrade,
// not trusted), plain text, no jargon the page promises to avoid, every number
// one of the engine's, and sources https on the allowlist.
import assert from "node:assert/strict";
import { test } from "node:test";
import { PARTS, PATTERNS, POTS } from "./board.ts";
import { allowedSource, body, captions, colophon, deck, PART_TITLES, parts, sources, title } from "./copy.ts";
import { fkGrade, longestSentence, meanSentence, sentences } from "./readability.ts";
import { CREAMS, INK_COUNT, PAPER_COUNT, SIBLINGS } from "./siblings.ts";
import { textWords } from "./words.ts";

const text = body().join(" ");
const words = textWords(text);
const grade = fkGrade(text);
const prose = [title, deck, ...body(), ...Object.values(captions)];

// The only numbers the page may say: the engine's.
const ENGINE = new Set([1, 0, POTS.length, PARTS.length, PATTERNS.length, SIBLINGS.length, PAPER_COUNT, INK_COUNT, CREAMS]);
const digits = (s: string) => [...s.matchAll(/\d+/g)].map((m) => Number(m[0]));

test(`the body: ${words} words at grade ${grade.toFixed(1)}, mean sentence ${meanSentence(text).toFixed(1)}, longest ${longestSentence(text)}`, () => {
  assert.ok(words >= 180 && words <= 350, `${words} words`);
  assert.ok(grade <= 8, `grade ${grade}`);
  assert.ok(meanSentence(text) <= 20, `mean sentence ${meanSentence(text)}`);
  assert.ok(longestSentence(text) <= 35, `longest sentence ${longestSentence(text)}`);
});

test("a short title and a one-sentence deck", () => {
  assert.equal(title, "Design system");
  assert.ok(textWords(title) <= 4, title);
  assert.equal(deck, "A box of decisions made once, drawn so you can turn the knobs.");
  assert.ok(textWords(deck) <= 30, deck);
  assert.equal(sentences(deck).length, 1, deck);
});

test("four parts, each with words, under the plan's headings", () => {
  assert.deepEqual(PART_TITLES, { what: "What it is", turn: "Turn a knob", where: "Where you meet it", trap: "Watch out for" });
  for (const key of Object.keys(PART_TITLES) as (keyof typeof PART_TITLES)[]) assert.ok(parts[key].length > 0, `${key} has words`);
});

test("four captions, one per figure, the Right here one word for word", () => {
  assert.deepEqual(Object.keys(captions), ["box", "board", "follow", "here"]);
  for (const c of Object.values(captions)) assert.ok(textWords(c) > 0 && fkGrade(c) <= 8, `${c} (grade ${fkGrade(c).toFixed(1)})`);
  assert.equal(
    captions.here,
    "Otohime has no design system, on purpose: every project is its own object. A system is the tool for when pages must feel like one thing.",
  );
  assert.equal(captions.box, "8 pots, 9 parts, 3 patterns and a rulebook. Change a pot and all below it follows.");
});

test("plain text: no markup and no links in the prose", () => {
  for (const s of prose) {
    assert.doesNotMatch(s, /[<>]|http/, s);
    assert.equal(s.trim(), s);
  }
});

test("every number in the prose is one of the engine's", () => {
  const said = prose.flatMap(digits);
  assert.ok(said.includes(PARTS.length) && said.includes(POTS.length), "the words quote the counts");
  for (const n of said) assert.ok(ENGINE.has(n), `${n} is not one of the engine's numbers (${[...ENGINE].sort((a, b) => a - b).join(", ")})`);
});

test('the words say part, pot and face, never "component", "token" or "typography"', () => {
  for (const s of prose) assert.doesNotMatch(s, /\b(?:components?|tokens?|typography)\b/i, s);
  assert.match(text, /\bpots?\b/);
  assert.match(text, /\bparts?\b/);
  assert.match(text, /\bface\b/);
});

test(`${sources.length} sources, every one https on the allowlist`, () => {
  assert.ok(sources.length >= 3, `${sources.length} sources`);
  assert.equal(new Set(sources.map((s) => s.url)).size, sources.length);
  for (const s of sources) {
    assert.equal(new URL(s.url).protocol, "https:", s.url);
    assert.ok(allowedSource(s.url), s.url);
    assert.ok(s.label.length > 0);
  }
});

test("the colophon links next door to Structures and to the Gazette", () => {
  assert.deepEqual(colophon, [
    { label: "Next door: Structures", href: "/structures" },
    { label: "The Gazette", href: "/articles" },
  ]);
});

test("the readability caps are measured with fkGrade, not trusted", () => {
  const hard =
    "A comprehensive design system standardizes typography, component architecture and accessibility guidelines, consequently guaranteeing consistency across heterogeneous product experiences.";
  assert.ok(fkGrade(hard) > 8, String(fkGrade(hard)));
});

test("digits finds every run of digits", () => {
  assert.deepEqual(digits("It has 11 sheets, 8 creams and 0.5 of a pot."), [11, 8, 0, 5]);
});

test("the allowlist refuses look-alikes and plain http", () => {
  for (const ok of [
    "https://en.wikipedia.org/wiki/Design_system",
    "https://design-system.service.gov.uk/",
    "https://m3.material.io/",
    "https://developer.apple.com/design/human-interface-guidelines/",
    "https://developer.mozilla.org/en-US/docs/Web/CSS/Using_CSS_custom_properties",
    "https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html",
  ]) {
    assert.ok(allowedSource(ok), ok);
  }
  for (const bad of [
    "http://en.wikipedia.org/wiki/Design_system",
    "https://fr.wikipedia.org/wiki/Design_system",
    "https://m3.material.io.evil.example/",
    "https://w3.org/",
    "https://material.io/",
    "not a url",
  ]) {
    assert.ok(!allowedSource(bad), bad);
  }
});
