// These fixtures test the evidence validator only. They do not stand in for the
// production browser, database, probes or static tools executed by its CLI.
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { GATES, assertEvidence } from "../scripts/verify-browser-recovery.mjs";

function fixture(id: string): string {
  const gate = GATES.find((gate) => gate.id === id)!;
  if (id === "static") return gate.required.join("\n");
  const count = Math.max(gate.minimum ?? 0, gate.required.length);
  const names = [...gate.required, ...Array.from({ length: count - gate.required.length }, (_, i) => `fixture ${i}`)];
  if (gate.summary) return names.map((name) => `ok - ${name}`).join("\n") + `\n${gate.summary}: ${count} ok, 0 failed\n`;
  return names.map((name, i) => `ok ${i + 1} - ${name.replace(/#/g, "\\#")}`).join("\n") + `\n1..${count}\n# tests ${count}\n# pass ${count}\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n`;
}

for (const gate of GATES) {
  test(`${gate.name}: positive named evidence and intentional missing-assertion control`, () => {
    const output = fixture(gate.id);
    assert.ok(assertEvidence(gate.id, output));
    const missing = output.replace(gate.required[0], "renamed assertion");
    assert.notEqual(output, missing);
    assert.throws(() => assertEvidence(gate.id, missing));
    assert.throws(() => assertEvidence(gate.id, output, 7), /command failed/);
  });
}

test("browser recovery rejects exit-zero, missing, renamed, skipped and failed contract evidence", () => {
  assert.equal(GATES.length, 7);
  assert.equal(GATES[0].required.length, 21, "five fetch foundations must not be omitted");
  const browser = GATES.find((gate) => gate.id === "browser")!;
  assert.ok(browser.required.length >= 173, "inventory includes all literal declarations; the separate 187-test floor includes parameterized cases");
  assert.ok(browser.required.includes("evidence: every root hydrated under each colored run"));
  for (const gate of GATES) {
    for (const empty of ["", "exit 0\n", "1..0\n# tests 0\n# pass 0\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n"]) {
      assert.throws(() => assertEvidence(gate.id, empty));
    }
    const good = fixture(gate.id);
    if (gate.summary) {
      assert.throws(() => assertEvidence(gate.id, good.replace("0 failed", "1 failed")));
      assert.throws(() => assertEvidence(gate.id, good + "ok - undeclared count\n"));
      assert.throws(() => assertEvidence(gate.id, good + `${gate.summary}: 0 ok, 0 failed\n`));
      assert.throws(() => assertEvidence(gate.id, good + "not ok - observed failure\n"));
    } else if (gate.id !== "static") {
      for (const counter of ["fail", "cancelled", "skipped", "todo"]) {
        assert.throws(() => assertEvidence(gate.id, good.replace(`# ${counter} 0`, `# ${counter} 1`)));
      }
      assert.throws(() => assertEvidence(gate.id, good.replace(gate.required[0], `${gate.required[0]} # SKIP`)));
      assert.throws(() => assertEvidence(gate.id, good + "not ok 9999 - observed failure\n"));
    }
  }
});

test("print-run hydration asserts every root without requiring screenshot output", () => {
  const source = readFileSync(new URL("../e2e/print-runs.test.ts", import.meta.url), "utf8");
  const start = source.indexOf('test("evidence: every root hydrated under each colored run"');
  assert.ok(start >= 0);
  const body = source.slice(start, source.indexOf('\ntest(', start + 1));
  assert.doesNotMatch(body, /skip\s*:/, "browser assertions cannot depend on artifact output");
  assert.match(body, /for \(const \[root, path\] of DOCUMENTS\)/);
  assert.match(body, /assert\.equal\(\(await look\(page, root\)\)\.printRun, run, path\)/);
  assert.match(body, /if \(EVIDENCE\)/, "only optional screenshot output is gated");
});
