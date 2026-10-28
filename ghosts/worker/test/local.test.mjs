// test:local: the actual Worker and GhostRoom Durable Object in workerd (Wrangler's startWorker over
// Miniflare, real DO bindings, the pinned compatibility date), driven over real WebSockets.
//  1. wrangler.jsonc as deployed: the shared contract cases that scripts/ghosts-fake.test.mjs also runs
//     against the fake (pairs, rooms, refusals, frame strikes, rate, cap, /version).
//  2. test/wrangler.reentry.jsonc: the same routing and GhostRoom, rebuilt on the live DurableObjectState
//     mid-session, the way a hibernation wake constructs a fresh instance. Limits and penalties must
//     survive it, and nothing may be stored.
// No timed soak: reconstruction is driven on demand.
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { after, before, describe, test } from "node:test";
import { unstable_startWorker } from "wrangler";
import { CONTRACT_CASES, rawConnect } from "../../../scripts/ghosts-fake.mjs";
import { CLOSE_FULL, CLOSE_POLICY, RATE_CAPACITY, ROOM_CAP } from "../../protocol.ts";
import { PACKAGE_DIR, fingerprint } from "../scripts/fingerprint.mjs";

const ORIGIN = "https://otohime.dev";
const BUILD = fingerprint().fingerprint;

