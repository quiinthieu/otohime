import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const script = fileURLToPath(new URL("./check-deploy-author.mjs", import.meta.url));
const owner = "owner@example.test";

test("deployment checks the Git author rather than the committer or uploader", (t) => {
  const cwd = mkdtempSync(path.join(tmpdir(), "deploy-author-"));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  const env = { ...process.env, GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: "/dev/null",
    GIT_AUTHOR_NAME: "Owner", GIT_AUTHOR_EMAIL: owner,
    GIT_COMMITTER_NAME: "Owner", GIT_COMMITTER_EMAIL: owner };
  const git = (args, overrides = {}) => execFileSync("git", args, { cwd, env: { ...env, ...overrides }, stdio: "pipe" });
  git(["init", "-q"]);
  git(["-c", "core.hooksPath=/dev/null", "-c", "commit.gpgsign=false", "commit", "--allow-empty", "-qm", "Owner revision"]);
  const check = (email) => {
    const checkEnv = { ...env };
    delete checkEnv.DEPLOY_AUTHOR_EMAIL;
    if (email !== undefined) checkEnv.DEPLOY_AUTHOR_EMAIL = email;
    return spawnSync(process.execPath, [script], { cwd, env: checkEnv, encoding: "utf8" });
  };
  assert.equal(check().status, 2, "missing owner configuration must fail closed");
  assert.equal(check(owner).status, 0, "owner-authored revision can deploy");
  git(["-c", "core.hooksPath=/dev/null", "-c", "commit.gpgsign=false", "commit", "--allow-empty", "-qm", "Agent revision"],
    { GIT_AUTHOR_NAME: "Claude Code", GIT_AUTHOR_EMAIL: "noreply@anthropic.com" });
  const rejected = check(owner);
  assert.equal(rejected.status, 1, "an owner committer cannot make a different author deployable");
  assert.match(rejected.stderr, /committing automation/);
  assert.match(rejected.stderr, /noreply@anthropic\.com/);
});
