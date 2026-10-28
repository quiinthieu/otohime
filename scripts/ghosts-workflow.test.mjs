// Execute the workflow's real run commands against fixture npm/Wrangler, never Cloudflare.
import assert from "node:assert/strict";
import { execFile, spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { createServer } from "node:http";
import { promisify } from "node:util";
import { agrees, deploy, manifest, versionId } from "./probe-ghosts.mjs";
import { fingerprint } from "../ghosts/worker/scripts/fingerprint.mjs";

const workflow = readFileSync(new URL("../.github/workflows/ghosts.yml", import.meta.url), "utf8");
const ID = "11111111-2222-4333-8444-555555555555";
const SHA = "a".repeat(40);
function body(name) {
  const block = workflow.split(`      - name: ${name}\n`)[1]?.split(/\n      - /)[0];
  assert.ok(block, name);
  const run = block.match(/        run: ([^\n]+)\n?([\s\S]*)/);
  assert.ok(run, name);
  return run[1] === "|" ? run[2].split("\n").filter(l => l.startsWith("          ")).map(l => l.slice(10)).join("\n") : run[1];
}
function runs(event, enabled, ref = "refs/heads/main") {
  const condition = workflow.match(/^    if: (.*)$/m)?.[1];
  assert.equal(condition, "github.ref == 'refs/heads/main' && vars.GHOSTS_DEPLOY_ENABLED == 'true'");
  return ["push", "workflow_dispatch"].includes(event) && ref === "refs/heads/main" && enabled === "true";
}
function fixture({ enabled = "true", secrets = true, event = "push", failAt = "", malformed = false } = {}) {
  const work = mkdtempSync(join(tmpdir(), "ghost-workflow-"));
  const write = (file, source, options) => { const path = join(work, file); mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, source, options); };
  try {
    cpSync(new URL("../ghosts/worker", import.meta.url), join(work, "ghosts/worker"), { recursive: true,
      filter: p => !/[/\\](node_modules|\.wrangler|dist)([/\\]|$)/.test(p) });
    for (const file of ["protocol.ts", "policy.ts", "room.ts"]) cpSync(new URL(`../ghosts/${file}`, import.meta.url), join(work, "ghosts", file));
    mkdirSync(join(work, "scripts"));
    cpSync(new URL("./probe-ghosts.mjs", import.meta.url), join(work, "scripts/probe-ghosts.mjs"), { recursive: false, force: true });
    write("bin/npm", `#!/usr/bin/env node
      const { appendFileSync } = require('node:fs');
      const args = process.argv.slice(2).join(' ');
      appendFileSync(process.env.RUNNER_TEMP + '/calls', args + '\\n');
      if (args === process.env.FIXTURE_FAIL_AT) process.exit(23);
    `, { mode: 0o755 });
    write("ghosts/worker/node_modules/.bin/wrangler", `#!/usr/bin/env node
      const { appendFileSync } = require('node:fs');
      appendFileSync(process.env.RUNNER_TEMP + '/calls', JSON.stringify(process.argv.slice(2)) + '\\n');
      // A CLI regression printing credentials must still never leak through the public wrapper.
      console.log(process.env.CLOUDFLARE_API_TOKEN); console.error(process.env.CLOUDFLARE_ACCOUNT_ID);
      console.log(process.env.FIXTURE_MALFORMED === '1' ? 'Uploaded without version' : 'Current Version ID: ${ID}');
    `, { mode: 0o755 });
    write("summary.md", "");
    const env = { ...process.env, PATH: `${join(work, "bin")}:${dirname(process.execPath)}:${process.env.PATH}`,
      RUNNER_TEMP: work, GITHUB_STEP_SUMMARY: join(work, "summary.md"), GHOSTS_DEPLOY_ENABLED: enabled,
      GITHUB_REF: "refs/heads/main", GITHUB_SHA: SHA, GITHUB_RUN_ID: "123", FIXTURE_FAIL_AT: failAt, FIXTURE_MALFORMED: malformed ? "1" : "0" };
    delete env.CLOUDFLARE_API_TOKEN; delete env.CLOUDFLARE_ACCOUNT_ID;
    if (secrets) { env.CLOUDFLARE_API_TOKEN = "synthetic-do-not-print"; env.CLOUDFLARE_ACCOUNT_ID = "synthetic-do-not-print"; }
    const command = runs(event, enabled) ? [body("Locked Worker verification"), body("Deploy and write public build identity"), body("Summarize public build identity")].join("\n") : ":";
    const result = spawnSync("bash", ["-eo", "pipefail", "-c", command], { cwd: join(work, "ghosts/worker"), env, encoding: "utf8", timeout: 10000 });
    assert.ifError(result.error);
    const read = path => { try { return readFileSync(join(work, path), "utf8"); } catch { return ""; } };
    assert.doesNotMatch(result.stdout + result.stderr + read("summary.md"), /synthetic-do-not-print/);
    return { ...result, calls: read("calls"), artifact: read("ghosts-build.json"), summary: read("summary.md") };
  } finally { rmSync(work, { recursive: true, force: true }); }
}

