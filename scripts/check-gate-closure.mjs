// node scripts/check-gate-closure.mjs: the landed gate repairs' local closure, on demand. It runs this checkout's own
// regressions for them (lib/e2e-runner.test.ts: serial vs parallel e2e files, Actions vs local reporter, CI status
// preservation, the migrated embedded-Postgres lifecycle; lib/end.test.ts: the footer walk/probe wiring;
// lib/urashima.test.ts: the waterline) as nested `node --test` children, after a preflight of the locked modules and
// the embedded Postgres binaries, and prints one otohime.gate-closure.v1 JSON result on stdout.
//
// It exits 0 only when every required child actually ran and passed under the real runner: a spawn error, a nonzero
// exit, a signal, a timeout, missing, skipped or malformed results, a required regression that is absent or red, and a
// missing or changed fingerprinted file each exit 1. It proves the local controls it ran and nothing else: deployment,
// a global green gate, Kame's browser run, historical raw assertions, author.txt bytes and personalized presence stay
// unproven, and external_evidence is always "inconclusive". It fetches nothing and starts no browser.
// projects/pick-up-this-plan-https-apps-vietky-io-vn-plans-plans-pm-242/gate-closure.md documents the schema.
import { execFileSync, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const SCHEMA = "otohime.gate-closure.v1";
// The ceiling the contract allows each child; the three files take a few seconds together.
export const CHILD_TIMEOUT_MS = 180_000;
const PREFLIGHT_TIMEOUT_MS = 60_000;
// Children's output kept for parsing, and the part of it that goes into the result.
const KEEP_CHARS = 1_000_000;
const TAIL_CHARS = 4_000;

// Each control is a real test file and the regressions in it that must have run and passed, by their exact names.
export const CONTROLS = [
  {
    id: "ink-experiments",
    file: "lib/ink-experiments-gate.test.ts",
    required: [{ id: "ink_privacy_interaction_fallback_share", name: "ink experiment privacy interaction fallback and share gates are named and wired" }],
  },
  {
    id: "e2e-runner",
    file: "lib/e2e-runner.test.ts",
    required: [
      { id: "serial_vs_parallel", name: "scripts/e2e.mjs runs the e2e files one at a time; an explicit --test-concurrency=2 overlaps them (negative control)" },
      { id: "actions_vs_local_reporter", name: "under GitHub Actions scripts/e2e.mjs annotates each failed test with its file, line and assertion; outside it, nothing" },
      { id: "ci_status_preservation", name: "CI's E2E step keeps the suite's status and adds the server's log tail to the step summary when it fails" },
      { id: "embedded_postgres_lifecycle", name: "scripts/e2e.mjs --serve-db holds a migrated throwaway Postgres until SIGTERM, then stops it and removes its files" },
      { id: "fresh_production_build", name: "isolated E2E builds discard stale Next output, preserve explicit reuse and propagate build failures" },
    ],
  },
  {
    id: "end",
    file: "lib/end.test.ts",
    required: [
      { id: "footer_heading_source", name: "Footer walk reads the exact plain heading source, ignoring nested Riso plates" },
      { id: "footer_svg_structure", name: "Footer walk separates decorative layers from the named basket and rejects missing or extra SVGs" },
      { id: "footer_svg_probe", name: "Footer probe separates decorative SVGs from the named basket on real browser DOM" },
      { id: "footer_walk_probe_wiring", name: "walk-end.sh, probe-end.sh and CI checks wire the footer verification suite and handle unset, empty and long TMPDIR" },
    ],
  },
  {
    id: "urashima",
    file: "lib/urashima.test.ts",
    required: [{ id: "waterline_structure", name: "the waterline: the last thing in the site's footer, below its bar, links down to the palace" }],
  },
];

// The files whose bytes these results are about: the controls, what they exercise, the workflow and the lock.
// A directory is hashed as its sorted files.
export const FINGERPRINT_PATHS = [
  "scripts/ink-experiments-gate.mjs",
  "e2e/ink-experiments.test.ts",
  "scripts/check-gate-closure.mjs",
  "lib/gate-closure.test.ts",
  ...CONTROLS.map((c) => c.file),
  "scripts/e2e.mjs",
  "scripts/e2e-annotate.mjs",
  "scripts/walk-end.sh",
  "scripts/probe-end.sh",
  "scripts/probe-end.mjs",
  "scripts/probe-end-dom.mjs",
  "lib/end.ts",
  "lib/urashima.ts",
  "lib/pages.ts",
  "content/site.ts",
  "components/end-footer.tsx",
  "components/urashima-keys.tsx",
  "components/handheld.tsx",
  "app/(site)/layout.tsx",
  "app/(site)/globals.css",
  "drizzle.config.ts",
  "db/migrations",
  ".github/workflows/ci.yml",
  "package.json",
  "package-lock.json",
];

export const NOT_PROVEN = [
  "deployment",
  "global_green_gate",
  "shared_ci_recovery",
  "kame_browser_execution",
  "browser_user_path",
  "historical_raw_assertions",
  "author_txt_bytes",
  "personalized_presence",
];

const STRIP_TYPES = ["--experimental-strip-types", "--disable-warning=ExperimentalWarning", "--disable-warning=MODULE_TYPELESS_PACKAGE_JSON"];

// The preflight child: node_modules match package-lock.json, the modules the controls load import for real, and the
// embedded Postgres binaries are there and run. One GATE_PREFLIGHT line of JSON.
const PREFLIGHT = `
import { createHash } from "node:crypto";
import { accessSync, constants, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
const failures = [];
const lock = JSON.parse(readFileSync("package-lock.json", "utf8"));
const platformPkg = "@embedded-postgres/" + process.platform + "-" + process.arch;
const modules = {};
for (const name of ["playwright-core", "pg", "embedded-postgres", platformPkg]) {
  const locked = lock.packages?.["node_modules/" + name]?.version ?? null;
  let installed = null;
  try { installed = JSON.parse(readFileSync("node_modules/" + name + "/package.json", "utf8")).version; } catch {}
  let imported = false;
  try {
    const m = await import(name);
    imported = name === "playwright-core" ? typeof m.chromium?.launch === "function"
      : name === "pg" ? typeof (m.default ?? m).Client === "function"
      : name === "embedded-postgres" ? typeof m.default === "function"
      : typeof m.postgres === "string";
  } catch (e) { failures.push(name + ": import failed: " + e.message); }
  if (!locked) failures.push(name + ": not in package-lock.json");
  if (installed !== locked) failures.push(name + ": installed " + installed + " but locked " + locked);
  if (!imported) failures.push(name + ": import did not expose its API");
  modules[name] = { locked, installed, imported };
}
const assets = {};
try {
  const bins = await import(platformPkg);
  for (const bin of ["postgres", "initdb", "pg_ctl"]) {
    const file = bins[bin];
    try {
      accessSync(file, constants.X_OK);
      const version = execFileSync(file, ["--version"], { encoding: "utf8", timeout: 10000 }).trim();
      assets[bin] = { sha256: createHash("sha256").update(readFileSync(file)).digest("hex"), version };
    } catch (e) { failures.push(bin + ": " + e.message); assets[bin] = null; }
  }
} catch (e) { failures.push(platformPkg + ": " + e.message); }
console.log("GATE_PREFLIGHT " + JSON.stringify({ ok: failures.length === 0, modules, assets, failures }));
`;

const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");

function hashPath(abs) {
  const st = statSync(abs);
  if (!st.isDirectory()) return sha256(readFileSync(abs));
  const files = readdirSync(abs, { recursive: true, withFileTypes: true })
    .filter((d) => d.isFile())
    .map((d) => path.relative(abs, path.join(d.parentPath, d.name)))
    .sort();
  return sha256(files.map((f) => `${f}\0${sha256(readFileSync(path.join(abs, f)))}\n`).join(""));
}

export function fingerprint(root) {
  const files = {};
  for (const p of FINGERPRINT_PATHS) {
    const abs = path.join(root, p);
    files[p] = existsSync(abs) ? hashPath(abs) : null;
  }
  return files;
}

function checkout(root) {
  const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 30_000 });
  try {
    // A copy that is not its own repo must not report the enclosing repo's commit.
    if (path.resolve(git("rev-parse", "--show-toplevel").trim()) !== path.resolve(root)) throw new Error("not the top of a git checkout");
    const status = git("status", "--porcelain");
    return { root, git_sha: git("rev-parse", "HEAD").trim(), dirty: status.trim() !== "", dirty_paths: status.split("\n").filter(Boolean).slice(0, 50), git_error: null };
  } catch (e) {
    return { root, git_sha: null, dirty: null, dirty_paths: [], git_error: String(e.message).split("\n")[0] };
  }
}

