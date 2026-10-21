import assert from "node:assert/strict";
import { test } from "node:test";
import { fkGrade, longestSentence, meanSentence, readingMinutes, sentences, syllables } from "./readability.ts";

test("syllables: vowel groups less a silent e, at least 1", () => {
  const vectors: [string, number][] = [
    ["cat", 1],
    ["water", 2],
    ["table", 2],
    ["the", 1],
    ["sky", 1],
    ["satellite", 3],
    ["365.2422", 1],
    ["Molecule,", 3],
    ["ice", 1],
    ["bubble", 2],
  ];
  for (const [word, n] of vectors) assert.equal(syllables(word), n, word);
});

test("sentences split on . ! ? but not inside a number", () => {
  assert.equal(sentences("Ice is 0.917 g/cm³. It floats!").length, 2);
  assert.deepEqual(sentences("One. Two? Three!"), ["One.", "Two?", "Three!"]);
  assert.deepEqual(sentences("A year is 365.2422 days."), ["A year is 365.2422 days."]);
  assert.equal(sentences("No full stop at the end").length, 1);
  assert.equal(sentences("").length, 0);
});

test("fkGrade is pinned to a vector you can work by hand", () => {
  // 6 words, 1 sentence, 6 syllables: 0.39 × 6 + 11.8 × 1 − 15.59 = −1.45
  assert.ok(Math.abs(fkGrade("The cat sat on the mat.") - -1.45) <= 0.01, String(fkGrade("The cat sat on the mat.")));
  // two of those: the same words per sentence and syllables per word
  assert.ok(Math.abs(fkGrade("The cat sat on the mat. The cat sat on the mat.") - -1.45) <= 0.01);
});

test("a long, many-syllable definition scores past grade 12", () => {
  const definition =
    "Rayleigh scattering is the predominantly elastic scattering of electromagnetic radiation by particles considerably smaller than the wavelength of the radiation, whose intensity varies inversely with the fourth power of the wavelength, consequently explaining the characteristic coloration of the daytime atmosphere and, correspondingly, the reddish appearance of sunsets everywhere.";
  assert.equal(sentences(definition).length, 1);
  assert.ok(definition.split(/\s+/).length >= 45, "45 words or more");
  assert.ok(fkGrade(definition) > 12, String(fkGrade(definition)));
});

test("longest and mean sentence count words", () => {
  const text = "One two three. One two three four five. Six.";
  assert.equal(longestSentence(text), 5);
  assert.equal(meanSentence(text), 3);
  assert.equal(longestSentence(""), 0);
  assert.equal(meanSentence(""), 0);
});

test("readingMinutes: 200 words a minute, at least 1", () => {
  assert.equal(readingMinutes(0), 1);
  assert.equal(readingMinutes(200), 1);
  assert.equal(readingMinutes(201), 2);
  assert.equal(readingMinutes(350), 2);
});
