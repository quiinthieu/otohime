// Public deployment identity contract. Default is a credential-free fixture;
// --app/--worker is read-only; --deploy is used only by the explicitly enabled workflow.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { fingerprint, PACKAGE_DIR } from "../ghosts/worker/scripts/fingerprint.mjs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const HASH = /^[0-9a-f]{64}$/;
export function versionId(output) {
  const matches = [...output.matchAll(/^Current Version ID:\s*([0-9a-f-]+)\s*$/gm)];
  assert.equal(matches.length, 1, "deploy must report exactly one Current Version ID");
  assert.match(matches[0][1], UUID);
  return matches[0][1];
}
export function manifest({ build, workerVersionId, sourceSha, workflowRunId }) {
  assert.match(build.fingerprint, HASH); assert.match(workerVersionId, UUID); assert.match(sourceSha, /^[0-9a-f]{40}$/);
  assert.match(String(workflowRunId), /^\d+$/);
  assert.ok(Object.keys(build.files).includes("package-lock.json") && Object.keys(build.files).includes("wrangler.jsonc"));
  for (const hash of Object.values(build.files)) assert.match(hash, HASH);
  return { schema: "otohime.ghosts-build.v1", service: "otohime-ghosts", workerVersionId,
    fingerprint: build.fingerprint, files: build.files, workerSourceSha: sourceSha, workflowRunId: String(workflowRunId) };
}
export function agrees(build, version) {
  assert.equal(version.service, build.service, "Worker service mismatch");
  assert.equal(version.fingerprint, build.fingerprint, "Worker code/lock/configuration mismatch");
  assert.equal(version.workerVersionId, build.workerVersionId, "Worker version mismatch");
}
export function deploy({ env = process.env, build = fingerprint(), run = spawnSync } = {}) {
  if (env.GHOSTS_DEPLOY_ENABLED !== "true") return { disabled: true };
  for (const key of ["CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ACCOUNT_ID"]) {
    assert.ok(env[key], `missing required secret ${key}`); // Names only; no secret values enter evidence.
  }
  assert.equal(env.GITHUB_REF, "refs/heads/main", "deployment requires main");
  // Validate all public metadata before creating a version, so a bad build cannot deploy without its manifest.
  manifest({ build, workerVersionId: "00000000-0000-4000-8000-000000000000", sourceSha: env.GITHUB_SHA, workflowRunId: env.GITHUB_RUN_ID });
  const result = run(resolve(PACKAGE_DIR, "node_modules/.bin/wrangler"), ["deploy", "--define", `__GHOSTS_FINGERPRINT__:${JSON.stringify(build.fingerprint)}`], {
    cwd: PACKAGE_DIR, encoding: "utf8", timeout: 300_000,
    env: { ...env, WRANGLER_SEND_METRICS: "false", NO_COLOR: "1" },
  });
  // Do not publish raw CLI output: an upstream diagnostic could include credentials.
  assert.equal(result.status, 0, "wrangler deploy failed; no public build manifest published");
  return manifest({ build, workerVersionId: versionId(result.stdout), sourceSha: env.GITHUB_SHA, workflowRunId: env.GITHUB_RUN_ID });
}
async function json(url) {
  const parsed = new URL(url);
  assert.ok(!parsed.username && !parsed.password && !parsed.search && !parsed.hash, "public URL only");
  const response = await fetch(parsed, { signal: AbortSignal.timeout(10000), redirect: "error" });
  assert.equal(response.status, 200, `HTTP ${response.status} at ${parsed.pathname}`);
  return response.json();
}
async function main() {
  const args = process.argv.slice(2), value = key => args[args.indexOf(key) + 1];
  if (args.includes("--deploy")) {
    const build = deploy();
    assert.ok(args.includes("--output"), "--output is required");
    writeFileSync(value("--output"), JSON.stringify(build, null, 2) + "\n");
    console.log(JSON.stringify(build));
  } else if (args.includes("--app") && args.includes("--worker") && args.includes("--manifest")) {
    const build = JSON.parse(readFileSync(value("--manifest"), "utf8"));
    const app = new URL(value("--app")), worker = new URL(value("--worker"));
    const version = await json(new URL("/version", worker)); agrees(build, version);
    const health = await json(new URL("/api/health", app));
    const appBuild = args.includes("--app-build") ? JSON.parse(readFileSync(value("--app-build"), "utf8")) : null;
    if (appBuild) { assert.equal(appBuild.appSha, health.sha, "application build SHA mismatch"); assert.ok(appBuild.nextBuildId, "missing Next BUILD_ID"); }
    // Application build and Worker build are different executables.
    console.log(JSON.stringify({ worker: version, appSha: health.sha, nextBuildId: appBuild?.nextBuildId ?? null,
      evidence: "read-only identity only; two-browser live fan-out remains unproven" }, null, 2));
  } else {
    const build = manifest({ build: fingerprint(), workerVersionId: "11111111-2222-4333-8444-555555555555", sourceSha: "a".repeat(40), workflowRunId: "1" });
    agrees(build, { service: build.service, fingerprint: build.fingerprint, workerVersionId: build.workerVersionId });
    console.log("PASS fixture identity contract; no hosted execution or deployment");
  }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { await main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
