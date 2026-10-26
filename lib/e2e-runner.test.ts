import assert from "node:assert/strict";
import { execFile, spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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
