// npm run test:e2e. With BASE_URL set (CI, scripts/e2e-local.sh) the suite runs against that server as it is.
// Without it, the suite brings its own: a throwaway embedded Postgres 17 (real binaries from the
// embedded-postgres package, no docker), the migrations, a production build and `next start`, on free ports.
// The server, the database and its files are removed on exit, however it ends.
//   SKIP_BUILD  1 reuses the existing .next build
import { spawn } from "node:child_process";
import { mkdtempSync, openSync, readFileSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";

const ROOT = path.join(import.meta.dirname, "..");
// The suite is this process's own node flags and arguments (package.json's test:e2e), run in a child.
const SUITE = [...process.execArgv, ...process.argv.slice(2)];

const run = (cmd, args, env = process.env) =>
  new Promise((resolve) => {
    const child = spawn(cmd, args, { cwd: ROOT, env, stdio: "inherit" });
    child.on("error", () => resolve(1));
    child.on("exit", (code, signal) => resolve(code ?? (signal ? 1 : 0)));
  });

if (process.env.BASE_URL) process.exit(await run(process.execPath, SUITE));

// A free port: ask the kernel for one, then hand it on.
const freePort = () =>
  new Promise((resolve, reject) => {
    const s = createServer().listen(0, "127.0.0.1", () => {
      const { port } = s.address();
      s.close(() => resolve(port));
    });
    s.on("error", reject);
  });

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let server = null;
let db = null;
const work = mkdtempSync(path.join(tmpdir(), "otohime-e2e-"));
const log = path.join(work, "server.log");

let cleaning = null;
function cleanup() {
  cleaning ??= (async () => {
    if (server && server.exitCode === null) {
      // The server leads its own process group (detached): end the whole group.
      try {
        process.kill(-server.pid, "SIGTERM");
      } catch {}
      for (let i = 0; i < 20 && server.exitCode === null; i++) await sleep(250);
      try {
        process.kill(-server.pid, "SIGKILL");
      } catch {}
    }
    if (db) await db.stop().catch(() => {});
    rmSync(work, { recursive: true, force: true });
  })();
  return cleaning;
}
for (const [signal, code] of [
  ["SIGINT", 130],
  ["SIGTERM", 143],
]) {
  process.on(signal, () => void cleanup().then(() => process.exit(code)));
}

async function main() {
  const { default: EmbeddedPostgres } = await import("embedded-postgres");
  const dbPort = await freePort();
  console.log(`Starting embedded Postgres on 127.0.0.1:${dbPort}`);
  db = new EmbeddedPostgres({
    databaseDir: path.join(work, "pg"),
    port: dbPort,
    user: "otohime",
    password: "otohime",
    persistent: false,
    onLog: () => {},
  });
  await db.initialise();
  await db.start();
  await db.createDatabase("otohime");

  const appPort = await freePort();
  const base = `http://localhost:${appPort}`;
  const env = {
    ...process.env,
    DATABASE_URL: `postgresql://otohime:otohime@127.0.0.1:${dbPort}/otohime`,
    BETTER_AUTH_URL: base,
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET || "ci-placeholder-not-a-real-secret-0123456789abcdef",
  };

  console.log("Applying migrations");
  if ((await run("npm", ["run", "db:migrate"], env)) !== 0) return 1;

  if (process.env.SKIP_BUILD !== "1") {
    console.log("Building");
    if ((await run("npm", ["run", "build"], env)) !== 0) return 1;
  }

  console.log(`Starting the server on ${base}`);
  // Not NODE_ENV=test, which turns Better Auth's origin checks off.
  const out = openSync(log, "a");
  server = spawn("npm", ["start"], {
    cwd: ROOT,
    env: { ...env, PORT: String(appPort), NODE_ENV: "production" },
    stdio: ["ignore", out, out],
    detached: true,
  });

  let up = false;
  for (let i = 0; i < 60 && !up && server.exitCode === null; i++) {
    up = await fetch(`${base}/api/health`).then(
      (r) => r.ok,
      () => false,
    );
    if (!up) await sleep(1000);
  }
  if (!up) {
    console.error("The server did not answer /api/health. Its log:");
    console.error(readFileSync(log, "utf8").split("\n").slice(-40).join("\n"));
    return 1;
  }

  return run(process.execPath, SUITE, { ...env, BASE_URL: base });
}

let status = 1;
try {
  status = await main();
} catch (e) {
  console.error(e);
} finally {
  await cleanup();
}
process.exit(status);
