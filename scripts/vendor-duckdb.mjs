import { copyFile, mkdir, readFile } from "node:fs/promises";
const version = "1.33.1-dev57.0";
const pkg = JSON.parse(await readFile(new URL("../node_modules/@duckdb/duckdb-wasm/package.json", import.meta.url)));
const lock = JSON.parse(await readFile(new URL("../package-lock.json", import.meta.url)));
if (pkg.version !== version || lock.packages["node_modules/@duckdb/duckdb-wasm"].version !== version) throw new Error("DuckDB must match the pinned package and lockfile");
const dest = new URL(`../public/vendor/duckdb/${version}/`, import.meta.url);
await mkdir(dest, { recursive: true });
for (const file of ["duckdb-mvp.wasm", "duckdb-eh.wasm", "duckdb-browser-mvp.worker.js", "duckdb-browser-eh.worker.js"]) {
  const src = new URL(`../node_modules/@duckdb/duckdb-wasm/dist/${file}`, import.meta.url);
  const target = new URL(file, dest);
  try {
    const [s, d] = await Promise.all([readFile(src), readFile(target)]);
    if (s.equals(d)) continue;
  } catch {}
  await copyFile(src, target);
}
// Upstream's npm package omits LICENSE; this copy is from its published gitHead ef8a4f8912b6e7f62bc0cc490145ebd391b79e1f.
const licSrc = new URL("../content/licenses/duckdb.txt", import.meta.url);
const licTarget = new URL("LICENSE", dest);
try {
  const [s, d] = await Promise.all([readFile(licSrc), readFile(licTarget)]);
  if (!s.equals(d)) await copyFile(licSrc, licTarget);
} catch {
  await copyFile(licSrc, licTarget);
}
console.log(`DuckDB ${version}: local workers and WASM vendored`);
