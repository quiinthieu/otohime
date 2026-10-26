// scripts/check-gate-closure.mjs runs the landed gate repairs' own regressions (lib/e2e-runner.test.ts, lib/end.test.ts,
// lib/urashima.test.ts) as nested node --test children and prints one otohime.gate-closure.v1 JSON result. Here a fake
// child-runner port drives the verdict logic: nonzero exits, timeouts, spawn errors, missing, skipped or malformed
// results and fingerprint failures must all fail, and a fake runner never certifies anything. The real CLI runs once
// on this checkout, and once on an isolated copy whose scripts/e2e.mjs lost its serial enforcement (negative control).
import assert from "node:assert/strict";
import { execFileSync, spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { availableParallelism, tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { test } from "node:test";
import { CONTROLS, FINGERPRINT_PATHS, SCHEMA, exitCode, realRunChild, runClosure, type ChildOutcome, type ChildSpec } from "../scripts/check-gate-closure.mjs";

const ROOT = resolve(import.meta.dirname, "..");
const CLI = "scripts/check-gate-closure.mjs";

type Spec = ChildSpec;
type Outcome = ChildOutcome;

// node:test TAP for a file whose top-level tests have these names; `fail` names fail.
function tap(names: string[], fail: string[] = []) {
  const lines = names.map((name, i) => `${fail.includes(name) ? "not ok" : "ok"} ${i + 1} - ${name}`);
  const failed = names.filter((n) => fail.includes(n)).length;
  return [...lines, `1..${names.length}`, `# tests ${names.length}`, "# suites 0", `# pass ${names.length - failed}`, `# fail ${failed}`, "# cancelled 0", "# skipped 0", "# todo 0", "# duration_ms 1", ""].join("\n");
}

const healthyPreflight = `GATE_PREFLIGHT ${JSON.stringify({ ok: true, modules: {}, assets: {}, failures: [] })}\n`;

function outcome(over: Partial<Outcome> = {}): Outcome {
  return { code: 0, signal: null, timedOut: false, error: null, stdout: "", stderr: "", durationMs: 5, ...over };
}

// A fake port: every child passes with its real file's required test names, unless `over` says otherwise.
function fake(over: Record<string, (spec: Spec) => Partial<Outcome>> = {}) {
  const seen: Spec[] = [];
  return {
    seen,
    runner: {
      kind: "fake",
      run: async (spec: Spec): Promise<Outcome> => {
        seen.push(spec);
        const control = CONTROLS.find((c: { id: string }) => c.id === spec.id);
        const base = outcome({ stdout: control ? tap(control.required.map((r: { name: string }) => r.name)) : healthyPreflight });
        return { ...base, ...(over[spec.id]?.(spec) ?? {}) };
      },
    },
  };
}

const command = (result: { commands: { id: string }[] }, id: string) => result.commands.find((c) => c.id === id) as unknown as Record<string, unknown> & { ok: boolean; failures: string[]; required: { id: string; status: string }[] };

test("a fake runner's healthy run serializes the whole v1 result, passes its local logic, and still certifies nothing", async () => {
  const { runner, seen } = fake();
  const result = await runClosure({ root: ROOT, runner });
  const json = JSON.parse(JSON.stringify(result));
  assert.equal(json.schema, SCHEMA);
  assert.equal(SCHEMA, "otohime.gate-closure.v1");
  assert.equal(json.runner, "fake");
  assert.equal(json.local_controls, "pass");
  assert.equal(json.external_evidence, "inconclusive");
  assert.equal(json.certified, false);
  assert.equal(exitCode(result), 1, "a fake runner never certifies local controls");
  for (const gap of ["deployment", "global_green_gate", "kame_browser_execution", "historical_raw_assertions", "author_txt_bytes", "personalized_presence"]) {
    assert.ok(json.not_proven.includes(gap), gap);
  }
  assert.match(json.checkout.git_sha, /^[0-9a-f]{40}$/);
  assert.equal(typeof json.checkout.dirty, "boolean");
  assert.equal(json.runtime.node, process.version);
  assert.equal(json.runtime.platform, process.platform);
  assert.equal(json.fingerprint.ok, true);
  assert.match(json.fingerprint.files["package-lock.json"], /^[0-9a-f]{64}$/);
  assert.match(json.fingerprint.files[".github/workflows/ci.yml"], /^[0-9a-f]{64}$/);
  assert.match(json.fingerprint.combined, /^[0-9a-f]{64}$/);
  assert.deepEqual(json.commands.map((c: { id: string }) => c.id), ["preflight", "e2e-runner", "end", "urashima"]);

  // The children are the current checkout's files, under Node's strip-types test runner, bounded, with no test context.
  for (const control of CONTROLS) {
    const spec = seen.find((s) => s.id === control.id)!;
    assert.equal(spec.cwd, ROOT);
    assert.ok(spec.args.includes("--experimental-strip-types") && spec.args.includes("--test") && spec.args.includes("--test-reporter=tap"));
    assert.equal(spec.args.at(-1), control.file);
    assert.ok(spec.timeoutMs > 0 && spec.timeoutMs <= 180_000);
    assert.equal("NODE_TEST_CONTEXT" in spec.env, false);
  }
  assert.deepEqual(CONTROLS.map((c: { file: string }) => c.file), ["lib/e2e-runner.test.ts", "lib/end.test.ts", "lib/urashima.test.ts"]);
});

test("a nonzero exit fails the closure even when every TAP line says ok", async () => {
  const result = await runClosure({ root: ROOT, runner: fake({ end: () => ({ code: 3 }) }).runner });
  assert.equal(result.local_controls, "fail");
  assert.equal(exitCode(result), 1);
  assert.equal(command(result, "end").exit_code, 3);
  assert.ok(command(result, "end").failures.some((f) => /exit 3/.test(f)));
  assert.equal(command(result, "urashima").ok, true);
});

test("a timeout, a signal and a spawn error each fail the closure and are kept in the result", async () => {
  const timedOut = await runClosure({ root: ROOT, runner: fake({ "e2e-runner": () => ({ code: null, signal: "SIGTERM", timedOut: true }) }).runner });
  assert.equal(timedOut.local_controls, "fail");
  assert.equal(command(timedOut, "e2e-runner").timed_out, true);
  assert.equal(command(timedOut, "e2e-runner").signal, "SIGTERM");

  const spawnError = await runClosure({ root: ROOT, runner: fake({ urashima: () => ({ code: null, error: "spawn node ENOENT", stdout: "" }) }).runner });
  assert.equal(spawnError.local_controls, "fail");
  assert.equal(command(spawnError, "urashima").spawn_error, "spawn node ENOENT");

  const thrown = await runClosure({
    root: ROOT,
    runner: { kind: "fake", run: async () => { throw new Error("port exploded"); } },
  });
  assert.equal(thrown.local_controls, "fail");
  assert.match(String(command(thrown, "preflight").spawn_error), /port exploded/);
  for (const r of [timedOut, spawnError, thrown]) assert.equal(exitCode(r), 1);
});

test("empty, malformed, skipped or missing results fail; a failing required regression is named", async () => {
  const names = (id: string) => CONTROLS.find((c: { id: string }) => c.id === id)!.required.map((r: { name: string }) => r.name);
  const cases: [string, Record<string, (spec: Spec) => Partial<Outcome>>, string][] = [
    ["empty output", { end: () => ({ stdout: "" }) }, "end"],
    ["no TAP summary", { end: () => ({ stdout: names("end").map((n: string, i: number) => `ok ${i + 1} - ${n}`).join("\n") }) }, "end"],
    ["zero tests", { end: () => ({ stdout: tap([]) }) }, "end"],
    ["a skipped test", { end: () => ({ stdout: tap(names("end")).replace("# skipped 0", "# skipped 1") }) }, "end"],
    ["a required regression missing", { "e2e-runner": () => ({ stdout: tap(names("e2e-runner").slice(1)) }) }, "e2e-runner"],
    ["a failing required regression", { "e2e-runner": () => ({ code: 1, stdout: tap(names("e2e-runner"), [names("e2e-runner")[0]]) }) }, "e2e-runner"],
    ["malformed preflight", { preflight: () => ({ stdout: "GATE_PREFLIGHT {not json\n" }) }, "preflight"],
    ["failed preflight", { preflight: () => ({ stdout: `GATE_PREFLIGHT ${JSON.stringify({ ok: false, failures: ["pg: missing"] })}\n` }) }, "preflight"],
  ];
  for (const [label, over, id] of cases) {
    const result = await runClosure({ root: ROOT, runner: fake(over).runner });
    assert.equal(result.local_controls, "fail", label);
    assert.equal(command(result, id).ok, false, label);
    assert.equal(exitCode(result), 1, label);
  }
  const red = await runClosure({ root: ROOT, runner: fake({ "e2e-runner": () => ({ code: 1, stdout: tap(names("e2e-runner"), [names("e2e-runner")[0]]) }) }).runner });
  const serial = command(red, "e2e-runner").required.find((r) => r.id === "serial_vs_parallel")!;
  assert.equal(serial.status, "fail");

  // A failed preflight leaves the real controls unrun, which is itself a failure, not a pass by omission.
  const noPreflight = await runClosure({ root: ROOT, runner: fake({ preflight: () => ({ code: 1, stdout: "" }) }).runner });
  for (const c of CONTROLS) assert.equal(command(noPreflight, c.id).executed, false);
  assert.equal(noPreflight.local_controls, "fail");
});

test("fingerprint failures fail: a missing file, a checkout that is no git repo, and a file changed during the run", async () => {
  const empty = mkdtempSync(join(tmpdir(), "gate-closure-empty-"));
  const copy = mkdtempSync(join(tmpdir(), "gate-closure-fp-"));
  try {
    const missing = await runClosure({ root: empty, runner: fake().runner });
    assert.equal(missing.fingerprint.ok, false);
    assert.ok(missing.fingerprint.missing.includes("package-lock.json"));
    assert.equal(missing.checkout.git_sha, null);
    assert.equal(missing.local_controls, "fail");

    for (const p of FINGERPRINT_PATHS) {
      const from = join(ROOT, p);
      if (!existsSync(from)) continue;
      mkdirSync(dirname(join(copy, p)), { recursive: true });
      cpSync(from, join(copy, p), { recursive: true });
    }
    const changing = fake({
      urashima: () => {
        writeFileSync(join(copy, "lib/urashima.test.ts"), "// changed mid-run\n", { flag: "a" });
        return {};
      },
    });
    const changed = await runClosure({ root: copy, runner: changing.runner });
    assert.ok(changed.fingerprint.changed_during_run.includes("lib/urashima.test.ts"));
    assert.equal(changed.fingerprint.ok, false);
    assert.equal(exitCode(changed), 1);
  } finally {
    rmSync(empty, { recursive: true, force: true });
    rmSync(copy, { recursive: true, force: true });
  }
});

test("the real child runner keeps exits, bounds its tails, and kills a timed-out child's whole process group", async () => {
  const env: NodeJS.ProcessEnv = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  const spec = (args: string[], timeoutMs = 20_000, cmd = process.execPath) => ({ id: "t", command: cmd, args, cwd: ROOT, env, timeoutMs });

  // Each child exits from stdout.write's callback, once its output is flushed: an exit straight after the write
  // drops whatever the pipe has not taken yet, and a short read would then pass for the runner's bound.
  const KEPT = 1_000_000; // realRunChild keeps the last million characters of each stream
  const flushedExit = (out: string) => ["-e", `process.stdout.write(${out}, () => process.exit(3))`];

  const under = await realRunChild(spec(flushedExit("'x'.repeat(200000)")));
  assert.equal(under.code, 3);
  assert.equal(under.timedOut, false);
  assert.equal(under.stdout.length, 200_000, "output under the bound is kept whole");

  // Over the bound: 200,000 h then 1,000,000 t. The tail is kept and the head dropped.
  const over = await realRunChild(spec(flushedExit("'h'.repeat(200000) + 't'.repeat(1000000)")));
  assert.equal(over.code, 3);
  assert.equal(over.timedOut, false);
  assert.equal(over.stdout.length, KEPT, "output over the bound is cut to the bound");
  assert.ok(over.stdout.endsWith("t") && !over.stdout.includes("h"), "the last characters are the ones kept");

  const missing = await realRunChild(spec([], 5_000, join(tmpdir(), "gate-closure-no-such-binary")));
  assert.match(String(missing.error), /ENOENT/);
  assert.equal(missing.code, null);

  // The child starts a grandchild and then hangs; the timeout ends both.
  const marker = join(mkdtempSync(join(tmpdir(), "gate-closure-pg-")), "pid");
  try {
    const hung = await realRunChild(
      spec(
        ["-e", `const c=require("child_process").spawn(process.execPath,["-e","setInterval(()=>{},1000)"],{stdio:"ignore"});require("fs").writeFileSync(${JSON.stringify(marker)},String(c.pid));setInterval(()=>{},1000)`],
        1_500,
      ),
    );
    assert.equal(hung.timedOut, true);
    assert.ok(hung.signal, "a timed-out child reports the signal that ended it");
    const pid = Number(readFileSync(marker, "utf8"));
    let alive = true;
    for (let i = 0; i < 50 && alive; i++) {
      try {
        process.kill(pid, 0);
        await new Promise((r) => setTimeout(r, 100));
      } catch {
        alive = false;
      }
    }
    assert.equal(alive, false, `grandchild ${pid} outlived the timeout`);
  } finally {
    rmSync(dirname(marker), { recursive: true, force: true });
  }
});

const cliEnv = () => {
  const env: NodeJS.ProcessEnv = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  return env;
};

const runCli = (cwd: string) =>
  new Promise<{ code: number | null; stdout: string; stderr: string }>((done) => {
    const child = spawn(process.execPath, [CLI], { cwd, env: cliEnv() });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));
    child.on("close", (code) => done({ code, stdout, stderr }));
  });

