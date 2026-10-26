// bundle:check: compile the Worker exactly as a deploy would (wrangler deploy
// --dry-run, no credentials, nothing uploaded) into a temporary directory and
// assert the bundle: both exports, the injected fingerprint, and none of the
// APIs this Worker promises not to use.
import { spawnSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PACKAGE_DIR, fingerprint } from "./fingerprint.mjs";

const FORBIDDEN = [
  ["console.", "visitor logs"],
  ["ctx.storage", "Durable Object storage"],
  [".storage.", "Durable Object storage"],
  ["setAlarm", "alarms"],
  [".sql", "SQL"],
  ["cf-connecting-ip", "visitor IP"],
  ["user-agent", "visitor UA"],
  ["cookie", "cookies"],
  ["__test", "test-only hooks"],
];

const out = mkdtempSync(join(tmpdir(), "ghosts-bundle-"));
let failed = false;
const fail = (message) => {
  failed = true;
  console.error(`bundle:check FAIL ${message}`);
};
try {
  const { fingerprint: id } = fingerprint();
  const result = spawnSync(
    join(PACKAGE_DIR, "node_modules", ".bin", "wrangler"),
    ["deploy", "--dry-run", "--outdir", out, "--define", `__GHOSTS_FINGERPRINT__:${JSON.stringify(id)}`],
    {
      cwd: PACKAGE_DIR,
      encoding: "utf8",
      env: { ...process.env, WRANGLER_SEND_METRICS: "false", WRANGLER_LOG_PATH: join(out, "logs") },
    },
  );
  process.stdout.write(result.stdout ?? "");
  process.stderr.write(result.stderr ?? "");
  if (result.status !== 0) throw new Error(`wrangler deploy --dry-run exited ${result.status}`);
  const bundles = readdirSync(out).filter((name) => name.endsWith(".js"));
  if (bundles.length !== 1) throw new Error(`expected one bundle in ${out}, found ${bundles.join(", ") || "none"}`);
  const code = readFileSync(join(out, bundles[0]), "utf8");
  // workerd treats every export as an entrypoint, so the bundle exports exactly these two.
  const exported = [...code.matchAll(/export\s*\{([^}]*)\}/g)]
    .flatMap((match) => match[1].split(","))
    .map((name) => name.trim().split(/\s+as\s+/).pop())
    .filter(Boolean)
    .sort();
  if (exported.join(",") !== "GhostRoom,default") fail(`exports are [${exported.join(", ")}], expected [GhostRoom, default]`);
  if (/^export\s+(const|let|var|function|class|default)\b/m.test(code)) fail("unexpected inline export");
  if (!code.includes(JSON.stringify(id))) fail(`fingerprint ${id} is not in the bundle`);
  if (code.includes("__GHOSTS_FINGERPRINT__") && !code.includes("typeof")) fail("fingerprint was not substituted");
  const lower = code.toLowerCase();
  for (const [needle, what] of FORBIDDEN) if (lower.includes(needle.toLowerCase())) fail(`bundle mentions ${needle} (${what})`);
  if (!failed) console.log(`bundle:check PASS ${bundles[0]} ${code.length} bytes, fingerprint ${id}`);
} catch (error) {
  fail(error.message);
} finally {
  rmSync(out, { recursive: true, force: true });
}
process.exit(failed ? 1 : 0);
