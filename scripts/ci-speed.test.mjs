import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { isReportOnly, needsBrowser } from "./ci-browser-gate.mjs";

const GATE_SCRIPT = fileURLToPath(new URL("./ci-browser-gate.mjs", import.meta.url));
const WORKFLOW_PATH = new URL("../.github/workflows/ci.yml", import.meta.url);
const PACKAGE_PATH = new URL("../package.json", import.meta.url);

test("npm test registers scripts/ci-speed.test.mjs", () => {
  const pkg = JSON.parse(readFileSync(PACKAGE_PATH, "utf8"));
  assert.match(pkg.scripts.test, /'scripts\/ci-speed\.test\.mjs'/);
});

test("report-only diffs skip the browser suite and any other path runs it", () => {
  assert.equal(needsBrowser([]), false);
  assert.equal(needsBrowser(["README.md", "projects/pm/qa_report.md", "projects/pm/run.log"]), false);
  assert.equal(needsBrowser(["projects/pm/qa_report.md", "app/page.tsx"]), true);
  assert.equal(needsBrowser(["content/site.ts"]), true);
  assert.equal(needsBrowser([".github/workflows/ci.yml"]), true);
  assert.equal(needsBrowser(null), true);
  assert.equal(isReportOnly("projects/pm/notes.ts"), true);
  assert.equal(isReportOnly("app/readme.md"), true);
  assert.equal(isReportOnly("lib/auth.ts"), false);
});

