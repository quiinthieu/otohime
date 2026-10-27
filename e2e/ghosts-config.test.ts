// Exercise the compiled route with different runtime env, without rebuilding or
// substituting connection(). Browser render/fan-out proof is owned by the ghost suite/QA.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";
import { test } from "node:test";

test("the production ghost route reads configured and malformed endpoints at runtime", { timeout: 30000 }, async () => {
  for (const endpoint of ["wss://ghosts.example/ghosts", "wss://ghosts.example/ghosts?token=forbidden"]) {
    const reservation = createServer().listen(0, "127.0.0.1");
    await once(reservation, "listening");
    const address = reservation.address();
    assert.ok(address && typeof address !== "string");
    const base = `http://127.0.0.1:${address.port}`;
    await new Promise<void>(resolve => reservation.close(() => resolve()));
    const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", String(address.port)], {
      env: { ...process.env, GHOSTS_ENDPOINT: endpoint, BETTER_AUTH_URL: base }, stdio: ["ignore", "pipe", "pipe"],
    });
    const exited = once(server, "exit");
    let output = "";
    try {
      await new Promise<void>((resolve, reject) => {
        const deadline = setTimeout(() => reject(new Error(`Next startup timed out: ${output}`)), 15000);
        server.once("error", reject);
        server.once("exit", code => { clearTimeout(deadline); reject(new Error(`Next exited ${code}: ${output}`)); });
        server.stderr.on("data", chunk => { output += String(chunk); });
        server.stdout.on("data", chunk => {
          output += String(chunk);
          if (output.includes("Ready in")) { clearTimeout(deadline); resolve(); }
        });
      });
      const response = await fetch(`${base}/api/ghosts`);
      assert.equal(response.headers.get("cache-control"), "no-store");
      if (endpoint.includes("?")) {
        assert.equal(response.status, 404); assert.equal(await response.text(), "");
      } else {
        assert.equal(response.status, 200);
        assert.deepEqual(await response.json(), { endpoint, rooms: ["/", "/ryugu"] });
      }
      // A concurrent upstream delivery added the optional canvas probe. It must
      // stay quiet without changing the direct route's disabled 404 contract.
      const probe = await fetch(`${base}/api/ghosts?probe=1`);
      assert.equal(probe.status, 200);
      assert.equal(probe.headers.get("cache-control"), "no-store");
      assert.deepEqual(await probe.json(), endpoint.includes("?") ? null : { endpoint, rooms: ["/", "/ryugu"] });
    } finally {
      server.kill("SIGTERM");
      await exited;
    }
  }
});