test("dispatch and main pushes use one dark, serialized, least-privilege job; fork PRs have no trigger/token", () => {
  assert.match(workflow, /workflow_dispatch:/); assert.match(workflow, /branches: \[main\]/);
  assert.doesNotMatch(workflow, /pull_request|pull_request_target|write-all/);
  assert.equal((workflow.match(/^  deploy:/gm) ?? []).length, 1);
  assert.match(workflow, /permissions:\n  contents: read/);
  assert.match(workflow, /group: otohime-ghosts-deploy\n      cancel-in-progress: false/);
  assert.equal(runs("workflow_dispatch", "true"), runs("push", "true"));
  assert.equal(runs("pull_request", "true"), false); assert.equal(runs("workflow_dispatch", "true", "refs/heads/feature"), false);
  const verification = body("Locked Worker verification");
  assert.equal(verification, "npm ci\nnpm run typecheck\nnpm run test:local\nnpm run bundle:check");
  assert.match(workflow, /cache-dependency-path: ghosts\/worker\/package-lock\.json/);
  assert.match(workflow, /working-directory: ghosts\/worker/);
  assert.match(workflow, /actions\/upload-artifact@v6[\s\S]*?ghosts-build\.json[\s\S]*?if-no-files-found: error/);
  assert.equal((workflow.match(/secrets\.CLOUDFLARE_API_TOKEN/g) ?? []).length, 1);
});

test("shared protocol/policy/room, Worker source/lock/config, scripts and workflow trigger deployment", () => {
  const paths = [...workflow.matchAll(/^      - "([^"]+)"$/gm)].map(m => m[1]);
  const matches = file => paths.some(p => new RegExp("^" + p.replaceAll(".", "\\.").replaceAll("**", ".*") + "$").test(file));
  for (const file of ["ghosts/protocol.ts", "ghosts/policy.ts", "ghosts/room.ts", "ghosts/worker/src/version.ts", "ghosts/worker/package-lock.json", "ghosts/worker/wrangler.jsonc", ".github/workflows/ghosts.yml", "scripts/probe-ghosts.mjs"]) assert.equal(matches(file), true, file);
  assert.equal(matches("app/page.tsx"), false);
});

test("disabled/unset configurations execute nothing and need no secrets", () => {
  for (const enabled of ["", "false", "TRUE"]) {
    const r = fixture({ enabled, secrets: false }); assert.equal(r.status, 0); assert.equal(r.calls, ""); assert.equal(r.artifact, "");
  }
  let calls = 0; assert.deepEqual(deploy({ env: {}, run: () => calls++ }), { disabled: true }); assert.equal(calls, 0);
});

test("enabled with missing secrets fails by name without deploying", () => {
  const r = fixture({ secrets: false }); assert.notEqual(r.status, 0); assert.match(r.stderr, /missing required secret CLOUDFLARE_API_TOKEN/);
  assert.doesNotMatch(r.calls, /deploy/); assert.equal(r.artifact, "");
  assert.throws(() => deploy({ env: { GHOSTS_DEPLOY_ENABLED: "true", CLOUDFLARE_API_TOKEN: "synthetic" }, run: () => assert.fail("must not deploy") }), /CLOUDFLARE_ACCOUNT_ID/);
});

