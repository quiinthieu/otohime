import test from "node:test";
import assert from "node:assert/strict";
import {
  bottlePost,
  bottleGet,
  bottleAdminGet,
  bottlePatch,
  trustedBottleIp,
} from "./bottles-http.ts";
import {
  createBottleService,
  createMemoryBottleStore,
  submitterKeys,
} from "./bottles-service.ts";
const seed = {
  id: "seed",
  url: "https://seed.org/",
  title: "Seed",
  note: "A quiet place.",
  kind: "site" as const,
};
const input = {
  url: "https://visitor.org/",
  title: "Visitor",
  note: "A small world.",
  kind: "toy",
};
const env = {
  DATABASE_URL: "fixture",
  BETTER_AUTH_URL: "https://otohime.dev",
  BETTER_AUTH_SECRET: "secret",
};
const store = createMemoryBottleStore(new Map([["owner", "owner"]]));
const service = createBottleService({ store, seeds: [seed], secret: "secret" });
const deps = {
  service,
  env,
  seeds: [seed],
  actor: async () => null as { id: string; role: string } | null,
};
const request = (body: unknown = input, headers: Record<string, string> = {}) =>
  new Request("https://otohime.dev/api/bottles/suggestions", {
    method: "POST",
    headers: {
      origin: "https://otohime.dev",
      "content-type": "application/json",
      ...headers,
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
const check = async (response: Response, status: number, reason: string) => {
  assert.equal(response.status, status);
  assert.equal((await response.json()).reason, reason);
};
test("HTTP boundaries have stable reasons, stream cap, strict origin, and zero URL fetches", async () => {
  await check(await bottlePost(request("{"), deps), 400, "json");
  await check(
    await bottlePost(request(input, { "content-type": "text/plain" }), deps),
    415,
    "unsupported_content",
  );
  await check(
    await bottlePost(request(input, { origin: "https://evil.dev" }), deps),
    403,
    "origin",
  );
  await check(
    await bottlePost(request(input, { origin: "" }), deps),
    403,
    "origin",
  );
  await check(
    await bottlePost(
      request(input, {
        origin: "https://evil.dev",
        host: "evil.dev",
        "x-forwarded-host": "evil.dev",
      }),
      deps,
    ),
    403,
    "origin",
  );
  await check(
    await bottlePost(request("x".repeat(8193)), deps),
    413,
    "oversized",
  );
  await check(
    await bottlePost(request({ ...input, website: "bot" }), deps),
    400,
    "honeypot",
  );
  await check(
    await bottlePost(
      request({ ...input, note: "<script>alert(1)</script>" }),
      deps,
    ),
    400,
    "text",
  );
  const old = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    throw Error("No external calls");
  };
  try {
    const accepted = await bottlePost(request(), deps);
    assert.equal(accepted.status, 201);
    assert.equal((await accepted.json()).status, "pending");
    assert.equal(calls, 0);
  } finally {
    globalThis.fetch = old;
  }
  await check(await bottlePost(request(), deps), 409, "duplicate");
  await check(
    await bottlePost(request(), { ...deps, env: {} }),
    503,
    "unavailable",
  );
  const offline = await bottleGet({ ...deps, env: {} });
  assert.deepEqual(await offline.json(), { bottles: [seed], degraded: true });
});
test("unauthorized APIs fail before data access; bounded pagination and mutation validation", async () => {
  const list = new Request("https://otohime.dev/api/admin/bottles");
  await check(await bottleAdminGet(list, deps), 401, "unauthenticated");
  await check(
    await bottlePatch(request({ status: "approved" }), "id", deps),
    401,
    "unauthenticated",
  );
  const ordinary = {
    ...deps,
    actor: async () => ({ id: "user", role: "user" }),
  };
  await check(await bottleAdminGet(list, ordinary), 403, "forbidden");
  await check(
    await bottlePatch(request({ status: "approved" }), "id", ordinary),
    403,
    "forbidden",
  );
  const owner = {
    ...deps,
    actor: async () => ({ id: "owner", role: "owner" }),
  };
  await check(
    await bottleAdminGet(new Request(list.url + "?status=all"), owner),
    400,
    "status",
  );
  await check(
    await bottleAdminGet(new Request(list.url + "?cursor=%3Cscript%3E"), owner),
    400,
    "cursor",
  );
  await check(
    await bottlePatch(request({ status: "pending" }), "id", owner),
    400,
    "status",
  );
  await check(
    await bottlePatch(request({ status: "approved" }), "missing", owner),
    404,
    "not_found",
  );
});
test("trusted IP ignores spoofed client headers outside Vercel; HMAC is stable and hour-scoped", () => {
  const headers = new Headers({
    "x-real-ip": "1.2.3.4",
    "x-forwarded-for": "5.6.7.8",
    "x-vercel-forwarded-for": "8.8.8.8",
  });
  assert.equal(trustedBottleIp(headers, {}), "unknown");
  assert.equal(trustedBottleIp(headers, { VERCEL: "1" }), "8.8.8.8");
  const a = submitterKeys("8.8.8.8", new Date("2026-10-26T12:00Z"), "secret");
  const b = submitterKeys("8.8.8.8", new Date("2026-10-26T13:00Z"), "secret");
  assert.equal(a.submitter, b.submitter);
  assert.notEqual(a.bucket, b.bucket);
  assert.ok(!a.bucket.includes("8.8.8.8"));
});

test("PATCH rejects object and array statuses as 400 without coercion", async () => {
  const owner = {
    ...deps,
    actor: async () => ({ id: "owner", role: "owner" }),
  };
  for (const status of [["approved"], { toString: "approved" }, null, 42]) {
    await check(
      await bottlePatch(request({ status }), "id", owner),
      400,
      "status",
    );
  }
});