const sha256 = (file: string) => createHash("sha256").update(readFileSync(file)).digest("hex");

test("the real CLI on this checkout runs the real regressions and prints one passing, fingerprinted v1 result", { timeout: 200_000 }, async () => {
  const { code, stdout, stderr } = await runCli(ROOT);
  const result = JSON.parse(stdout);
  assert.equal(code, 0, `${stderr}\n${JSON.stringify(result.failures)}`);
  assert.equal(result.schema, SCHEMA);
  assert.equal(result.runner, "real");
  assert.equal(result.certified, true);
  assert.equal(result.local_controls, "pass");
  assert.equal(result.external_evidence, "inconclusive");
  assert.equal(result.checkout.git_sha, execFileSync("git", ["rev-parse", "HEAD"], { cwd: ROOT, encoding: "utf8" }).trim());
  // Hashes are checked against the files themselves, not against the CLI's own arithmetic.
  for (const p of ["package-lock.json", "scripts/e2e.mjs", "lib/e2e-runner.test.ts", ".github/workflows/ci.yml", CLI]) {
    assert.equal(result.fingerprint.files[p], sha256(join(ROOT, p)), p);
  }
  assert.equal(result.preflight.ok, true);
  assert.match(result.preflight.assets.postgres.version, /PostgreSQL\) 17\./);
  for (const c of CONTROLS) {
    const run = command(result, c.id);
    assert.equal(run.executed, true);
    assert.equal(run.exit_code, 0);
    assert.ok(run.required.every((r) => r.status === "pass"), JSON.stringify(run.required));
  }
});