const tail = (s) => (s.length > TAIL_CHARS ? s.slice(-TAIL_CHARS) : s);

/**
 * The child-runner port: the CLI uses realRunChild; tests swap in a fake, which certifies nothing.
 * @typedef {{ id: string, file?: string, command: string, args: string[], cwd: string, env: Record<string, string | undefined>, timeoutMs: number }} ChildSpec
 * @typedef {{ code: number | null, signal: string | null, timedOut: boolean, error: string | null, stdout: string, stderr: string, durationMs: number }} ChildOutcome
 * @typedef {{ kind: string, run: (spec: ChildSpec) => Promise<ChildOutcome> }} ChildRunner
 */

// The real port: one child in its own process group, killed whole on timeout, its output kept bounded.
/** @param {ChildSpec} spec @returns {Promise<ChildOutcome>} */
export function realRunChild({ command, args, cwd, env, timeoutMs }) {
  return new Promise((resolve) => {
    const started = Date.now();
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let error = null;
    let settled = false;
    const keep = (prev, chunk) => {
      const next = prev + chunk;
      return next.length > KEEP_CHARS ? next.slice(-KEEP_CHARS) : next;
    };
    let child;
    try {
      child = spawn(command, args, { cwd, env, stdio: ["ignore", "pipe", "pipe"], detached: true });
    } catch (e) {
      resolve({ code: null, signal: null, timedOut: false, error: String(e.message), stdout: "", stderr: "", durationMs: 0 });
      return;
    }
    const killGroup = (signal) => {
      try {
        process.kill(-child.pid, signal);
      } catch {}
    };
    let hard = null;
    const timer = setTimeout(() => {
      timedOut = true;
      killGroup("SIGTERM");
      hard = setTimeout(() => killGroup("SIGKILL"), 5_000);
    }, timeoutMs);
    const finish = (code, signal) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      clearTimeout(hard);
      // Whatever the child left behind in its group goes with it.
      if (child.pid) killGroup("SIGKILL");
      resolve({ code, signal, timedOut, error, stdout, stderr, durationMs: Date.now() - started });
    };
    child.stdout.on("data", (d) => (stdout = keep(stdout, d)));
    child.stderr.on("data", (d) => (stderr = keep(stderr, d)));
    child.on("error", (e) => {
      error = String(e.message);
      finish(null, null);
    });
    child.on("close", (code, signal) => finish(code, signal));
  });
}