async function start(config) {
  process.env.WRANGLER_SEND_METRICS = "false";
  const worker = await unstable_startWorker({
    config: join(PACKAGE_DIR, config),
    build: { define: { __GHOSTS_FINGERPRINT__: JSON.stringify(BUILD) } },
    dev: { server: { hostname: "127.0.0.1", port: 0 }, inspector: false, persist: false, watch: false, logLevel: "none" },
  });
  let timer;
  const ready = Promise.race([
    worker.ready,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${config}: workerd not ready in 60 s`)), 60_000);
    }),
  ]);
  try {
    await ready;
  } finally {
    clearTimeout(timer);
  }
  const base = String(await worker.url).replace(/\/$/, "");
  // A runtime that failed to start answers nothing: prove it serves before any case runs.
  const res = await fetch(`${base}/version`, { signal: AbortSignal.timeout(10_000) });
  assert.equal(res.status, 200, `${config} serves /version`);
  return { worker, base };
}

describe("actual Worker (wrangler.jsonc) in workerd", () => {
  let running;
  before(async () => {
    running = await start("wrangler.jsonc");
  });
  after(() => running?.worker.dispose());

  for (const contract of CONTRACT_CASES) {
    test(contract.name, { timeout: 30_000 }, () =>
      contract.run({ base: running.base, origin: ORIGIN, fingerprint: new RegExp(`^${BUILD}$`) }),
    );
  }

  test("/version refuses writes and serves the code+lock+config fingerprint", async () => {
    const post = await fetch(`${running.base}/version`, { method: "POST" });
    assert.equal(post.status, 405);
    const body = await (await fetch(`${running.base}/version`)).json();
    assert.match(body.workerVersionId, /^[0-9a-f-]{36}$/);
    assert.deepEqual(body, { service: "otohime-ghosts", fingerprint: BUILD, workerVersionId: body.workerVersionId });
    assert.match(BUILD, /^[0-9a-f]{64}$/);
  });

  test("fake readiness/log/mode/reset controls are absent from the real Worker", async () => {
    for (const path of ["/__ready", "/__log", "/__mode?m=full", "/__reset"]) {
      for (const method of ["GET", "POST"]) {
        assert.equal((await fetch(running.base + path, { method })).status, 404, `${method} ${path}`);
      }
    }
  });

  test("an allowed upgrade with cookies and a UA still works; nothing but the upgrade reaches the room", async () => {
    const client = await rawConnect(running.base, {
      origin: ORIGIN,
      headers: { Cookie: "otohime.session_token=x", "User-Agent": "probe", "X-Forwarded-For": "203.0.113.9" },
    });
    assert.equal(client.status, 101);
    assert.equal((await client.next((m) => m.t === "hi")).t, "hi");
    await client.close();
  });
});

describe("GhostRoom reconstruction on live state (test/wrangler.reentry.jsonc)", () => {
  let running;
  before(async () => {
    running = await start("test/wrangler.reentry.jsonc");
  });
  after(() => running?.worker.dispose());

  const control = async (path, room = "/ryugu") =>
    (await fetch(`${running.base}/__test/${path}?room=${encodeURIComponent(room)}`)).json();
  const open = async (room = "%2Fryugu") => {
    const client = await rawConnect(running.base, { path: `/ghosts?room=${room}`, origin: ORIGIN });
    assert.equal(client.status, 101);
    client.id = (await client.next((m) => m.t === "hi", { label: "hi" })).id;
    return client;
  };
  const quiet = (ms) => new Promise((done) => setTimeout(done, ms));
  const moves = (client, from, id) => client.messages.slice(from).filter((m) => m.t === "m" && m.id === id).length;

  test("strikes, the bucket and fan-out survive a rebuilt GhostRoom", { timeout: 30_000 }, async () => {
    const a = await open();
    const b = await open();
    for (let i = 0; i < 4; i++) a.sendText("not json");
    await quiet(100);
    const before = await control("inspect");
    assert.equal(before.members, 2);
    assert.deepEqual(before.attachmentKeys, ["at,id,invalid,tokens", "at,id,invalid,tokens"]);
    assert.deepEqual(before.headerNames, ["upgrade"], "the Worker forwards no visitor header to the room");

    const rebuilt = await control("reconstruct");
    assert.equal(rebuilt.generation, 2);
    assert.equal(rebuilt.members, 2, "members restored from getWebSockets() + attachments");

    a.sendText(JSON.stringify({ t: "m", x: 0.7, y: 0.2 }));
    assert.deepEqual(await b.next((m) => m.t === "m"), { t: "m", id: a.id, x: 0.7, y: 0.2 }, "fan-out after rebuild");
    a.sendText("{"); // the fifth strike: four were counted by the previous instance
    assert.equal((await a.waitClosed()).code, CLOSE_POLICY);
    assert.deepEqual(await b.next((m) => m.t === "bye"), { t: "bye", id: a.id });

    const c = await open();
    const mark = b.messages.length;
    const drained = Date.now();
    c.burst(Array.from({ length: RATE_CAPACITY * 2 }, (_, i) => JSON.stringify({ t: "m", x: i / 100, y: 0 })));
    await quiet(150);
    assert.ok(moves(b, mark, c.id) <= RATE_CAPACITY + 2, "first burst cut at the bucket");
    await control("reconstruct");
    const second = b.messages.length;
    c.burst(Array.from({ length: 5 }, () => JSON.stringify({ t: "m", x: 0.9, y: 0.9 })));
    await quiet(150);
    const elapsed = Date.now() - drained;
    const refilled = Math.ceil((elapsed * RATE_CAPACITY) / 1000) + 2;
    const got = moves(b, second, c.id);
    assert.ok(got <= Math.min(refilled, 4), `a rebuilt room kept the drained bucket: ${got} of 5 after ${elapsed} ms`);
    await Promise.all([b.close(), c.close()]);
  });

  test("the cap holds across a rebuild and nothing is ever stored", { timeout: 30_000 }, async () => {
    const clients = [];
    try {
      while (clients.length < ROOM_CAP) clients.push(await open("%2F"));
      const rebuilt = await control("reconstruct", "/");
      assert.equal(rebuilt.members, ROOM_CAP);
      const extra = await rawConnect(running.base, { path: "/ghosts?room=%2F", origin: ORIGIN });
      assert.deepEqual(await extra.next(() => true), { t: "full" });
      assert.equal((await extra.waitClosed()).code, CLOSE_FULL);
      const after = await control("inspect", "/");
      assert.equal(after.members, ROOM_CAP);
      assert.ok(after.attachmentKeys.every((keys) => keys === "at,id,invalid,tokens" || keys === ""));
      assert.equal(after.storageKeys, 0, "no Durable Object storage keys");
      assert.deepEqual(
        // _cf_* belong to workerd and __miniflare_do_name to the local runtime's idFromName bookkeeping.
        after.tables.filter((name) => !name.startsWith("_cf_") && name !== "__miniflare_do_name"),
        [],
        "no SQL tables beyond the runtime's own",
      );
    } finally {
      await Promise.all(clients.map((client) => client.close()));
    }
    await quiet(100);
    const empty = await control("inspect", "/");
    assert.equal(empty.members, 0, "closes release every member");
  });
});

describe("privacy boundary in source and configuration", () => {
  const read = (path) => readFileSync(join(PACKAGE_DIR, path), "utf8");
  const config = JSON.parse(read("wrangler.jsonc").replace(/^\s*\/\/.*$/gm, ""));

  test("Worker observability and logpush are off", () => {
    assert.equal(config.observability?.enabled, false);
    assert.equal(config.observability?.logs?.enabled, false);
    assert.equal(config.logpush, false);
    assert.deepEqual(config.migrations, [{ tag: "v1", new_sqlite_classes: ["GhostRoom"] }]);
    for (const key of ["kv_namespaces", "d1_databases", "r2_buckets", "analytics_engine_datasets", "queues", "tail_consumers"]) {
      assert.equal(config[key], undefined, `no ${key}`);
    }
  });

  test("Worker code uses no storage, SQL, alarms, logs, cookies, IP or UA", () => {
    const files = readdirSync(join(PACKAGE_DIR, "src")).map((name) => `src/${name}`);
    files.push("../room.ts", "../policy.ts", "../protocol.ts");
    for (const file of files) {
      const code = read(file)
        .split("\n")
        .filter((line) => !line.trim().startsWith("//"))
        .join("\n");
      for (const needle of ["console.", ".storage", ".sql", "setAlarm", "cookie", "cf-connecting-ip", "user-agent", "x-forwarded-for", "request.cf"]) {
        assert.equal(code.toLowerCase().includes(needle), false, `${file} mentions ${needle}`);
      }
    }
  });
});
