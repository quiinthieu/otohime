// npm test passing says something about the palace only if it runs the palace's tests. This reads package.json's
// test and test:e2e globs and checks every Ryugu-jo test file is picked up by one of them, so a test file that falls
// outside the globs (and would silently never run) fails here. The palace's test files are found on disk, so a new
// one is guarded without editing this file.
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join, matchesGlob, resolve } from "node:path";
import { test } from "node:test";

const ROOT = resolve(import.meta.dirname, "../../..");
const { scripts } = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as { scripts: Record<string, string> };
const globs = (script: string) => [...scripts[script].matchAll(/'([^']+\.test\.ts)'/g)].map((m) => m[1]);
const UNIT = globs("test");
const E2E = globs("test:e2e");
const runs = (patterns: string[], file: string) => patterns.some((p) => matchesGlob(file, p));

const PALACE_TESTS = readdirSync(join(ROOT, "app/(ryugu)/_lib"))
  .filter((f) => f.endsWith(".test.ts"))
  .map((f) => `app/(ryugu)/_lib/${f}`);

test("the palace's unit tests are all found, and npm test runs every one of them", () => {
  for (const f of ["ambience", "isolation", "scene", "school", "tamatebako", "wiring"]) assert.ok(PALACE_TESTS.includes(`app/(ryugu)/_lib/${f}.test.ts`), f);
  for (const file of PALACE_TESTS) assert.ok(runs(UNIT, file), `npm test never runs ${file}`);
});

test("npm test runs the entry points' tests, and npm run test:e2e walks the palace in a browser", () => {
  for (const file of ["lib/urashima.test.ts", "lib/motion.test.ts"]) assert.ok(runs(UNIT, file), file);
  assert.ok(runs(E2E, "e2e/ryugu.test.ts"), "test:e2e never runs e2e/ryugu.test.ts");
});

test("negative control: the matcher is not always true, so the checks above can fail", () => {
  assert.equal(runs(UNIT, "app/(ryugu)/_components/sea.test.ts"), false);
  assert.equal(runs(UNIT, "e2e/ryugu.test.ts"), false);
  assert.equal(runs(E2E, "app/(ryugu)/_lib/scene.test.ts"), false);
  assert.equal(runs(["app/(shore)/_lib/*.test.ts"], "app/(ryugu)/_lib/scene.test.ts"), false);
});
