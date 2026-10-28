// Guards the main lane in .github/workflows/ci.yml: project deliveries enter the queue,
// pull requests keep running on every change, and the jobs that ship run on a pinned runner.
// Dependency-free (no npm ci needed): reads the YAML by indentation, which is all this file uses.
import assert from "node:assert/strict";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { test } from "node:test";

// Keep identity regressions in the existing CI suite without editing its shared package command.
import "./check-deploy-author.test.mjs";
import "./setup-owner-git.test.mjs";

const workflow = readFileSync(new URL("../.github/workflows/ci.yml", import.meta.url), "utf8");
const lines = workflow.split("\n");
const indent = (line) => line.length - line.trimStart().length;
const significant = (line) => line.trim() !== "" && !line.trim().startsWith("#");

// Lines of the mapping under `path` (e.g. ["on", "push"]), or null when the key is absent.
// Only direct children of the enclosing key are matched, so a nested key of the same name is not.
function block(path, from = 0, to = lines.length) {
  const [key, ...rest] = path;
  const first = lines.slice(from, to).find(significant);
  if (first === undefined) return null;
  const own = indent(first);
  for (let i = from; i < to; i++) {
    const line = lines[i];
    if (!significant(line) || indent(line) !== own) continue;
    if (line.trim().split(":")[0].replace(/["']/g, "") !== key) continue;
    let end = i + 1;
    while (end < to && (!significant(lines[end]) || indent(lines[end]) > own)) end++;
    return rest.length ? block(rest, i + 1, end) : { start: i, end, value: line.slice(line.indexOf(":") + 1).trim() };
  }
  return null;
}

// Scalar list under a key, block (`- "x"`) or flow (`[x, y]`) style.
function list(path) {
  const found = block(path);
  if (!found) return null;
  const unquote = (s) => s.trim().replace(/\s+#.*$/, "").replace(/^["']|["']$/g, "");
  if (found.value.startsWith("[")) return found.value.slice(1, found.value.lastIndexOf("]")).split(",").map(unquote).filter(Boolean);
  return lines.slice(found.start + 1, found.end).filter(significant).map((l) => unquote(l.trim().replace(/^-\s*/, "")));
}

const scalar = (path) => block(path)?.value.replace(/\s+#.*$/, "").replace(/^["']|["']$/g, "");

// GitHub's filter glob: `**` crosses directories, `*` does not.
const globRe = (glob) =>
  new RegExp(`^${glob.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*\*\/?|\*/g, (m) => (m === "*" ? "[^/]*" : ".*"))}$`);
// GitHub's ordered inclusion patterns: a later positive match re-includes a path.
const pushRuns = (paths, files) => files.some((f) => paths.reduce((included, pattern) => {
  const negative = pattern.startsWith("!");
  return globRe(negative ? pattern.slice(1) : pattern).test(f) ? !negative : included;
}, false));

test("push to main includes project deliveries while filtering unrelated Markdown", () => {
  assert.deepEqual(list(["on", "push", "branches"]), ["main"]);
  assert.deepEqual(list(["on", "push", "paths"]), ["**", "!**.md", "projects/**"]);
  assert.equal(block(["on", "push", "paths-ignore"]), null, "GitHub rejects paths with paths-ignore");
});

test("project-only deliveries trigger full CI and historical report filters fail the same fixture", () => {
  const paths = list(["on", "push", "paths"]);
  const deliveries = [
    ["projects/otohime-dev-three-paper-and-ink-toys-that-lean-into-the-uras/run-9320-summary.md"],
    ["projects/fix-x/architecture.md", "projects/fix-x/qa_run-1.md"],
    ["projects/fix-x/artifacts/run.log"],
    ["README.md", "projects/fix-x/run-1-summary.md"],
  ];
  const assertDeliveries = (matches) => {
    for (const files of deliveries) assert.equal(files.some(matches), true, files.join(", "));
  };
  assertDeliveries((f) => pushRuns(paths, [f]));
  // Both the old paths-ignore and an incorrectly ordered exception suppress reports.
  assert.throws(() => assertDeliveries((f) => !["projects/**", "**.md"].some((g) => globRe(g).test(f))));
  assert.throws(() => assertDeliveries((f) => pushRuns(["**", "projects/**", "!**.md"], [f])));
  assert.throws(() => assertDeliveries((f) => pushRuns(paths.filter((p) => p !== "projects/**"), [f])));
  assert.equal(pushRuns(paths, ["README.md", "docs/development.md"]), false);
  for (const file of ["app/page.tsx", "lib/motion.ts", "content/history.json", ".github/workflows/ci.yml", "app/(site)/(app)/projects/page.tsx"]) {
    assert.equal(pushRuns(paths, [file]), true, file);
    assert.equal(pushRuns(paths, ["README.md", file]), true, file);
  }
});

test("pull_request has no path filter", () => {
  const pr = block(["on", "pull_request"]);
  assert.ok(pr, "on.pull_request is missing");
  assert.equal(block(["on", "pull_request", "paths-ignore"]), null);
  assert.equal(block(["on", "pull_request", "paths"]), null);
});

test("manual recovery runs the same checks and production gates as a main push", () => {
  assert.ok(block(["on", "workflow_dispatch"]), "queue replacement recovery needs workflow_dispatch");
  assert.equal(block(["jobs", "checks", "if"]).value, "github.event.action != 'closed'");
  assert.equal(scalar(["jobs", "production", "needs"]), "checks");
  assert.equal(scalar(["jobs", "production", "if"]), "github.event_name == 'push' || (github.event_name == 'workflow_dispatch' && github.ref == 'refs/heads/main')");
});

test("checks and production run on ubuntu-24.04", () => {
  for (const job of ["checks", "production"]) {
    assert.equal(scalar(["jobs", job, "runs-on"]), "ubuntu-24.04", `jobs.${job}.runs-on`);
  }
});

test("each main push and manual recovery keeps its checks outside a shared workflow queue", () => {
  // Negative control: cancel-in-progress:false still replaces a pending workflow.
  // A shared workflow group must fail this guard even when running jobs are protected.
  assert.equal(block(["concurrency"]), null, "workflow concurrency can cancel main before checks start");
  assert.equal(scalar(["jobs", "checks", "concurrency", "group"]), "ci-checks-${{ github.event.pull_request.number || github.run_id }}");
  assert.equal(scalar(["jobs", "checks", "concurrency", "cancel-in-progress"]), "${{ github.event_name == 'pull_request' }}");
});

test("PR checks and previews cancel stale jobs in separate PR-specific groups", () => {
  assert.equal(scalar(["jobs", "preview", "concurrency", "group"]), "ci-preview-${{ github.event.pull_request.number }}");
  assert.equal(scalar(["jobs", "preview", "concurrency", "cancel-in-progress"]), "true");
  assert.notEqual(scalar(["jobs", "checks", "concurrency", "group"]), scalar(["jobs", "preview", "concurrency", "group"]));
});

test("only production deploys serialize after successful checks, without cancelling the running deploy", () => {
  assert.equal(scalar(["jobs", "production", "needs"]), "checks");
  assert.equal(scalar(["jobs", "production", "concurrency", "group"]), "otohime-production-main");
  assert.equal(scalar(["jobs", "production", "concurrency", "cancel-in-progress"]), "false");
  assert.equal(block(["jobs", "production", "concurrency", "queue"]), null);
});

// Lines of a job's `steps:` list, joined, comments dropped.
const steps = (job) => {
  const found = block(["jobs", job, "steps"]);
  assert.ok(found, `jobs.${job}.steps is missing`);
  return lines.slice(found.start + 1, found.end).filter(significant).join("\n");
};

test("production proves the deployed sha, terminal and press after the deploy", () => {
  const prod = steps("production");
  const verify = prod.indexOf('EXPECT_SHA="$GITHUB_SHA" bash scripts/verify-deploy.sh https://otohime.dev');
  assert.notEqual(verify, -1, "production must run scripts/verify-deploy.sh with EXPECT_SHA=$GITHUB_SHA against otohime.dev");
  const deploy = prod.indexOf("bash scripts/vercel-deploy.sh");
  assert.ok(deploy !== -1 && deploy < verify, "verify-deploy must run after the deploy step");
  // Negative control: a bare 200-only health curl is not proof of the served commit.
  assert.doesNotMatch(prod, /curl\b[^\n]*otohime\.dev\/api\/health/, "production must not smoke-test with a bare health curl");
  assert.match(steps("checks"), /bash scripts\/verify-deploy\.sh --self-test/, "checks must run the verify-deploy self-test");
});

test("verify-deploy only exempts filtered Markdown and requires project delivery ancestry", () => {
  const script = readFileSync(new URL("./verify-deploy.sh", import.meta.url), "utf8");
  assert.deepEqual(list(["on", "push", "paths"]), ["**", "!**.md", "projects/**"]);
  assert.match(script, /^\s*projects\/\*\) return 1 ;;\n\s*"" \| \*\.md\) ;;$/m,
    "project paths must require deployment before the generic Markdown exemption");
});

test("checks uses measured 30m job, 17m E2E step and 900s E2E command budgets", () => {
  assert.equal(scalar(["jobs", "checks", "timeout-minutes"]), "30");
  assert.match(workflow, /40420670837: 1039s total \(E2E 501s, camera 79s,\n\s*# signed-in motion 171s, footer probe 71s\)/);
  assert.match(workflow, /122630267659 then used\n\s*# 22m26s with E2E 701s/);
  const checks = steps("checks");
  assert.match(checks, /- name: E2E against next start\n\s*timeout-minutes: 17\n/);
  const e2e = gateBody("E2E against next start");
  assert.match(e2e, /^set -o pipefail$/m);
  assert.match(e2e, /^trap .*browser-gate-diagnostics\.mjs "E2E against next start".* EXIT$/m);
  assert.match(e2e, /^command -v timeout >\/dev\/null 2>&1 \|\| timeout\(\)/m);
  assert.match(e2e, /^timeout --signal=TERM --kill-after=10s 900s npm run test:e2e 2>&1 \| tee -a "\$RUNNER_TEMP\/e2e\.log"$/m);
  assert.equal(e2e.match(/npm run test:e2e/g).length, 1, "the browser suite runs once, only under the inner bound");
});

test("all four non-TAP probe steps annotate the captured pipefail status", () => {
  const checks = steps("checks");
  for (const [step, command] of [
    ["Real CPU camera and privacy verifier", "node scripts/verify-peep-box-camera.mjs"],
    ["Motion probe, signed in", "bash scripts/probe-motion-signed-in.sh"],
    ["Footer walk", 'EXPECT_SHA="$GITHUB_SHA" bash scripts/walk-end.sh'],
    ["Footer Chromium probe", 'EXPECT_SHA="$GITHUB_SHA" bash scripts/probe-end.sh'],
  ]) {
    const start = checks.indexOf(`- name: ${step}\n`);
    assert.ok(start >= 0, step);
    const end = checks.indexOf("      - ", start + 1);
    const body = checks.slice(start, end < 0 ? undefined : end);
    assert.match(body, new RegExp(command.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + " 2>&1 \\| tee (?:-a )?"));
    assert.match(body, /\| tee [^\n]+ \|\| status=\$\?/);
    assert.ok(body.includes(`node scripts/ci-probe-annotate.mjs "${step}" "$status"`), body);
  }
});

test("signed-in motion normalizes unset, empty and long TMPDIR before mktemp", () => {
  const script = readFileSync(new URL("./probe-motion-signed-in.sh", import.meta.url), "utf8");
  const normalization = script.match(/export TMPDIR="\$\{TMPDIR:-\/tmp\}"\nif \[ "\$\{#TMPDIR\}" -gt 48 \]; then\n  export TMPDIR="\/tmp"\nfi/)?.[0];
  assert.ok(normalization, "same normalization as probe-end.sh");
  assert.ok(script.indexOf(normalization) < script.indexOf('WORK="$(mktemp'));
  for (const [value, expected] of [[undefined, "/tmp"], ["", "/tmp"], ["/" + "x".repeat(48), "/tmp"], ["/" + "x".repeat(47), "/" + "x".repeat(47)]]) {
    const env = { ...process.env };
    if (value === undefined) delete env.TMPDIR;
    else env.TMPDIR = value;
    const result = spawnSync("bash", ["-uc", `${normalization}\nprintf '%s' "$TMPDIR"`], { env, encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout, expected);
  }
});

test("Footer CI step preserves probe failure and surfaces assertions with a bounded server tail", () => {
  const start = lines.indexOf("      - name: Footer Chromium probe");
  assert.ok(start >= 0);
  const run = lines.indexOf("        run: |", start);
  const body = [];
  for (const line of lines.slice(run + 1)) {
    if (line.trim() && !line.startsWith("          ")) break;
    body.push(line.slice(10));
  }
  const work = mkdtempSync(join(tmpdir(), "footer-ci-"));
  try {
    mkdirSync(join(work, "scripts"));
    for (const file of ["ci-probe-annotate.mjs", "e2e-annotate.mjs", "browser-gate-diagnostics.mjs"]) {
      copyFileSync(new URL(`./${file}`, import.meta.url), join(work, "scripts", file));
    }
    writeFileSync(join(work, "scripts/probe-end.sh"), 'echo "ok - first"\necho "not ok - fixture assertion" >&2\necho "probe: 1 ok, 1 failed"\nexit "$PROBE_STATUS"\n');
    writeFileSync(join(work, "next-start.log"), Array.from({ length: 100 }, (_, i) => `server ${i} \`\`\``).join("\n") + "\n");
    const summary = join(work, "summary.md");
    for (const [status, serverLog] of [[7, true], [7, false], [0, false]]) {
      if (!serverLog) rmSync(join(work, "next-start.log"), { force: true });
      writeFileSync(summary, "");
      const result = spawnSync("/bin/bash", ["-eo", "pipefail", "-c", `curl() { return 0; }\n${body.join("\n")}`], {
        cwd: work, encoding: "utf8", env: { ...process.env, RUNNER_TEMP: work, GITHUB_STEP_SUMMARY: summary, GITHUB_SHA: "fixture-sha", BASE_URL: "http://fixture.invalid", PROBE_STATUS: String(status) },
      });
      assert.equal(result.status, status, result.stderr);
      assert.match(readFileSync(join(work, "footer-probe.log"), "utf8"), /not ok - fixture assertion\nprobe: 1 ok, 1 failed/);
      const report = readFileSync(summary, "utf8");
      if (status === 0) assert.equal(report, "");
      else {
        assert.match(result.stdout, /::error title=Footer Chromium probe::.*not ok - fixture assertion%0Aprobe: 1 ok, 1 failed/);
        assert.match(report, /fixture-sha/);
        assert.match(report, /not ok - fixture assertion\nprobe: 1 ok, 1 failed/);
        if (serverLog) {
          assert.doesNotMatch(report, /server 19 /);
          assert.match(report, /server 20 ˋˋˋ/);
          assert.match(report, /server 99 ˋˋˋ/);
        } else {
          assert.match(report, /next-start.log unavailable/);
          assert.match(result.stdout, /next-start.log unavailable/);
        }
      }
      if (status === 0) assert.doesNotMatch(result.stdout, /::error/);
    }
  } finally { rmSync(work, { recursive: true, force: true }); }
});

const browserGates = [
  ["E2E against next start", "e2e.log"],
  ["Motion probe, signed in", "motion-probe.log"],
  ["Footer walk", "footer-walk.log"],
  ["Footer Chromium probe", "footer-probe.log"],
];

function gateBody(name) {
  const start = lines.indexOf(`      - name: ${name}`);
  assert.ok(start >= 0, name);
  const run = lines.indexOf("        run: |", start);
  const body = [];
  for (const line of lines.slice(run + 1)) {
    if (line.trim() && !line.startsWith("          ")) break;
    body.push(line.slice(10));
  }
  return body.join("\n");
}

// Execute the actual YAML shell, not a copy of its implementation. Only external
// server/readiness/probe behavior is replaced; Node, streams, tee and reporters are real.
function runGate(name, log, scenario, mutate = (s) => s, { status = 43, serverLog = true } = {}) {
  const work = mkdtempSync(join(tmpdir(), "browser-gate-ci-"));
  try {
    mkdirSync(join(work, "scripts"));
    mkdirSync(join(work, ".next"));
    writeFileSync(join(work, ".next/BUILD_ID"), "workflow-fixture-build\n");
    for (const file of ["browser-gate-diagnostics.mjs", "ci-probe-annotate.mjs", "e2e-annotate.mjs"]) {
      copyFileSync(new URL(`./${file}`, import.meta.url), join(work, "scripts", file));
    }
    writeFileSync(join(work, "fixture.mjs"), `
      import { appendFileSync } from 'node:fs';
      appendFileSync('probe-called', 'called\\n');
      if (process.env.FIXTURE_HANG === '1') {
        console.log('ok 1 - completed fixture case\\n# Subtest: hanging fixture case');
        setTimeout(() => {}, 60000);
      } else
      process.stdout.write('workflow child stdout\\n', () => {
        if (process.env.FIXTURE_ASSERTION === '1') {
          console.log('not ok - fixture assertion: 50%, failed\\r\\nprobe: 0 ok, 1 failed');
        }
        process.stderr.write('workflow child stderr: crashed before reporter\\n', () => {
          process.exitCode = Number(process.env.FIXTURE_STATUS);
        });
      });
    `);
    copyFileSync(join(work, "fixture.mjs"), join(work, "scripts/verify-peep-box-camera.mjs"));
    for (const file of ["probe-motion-signed-in.sh", "walk-end.sh", "probe-end.sh"]) {
      writeFileSync(join(work, "scripts", file), "node fixture.mjs\n");
    }
    if (serverLog) writeFileSync(join(work, "next-start.log"), "existing server diagnostic\n");
    // A stale previous log must not become this attempt's diagnostic.
    writeFileSync(join(work, log), "stale-command-diagnostic\n");
    const summary = join(work, "summary.md");
    writeFileSync(summary, "");
    // `timeout` execs a binary, so the bounded E2E command needs an npm on PATH, not a shell function.
    mkdirSync(join(work, "bin"));
    writeFileSync(join(work, "bin/npm"), `#!/bin/sh
if [ "$1" = run ] && [ "$2" = test:e2e ]; then exec node fixture.mjs; fi
echo 'unexpected npm command' >&2; exit 99
`, { mode: 0o755 });
    const stubs = `
      npm() {
        if [ "$1" = start ]; then echo 'fixture server startup failure' >&2; return 31; fi
        if [ "$1" = run ] && [ "$2" = test:e2e ]; then node fixture.mjs; return $?; fi
        echo 'unexpected npm command' >&2; return 99
      }
      curl() {
        if [ "$FIXTURE_STARTUP" = fail ]; then
          wait || true
          echo 'fixture readiness connection refused' >&2
          return 22
        fi
        echo '{"ok":true}'
      }
    `;
    const result = spawnSync("bash", ["-eo", "pipefail", "-c", `${stubs}\n${mutate(gateBody(name))}`], {
      cwd: work, encoding: "utf8", timeout: 10000,
      env: { ...process.env, PATH: `${join(work, "bin")}:${process.env.PATH}`, FIXTURE_HANG: scenario === "hang" ? "1" : "0", RUNNER_TEMP: work, GITHUB_STEP_SUMMARY: summary, GITHUB_SHA: "workflow-fixture-sha", BASE_URL: "http://fixture.invalid",
        FIXTURE_STATUS: scenario === "success" ? "0" : String(status), FIXTURE_STARTUP: scenario === "startup" ? "fail" : "ok", FIXTURE_ASSERTION: scenario === "assertion" ? "1" : "0" },
    });
    let calls = "";
    try { calls = readFileSync(join(work, "probe-called"), "utf8"); } catch {}
    return { ...result, report: readFileSync(summary, "utf8"), captured: readFileSync(join(work, log), "utf8"), calls };
  } finally { rmSync(work, { recursive: true, force: true }); }
}

const nonTapGates = [["Real CPU camera and privacy verifier", "camera-probe.log"], ...browserGates.slice(1)];
for (const [name, log] of nonTapGates) {
  test(`${name}: actual workflow preserves exit 7, escaped assertions, counts and missing server logs`, () => {
    for (const serverLog of [true, false]) {
      const result = runGate(name, log, "assertion", undefined, { status: 7, serverLog });
      assert.equal(result.status, 7, result.stderr);
      assert.equal(result.calls, "called\n");
      const commands = result.stdout.split("\n").filter((line) => line.startsWith("::error "));
      assert.ok(commands.length > 0);
      assert.match(commands.join("\n"), /not ok - fixture assertion: 50%25, failed%0D%0Aprobe: 0 ok, 1 failed/);
      assert.match(result.report, /not ok - fixture assertion: 50%, failed/);
      assert.match(result.report, /probe: 0 ok, 1 failed/);
      assert.match(result.stdout, serverLog ? /existing server diagnostic/ : /next-start.log unavailable/);
    }
  });

  test(`${name}: a broken assertion reporter preserves the original exit 7`, () => {
    const result = runGate(name, log, "assertion", (body) => body.replace("node scripts/ci-probe-annotate.mjs", "node scripts/missing-annotator.mjs"), { status: 7 });
    assert.equal(result.status, 7, result.stderr);
    assert.match(result.stderr, /MODULE_NOT_FOUND/);
    assert.match(result.stdout, /::error .*fixture assertion/);
    assert.match(result.report, /fixture assertion/);
  });

  test(`${name}: actual workflow exit 0 emits no annotation or summary`, () => {
    const result = runGate(name, log, "success");
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.calls, "called\n");
    assert.doesNotMatch(result.stdout, /::error /);
    assert.equal(result.report, "");
  });
}

for (const [name, log] of browserGates) {
  test(`${name}: real workflow captures combined command failure and identity, preserving exit 43`, () => {
    const result = runGate(name, log, "crash");
    assert.equal(result.status, 43, result.stderr);
    assert.equal(result.calls, "called\n");
    assert.match(result.captured, /workflow child stdout\nworkflow child stderr: crashed before reporter\n$/);
    assert.match(result.stdout, /::error .*workflow child stderr: crashed before reporter/);
    assert.match(result.report, /workflow-fixture-sha/);
    assert.match(result.report, /workflow-fixture-build/);
    assert.match(result.report, /Node: v22\./);
    assert.match(result.report, /Chrome: /);
    assert.match(result.report, /server.*(?:diagnostic|startup failure)/);
    assert.doesNotMatch(result.report, /stale-command-diagnostic/);
  });

  test(`${name}: startup negative control annotates readiness and server failure before any probe, preserving curl exit 22`, () => {
    const result = runGate(name, log, "startup");
    assert.equal(result.status, 22, result.stderr);
    assert.equal(result.calls, "");
    assert.match(result.stdout, /::error .*fixture readiness connection refused/);
    assert.match(result.report, /fixture readiness connection refused/);
    assert.match(result.report, /fixture server startup failure/);
    assert.match(result.report, /workflow-fixture-build/);
    assert.doesNotMatch(result.report, /stale-command-diagnostic/);
  });

  test(`${name}: successful workflow emits no failure annotation or summary`, () => {
    const result = runGate(name, log, "success");
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.calls, "called\n");
    assert.match(result.captured, /workflow child stdout/);
    assert.match(result.captured, /workflow child stderr/);
    assert.doesNotMatch(result.stdout, /::error /);
    assert.equal(result.report, "");
  });
}

test("E2E timeout: the inner bound terminates a hung suite with exit 124 and a bounded annotation", () => {
  // Same workflow shell; only the 900s contract and 10s grace shrink so the fixture does not wait.
  const started = Date.now();
  const result = runGate("E2E against next start", "e2e.log", "hang",
    (body) => body.replace("--kill-after=10s 900s npm", "--kill-after=1s 1s npm"));
  assert.equal(result.status, 124, result.stderr);
  assert.ok(Date.now() - started < 8000, "the hung child was terminated by the inner bound");
  assert.equal(result.calls, "called\n");
  assert.match(result.captured, /hanging fixture case/);
  const commands = result.stdout.split("\n").filter((line) => line.startsWith("::error "));
  assert.equal(commands.length, 1);
  assert.match(commands[0], /Gate: E2E against next start; exit 124/);
  assert.match(commands[0], /hanging fixture case/);
  assert.ok(commands[0].length < 12000, `bounded annotation: ${commands[0].length}`);
  assert.match(result.report, /exit 124/);
  assert.match(result.report, /workflow-fixture-build/);
});

test("wiring negative control: removing the EXIT fallback makes a startup crash opaque", () => {
  const result = runGate(...browserGates[0], "startup", (body) => body.replace(/^.*trap .* EXIT$/m, ":"));
  assert.equal(result.status, 22, result.stderr);
  assert.match(result.captured, /readiness connection refused/);
  assert.doesNotMatch(result.stdout, /::error /);
  assert.equal(result.report, "");
});

test("reporter failure cannot replace the original workflow command exit", () => {
  const result = runGate(...browserGates[0], "crash", (body) => body.replace("node scripts/browser-gate-diagnostics.mjs", "node scripts/missing-diagnostics.mjs"));
  assert.equal(result.status, 43);
  assert.match(result.stderr, /MODULE_NOT_FOUND/);
  assert.equal(result.calls, "called\n");
});

test("browser fallbacks keep the existing gate order, probe budgets and assertion reporter", () => {
  const checks = steps("checks");
  const positions = browserGates.map(([name]) => checks.indexOf(`- name: ${name}\n`));
  assert.deepEqual(positions, [...positions].sort((a, b) => a - b));
  for (const [name] of browserGates.slice(1)) {
    assert.ok(checks.includes(`- name: ${name}\n        timeout-minutes: 8\n`));
  }
  const e2e = readFileSync(new URL("./e2e.mjs", import.meta.url), "utf8");
  assert.match(e2e, /GITHUB_ACTIONS === "true"/);
  assert.match(e2e, /--test-reporter=tap/);
  assert.match(e2e, /e2e-annotate.mjs/);
});

test("the author gate precedes production migrations and main checks", () => {
  const prod = steps("production");
  const author = prod.indexOf("node scripts/check-deploy-author.mjs");
  assert.ok(author > prod.indexOf("actions/checkout@"), "inspect the checked-out commit");
  assert.ok(author < prod.indexOf("npm ci"), "fail before setup, build and migrations");
  assert.ok(author < prod.indexOf("npm run db:migrate"), "never migrate an undeployable author");
  assert.match(prod, /DEPLOY_AUTHOR_EMAIL: quiinthieu@gmail\.com/);
  assert.match(steps("checks"), /if: github.event_name == 'push' \|\| \(github.event_name == 'workflow_dispatch' && github.ref == 'refs\/heads\/main'\)[\s\S]*?node scripts\/check-deploy-author\.mjs/);
});

test("guestbook author guard rejects a wrong-author schema or migration-only push and passes the owner", () => {
  const guard = gateBody("Check guestbook delivery author");
  const work = mkdtempSync(join(tmpdir(), "guestbook-author-ci-"));
  const owner = { name: "Otohime", email: "quiinthieu@gmail.com" };
  const stranger = { name: "Otohime", email: "otohime@users.noreply.github.com" };
  const gitEnv = { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1" };
  const git = (args, who = owner) => spawnSync("git", args, {
    cwd: work, encoding: "utf8",
    env: { ...gitEnv, GIT_AUTHOR_NAME: who.name, GIT_AUTHOR_EMAIL: who.email, GIT_COMMITTER_NAME: who.name, GIT_COMMITTER_EMAIL: who.email },
  }).stdout.trim();
  const commit = (file, who) => {
    mkdirSync(join(work, file, ".."), { recursive: true });
    writeFileSync(join(work, file), `${file} ${Math.random()}\n`);
    git(["add", file], who);
    git(["commit", "-qm", `pm-273/t-1612: ${file}`], who);
    return git(["rev-parse", "HEAD"]);
  };
  const run = (before, head, body = guard) => spawnSync("bash", ["-eo", "pipefail", "-c", body], {
    cwd: work, encoding: "utf8", env: { ...gitEnv, PUSH_BEFORE: before, GITHUB_SHA: head },
  });
  try {
    git(["init", "-q", "--initial-branch=main"]);
    let before = commit("README.md", owner);
    const push = (...files) => {
      const start = before;
      for (const [file, who] of files) before = commit(file, who);
      return [start, before];
    };

    for (const file of ["db/migrations/0006_wrong_author.sql", "db/migrations/meta/_journal.json", "db/schema.ts"]) {
      const [from, to] = push([file, stranger]);
      const res = run(from, to);
      assert.equal(res.status, 1, `${file}: ${res.stderr}`);
      assert.match(res.stderr, new RegExp(`Guestbook delivery ${to} has an undeployable author: Otohime <otohime@users\\.noreply\\.github\\.com>`));
    }
    // A correct code commit followed by a wrong-author migration is still caught across the whole push range.
    const [mixedFrom, mixedTo] = push(["lib/guestbook-store.ts", owner], ["db/migrations/0007_late.sql", stranger]);
    assert.equal(run(mixedFrom, mixedTo).status, 1);

    const [ownFrom, ownTo] = push(["db/migrations/0008_owner.sql", owner], ["db/schema.ts", owner]);
    assert.equal(run(ownFrom, ownTo).status, 0);
    const [otherFrom, otherTo] = push(["docs/unrelated.md", stranger], ["db/seed-notes.txt", stranger]);
    assert.equal(run(otherFrom, otherTo).status, 0, "paths outside the guarded set are not author-gated here");

    // Negative control: the previous predicate, without schema and migrations, let the migration-only push through.
    const [legacyFrom, legacyTo] = push(["db/migrations/0009_legacy.sql", stranger]);
    const legacy = guard.replace("|db/schema\\.ts$|db/migrations/", "");
    assert.notEqual(legacy, guard);
    assert.equal(run(legacyFrom, legacyTo, legacy).status, 0);
    assert.equal(run(legacyFrom, legacyTo).status, 1);
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
});

test("checks, preview and production check out full git ancestry (fetch-depth: 0) and gate builds with strict history checks", () => {
  for (const job of ["checks", "preview", "production"]) {
    const s = steps(job);
    assert.match(
      s,
      /- uses: actions\/checkout@v7\n\s+with:\n\s+fetch-depth: 0/,
      `${job} must check out complete ancestry with fetch-depth: 0`,
    );
    const gen = s.indexOf('npm run history:index -- --strict --rev="$GITHUB_SHA"');
    const preCheck = s.indexOf('npm run history:check -- --strict --rev="$GITHUB_SHA"');
    const build = s.indexOf(job === "checks" ? "npm run build" : job === "preview" ? "npx vercel@64 build" : "npx vercel@64 build --prod");
    const postCheck = s.lastIndexOf('npm run history:check -- --strict --rev="$GITHUB_SHA"');
    assert.ok(gen !== -1, `${job} must run strict history:index`);
    assert.ok(preCheck > gen && preCheck < build, `${job} must run strict history:check before build`);
    assert.ok(postCheck > build, `${job} must run strict history:check after build`);
  }

  const prod = steps("production");
  const postBuildCheck = prod.lastIndexOf('npm run history:check -- --strict --rev="$GITHUB_SHA"');
  const migrate = prod.indexOf("npm run db:migrate");
  const deploy = prod.indexOf("bash scripts/vercel-deploy.sh");
  const verifyDeploy = prod.indexOf('EXPECT_SHA="$GITHUB_SHA" bash scripts/verify-deploy.sh https://otohime.dev');
  const probeHistory = prod.indexOf('EXPECT_SHA="$GITHUB_SHA" bash scripts/probe-history.sh https://otohime.dev');
  assert.ok(postBuildCheck < migrate && postBuildCheck < deploy, "production strict history:check must precede db:migrate and vercel-deploy.sh");
  assert.ok(probeHistory > verifyDeploy, "production must run probe-history.sh after verify-deploy.sh");
  assert.match(steps("checks"), /bash scripts\/probe-history\.sh --self-test/, "checks must run probe-history.sh --self-test");
});

test("production strict history build step blocks build/upload on shallow or mismatched history and catches post-build tampering", () => {
  const stepShell = gateBody("Build production bundle with strict changelog history");
  const work = mkdtempSync(join(tmpdir(), "prod-history-ci-"));
  const gitEnv = {
    ...process.env,
    GIT_CONFIG_GLOBAL: "/dev/null",
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_AUTHOR_NAME: "Fixture",
    GIT_AUTHOR_EMAIL: "fixture@example.test",
    GIT_COMMITTER_NAME: "Fixture",
    GIT_COMMITTER_EMAIL: "fixture@example.test",
  };
  try {
    const origin = join(work, "origin");
    mkdirSync(origin);
    spawnSync("git", ["init", "-q", "--initial-branch=main"], { cwd: origin, env: gitEnv });
    for (let i = 1; i <= 25; i++) {
      writeFileSync(join(origin, `f-${i}.txt`), `${i}\n`);
      spawnSync("git", ["add", `f-${i}.txt`], { cwd: origin, env: gitEnv });
      spawnSync("git", ["commit", "-qm", `pm-271/t-${i}: Step ${i}`], { cwd: origin, env: gitEnv });
    }
    const headSha = spawnSync("git", ["rev-parse", "HEAD"], { cwd: origin, env: gitEnv, encoding: "utf8" }).stdout.trim();
    const oldSha = spawnSync("git", ["rev-parse", "HEAD~22"], { cwd: origin, env: gitEnv, encoding: "utf8" }).stdout.trim();

    function setupCheckout(dir) {
      mkdirSync(join(dir, "scripts"), { recursive: true });
      mkdirSync(join(dir, "content"), { recursive: true });
      copyFileSync(new URL("./history-index.ts", import.meta.url), join(dir, "scripts/history-index.ts"));
      writeFileSync(
        join(dir, "package.json"),
        JSON.stringify({
          name: "fixture",
          private: true,
          scripts: {
            "history:index": "node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/history-index.ts",
            "history:check": "node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/history-index.ts --check",
          },
        }),
      );
    }

    function runProdBuildStep(cwd, sha, buildMode = "ok") {
      const marker = join(cwd, "build-invoked");
      const uploadMarker = join(cwd, "upload-invoked");
      rmSync(marker, { force: true });
      rmSync(uploadMarker, { force: true });
      const stub = `
        npx() {
          echo "called" > "${marker}"
          if [ "$BUILD_MODE" = "tamper-total" ]; then
            node -e '
              const fs = require("node:fs");
              const t = fs.readFileSync("content/history.json", "utf8").replace(/"total": \\d+,/, "\\"total\\": 999,");
              fs.writeFileSync("content/history.json", t);
            '
          elif [ "$BUILD_MODE" = "tamper-stale" ]; then
            node --experimental-strip-types scripts/history-index.ts --file=content/history.json
            node -e '
              const fs = require("node:fs");
              fs.writeFileSync("content/history.json", fs.readFileSync("content/history.json.stale", "utf8"));
            '
          else
            npm run history:index
          fi
        }
      `;
      const res = spawnSync("bash", ["-eo", "pipefail", "-c", `${stub}\n${stepShell}\necho "uploaded" > "${uploadMarker}"`], {
        cwd,
        env: { ...gitEnv, GITHUB_SHA: sha, BUILD_MODE: buildMode },
        encoding: "utf8",
      });
      let built = false;
      let uploaded = false;
      try { built = readFileSync(marker, "utf8").includes("called"); } catch {}
      try { uploaded = readFileSync(uploadMarker, "utf8").includes("uploaded"); } catch {}
      return { ...res, built, uploaded };
    }

    // 1. Shallow clone negative control: fails before npx vercel@64 build --prod or upload runs.
    const shallow = join(work, "shallow");
    spawnSync("git", ["clone", "-q", "--depth=1", `file://${origin}`, shallow], { env: gitEnv });
    setupCheckout(shallow);
    const shallowRes = runProdBuildStep(shallow, headSha);
    assert.notEqual(shallowRes.status, 0);
    assert.equal(shallowRes.built, false, "shallow clone must not reach vercel build");
    assert.equal(shallowRes.uploaded, false, "shallow clone must not reach upload");

    // 2. Full clone with wrong GITHUB_SHA negative control: fails before npx vercel@64 build --prod or upload runs.
    setupCheckout(origin);
    const wrongShaRes = runProdBuildStep(origin, oldSha);
    assert.notEqual(wrongShaRes.status, 0);
    assert.equal(wrongShaRes.built, false, "mismatched GITHUB_SHA must not reach vercel build");
    assert.equal(wrongShaRes.uploaded, false, "mismatched GITHUB_SHA must not reach upload");

    // 3. Post-build tampering negative control (wrong total): build runs, post-build history:check blocks upload.
    const tamperTotalRes = runProdBuildStep(origin, headSha, "tamper-total");
    assert.notEqual(tamperTotalRes.status, 0);
    assert.equal(tamperTotalRes.built, true);
    assert.equal(tamperTotalRes.uploaded, false, "post-build total tampering must block upload");

    // 4. Positive path: full clone at headSha generates current index, builds, passes post-build check and reaches upload.
    const okRes = runProdBuildStep(origin, headSha, "ok");
    assert.equal(okRes.status, 0, okRes.stderr);
    assert.equal(okRes.built, true);
    assert.equal(okRes.uploaded, true);
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
});

test("ghost fake starts before Next, survives every later browser/footer probe and is always cleaned", () => {
  const checks = steps("checks");
  assert.equal(scalar(["jobs", "checks", "env", "GHOSTS_ENDPOINT"]), "ws://127.0.0.1:8788/ghosts");
  assert.equal(scalar(["jobs", "checks", "env", "GHOSTS_FAKE_BASE"]), "http://127.0.0.1:8788");
  const start = checks.indexOf("- name: Start local ghost fake"), stop = checks.indexOf("- name: Stop local ghost fake");
  assert.ok(start > 0);
  for (const [name] of browserGates) assert.ok(start < checks.indexOf(`- name: ${name}`) && checks.indexOf(`- name: ${name}`) < stop, name);
  assert.match(checks.slice(start, checks.indexOf("- name: E2E against next start")), /ghosts-fake\.mjs --port 8788 --origins "\$BASE_URL"/);
  assert.match(checks.slice(stop), /if: always\(\)/);
  assert.match(checks.slice(stop), /kill "\$\(cat "\$RUNNER_TEMP\/ghosts-fake.pid"\)"/);
  assert.doesNotMatch(gateBody("E2E against next start"), /kill.*ghosts-fake|trap.*ghosts-fake/, "E2E must leave the fake alive for later probes");
});

test("actual CI fake startup/readiness/late-probe/cleanup commands keep the transport available until teardown", () => {
  const work = mkdtempSync(join(tmpdir(), "ghost-ci-lifecycle-"));
  try {
    const start = gateBody("Start local ghost fake"), stop = gateBody("Stop local ghost fake");
    const script = `
      trap 'if [ -f "$RUNNER_TEMP/ghosts-fake.pid" ]; then kill "$(cat "$RUNNER_TEMP/ghosts-fake.pid")" 2>/dev/null || true; fi' EXIT
      ${start}
      # Stand in for each later browser/footer step with an independent HTTP readiness read.
      for probe in e2e motion footer-walk footer-chromium; do
        curl -fsS "$GHOSTS_FAKE_BASE/__ready" >/dev/null
        kill -0 "$(cat "$RUNNER_TEMP/ghosts-fake.pid")"
      done
      ${stop}
      wait "$(cat "$RUNNER_TEMP/ghosts-fake.pid")"
      if kill -0 "$(cat "$RUNNER_TEMP/ghosts-fake.pid")" 2>/dev/null; then exit 93; fi
    `;
    const result = spawnSync("bash", ["-eo", "pipefail", "-c", script], { encoding: "utf8", timeout: 10000,
      env: { ...process.env, RUNNER_TEMP: work, BASE_URL: "http://localhost:3000", GHOSTS_FAKE_BASE: "http://127.0.0.1:8788" } });
    assert.ifError(result.error); assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.match(readFileSync(join(work, "ghosts-fake.log"), "utf8"), /ghosts-fake ready/);
  } finally { rmSync(work, { recursive: true, force: true }); }
});

test("application SHA and Next BUILD_ID are published independently from the Worker executable", () => {
  const checks = steps("checks");
  assert.ok(checks.indexOf("- name: Publish application build identity") > checks.indexOf("- name: Real CPU camera and privacy verifier"), "camera verifier rebuilds .next: publish the build that next start actually serves");
  assert.ok(checks.indexOf("- name: Publish application build identity") < checks.indexOf("- name: E2E against next start"));
  const identity = gateBody("Publish application build identity");
  assert.match(identity, /appSha: process.env.GITHUB_SHA/); assert.match(identity, /nextBuildId: fs.readFileSync\(".next\/BUILD_ID"/);
  const work = mkdtempSync(join(tmpdir(), "app-identity-"));
  try {
    mkdirSync(join(work, ".next")); writeFileSync(join(work, ".next/BUILD_ID"), "fixture-next-build\n");
    const r = spawnSync("bash", ["-eo", "pipefail", "-c", identity], { cwd: work, env: { ...process.env, RUNNER_TEMP: work, GITHUB_SHA: "a".repeat(40) }, encoding: "utf8" });
    assert.equal(r.status, 0, r.stderr);
    assert.deepEqual(JSON.parse(readFileSync(join(work, "app-build.json"), "utf8")), { appSha: "a".repeat(40), nextBuildId: "fixture-next-build" });
  } finally { rmSync(work, { recursive: true, force: true }); }
});

test("production read-only Terminal/Press probe runs without fake configuration and preserves browser failures", () => {
  const script = readFileSync(new URL("./verify-deploy.sh", import.meta.url), "utf8");
  const invocation = script.split('  echo "# running the Pocket Terminal and Ink Poster Press e2e against $base"\n')[1]
    ?.split('  if [ "$status" -ne 0 ]; then')[0];
  assert.ok(invocation, "execute the actual default verifier browser invocation");
  const work = mkdtempSync(join(tmpdir(), "readonly-browser-"));
  try {
    mkdirSync(join(work, "scripts")); mkdirSync(join(work, "e2e"));
    for (const file of ["e2e.mjs", "e2e-annotate.mjs"]) copyFileSync(new URL(`./${file}`, import.meta.url), join(work, "scripts", file));
    for (const name of ["pocket-terminal", "ink-press"]) writeFileSync(join(work, `e2e/${name}.test.ts`), `
      import assert from 'node:assert/strict';
      import { test } from 'node:test';
      test('${name} read-only fixture', () => {
        assert.equal(process.env.BASE_URL, 'https://fixture.invalid');
        assert.equal(process.env.GHOSTS_FAKE_BASE, undefined);
        assert.equal(process.env.GHOSTS_ENDPOINT, undefined);
        assert.ok(process.env.FAIL_CASE !== '${name}', 'intentional browser assertion');
      });
    `);
    for (const ci of ["false", "true"]) for (const fail of ["", "ink-press"]) {
      const env = { ...process.env, NODE_BINARY: process.execPath, GITHUB_ACTIONS: ci, FAIL_CASE: fail,
        GITHUB_STEP_SUMMARY: join(work, "summary.md") };
      for (const key of ["GHOSTS_FAKE_BASE", "GHOSTS_ENDPOINT", "VERIFY_E2E_CMD", "NODE_TEST_CONTEXT"]) delete env[key];
      const result = spawnSync("bash", ["-uc", `
        NODE_TS=("$NODE_BINARY" --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON)
        base=https://fixture.invalid
        run() { ${invocation}\n return "$status"; }
        run
      `], { cwd: work, env, encoding: "utf8", timeout: 10000 });
      assert.ifError(result.error);
      assert.equal(result.status, fail ? 1 : 0, result.stdout + result.stderr);
      assert.match(result.stdout, /pocket-terminal read-only fixture/);
      assert.match(result.stdout, /ink-press read-only fixture/);
      assert.doesNotMatch(result.stdout + result.stderr, /requires explicit GHOSTS_FAKE_BASE/);
      if (ci === "true" && fail) assert.match(result.stdout, /::error/);
    }
  } finally { rmSync(work, { recursive: true, force: true }); }
});

test("documented Docker E2E entrypoint owns explicit fake configuration until its server stops", () => {
  const script = readFileSync(new URL("./e2e-local.sh", import.meta.url), "utf8");
  const fn = name => {
    const source = script.match(new RegExp(`^${name}\\(\\) \\{[\\s\\S]*?^\\}`, "m"))?.[0];
    assert.ok(source, `${name} lifecycle function`); return source;
  };
  const start = fn("start_ghost_fake");
  assert.ok(script.indexOf('\nstart_ghost_fake || exit 1') < script.indexOf('\necho "Starting the server'));
  assert.ok(script.indexOf('kill -TERM -- "-$SERVER_PID"') < script.indexOf('kill "$FAKE_PID"'));
  const work = mkdtempSync(join(tmpdir(), "docker-ghost-lifecycle-"));
  try {
    const result = spawnSync("bash", ["-euc", `
      SERVER_PID=""; STARTED_DB=0; FAKE_PID=""; FAKE_LOG=""
      BETTER_AUTH_URL=http://localhost:4027
      ${fn("free_port")}
      ${fn("cleanup")}
      ${start}
      trap cleanup EXIT
      start_ghost_fake
      test "$GHOSTS_ENDPOINT" = "ws://127.0.0.1:$GHOSTS_FAKE_PORT/ghosts"
      test "$GHOSTS_FAKE_BASE" = "http://127.0.0.1:$GHOSTS_FAKE_PORT"
      curl -fsS "$GHOSTS_FAKE_BASE/__ready"
      kill -0 "$FAKE_PID"
      cleanup
      wait "$FAKE_PID"
      if kill -0 "$FAKE_PID" 2>/dev/null; then exit 93; fi
      test ! -f "$FAKE_LOG"
    `], { encoding: "utf8", timeout: 10000, env: { ...process.env, TMPDIR: work } });
    assert.ifError(result.error); assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.match(result.stdout, /"ready":true/);
  } finally { rmSync(work, { recursive: true, force: true }); }
});
