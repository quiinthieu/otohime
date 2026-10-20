import assert from "node:assert/strict";
import { test } from "node:test";
import { tape, TAPE_LETTERS } from "./tape.ts";

test("an empty tape", () => {
  assert.deepEqual(tape("", ""), { plain: "", code: "", cut: 0 });
});

test("letters go in groups of five on both lines", () => {
  assert.deepEqual(tape("HELLOWORLD", "MFNCZBBFZM"), { plain: "HELLO WORLD", code: "MFNCZ BBFZM", cut: 0 });
  assert.deepEqual(tape("ABCDEFG", "HIJKLMN"), { plain: "ABCDE FG", code: "HIJKL MN", cut: 0 });
  assert.deepEqual(tape("ABCDE", "FGHIJ"), { plain: "ABCDE", code: "FGHIJ", cut: 0 });
});

test("spaces, punctuation and case are dropped from the tape", () => {
  assert.deepEqual(tape("Hello, world!", "MFNCZ, BBFZM!"), { plain: "HELLO WORLD", code: "MFNCZ BBFZM", cut: 0 });
});

test("only the last 60 letters stay, and cut counts the rest", () => {
  assert.equal(TAPE_LETTERS, 60);
  const sixty = "ABCDEFGHIJ".repeat(6);
  assert.equal(tape(sixty, sixty).cut, 0);
  assert.equal(tape(sixty, sixty).plain.replace(/ /g, "").length, 60);
  const t = tape(sixty + "XYZ", sixty + "XYZ");
  assert.equal(t.cut, 3);
  assert.equal(t.plain.replace(/ /g, ""), (sixty + "XYZ").slice(3));
  assert.equal(t.plain, t.code);
});

test("groups keep their place as letters fall off the left", () => {
  const letters = "ABCDEFGHIJ".repeat(7); // 70
  const t = tape(letters.slice(0, 63), letters.slice(0, 63));
  // letters 3..62: a short first group (DE), then whole groups, then the last three
  assert.ok(t.plain.startsWith("DE FGHIJ ABCDE"), t.plain);
  assert.ok(t.plain.endsWith(" ABC"), t.plain);
  const u = tape(letters.slice(0, 65), letters.slice(0, 65));
  assert.equal(u.cut, 5);
  assert.ok(u.plain.startsWith("FGHIJ ABCDE"), u.plain);
});
