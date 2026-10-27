import assert from "node:assert/strict";
import { createServer } from "node:http";
import { test } from "node:test";
import { execFile } from "node:child_process";
import { mkdtempSync, symlinkSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { waitForDeployment } from "../scripts/deployment-status.mjs";

const hostname = "otohime-fixture.vercel.app";
const deployment = { id: "dpl_fixture", url: hostname, ownerId: "team_fixture", projectId: "prj_fixture", target: "production", readyState: "READY" };

test("deployment status uses real bearer HTTP without user bootstrap; validates ownership, terminal state and bounds", async () => {
  let mode = "ready", reads = 0;
  const paths: string[] = [];
  const server = createServer((req, res) => {
    paths.push(req.url!);
    assert.equal(req.headers.authorization, "Bearer synthetic-token");
    if (req.url === "/v2/user") { res.writeHead(404); res.end("User not found"); return; }
    assert.equal(req.url, `/v13/deployments/${hostname}?teamId=team_fixture`);
    if (mode === "hang") return;
    if (mode === "redirect") { res.writeHead(302, { Location: "/v2/user" }); res.end(); return; }
    if (/^\d+$/.test(mode)) { res.writeHead(Number(mode)); res.end("synthetic-token must never be logged"); return; }
    if (mode === "oversized") { res.end("x".repeat(1_048_577)); return; }
    if (mode === "malformed") { res.end("not JSON synthetic-token"); return; }
    if (mode === "slow-body") { res.writeHead(200); res.write('{"id":'); return; }
    const body = { ...deployment };
    if (mode === "transition") body.readyState = ++reads === 1 ? "BUILDING" : "READY";
    if (mode.startsWith("state:")) body.readyState = mode.slice(6);
    if (mode.startsWith("wrong:")) body[mode.slice(6) as keyof typeof body] = "wrong";
    if (mode.startsWith("missing:")) delete (body as Partial<typeof body>)[mode.slice(8) as keyof typeof body];
    res.end(JSON.stringify(body));
  });
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const options = { hostname, token: "synthetic-token", teamId: "team_fixture", projectId: "prj_fixture", apiOrigin: `http://127.0.0.1:${address.port}`, timeoutMs: 300, pollMs: 1, requestMs: 100 };
  const receipts: unknown[] = [];
  const read = (patch = {}) => waitForDeployment({ ...options, onState: (receipt: unknown) => receipts.push(receipt), ...patch });
  try {
    assert.equal((await read()).readyState, "READY");
    assert.equal(paths.length, 1);
    assert.ok(!paths.some((path) => path.startsWith("/v2/user")));
    const work = mkdtempSync(join(tmpdir(), "deployment-cli-"));
    try {
      const alias = join(work, "status.mjs");
      symlinkSync(fileURLToPath(new URL("../scripts/deployment-status.mjs", import.meta.url)), alias);
      const before: number = paths.length;
      const result = await promisify(execFile)(process.execPath, [alias, `https://${hostname}`], { timeout: 5000, env: {
        ...process.env, VERCEL_TOKEN: options.token, VERCEL_ORG_ID: options.teamId, VERCEL_PROJECT_ID: options.projectId,
        VERCEL_API_URL: options.apiOrigin, READY_TIMEOUT: "1", INSPECT_TIMEOUT: "1",
      } });
      assert.deepEqual(JSON.parse(result.stdout), deployment);
      assert.equal(paths.length, before + 1, "symlinked CLI executes the adapter instead of silently importing it");
    } finally { rmSync(work, { recursive: true, force: true }); }
    mode = "transition";
    assert.equal((await read()).id, "dpl_fixture");
    assert.equal(reads, 2);
    for (mode of ["401", "403", "404", "429", "500", "malformed", "oversized", "redirect", "state:ERROR", "state:CANCELED", "state:UNKNOWN", "state:", ...["ownerId", "projectId", "url", "id", "target"].flatMap((field) => [`wrong:${field}`, `missing:${field}`])]) {
      const reason = /^\d+$/.test(mode) ? `HTTP ${mode}` : mode === "malformed" ? "malformed JSON"
        : mode === "oversized" ? "oversized response" : mode === "redirect" ? "request failed"
        : mode === "state:ERROR" || mode === "state:CANCELED" ? `terminal ${mode.slice(6)}`
        : mode.startsWith("state:") ? "unknown state" : "association mismatch";
      await assert.rejects(read(), (error: Error) => {
        assert.doesNotMatch(error.message, /synthetic-token/);
        assert.ok(error.message.includes(reason), `${mode}: ${error.message}`);
        return true;
      }, mode);
    }
    for (mode of ["hang", "slow-body", "state:QUEUED", "state:INITIALIZING", "state:BUILDING"]) {
      const start = performance.now();
      await assert.rejects(read(), /timeout/, mode);
      assert.ok(performance.now() - start < 1500, mode);
    }
    for (const patch of [{ token: "" }, { teamId: "" }, { projectId: "" }, { hostname: "attacker.example" }, { timeoutMs: 0 }, { timeoutMs: NaN }, { apiOrigin: "https://attacker.example" }]) {
      const before: number = paths.length;
      await assert.rejects(read(patch));
      assert.equal(paths.length, before, "invalid configuration fails before sending credentials");
    }
    assert.ok(receipts.length > 0);
    assert.doesNotMatch(JSON.stringify(receipts), /synthetic-token/);
  } finally { server.closeAllConnections(); await new Promise<void>((done) => server.close(() => done())); }
});
