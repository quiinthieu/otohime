// The local ink-ghosts fake: the shared transport contract (the same cases ghosts/worker/test/local.test.mjs runs
// against the actual Worker), then what only the fake has: refuse/full/flap modes, loopback-only controls, the
// capped in-memory log of coordinates and header-presence booleans, readiness and deterministic teardown.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { connect } from "node:net";
import { after, before, describe, test } from "node:test";
import { fileURLToPath } from "node:url";
import { CONTRACT_CASES, rawConnect, startGhostsFake } from "./ghosts-fake.mjs";

const ORIGIN = "http://localhost:3000";

describe("shared contract against the fake", () => {
  let fake;
  before(async () => {
    fake = await startGhostsFake({ origins: [ORIGIN, "https://otohime.dev"] });
  });
  after(() => fake.close());
  for (const contract of CONTRACT_CASES) {
    test(contract.name, { timeout: 30_000 }, () => contract.run({ base: fake.base, origin: ORIGIN, fingerprint: /^fake$/ }));
  }
});

describe("fake-only behaviour", () => {
  let fake;
  let ids = 0;
  before(async () => {
    fake = await startGhostsFake({ origins: ORIGIN, makeId: () => `ghost-${++ids}`, logCap: 20, flapMs: 30 });
  });
  after(() => fake.close());

  const post = (path, init = {}) => fetch(new URL(path, fake.base), { method: "POST", ...init });

  test("readiness and the injected id source", async () => {
    const ready = await fetch(new URL("/__ready", fake.base));
    assert.deepEqual(await ready.json(), { ready: true, mode: "normal" });
    const a = await rawConnect(fake.base, { origin: ORIGIN });
    assert.deepEqual(await a.next((m) => m.t === "hi"), { t: "hi", id: `ghost-${ids}`, n: 1 });
    await a.close();
  });

  test("controls answer loopback callers without an Origin only", async () => {
    const fromPage = await fetch(new URL("/__log", fake.base), { headers: { origin: ORIGIN } });
    assert.equal(fromPage.status, 403);
    assert.equal((await post("/__reset", { headers: { origin: ORIGIN } })).status, 403);
    assert.equal((await post("/__mode?m=nonsense")).status, 400);
    assert.equal((await fetch(new URL("/__unknown", fake.base))).status, 404);
  });

  test("refuse mode answers upgrades 503", async () => {
    assert.equal((await post("/__mode?m=refuse")).status, 200);
    assert.equal((await rawConnect(fake.base, { origin: ORIGIN })).status, 503);
    await post("/__reset");
  });

  test("full mode sends full and closes 1013", async () => {
    fake.setMode("full");
    const client = await rawConnect(fake.base, { origin: ORIGIN });
    assert.deepEqual(await client.next(() => true), { t: "full" });
    assert.equal((await client.waitClosed()).code, 1013);
    fake.reset();
  });

  test("flap mode greets, then drops the connection abnormally", async () => {
    fake.setMode("flap");
    const client = await rawConnect(fake.base, { origin: ORIGIN });
    assert.equal((await client.next((m) => m.t === "hi")).t, "hi");
    assert.equal((await client.waitClosed()).code, 1006);
    fake.reset();
  });

  test("the log keeps coordinates and header-presence booleans, never header values, and is capped", async () => {
    fake.reset();
    const cookie = "otohime.session_token=do-not-log-me";
    const a = await rawConnect(fake.base, { origin: ORIGIN, headers: { Cookie: cookie, "User-Agent": "probe-ua" } });
    const b = await rawConnect(fake.base, { origin: ORIGIN });
    await a.next((m) => m.t === "hi");
    await b.next((m) => m.t === "hi");
    a.sendText(JSON.stringify({ t: "m", x: 0.42, y: 0.58 }));
    await b.next((m) => m.t === "m");
    const { entries } = fake.log();
    const joins = entries.filter((e) => e.kind === "join");
    assert.deepEqual(
      joins.map((e) => e.headers),
      [
        { origin: true, cookie: true },
        { origin: true, cookie: false },
      ],
    );
    const accepted = entries.find((e) => e.kind === "frame" && e.outcome === "accepted");
    assert.deepEqual([accepted.t, accepted.x, accepted.y], ["m", 0.42, 0.58]);
    const text = JSON.stringify(entries);
    for (const secret of ["do-not-log-me", "session_token", "probe-ua", ORIGIN, "127.0.0.1"]) {
      assert.equal(text.includes(secret), false, `log holds ${secret}`);
    }
    // Over the cap, the oldest entries go and are counted.
    const total = (log) => log.entries.length + log.dropped;
    const expected = total(fake.log()) + 30;
    for (let i = 0; i < 30; i++) a.sendText(JSON.stringify({ t: "m", x: i / 100, y: 0 }));
    const deadline = Date.now() + 5000;
    while (total(fake.log()) < expected && Date.now() < deadline) await new Promise((done) => setTimeout(done, 20));
    const capped = fake.log();
    assert.equal(total(capped), expected, "every frame was logged or counted as dropped");
    assert.equal(capped.entries.length, 20);
    assert.ok(capped.dropped > 0);
    await Promise.all([a.close(), b.close()]);
  });

  test("reset closes every socket and clears the log", async () => {
    const a = await rawConnect(fake.base, { origin: ORIGIN });
    await a.next((m) => m.t === "hi");
    assert.equal((await post("/__reset")).status, 200);
    assert.equal((await a.waitClosed()).code, 1006);
    assert.deepEqual(fake.log(), { entries: [], dropped: 0 });
    const again = await rawConnect(fake.base, { origin: ORIGIN });
    assert.equal((await again.next((m) => m.t === "hi")).n, 1, "rooms start empty after reset");
    await again.close();
  });

  test("an unmasked or oversized wire frame ends the connection", async () => {
    const a = await rawConnect(fake.base, { origin: ORIGIN });
    await a.next((m) => m.t === "hi");
    a.sendText(JSON.stringify({ t: "m", x: 0, y: 0, pad: "x".repeat(2000) }));
    assert.equal((await a.waitClosed()).code, 1009);
  });
});