test("real workflow commands verify before deploy; dispatch and push publish the same exact public manifest", () => {
  const push = fixture(), dispatch = fixture({ event: "workflow_dispatch" });
  for (const r of [push, dispatch]) {
    assert.equal(r.status, 0, r.stderr);
    const calls = r.calls.trim().split("\n"); assert.deepEqual(calls.slice(0, 4), ["ci", "run typecheck", "run test:local", "run bundle:check"]);
    const build = JSON.parse(r.artifact), args = JSON.parse(calls[4]);
    assert.deepEqual(args, ["deploy", "--define", `__GHOSTS_FINGERPRINT__:${JSON.stringify(build.fingerprint)}`]);
    assert.equal(build.workerVersionId, ID); assert.equal(build.workerSourceSha, SHA); assert.equal(build.workflowRunId, "123");
    assert.match(build.fingerprint, /^[0-9a-f]{64}$/); assert.ok(build.files["../room.ts"]); assert.ok(build.files["package-lock.json"]);
    assert.ok(r.summary.includes(r.artifact.trim())); assert.equal(build.appSha, undefined); assert.equal(build.nextBuildId, undefined);
    agrees(build, { service: build.service, fingerprint: build.fingerprint, workerVersionId: ID });
    assert.throws(() => agrees(build, { ...build, fingerprint: "b".repeat(64) }), /configuration mismatch/);
    assert.throws(() => agrees(build, { ...build, workerVersionId: "22222222-2222-4333-8444-555555555555" }), /version mismatch/);
  }
  assert.equal(push.artifact, dispatch.artifact);
});

test("failed verification or absent version output cannot publish a successful build", () => {
  const failed = fixture({ failAt: "run test:local" }); assert.equal(failed.status, 23); assert.doesNotMatch(failed.calls, /deploy/); assert.equal(failed.artifact, "");
  const malformed = fixture({ malformed: true }); assert.notEqual(malformed.status, 0); assert.equal(malformed.artifact, "");
  assert.throws(() => versionId(`Current Version ID: ${ID}\nCurrent Version ID: ${ID}`), /exactly one/);
  assert.throws(() => manifest({ build: fingerprint(), workerVersionId: "unknown", sourceSha: SHA, workflowRunId: "1" }));
});

test("read-only identity probe uses independent app build metadata and rejects stale Worker/app identities", async () => {
  const work = mkdtempSync(join(tmpdir(), "ghost-probe-"));
  const build = manifest({ build: fingerprint(), workerVersionId: ID, sourceSha: SHA, workflowRunId: "7" });
  let mismatch = false;
  const seen = [];
  const server = createServer((req, res) => {
    seen.push([req.method, req.url]); res.setHeader("content-type", "application/json");
    res.end(JSON.stringify(req.url === "/version" ? { service: build.service, fingerprint: mismatch ? "b".repeat(64) : build.fingerprint, workerVersionId: ID }
      : { ok: true, sha: "c".repeat(40) }));
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  try {
    const url = `http://127.0.0.1:${server.address().port}`;
    writeFileSync(join(work, "worker.json"), JSON.stringify(build));
    writeFileSync(join(work, "app.json"), JSON.stringify({ appSha: "c".repeat(40), nextBuildId: "independent-next-id" }));
    const args = ["scripts/probe-ghosts.mjs", "--app", url, "--worker", url, "--manifest", join(work, "worker.json"), "--app-build", join(work, "app.json")];
    const run = () => promisify(execFile)(process.execPath, args, { timeout: 10000 });
    const output = JSON.parse((await run()).stdout);
    assert.equal(output.appSha, "c".repeat(40)); assert.equal(output.nextBuildId, "independent-next-id"); assert.equal(output.worker.workerVersionId, ID);
    mismatch = true; await assert.rejects(run(), /Worker code\/lock\/configuration mismatch/);
    mismatch = false; writeFileSync(join(work, "app.json"), JSON.stringify({ appSha: SHA, nextBuildId: "wrong-app-build" }));
    await assert.rejects(run(), /application build SHA mismatch/);
    assert.ok(seen.every(([method, path]) => method === "GET" && ["/version", "/api/health"].includes(path)), "never upgrades or mutates the remote system");
  } finally { await new Promise(resolve => server.close(resolve)); rmSync(work, { recursive: true, force: true }); }
});

test("invalid build identity prevents deployment before any external mutation", () => {
  let calls = 0;
  assert.throws(() => deploy({ env: { GHOSTS_DEPLOY_ENABLED: "true", CLOUDFLARE_API_TOKEN: "synthetic", CLOUDFLARE_ACCOUNT_ID: "synthetic", GITHUB_REF: "refs/heads/main", GITHUB_RUN_ID: "1" },
    run: () => { calls++; return { status: 0, stdout: `Current Version ID: ${ID}` }; } }));
  assert.equal(calls, 0, "invalid source SHA must fail preflight");
});
