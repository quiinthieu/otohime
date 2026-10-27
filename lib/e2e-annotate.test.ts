import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "node:test";
import { annotation, summary } from "../scripts/e2e-annotate.mjs";

const reporter = resolve(import.meta.dirname, "../scripts/e2e-annotate.mjs");
function run(fails: boolean, fallback = false) {
  const work = mkdtempSync(join(tmpdir(), "e2e-reporter-"));
  try {
    const file = join(work, "assertion.test.mjs");
    writeFileSync(file, `import { test } from 'node:test';
      import assert from 'node:assert/strict';
      test('parent', async t => {
        await t.test('browser assertion: 50%, test', () => {
          console.log('real assertion stdout');
          console.error('real assertion stderr');
          assert.equal(${fails ? "1" : "2"}, 2, 'fixture assertion message');
        });
      });`);
    const summaryPath = join(work, "summary.md");
    writeFileSync(summaryPath, "");
    const env = { ...process.env, GITHUB_STEP_SUMMARY: summaryPath, RUNNER_TEMP: work, REPORTER: reporter,
      DIAGNOSTICS: resolve(import.meta.dirname, "../scripts/browser-gate-diagnostics.mjs"), FIXTURE_FILE: file };
    // A nested node:test process must not inherit the outer runner's IPC context.
    delete (env as NodeJS.ProcessEnv).NODE_TEST_CONTEXT;
    const args = ["--test", "--test-reporter=tap", "--test-reporter-destination=stdout", `--test-reporter=${reporter}`, "--test-reporter-destination=stdout", file];
    const result = fallback
      ? spawnSync("bash", ["-eo", "pipefail", "-c", `
          trap 'status=$?; trap - EXIT; node "$DIAGNOSTICS" E2E "$status" combined.log || true; exit "$status"' EXIT
          node --test --test-reporter=tap --test-reporter-destination=stdout "--test-reporter=$REPORTER" --test-reporter-destination=stdout "$FIXTURE_FILE" 2>&1 | tee combined.log
        `], { cwd: work, env, encoding: "utf8", timeout: 10000 })
      : spawnSync(process.execPath, args, { env, encoding: "utf8", timeout: 10000 });
    return { ...result, report: readFileSync(summaryPath, "utf8") };
  } finally { rmSync(work, { recursive: true, force: true }); }
}

test("real node:test assertion retains TAP, public assertion annotation and summary, without duplicating the failed parent", () => {
  const result = run(true);
  assert.equal(result.status, 1, result.stderr);
  assert.match(result.stdout, /not ok 1 - browser assertion/);
  assert.match(result.stdout, /real assertion stdout/);
  assert.match(result.stdout, /real assertion stderr/);
  const commands = result.stdout.split("\n").filter((line) => line.startsWith("::error "));
  assert.equal(commands.length, 1);
  assert.match(commands[0], /file=[^,]*assertion.test.mjs,line=4,title=E2E failed%3A browser assertion%3A 50%25%2C test::/);
  assert.match(commands[0], /fixture assertion message/);
  assert.match(result.report, /## E2E failures/);
  assert.match(result.report, /fixture assertion message/);
});

test("fallback preserves real per-assertion reporter diagnostics beside the combined tail and original failure", () => {
  const result = run(true, true);
  assert.equal(result.status, 1, result.stderr);
  assert.equal(result.stdout.split("\n").filter((line) => line.startsWith("::error ")).length, 2);
  assert.match(result.stdout, /title=E2E failed%3A browser assertion/);
  assert.match(result.stdout, /title=E2E::.*Command, last 80 lines/);
  assert.match(result.report, /## E2E failures/);
  assert.match(result.report, /## Browser gate failure/);
  assert.match(result.report, /fixture assertion message/);
  assert.match(result.report, /BUILD_ID unavailable/);
});

test("real successful node:test assertion has TAP evidence and no failure annotation or summary", () => {
  const result = run(false);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /ok 1 - browser assertion/);
  assert.doesNotMatch(result.stdout, /::error /);
  assert.equal(result.report, "");
});

test("assertion annotations escape command properties and percent/CR/LF while bounding errors and summary fences", () => {
  const data = { name: "case: 50%,\r\nforged", file: resolve("e2e/a:b,c.test.ts"), line: 7 };
  const error = new Error(`50%\r\n\`\`\`\n${"x".repeat(20000)}`);
  const command = annotation(data, error);
  assert.match(command, /^::error file=e2e\/a%3Ab%2Cc.test.ts,line=7,title=E2E failed%3A case%3A 50%25%2C%0D%0Aforged::/);
  assert.match(command, /50%25%0D%0A/);
  assert.equal(command.split("\n").length, 2);
  assert.ok(command.length < 4000);
  const report = summary({ ...data, name: "bounded assertion" }, error);
  assert.match(report, /ˋˋˋ/);
  assert.match(report, /more characters/);
  assert.ok(report.length < 9000);
});
