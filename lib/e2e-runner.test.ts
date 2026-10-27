import assert from "node:assert/strict";
import { execFile, spawn, spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createRequire } from "node:module";
import { test } from "node:test";

// npm run test:e2e runs its files one at a time (scripts/e2e.mjs): the desk's leaves and the WebGL loops of the Ink
// Press and Ryugu-jo count animation frames, and files run side by side starved each other's browsers of them.
// Two fixture files that each hold a span of time stand in for them; scripts/e2e.mjs runs them as the gate does
// (BASE_URL set, so no server or database of its own), and their spans must not overlap. An explicit
// --test-concurrency=2 after it is the negative control: there the spans do overlap.
const ROOT = resolve(import.meta.dirname, "..");

type Span = { name: string; start: number; end: number };

// The suite's own environment: BASE_URL set, and not this test's runner context, under which a nested node --test
// reports to this runner instead of running its files.
const suiteEnv: NodeJS.ProcessEnv = { ...process.env, BASE_URL: "http://127.0.0.1:9" };
delete suiteEnv.NODE_TEST_CONTEXT;

async function spans(extra: string[]): Promise<Span[]> {
  const dir = mkdtempSync(join(tmpdir(), "e2e-runner-"));
  const log = join(dir, "spans.log");
  try {
    for (const name of ["a", "b"]) {
      writeFileSync(
        join(dir, `${name}.test.mjs`),
        `import { appendFileSync } from "node:fs";
import { test } from "node:test";
test("${name}", async () => {
  const start = Date.now();
  await new Promise((r) => setTimeout(r, 500));
  appendFileSync(${JSON.stringify(log)}, JSON.stringify({ name: "${name}", start, end: Date.now() }) + "\\n");
});
`,
      );
    }
    await new Promise<void>((done, fail) =>
      execFile(
        process.execPath,
        ["scripts/e2e.mjs", ...extra, "--test", join(dir, "a.test.mjs"), join(dir, "b.test.mjs")],
        { cwd: ROOT, env: suiteEnv, timeout: 30_000 },
        (err, stdout) => (err ? fail(new Error(`${err.message}\n${stdout}`)) : done()),
      ),
    );
    return readFileSync(log, "utf8")
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line) as Span)
      .sort((x, y) => x.start - y.start);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test("scripts/e2e.mjs runs the e2e files one at a time; an explicit --test-concurrency=2 overlaps them (negative control)", async () => {
  const serial = await spans([]);
  assert.equal(serial.length, 2);
  assert.ok(serial[1].start >= serial[0].end, `the second file started before the first ended: ${JSON.stringify(serial)}`);

  const parallel = await spans(["--test-concurrency=2"]);
  assert.equal(parallel.length, 2);
  assert.ok(parallel[1].start < parallel[0].end, `two files at once should overlap: ${JSON.stringify(parallel)}`);
});

