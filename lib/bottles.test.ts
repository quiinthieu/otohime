import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { parseBottle, pickBottle, seededRng, mergeBottles } from "./bottles.ts";
const input = {
  url: "https://EXAMPLE.org:443/a?z=2&a=1",
  title: " Small world ",
  note: "One quiet corner.",
  kind: "site",
};
test("normalizes canonical URLs and plain text without fetching", () => {
  assert.deepEqual(parseBottle(input), {
    ok: true,
    value: {
      ...input,
      url: "https://example.org/a?a=1&z=2",
      title: "Small world",
    },
  });
});
test("rejects hostile URLs, fragments and trackers including encoded IPs", () => {
  for (const url of [
    "http://indie.org",
    "javascript:alert(1)",
    "https://a:b@indie.org",
    "https://indie.org:444",
    "https://localhost",
    "https://foo.local",
    "https://x.localhost",
    "https://127.1",
    "https://2130706433",
    "https://0x7f000001",
    "https://192.168.1.1",
    "https://8.8.8.8",
    "https://[::1]",
    "https://[::ffff:192.168.1.2]",
    "https://indie.org/#frag",
    "https://indie.org/?utm_source=bot",
    "https://indie.org/?FbClId=1",
    "https://indie.org/\nfoo",
    "https://foo.invalid",
    "https://foo.internal",
    "https://foo.org/" + "x".repeat(2048),
  ]) {
    assert.deepEqual(
      parseBottle({ ...input, url }),
      { ok: false, reason: "url" },
      url,
    );
  }
});
test("bounds text/kind/shape and rejects markup, controls and honeypots", () => {
  for (const title of [
    "",
    " ".repeat(2),
    "x".repeat(81),
    "<img src=x>",
    "hi\u0000there",
    "hi\u202ethere",
  ])
    assert.equal(parseBottle({ ...input, title }).ok, false);
  for (const note of [
    "",
    "x".repeat(81),
    "<script>alert(1)</script>",
    "&#60;script&#62;",
  ])
    assert.equal(parseBottle({ ...input, note }).ok, false);
  for (const value of [
    null,
    [],
    { ...input, kind: "unknown" },
    { ...input, website: "bot" },
    { ...input, status: "approved" },
  ])
    assert.equal(parseBottle(value).ok, false);
  assert.equal(
    parseBottle({ ...input, title: "🌊".repeat(80), note: "A & B" }).ok,
    true,
  );
});
test("twelve reviewed seeds validate and merge with deterministic curated precedence", () => {
  const seeds = JSON.parse(readFileSync("content/bottles.json", "utf8"));
  assert.ok(seeds.length >= 12);
  assert.equal(
    new Set(seeds.map((x: { id: string }) => x.id)).size,
    seeds.length,
  );
  for (const { id, ...value } of seeds) {
    assert.ok(id);
    assert.equal(parseBottle(value).ok, true);
  }
  assert.equal(
    mergeBottles(seeds, [{ ...seeds[0], id: "copy", title: "wrong" }]).length,
    seeds.length,
  );
  assert.equal(
    mergeBottles(seeds, [{ ...seeds[0], id: "copy", title: "wrong" }])[0].title,
    seeds[0].title,
  );
});
test("seeded picking does not repeat until exhausted and tolerates stale seen ids", () => {
  const pool = [0, 1, 2].map((n) => ({
    id: String(n),
    ...input,
    kind: "site" as const,
  }));
  assert.equal(pickBottle([], [], seededRng(1)), null);
  const sequence = (seed: number) => {
    const rng = seededRng(seed);
    const seen: string[] = [];
    for (let i = 0; i < 3; i++) {
      const b = pickBottle(pool, seen, rng)!;
      seen.push(b.id);
    }
    return seen;
  };
  assert.deepEqual(sequence(42), sequence(42));
  assert.equal(new Set(sequence(42)).size, 3);
  assert.ok(pickBottle(pool, ["0", "1", "2", "old"], seededRng(1)));
  assert.equal(pickBottle(pool, ["old"], () => 1)?.id, "2");
});

test("untrusted enum objects never coerce or throw; canonical expansion stays bounded", () => {
  for (const kind of [
    ["site"],
    { toString: "site" },
    { toString: null },
    {},
    1,
    null,
  ]) {
    assert.deepEqual(parseBottle({ ...input, kind }), {
      ok: false,
      reason: "kind",
    });
  }
  for (const url of [
    "https://@indie.org/",
    "https://indie.org/" + "é".repeat(500),
  ]) {
    assert.deepEqual(parseBottle({ ...input, url }), {
      ok: false,
      reason: "url",
    });
  }
});