// node:test TAP: top-level results by name, and the summary counts. null counts when the summary is not there.
export function parseTap(out) {
  const results = new Map();
  for (const line of out.split("\n")) {
    const m = /^(not ok|ok) \d+ - (.*?)(?: # (SKIP|TODO)\b.*)?$/.exec(line);
    if (m) results.set(m[2].replace(/\\#/g, "#"), m[3] ? m[3].toLowerCase() : m[1] === "ok" ? "pass" : "fail");
  }
  const counts = {};
  for (const key of ["tests", "pass", "fail", "cancelled", "skipped", "todo"]) {
    const m = new RegExp(`^# ${key} (\\d+)$`, "m").exec(out);
    counts[key] = m ? Number(m[1]) : null;
  }
  return { results, counts };
}

function record(spec, outcome) {
  return {
    id: spec.id,
    file: spec.file ?? null,
    argv: [spec.command === process.execPath ? "node" : spec.command, ...spec.args.filter((a) => !a.includes("\n"))],
    executed: true,
    exit_code: outcome.code,
    signal: outcome.signal,
    timed_out: outcome.timedOut,
    timeout_ms: spec.timeoutMs,
    spawn_error: outcome.error,
    duration_ms: outcome.durationMs,
    stdout_tail: tail(outcome.stdout),
    stderr_tail: tail(outcome.stderr),
  };
}

function processFailures(outcome) {
  const failures = [];
  if (outcome.error) failures.push(`spawn error: ${outcome.error}`);
  if (outcome.timedOut) failures.push("timed out");
  if (outcome.signal) failures.push(`ended by ${outcome.signal}`);
  if (outcome.code !== 0) failures.push(`exit ${outcome.code}`);
  return failures;
}

async function run(runner, spec) {
  try {
    return await runner.run(spec);
  } catch (e) {
    return { code: null, signal: null, timedOut: false, error: `runner threw: ${e?.message ?? e}`, stdout: "", stderr: "", durationMs: 0 };
  }
}

/** @param {{ root: string, runner?: ChildRunner, timeoutMs?: number }} options */
export async function runClosure({ root, runner = { kind: "real", run: realRunChild }, timeoutMs = CHILD_TIMEOUT_MS }) {
  const startedAt = new Date().toISOString();
  const env = { ...process.env };
  // Under a test runner's context a nested node --test reports to that runner instead of running its files.
  delete env.NODE_TEST_CONTEXT;
  const childTimeout = Math.min(timeoutMs, CHILD_TIMEOUT_MS);
  const before = fingerprint(root);
  const where = checkout(root);

  const preflightSpec = { id: "preflight", command: process.execPath, args: ["--input-type=module", "-e", PREFLIGHT], cwd: root, env, timeoutMs: Math.min(PREFLIGHT_TIMEOUT_MS, childTimeout) };
  const pre = await run(runner, preflightSpec);
  const preRecord = record(preflightSpec, pre);
  preRecord.failures = processFailures(pre);
  let preflight = null;
  const line = /^GATE_PREFLIGHT (.*)$/m.exec(pre.stdout ?? "");
  if (!line) preRecord.failures.push("no GATE_PREFLIGHT result");
  else {
    try {
      preflight = JSON.parse(line[1]);
      if (preflight.ok !== true) preRecord.failures.push(...(preflight.failures?.length ? preflight.failures : ["preflight not ok"]));
    } catch {
      preRecord.failures.push("malformed GATE_PREFLIGHT result");
    }
  }
  preRecord.ok = preRecord.failures.length === 0;

  const specs = CONTROLS.map((c) => ({ id: c.id, file: c.file, command: process.execPath, args: [...STRIP_TYPES, "--test", "--test-reporter=tap", c.file], cwd: root, env, timeoutMs: childTimeout }));
  // The controls run side by side; each is bounded by its own timeout.
  const outcomes = preRecord.ok ? await Promise.all(specs.map((s) => run(runner, s))) : specs.map(() => null);
  const commands = [preRecord];
  CONTROLS.forEach((control, i) => {
    const spec = specs[i];
    const outcome = outcomes[i];
    if (!outcome) {
      commands.push({ id: control.id, file: control.file, executed: false, ok: false, failures: ["not run: preflight failed"], required: control.required.map((r) => ({ ...r, status: "not_run" })) });
      return;
    }
    const rec = record(spec, outcome);
    const failures = processFailures(outcome);
    const { results, counts } = parseTap(outcome.stdout ?? "");
    if (Object.values(counts).some((n) => n === null)) failures.push("malformed TAP: no complete summary");
    else {
      if (counts.tests === 0 || results.size === 0) failures.push("no tests ran");
      if (counts.fail > 0) failures.push(`${counts.fail} failed`);
      if (counts.pass !== counts.tests) failures.push(`${counts.pass}/${counts.tests} passed`);
      for (const key of ["cancelled", "skipped", "todo"]) if (counts[key] > 0) failures.push(`${counts[key]} ${key}`);
    }
    const required = control.required.map((r) => ({ ...r, status: results.get(r.name) ?? "missing" }));
    for (const r of required) if (r.status !== "pass") failures.push(`${r.id}: ${r.status}`);
    commands.push({ ...rec, tap: counts, required, failures, ok: failures.length === 0 });
  });

  const after = fingerprint(root);
  const missing = FINGERPRINT_PATHS.filter((p) => before[p] === null);
  const changed = FINGERPRINT_PATHS.filter((p) => before[p] !== after[p]);
  const fingerprintFailures = [
    ...missing.map((p) => `fingerprint: ${p} missing`),
    ...changed.map((p) => `fingerprint: ${p} changed during the run`),
    ...(where.git_sha ? [] : [`checkout: no git identity (${where.git_error})`]),
  ];
  const failures = [...fingerprintFailures, ...commands.flatMap((c) => c.failures.map((f) => `${c.id}: ${f}`))];
  const localControls = failures.length === 0 ? "pass" : "fail";
  return {
    schema: SCHEMA,
    started_at: startedAt,
    finished_at: new Date().toISOString(),
    runner: runner.kind,
    // Only the real runner's children are evidence; a fake port exercises this logic and certifies nothing.
    certified: runner.kind === "real" && localControls === "pass",
    checkout: where,
    runtime: { node: process.version, platform: process.platform, arch: process.arch, test_runner: "node --experimental-strip-types --test --test-reporter=tap" },
    fingerprint: {
      algorithm: "sha256",
      files: before,
      combined: sha256(FINGERPRINT_PATHS.map((p) => `${p}\0${before[p] ?? "missing"}\n`).join("")),
      missing,
      changed_during_run: changed,
      ok: missing.length === 0 && changed.length === 0,
    },
    preflight,
    commands,
    local_controls: localControls,
    failures,
    external_evidence: "inconclusive",
    not_proven: NOT_PROVEN,
    scope:
      "Local unit regressions for the landed runner, reporter, CI-status, embedded-Postgres and footer/waterline repairs in this checkout. " +
      "No browser, no network fetch, no CI history and no deployment are read or proven.",
  };
}

export const exitCode = (result) => (result.certified === true && result.runner === "real" && result.local_controls === "pass" ? 0 : 1);

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = await runClosure({ root: path.join(import.meta.dirname, "..") });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  process.exitCode = exitCode(result);
}
