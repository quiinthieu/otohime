/** Reuse the production e2e lifecycle (database, build, server, signals and cleanup).
 * The worker receives BASE_URL and invokes both unchanged gates in remote mode.
 */
import { spawn } from "node:child_process";
import { execFileSync } from "node:child_process";
import { test } from "node:test";

async function run(command, args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit", env, detached: true });
    const forward = (signal) => { try { process.kill(-child.pid, signal); } catch {} };
    const interrupt = () => forward("SIGINT");
    const terminate = () => forward("SIGTERM");
    process.on("SIGINT", interrupt);
    process.on("SIGTERM", terminate);
    const done = () => { process.off("SIGINT", interrupt); process.off("SIGTERM", terminate); };
    child.on("error", (error) => { done(); reject(error); });
    child.on("exit", (code) => { done(); resolve(code ?? 1); });
  });
}
if (process.env.BOTTLE_FOOTER_WORKER === "1") {
  test("CI-mode production footer walk and Chromium probe", { timeout: 600_000 }, async () => {
    for (const script of ["scripts/walk-end.sh", "scripts/probe-end.sh"]) {
      const status = await run("bash", [script], process.env);
      if (status !== 0) throw new Error(`${script} exited ${status}`);
    }
  });
} else {
  const sha = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  console.log(`Bottle footer delivery HEAD: ${sha}`);
  const env = { ...process.env, CI: "true", TMPDIR: "/tmp", GITHUB_SHA: sha, EXPECT_SHA: sha, BOTTLE_FOOTER_WORKER: "1" };
  // Always isolated and fresh, even when the calling shell has these runner switches.
  delete env.BASE_URL;
  delete env.SKIP_BUILD;
  process.exitCode = await run(process.execPath, ["scripts/e2e.mjs", "--test", "scripts/verify-bottle-footer.mjs"], env);
}
