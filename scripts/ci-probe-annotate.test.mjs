import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { test } from "node:test";

const helper = resolve(import.meta.dirname, "ci-probe-annotate.mjs");
function fixture({ status = 7, output = "not ok - assertion: 50%, failed\r\nprobe: 0 ok, 1 failed\n", server = "server diagnostic\n", summary = true } = {}) {
  const work = mkdtempSync(join(tmpdir(), "ci-probe-"));
  try {
    writeFileSync(join(work, "fixture.mjs"), `process.stdout.write(${JSON.stringify(output)}, () => process.exit(${status}));`);
    if (server !== null) writeFileSync(join(work, "next-start.log"), server);
    const env = { ...process.env, HELPER: helper, LABEL: "Footer: 50%,\r\nforged", GITHUB_SHA: "fixture-sha", RUNNER_TEMP: work };
    delete env.GITHUB_STEP_SUMMARY;
    if (summary) {
      env.GITHUB_STEP_SUMMARY = join(work, "summary.md");
      writeFileSync(env.GITHUB_STEP_SUMMARY, "");
    }
    // A real failing child through tee under GitHub's bash -eo pipefail, not a simulated exit status.
    const result = spawnSync("bash", ["-eo", "pipefail", "-c", 'status=0\nnode fixture.mjs 2>&1 | tee probe.log || status=$?\nnode "$HELPER" "$LABEL" "$status" probe.log'], { cwd: work, env, encoding: "utf8" });
    return { ...result, report: summary ? readFileSync(join(work, "summary.md"), "utf8") : "" };
  } finally { rmSync(work, { recursive: true, force: true }); }
}

test("CI probe annotator preserves a real exit 7 through pipefail, escaping annotation properties and data", () => {
  const result = fixture();
  assert.equal(result.status, 7, result.stderr);
  const commands = result.stdout.split("\n").filter((line) => line.startsWith("::error "));
  assert.equal(commands.length, 1);
  assert.match(commands[0], /^::error title=Footer%3A 50%25%2C%0D%0Aforged::/);
  assert.match(commands[0], /not ok - assertion: 50%25, failed%0D%0Aprobe: 0 ok, 1 failed/);
  assert.match(commands[0], /server diagnostic/);
  assert.match(result.report, /fixture-sha; probe exit 7/);
  assert.match(result.report, /not ok - assertion/);
});

test("CI probe annotator leaves a real successful child green and emits no failure diagnostics", () => {
  const result = fixture({ status: 0, output: "ok - fixture\nprobe: 1 ok, 0 failed\n" });
  assert.equal(result.status, 0, result.stderr);
  assert.doesNotMatch(result.stdout, /::error/);
  assert.equal(result.report, "");
});

test("CI probe annotator surfaces a crash tail and a missing next-start.log without masking exit 7", () => {
  const result = fixture({ output: "Error: browser crashed\n    at launch (fixture:7)\n", server: null });
  assert.equal(result.status, 7, result.stderr);
  assert.match(result.stdout, /::error .*Error: browser crashed%0A.*at launch/);
  assert.match(result.stdout, /next-start.log unavailable/);
  assert.match(result.report, /Error: browser crashed/);
  assert.match(result.report, /next-start.log unavailable/);
});

test("CI probe annotator bounds both diagnostic channels and escapes summary HTML and code fences", () => {
  const server = Array.from({ length: 100 }, (_, i) => `server ${i} \`\`\` <script>&`).join("\n") + "\n";
  const result = fixture({ server, output: `not ok - <script>& \`\`\` ${"x".repeat(100_000)}\nprobe: 0 ok, 1 failed\n` });
  assert.equal(result.status, 7, result.stderr);
  const command = result.stdout.split("\n").find((line) => line.startsWith("::error "));
  assert.ok(command.length < 40_000, command.length);
  assert.ok(result.report.length < 20_000, result.report.length);
  assert.doesNotMatch(result.report, /server 19 /);
  assert.match(result.report, /server 20 ˋˋˋ &lt;script&gt;&amp;/);
  assert.match(result.report, /server 99 ˋˋˋ &lt;script&gt;&amp;/);
  assert.doesNotMatch(result.report, /<script>/);
  assert.match(command, /server 99/);
});

test("CI probe annotator emits annotations without GITHUB_STEP_SUMMARY", () => {
  const result = fixture({ summary: false });
  assert.equal(result.status, 7, result.stderr);
  assert.match(result.stdout, /::error .*not ok - assertion/);
});

test("CI camera's nested TAP failure survives later successful output beyond the crash-tail bound", () => {
  const output = "  not ok 1 - CPU camera detects a face\n" + Array.from({ length: 100 }, (_, i) => `ok ${i + 2} - later check\n`).join("");
  const result = fixture({ output });
  assert.equal(result.status, 7, result.stderr);
  const command = result.stdout.split("\n").find((line) => line.startsWith("::error "));
  assert.match(command, /not ok 1 - CPU camera detects a face/);
  assert.match(result.report, /not ok 1 - CPU camera detects a face/);
});
