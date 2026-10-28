import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { classifyActivation } from "./lib/ghosts-activation.mjs";

const ID = "11111111-2222-4333-8444-555555555555";
const SHA = "a".repeat(40), APP = "b".repeat(40);
function ready() {
  const files = { "../policy.ts": "1".repeat(64), "../protocol.ts": "2".repeat(64), "../room.ts": "3".repeat(64),
    "package.json": "4".repeat(64), "package-lock.json": "5".repeat(64), "src/index.ts": "6".repeat(64), "wrangler.jsonc": "7".repeat(64) };
  const fingerprint = createHash("sha256");
  for (const path of Object.keys(files).sort()) fingerprint.update(`${path}\0${files[path]}\0`);
  const build = { fingerprint: fingerprint.digest("hex"), files };
  return { configuration: { deployEnabled: true }, appOrigin: "https://otohime.dev", workerOrigin: "https://ghosts.workers.dev",
    expectedWorker: structuredClone(build),
    manifest: { ...build, schema: "otohime.ghosts-build.v1", service: "otohime-ghosts", workerVersionId: ID, workerSourceSha: SHA, workflowRunId: "7" },
    appBuild: { appSha: APP, nextBuildId: "separate-next-build-id" },
    workflow: { runId: "7", headSha: SHA, workflowPath: ".github/workflows/ghosts.yml", ref: "refs/heads/main", status: "completed", conclusion: "success" },
    history: { complete: true, pagesRead: 1, records: [{ runId: "7", headSha: SHA, fingerprint: build.fingerprint, status: "completed", conclusion: "success" }] },
    http: { config: { status: 200, body: { endpoint: "wss://ghosts.workers.dev/ghosts", rooms: ["/", "/ryugu"] } },
      version: { status: 200, body: { service: "otohime-ghosts", fingerprint: build.fingerprint, workerVersionId: ID } },
      health: { status: 200, body: { ok: true, sha: APP } } } };
}
const state = (input, expected, reason) => {
  const before = structuredClone(input), result = classifyActivation(input);
  assert.equal(result.state, expected);
  if (reason) assert.ok(result.reasons.includes(reason), JSON.stringify(result));
  assert.equal(result.liveExecution, "UNPROVEN"); assert.equal(result.productDelivered, false);
  assert.deepEqual(input, before, "classifier must not mutate injected evidence");
  return result;
};

