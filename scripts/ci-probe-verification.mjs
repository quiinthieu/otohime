// t-1647's local gate receipt: execute the contract commands, then require named
// assertions and counts. A silent exit 0 cannot become verification evidence.
import assert from "node:assert/strict";
import { CONTROLS } from "./check-gate-closure.mjs";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { createWriteStream, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const workflowControl = "all four non-TAP probe steps annotate the captured pipefail status";
export const GATES = [
  { id: "contracts", cmd: "node --test scripts/ci-probe-annotate.test.mjs scripts/probe-end-stream.test.mjs scripts/ci-workflow.test.mjs", required: [
    "CI probe annotator preserves a real exit 7 through pipefail, escaping annotation properties and data",
    "CI probe annotation retains walk and nested TAP counts after truncating a long assertion",
    "Real CPU camera and privacy verifier: actual workflow preserves exit 7, escaped assertions, counts and missing server logs",
    "Footer Chromium probe: a broken assertion reporter preserves the original exit 7",
    "streamed /dashboard heading arriving after 1.5s resolves the real observer",
    "missing, empty and hidden main headings fail at the 10s bound (negative control)",
  ] },
  { id: "unit", cmd: "npm test", required: [workflowControl,
    "Footer walk reads the exact plain heading source, ignoring nested Riso plates",
    "walk-end.sh, probe-end.sh and CI checks wire the footer verification suite and handle unset, empty and long TMPDIR",
  ] },
  { id: "static", cmd: "npm run lint && npm run typecheck" },
  { id: "closure", cmd: "node scripts/check-gate-closure.mjs" },
  { id: "footer", cmd: "node scripts/verify-bottle-footer.mjs", required: ["CI-mode production footer walk and Chromium probe"] },
];

export function assertTapEvidence(output, required) {
  const names = output.split("\n").filter((line) => /^\s*ok \d+ - /.test(line));
  for (const name of required) {
    assert.ok(names.some((line) => line.trim().replace(/^ok \d+ - /, "") === name), `required passing test absent or skipped: ${name}`);
  }
  const count = (name) => Number([...output.matchAll(new RegExp(`^# ${name} (\\d+)$`, "gm"))].at(-1)?.[1] ?? NaN);
  const tests = count("tests");
  assert.ok(tests > 0, "TAP must demonstrate a nonzero test count");
  assert.equal(count("pass"), tests, "every test must pass");
  for (const name of ["fail", "cancelled", "skipped", "todo"]) assert.equal(count(name), 0, `TAP ${name}`);
  assert.doesNotMatch(output, /^\s*not ok \d+ - /m);
  return { tests, required };
}

export function assertEvidence(id, output) {
  const gate = GATES.find((gate) => gate.id === id);
  assert.ok(gate, `unknown gate ${id}`);
  if (gate.required) {
    const evidence = assertTapEvidence(output, gate.required);
    if (id === "footer") {
      for (const [label, minimum] of [["walk", 65], ["probe", 170]]) {
        const count = output.match(new RegExp(`^(?:# )?${label}: (\\d+) ok, 0 failed$`, "m"));
        assert.ok(count && Number(count[1]) >= minimum, `${label} must execute at least ${minimum} assertions`);
      }
      for (const assertion of [
        "local 390x844 reduced-motion 403 exit: repeated full-load /admin/roles -> /projects -> full-load /admin/roles -> /dashboard preserves access denial",
        "negative control: verifyCanonicalLinks rejects a corrupted canonical footer href",
        "errors: zero console errors or page errors across all contexts",
      ]) assert.ok(output.split("\n").some((line) => line.startsWith(`# ok - ${assertion}`)), `browser assertion absent: ${assertion}`);
    }
    return evidence;
  }
  if (id === "static") {
    // Static tooling has no TAP assertions: require its real command identities
    // and route generation; run() separately requires both commands to exit 0.
    for (const text of ["> eslint", "> next typegen && tsc --noEmit", "Types generated successfully"]) assert.ok(output.includes(text), `static tool did not execute: ${text}`);
    return { tools: ["eslint", "next typegen", "tsc --noEmit"], boundary: "static analysis only" };
  }
  const result = JSON.parse(output);
  assert.equal(result.schema, "otohime.gate-closure.v1");
  assert.equal(result.runner, "real");
  assert.equal(result.certified, true);
  assert.equal(result.local_controls, "pass");
  assert.equal(result.preflight.ok, true);
  assert.equal(result.fingerprint.ok, true);
  assert.deepEqual(result.failures, []);
  assert.deepEqual(result.commands.map((c) => c.id), ["preflight", ...CONTROLS.map(c => c.id)]);
  for (const command of result.commands) {
    assert.equal(command.executed, true);
    assert.equal(command.exit_code, 0);
    assert.equal(command.ok, true);
    if (command.id !== "preflight") {
      assert.ok(command.required.length > 0);
      assert.ok(command.required.every((test) => test.status === "pass"));
    }
  }
  return { required: result.commands.filter((c) => c.id !== "preflight").flatMap((c) => c.required), fingerprint: result.fingerprint };
}

async function run(directory) {
  mkdirSync(directory, { recursive: true });
  const receipts = [];
  for (const gate of GATES) {
    console.log(`Verifying ${gate.id}: ${gate.cmd}`);
    const logfile = resolve(directory, `${gate.id}.log`);
    const stream = createWriteStream(logfile);
    const start = Date.now();
    const code = await new Promise((done, reject) => {
      const child = spawn("bash", ["-eo", "pipefail", "-c", gate.cmd], { stdio: ["ignore", "pipe", "pipe"] });
      child.stdout.on("data", (data) => stream.write(data));
      child.stderr.on("data", (data) => stream.write(data));
      child.on("error", reject);
      child.on("close", (code) => stream.end(() => done(code)));
    });
    assert.equal(code, 0, `${gate.cmd} failed; see ${logfile}`);
    const output = readFileSync(logfile, "utf8");
    const evidence = assertEvidence(gate.id, output);
    receipts.push({ ...gate, exit_code: code, duration_ms: Date.now() - start, log_sha256: createHash("sha256").update(output).digest("hex"), evidence });
    writeFileSync(resolve(directory, "verification.json"), JSON.stringify(receipts, null, 2) + "\n");
    console.log(`Verified ${gate.id}: named assertions present`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await run(resolve(process.argv[2] || "artifacts/ci-probes"));
}
