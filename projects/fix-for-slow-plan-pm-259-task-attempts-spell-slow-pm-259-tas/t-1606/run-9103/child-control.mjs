import { realRunChild } from "../../../../scripts/check-gate-closure.mjs";
const env = { ...process.env }; delete env.NODE_TEST_CONTEXT;
const run = (code) => realRunChild({ id: "c", command: process.execPath, args: ["-e", code], cwd: "/tmp", env, timeoutMs: 20000 });
const out = {};
for (const [k, c] of Object.entries({
  immediate_200k: "process.stdout.write('x'.repeat(200000)); process.exit(3)",
  flushed_200k: "process.stdout.write('x'.repeat(200000), () => process.exit(3))",
  flushed_1_2m: "process.stdout.write('h'.repeat(200000)+'t'.repeat(1000000), () => process.exit(3))",
})) { out[k] = []; for (let i = 0; i < 3; i++) { const r = await run(c); out[k].push({ code: r.code, timedOut: r.timedOut, length: r.stdout.length, hasHead: r.stdout.includes("h") }); } }
console.log(JSON.stringify(out, null, 1));
