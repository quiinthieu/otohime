// Exercise the real runner's build lifecycle in an isolated checkout. npm, Postgres and the
// application are explicit stand-ins; this does not replace the production-browser contract.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";

const runner = readFileSync(new URL("./e2e.mjs", import.meta.url), "utf8");
const cleanup = '    rmSync(path.join(ROOT, ".next"), { recursive: true, force: true });';

function fixture({ skipBuild = false, source = runner } = {}) {
  const work = mkdtempSync(join(tmpdir(), "e2e-build-"));
  const write = (file, body, options) => {
    const target = join(work, file);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, body, options);
  };
  try {
    write("scripts/e2e.mjs", source);
    write("scripts/ghosts-fake.mjs", `
      export async function startGhostsFake() {
        return { url: 'ws://127.0.0.1:8788/ghosts', base: 'http://127.0.0.1:8788',
          async close() { (await import('node:fs')).writeFileSync('fake-closed', 'yes'); } };
      }
    `);
    write(".next/cache/font-map", "stale font import map");
    write(".next/BUILD_ID", "previous build");
    write("node_modules/embedded-postgres/package.json", JSON.stringify({ type: "module", exports: "./index.js" }));
    write("node_modules/embedded-postgres/index.js", `
      export default class Postgres {
        async initialise() {} async start() {} async createDatabase() {} async stop() {}
      }
    `);
    write("bin/npm", `#!/usr/bin/env node
      const { appendFileSync, existsSync, mkdirSync, writeFileSync } = require('node:fs');
      const args = process.argv.slice(2).join(' ');
      appendFileSync('calls.txt', args + '\\n');
      if (args === 'run db:migrate') process.exit(0);
      if (args === 'run build') {
        if (existsSync('.next')) {
          console.error('negative control: stale Next output reached the compiler');
          process.exit(41);
        }
        mkdirSync('.next');
        writeFileSync('.next/BUILD_ID', 'fresh build');
        process.exit(0);
      }
      if (args !== 'start') process.exit(42);
      require('node:http').createServer((req, res) => res.end('healthy fixture'))
        .listen(Number(process.env.PORT));
    `, { mode: 0o755 });
    write("suite.mjs", `
      import assert from 'node:assert/strict';
      import { writeFileSync } from 'node:fs';
      assert.ok(process.env.BASE_URL);
      assert.equal(process.env.GHOSTS_ENDPOINT, 'ws://127.0.0.1:8788/ghosts');
      assert.equal(process.env.GHOSTS_FAKE_BASE, 'http://127.0.0.1:8788');
      writeFileSync('suite-ran', process.env.BASE_URL);
    `);
    // Do not inherit a real remote server, build reuse or CI reporter from the parent.
    const env = { ...process.env, PATH: `${join(work, "bin")}:${dirname(process.execPath)}:${process.env.PATH}`, TMPDIR: work };
    for (const key of ["BASE_URL", "SKIP_BUILD", "GITHUB_ACTIONS", "NODE_OPTIONS", "NODE_TEST_CONTEXT"]) delete env[key];
    if (skipBuild) env.SKIP_BUILD = "1";
    const result = spawnSync(process.execPath, ["scripts/e2e.mjs", "--test", "suite.mjs"], {
      cwd: work, env, encoding: "utf8", timeout: 15_000,
    });
    assert.ifError(result.error);
    return {
      ...result,
      calls: readFileSync(join(work, "calls.txt"), "utf8").trim().split("\n"),
      build: readFileSync(join(work, ".next/BUILD_ID"), "utf8"),
      fakeClosed: existsSync(join(work, "fake-closed")),
      suite: existsSync(join(work, "suite-ran")) ? readFileSync(join(work, "suite-ran"), "utf8") : null,
    };
  } finally { rmSync(work, { recursive: true, force: true }); }
}

test("fresh e2e builds discard stale Next font output before compiling", () => {
  const result = fixture();
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.equal(result.fakeClosed, true);
  assert.deepEqual(result.calls, ["run db:migrate", "run build", "start"]);
  assert.equal(result.build, "fresh build");
  assert.match(result.suite, /^http:\/\/localhost:\d+$/);
});

test("stale-font negative control fails before server or suite when cleanup is removed", () => {
  assert.ok(runner.includes(cleanup), "the mutation must remove the actual cleanup");
  const result = fixture({ source: runner.replace(cleanup, "") });
  assert.equal(result.status, 1, result.stdout + result.stderr);
  assert.equal(result.fakeClosed, true);
  assert.deepEqual(result.calls, ["run db:migrate", "run build"]);
  assert.match(result.stderr, /stale Next output reached the compiler/);
  assert.equal(result.build, "previous build");
  assert.equal(result.suite, null);
});

test("SKIP_BUILD preserves the existing Next build and still executes the suite", () => {
  const result = fixture({ skipBuild: true });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.equal(result.fakeClosed, true);
  assert.deepEqual(result.calls, ["run db:migrate", "start"]);
  assert.equal(result.build, "previous build");
  assert.match(result.suite, /^http:\/\/localhost:\d+$/);
});

test("external BASE_URL requires explicit fake configuration without silently rewriting it", () => {
  const env = { ...process.env, BASE_URL: "https://example.invalid" };
  delete env.GHOSTS_FAKE_BASE; delete env.GHOSTS_ENDPOINT;
  const result = spawnSync(process.execPath, ["--experimental-strip-types", "scripts/e2e.mjs", "--test", "e2e/ghosts.test.ts"], { env, encoding: "utf8", timeout: 10000 });
  assert.equal(result.status, 1); assert.match(result.stderr, /requires explicit GHOSTS_FAKE_BASE and GHOSTS_ENDPOINT/);
  assert.doesNotMatch(result.stdout, /Starting|Building/);
});
