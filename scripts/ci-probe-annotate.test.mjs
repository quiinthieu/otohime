import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { assertEvidence, GATES } from "./ci-probe-verification.mjs";

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

test("CI probe annotation retains walk and nested TAP counts after truncating a long assertion", () => {
  const result = fixture({ output: `not ok - ${"x".repeat(100_000)}\nwalk: 64 ok, 1 failed\n# tests 65\n# pass 64\n# fail 1\n` });
  assert.equal(result.status, 7, result.stderr);
  const command = result.stdout.split("\n").find((line) => line.startsWith("::error "));
  assert.match(command, /truncated/);
  assert.match(command, /walk: 64 ok, 1 failed%0A# tests 65%0A# pass 64%0A# fail 1/);
  assert.match(result.report, /walk: 64 ok, 1 failed\n# tests 65\n# pass 64\n# fail 1/);
});

test("all five task gates reject silent exit-zero output (vacuity negative control)", () => {
  for (const gate of GATES) assert.throws(() => assertEvidence(gate.id, ""), undefined, gate.id);
});

// Synthetic receipts test the validator only. The CLI runs the real commands and
// never substitutes these fixtures for unit, static, closure or browser execution.
function passingTap(required) {
  return required.map((name, i) => `ok ${i + 1} - ${name}\n`).join("") +
    `# tests ${required.length}\n# pass ${required.length}\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n`;
}

test("task TAP receipts require named assertions and passing counts, rejecting renamed or skipped controls", () => {
  for (const id of ["contracts", "unit"]) {
    const gate = GATES.find((gate) => gate.id === id);
    const output = passingTap(gate.required);
    assert.equal(assertEvidence(id, output).tests, gate.required.length);
    assert.throws(() => assertEvidence(id, output.replace(gate.required[0], "renamed control")), /required passing test absent/);
    assert.throws(() => assertEvidence(id, output.replace(gate.required[0], gate.required[0] + " # SKIP")), /required passing test absent/);
    assert.throws(() => assertEvidence(id, output.replace("# fail 0", "# fail 1")), /TAP fail/);
  }
});

test("footer receipts require real assertion totals, the 403 exit and the browser negative control", () => {
  const gate = GATES.find((gate) => gate.id === "footer");
  const output = passingTap(gate.required) + "# walk: 65 ok, 0 failed\n# probe: 170 ok, 0 failed\n" +
    "# ok - local 390x844 reduced-motion 403 exit: repeated full-load /admin/roles -> /projects -> full-load /admin/roles -> /dashboard preserves access denial\n" +
    "# ok - negative control: verifyCanonicalLinks rejects a corrupted canonical footer href\n" +
    "# ok - errors: zero console errors or page errors across all contexts\n";
  assert.equal(assertEvidence("footer", output).tests, 1);
  assert.throws(() => assertEvidence("footer", output.replace("170 ok", "0 ok")), /at least 170 assertions/);
  assert.throws(() => assertEvidence("footer", output.replace("# ok - negative control:", "# not ok - negative control:")), /browser assertion absent/);
});

test("static receipts require both tool invocations and generated routes; closure requires real named controls", () => {
  const output = "> eslint\n> next typegen && tsc --noEmit\nTypes generated successfully\n";
  assert.deepEqual(assertEvidence("static", output).tools, ["eslint", "next typegen", "tsc --noEmit"]);
  assert.throws(() => assertEvidence("static", output.replace("> eslint", "")), /static tool did not execute/);
  const closure = { schema: "otohime.gate-closure.v1", runner: "real", certified: true, local_controls: "pass",
    preflight: { ok: true }, fingerprint: { ok: true }, failures: [],
    commands: ["preflight", "e2e-runner", "end", "urashima"].map((id) => ({ id, executed: true, exit_code: 0, ok: true, ...(id === "preflight" ? {} : { required: [{ name: id, status: "pass" }] }) })),
  };
  assert.equal(assertEvidence("closure", JSON.stringify(closure)).required.length, 3);
  assert.throws(() => assertEvidence("closure", JSON.stringify({ ...closure, runner: "fake" })));
  closure.commands[1].required[0].status = "missing";
  assert.throws(() => assertEvidence("closure", JSON.stringify(closure)));
});
