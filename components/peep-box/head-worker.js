/* global importScripts */
// Classic worker: MediaPipe's Wasm loader uses importScripts. No UI-thread inference.
const assets = /* ASSET_MANIFEST */ null;
const base = new URL(".", self.location.href);
let landmarker,
  generation = 0,
  busy = false,
  last = -Infinity;
const urls = new Set();
const abort = new AbortController();
const send = (message) => self.postMessage({ generation, ...message });
async function verified(file) {
  const asset = assets.assets.find((a) => a.file === file);
  if (!asset) throw new Error("asset_missing");
  const response = await fetch(new URL(file, base), {
    signal: abort.signal,
    credentials: "same-origin",
  });
  if (!response.ok) throw new Error("asset_fetch");
  const bytes = await response.arrayBuffer();
  const hash = [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  if (bytes.byteLength !== asset.size || hash !== asset.sha256)
    throw new Error("asset_integrity");
  return bytes;
}
function blob(bytes, type) {
  const url = URL.createObjectURL(new Blob([bytes], { type }));
  urls.add(url);
  return url;
}
function dispose() {
  abort.abort();
  landmarker?.close();
  landmarker = undefined;
  for (const url of urls) URL.revokeObjectURL(url);
  urls.clear();
}
function poseFrom(face) {
  const left = face?.[33],
    right = face?.[263],
    nose = face?.[1];
  if (!left || !right || !nose) return null;
  const values = [left.x, left.y, right.x, right.y, nose.x, nose.y];
  if (!values.every(Number.isFinite)) return null;
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
  const x = ((left.x + right.x) / 2 + nose.x) / 2;
  const y = ((left.y + right.y) / 2 + nose.y) / 2;
  return {
    x: clamp((0.5 - x) * 600, -150, 150),
    y: clamp((y - 0.5) * 400, -100, 100),
    z: clamp(
      90 / Math.max(0.01, Math.hypot(left.x - right.x, left.y - right.y)),
      300,
      900,
    ),
  };
}
self.onmessage = async ({ data }) => {
  if (data.type === "stop") {
    dispose();
    self.close();
    return;
  }
  if (data.type === "init") {
    generation = data.generation;
    try {
      self.exports = {};
      importScripts(
        blob(await verified("vision_bundle.cjs"), "text/javascript"),
      );
      const { FaceLandmarker, FilesetResolver } = self.exports;
      const fileset = await FilesetResolver.forVisionTasks(
        new URL("wasm", base).href,
      );
      const loader = fileset.wasmLoaderPath.split("/").pop();
      const binary = fileset.wasmBinaryPath.split("/").pop();
      fileset.wasmLoaderPath = blob(
        await verified(`wasm/${loader}`),
        "text/javascript",
      );
      fileset.wasmBinaryPath = blob(
        await verified(`wasm/${binary}`),
        "application/wasm",
      );
      const modelAssetBuffer = new Uint8Array(
        await verified("face_landmarker.task"),
      );
      const construct = (delegate) =>
        FaceLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetBuffer, delegate },
          runningMode: "VIDEO",
          numFaces: 1,
          outputFaceBlendshapes: false,
          outputFacialTransformationMatrixes: false,
        });
      let delegate = "CPU";
      if (data.delegate !== "CPU") {
        try {
          landmarker = await construct("GPU");
          delegate = "GPU";
        } catch {
          landmarker = await construct("CPU");
        }
      } else landmarker = await construct("CPU");
      send({
        type: "ready",
        delegate,
        sdk: assets.packageVersion,
        model: assets.modelVersion,
      });
    } catch {
      dispose();
      send({ type: "error", error: "worker_or_model" });
    }
    return;
  }
  const bitmap = data.bitmap;
  if (!bitmap) return;
  try {
    if (data.generation !== generation || !landmarker || busy) return;
    if (bitmap.width > 640 || bitmap.height > 480)
      throw new Error("frame_size");
    // A second bound here protects the worker independently of the capture loop.
    const now = performance.now();
    if (!Number.isFinite(data.time) || now - last < 1000 / 15) {
      send({ type: "skipped" });
      return;
    }
    busy = true;
    last = now;
    const result = landmarker.detectForVideo(bitmap, data.time);
    const face = result.faceLandmarks[0];
    // Landmarks are discarded here. Only bounded pose and a count cross the worker boundary.
    send({ type: "pose", pose: poseFrom(face), count: face?.length ?? 0 });
  } catch {
    dispose();
    send({ type: "error", error: "inference" });
  } finally {
    busy = false;
    bitmap.close();
  }
};