test("teardown is deterministic: close() resolves with open sockets and frees the port", async () => {
  const fake = await startGhostsFake({ origins: ORIGIN });
  const a = await rawConnect(fake.base, { origin: ORIGIN });
  await a.next((m) => m.t === "hi");
  await fake.close();
  assert.equal((await a.waitClosed()).code, 1006);
  await assert.rejects(
    new Promise((resolveConnect, reject) => {
      const socket = connect(fake.port, "127.0.0.1", () => {
        socket.destroy();
        resolveConnect();
      });
      socket.on("error", reject);
    }),
    /ECONNREFUSED/,
  );
});

test("the CLI prints its ready line and exits on SIGTERM", async () => {
  const script = fileURLToPath(new URL("./ghosts-fake.mjs", import.meta.url));
  const child = spawn(
    process.execPath,
    ["--experimental-strip-types", "--disable-warning=ExperimentalWarning", "--disable-warning=MODULE_TYPELESS_PACKAGE_JSON", script, "--port", "0", "--origins", ORIGIN],
    { stdio: ["ignore", "pipe", "inherit"] },
  );
  let out = "";
  await new Promise((done, reject) => {
    child.stdout.on("data", (chunk) => {
      out += chunk;
      if (out.includes("\n")) done();
    });
    child.on("exit", (code) => reject(new Error(`exited ${code} before ready`)));
  });
  assert.match(out, /^ghosts-fake ready ws:\/\/127\.0\.0\.1:\d+\/ghosts origins=http:\/\/localhost:3000\n/);
  const exit = new Promise((done) => child.on("exit", (code) => done(code)));
  child.kill("SIGTERM");
  assert.equal(await exit, 0);
});
