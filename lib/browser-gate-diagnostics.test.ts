import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "node:test";

const helper = resolve(import.meta.dirname, "../scripts/browser-gate-diagnostics.mjs");

function fixture({ status = 37, stdout = "before reporter\n", stderr = "Error: pre-test crash\n", log = "present", server = "server failed to bind\n", summary = "present", chrome = true } = {}) {
  const work = mkdtempSync(join(tmpdir(), "browser-diagnostic-"));
  try {
    mkdirSync(join(work, ".next"));
    mkdirSync(join(work, "bin"));
    writeFileSync(join(work, ".next/BUILD_ID"), "fixture-build\n");
    // Only Chrome's version response is fake. Shell, child streams, tee and helper run for real.
    writeFileSync(join(work, "bin/google-chrome"), `#!/bin/sh\n${chrome ? "echo 'Google Chrome fixture 123'" : "exit 9"}\n`);
    chmodSync(join(work, "bin/google-chrome"), 0o755);
    writeFileSync(join(work, "fixture.mjs"), `
      process.stdout.write(${JSON.stringify(stdout)}, () => {
        process.stderr.write(${JSON.stringify(stderr)}, () => { process.exitCode = ${status}; });
      });
    `);
    if (server !== "missing") writeFileSync(join(work, "next-start.log"), server);
    const summaryPath = join(work, "summary.md");
    writeFileSync(summaryPath, "");
    const env = { ...process.env, PATH: `${join(work, "bin")}:${process.env.PATH}`, HELPER: helper,
      LABEL: "E2E: 50%,\r\nforged", GITHUB_SHA: "fixture-commit", RUNNER_TEMP: work,
      GITHUB_STEP_SUMMARY: summary === "unwritable" ? work : summaryPath,
      DIAGNOSTICS_SECRET_CONTROL: "must-not-print-environment-control",
    };
    if (summary === "absent") delete (env as NodeJS.ProcessEnv).GITHUB_STEP_SUMMARY;
    const result = spawnSync("bash", ["-eo", "pipefail", "-c", `
      trap 'status=$?; trap - EXIT; node "$HELPER" "$LABEL" "$status" command.log || true; exit "$status"' EXIT
      node fixture.mjs 2>&1 | tee command.log
    `], { cwd: work, env, encoding: "utf8", maxBuffer: 4 * 1024 * 1024, timeout: 10000 });
    // Re-run the CLI directly against intentionally absent/empty logs, preserving the child's actual status.
    if (log !== "present") {
      if (log === "missing") rmSync(join(work, "command.log"));
      else writeFileSync(join(work, "command.log"), "");
      writeFileSync(summaryPath, "");
      const direct = spawnSync(process.execPath, [helper, env.LABEL, String(result.status), "command.log"], { cwd: work, env, encoding: "utf8", timeout: 10000 });
      return { ...direct, report: readFileSync(summaryPath, "utf8"), captured: "" };
    }
    return { ...result, report: readFileSync(summaryPath, "utf8"), captured: readFileSync(join(work, "command.log"), "utf8") };
  } finally { rmSync(work, { recursive: true, force: true }); }
}

const annotations = (s: string) => s.split("\n").filter((line) => line.startsWith("::error "));

test("pre-test crash exposes real combined stdout/stderr, identity and server tail while preserving exit 37", () => {
  const result = fixture();
  assert.equal(result.status, 37, result.stderr);
  assert.equal(result.captured, "before reporter\nError: pre-test crash\n");
  const commands = annotations(result.stdout);
  assert.equal(commands.length, 1);
  for (const text of [commands[0], result.report]) {
    assert.match(text, /fixture-commit/);
    assert.match(text, /fixture-build/);
    assert.ok(text.includes(process.version));
    assert.match(text, /Google Chrome fixture 123/);
    assert.match(text, /before reporter/);
    assert.match(text, /Error: pre-test crash/);
    assert.match(text, /server failed to bind/);
    assert.doesNotMatch(text, /must-not-print-environment-control/);
  }
  assert.match(commands[0], /^::error title=E2E%3A 50%25%2C%0D%0Aforged::/);
  assert.match(commands[0], /exit 37%0ACommit:/);
});

test("successful real command creates no failure annotation or summary, even with error-looking output", () => {
  const result = fixture({ status: 0, stderr: "Error: harmless fixture text\n" });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(annotations(result.stdout).length, 0);
  assert.equal(result.report, "");
  assert.match(result.captured, /Error: harmless fixture text/);
});

test("missing and empty logs have explicit actionable placeholders and keep the original red status", () => {
  for (const log of ["missing", "empty"]) {
    const result = fixture({ log, server: "missing", chrome: false });
    assert.equal(result.status, 37, result.stderr);
    for (const text of [result.stdout, result.report]) {
      assert.ok(text.includes(`command log ${log === "missing" ? "unavailable" : "empty"} (no output captured)`));
      assert.match(text, /next-start.log unavailable/);
      assert.match(text, /Chrome: unavailable/);
    }
  }
});

test("bounded tails retain the end of large fully flushed child streams, removing ANSI and escaping percent/CR/LF/Markdown", () => {
  const output = Array.from({ length: 100 }, (_, i) => `command ${i}\n`).join("");
  const server = Array.from({ length: 100 }, (_, i) => `server ${i}\n`).join("");
  const result = fixture({ stdout: output, stderr: `${"x".repeat(100000)}\n\x1b[31m50%\r\n\x1b[0m\x1b]8;;https://fixture.invalid\x07linked\x1b]8;;\x07 \`\`\` <script>& **markdown**\nLAST-CHILD-LINE\n`, server });
  assert.equal(result.status, 37, result.stderr);
  assert.match(result.captured, /LAST-CHILD-LINE\n$/); // no process.exit truncation masquerading as a bound
  const command = annotations(result.stdout)[0];
  assert.ok(command.length < 25000, String(command.length));
  assert.ok(result.report.length < 50000, String(result.report.length));
  for (const text of [command, result.report]) {
    assert.doesNotMatch(text, /command 0\b|server 19\b|\x1b/);
    assert.match(text, /server 20/);
    assert.match(text, /server 99/);
    assert.match(text, /LAST-CHILD-LINE/);
  }
  assert.match(command, /50%25%0D%0Alinked/);
  assert.match(result.report, /ˋˋˋ &lt;script&gt;&amp; \*\*markdown\*\*/);
  assert.doesNotMatch(result.report, /<script>|https:\/\/fixture.invalid/);
  assert.equal(result.report.split("\n").filter((line) => line === "```text").length, 3);
});

test("missing or unwritable step summary cannot mask the original status or suppress annotation", () => {
  for (const summary of ["absent", "unwritable"]) {
    const result = fixture({ status: 23, summary });
    assert.equal(result.status, 23, result.stderr);
    assert.equal(annotations(result.stdout).length, 1);
    assert.match(result.stdout, /Error: pre-test crash/);
    if (summary === "unwritable") assert.match(result.stderr, /summary unavailable; annotation retained/);
  }
});