// CI's job log needs a token to read, so under GitHub Actions each failed e2e test is also an ::error annotation and
// a step summary section (scripts/e2e-annotate.mjs), beside the TAP output and with the suite's exit status kept.
// Negative control: the same run outside Actions writes neither.
test("under GitHub Actions scripts/e2e.mjs annotates each failed test with its file, line and assertion; outside it, nothing", async () => {
  const dir = mkdtempSync(join(tmpdir(), "e2e-annotate-"));
  try {
    const file = join(dir, "a.test.mjs");
    writeFileSync(
      file,
      `import assert from "node:assert/strict";
import { test } from "node:test";
test("passes", () => {});
test("hops: down, then up", () => {
  assert.deepEqual(["InvalidStateError: Page already revealed", "100%"], []);
});
`,
    );
    const suite = (env: NodeJS.ProcessEnv) =>
      new Promise<{ code: number | null; out: string }>((done) =>
        execFile(process.execPath, ["scripts/e2e.mjs", "--test", file], { cwd: ROOT, env, timeout: 30_000 }, (err, stdout, stderr) =>
          done({ code: err ? ((err as { code?: number }).code ?? 1) : 0, out: stdout + stderr }),
        ),
      );
    const summaryFile = join(dir, "summary.md");
    const ci = await suite({ ...suiteEnv, GITHUB_ACTIONS: "true", GITHUB_STEP_SUMMARY: summaryFile });
    assert.equal(ci.code, 1, ci.out);
    assert.match(ci.out, /^not ok 2 - hops: down, then up$/m, "the TAP output is still there");
    const annotations = ci.out.split("\n").filter((line) => line.startsWith("::error "));
    assert.equal(annotations.length, 1, ci.out);
    const [props, message] = annotations[0].slice("::error ".length).split("::");
    assert.match(props, /^file=[^,]*a\.test\.mjs,line=4,title=E2E failed%3A hops%3A down%2C then up$/);
    assert.match(message, /^AssertionError \[ERR_ASSERTION\]: Expected values to be strictly deep-equal:%0A/);
    assert.match(message, /'InvalidStateError: Page already revealed',%0A.*'100%25'/);
    const summary = readFileSync(summaryFile, "utf8");
    assert.match(summary, /^## E2E failures\n\n### ✗ hops: down, then up\n/);
    assert.match(summary, /a\.test\.mjs:4`/);
    assert.match(summary, /'InvalidStateError: Page already revealed',\n/);

    const local: NodeJS.ProcessEnv = { ...suiteEnv, GITHUB_STEP_SUMMARY: join(dir, "local.md") };
    delete local.GITHUB_ACTIONS;
    const plain = await suite(local);
    assert.equal(plain.code, 1, plain.out);
    assert.match(plain.out, /^not ok 2 - hops: down, then up$/m);
    assert.doesNotMatch(plain.out, /^::error /m, "outside Actions there is no annotation");
    assert.equal(existsSync(join(dir, "local.md")), false, "outside Actions there is no step summary");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// The CI step keeps the suite's exit status while it adds the server's tail to the summary on a red run.
test("CI's E2E step keeps the suite's status and adds the server's log tail to the step summary when it fails", () => {
  const ci = readFileSync(join(ROOT, ".github/workflows/ci.yml"), "utf8");
  const step = ci.slice(ci.indexOf("- name: E2E against next start"), ci.indexOf("- name: Motion probe, signed in"));
  const body = step.slice(step.indexOf("        run: |") + "        run: |".length)
    .split("\n").filter((line) => line.startsWith("          ")).map((line) => line.slice(10)).join("\n");
  const dir = mkdtempSync(join(tmpdir(), "e2e-ci-status-"));
  try {
    mkdirSync(join(dir, "scripts"));
    for (const file of ["browser-gate-diagnostics.mjs", "e2e-annotate.mjs"]) {
      copyFileSync(join(ROOT, "scripts", file), join(dir, "scripts", file));
    }
    writeFileSync(join(dir, "fixture.mjs"), `
      process.stdout.write('suite stdout\\n', () => {
        process.stderr.write('suite stderr\\n', () => { process.exitCode = Number(process.env.CI_FIXTURE_STATUS); });
      });
    `);
    const summaryPath = join(dir, "summary.md");
    for (const status of [17, 0]) {
      writeFileSync(summaryPath, "");
      const result = spawnSync("bash", ["-eo", "pipefail", "-c", `
        npm() {
          if [ "$1" = start ]; then
            for ((i=0; i<100; i++)); do echo "server $i"; done
          else node fixture.mjs; fi
        }
        curl() { wait || true; }
        ${body}
      `], { cwd: dir, env: { ...process.env, RUNNER_TEMP: dir, GITHUB_STEP_SUMMARY: summaryPath,
        GITHUB_SHA: "ci-status-fixture", CI_FIXTURE_STATUS: String(status) }, encoding: "utf8", timeout: 10000 });
      assert.equal(result.status, status, result.stderr);
      assert.equal(readFileSync(join(dir, "e2e.log"), "utf8"), "suite stdout\nsuite stderr\n");
      const summary = readFileSync(summaryPath, "utf8");
      if (status === 0) {
        assert.equal(summary, "");
        assert.doesNotMatch(result.stdout, /::error /);
      } else {
        assert.match(result.stdout, /::error .*suite stderr/);
        assert.match(summary, /ci-status-fixture/);
        assert.match(summary, /suite stdout\nsuite stderr/);
        assert.doesNotMatch(summary, /server 19\b/);
        assert.match(summary, /server 20\n/);
        assert.match(summary, /server 99\n/);
      }
    }
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

// scripts/walk-end.sh and scripts/probe-end.sh fall back to this when no database answers and Docker is not there.
test("scripts/e2e.mjs --serve-db holds a migrated throwaway Postgres until SIGTERM, then stops it and removes its files", { timeout: 120_000 }, async () => {
  for (const script of ["scripts/walk-end.sh", "scripts/probe-end.sh"]) {
    const sh = readFileSync(join(ROOT, script), "utf8");
    assert.match(sh, /if ! pgq 'select 1' >\/dev\/null 2>&1; then\n\s+start_embedded_db\n\s+fi/, `${script} starts its own database`);
    assert.match(sh, /node scripts\/e2e\.mjs --serve-db "\$WORK\/db"/, `${script} keeps the database under its work dir`);
    assert.match(sh, /cleanup\(\) \{[\s\S]*?stop_embedded_db[\s\S]*?rm -rf "\$WORK"/, `${script} stops it before removing the work dir`);
  }

  const parent = mkdtempSync(join(tmpdir(), "serve-db-"));
  const dir = join(parent, "db");
  try {
    const env: NodeJS.ProcessEnv = { ...process.env };
    delete env.NODE_TEST_CONTEXT;
    const child = spawn(process.execPath, ["scripts/e2e.mjs", "--serve-db", dir], { cwd: ROOT, env });
    let out = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (out += d));
    const exited = new Promise<number | null>((done) => child.on("exit", (code) => done(code)));
    const url = await new Promise<string>((done, fail) => {
      const timer = setInterval(() => {
        const m = out.match(/^DATABASE_URL=(\S+)$/m);
        if (m) {
          clearInterval(timer);
          done(m[1]);
        } else if (child.exitCode !== null) {
          clearInterval(timer);
          fail(new Error(`--serve-db exited ${child.exitCode}:\n${out}`));
        }
      }, 100);
    });
    assert.match(url, /^postgresql:\/\/otohime:otohime@127\.0\.0\.1:\d+\/otohime$/);

    // It answers, with the migrations applied.
    const require = createRequire(import.meta.url);
    const pg = require("pg") as typeof import("pg");
    const client = new pg.Client({ connectionString: url });
    await client.connect();
    const { rows } = await client.query(`select count(*)::int as n from "user"`);
    await client.end();
    assert.equal(rows[0].n, 0);
    assert.ok(existsSync(dir), "its files sit under the given dir");

    child.kill("SIGTERM");
    assert.equal(await exited, 143);
    assert.equal(existsSync(dir), false, "its files are gone");
    const after = new pg.Client({ connectionString: url, connectionTimeoutMillis: 2000 });
    await assert.rejects(after.connect(), "the database still answers after SIGTERM");
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});
