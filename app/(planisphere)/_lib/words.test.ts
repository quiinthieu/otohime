import assert from "node:assert/strict";
import { test } from "node:test";
import { textWords, visibleWords, WORD_CAP } from "./words.ts";

const PAGE = `<!DOCTYPE html><html lang="en"><head>
<title>Planisphere is a lovely machine page title</title>
<style>.a { color: red } body { margin: 0 }</style>
<script>self.__next_f.push([1, "lots of hidden words here"])</script>
</head><body class="x">
<!-- a comment with words -->
<h1>The Sun</h1>
<p aria-label="not counted at all">A star, cut open.</p>
<p>Ink &amp; paper</p>
<p>left a·b · right — end</p>
<template><p>hidden template words</p></template>
<script type="application/json">{"also":"hidden words"}</script>
</body></html>`;

test("the cap is 120", () => {
  assert.equal(WORD_CAP, 120);
});

test("textWords counts tokens with a letter or digit", () => {
  assert.equal(textWords(""), 0);
  assert.equal(textWords("  "), 0);
  assert.equal(textWords("·"), 0);
  assert.equal(textWords("a · b — c"), 3);
  assert.equal(textWords("a·b"), 1);
  assert.equal(textWords("8 min 19 s"), 4);
  assert.equal(textWords("15.7 million K"), 3);
  assert.equal(textWords("Étoile, naïve"), 2);
});

test("visibleWords counts only the visible body text", () => {
  // The Sun (2) + A star, cut open. (4) + Ink & paper (2) + left a·b right end (4)
  assert.equal(visibleWords(PAGE), 12);
});

test("visibleWords ignores scripts, styles, templates, comments and tags", () => {
  assert.equal(visibleWords("<body><script>one two</script><style>three</style></body>"), 0);
  assert.equal(visibleWords("<body><template>four</template><!-- five six --></body>"), 0);
  assert.equal(visibleWords('<body><span class="seven eight">nine</span></body>'), 1);
});

test("separators are free and a·b is one token", () => {
  assert.equal(visibleWords("<body><p>a · b</p></body>"), 2);
  assert.equal(visibleWords("<body><p>·</p></body>"), 0);
  assert.equal(visibleWords("<body><p>a·b</p></body>"), 1);
});

test("entities are decoded, so &amp; alone is not a word", () => {
  assert.equal(visibleWords("<body>Ink &amp; paper</body>"), 2);
  assert.equal(visibleWords("<body>a&nbsp;b</body>"), 2);
  assert.equal(visibleWords("<body>&lt;&gt; &quot;&#39;&#x27;</body>"), 0);
});

test("text before <body is free", () => {
  assert.equal(visibleWords("<html><head><title>Many words in a title</title></head><body>one</body></html>"), 1);
  assert.equal(visibleWords("<BODY>one two</BODY>"), 2);
  assert.equal(visibleWords("no body tag here"), 4);
});
