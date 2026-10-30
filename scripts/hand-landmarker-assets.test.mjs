import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { manifest, verifyAsset } from "./vendor-hand-landmarker.mjs";
test("hand landmarker pins locked runtime bytes and rejects corrupt model bytes", async () => {
  const lock = JSON.parse(await readFile(new URL("../package-lock.json", import.meta.url)));
  assert.equal(lock.packages["node_modules/@mediapipe/tasks-vision"].version, manifest.packageVersion);
  const sdk = await readFile(new URL("../node_modules/@mediapipe/tasks-vision/vision_bundle.cjs", import.meta.url));
  verifyAsset(sdk, manifest.assets.find(a => a.file === "vision_bundle.cjs"));
  assert.throws(() => verifyAsset(Buffer.from("corrupt"), manifest.assets.find(a => a.file === "hand_landmarker.task")), /integrity/);
  for (const asset of manifest.assets) {
    assert.equal(asset.license, "Apache-2.0");
    assert.match(asset.sha256, /^[a-f0-9]{64}$/);
    assert.ok(asset.size > 0);
  }
});
