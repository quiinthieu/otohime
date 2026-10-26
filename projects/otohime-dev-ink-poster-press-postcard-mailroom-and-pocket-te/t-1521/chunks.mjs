// t-1521 evidence probe. Run against `next start`; Playwright 1.64.0 was installed to /tmp/pw (npm i --prefix /tmp/pw playwright@1.64.0).
import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
const root = process.argv[2], page = process.argv[3];
const html = readFileSync(join(root, ".next/server/app", `${page}.html`), "utf8");
for (const s of [...new Set([...html.matchAll(/\/_next\/static\/[^"'\s)]+?\.js/g)].map((m) => m[0]))].sort())
  console.log(statSync(join(root, ".next", s.replace("/_next/", ""))).size, s);
