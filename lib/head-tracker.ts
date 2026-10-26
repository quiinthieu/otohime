import type { EyePose } from "./peep-box.ts";

export type HeadStatus =
  | { state: "idle"; generation: number }
  | { state: "loading"; generation: number }
  | { state: "active"; generation: number; face: boolean }
  | { state: "fallback"; generation: number; error: string };
export interface HeadTracker {
  readonly status: HeadStatus;
  readonly pose: EyePose | null;
  readonly error: string | null;
  start(): Promise<void>;
  stop(): void;
}
export interface CameraStream {
  getTracks(): { stop(): void }[];
}
export interface CapturedFrame {
  close(): void;
}
export interface CameraCapture {
  frame(): Promise<CapturedFrame | null>;
  close(): void;
}
export interface TrackingWorker {
  onmessage:
    | ((event: {
        data: {
          type: string;
          generation: number;
          pose?: EyePose | null;
          error?: string;
        };
      }) => void)
    | null;
  onerror: (() => void) | null;
  postMessage(message: unknown, transfer?: Transferable[]): void;
  terminate(): void;
}
export interface HeadAdapter {
  media(): Promise<CameraStream>;
  capture(
    stream: CameraStream,
    revoked: () => void,
    signal: AbortSignal,
  ): Promise<CameraCapture>;
  worker(): TrackingWorker;
  now(): number;
  later(callback: () => void, ms: number): unknown;
  cancel(id: unknown): void;
}
const neutral = { x: 0, y: 0, z: 600 };
/** Every asynchronous boundary belongs to one generation; stop always invalidates it. */
export function createHeadTracker(
  adapter: HeadAdapter,
  changed: (status: HeadStatus, pose: EyePose | null) => void,
): HeadTracker {
  let generation = 0,
    status: HeadStatus = { state: "idle", generation },
    pose: EyePose | null = null;
  let stream: CameraStream | undefined,
    capture: CameraCapture | undefined,
    worker: TrackingWorker | undefined;
  let cancellation = new AbortController();
  let timer: unknown,
    deadline: unknown,
    inFlight = false,
    last = -Infinity;
  const update = (next: HeadStatus, value: EyePose | null = null) => {
    status = next;
    pose = value;
    changed(status, pose);
  };
  const stop = () => {
    generation++;
    cancellation.abort();
    cancellation = new AbortController();
    adapter.cancel(timer);
    adapter.cancel(deadline);
    timer = deadline = undefined;
    if (worker) {
      worker.onmessage = worker.onerror = null;
      try {
        worker.postMessage({ type: "stop" });
      } catch {
        /* already failed */
      }
      worker.terminate();
      worker = undefined;
    }
    capture?.close();
    capture = undefined;
    stream?.getTracks().forEach((track) => track.stop());
    stream = undefined;
    inFlight = false;
    last = -Infinity;
    update({ state: "idle", generation });
  };
  const fail = (error: string) => {
    stop();
    update({ state: "fallback", generation, error });
  };
  const schedule = (token: number) => {
    if (token !== generation || status.state !== "active") return;
    adapter.cancel(timer);
    timer = adapter.later(
      () => {
        void frame(token);
      },
      Math.max(0, 1000 / 15 - (adapter.now() - last)),
    );
  };
  const frame = async (token: number) => {
    if (
      token !== generation ||
      status.state !== "active" ||
      inFlight ||
      !capture
    )
      return;
    inFlight = true;
    try {
      const bitmap = await capture.frame();
      if (token !== generation) {
        bitmap?.close();
        return;
      }
      if (!bitmap) {
        inFlight = false;
        last = adapter.now();
        schedule(token);
        return;
      }
      last = adapter.now();
      try {
        worker!.postMessage(
          { type: "frame", generation: token, bitmap, time: last },
          [bitmap as unknown as Transferable],
        );
      } catch {
        bitmap.close();
        throw new Error("frame_transfer");
      }
      // A crashed or nonresponsive worker must release the camera too.
      deadline = adapter.later(() => {
        if (token === generation) fail("worker_timeout");
      }, 10_000);
    } catch {
      if (token === generation) fail("capture");
    }
  };
  return {
    get status() {
      return status;
    },
    get pose() {
      return pose;
    },
    get error() {
      return status.state === "fallback" ? status.error : null;
    },
    stop,
    async start() {
      stop();
      const token = generation;
      update({ state: "loading", generation });
      deadline = adapter.later(() => {
        if (token === generation) fail("camera_timeout");
      }, 60_000);
      try {
        // media() is invoked directly from the gesture, before any import/model fetch.
        const acquired = await adapter.media();
        if (token !== generation) {
          acquired.getTracks().forEach((track) => track.stop());
          return;
        }
        stream = acquired;
        const prepared = await adapter.capture(
          acquired,
          () => {
            if (token === generation) fail("camera_ended");
          },
          cancellation.signal,
        );
        if (token !== generation) {
          prepared.close();
          return;
        }
        capture = prepared;
        worker = adapter.worker();
        worker.onerror = () => {
          if (token === generation) fail("worker");
        };
        worker.onmessage = ({ data }) => {
          if (token !== generation || data.generation !== token) return;
          if (data.type === "error") {
            fail(data.error ?? "worker");
            return;
          }
          if (data.type === "ready") {
            adapter.cancel(deadline);
            update({ state: "active", generation, face: false }, neutral);
            schedule(token);
          } else if (
            (data.type === "pose" || data.type === "skipped") &&
            inFlight
          ) {
            adapter.cancel(deadline);
            inFlight = false;
            if (data.type === "pose")
              update(
                { state: "active", generation, face: !!data.pose },
                data.pose ?? neutral,
              );
            schedule(token);
          }
        };
        worker.postMessage({ type: "init", generation: token });
      } catch (error) {
        if (token === generation)
          fail(error instanceof Error ? error.name : "camera");
      }
    },
  };
}
