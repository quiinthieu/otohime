// oEmbed status codes and the checker's exit code.
import assert from "node:assert/strict";
import { test } from "node:test";
import { classify, exitCode, oembedUrl } from "./oembed.ts";

test("the status table", () => {
  assert.equal(classify(200), "embeddable");
  assert.equal(classify(400), "malformed");
  assert.equal(classify(401), "embedding-disabled");
  assert.equal(classify(403), "embedding-disabled");
  assert.equal(classify(404), "not-found");
  for (const s of [null, 0, 302, 429, 500, 503]) assert.equal(classify(s), "network", String(s));
});

test("the oEmbed URL wraps the watch URL", () => {
  const url = new URL(oembedUrl("IXA6bQsVNjs"));
  assert.equal(url.origin + url.pathname, "https://www.youtube.com/oembed");
  assert.equal(url.searchParams.get("url"), "https://www.youtube.com/watch?v=IXA6bQsVNjs");
  assert.equal(url.searchParams.get("format"), "json");
});

test("exit 1 for invalid records or dead videos, 2 for network only, else 0", () => {
  assert.equal(exitCode(0, ["embeddable", "embeddable"]), 0);
  assert.equal(exitCode(0, []), 0);
  assert.equal(exitCode(1, []), 1);
  for (const dead of ["malformed", "embedding-disabled", "not-found"] as const) {
    assert.equal(exitCode(0, ["embeddable", dead]), 1);
    assert.equal(exitCode(0, ["network", dead]), 1, "dead beats network");
  }
  assert.equal(exitCode(0, ["embeddable", "network"]), 2);
  assert.equal(exitCode(2, ["network"]), 1);
});
