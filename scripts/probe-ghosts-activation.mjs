// Credential-free fixtures by default. Live GETs belong to QA/acceptance only.
// Deliberately does not import probe-ghosts.mjs, which also contains deployment.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { fingerprint } from "../ghosts/worker/scripts/fingerprint.mjs";
import { classifyActivation, publicOrigin } from "./lib/ghosts-activation.mjs";

export async function probeActivation(evidence, { fetchImpl = fetch } = {}) {
  // Validate every target before making the first request. Do not discover or
  // follow an endpoint from the remote config body, or forward credentials.
  const app = publicOrigin(evidence.appOrigin), worker = publicOrigin(evidence.workerOrigin);
  if (app === worker) throw new Error("expected dedicated public HTTPS origin");
  const json = async url => {
    try {
      const response = await fetchImpl(url, { method: "GET", redirect: "error", credentials: "omit",
        signal: AbortSignal.timeout(10000) });
      if (response.status !== 200) return { status: response.status };
      // Bound reads and never return or print arbitrary raw response bodies.
      const reader = response.body.getReader(), chunks = [];
      let bytes = 0;
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          bytes += value.byteLength;
          if (bytes > 65536) { await reader.cancel(); return { status: 0 }; }
          chunks.push(value);
        }
      } finally { reader.releaseLock(); }
      return { status: 200, body: JSON.parse(Buffer.concat(chunks).toString("utf8")) };
    } catch { return { status: 0 }; }
  };
  const [config, version, health] = await Promise.all([
    json(`${app}/api/ghosts?probe=1`), json(`${worker}/version`), json(`${app}/api/health`),
  ]);
  return classifyActivation({ ...evidence, http: { config, version, health } });
}

export function fixtureEvidence() {
  const build = fingerprint(), workerSourceSha = "a".repeat(40), appSha = "b".repeat(40);
  const workerVersionId = "11111111-2222-4333-8444-555555555555";
  return { appOrigin: "https://otohime.dev", workerOrigin: "https://fixture.workers.dev", expectedWorker: build,
    manifest: { ...structuredClone(build), schema: "otohime.ghosts-build.v1", service: "otohime-ghosts",
      workerSourceSha, workerVersionId, workflowRunId: "1" },
    appBuild: { appSha, nextBuildId: "fixture-only-next-build" },
    workflow: { runId: "1", headSha: workerSourceSha, workflowPath: ".github/workflows/ghosts.yml", ref: "refs/heads/main", status: "completed", conclusion: "success" },
    history: { complete: true, pagesRead: 1, records: [{ runId: "1", headSha: workerSourceSha, fingerprint: build.fingerprint, status: "completed", conclusion: "success" }] },
    http: { config: { status: 200, body: { endpoint: "wss://fixture.workers.dev/ghosts", rooms: ["/", "/ryugu"] } },
      version: { status: 200, body: { service: "otohime-ghosts", fingerprint: build.fingerprint, workerVersionId } },
      health: { status: 200, body: { ok: true, sha: appSha } } } };
}
function fixtures() {
  const cases = [
    ["disabled", e => { e.configuration = { disabled: true }; }],
    ["missing-configuration", e => { delete e.manifest; }],
    ["failed-deployment", e => { e.workflow.conclusion = "failure"; }],
    ["identity-mismatch", e => { e.http.version.body.fingerprint = "f".repeat(64); }],
    ["ready-for-live-QA", () => {}],
  ];
  const checks = cases.map(([expected, change]) => {
    const e = fixtureEvidence(); change(e);
    const result = classifyActivation(e); assert.equal(result.state, expected);
    return { state: result.state, pass: true };
  });
  return { mode: "fixture", checks, liveExecution: "UNPROVEN", productDelivered: false };
}
async function main(args) {
  const usage = "usage: probe-ghosts-activation.mjs [--fixture | --live --evidence public-metadata.json]";
  if (args.length === 0 || args.length === 1 && args[0] === "--fixture") return fixtures();
  if (args.length !== 3 || args[0] !== "--live" || args[1] !== "--evidence" || args[2].startsWith("--")) throw new Error(usage);
  let evidence;
  try { evidence = JSON.parse(readFileSync(args[2], "utf8")); } catch { throw new Error("invalid public evidence file"); }
  const result = await probeActivation({ ...evidence, expectedWorker: fingerprint() });
  if (result.state !== "ready-for-live-QA") process.exitCode = 1;
  return { mode: "live-read-only", ...result };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { console.log(JSON.stringify(await main(process.argv.slice(2)), null, 2)); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
