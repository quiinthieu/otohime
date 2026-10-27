import test from "node:test";
import assert from "node:assert/strict";
import {
  createBottleService,
  createMemoryBottleStore,
} from "./bottles-service.ts";
import { bottleStoreContract } from "./bottles-store-contract.ts";
const input = {
  url: "https://indie.org/",
  title: "Indie",
  note: "A little web garden.",
  kind: "site" as const,
};
bottleStoreContract("memory", async () => ({
  store: createMemoryBottleStore(
    new Map([
      ["owner", "owner"],
      ["admin", "admin"],
      ["user", "user"],
    ]),
  ),
  close: async () => {},
}));
test("service validates, detects seed duplicates, persists and degrades without exposing private fields", async () => {
  const store = createMemoryBottleStore(new Map([["owner", "owner"]]));
  const seed = { id: "seed", ...input };
  const make = () =>
    createBottleService({
      store,
      seeds: [seed],
      secret: "test-secret",
      now: () => new Date("2026-10-26T12:00:00Z"),
    });
  assert.deepEqual(await make().suggest(input, "visitor"), {
    kind: "duplicate",
  });
  assert.deepEqual(
    await make().suggest({ ...input, url: "http://bad.org" }, "visitor"),
    { kind: "invalid", reason: "url" },
  );
  const result = await make().suggest(
    { ...input, url: "https://second.org" },
    "visitor",
  );
  assert.equal(result.kind, "accepted");
  assert.equal((await make().pool()).bottles.length, 1);
  const pending = await make().review("pending", null, {
    id: "owner",
    role: "owner",
  });
  assert.equal(pending.suggestions.length, 1);
  await make().moderate(pending.suggestions[0].id, "approved", {
    id: "owner",
    role: "owner",
  });
  assert.equal((await make().pool()).bottles.length, 2);
  assert.deepEqual(Object.keys((await make().pool()).bottles[1]).sort(), [
    "id",
    "kind",
    "note",
    "title",
    "url",
  ]);
  await make().moderate(pending.suggestions[0].id, "rejected", {
    id: "owner",
    role: "owner",
  });
  assert.equal((await make().pool()).bottles.length, 1);
  await assert.rejects(
    make().review("pending", null, { id: "user", role: "user" }),
    /forbidden/,
  );
  assert.equal(
    (await make().moderate("missing", "approved", { id: "user", role: "user" }))
      .kind,
    "forbidden",
  );
  const failing = {
    ...store,
    approved: async () => {
      throw Error("offline");
    },
  };
  assert.deepEqual(
    await createBottleService({
      store: failing,
      seeds: [seed],
      secret: "secret",
    }).pool(),
    { bottles: [seed], degraded: true },
  );
});
