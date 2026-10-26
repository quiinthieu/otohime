import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { buildSha, healthBody } from "./build-info.ts";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("buildSha returns the build commit as given", () => {
  assert.equal(buildSha("7041ef4f60cff8e35d0696ab8db4f5bf41ac5ed7"), "7041ef4f60cff8e35d0696ab8db4f5bf41ac5ed7");
  assert.equal(buildSha(" c38f72a\n"), "c38f72a");
});

test("buildSha falls back to dev when BUILD_SHA is unset or blank", () => {
  assert.equal(buildSha(undefined), "dev");
  assert.equal(buildSha(""), "dev");
  assert.equal(buildSha("   "), "dev");
});

test("healthBody is exactly {ok:true, sha}", () => {
  assert.deepEqual(healthBody("abc123"), { ok: true, sha: "abc123" });
  assert.deepEqual(healthBody(undefined), { ok: true, sha: "dev" });
  assert.deepEqual(Object.keys(healthBody("abc123")), ["ok", "sha"]);
});

test("/api/health answers healthBody(process.env.BUILD_SHA), the literal next.config.ts inlines", () => {
  const route = read("app/api/health/route.ts");
  assert.match(route, /from\s+"@\/lib\/build-info"/);
  assert.match(route, /Response\.json\(\s*healthBody\(\s*process\.env\.BUILD_SHA\s*\)\s*\)/);
  assert.doesNotMatch(route, /Response\.json\(\s*\{\s*ok:\s*true\s*\}\s*\)/);
  // The database check stays ahead of the answer.
  assert.ok(route.indexOf("select 1") < route.indexOf("healthBody(process.env.BUILD_SHA)"));
});

test("next.config.ts still defines BUILD_SHA for the health route to read", () => {
  assert.match(read("next.config.ts"), /BUILD_SHA:\s*process\.env\.GITHUB_SHA/);
});

test("README notes the sha field of /api/health beside the build-sha meta line", () => {
  const readme = read("README.md");
  const meta = readme.indexOf('`<meta name="build-sha">`');
  const health = readme.indexOf("`/api/health` answers `{ok: true, sha}`");
  assert.ok(meta >= 0 && health >= 0, "README lacks the build-sha or health line");
  assert.ok(Math.abs(health - meta) < 400, "the health note should sit next to the build-sha line");
});
