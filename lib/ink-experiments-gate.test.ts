import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { checkInkTests, checkInkWiring, REQUIRED_INK_TESTS } from "../scripts/ink-experiments-gate.mjs";
test("ink experiment privacy interaction fallback and share gates are named and wired", () => {
  checkInkWiring();
  const source = readFileSync("e2e/ink-experiments.test.ts", "utf8");
  for (const name of REQUIRED_INK_TESTS) assert.throws(() => checkInkTests(source.replace(`test("${name}"`, `test("renamed required test"`)), /Missing required/);
});
