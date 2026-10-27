// Run from the repository root. Every successful command also needs positive evidence.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { createWriteStream, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { GATES, assertEvidence } from "../../../../scripts/ci-probe-verification.mjs";
const directory = dirname(fileURLToPath(import.meta.url));
const flags = "--experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON";
const layoutNames = [
  "Bottle stylesheet reserves a rem header band with a bottom anchor and 44px targets",
  "Bottle clearance contains default, 24px and 32px text at normal and 200% roots",
  "Bottle clearance rejects the old -2.4rem scene overlap using the same invariant",
  "Bottle clearance rejects the old 2.5rem top-border protrusion using the same invariant",
  "draw history normalizes unknown ids, resets exhaustion without immediate repeats and bounds storage",
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
GATES.push(
  { id: "layout", cmd: `node ${flags} --test lib/bottle-footer-layout.test.ts lib/bottles.test.ts`, required: layoutNames },
  { id: "browser", cmd: `node ${flags} scripts/e2e.mjs --test e2e/bottle-ui.test.ts`, required: browserNames },
);
const gates = ["layout", "unit", "static", "closure", "browser", "footer"].map((id) => GATES.find((gate) => gate.id === id));
const receipts = [];
for (const gate of gates) {
  console.log(`Running ${gate.id}: ${gate.cmd}`);
  const logfile = resolve(directory, `${gate.id}.log`);
  const stream = createWriteStream(logfile);
  const start = Date.now();
  const status = await new Promise((done, reject) => {
    const child = spawn("bash", ["-eo", "pipefail", "-c", gate.cmd], { stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, TMPDIR: "/tmp" } });
    child.stdout.on("data", (data) => stream.write(data));
    child.stderr.on("data", (data) => stream.write(data));
    child.on("error", reject);
    child.on("close", (code) => stream.end(() => done(code)));
  });
  assert.equal(status, 0, `${gate.id} failed: ${logfile}`);
  const output = readFileSync(logfile, "utf8");
  const evidence = assertEvidence(gate.id, output);
  assert.throws(() => assertEvidence(gate.id, ""), `${gate.id}: silent exit0 must fail`);
  if (gate.required) {
    assert.throws(() => assertEvidence(gate.id, output.replaceAll(gate.required[0], "renamed-required-control")), `${gate.id}: missing named test must fail`);
    assert.throws(() => assertEvidence(gate.id, output.replaceAll(gate.required[0], `${gate.required[0]} # SKIP`)), `${gate.id}: skipped required test must fail`);
  } else if (gate.id === "closure") {
    const broken = JSON.parse(output);
    broken.certified = false;
    assert.throws(() => assertEvidence(gate.id, JSON.stringify(broken)), "uncertified closure must fail");
  } else {
    assert.throws(() => assertEvidence(gate.id, output.replace("> next typegen && tsc --noEmit", "omitted TypeScript")), "omitted typecheck must fail");
  }
  const build = ["browser", "footer"].includes(gate.id) ? readFileSync(".next/BUILD_ID", "utf8").trim() : undefined;
  if (build) writeFileSync(resolve(directory, `${gate.id}-build.txt`), build + "\n");
  receipts.push({ ...gate, exit_code: status, duration_ms: Date.now() - start, log_sha256: createHash("sha256").update(output).digest("hex"), build_id: build, evidence, evidence_negative_controls: "pass" });
  writeFileSync(resolve(directory, "verification.json"), JSON.stringify(receipts, null, 2) + "\n");
  console.log(`Verified ${gate.id}: positive assertions and evidence negative controls passed`);
}
