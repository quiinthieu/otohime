/* global importScripts */
// Classic worker keeps synchronous inference off the UI thread. Its CSP forbids outbound traffic.
const assets = /* ASSET_MANIFEST */ null;
const base = new URL(".", self.location.href);
const blobs = new Set();
let landmarker, stopped = false, last = -Infinity;
const abort = new AbortController();
async function verified(file) {
  const asset = assets.assets.find(a => a.file === file);
  if (!asset) throw new Error("asset_missing");
  const response = await fetch(new URL(file, base), { signal: abort.signal, credentials: "same-origin" });
  if (!response.ok) throw new Error("asset_fetch");
  const bytes = await response.arrayBuffer();
  const hash = [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))].map(b => b.toString(16).padStart(2, "0")).join("");
  if (bytes.byteLength !== asset.size || hash !== asset.sha256) throw new Error("asset_integrity");
  return bytes;
}
function blob(bytes, type) {
  const url = URL.createObjectURL(new Blob([bytes], { type })); blobs.add(url); return url;
}
function dispose() {
  stopped = true; abort.abort(); landmarker?.close(); landmarker = undefined;
  for (const url of blobs) URL.revokeObjectURL(url);
  blobs.clear();
}
self.onmessage = async ({ data }) => {
  if (data.type === "stop") { dispose(); self.close(); return; }
  if (data.type === "init") {
    try {
      self.exports = {};
      importScripts(blob(await verified("vision_bundle.cjs"), "text/javascript"));
      const { HandLandmarker, FilesetResolver } = self.exports;
      const fileset = await FilesetResolver.forVisionTasks(new URL("wasm", base).href);
      fileset.wasmLoaderPath = blob(await verified(`wasm/${fileset.wasmLoaderPath.split("/").pop()}`), "text/javascript");
      fileset.wasmBinaryPath = blob(await verified(`wasm/${fileset.wasmBinaryPath.split("/").pop()}`), "application/wasm");
      const modelAssetBuffer = new Uint8Array(await verified("hand_landmarker.task"));
      const construct = delegate => HandLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetBuffer, delegate }, runningMode: "VIDEO", numHands: 2,
        minHandDetectionConfidence: 0.6, minHandPresenceConfidence: 0.6, minTrackingConfidence: 0.6,
      });
      let delegate = "CPU";
      if (data.delegate !== "CPU") {
        try { landmarker = await construct("GPU"); delegate = "GPU"; }
        catch { landmarker = await construct("CPU"); }
      } else landmarker = await construct("CPU");
      if (stopped) { landmarker.close(); return; }
      self.postMessage({ type: "ready", delegate, sdk: assets.packageVersion, model: assets.modelVersion });
    } catch { dispose(); self.postMessage({ type: "error", error: "worker_or_model" }); }
    return;
  }
  const bitmap = data.bitmap;
  if (!bitmap) return;
  try {
    if (!landmarker || stopped) return;
    if (bitmap.width > 640 || bitmap.height > 480 || !Number.isFinite(data.time)) throw new Error("frame_size");
    if (data.time - last < 50) { self.postMessage({ type: "skipped" }); return; }
    last = data.time;
    const result = landmarker.detectForVideo(bitmap, data.time);
    // Only 21-point geometry crosses this local worker boundary; frames are closed below.
    self.postMessage({ type: "hands", hands: result.landmarks.slice(0, 2) });
  } catch { dispose(); self.postMessage({ type: "error", error: "inference" }); }
  finally { bitmap.close(); }
};
