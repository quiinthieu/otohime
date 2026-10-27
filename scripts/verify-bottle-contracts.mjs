// Run from the repository root. Every successful command also needs positive evidence.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { createWriteStream, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { GATES, assertEvidence, assertTapEvidence } from "./ci-probe-verification.mjs";
import { CONTROLS } from "./check-gate-closure.mjs";
const flags = "--experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON";
const layoutNames = [
  "Bottle stylesheet reserves a rem header band with a bottom anchor and 44px targets",
  "Bottle clearance contains default, 24px and 32px text at normal and 200% roots",
  "Bottle clearance rejects the old -2.4rem scene overlap using the same invariant",
  "Bottle clearance rejects the old 2.5rem top-border protrusion using the same invariant",
  "normalizes canonical URLs and plain text without fetching",
  "rejects hostile URLs, fragments and trackers including encoded IPs",
  "bounds text/kind/shape and rejects markup, controls and honeypots",
  "twelve reviewed seeds validate and merge with deterministic curated precedence",
  "seeded picking does not repeat until exhausted and tolerates stale seen ids",
  "untrusted enum objects never coerce or throw; canonical expansion stays bounded",
  "draw history normalizes unknown ids, resets exhaustion without immediate repeats and bounds storage",
  "browser snapshots fail closed on hostile links, markup and duplicate identities",
];
const browserNames = [
  "both entries share the lazy card; keyboard, safe deliberate visit, focus and modal coexistence",
  ...[1366, 768, 390].map((width) => `footer Bottle contains enlarged text and growing 200% root text at ${width}`),
  "repeat exhaustion, stale stored ids, cross-entry history and bounded persistence",
  "readable but unwritable storage keeps visit history across both entries",
  "touch, blocked storage, offline pool and live reduced motion stay usable",
  "empty and single pools and malformed stored history remain usable",
  "real suggestion is pending in Postgres and absent from the public pool; validation stays local",
  "suggestion failures retain input, render inert reasons, prevent duplicates and honor 429",
  "no-JS baseline retains footer/Pocket links and explains Bottle activation",
  ...[1366, 390].map((width) => `lazy network boundaries, emitted gzip budgets and open/close CLS at ${width}`),
  "browser Back closes the shared-footer modal without an orphaned overlay",
];
function sharedGate(id) {
  const gate = GATES.find((gate) => gate.id === id);
  assert.ok(gate, `missing shared gate ${id}`);
  return gate;
}
export const BOTTLE_GATES = [
  { id: "layout", cmd: `node ${flags} --test lib/bottle-footer-layout.test.ts lib/bottles.test.ts`, required: layoutNames },
  { ...sharedGate("unit"), required: [
    ...sharedGate("unit").required,
    "isolated E2E builds discard stale Next output, preserve explicit reuse and propagate build failures",
    "deployment API configuration refuses credential egress before making a request",
    ...layoutNames,
    ...["layout", "unit", "browser", "footer"].map((id) => `Bottle ${id} receipt requires every named passing test and nonzero unskipped TAP`),
    "Bottle repository receipt requires layout, picker and every verifier regression",
    "Bottle verifier import preserves shared gates and single-gate CLI rejects silent exit0",
    "Bottle closure receipt rejects renamed or empty controls and a fake uncertified runner",
    "Bottle footer receipt rejects summary counts without the individual walk and probe assertions",
    "Bottle static receipt requires actual lint and typecheck output and makes only a static claim",
    "Bottle deployment receipt requires scoped Ready and fail-closed controls beyond an assertion count",
    "Bottle deployment receipt reconciles unique assertion lines with its summary",
  ] },
  ...["static", "closure"].map(sharedGate),
  { id: "browser", cmd: `node ${flags} scripts/e2e.mjs --test e2e/bottle-ui.test.ts`, required: browserNames },
  sharedGate("footer"),
  { id: "deployment", cmd: "bash scripts/vercel-deploy.test.sh" },
];
export const API_DEPLOYMENT_CONTROLS = [
  "scoped identity failure accepts independently authenticated API Ready before exact-sha health",
  "API fallback requests the uploaded deployment in the configured team with the existing token",
  "API fallback never prints its credential",
  "CLI scope resolver wrapped User not found uses the same authenticated API check",
  "API Ready cannot bypass exact served-sha health",
  ...["state-BUILDING", "state-QUEUED", "state-INITIALIZING", "state-ERROR", "state-CANCELED", "state-unknown", "wrong-project", "wrong-url", "preview", "missing-id", "public-only", "malformed", "oversized", "http-401", "http-403", "http-429", "http-500", "redirect", "hang"]
    .map((mode) => `API ${mode} fails closed before matching health`),
  "API redirect never forwards the credential",
  "API fallback requires the configured project",
  "API fallback rejects a refused token without printing it",
  ...["identity-timeout", "mixed-identity"].map((mode) => `${mode} cannot invoke API rescue or matching health`),
];
const deploymentNames = [
  ...API_DEPLOYMENT_CONTROLS,
  "standalone inspect without scope reproduces User not found",
  "explicit team scope permits Ready inspect and exact-sha health",
  "waiting inspect receives the configured team scope",
  "diagnostic re-read receives the same team scope",
  "scoped Ready re-read cannot rescue failed waiting inspect",
  "missing team is refused before upload",
  "User not found with explicit scope still fails closed before health",
  "matching nested sha cannot impersonate the served executable",
  ...["building", "queued", "initializing", "silent", "unknown"].map((mode) => `zero-exit ${mode} inspect fails closed before matching health`),
];
function deploymentEvidence(output) {
  assert.doesNotMatch(output, /^not ok - /m);
  const count = Number(output.match(/^# all (\d+) assertions passed$/m)?.[1]);
  assert.ok(count >= 59 + API_DEPLOYMENT_CONTROLS.length, "deployment fixture executes all assertions");
  const assertions = output.split("\n").filter((line) => line.startsWith("ok - "));
  assert.equal(new Set(assertions).size, assertions.length, "duplicate deployment assertions cannot replace missing controls");
  assert.equal(assertions.length, count, "individual deployment assertions must match the summary");
  for (const name of deploymentNames) {
    assert.ok(output.split("\n").includes(`ok - ${name}`), `deployment assertion absent: ${name}`);
  }
  return { assertions: count, required: deploymentNames, boundary: "fake Vercel CLI; real local HTTP and shell processes" };
}

// Importing the verifier runs no commands and never mutates another verifier's gates.
// Fixtures can exercise this boundary, but only run() executes product commands.
export function assertBottleEvidence(id, output) {
  const gate = BOTTLE_GATES.find((gate) => gate.id === id);
  assert.ok(gate, `unknown Bottle gate ${id}`);
  if (id === "deployment") return deploymentEvidence(output);
  if (id === "layout" || id === "unit" || id === "browser") return assertTapEvidence(output, gate.required);
  const evidence = assertEvidence(id, output);
  if (id === "closure") {
    const result = JSON.parse(output);
    for (const control of CONTROLS) {
      const command = result.commands.find((command) => command.id === control.id);
      assert.deepEqual(command.required.map(({ id, name }) => ({ id, name })), control.required,
        `${control.id}: closure must certify the actual named controls`);
      assertTapEvidence(command.stdout_tail, control.required.map((test) => test.name));
    }
  }
  if (id === "footer") {
    const counts = ["walk", "probe"].map((label) => Number(output.match(new RegExp(`^(?:# )?${label}: (\\d+) ok, 0 failed$`, "m"))[1]));
    const individual = output.split("\n").filter((line) => /^(?:# )?ok - /.test(line)).length;
    assert.equal(individual, counts[0] + counts[1], "individual footer assertions must match walk/probe totals");
    evidence.assertions = { walk: counts[0], probe: counts[1] };
  }
  return evidence;
}

export async function run(directory, selected = BOTTLE_GATES) {
  mkdirSync(directory, { recursive: true });
  const receipts = [];
  for (const gate of selected) {
    console.log(`Running ${gate.id}: ${gate.cmd}`);
    const logfile = resolve(directory, `${gate.id}.log`);
    const stream = createWriteStream(logfile);
    const start = Date.now();
    const env = { ...process.env, TMPDIR: "/tmp" };
    // A verifier called by node:test still launches independent TAP-producing suites.
    delete env.NODE_TEST_CONTEXT;
    const status = await new Promise((done, reject) => {
      const child = spawn("bash", ["-eo", "pipefail", "-c", gate.cmd], { stdio: ["ignore", "pipe", "pipe"], env });
      child.stdout.on("data", (data) => stream.write(data));
      child.stderr.on("data", (data) => stream.write(data));
      child.on("error", reject);
      child.on("close", (code) => stream.end(() => done(code)));
    });
    assert.equal(status, 0, `${gate.id} failed: ${logfile}`);
    const output = readFileSync(logfile, "utf8");
    const check = (output) => assertBottleEvidence(gate.id, output);
    const evidence = check(output);
    assert.throws(() => check(""), `${gate.id}: silent exit0 must fail`);
    if (gate.id === "deployment") {
      assert.throws(() => check(output.replace(deploymentNames[0], "omitted-control")), "missing deployment assertion must fail");
      assert.throws(() => check(output.replace(`ok - ${deploymentNames[0]}`, `not ok - ${deploymentNames[0]}`)), "failed deployment assertion must fail");
    } else if (gate.required) {
      assert.throws(() => check(output.replaceAll(gate.required[0], "renamed-required-control")), `${gate.id}: missing named test must fail`);
      assert.throws(() => check(output.replaceAll(gate.required[0], `${gate.required[0]} # SKIP`)), `${gate.id}: skipped required test must fail`);
    } else if (gate.id === "closure") {
      const broken = JSON.parse(output);
      broken.certified = false;
      assert.throws(() => check(JSON.stringify(broken)), "uncertified closure must fail");
    } else {
      assert.throws(() => check(output.replace("> next typegen && tsc --noEmit", "omitted TypeScript")), "omitted typecheck must fail");
    }
    const build = ["browser", "footer"].includes(gate.id) ? readFileSync(".next/BUILD_ID", "utf8").trim() : undefined;
    if (build) writeFileSync(resolve(directory, `${gate.id}-build.txt`), build + "\n");
    receipts.push({ ...gate, exit_code: status, duration_ms: Date.now() - start, log_sha256: createHash("sha256").update(output).digest("hex"), build_id: build, evidence, evidence_negative_controls: "pass" });
    writeFileSync(resolve(directory, "verification.json"), JSON.stringify(receipts, null, 2) + "\n");
    console.log(`Verified ${gate.id}: positive assertions and evidence negative controls passed`);
  }
  return receipts;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  // --gate lets each build-contract item assert its own evidence without rerunning all gates.
  const args = process.argv.slice(2);
  let selected = BOTTLE_GATES;
  if (args[0] === "--gate") {
    const id = args[1];
    selected = BOTTLE_GATES.filter((gate) => gate.id === id);
    assert.equal(selected.length, 1, `unknown Bottle gate ${id}`);
    args.splice(0, 2);
  }
  assert.ok(args.length <= 1, "usage: verify-bottle-contracts.mjs [--gate id] [artifact-directory]");
  await run(resolve(args[0] || "artifacts/bottle-contracts"), selected);
}