test("ci-browser-gate CLI skips report-only pushes and PRs and fails open on unknown events or diffs", () => {
  const work = mkdtempSync(join(tmpdir(), "ci-browser-gate-"));
  const gitEnv = {
    ...process.env,
    GIT_CONFIG_GLOBAL: "/dev/null",
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_AUTHOR_NAME: "Fixture",
    GIT_AUTHOR_EMAIL: "fixture@example.test",
    GIT_COMMITTER_NAME: "Fixture",
    GIT_COMMITTER_EMAIL: "fixture@example.test",
  };
  const git = (...args) => {
    const res = spawnSync("git", args, { cwd: work, env: gitEnv, encoding: "utf8" });
    assert.equal(res.status, 0, res.stderr);
    return res.stdout.trim();
  };
  const commit = (files, msg) => {
    for (const [path, body] of Object.entries(files)) {
      mkdirSync(dirname(join(work, path)), { recursive: true });
      writeFileSync(join(work, path), body);
      git("add", path);
    }
    git("commit", "-qm", msg);
    return git("rev-parse", "HEAD");
  };
  const runGate = ({ eventName, payload, sha }) => {
    const eventPath = join(work, "event.json");
    const outputPath = join(work, "output.txt");
    writeFileSync(outputPath, "");
    if (payload !== undefined) writeFileSync(eventPath, payload);
    const res = spawnSync(process.execPath, [GATE_SCRIPT], {
      cwd: work,
      encoding: "utf8",
      env: {
        ...gitEnv,
        GITHUB_EVENT_NAME: eventName,
        GITHUB_EVENT_PATH: payload !== undefined ? eventPath : join(work, "missing.json"),
        GITHUB_SHA: sha,
        GITHUB_OUTPUT: outputPath,
      },
    });
    assert.equal(res.status, 0, res.stderr);
    return { out: readFileSync(outputPath, "utf8"), stdout: res.stdout, stderr: res.stderr };
  };

  try {
    git("init", "-q", "--initial-branch=main");
    const base = commit({ "app/page.tsx": "v1\n" }, "base");
    const reportPush = commit({ "projects/pm-301/qa.md": "ok\n", "README.md": "docs\n" }, "report");
    const codePush = commit({ "app/page.tsx": "v2\n" }, "code");

    // Report-only push skips browser
    assert.equal(runGate({ eventName: "push", payload: JSON.stringify({ before: base }), sha: reportPush }).out, "browser=false\n");
    // Mixed/code push requires browser
    assert.equal(runGate({ eventName: "push", payload: JSON.stringify({ before: base }), sha: codePush }).out, "browser=true\n");
    // Initial branch push (all-zero before) fails open to browser=true
    assert.equal(runGate({ eventName: "push", payload: JSON.stringify({ before: "0".repeat(40) }), sha: reportPush }).out, "browser=true\n");

    // Report-only PR branch, even when main (base) has moved ahead with code changes, skips browser
    git("checkout", "-qb", "docs/report-pr", base);
    const prHead = commit({ "projects/pm-301/summary.log": "pass\n" }, "pr report");
    assert.equal(
      runGate({
        eventName: "pull_request",
        payload: JSON.stringify({ pull_request: { base: { sha: codePush }, head: { sha: prHead } } }),
        sha: prHead,
      }).out,
      "browser=false\n",
    );

    // Code PR branch requires browser
    const prCodeHead = commit({ "lib/feature.ts": "export const x = 1;\n" }, "pr code");
    assert.equal(
      runGate({
        eventName: "pull_request",
        payload: JSON.stringify({ pull_request: { base: { sha: codePush }, head: { sha: prCodeHead } } }),
        sha: prCodeHead,
      }).out,
      "browser=true\n",
    );

    // workflow_dispatch and malformed event payloads fail open to browser=true
    assert.equal(runGate({ eventName: "workflow_dispatch", payload: "{}", sha: reportPush }).out, "browser=true\n");
    const broken = runGate({ eventName: "push", payload: "{not-json", sha: reportPush });
    assert.equal(broken.out, "browser=true\n");
    assert.match(broken.stderr, /running the browser suite/);
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
});

test("CI checks job wires ci-browser-gate to every Chrome step while keeping build and unit gates unconditional", () => {
  const workflow = readFileSync(WORKFLOW_PATH, "utf8");
  const checks = workflow.slice(workflow.indexOf("  checks:\n"), workflow.indexOf("\n  preview:\n"));
  assert.match(
    checks,
    /- name: Decide whether browser coverage is required\n\s+id: browser\n\s+run: node scripts\/ci-browser-gate\.mjs\n/,
  );
  for (const gated of [
    "Real CPU camera and privacy verifier",
    "Start local ghost fake",
    "E2E against next start",
    "Motion probe, signed in",
    "Footer walk",
    "Footer Chromium probe",
  ]) {
    const start = checks.indexOf(`- name: ${gated}\n`);
    assert.ok(start >= 0, gated);
    const next = checks.indexOf("\n      - ", start + 1);
    const step = checks.slice(start, next < 0 ? undefined : next);
    assert.match(step, /\n        if: steps\.browser\.outputs\.browser == 'true'\n/, gated);
  }
  for (const unconditional of ["- name: npm test\n", "- run: npm run build\n", "- run: npm run db:migrate\n", "- name: Publish application build identity\n"]) {
    const start = checks.indexOf(unconditional);
    assert.ok(start >= 0, unconditional);
    const next = checks.indexOf("\n      - ", start + 1);
    const step = checks.slice(start, next < 0 ? undefined : next);
    assert.doesNotMatch(step, /steps\.browser\.outputs\.browser/, unconditional);
  }
});

test("the HTTP e2e list is exactly the files that do not import Playwright directly or via e2e helpers", () => {
  const source = readFileSync(new URL("./e2e.mjs", import.meta.url), "utf8");
  const block = source.slice(source.indexOf("const HTTP_E2E = ["), source.indexOf("];", source.indexOf("const HTTP_E2E = [")));
  const listed = [...block.matchAll(/"(e2e\/[^"]+)"/g)].map((match) => match[1]);
  const e2eDir = fileURLToPath(new URL("../e2e/", import.meta.url));
  const memo = new Map();
  const usesPlaywright = (relFile, stack = new Set()) => {
    if (memo.has(relFile)) return memo.get(relFile);
    if (stack.has(relFile)) return false;
    stack.add(relFile);
    const text = readFileSync(join(e2eDir, "..", relFile), "utf8");
    if (/from\s+["']playwright/.test(text)) {
      memo.set(relFile, true);
      return true;
    }
    for (const [, spec] of text.matchAll(/from\s+["'](\.[^"']+)["']/g)) {
      const target = join("e2e", spec).replaceAll("\\", "/");
      if (readdirSync(e2eDir).includes(target.slice("e2e/".length)) && usesPlaywright(target, stack)) {
        memo.set(relFile, true);
        return true;
      }
    }
    memo.set(relFile, false);
    return false;
  };
  const files = readdirSync(e2eDir)
    .filter((file) => file.endsWith(".test.ts"))
    .map((file) => `e2e/${file}`);
  const http = files.filter((file) => !usesPlaywright(file));
  assert.deepEqual(listed.toSorted(), http.toSorted());
  assert.match(source, /E2E_SPLIT_HTTP === "1"/);
  assert.match(source, /"--test-concurrency=1", /);

  const workflow = readFileSync(WORKFLOW_PATH, "utf8");
  const checks = workflow.slice(workflow.indexOf("  checks:\n"), workflow.indexOf("\n  preview:\n"));
  const start = checks.indexOf("- name: E2E against next start\n");
  const step = checks.slice(start, checks.indexOf("\n      - ", start + 1));
  assert.match(step, /\n        env:\n          E2E_SPLIT_HTTP: "1"\n/);
});

test("E2E_SPLIT_HTTP=1 runs HTTP files concurrently, browser files serially, and executes each file once", () => {
  const work = mkdtempSync(join(tmpdir(), "e2e-split-http-"));
  try {
    mkdirSync(join(work, "scripts"));
    mkdirSync(join(work, "e2e"));
    copyFileSync(new URL("./e2e.mjs", import.meta.url), join(work, "scripts/e2e.mjs"));
    copyFileSync(new URL("./e2e-annotate.mjs", import.meta.url), join(work, "scripts/e2e-annotate.mjs"));
    const logPath = join(work, "spans.jsonl");
    const suiteBody = (name, kind, failEnv = "") => `
      import assert from "node:assert/strict";
      import { appendFileSync } from "node:fs";
      import { test } from "node:test";
      test(${JSON.stringify(name)}, async () => {
        const start = Date.now();
        await new Promise((resolve) => setTimeout(resolve, 400));
        appendFileSync(${JSON.stringify(logPath)}, JSON.stringify({ name: ${JSON.stringify(name)}, kind: ${JSON.stringify(kind)}, start, end: Date.now() }) + "\\n");
        ${failEnv ? `assert.notEqual(process.env.${failEnv}, "1", "http failure stops suite");` : ""}
      });
    `;
    writeFileSync(join(work, "e2e/postcard.test.ts"), suiteBody("postcard", "http", "FAIL_HTTP"));
    writeFileSync(join(work, "e2e/peeks.test.ts"), suiteBody("peeks", "http"));
    writeFileSync(join(work, "e2e/desk.test.ts"), suiteBody("desk", "browser"));
    writeFileSync(join(work, "e2e/ryugu.test.ts"), suiteBody("ryugu", "browser"));

    const baseEnv = {
      ...process.env,
      BASE_URL: "http://127.0.0.1:9",
      GHOSTS_FAKE_BASE: "http://127.0.0.1:8788",
      GHOSTS_ENDPOINT: "ws://127.0.0.1:8788/ghosts",
      E2E_SPLIT_HTTP: "1",
    };
    delete baseEnv.NODE_TEST_CONTEXT;

    writeFileSync(logPath, "");
    const ok = spawnSync(
      process.execPath,
      ["--experimental-strip-types", "--disable-warning=ExperimentalWarning", "--disable-warning=MODULE_TYPELESS_PACKAGE_JSON", "scripts/e2e.mjs", "--test", "e2e/**/*.test.ts"],
      { cwd: work, env: baseEnv, encoding: "utf8", timeout: 15_000 },
    );
    assert.equal(ok.status, 0, ok.stdout + ok.stderr);
    const records = readFileSync(logPath, "utf8")
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));
    // Every file runs once (never re-run in the browser phase).
    assert.deepEqual(records.map((r) => r.name).toSorted(), ["desk", "peeks", "postcard", "ryugu"]);
    const httpSpans = records.filter((r) => r.kind === "http").sort((a, b) => a.start - b.start);
    const browserSpans = records.filter((r) => r.kind === "browser").sort((a, b) => a.start - b.start);
    assert.ok(httpSpans[1].start < httpSpans[0].end, `HTTP files should overlap: ${JSON.stringify(httpSpans)}`);
    assert.ok(browserSpans[0].start >= Math.max(httpSpans[0].end, httpSpans[1].end), "browser phase starts after HTTP phase");
    assert.ok(browserSpans[1].start >= browserSpans[0].end, `browser files must stay serial: ${JSON.stringify(browserSpans)}`);

    // Failure in HTTP phase exits nonzero immediately without running the browser phase.
    writeFileSync(logPath, "");
    const failed = spawnSync(
      process.execPath,
      ["--experimental-strip-types", "--disable-warning=ExperimentalWarning", "--disable-warning=MODULE_TYPELESS_PACKAGE_JSON", "scripts/e2e.mjs", "--test", "e2e/**/*.test.ts"],
      { cwd: work, env: { ...baseEnv, FAIL_HTTP: "1" }, encoding: "utf8", timeout: 15_000 },
    );
    assert.notEqual(failed.status, 0);
    const failedRecords = readFileSync(logPath, "utf8")
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line));
    assert.ok(failedRecords.every((r) => r.kind === "http"), "browser files do not run after HTTP failure");
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
});
