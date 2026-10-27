import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const script = fileURLToPath(new URL("./setup-owner-git.sh", import.meta.url));

test("owner setup stays local and detects environment overrides", (t) => {
  const cwd = mkdtempSync(path.join(tmpdir(), "otohime-owner-git-"));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  const env = { ...process.env, GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: path.join(cwd, "global.gitconfig") };
  for (const key of ["GIT_AUTHOR_NAME", "GIT_AUTHOR_EMAIL", "GIT_AUTHOR_DATE", "GIT_COMMITTER_NAME", "GIT_COMMITTER_EMAIL", "GIT_COMMITTER_DATE"]) delete env[key];
  const git = (...args) => execFileSync("git", args, { cwd, env, encoding: "utf8" }).trim();
  git("init", "-q");
  mkdirSync(path.join(cwd, "scripts"));
  const localScript = path.join(cwd, "scripts", "setup-owner-git.sh");
  copyFileSync(script, localScript);
  git("config", "--global", "user.name", "Existing Work Identity");
  git("config", "--global", "user.email", "work@example.test");
  git("config", "--local", "otohime.test-setting", "keep");
  const run = (arg, extra = {}) => spawnSync("bash", [localScript, arg], { cwd, env: { ...env, ...extra }, encoding: "utf8" });
  assert.equal(run("--check").status, 1, "a different effective author fails before committing");
  assert.equal(run("--configure").status, 0, "explicit setup configures this clone");
  assert.equal(run("--check").status, 0);
  assert.equal(git("config", "--local", "user.name"), "Otohime");
  assert.equal(git("config", "--local", "user.email"), "quiinthieu@gmail.com");
  assert.equal(git("config", "--global", "user.email"), "work@example.test", "global identity is untouched");
  assert.equal(git("config", "--local", "otohime.test-setting"), "keep", "unrelated repo config is untouched");
  const overridden = run("--check", { GIT_AUTHOR_NAME: "Claude Code", GIT_AUTHOR_EMAIL: "noreply@anthropic.com" });
  assert.equal(overridden.status, 1, "environment authors override repo config and are rejected");
  assert.match(overridden.stderr, /GIT_AUTHOR_EMAIL/);
  assert.equal(run("--check", { GIT_AUTHOR_NAME: "Billie", GIT_AUTHOR_EMAIL: "quiinthieu@gmail.com" }).status, 0,
    "Vercel eligibility depends on the verified email, not the display name");
  assert.equal(run("--bad-option").status, 2);
  const other = mkdtempSync(path.join(tmpdir(), "otohime-other-git-"));
  t.after(() => rmSync(other, { recursive: true, force: true }));
  execFileSync("git", ["init", "-q"], { cwd: other, env });
  const wrongRepo = spawnSync("bash", [localScript, "--configure"], { cwd: other, env, encoding: "utf8" });
  assert.equal(wrongRepo.status, 2, "the script must not change an unrelated checkout");
  const otherEmail = spawnSync("git", ["config", "--local", "--get", "user.email"], { cwd: other, env, encoding: "utf8" });
  assert.equal(otherEmail.status, 1, "the unrelated checkout received no local identity");
});
