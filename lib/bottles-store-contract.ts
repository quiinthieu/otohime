/** The same behavioral contract is run against memory and real Postgres. */
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { BottleStore } from "./bottles-service.ts";
export function bottleStoreContract(
  name: string,
  setup: () => Promise<{ store: BottleStore; close: () => Promise<void> }>,
) {
  test(`${name}: atomic admission, canonical duplicates, persistence, review and authorization`, async () => {
    const { store, close } = await setup();
    const now = new Date("2026-10-26T12:00:00Z");
    const prefix = randomUUID();
    const admit = (n: number, bucket = prefix) =>
      store.admit({
        bottle: {
          id: `${prefix}-${n}`,
          url: `https://indie.org/${prefix}/${n}`,
          title: "Indie",
          note: "A small discovery.",
          kind: "site",
        },
        submitter: "opaque-hmac",
        bucket,
        now,
      });
    try {
      const attempts = await Promise.all(
        Array.from({ length: 12 }, (_, i) => admit(i)),
      );
      assert.equal(attempts.filter((x) => x.kind === "accepted").length, 5);
      assert.equal(attempts.filter((x) => x.kind === "rate_limited").length, 7);
      const page = await store.list("pending", null);
      const row = page.suggestions.find((x) => x.id.startsWith(prefix))!;
      assert.ok(row);
      assert.equal(
        (await store.approved()).some((x) => x.id === row.id),
        false,
      );
      const n = Number(row.id.split("-").at(-1));
      assert.equal((await admit(n, `${prefix}-newhour`)).kind, "duplicate");
      assert.equal(
        (await store.moderate(row.id, "approved", "user", now)).kind,
        "forbidden",
      );
      assert.equal(
        (await store.moderate(row.id, "approved", "missing", now)).kind,
        "forbidden",
      );
      assert.equal(
        (await store.moderate("missing", "approved", "owner", now)).kind,
        "not_found",
      );
      assert.equal(
        (await store.moderate(row.id, "approved", "owner", now)).kind,
        "updated",
      );
      assert.equal(
        (await store.approved()).some((x) => x.id === row.id),
        true,
      );
      assert.equal(
        (await store.moderate(row.id, "rejected", "admin", now)).kind,
        "updated",
      );
      assert.equal(
        (await store.approved()).some((x) => x.id === row.id),
        false,
      );
      assert.equal((await admit(20, `${prefix}-newhour`)).kind, "accepted");
    } finally {
      await close();
    }
  });
  test(`${name}: concurrent URL duplicates roll back quota in other buckets`, async () => {
    const { store, close } = await setup();
    const now = new Date("2026-10-26T12:00:00Z");
    const prefix = randomUUID();
    const input = (n: number, path = "same") => ({
      bottle: {
        id: `${prefix}-${n}-${path}`,
        url: `https://indie.org/${prefix}/${path}`,
        title: "Indie",
        note: "A small discovery.",
        kind: "site" as const,
      },
      bucket: `${prefix}-${n}`,
      submitter: `hmac-${n}`,
      now,
    });
    try {
      const results = await Promise.all(
        Array.from({ length: 8 }, (_, n) => store.admit(input(n))),
      );
      assert.equal(results.filter((r) => r.kind === "accepted").length, 1);
      assert.equal(results.filter((r) => r.kind === "duplicate").length, 7);
      for (let n = 0; n < 8; n++) {
        // Only the winning bucket has consumed one slot; every loser can still accept five.
        const count = results[n].kind === "accepted" ? 4 : 5;
        for (let i = 0; i < count; i++)
          assert.equal(
            (await store.admit(input(n, `new-${n}-${i}`))).kind,
            "accepted",
          );
        assert.equal(
          (await store.admit(input(n, `over-${n}`))).kind,
          "rate_limited",
        );
      }
    } finally {
      await close();
    }
  });
}
