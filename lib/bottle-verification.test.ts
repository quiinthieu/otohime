/** Receipt fixtures test evidence rejection; product execution is the verifier CLI's job. */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { GATES } from "../scripts/ci-probe-verification.mjs";
import { test } from "node:test";
import { BOTTLE_GATES, DEPLOYMENT_NAMES, assertBottleEvidence } from "../scripts/verify-bottle-contracts.mjs";
import { CONTROLS } from "../scripts/check-gate-closure.mjs";

type ClosureReceipt = {
  runner: string; certified: boolean;
  commands: { required: { name: string }[]; stdout_tail: string }[];
};

const prior = new URL("../projects/otohime-dev-three-paper-and-ink-toys-that-lean-into-the-uras/run-9171/artifacts/", import.meta.url);
const log = (id: string) => readFileSync(new URL(`${id}.log`, prior), "utf8");
const tapFixture = (names: string[]) => [
  ...names.map((name, index) => `ok ${index + 1} - ${name}`),
  `1..${names.length}`, `# tests ${names.length}`, `# pass ${names.length}`,
  "# fail 0", "# cancelled 0", "# skipped 0", "# todo 0", "",
].join("\n");

test("Bottle repository receipt requires layout, picker and every verifier regression", () => {
  const layout = BOTTLE_GATES.find((gate: { id: string }) => gate.id === "layout")!.required!;
  const verifier = [...readFileSync(new URL(import.meta.url), "utf8").matchAll(/test\("([^"]+)"/g)].map((match) => match[1]);
  verifier.push(...["layout", "unit", "browser", "footer"].map((id) => `Bottle ${id} receipt requires every named passing test and nonzero unskipped TAP`));
  const unit = BOTTLE_GATES.find((gate: { id: string }) => gate.id === "unit")!.required!;
  const required = [...new Set([...unit, ...layout, ...verifier])];
  assertBottleEvidence("unit", tapFixture(required));
  for (const name of [...layout, ...verifier]) {
    // Keep a coherent, nonzero passing TAP suite after removal. A total alone
    // cannot prove that the Bottle contracts actually ran in npm test.
    assert.throws(() => assertBottleEvidence("unit", tapFixture(required.filter((test) => test !== name))), name);
  }
});

for (const id of ["layout", "unit", "browser", "footer"]) {
  test(`Bottle ${id} receipt requires every named passing test and nonzero unskipped TAP`, () => {
    const gate = BOTTLE_GATES.find((gate: { id: string }) => gate.id === id)!;
    // The older unit log predates this verifier's regressions; its TAP here is a parser fixture.
    const output = id === "unit" ? tapFixture(gate.required!) : log(id);
    const evidence = assertBottleEvidence(id, output);
    assert.ok("tests" in evidence && evidence.tests > 0);
    assert.throws(() => assertBottleEvidence(id, ""));
    assert.throws(() => assertBottleEvidence(id, output.replace(/# tests \d+/g, "# tests 0")));
    for (const name of gate.required!) {
      assert.throws(() => assertBottleEvidence(id, output.replaceAll(name, "omitted required test")), name);
      assert.throws(() => assertBottleEvidence(id, output.replaceAll(name, `${name} # SKIP`)), name);
    }
  });
}

test("Bottle footer receipt rejects summary counts without the individual walk and probe assertions", () => {
  const output = log("footer");
  const withoutWalk = output.replace(/^# ok - .*\n/gm, "");
  assert.throws(() => assertBottleEvidence("footer", withoutWalk));
  // Leave the pre-existing named browser controls and totals; omit one other success.
  const oneMissing = output.replace(/^# ok - \/ returns 200\n/m, "");
  assert.notEqual(oneMissing, output);
  assert.throws(() => assertBottleEvidence("footer", oneMissing), /individual footer assertions/);
});

test("Bottle static receipt requires actual lint and typecheck output and makes only a static claim", () => {
  const output = log("static");
  const result = assertBottleEvidence("static", output);
  assert.ok("boundary" in result);
  assert.equal(result.boundary, "static analysis only");
  for (const marker of ["> eslint", "> next typegen && tsc --noEmit", "Types generated successfully"]) {
    assert.throws(() => assertBottleEvidence("static", output.replace(marker, "omitted static tool")));
  }
  assert.throws(() => assertBottleEvidence("static", ""));
});

test("Bottle closure receipt rejects renamed or empty controls and a fake uncertified runner", () => {
  // The archived closure predates the cache regression and cannot certify it.
  assert.throws(() => assertBottleEvidence("closure", log("closure")));
  const fixture = JSON.parse(log("closure"));
  const command = fixture.commands.find((command: { id: string }) => command.id === "e2e-runner");
  command.required = CONTROLS.find((control: { id: string }) => control.id === "e2e-runner")!.required
    .map((control: { id: string; name: string }) => ({ ...control, status: "pass" }));
  command.stdout_tail = tapFixture(command.required.map((control: { name: string }) => control.name));
  const output = JSON.stringify(fixture); // Synthetic parser fixture; the CLI still requires fresh execution.
  const evidence = assertBottleEvidence("closure", output);
  assert.ok("required" in evidence && evidence.required.length > 0);
  for (const mutate of [
    (result: ClosureReceipt) => { result.runner = "fake"; },
    (result: ClosureReceipt) => { result.certified = false; },
    (result: ClosureReceipt) => { result.commands[1].required = []; },
    (result: ClosureReceipt) => { result.commands[1].required[0].name = "unrelated control"; },
    (result: ClosureReceipt) => { result.commands[1].stdout_tail = ""; },
  ]) {
    const result = JSON.parse(output);
    mutate(result);
    assert.throws(() => assertBottleEvidence("closure", JSON.stringify(result)));
  }
  assert.throws(() => assertBottleEvidence("closure", ""));
});

const deploymentFixture = () => {
  const names = [...DEPLOYMENT_NAMES];
  while (names.length < 61) names.push(`synthetic parser control ${names.length}`);
  return names.map((name) => `ok - ${name}`).join("\n") + "\n# all 61 assertions passed\n";
};

test("Bottle deployment receipt requires scoped Ready and fail-closed controls beyond an assertion count", () => {
  // Explicitly synthetic parser input; production authorization is never claimed here.
  assert.throws(() => assertBottleEvidence("deployment", log("deployment")));
  const output = deploymentFixture();
  const evidence = assertBottleEvidence("deployment", output);
  assert.ok("assertions" in evidence);
  assert.equal(evidence.assertions, 61);
  for (const marker of DEPLOYMENT_NAMES) {
    assert.throws(() => assertBottleEvidence("deployment", output.replace(marker, "omitted deployment control")));
    assert.throws(() => assertBottleEvidence("deployment", output.replace(`ok - ${marker}`, `not ok - ${marker}`)));
  }
  assert.throws(() => assertBottleEvidence("deployment", "# all 61 assertions passed\n"));
  assert.throws(() => assertBottleEvidence("deployment", ""));
  assert.throws(() => assertBottleEvidence("not-a-gate", output), /unknown Bottle gate/);
});

test("Bottle deployment receipt reconciles unique assertion lines with its summary", () => {
  const output = deploymentFixture();
  assertBottleEvidence("deployment", output);
  const assertion = `ok - ${DEPLOYMENT_NAMES[0]}`;
  assert.throws(() => assertBottleEvidence("deployment", output.replace(assertion + "\n", "")), /assertion/);
  assert.throws(() => assertBottleEvidence("deployment", output.replace(assertion, `ok - ${DEPLOYMENT_NAMES[1]}`)), /duplicate/);
  assert.throws(() => assertBottleEvidence("deployment", output.replace("# all 61", "# all 600")), /assertion/);
});

test("Bottle verifier import preserves shared gates and single-gate CLI rejects silent exit0", () => {
  assert.deepEqual(GATES.map((gate: { id: string }) => gate.id), ["contracts", "unit", "static", "closure", "footer"]);
  const work = mkdtempSync(join(tmpdir(), "bottle-verifier-"));
  try {
    const cli = "scripts/verify-bottle-contracts.mjs";
    const artifacts = join(work, "real");
    const actual = spawnSync(process.execPath, [cli, "--gate", "layout", artifacts], { encoding: "utf8", timeout: 30_000 });
    assert.equal(actual.status, 0, actual.stderr);
    assert.match(actual.stdout, /Verified layout: positive assertions and evidence negative controls passed/);
    const receipts = JSON.parse(readFileSync(join(artifacts, "verification.json"), "utf8"));
    assert.deepEqual(receipts.map((receipt: { id: string }) => receipt.id), ["layout"]);
    assert.equal(receipts[0].evidence.tests, 12);
    assert.equal(receipts[0].evidence.required.length, 12);
    // Only the child's node is fake. The real CLI must reject this successful empty process.
    writeFileSync(join(work, "node"), "#!/bin/sh\nexit 0\n", { mode: 0o755 });
    const empty = spawnSync(process.execPath, [cli, "--gate", "layout", join(work, "empty")], {
      encoding: "utf8", timeout: 30_000, env: { ...process.env, PATH: `${work}:${process.env.PATH}` },
    });
    assert.notEqual(empty.status, 0);
    assert.match(empty.stderr, /required passing test absent/);
    const invalid = spawnSync(process.execPath, [cli, "--gate", "missing"], { encoding: "utf8", timeout: 30_000 });
    assert.notEqual(invalid.status, 0);
    assert.match(invalid.stderr, /unknown Bottle gate/);
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
});
