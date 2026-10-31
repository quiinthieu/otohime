import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../../..");

function ensureDependencies() {
  const nextBin = path.join(REPO_ROOT, "node_modules", ".bin", "next");
  if (fs.existsSync(nextBin)) return;
  const res = spawnSync("npm", ["ci", "--prefer-offline", "--no-audit", "--no-fund"], {
    cwd: REPO_ROOT,
    env: { ...process.env, TMPDIR: "/tmp" },
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  });
  if (res.status !== 0) {
    throw new Error(`npm ci failed (${res.status}):\n${res.stdout}\n${res.stderr}`);
  }
}

function runStep(name, cmd, args, extraEnv = {}) {
  const start = Date.now();
  const res = spawnSync(cmd, args, {
    cwd: REPO_ROOT,
    env: {
      ...process.env,
      TMPDIR: "/tmp",
      ...extraEnv,
    },
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  });
  return {
    name,
    status: res.status ?? 1,
    durationMs: Date.now() - start,
    stdout: res.stdout ?? "",
    stderr: res.stderr ?? "",
  };
}

function verifyGatesContract(results) {
  for (const step of results) {
    assert.equal(
      step.status,
      0,
      `Gate "${step.name}" must exit 0 (got ${step.status}):\n${step.stdout}\n${step.stderr}`,
    );
  }

  const lintStep = results.find((r) => r.name === "lint");
  assert.ok(lintStep, "lint step must be recorded");
  assert.match(lintStep.stdout, /> eslint/, "npm run lint must invoke eslint");

  const typecheckStep = results.find((r) => r.name === "typecheck");
  assert.ok(typecheckStep, "typecheck step must be recorded");
  assert.match(typecheckStep.stdout, /tsc --noEmit/, "npm run typecheck must invoke tsc --noEmit");

  const testStep = results.find((r) => r.name === "test");
  assert.ok(testStep, "test step must be recorded");
  assert.match(testStep.stdout, /ℹ fail 0|# fail 0/, "node --test must report 0 failures");

  const authorStep = results.find((r) => r.name === "deploy_author");
  assert.ok(authorStep, "deploy_author step must be recorded");
  assert.match(
    authorStep.stdout,
    /Deployment author verified: quiinthieu@gmail\.com/,
    "Commit author check must verify quiinthieu@gmail.com",
  );
}

ensureDependencies();
const isNegativeControl = process.argv.includes("--negative-control");

if (isNegativeControl) {
  // Exercise real check-deploy-author.mjs with a mismatched DEPLOY_AUTHOR_EMAIL and feed the
  // real nonzero gate result into the exact same verifyGatesContract() oracle.
  const badAuthorStep = runStep("deploy_author", "node", ["scripts/check-deploy-author.mjs"], {
    DEPLOY_AUTHOR_EMAIL: "wrong-author@example.com",
  });
  verifyGatesContract([badAuthorStep]);
  console.error("ERROR: verifyGatesContract failed to reject broken gate result");
  process.exit(0);
} else {
  const results = [
    runStep("lint", "npm", ["run", "lint"]),
    runStep("typecheck", "npm", ["run", "typecheck"]),
    runStep("test", "npm", ["test"]),
    runStep("deploy_author", "node", ["scripts/check-deploy-author.mjs"], {
      DEPLOY_AUTHOR_EMAIL: "quiinthieu@gmail.com",
    }),
  ];
  verifyGatesContract(results);
  console.log(
    JSON.stringify({
      ok: true,
      case: "t1882-lint-typecheck-and-unit-tests",
      steps: results.map((r) => ({
        name: r.name,
        status: r.status,
        durationMs: r.durationMs,
      })),
    }),
  );
}
