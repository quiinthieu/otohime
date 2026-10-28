/**
 * Read-only activation evidence interface. No I/O, environment or deploy adapter.
 * Input: { configuration, appOrigin, workerOrigin, expectedWorker, manifest,
 * appBuild, workflow, history, http: { config, version, health } }.
 * HTTP observations are {status, body}; history is bounded injected metadata,
 * with complete/pagesRead and records including failureTailRead for failures.
 * Output: {state, reasons, liveExecution:'UNPROVEN', productDelivered:false}.
 * A ready-for-live-QA result proves identities only, never live fan-out.
 */
import { createHash } from "node:crypto";

const HASH = /^[a-f0-9]{64}$/;
const SHA = /^[a-f0-9]{40}$/;
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const RUN = /^\d+$/;
const BUILD = /^[a-zA-Z0-9_.-]{1,128}$/;
const failures = new Set(["failure", "cancelled", "timed_out", "action_required", "startup_failure", "stale"]);
const object = value => value !== null && typeof value === "object" && !Array.isArray(value);
const valid = (value, pattern) => typeof value === "string" && pattern.test(value);
const publicValue = (value, pattern) => valid(value, pattern) ? value : null;

/** A fixed origin, never a credential-bearing URL or a caller-chosen path. */
export function publicOrigin(value) {
  let url;
  try { url = new URL(value); } catch { throw new Error("expected public HTTPS origin"); }
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash || url.pathname !== "/"
    || value !== url.origin) throw new Error("expected public HTTPS origin");
  return url.origin;
}
function buildHash(build) {
  if (!object(build?.files)) return null;
  const paths = Object.keys(build.files).sort();
  if (!["package.json", "package-lock.json", "wrangler.jsonc", "../protocol.ts", "../policy.ts", "../room.ts"].every(p => paths.includes(p))
    || !paths.some(p => /^src\/.+\.ts$/.test(p)) || !Object.values(build.files).every(h => valid(h, HASH))) return null;
  const hash = createHash("sha256");
  for (const path of paths) hash.update(`${path}\0${build.files[path]}\0`);
  return hash.digest("hex");
}

export function classifyActivation(input) {
  const e = object(input) ? input : {};
  const { manifest: m, appBuild: a, workflow: w, expectedWorker: expected } = e;
  const records = Array.isArray(e.history?.records) ? e.history.records : [];
  const failed = records.filter(r => failures.has(r?.conclusion));
  const complete = e.history?.complete === true && e.history?.hasMore !== true && Number.isInteger(e.history?.pagesRead)
    && e.history.pagesRead > 0 && records.length > 0 && records.every(r => object(r) && valid(r.runId, RUN)
      && valid(r.headSha, SHA) && valid(r.fingerprint, HASH) && ["completed", "queued", "in_progress"].includes(r.status)
      && (r.status !== "completed" || r.conclusion === "success" || r.conclusion === "skipped" || failures.has(r.conclusion)))
    && failed.every(r => r.failureTailRead === true && r.failureTailTruncated !== true);
  const history = { complete, pagesRead: Number.isInteger(e.history?.pagesRead) ? e.history.pagesRead : 0,
    failed: failed.length, completed: records.filter(r => r?.status === "completed").length,
    current: records.filter(r => ["queued", "in_progress"].includes(r?.status)).length, recordsRead: records.length };
  const finish = (state, ...reasons) => ({ state, reasons, liveExecution: "UNPROVEN", productDelivered: false,
    history, identities: {
      workflowRunId: publicValue(m?.workflowRunId, RUN), workerSourceSha: publicValue(m?.workerSourceSha, SHA),
      workerVersionId: publicValue(m?.workerVersionId, UUID), workerFingerprint: publicValue(m?.fingerprint, HASH),
      workerLockHash: publicValue(m?.files?.["package-lock.json"], HASH), workerConfigHash: publicValue(m?.files?.["wrangler.jsonc"], HASH),
      appSha: publicValue(a?.appSha, SHA), nextBuildId: publicValue(a?.nextBuildId, BUILD),
      durableObjectDeployment: null,
    } });
  const relevant = r => r?.fingerprint === expected?.fingerprint && valid(r?.fingerprint, HASH)
    || r?.fingerprint === m?.fingerprint && valid(r?.fingerprint, HASH)
    || r?.headSha === m?.workerSourceSha && valid(r?.headSha, SHA);
  // A known defect remains visible beside a pending replacement or an off switch.
  if (failures.has(w?.conclusion) || failed.some(relevant)) return finish("failed-deployment", "relevant-deployment-failed");
  if (e.configuration?.disabled === true || e.http?.config?.status === 200 && e.http.config.body === null) {
    return finish("disabled", "explicitly-disabled");
  }
  const config = e.http?.config, version = e.http?.version, health = e.http?.health;
  if (![config, version, health].every(h => h?.status === 200 && object(h.body))
    || !object(m) || !object(a) || !object(expected) || !object(w) || !a.nextBuildId) {
    return finish("missing-configuration", "required-evidence-unavailable");
  }
  if (!["completed", "queued", "in_progress"].includes(w.status)
    || w.status !== "completed" || w.conclusion === "skipped" || records.some(r => relevant(r) && r.status !== "completed")) {
    return finish("missing-configuration", "deployment-pending-or-skipped");
  }
  let endpoint;
  try {
    const app = publicOrigin(e.appOrigin), worker = publicOrigin(e.workerOrigin);
    if (app === worker) return finish("identity-mismatch", "dedicated-worker-required");
    endpoint = `wss://${new URL(worker).host}/ghosts`;
  } catch { return finish("identity-mismatch", "invalid-public-origin"); }
  if (m.schema !== "otohime.ghosts-build.v1" || m.service !== "otohime-ghosts" || version.body.service !== m.service
    || !valid(m.workerVersionId, UUID) || m.workerVersionId !== version.body.workerVersionId
    || !valid(m.workerSourceSha, SHA) || m.workerSourceSha !== w.headSha
    || !valid(m.workflowRunId, RUN) || m.workflowRunId !== w.runId || w.conclusion !== "success"
    || w.workflowPath !== ".github/workflows/ghosts.yml" || w.ref !== "refs/heads/main"
    || !valid(m.fingerprint, HASH) || m.fingerprint !== version.body.fingerprint || m.fingerprint !== expected.fingerprint
    || buildHash(m) !== m.fingerprint || buildHash(expected) !== expected.fingerprint
    || !valid(a.appSha, SHA) || a.appSha !== health.body.sha || health.body.ok !== true || !valid(a.nextBuildId, BUILD)
    || config.body.endpoint !== endpoint || JSON.stringify(config.body.rooms) !== JSON.stringify(["/", "/ryugu"])) {
    return finish("identity-mismatch", "executable-or-configuration-mismatch");
  }
  if (!complete || !records.some(r => r.runId === w.runId && r.headSha === m.workerSourceSha
    && r.fingerprint === m.fingerprint && r.status === "completed" && r.conclusion === "success")) {
    return finish("missing-configuration", "history-incomplete");
  }
  return finish("ready-for-live-QA", "public-identities-agree-live-QA-required");
}
