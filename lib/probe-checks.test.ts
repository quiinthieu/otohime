import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { createProbeChecks } from "../scripts/probe-checks.mjs";

test("probe failures survive a verifier's 4KiB output tail after hundreds of successes", () => {
  const lines: string[] = [];
  const probe = createProbeChecks((line: string) => lines.push(line));
  probe.check("phone /shore -> /music: streamed reveal settles", false, "still pending");
  for (let i = 0; i < 512; i++) probe.check(`later check ${i}`, true);
  assert.equal(probe.finish(), 1);
  const tail = Buffer.from(lines.join("\n")).subarray(-4096).toString();
  assert.match(tail, /phone \/shore -> \/music: streamed reveal settles/);
  assert.match(tail, /still pending/);
  assert.match(tail, /probe: 512 ok, 1 failed$/);
});

test("probe recap bounds UTF-8 diagnostics, counts every failure and never promotes a red run", () => {
  const lines: string[] = [];
  const probe = createProbeChecks((line: string) => lines.push(line));
  for (let i = 0; i < 100; i++) probe.check(`failure ${i}`, false, "🎵".repeat(1000));
  const start = lines.length;
  assert.equal(probe.finish(), 1);
  const recap = lines.slice(start).join("\n");
  assert.ok(Buffer.byteLength(recap) <= 3500, String(Buffer.byteLength(recap)));
  assert.doesNotMatch(recap, /�/);
  assert.match(recap, /95 more failures/);
  assert.match(recap, /probe: 0 ok, 100 failed$/);
  const green = createProbeChecks((line: string) => lines.push(line));
  green.check("healthy", true);
  assert.equal(green.finish(), 0);
  assert.equal(lines.at(-1), "probe: 1 ok, 0 failed");
});

test("the motion walk uses the tested reporter for assertions and exit status", () => {
  const code = readFileSync(new URL("../scripts/probe-motion.mjs", import.meta.url), "utf8");
  assert.match(code, /import \{ createProbeChecks \} from "\.\/probe-checks\.mjs"/);
  assert.match(code, /const \{ check, finish \} = createProbeChecks\(\)/);
  assert.match(code, /process\.exitCode = finish\(\)/);
});

test("a real piped reporter child drains output and exits nonzero with the retained failure", () => {
  const child = spawnSync(process.execPath, ["--input-type=module", "-e", `
    import { createProbeChecks } from ${JSON.stringify(new URL("../scripts/probe-checks.mjs", import.meta.url).href)};
    const { check, finish } = createProbeChecks();
    check("negative control: broken transition", false, "missing fade-in");
    for (let i = 0; i < 10000; i++) check("healthy navigation " + i, true);
    process.exitCode = finish();
  `], { encoding: "utf8", timeout: 10000, maxBuffer: 2 * 1024 * 1024 });
  assert.ifError(child.error);
  assert.equal(child.status, 1);
  assert.ok(Buffer.byteLength(child.stdout) > 100000, "the producer really emitted the long output");
  const tail = Buffer.from(child.stdout).subarray(-4096).toString();
  assert.match(tail, /negative control: broken transition: missing fade-in/);
  assert.match(tail, /probe: 10000 ok, 1 failed\n$/);
});
