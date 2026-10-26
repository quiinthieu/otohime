// t-1521 evidence probe. Run against `next start`; Playwright 1.64.0 was installed to /tmp/pw (npm i --prefix /tmp/pw playwright@1.64.0).
// Sum the bytes of every /_next/static script a prerendered page's HTML loads.
import { readFileSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";
const root = process.argv[2];
for (const page of ["index", "play"]) {
  const file = join(root, ".next/server/app", `${page}.html`);
  if (!existsSync(file)) { console.log(page, "missing", file); continue; }
  const html = readFileSync(file, "utf8");
  const srcs = [...new Set([...html.matchAll(/\/_next\/static\/[^"'\s)]+?\.js/g)].map((m) => m[0]))].sort();
  let bytes = 0;
  for (const s of srcs) bytes += statSync(join(root, ".next", s.replace("/_next/", ""))).size;
  console.log(JSON.stringify({ page, scripts: srcs.length, bytes }));
}
