import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createHeadTracker,
  type CameraCapture,
  type CameraStream,
  type HeadAdapter,
  type TrackingWorker,
} from "./head-tracker.ts";
const deferred = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((a, b) => {
    resolve = a;
    reject = b;
  });
  return { promise, resolve, reject };
};
function fixture() {
  const permission = deferred<CameraStream>(),
    preparation = deferred<CameraCapture>(),
    bitmap = deferred<{ close(): void }>();
  let stopped = 0,
    closed = 0,
    terminated = 0,
    workers = 0,
    bitmapClosed = 0,
    now = 0;
  const timers = new Map<number, { callback: () => void; ms: number }>();
  let id = 0;
  const messages: unknown[] = [];
  const worker: TrackingWorker = {
    onmessage: null,
    onerror: null,
    postMessage: (m) => {
      messages.push(m);
    },
    terminate() {
      terminated++;
    },
  };
  const stream = {
    getTracks: () => [
      {
        stop() {
          stopped++;
        },
      },
    ],
  };
  const capture = {
    frame: () => bitmap.promise,
    close() {
      closed++;
    },
  };
  const adapter: HeadAdapter = {
    media: () => permission.promise,
    capture: () => preparation.promise,
    worker: () => {
      workers++;
      return worker;
    },
    now: () => now,
    later(callback, ms) {
      timers.set(++id, { callback, ms });
      return id;
    },
    cancel(key) {
      timers.delete(key as number);
    },
  };
  const statuses: string[] = [];
  const tracker = createHeadTracker(adapter, (s) => statuses.push(s.state));
  const send = (type: string, extra = {}) =>
    worker.onmessage?.({
      data: { type, generation: tracker.status.generation, ...extra },
    });
  const runFrame = () => {
    const t = [...timers].find(([, v]) => v.ms <= 1000 / 15);
    assert.ok(t);
    timers.delete(t[0]);
    t[1].callback();
  };
  return {
    tracker,
    permission,
    preparation,
    bitmap,
    stream,
    capture,
    worker,
    messages,
    statuses,
    send,
    runFrame,
    timers,
    counters: () => ({ stopped, closed, terminated, workers, bitmapClosed }),
    tick: () => {
      now += 100;
    },
    frame: {
      close() {
        bitmapClosed++;
      },
    },
  };
}
test("camera remains idle until start and requests permission before capture/worker; denial falls back", async () => {
  const f = fixture();
  assert.equal(String(f.tracker.status.state), "idle");
  assert.equal(f.counters().workers, 0);
  const start = f.tracker.start();
  assert.equal(String(f.tracker.status.state), "loading");
  assert.equal(f.counters().workers, 0);
  f.permission.reject(new DOMException("denied", "NotAllowedError"));
  await start;
  assert.equal(String(f.tracker.status.state), "fallback");
  assert.equal(f.tracker.error, "NotAllowedError");
  assert.equal(f.counters().workers, 0);
});
test("Off during pending permission stops late tracks without downloading or starting worker", async () => {
  const f = fixture();
  const start = f.tracker.start();
  const old = f.tracker.status.generation;
  f.tracker.stop();
  f.permission.resolve(f.stream);
  await start;
  assert.equal(f.counters().stopped, 1);
  assert.equal(f.counters().workers, 0);
  assert.equal(String(f.tracker.status.state), "idle");
  assert.ok(f.tracker.status.generation > old);
  assert.equal(f.timers.size, 0);
});
test("late capture and late bitmaps are closed; cannot reactivate stopped generation", async () => {
  const f = fixture();
  const start = f.tracker.start();
  f.permission.resolve(f.stream);
  await Promise.resolve();
  f.tracker.stop();
  f.preparation.resolve(f.capture);
  await start;
  assert.equal(f.counters().closed, 1);
  assert.equal(f.counters().workers, 0);
  const g = fixture();
  const started = g.tracker.start();
  g.permission.resolve(g.stream);
  g.preparation.resolve(g.capture);
  await started;
  g.send("ready");
  g.runFrame();
  const callback = g.worker.onmessage;
  const generation = g.tracker.status.generation;
  g.tracker.stop();
  g.bitmap.resolve(g.frame);
  await Promise.resolve();
  callback?.({
    data: { type: "pose", generation, pose: { x: 100, y: 0, z: 600 } },
  });
  assert.equal(g.counters().bitmapClosed, 1);
  assert.equal(g.tracker.pose, null);
  assert.equal(String(g.tracker.status.state), "idle");
  assert.equal(g.counters().terminated, 1);
});
test("one frame in flight, 15Hz pacing, no-face neutral and recovery, worker failure releases all", async () => {
  const f = fixture();
  const start = f.tracker.start();
  f.permission.resolve(f.stream);
  f.preparation.resolve(f.capture);
  await start;
  f.send("ready");
  f.runFrame();
  f.bitmap.resolve(f.frame);
  await Promise.resolve();
  assert.equal(
    f.messages.filter((m) => (m as { type: string }).type === "frame").length,
    1,
  );
  assert.equal([...f.timers.values()].filter((x) => x.ms < 100).length, 0);
  f.send("pose", { pose: null });
  assert.deepEqual(f.tracker.pose, { x: 0, y: 0, z: 600 });
  assert.deepEqual(f.tracker.status, {
    state: "active",
    generation: f.tracker.status.generation,
    face: false,
  });
  assert.ok([...f.timers.values()].some((t) => t.ms >= 1000 / 15));
  f.tick();
  f.runFrame();
  await Promise.resolve();
  f.send("pose", { pose: { x: 40, y: 10, z: 550 } });
  assert.equal(f.tracker.pose?.x, 40);
  f.worker.onerror?.();
  assert.equal(String(f.tracker.status.state), "fallback");
  assert.equal(f.counters().stopped, 1);
  assert.equal(f.counters().closed, 1);
  assert.equal(f.counters().terminated, 1);
  assert.equal(f.timers.size, 0);
});
test("loading and stalled inference time out and release the stream", async () => {
  for (const phase of ["loading", "inference"]) {
    const f = fixture();
    const start = f.tracker.start();
    f.permission.resolve(f.stream);
    f.preparation.resolve(f.capture);
    await start;
    if (phase === "inference") {
      f.send("ready");
      f.runFrame();
      f.bitmap.resolve(f.frame);
      await Promise.resolve();
    }
    const timer = [...f.timers.values()].find((t) => t.ms >= 10000);
    assert.ok(timer);
    timer.callback();
    assert.equal(String(f.tracker.status.state), "fallback");
    assert.equal(f.counters().stopped, 1);
  }
});
