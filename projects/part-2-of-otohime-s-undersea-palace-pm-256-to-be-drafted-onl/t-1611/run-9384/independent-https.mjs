// QA-only synthetic HTTPS services; the shipped probe uses its real default fetch.
// Generate a localhost test certificate outside git, then run with
// NODE_EXTRA_CA_CERTS=<cert.pem> node this-file.mjs <delivery-checkout> <tls-dir>.
import assert from "node:assert/strict";
import { createServer } from "node:https";
import { readFileSync } from "node:fs";
import { once } from "node:events";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const [checkout, tlsDir] = process.argv.slice(2);
assert.ok(checkout && tlsDir, "delivery checkout and test TLS directory required");
const load = path => import(pathToFileURL(resolve(checkout, path)).href);
const { probeActivation } = await load("scripts/probe-ghosts-activation.mjs");
const { fingerprint } = await load("ghosts/worker/scripts/fingerprint.mjs");
const { manifest } = await load("scripts/probe-ghosts.mjs");
const build = fingerprint();
const sha = "4a1c8487fe46c254a92dad2b7f2699b5410023f9";
const versionId = "12345678-1234-4234-8234-123456789abc";
const tls = { key: readFileSync(resolve(tlsDir, "key.pem")), cert: readFileSync(resolve(tlsDir, "cert.pem")) };
const seen = [], checks = [];
let mode = "ready", workerOrigin;
function handler(request, response) {
  seen.push({ method: request.method, path: request.url, cookie: !!request.headers.cookie, authorization: !!request.headers.authorization });
  if (mode === "redirect" && request.url === "/version") {
    response.writeHead(302, { Location: `${workerOrigin}/must-not-follow` }); response.end(); return;
  }
  const body = request.url === "/version"
    ? { service: "otohime-ghosts", fingerprint: build.fingerprint, workerVersionId: mode === "mismatch" ? "87654321-1234-4234-8234-123456789abc" : versionId }
    : request.url === "/api/health" ? { ok: true, sha }
      : { endpoint: `wss://${new URL(workerOrigin).host}/ghosts`, rooms: ["/", "/ryugu"] };
  response.writeHead(200, { "Content-Type": "application/json" });
  response.end(mode === "oversized" ? "x".repeat(65537) : JSON.stringify(body));
}
const app = createServer(tls, handler), worker = createServer(tls, handler);
await Promise.all([new Promise(resolve => app.listen(0, resolve)), new Promise(resolve => worker.listen(0, resolve))]);
const appOrigin = `https://localhost:${app.address().port}`;
workerOrigin = `https://localhost:${worker.address().port}`;
const evidence = {
  appOrigin, workerOrigin, expectedWorker: build,
  manifest: manifest({ build, workerVersionId: versionId, sourceSha: sha, workflowRunId: "9384" }),
  appBuild: { appSha: sha, nextBuildId: "synthetic-build-not-production" },
  workflow: { runId: "9384", headSha: sha, workflowPath: ".github/workflows/ghosts.yml", ref: "refs/heads/main", status: "completed", conclusion: "success" },
  history: { complete: true, pagesRead: 1, records: [{ runId: "9384", headSha: sha, fingerprint: build.fingerprint, status: "completed", conclusion: "success" }] },
};
async function check(name, expected, input = evidence) {
  const result = await probeActivation(input); // No injected fetch/Response.
  assert.equal(result.state, expected, name);
  assert.equal(result.liveExecution, "UNPROVEN"); assert.equal(result.productDelivered, false);
  checks.push({ name, state: result.state, history: result.history });
}
try {
  await check("real TLS/default fetch positive control", "ready-for-live-QA");
  mode = "mismatch";
  await check("wrong serving Worker version", "identity-mismatch");
  mode = "ready";
  const failed = structuredClone(evidence);
  for (const id of ["9380", "9381"]) failed.history.records.push({ runId: id, headSha: "c".repeat(40), fingerprint: build.fingerprint,
    status: "completed", conclusion: "failure", failureTailRead: true });
  failed.workflow.status = "queued"; failed.workflow.conclusion = null;
  await check("two same-executable failures survive a pending newer SHA", "failed-deployment", failed);
  const unread = structuredClone(evidence);
  unread.history.records.push({ runId: "9379", headSha: "d".repeat(40), fingerprint: "e".repeat(64), status: "completed", conclusion: "failure", failureTailRead: false });
  await check("unread unrelated failure tail stays inconclusive", "missing-configuration", unread);
  mode = "redirect";
  await check("redirect is refused", "missing-configuration");
  mode = "oversized";
  await check("oversized wire response is refused", "missing-configuration");
  assert.equal(seen.length, 18);
  assert.ok(seen.every(r => r.method === "GET" && !r.cookie && !r.authorization));
  assert.ok(seen.every(r => ["/api/ghosts?probe=1", "/api/health", "/version"].includes(r.path)));
  console.log(JSON.stringify({ boundary: "Real shipped imports, HTTPS, default fetch and parser; synthetic metadata, no Cloudflare/DO/browser proof", fingerprint: build.fingerprint, checks, requests: seen.length }, null, 2));
} finally {
  const closed = [once(app, "close"), once(worker, "close")];
  app.close(); worker.close(); app.closeAllConnections(); worker.closeAllConnections();
  await Promise.all(closed);
}