// Negative control: an isolated copy of this checkout (its own throwaway git repo, node_modules linked) whose
// scripts/e2e.mjs no longer passes --test-concurrency=1. The CLI there must fail on the serial regression and nothing
// else; restored in the copy, it passes again. The production checkout is never written.
test(
  "an isolated copy without serial enforcement in scripts/e2e.mjs fails the closure on the serial regression; restored, it passes",
  { timeout: 400_000, skip: availableParallelism() < 3 ? "node --test's default concurrency is already 1 on this host" : false },
  async () => {
    const before = sha256(join(ROOT, "scripts/e2e.mjs"));
    const parent = mkdtempSync(join(tmpdir(), "gate-closure-copy-"));
    const copy = join(parent, "otohime");
    try {
      const files = execFileSync("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard"], { cwd: ROOT, encoding: "utf8" })
        .split("\0")
        .filter((f) => f && existsSync(join(ROOT, f)));
      for (const f of files) {
        mkdirSync(dirname(join(copy, f)), { recursive: true });
        cpSync(join(ROOT, f), join(copy, f), { verbatimSymlinks: true });
      }
      symlinkSync(join(ROOT, "node_modules"), join(copy, "node_modules"));
      const git = (...args: string[]) =>
        spawnSync("git", ["-c", "user.name=gate-closure", "-c", "user.email=gate-closure@localhost", "-c", "commit.gpgsign=false", "-c", "core.hooksPath=/dev/null", ...args], { cwd: copy, encoding: "utf8" });
      assert.equal(git("init", "-q").status, 0);
      assert.equal(git("add", "-A").status, 0);
      assert.equal(git("commit", "-q", "-m", "copy").status, 0);

      const runner = join(copy, "scripts/e2e.mjs");
      const original = readFileSync(runner, "utf8");
      const mutated = original.replace('"--test-concurrency=1", ', "");
      assert.notEqual(mutated, original, "the serial enforcement was not found to remove");
      writeFileSync(runner, mutated);

      const red = await runCli(copy);
      const bad = JSON.parse(red.stdout);
      assert.notEqual(red.code, 0);
      assert.equal(bad.local_controls, "fail");
      assert.equal(bad.checkout.dirty, true);
      assert.equal(bad.fingerprint.files["scripts/e2e.mjs"], sha256(runner));
      assert.notEqual(bad.fingerprint.files["scripts/e2e.mjs"], sha256(join(ROOT, "scripts/e2e.mjs")));
      const e2e = command(bad, "e2e-runner");
      assert.equal(e2e.ok, false);
      assert.equal(e2e.required.find((r) => r.id === "serial_vs_parallel")!.status, "fail");
      assert.ok(e2e.required.filter((r) => r.id !== "serial_vs_parallel").every((r) => r.status === "pass"));
      for (const id of ["preflight", "end", "urashima"]) assert.equal(command(bad, id).ok, true, id);

      writeFileSync(runner, original);
      const green = await runCli(copy);
      assert.equal(green.code, 0, JSON.stringify(JSON.parse(green.stdout).failures));
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
    assert.equal(sha256(join(ROOT, "scripts/e2e.mjs")), before, "the production checkout's runner was written");
    assert.equal(existsSync(parent), false);
  },
);
