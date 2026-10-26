// scripts/tap-annotate.mjs reads the TAP that CI's npm test step keeps and makes each failed unit test a public
// annotation and step summary section. The TAP here comes from a real node:test run of a throwaway file, so the
// parser sees exactly what the runner writes. Negative controls: a parent failing only through its subtest, and a
// passing test, add no annotation; a red run without `not ok` still names its last lines.
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { failures, report } from "../scripts/tap-annotate.mjs";

const ROOT = join(import.meta.dirname, "..");
const SCRIPT = join(ROOT, "scripts/tap-annotate.mjs");

test("real node:test TAP: each failed test is one annotation with file, line and assertion; parents and passes add none", () => {
  const dir = mkdtempSync(join(tmpdir(), "tap-annotate-"));
  try {
    const file = join(dir, "a.test.mjs");
    writeFileSync(
      file,
      `import assert from "node:assert/strict";
import { test } from "node:test";
test("passes", () => {});
test("outer, with a comma", async (t) => {
  await t.test("inner: git fixture", () => {
    throw new Error("Command failed: git commit\\nerror: bad tree object HEAD");
  });
});
test("top level 100%", () => {
  assert.equal(130, 1, "probe-end.sh BASE_URL (unset TMPDIR) should stop at stubbed npm");
});
`,
    );
    const env: NodeJS.ProcessEnv = { ...process.env };
    delete env.GITHUB_ACTIONS;
    delete env.NODE_TEST_CONTEXT; // otherwise the child reports to this runner instead of writing TAP
    const run = spawnSync(process.execPath, ["--test", "--test-reporter=tap", file], { cwd: dir, env, encoding: "utf8" });
    assert.equal(run.status, 1, run.stdout);
    const tap = run.stdout;

    const found = failures(tap);
    assert.deepEqual(found.map((f) => [f.name, f.line]), [["inner: git fixture", 5], ["top level 100%", 9]]);

    const summaryFile = join(dir, "summary.md");
    const out = report(tap, summaryFile);
    const annotations = out.split("\n").filter((l) => l.startsWith("::error "));
    assert.equal(annotations.length, 2, out);
    const [props, message] = annotations[0].slice("::error ".length).split("::");
    assert.match(props, /^file=[^,]*a\.test\.mjs,line=5,title=npm test failed%3A inner%3A git fixture$/);
    assert.match(message, /bad tree object HEAD/);
    assert.doesNotMatch(message, /\n/, "the message keeps its lines escaped");
    assert.match(annotations[1], /title=npm test failed%3A top level 100%25::/);
    assert.match(annotations[1], /should stop at stubbed npm/);
    assert.doesNotMatch(out, /outer, with a comma|passes/, "a parent failing only through its subtest, and a pass, add nothing");

    const summary = readFileSync(summaryFile, "utf8");
    assert.match(summary, /^## npm test failures\n\n### ✗ inner: git fixture\n/);
    assert.match(summary, /a\.test\.mjs:9`/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a red run with no failed test, or no TAP file at all, still yields one annotation and exits 0", () => {
  const dir = mkdtempSync(join(tmpdir(), "tap-annotate-"));
  try {
    const tapFile = join(dir, "npm-test.tap");
    writeFileSync(tapFile, `TAP version 13\n${Array.from({ length: 60 }, (_, i) => `# line ${i}`).join("\n")}\nKilled\n`);
    const env = { ...process.env, GITHUB_STEP_SUMMARY: join(dir, "summary.md") };
    const crashed = execFileSync(process.execPath, [SCRIPT, tapFile], { env, encoding: "utf8" });
    assert.match(crashed, /^::error title=npm test failed with no failed test in its output::# line 21%0A.*%0AKilled$/m);
    assert.doesNotMatch(crashed, /# line 19%0A/, "only the last lines are kept");
    assert.match(readFileSync(join(dir, "summary.md"), "utf8"), /### ✗ no failed test; last lines\n[\s\S]*Killed/);

    const missing = spawnSync(process.execPath, [SCRIPT, join(dir, "absent.tap")], { env, encoding: "utf8" });
    assert.equal(missing.status, 0);
    assert.match(missing.stdout, /^::error title=npm test output unavailable::.*ENOENT/m);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("CI's npm test step keeps its own status in TAP and annotates only after it fails", () => {
  const ci = readFileSync(join(ROOT, ".github/workflows/ci.yml"), "utf8");
  const step = ci.slice(ci.indexOf("- name: npm test"), ci.indexOf("- run: bash scripts/vercel-deploy.test.sh"));
  assert.match(step, /id: unit\n\s+run: \|\n\s+set -o pipefail\n\s+npm test 2>&1 \| tee "\$RUNNER_TEMP\/npm-test\.tap"\n/);
  assert.match(step, /- name: Annotate failed unit tests\n\s+if: failure\(\) && steps\.unit\.outcome == 'failure'\n\s+run: node scripts\/tap-annotate\.mjs "\$RUNNER_TEMP\/npm-test\.tap"\n/);
  assert.equal(ci.match(/npm test 2>&1/g)?.length, 1, "npm test runs once");
});
