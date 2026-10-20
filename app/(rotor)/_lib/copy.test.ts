import assert from "node:assert/strict";
import { test } from "node:test";
import { EXPLAINER, EXPLAINER_TITLE, TAGLINE } from "./copy.ts";
import { textWords, WORD_CAP } from "./words.ts";

test("the explainer, title included, is at most 120 words", () => {
  assert.ok(textWords([EXPLAINER_TITLE, ...EXPLAINER].join(" ")) <= WORD_CAP);
});

test("one line says why the same settings decode", () => {
  assert.equal(EXPLAINER.filter((p) => /same settings decode/.test(p)).length, 1);
});

test("the tagline is the project list's note", () => {
  assert.equal(TAGLINE, "An Enigma, drawn by hand. Type and watch the lamps.");
});

test("the words are about the mechanism, with no war imagery", () => {
  const all = [TAGLINE, EXPLAINER_TITLE, ...EXPLAINER].join(" ");
  assert.doesNotMatch(all, /\b(war|wartime|nazi|reich|wehrmacht|military|army|navy|u-boat|bletchley|enemy|codebreak\w*|spy|secret)\b/i);
});
