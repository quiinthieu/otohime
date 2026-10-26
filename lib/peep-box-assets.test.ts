import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { manifest, verifyAsset } from "../scripts/vendor-peep-box.mjs";
import { createHash } from "node:crypto";
test("asset contract pins installed SDK, immutable model, SHA256, size and per-asset redistribution terms", () => {
  const lock = JSON.parse(readFileSync("package-lock.json", "utf8"));
  assert.equal(
    lock.packages[""].dependencies["@mediapipe/tasks-vision"],
    manifest.packageVersion,
  );
  assert.equal(
    lock.packages["node_modules/@mediapipe/tasks-vision"].version,
    manifest.packageVersion,
  );
  for (const a of manifest.assets) {
    assert.match(a.sha256, /^[a-f0-9]{64}$/);
    assert.ok(a.size > 1000);
    assert.equal(a.license, "Apache-2.0");
    assert.ok(readFileSync(a.terms, "utf8").includes("LICENSED UNDER"));
    assert.ok(!/latest/.test(a.url));
    if (a.packagePath)
      verifyAsset(
        readFileSync(`node_modules/@mediapipe/tasks-vision/${a.packagePath}`),
        a,
      );
  }
  assert.ok(
    manifest.assets.some(
      (a: { file: string }) => a.file === "face_landmarker.task",
    ),
  );
});
test("corrupted bytes and truncated content fail closed", () => {
  const bytes = Buffer.from("intact");
  const asset = {
    file: "test",
    size: bytes.length,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  };
  assert.equal(verifyAsset(bytes, asset), bytes);
  assert.throws(() => verifyAsset(Buffer.from("broken"), asset), /integrity/);
  assert.throws(() => verifyAsset(bytes.subarray(1), asset), /integrity/);
});
test("verification portrait is pinned, licensed and excluded from deployment", () => {
  const f = JSON.parse(
    readFileSync("content/peep-box-test-assets.json", "utf8"),
  );
  assert.match(f.url, /\/[a-f0-9]{40}\//);
  assert.match(f.sha256, /^[a-f0-9]{64}$/);
  assert.match(f.license, /Public domain/);
  assert.equal(
    manifest.assets.some((a: { file: string }) => a.file === f.file),
    false,
  );
});
