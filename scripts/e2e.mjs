// npm run test:e2e. With BASE_URL set (CI, scripts/e2e-local.sh) the suite runs against that server as it is.
// Without it, the suite brings its own: a throwaway embedded Postgres 17 (real binaries from the
// embedded-postgres package, no docker), the migrations, a production build and `next start`, on free ports.
// The server, the database and its files are removed on exit, however it ends.
// Fresh builds discard .next first: a lease's stale Turbopack font import map can break an otherwise unchanged build.
//   SKIP_BUILD  1 reuses the existing .next build and leaves its output/cache intact
// The test files run one at a time: several count animation frames (the desk's leaves, the Ink Press's and Ryugu-jo's
// WebGL loops), and files run side by side starve each other's browsers of them (the leaves turned through 6 poses
// and the sea drew 7 to 10 frames with eleven files at once), so a correct page fails its frame floor. A later
// --test-concurrency on the command line still wins.
// Under GitHub Actions (GITHUB_ACTIONS=true) scripts/e2e-annotate.mjs reports beside the TAP output: the job log needs a
// token to read, so each failed test also becomes an ::error annotation and a section of the step summary.
// A suite that fails with the server this script started prints the end of that server's log before it is removed.
//
// node scripts/e2e.mjs --serve-db <dir> starts only the throwaway database, under <dir>, with the migrations applied;
// prints DATABASE_URL=... once it is ready, and on SIGTERM or SIGINT stops it and removes <dir>. scripts/walk-end.sh
// and scripts/probe-end.sh use it when no database answers and Docker is not there.
import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, openSync, readFileSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";

const ROOT = path.join(import.meta.dirname, "..");
// The suite is this process's own node flags and arguments (package.json's test:e2e), run in a child.
const ARGS = process.argv.slice(2);
const ANNOTATE =
  process.env.GITHUB_ACTIONS === "true" && !ARGS.some((a) => a.startsWith("--test-reporter"))
    ? [
        "--test-reporter=tap",
        "--test-reporter-destination=stdout",
        `--test-reporter=${path.join(import.meta.dirname, "e2e-annotate.mjs")}`,
        "--test-reporter-destination=stdout",
      ]
    : [];
const SUITE = [...process.execArgv, "--test-concurrency=1", ...ANNOTATE, ...ARGS];
const SERVE_DB = process.argv[2] === "--serve-db" ? process.argv[3] : "";

const run = (cmd, args, env = process.env) =>
  new Promise((resolve) => {
    const child = spawn(cmd, args, { cwd: ROOT, env, stdio: "inherit" });
    child.on("error", () => resolve(1));
    child.on("exit", (code, signal) => resolve(code ?? (signal ? 1 : 0)));
  });

if (process.env.BASE_URL && !SERVE_DB) process.exit(await run(process.execPath, SUITE));

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
const work = SERVE_DB ? path.resolve(SERVE_DB) : mkdtempSync(path.join(tmpdir(), "otohime-e2e-"));
if (SERVE_DB) mkdirSync(work, { recursive: true });
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
    // Bounded: a Ctrl-C reaches Postgres too, and stop() then waits for an exit that has already happened.
    if (db) await Promise.race([db.stop().catch(() => {}), sleep(10_000)]);
    rmSync(work, { recursive: true, force: true });
  })();
  return cleaning;
}
const SIGNALS = [
  ["SIGINT", 130],
  ["SIGTERM", 143],
];
// The signals are cleanup()'s alone. embedded-postgres registers its own (async-exit-hook), which stops the database
// and exits as soon as it is down, before cleanup() has ended the server or removed the work dir; startDb() drops it.
function ownSignals() {
  for (const [signal, code] of SIGNALS) {
    process.removeAllListeners(signal);
    process.on(signal, () => void cleanup().then(() => process.exit(code)));
  }
}
ownSignals();

// The throwaway database: embedded Postgres 17 under work/pg on a free port, the otohime database, the migrations.
async function startDb() {
  const { default: EmbeddedPostgres } = await import("embedded-postgres");
  ownSignals();
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
  const url = `postgresql://otohime:otohime@127.0.0.1:${dbPort}/otohime`;
  console.log("Applying migrations");
  if ((await run("npm", ["run", "db:migrate"], { ...process.env, DATABASE_URL: url })) !== 0) return "";
  return url;
}

// --serve-db: hold the database until told to stop; the signal handlers above clean it up.
async function serveDb() {
  const url = await startDb();
  if (!url) return 1;
  // On a line of its own: the migration log above may not end with a newline.
  process.stdout.write(`\nDATABASE_URL=${url}\n`);
  await new Promise(() => {});
}

async function main() {
  const databaseUrl = await startDb();
  if (!databaseUrl) return 1;

  const appPort = await freePort();
  const base = `http://localhost:${appPort}`;
  const env = {
    ...process.env,
    DATABASE_URL: databaseUrl,
    BETTER_AUTH_URL: base,
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET || "ci-placeholder-not-a-real-secret-0123456789abcdef",
  };

  if (process.env.SKIP_BUILD !== "1") {
    rmSync(path.join(ROOT, ".next"), { recursive: true, force: true });
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

  const status = await run(process.execPath, SUITE, { ...env, BASE_URL: base });
  if (status !== 0) {
    console.error("The suite failed. The end of the server's log:");
    console.error(readFileSync(log, "utf8").split("\n").slice(-80).join("\n"));
  }
  return status;
}

let status = 1;
try {
  status = await (SERVE_DB ? serveDb() : main());
} catch (e) {
  console.error(e);
} finally {
  await cleanup();
}
process.exit(status);
