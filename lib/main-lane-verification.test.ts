import assert from "node:assert/strict";
import { test } from "node:test";
import { assertMainLaneEvidence, CLOSURE_NAMES, BROWSER_NAMES } from "../scripts/verify-main-lane.mjs";
const tap = (names: string[], skip = false) => [
  ...names.map((name, i) => `ok ${i + 1} - ${name}`),
  ...(skip ? [`ok ${names.length + 1} - evidence: every root hydrated under each colored run # SKIP`] : []),
  `# tests ${names.length + Number(skip)}`, `# pass ${names.length}`, "# fail 0", "# cancelled 0", `# skipped ${Number(skip)}`, "# todo 0", "",
].join("\n");
for (const [id, names] of [["delivery", CLOSURE_NAMES], ["e2e", BROWSER_NAMES]] as const) {
  test(`main lane ${id} evidence rejects missing, skipped and renamed tests and silent exit0`, () => {
    const prefix = id === "delivery" ? "delivery tree, registrations and ancestry: pass\n" : "";
    const output = prefix + tap(names, id === "e2e");
    assertMainLaneEvidence(id, output);
    assert.throws(() => assertMainLaneEvidence(id, ""));
    for (const name of names) {
      assert.throws(() => assertMainLaneEvidence(id, output.replaceAll(name, "omitted named assertion")));
      assert.throws(() => assertMainLaneEvidence(id, output.replaceAll(name, name + " # SKIP")));
    }
    assert.throws(() => assertMainLaneEvidence(id, output.replace("# fail 0", "# fail 1")));
    if (id === "e2e") assert.throws(() => assertMainLaneEvidence(id, output.replace("evidence: every root hydrated under each colored run", "new unwanted skip")));
    else assert.throws(() => assertMainLaneEvidence(id, output.replace(prefix, "")));
  });
}

test("main lane CLI rejects fake successful runners for every gate", async () => {
  const { mkdtempSync, writeFileSync, rmSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const { spawnSync } = await import("node:child_process");
  const directory = mkdtempSync(join(tmpdir(), "main-lane-receipt-"));
  try {
    // Only bash is fake: the actual Node CLI and its evidence checks run unchanged.
    writeFileSync(join(directory, "bash"), "#!/bin/sh\nexit 0\n", { mode: 0o755 });
    for (const id of ["delivery", "unit", "static", "footer", "e2e"]) {
      const result = spawnSync(process.execPath, ["scripts/verify-main-lane.mjs", "--gate", id, join(directory, id)], {
        encoding: "utf8", timeout: 10_000,
        env: { ...process.env, MAIN_DELIVERY_REF: "HEAD", PATH: `${directory}:${process.env.PATH}` },
      });
      assert.equal(result.status, 1, `${id}: fake successful command must fail evidence validation`);
      assert.match(result.stderr, /AssertionError/, id);
      assert.doesNotMatch(result.stdout, /Verified /, id);
    }
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
