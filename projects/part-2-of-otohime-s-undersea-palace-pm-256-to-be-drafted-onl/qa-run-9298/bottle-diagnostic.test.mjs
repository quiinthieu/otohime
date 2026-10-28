// Execute the delivered verifier with geometry diagnostics and explicit CPU pressure.
// No application or original verifier source is changed. Select only the 768px case.
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { createHash } from "node:crypto";
import { fileURLToPath, pathToFileURL } from "node:url";
import { resolve } from "node:path";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const original = readFileSync(resolve(root, "e2e/bottle-ui.test.ts"), "utf8");
let source = original.replace('"../lib/pages.ts"', JSON.stringify(pathToFileURL(resolve(root, "lib/pages.ts")).href));
for (const name of ["pg", "playwright-core"]) source = source.replace(`from "${name}"`, `from ${JSON.stringify(import.meta.resolve(name))}`);
source = source.replace('const p = await c.newPage();', `const p = await c.newPage();
  const session = await c.newCDPSession(p);
  await session.send("Emulation.setCPUThrottlingRate", { rate: 6 });`);
source = source.replace('const stable = (a: Awaited<ReturnType<typeof geometry>>, b: typeof a) => {', `const stable = (a: Awaited<ReturnType<typeof geometry>>, b: typeof a) => {
    console.log(JSON.stringify({ kind: "bottle-geometry", a, b }));`);
source = source.replace('`${key}: Bottle state preserves reserved footer geometry`', '`${key}: Bottle state preserves reserved footer geometry ${JSON.stringify({a,b})}`');
console.log(JSON.stringify({ kind: "bottle-diagnostic-identity", sourceSha256: createHash("sha256").update(original).digest("hex"),
  cpuThrottle: 6, boundary: "same production application and verifier; CPU pressure and assertion diagnostics injected; actual CI runner/Chrome version not reproduced" }));
await import("data:text/javascript;base64," + Buffer.from(stripTypeScriptTypes(source)).toString("base64"));
