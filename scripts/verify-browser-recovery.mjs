// Execute all seven t-1625 contracts and require positive evidence, not just exit 0.
// node scripts/verify-browser-recovery.mjs <artifact-directory>
import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createWriteStream, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { test } from "node:test";
import { assertTapEvidence } from "./ci-probe-verification.mjs";

const root = resolve(import.meta.dirname, "..");
const ts = "node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON";
const isolated = "env -u BASE_URL -u SKIP_BUILD -u DATABASE_URL -u EXPECT_SHA";

// Require every literal test declared by the current sources. Floors additionally
// prevent a truncated inventory or feature-only run from certifying the composition.
export function namedTests(files) {
  return files.flatMap((file) => [...readFileSync(resolve(root, file), "utf8")
    .matchAll(/^\s*test\(\s*(["'])(.*?)\1\s*,/gm)].map((match) => match[2]));
}
const foundations = ["lib/kame.test.ts", "lib/tactile.test.ts", "lib/tear.test.ts", "lib/kame-fetch.test.ts"];
const browsers = readdirSync(resolve(root, "e2e"), { recursive: true })
  .filter((file) => file.endsWith(".test.ts")).sort().map((file) => `e2e/${file}`);

export const GATES = [
  { id: "foundation", name: "foundation policy", cmd: `${ts} --test ${foundations.join(" ")}`, minimum: 21, required: namedTests(foundations) },
  { id: "repository", name: "repository suite under CI", cmd: "npm test", minimum: 2515, required: [
    "Footer walk reads the exact plain heading source, ignoring nested Riso plates",
    "Footer network ownership rechecks a blank iframe when its player src arrives and rejects a footer twin",
    "walk-end.sh, probe-end.sh and CI checks wire the footer verification suite and handle unset, empty and long TMPDIR",
    "browser recovery rejects exit-zero, missing, renamed, skipped and failed contract evidence",
  ] },
  { id: "static", name: "lint and type contracts", cmd: "npm run lint && npm run typecheck", required: ["> eslint", "> next typegen && tsc --noEmit", "Types generated successfully"] },
  { id: "browser", name: "entire isolated production browser suite", cmd: `${isolated} npm run test:e2e`, minimum: 187, required: namedTests(browsers) },
  { id: "walk", name: "isolated footer walk", cmd: `${isolated} bash scripts/walk-end.sh`, minimum: 67, summary: "walk", required: [
    "/ has one semantic .end footer after main with canonical links, scene, knobs and UTC year",
    "/projects has one semantic .end footer after main with canonical links, scene, knobs and UTC year",
    "/does-not-exist shows the lost sheet 404", "local server logged no runtime errors", "no server left on port 4081",
  ] },
  { id: "footer", name: "isolated footer Chrome probe", cmd: `${isolated} bash scripts/probe-end.sh`, minimum: 173, summary: "probe", required: [
    "negative control: verifyCanonicalLinks rejects a corrupted canonical footer href (/broken-play !== /play)",
    "errors: zero console errors or page errors across all contexts",
    "network delayed-src setup: the player's attached iframe starts without an embed URL",
    "network delayed-src negative control: the same embed URL in the footer remains unexpected",
    "local 390x844 reduced-motion 403 exit: repeated full-load /admin/roles -> /projects -> full-load /admin/roles -> /dashboard preserves access denial, noindex, 1 visible footer, normal navigation, zero abort digests and zero page/console errors",
  ] },
  { id: "motion", name: "isolated signed-in motion", cmd: `${isolated} bash scripts/probe-motion-signed-in.sh`, minimum: 356, summary: "probe", required: [
    "negative: the probe stripped the pagereveal guard from /dashboard's HTML",
    'negative: without the guard a sign-in logs "Transition was skipped"',
    "390x844 reduced motion plain 403 (page.goto) -> /dashboard by the nav's Dashboard: completes, with every transition animation 0 ms",
    "390x844 plain 403 (page.goto) -> /dashboard by the nav's Dashboard: the 403 fades out (150 ms) and the next page fades in (210 ms after 150 ms)",
  ] },
];

export function assertEvidence(id, output, exitCode = 0) {
  const gate = GATES.find((gate) => gate.id === id);
  assert.ok(gate, `unknown contract: ${id}`);
  assert.equal(exitCode, 0, `${gate.name}: command failed`);
  if (id === "static") {
    for (const tool of gate.required) assert.ok(output.includes(tool), `tool completion absent: ${tool}`);
    return { tools: ["eslint", "next typegen", "tsc --noEmit"], boundary: "static analysis; exit statuses and completion identities" };
  }
  if (!gate.summary) {
    // node:test escapes hashes in TAP names (e.g. "its \\#section"). Decode
    // only result names; keep skip directives, diagnostics and counters intact.
    const tap = output.replace(/^(\s*ok \d+ - )(.*)$/gm,
      (_, prefix, name) => prefix + name.replace(/\\([#\\])/g, "$1"));
    const result = assertTapEvidence(tap, gate.required);
    assert.ok(result.tests >= gate.minimum, `incomplete ${gate.name}: ${result.tests} < ${gate.minimum}`);
    return result;
  }
  const lines = output.split("\n");
  for (const name of gate.required) assert.ok(lines.includes(`ok - ${name}`), `required assertion absent: ${name}`);
  assert.doesNotMatch(output, /^not ok\b/m);
  const summaries = lines.filter((line) => line.startsWith(`${gate.summary}:`));
  assert.equal(summaries.length, 1, "one complete probe summary required");
  const count = summaries[0].match(/: (\d+) ok, 0 failed$/);
  assert.ok(count && Number(count[1]) >= gate.minimum, "probe must execute its complete assertion matrix");
  assert.equal(lines.filter((line) => line.startsWith("ok - ")).length, Number(count[1]), "summary must match observed assertions");
  return { assertions: Number(count[1]), required: gate.required };
}

async function execute(gate, directory, env) {
  const file = resolve(directory, `${gate.id}.log`);
  const stream = createWriteStream(file);
  const code = await new Promise((done, reject) => {
    const child = spawn("bash", ["-eo", "pipefail", "-c", gate.cmd], { cwd: root, env, stdio: ["ignore", "pipe", "pipe"] });
    child.stdout.on("data", (data) => stream.write(data));
    child.stderr.on("data", (data) => stream.write(data));
    child.on("error", reject);
    child.on("close", (code) => stream.end(() => done(code)));
  });
  assert.equal(code, 0, `${gate.name}: see ${file}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const directory = resolve(process.argv[2] || "artifacts/browser-recovery");
  mkdirSync(directory, { recursive: true });
  const sha = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
  const env = { ...process.env, CI: "true", TMPDIR: "/tmp", GITHUB_SHA: sha };
  // Nested node:test must run its own children, not inherit the parent's IPC context.
  delete env.NODE_TEST_CONTEXT;
  const receipts = [];
  for (const gate of GATES) {
    test(gate.name, { timeout: 1_800_000 }, async () => {
      await execute(gate, directory, env);
      const output = readFileSync(resolve(directory, `${gate.id}.log`), "utf8");
      const evidence = assertEvidence(gate.id, output);
      const buildId = ["browser", "walk", "footer", "motion"].includes(gate.id)
        ? readFileSync(resolve(root, ".next/BUILD_ID"), "utf8").trim() : undefined;
      receipts.push({ id: gate.id, name: gate.name, cmd: gate.cmd, sha, build_id: buildId, mode: "executed locally", log_sha256: createHash("sha256").update(output).digest("hex"), evidence });
      writeFileSync(resolve(directory, "verification.json"), JSON.stringify(receipts, null, 2) + "\n");
    });
  }
}
