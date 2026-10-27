import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { test } from "node:test";
import { configResponse, parseEndpoint } from "./config.ts";

const origin = "https://otohime.dev";

test("only a dedicated secure Worker or local loopback proof endpoint is accepted", () => {
  assert.equal(parseEndpoint("wss://ghosts.example/ghosts", origin), "wss://ghosts.example/ghosts");
  assert.equal(parseEndpoint("ws://127.0.0.1:8788/ghosts", "http://localhost:3000"), "ws://127.0.0.1:8788/ghosts");
  assert.equal(parseEndpoint("ws://[::1]:8788/ghosts", "http://localhost:3000"), "ws://[::1]:8788/ghosts");
  for (const endpoint of [undefined, "", "bad", "/ghosts", "https://ghosts.example/ghosts", "wss://otohime.dev/ghosts",
    "ws://ghosts.example/ghosts", "ws://localhost:8788/ghosts", "wss://user:secret@ghosts.example/ghosts",
    "wss://ghosts.example/ghosts#fragment", "wss://ghosts.example/ghosts#", "wss://ghosts.example/ghosts?room=%2F",
    "wss://ghosts.example/ghosts?token=secret", "wss://ghosts.example/ghosts?", "wss://ghosts.example/other", " wss://ghosts.example/ghosts", "wss:ghosts.example/ghosts", "wss://ghosts.exa\nmple/ghosts", "wss://ghosts.example\\ghosts"]) {
    assert.equal(parseEndpoint(endpoint, origin), null, String(endpoint));
  }
  assert.equal(parseEndpoint("ws://127.0.0.1.evil.test/ghosts", "http://localhost:3000"), null);
});

test("responses never cache configuration or the disabled result", async () => {
  for (const value of [undefined, "invalid", "wss://ghosts.example/ghosts"]) {
    const response = configResponse(value, origin);
    assert.equal(response.headers.get("cache-control"), "no-store");
    if (value?.startsWith("wss")) {
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), { endpoint: value, rooms: ["/", "/ryugu"] });
    } else { assert.equal(response.status, 404); assert.equal(await response.text(), ""); }
  }
});

test("actual GET wiring awaits connection before reading runtime env, on every request", async () => {
  // Execute the real route body, substituting only Next's request-context boundary.
  // This catches accidentally capturing env at module scope or returning a different helper result.
  const routeFile = new URL("../app/api/ghosts/route.ts", import.meta.url);
  const source = readFileSync(routeFile, "utf8");
  let calls = 0;
  const key = "__ghostsTestConnection";
  const globals = globalThis as unknown as Record<string, unknown>;
  globals[key] = async () => { calls++; process.env.GHOSTS_ENDPOINT = "wss://runtime.example/ghosts"; };
  const boundary = `data:text/javascript,${encodeURIComponent(`export const connection = () => globalThis.${key}();`)}`;
  const injected = source.replace('"next/server"', JSON.stringify(boundary))
    .replace('"../../../ghosts/config.ts"', JSON.stringify(new URL("./config.ts", import.meta.url).href));
  const code = ts.transpileModule(injected, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  const old = process.env.GHOSTS_ENDPOINT;
  try {
    process.env.GHOSTS_ENDPOINT = "invalid-at-import";
    const { GET } = await import(`data:text/javascript,${encodeURIComponent(code)}`);
    const request = new Request("https://otohime.dev/api/ghosts");
    const response = await GET(request);
    assert.deepEqual(await response.json(), { endpoint: "wss://runtime.example/ghosts", rooms: ["/", "/ryugu"] });
    assert.equal(response.headers.get("cache-control"), "no-store");
    globals[key] = async () => { calls++; delete process.env.GHOSTS_ENDPOINT; };
    const disabled = await GET(request);
    assert.equal(disabled.status, 404);
    assert.equal(disabled.headers.get("cache-control"), "no-store");
    assert.equal(calls, 2);
    // Browsers log an intentional 404 as a console error even when fetch handles it.
    // The optional canvas probes availability without changing the default 404 contract.
    const probe = new Request("https://otohime.dev/api/ghosts?probe=1");
    const absent = await GET(probe);
    assert.equal(absent.status, 200);
    assert.equal(absent.headers.get("cache-control"), "no-store");
    assert.deepEqual(await absent.json(), null);
    globals[key] = async () => { calls++; process.env.GHOSTS_ENDPOINT = "wss://runtime.example/ghosts"; };
    const available = await GET(probe);
    assert.equal(available.status, 200);
    assert.equal(available.headers.get("cache-control"), "no-store");
    assert.deepEqual(await available.json(), { endpoint: "wss://runtime.example/ghosts", rooms: ["/", "/ryugu"] });
    assert.equal(calls, 4);
  } finally {
    if (old === undefined) delete process.env.GHOSTS_ENDPOINT; else process.env.GHOSTS_ENDPOINT = old;
    delete globals[key];
  }
});
