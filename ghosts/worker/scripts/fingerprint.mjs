// The Worker's public build fingerprint: sha256 over its code (src/ and the
// shared ghosts/{protocol,policy,room}.ts), its lock and its configuration.
// bundle:check and the deploy inject it as __GHOSTS_FINGERPRINT__, and GET
// /version serves it. Only file paths and hashes go in; nothing secret exists here.
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const PACKAGE_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const SHARED = ["../protocol.ts", "../policy.ts", "../room.ts"];
const CONFIG = ["package.json", "package-lock.json", "wrangler.jsonc"];

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
}

/** Paths relative to the Worker package, sorted, that make up the fingerprint. */
export function fingerprintFiles(root = PACKAGE_DIR) {
  const src = walk(join(root, "src"))
    .filter((path) => path.endsWith(".ts"))
    .map((path) => relative(root, path).split("\\").join("/"));
  return [...src, ...SHARED, ...CONFIG].sort();
}

export function fingerprint(root = PACKAGE_DIR) {
  const files = {};
  const all = createHash("sha256");
  for (const path of fingerprintFiles(root)) {
    const content = readFileSync(join(root, path));
    files[path] = createHash("sha256").update(content).digest("hex");
    all.update(`${path}\0${files[path]}\0`);
  }
  return { fingerprint: all.digest("hex"), files };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.stdout.write(`${JSON.stringify(fingerprint(), null, 2)}\n`);
}