test("matched Worker code/lock/config, workflow and separate app build are ready only for live QA", () => {
  state(ready(), "ready-for-live-QA");
});
test("explicit off differs from inaccessible or unset configuration; deployment switch alone is not feature off", () => {
  state({ configuration: { disabled: true } }, "disabled");
  state({ http: { config: { status: 200, body: null } } }, "disabled");
  state({}, "missing-configuration");
  const e = ready(); e.configuration.deployEnabled = false;
  state(e, "ready-for-live-QA");
  for (const status of [0, 403, 404, 500]) { const e = ready(); e.http.config = { status }; state(e, "missing-configuration"); }
});
test("a configuration 200 alone, pending workflow, missing build, or incomplete history is inconclusive", () => {
  for (const key of ["manifest", "appBuild", "expectedWorker", "workflow", "history"]) {
    const e = ready(); delete e[key]; state(e, "missing-configuration");
  }
  for (const change of [e => { e.workflow.status = "in_progress"; e.workflow.conclusion = null; },
    e => { e.history.complete = false; }, e => { e.history.records = []; },
    e => { e.http.version.status = 503; }, e => { e.http.health.status = 503; },
    e => { delete e.appBuild.nextBuildId; }]) {
    const e = ready(); change(e); state(e, "missing-configuration");
  }
});
test("unrelated newer SHA, wrong workflow id, serving version, endpoint, file hashes and app build fail identity checks", () => {
  for (const change of [e => { e.workflow.headSha = APP; }, e => { e.workflow.runId = "8"; },
    e => { e.workflow.workflowPath = ".github/workflows/ci.yml"; }, e => { e.workflow.ref = "refs/heads/other"; },
    e => { e.http.version.body.workerVersionId = "22222222-2222-4333-8444-555555555555"; },
    e => { e.http.version.body.fingerprint = "f".repeat(64); },
    e => { e.http.version.body.service = "another-worker"; },
    e => { e.http.health.body.sha = SHA; }, e => { e.appBuild.appSha = SHA; },
    e => { e.manifest.files["package-lock.json"] = "f".repeat(64); },
    e => { e.expectedWorker.files["wrangler.jsonc"] = "f".repeat(64); },
    e => { e.manifest.schema = "unknown"; }, e => { e.manifest.workerVersionId = "unavailable"; },
    e => { e.http.config.body.rooms = ["/"]; },
    e => { e.http.config.body.endpoint = "wss://wrong.workers.dev/ghosts"; },
    e => { e.http.config.body.endpoint = "wss://user:secret@ghosts.workers.dev/ghosts"; },
    e => { e.http.config.body.endpoint = "wss://ghosts.workers.dev/ghosts?token=secret"; },
    e => { e.workerOrigin = e.appOrigin; }]) {
    const e = ready(); change(e); state(e, "identity-mismatch");
  }
});
test("failed deployment stays a defect beside a pending or successful replacement with the same fingerprint", () => {
  for (const conclusion of ["failure", "cancelled", "timed_out", "action_required"]) {
    const e = ready(); e.workflow.conclusion = conclusion; state(e, "failed-deployment");
  }
  const e = ready(); e.history.records.unshift({ runId: "6", headSha: SHA, fingerprint: e.expectedWorker.fingerprint,
    status: "completed", conclusion: "failure", failureTailRead: true });
  state(e, "failed-deployment", "relevant-deployment-failed");
  e.workflow.status = "queued"; e.workflow.conclusion = null; state(e, "failed-deployment");
  e.configuration.disabled = true; state(e, "failed-deployment", "relevant-deployment-failed");
});
test("history requires reviewed tails, correlates by executable, and exposes counts without raw evidence", () => {
  const e = ready(); e.history.records.unshift({ runId: "4", headSha: "c".repeat(40), fingerprint: "d".repeat(64),
    status: "completed", conclusion: "failure", failureTailRead: true, rawTail: "do-not-publish" });
  const result = state(e, "ready-for-live-QA");
  assert.deepEqual(result.history, { complete: true, pagesRead: 1, failed: 1, completed: 2, current: 0, recordsRead: 2 });
  assert.doesNotMatch(JSON.stringify(result), /do-not-publish/);
  e.history.records[0].failureTailRead = false; state(e, "missing-configuration", "history-incomplete");
  e.history.records[0].failureTailRead = true; delete e.history.records[0].fingerprint;
  state(e, "missing-configuration", "history-incomplete");
  const truncated = ready(); truncated.history.hasMore = true;
  state(truncated, "missing-configuration", "history-incomplete");
});
test("malformed and unknown observations fail closed without echoing raw metadata or credentials", () => {
  for (const input of [null, [], { manifest: "secret" }, { http: { config: { status: 200, body: "secret" } } }]) {
    const result = state(input, "missing-configuration"); assert.doesNotMatch(JSON.stringify(result), /secret/);
  }
});
test("CLI default and --fixture prove all classifications with zero credentials; mutation flags fail closed", () => {
  for (const args of [[], ["--fixture"]]) {
    const run = spawnSync(process.execPath, ["scripts/probe-ghosts-activation.mjs", ...args], { encoding: "utf8", timeout: 10000,
      env: { ...process.env, CLOUDFLARE_API_TOKEN: "synthetic-do-not-print", GHOSTS_ENDPOINT: "synthetic-do-not-print" } });
    assert.equal(run.status, 0, run.stderr); const output = JSON.parse(run.stdout);
    assert.equal(output.mode, "fixture"); assert.equal(output.liveExecution, "UNPROVEN");
    assert.equal(output.checks.length, 5); assert.ok(output.checks.every(c => c.pass));
    assert.doesNotMatch(run.stdout + run.stderr, /synthetic-do-not-print/);
  }
  for (const args of [["--deploy"], ["--fixture", "--live"], ["--live"]]) {
    const run = spawnSync(process.execPath, ["scripts/probe-ghosts-activation.mjs", ...args], { encoding: "utf8", timeout: 10000 });
    assert.equal(run.status, 1); assert.match(run.stderr, /usage:/);
  }
});
test("read-only adapter requests only fixed GET paths and returns no raw bodies", async () => {
  const { probeActivation } = await import("./probe-ghosts-activation.mjs");
  const evidence = ready(), responses = evidence.http, seen = [];
  const fetchImpl = async (url, options) => {
    seen.push([String(url), options]);
    const key = new URL(url).pathname === "/version" ? "version" : new URL(url).pathname === "/api/health" ? "health" : "config";
    return Response.json(responses[key].body);
  };
  delete evidence.http;
  const result = await probeActivation(evidence, { fetchImpl });
  assert.equal(result.state, "ready-for-live-QA"); assert.equal(result.liveExecution, "UNPROVEN");
  assert.deepEqual(seen.map(([url]) => url).sort(), ["https://ghosts.workers.dev/version", "https://otohime.dev/api/ghosts?probe=1", "https://otohime.dev/api/health"]);
  for (const [, options] of seen) {
    assert.equal(options.method, "GET"); assert.equal(options.redirect, "error"); assert.equal(options.credentials, "omit");
    assert.equal(options.headers, undefined); assert.ok(options.signal instanceof AbortSignal);
  }
  for (const appOrigin of ["https://user:secret@otohime.dev", "https://otohime.dev?secret=x", "https://otohime.dev/path", "http://otohime.dev"]) {
    await assert.rejects(probeActivation({ ...evidence, appOrigin }, { fetchImpl }), /public HTTPS origin/);
  }
  const offline = await probeActivation(evidence, { fetchImpl: async () => { throw new Error("credential-secret"); } });
  assert.equal(offline.state, "missing-configuration"); assert.doesNotMatch(JSON.stringify(offline), /credential-secret/);
  for (const response of [() => new Response("not JSON"), () => new Response("x".repeat(65537)),
    () => new Response(null, { status: 403 })]) {
    assert.equal((await probeActivation(evidence, { fetchImpl: async () => response() })).state, "missing-configuration");
  }
  responses.version.body.fingerprint = "f".repeat(64);
  assert.equal((await probeActivation(evidence, { fetchImpl })).state, "identity-mismatch", "read-only negative control");
});
