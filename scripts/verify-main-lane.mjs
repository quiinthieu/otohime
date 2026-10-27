// Execute each t-1671 gate and assert named evidence, including a silent-exit negative control.
import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { createWriteStream, existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { assertTapEvidence } from "./ci-probe-verification.mjs";
import { assertBottleEvidence } from "./verify-bottle-contracts.mjs";

export const CLOSURE_NAMES = [
  "motion shell normalizes unset, empty and long TMPDIR before browser launch; preserves custom paths through length 48",
  "motion TMPDIR controls reject missing normalization, an off-by-one bound and clobbered custom paths",
  "npm test executes all three main-lane suites; removing any registration fails",
  "the actual Kame clock predicate rejects frozen browser time and observes the 50ms boundary",
  "gesture trace stays bounded while retaining press/release and meaningful failure output",
  "gate child drains callback-flushed stdout and stderr, retaining complete under-cap output and exact over-cap tails",
  "ledger's actual sampler waits for visible two-frame geometry and still rejects a sheet that fits",
  "disabled ghost probe is console-clean; direct configuration HTTP 404 remains detectable",
  "preserve desk hydration, rejecting its removal",
  "preserve desk viewport centering, rejecting its removal",
  "preserve desk hit target, rejecting its removal",
  "preserve desk drag start, rejecting its removal",
  "preserve desk drag end, rejecting its removal",
  "preserve desk failure trace, rejecting its removal",
  "preserve Kame observed clock, rejecting its removal",
  "preserve Kame frozen-clock negative control, rejecting its removal",
  "preserve ledger visible two-frame settle, rejecting its removal",
  "preserve ledger overflow assertion, rejecting its removal",
  "preserve gate output flush, rejecting its removal",
  "preserve gate under-cap assertion, rejecting its removal",
  "preserve gate over-cap assertion, rejecting its removal",
  "the bound is 40 and a short gesture is kept whole, in order",
  "a long drag keeps at most 40 records, and the press and the let-go survive",
  "with no move left to drop, the oldest record goes",
  "anything but pointer down/move/up/cancel is ignored, and the trace is not changed in place",
  "the format: times from the first record, the pointer, the point, the target and the drag state"
];
export const BROWSER_NAMES = [
  "a narrow window and a wide touch tablet get the stacked desk too; the same touch swipe drags on a wide mouse desk",
  "clock fixture observes browser elapsed time rather than host delay",
  "on a phone the layout check waits for a sheet shown after hydration, and fails a sheet without its minimum width",
];
const UNIT_NAMES = [...CLOSURE_NAMES,
  "CI probe annotator preserves a real exit 7 through pipefail, escaping annotation properties and data",
  "streamed /dashboard heading arriving after 1.5s resolves the real observer",
  "missing, empty and hidden main headings fail at the 10s bound (negative control)",
  "deployment status uses real bearer HTTP without user bootstrap; validates ownership, terminal state and bounds",
  "main lane delivery evidence rejects missing, skipped and renamed tests and silent exit0",
  "main lane e2e evidence rejects missing, skipped and renamed tests and silent exit0",
  "main lane CLI rejects fake successful runners for every gate",
];
const flags = "--experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON";
export const MAIN_LANE_GATES = [
  { id: "delivery", cmd: `node ${flags} --test scripts/main-lane-closure.test.mjs scripts/e2e-gesture-trace.test.ts` },
  { id: "unit", cmd: "CI=true npm test" },
  { id: "static", cmd: "npm run lint && npm run typecheck && node scripts/check-gate-closure.mjs" },
  { id: "footer", cmd: "node scripts/verify-bottle-footer.mjs" },
  { id: "e2e", cmd: "bash scripts/e2e-local.sh", repetitions: 3 },
];
export function assertDelivery(ref = process.env.MAIN_DELIVERY_REF || "origin/main") {
  assert.ok(existsSync("scripts/main-lane-closure.test.mjs"), "missing working-tree closure suite");
  const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();
  const pkg = JSON.parse(git("show", `${ref}:package.json`));
  for (const suite of ["ci-probe-annotate", "probe-end-stream", "main-lane-closure"]) {
    assert.ok(pkg.scripts.test.includes(`scripts/${suite}.test.mjs`), `${ref}: npm test missing ${suite}`);
  }
  git("cat-file", "-e", `${ref}:scripts/main-lane-closure.test.mjs`);
  git("merge-base", "--is-ancestor", "HEAD", ref);
  return "delivery tree, registrations and ancestry: pass\n";
}
export function assertMainLaneEvidence(id, output) {
  if (id === "delivery") {
    assert.ok(output.includes("delivery tree, registrations and ancestry: pass\n"));
    return assertTapEvidence(output, CLOSURE_NAMES);
  }
  if (id === "unit") return assertTapEvidence(output, UNIT_NAMES);
  if (id === "static") {
    const start = output.indexOf('{\n  "schema": "otohime.gate-closure.v1"');
    assert.ok(start >= 0, "actual gate closure JSON is required");
    return { static: assertBottleEvidence("static", output.slice(0, start)), closure: assertBottleEvidence("closure", output.slice(start)) };
  }
  if (id === "footer") return assertBottleEvidence("footer", output);
  assert.equal(id, "e2e", "unknown main-lane gate");
  // Retain exactly the historical optional evidence skip; no other test may be skipped.
  const skipped = output.split("\n").filter((line) => /^ok \d+ - .*# SKIP/.test(line));
  assert.equal(skipped.length, 1, "only the existing evidence skip is allowed");
  assert.match(skipped[0], /^ok \d+ - evidence: every root hydrated under each colored run # SKIP$/);
  const normalized = output.replace(skipped[0] + "\n", "").replace(/^# tests (\d+)$/gm, (_, n) => `# tests ${Number(n) - 1}`).replace(/^# skipped 1$/gm, "# skipped 0");
  return { ...assertTapEvidence(normalized, BROWSER_NAMES), existing_skip: skipped[0] };
}

export async function runMainLane(directory, selected = MAIN_LANE_GATES) {
  mkdirSync(directory, { recursive: true });
  const receipts = [];
  for (const gate of selected) {
    for (let iteration = 1; iteration <= (gate.repetitions || 1); iteration++) {
      const name = gate.repetitions ? `${gate.id}-${iteration}` : gate.id;
      const logfile = resolve(directory, `${name}.log`);
      const prefix = gate.id === "delivery" ? assertDelivery() : "";
      const stream = createWriteStream(logfile);
      stream.write(prefix);
      const env = { ...process.env, CI: "true", TMPDIR: "/tmp", GITHUB_SHA: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim() };
      delete env.NODE_TEST_CONTEXT;
      delete env.BASE_URL;
      delete env.SKIP_BUILD;
      const start = Date.now();
      console.log(`Running ${name}: ${gate.cmd}`);
      const code = await new Promise((done, reject) => {
        const child = spawn("bash", ["-eo", "pipefail", "-c", gate.cmd], { env, stdio: ["ignore", "pipe", "pipe"] });
        child.stdout.on("data", (chunk) => stream.write(chunk));
        child.stderr.on("data", (chunk) => stream.write(chunk));
        child.on("error", reject);
        child.on("close", (code) => stream.end(() => done(code)));
      });
      assert.equal(code, 0, `${name} failed: ${logfile}`);
      const output = readFileSync(logfile, "utf8");
      const evidence = assertMainLaneEvidence(gate.id, output);
      assert.throws(() => assertMainLaneEvidence(gate.id, ""), `${name}: silent exit0 must fail`);
      receipts.push({ id: name, command: gate.cmd, exit_code: code, duration_ms: Date.now() - start, evidence,
        log_sha256: createHash("sha256").update(output).digest("hex"), build_id: ["footer", "e2e"].includes(gate.id) ? readFileSync(".next/BUILD_ID", "utf8").trim() : undefined });
      writeFileSync(resolve(directory, "verification.json"), JSON.stringify(receipts, null, 2) + "\n");
      console.log(`Verified ${name}: named positive assertions and silent-exit negative control passed`);
    }
  }
  return receipts;
}
if (process.argv[1] && existsSync(process.argv[1]) && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  const args = process.argv.slice(2);
  let selected = MAIN_LANE_GATES;
  if (args[0] === "--gate") {
    selected = selected.filter(({ id }) => id === args[1]);
    assert.equal(selected.length, 1, `unknown main-lane gate ${args[1]}`);
    args.splice(0, 2);
  }
  assert.ok(args.length <= 1, "usage: verify-main-lane.mjs [--gate id] [artifact-directory]");
  await runMainLane(resolve(args[0] || "artifacts/main-lane"), selected);
}
