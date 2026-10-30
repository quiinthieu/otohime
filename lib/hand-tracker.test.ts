import { test } from "node:test";
import assert from "node:assert/strict";
import { createHandTracker, type TrackerPlatform } from "../components/shadows/hand-tracker.ts";
function fake() {
  let calls = 0, stops = 0, terminated = 0;
  const track = { stop: () => stops++, addEventListener() {} };
  const stream = { getTracks: () => [track], getVideoTracks: () => [track] } as unknown as MediaStream;
  const worker = { terminate: () => terminated++, postMessage() {}, onmessage: null, onerror: null } as unknown as Worker;
  const platform: TrackerPlatform = { camera: async () => { calls++; return stream; }, worker: () => worker, video: () => ({ play: async () => {}, pause() {}, remove() {} }) as unknown as HTMLVideoElement, bitmap: async () => ({ width: 640, height: 480, close() {} }) as ImageBitmap };
  const errors: string[] = [];
  const tracker = createHandTracker({ onHands() {}, onReady() {}, onError: m => errors.push(m) }, platform);
  return { tracker, platform, stream, worker, errors, counts: () => ({ calls, stops, terminated }) };
}
test("hand tracker is opt in and stops tracks on denial model error and explicit stop", async () => {
  const f = fake(); assert.equal(f.counts().calls, 0);
  await f.tracker.start(); assert.equal(f.counts().calls, 1);
  f.worker.onmessage!({ data: { type: "error" } } as MessageEvent);
  assert.equal(f.counts().stops, 1); assert.equal(f.counts().terminated, 1); assert.equal(f.errors.length, 1);
  f.tracker.stop(); assert.equal(f.counts().stops, 1);
  const denied = fake(); denied.platform.camera = async () => { throw new Error("denied"); };
  await denied.tracker.start(); assert.equal(denied.errors.length, 1);
});
test("stopping a pending permission or frame closes late resources", async () => {
  const f = fake();
  let grant!: (stream: MediaStream) => void;
  f.platform.camera = () => new Promise(resolve => { grant = resolve; });
  const starting = f.tracker.start(); f.tracker.stop(); grant(f.stream); await starting;
  assert.equal(f.counts().stops, 1); assert.equal(f.counts().terminated, 0);
  const g = fake(); let bitmap!: (b: ImageBitmap) => void, closed = 0;
  g.platform.bitmap = () => new Promise(resolve => { bitmap = resolve; });
  await g.tracker.start();
  g.worker.onmessage!({ data: { type: "ready", delegate: "CPU" } } as MessageEvent);
  await new Promise(resolve => setTimeout(resolve, 80));
  g.tracker.stop(); bitmap({ width: 640, height: 480, close: () => closed++ } as ImageBitmap);
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(closed, 1); assert.equal(g.counts().stops, 1);
});
