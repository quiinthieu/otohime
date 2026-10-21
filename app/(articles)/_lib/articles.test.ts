// The edition's brief, checked: six pieces in the plan's order, each short and
// written to a general reader's level (Flesch-Kincaid grade 8 or under, short
// sentences), plain text only, and every number in the words one of the
// article's facts, each naming an https source on the allowlist.
import assert from "node:assert/strict";
import { test } from "node:test";
import { allowedSource, ARTICLES, bySlug, neighbours } from "./articles.ts";
import { parseDate } from "./edition.ts";
import { fkGrade, longestSentence, meanSentence, sentences } from "./readability.ts";
import { textWords } from "./words.ts";

const ORDER = [
  "why-the-sky-is-blue",
  "why-we-need-a-leap-day",
  "how-your-phone-knows-where-it-is",
  "what-a-gigabyte-holds",
  "why-ice-floats",
  "how-tides-work",
];

// Every number written with digits, as a value: "20,200" is 20200, "0.917" is
// 0.917 and "29th" is 29.
const numbers = (text: string) => (text.match(/\d+(?:,\d{3})*(?:\.\d+)?/g) ?? []).map((n) => Number(n.replace(/,/g, "")));

test("six articles in the plan's order, the sky the lead", () => {
  assert.deepEqual(
    ARTICLES.map((a) => a.slug),
    ORDER,
  );
  assert.equal(ARTICLES[0].slug, "why-the-sky-is-blue");
});

test("slugs are unique and lower-case words joined by hyphens", () => {
  assert.equal(new Set(ARTICLES.map((a) => a.slug)).size, ARTICLES.length);
  for (const a of ARTICLES) assert.match(a.slug, /^[a-z-]+$/);
});

for (const a of ARTICLES) {
  const text = a.body.join(" ");
  const words = textWords(text);
  const grade = fkGrade(text);

  test(`${a.slug}: ${words} words at grade ${grade.toFixed(1)}, mean sentence ${meanSentence(text).toFixed(1)}, longest ${longestSentence(text)}`, () => {
    assert.ok(words >= 180 && words <= 350, `${words} words`);
    for (const [i, p] of a.body.entries()) assert.ok(textWords(p) <= 90, `paragraph ${i + 1} has ${textWords(p)} words`);
    assert.ok(grade <= 8, `grade ${grade}`);
    assert.ok(meanSentence(text) <= 20, `mean sentence ${meanSentence(text)}`);
    assert.ok(longestSentence(text) <= 35, `longest sentence ${longestSentence(text)}`);
  });

  test(`${a.slug}: a short headline and a one-sentence deck`, () => {
    assert.ok(textWords(a.headline) <= 8, a.headline);
    assert.ok(textWords(a.deck) <= 30, a.deck);
    assert.equal(sentences(a.deck).length, 1, a.deck);
    assert.ok(a.figure.caption.length > 0 && a.figure.alt.length > 0);
  });

  test(`${a.slug}: plain text only`, () => {
    for (const s of [a.headline, a.deck, ...a.body, a.figure.caption, a.figure.alt]) {
      assert.doesNotMatch(s, /[<>]|http/, s);
    }
  });

  test(`${a.slug}: every fact is sourced, at least two sources, all https on the allowlist`, () => {
    const keys = Object.keys(a.sources);
    assert.ok(keys.length >= 2, `${keys.length} sources`);
    assert.ok(a.facts.length > 0);
    assert.equal(new Set(a.facts.map((f) => f.id)).size, a.facts.length, "fact ids are unique");
    for (const f of a.facts) {
      assert.ok(keys.includes(f.source), `${f.id} names ${f.source}`);
      assert.ok(f.label.length > 0 && f.value.length > 0, f.id);
    }
    for (const [key, s] of Object.entries(a.sources)) {
      assert.equal(new URL(s.url).protocol, "https:", key);
      assert.ok(allowedSource(s.url), `${key}: ${s.url}`);
      assert.ok(s.title.length > 0, key);
    }
  });

  test(`${a.slug}: every number in the words is one of its facts`, () => {
    const known = new Set(a.facts.flatMap((f) => numbers(f.value)));
    for (const s of [a.headline, a.deck, ...a.body]) {
      for (const n of numbers(s)) assert.ok(known.has(n), `${n} in "${s.slice(0, 60)}…" is not a fact`);
    }
  });

  test(`${a.slug}: published on a real day`, () => {
    assert.notEqual(parseDate(a.published), null, a.published);
    assert.equal(a.published, "2026-10-21");
  });
}

test("the readability caps are measured with fkGrade, not trusted", () => {
  const hard =
    "Electromagnetic radiation interacting with atmospheric molecules considerably smaller than its wavelength undergoes predominantly elastic scattering, characteristically proportional to the inverse fourth power of the wavelength.";
  assert.ok(fkGrade(hard) > 8);
});

test("the allowlist refuses look-alikes and plain http", () => {
  for (const ok of [
    "https://en.wikipedia.org/wiki/Tide",
    "https://spaceplace.nasa.gov/blue-sky/en/",
    "https://oceanservice.noaa.gov/education/tutorial_tides/",
    "https://www.gps.gov/systems/gps/space/",
    "https://www.usgs.gov/special-topics/water-science-school/science/water-density",
    "https://physics.nist.gov/cuu/Units/binary.html",
  ]) {
    assert.ok(allowedSource(ok), ok);
  }
  for (const bad of [
    "http://en.wikipedia.org/wiki/Tide",
    "https://fr.wikipedia.org/wiki/Mar%C3%A9e",
    "https://notnasa.gov/",
    "https://nasa.gov.evil.example/",
    "https://gps.gov/",
    "https://fakenoaa.gov/",
    "not a url",
  ]) {
    assert.ok(!allowedSource(bad), bad);
  }
});

test("numbers reads digits as values", () => {
  assert.deepEqual(numbers("about 20,200 km, 0.917 g/cm³ and February 29th, 1/λ⁴"), [20200, 0.917, 29, 1]);
  assert.deepEqual(numbers("no digits here"), []);
});

test("bySlug and neighbours walk the edition's order", () => {
  assert.equal(bySlug("why-ice-floats")?.headline, "Why ice floats");
  assert.equal(bySlug("nope"), undefined);
  const first = neighbours(ORDER[0]);
  assert.equal(first.prev, undefined);
  assert.equal(first.next?.slug, ORDER[1]);
  const last = neighbours(ORDER[5]);
  assert.equal(last.prev?.slug, ORDER[4]);
  assert.equal(last.next, undefined);
  assert.deepEqual(neighbours("nope"), {});
});
