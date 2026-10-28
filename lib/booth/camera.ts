// Opt-in camera lifecycle controller for the Ink Purikura Photobooth (/play/booth).
// Never requests getUserMedia until openCamera() is explicitly called from a user gesture.
// Stops all MediaStreamTracks immediately after the 4th capture, on close(), on visibilitychange
// hidden, on pagehide, on AbortSignal abort, or on unmount(). Automatically falls back to the
// deterministic procedural paper portrait when camera is absent, denied, or in an insecure context.

import { createPixelBuffer, type PixelBuffer } from "./film-stock.ts";
import {
  generateSamplePortrait,
  SAMPLE_PORTRAIT_HEIGHT,
  SAMPLE_PORTRAIT_SEED,
  SAMPLE_PORTRAIT_WIDTH,
} from "./sample-portrait.ts";

export const BOOTH_PRIVACY_COPY =
  "Your camera stays in this tab. Nothing is uploaded.";

export const BOOTH_CAMERA_CONSTRAINTS = Object.freeze({
  video: Object.freeze({
    facingMode: "user",
    width: Object.freeze({ ideal: 960 }),
  }),
  audio: false,
} as const);

export const MAX_BOOTH_CAPTURES = 4;

export interface BoothCameraTrack {
  stop(): void;
  addEventListener?(type: string, listener: () => void, options?: unknown): void;
  removeEventListener?(type: string, listener: () => void): void;
}

export interface BoothCameraStream {
  getTracks(): readonly BoothCameraTrack[];
}

export type BoothCameraState =
  | "idle"
  | "requesting"
  | "streaming"
  | "sample"
  | "completed";

export interface BoothCameraStatus {
  readonly state: BoothCameraState;
  readonly generation: number;
  readonly capturedCount: number;
  readonly streamActive: boolean;
  readonly fallbackReason: string | null;
}

export interface BoothCameraAdapter {
  isSecureContext?: () => boolean;
  getUserMedia?: (constraints: typeof BOOTH_CAMERA_CONSTRAINTS) => Promise<BoothCameraStream>;
  readStreamFrame?: (
    stream: BoothCameraStream,
    width: number,
    height: number,
    shotIndex: number,
  ) => PixelBuffer | null;
  documentTarget?: {
    readonly hidden?: boolean;
    readonly visibilityState?: string;
    addEventListener(type: string, listener: () => void): void;
    removeEventListener(type: string, listener: () => void): void;
  } | null;
  windowTarget?: {
    addEventListener(type: string, listener: () => void): void;
    removeEventListener(type: string, listener: () => void): void;
  } | null;
  signal?: AbortSignal;
  seed?: number;
}

export interface BoothCameraController {
  readonly status: BoothCameraStatus;
  readonly capturedFrames: readonly PixelBuffer[];
  readonly stream: BoothCameraStream | null;
  openCamera(): Promise<BoothCameraStatus>;
  useSamplePortrait(reason?: string): BoothCameraStatus;
  readPreviewFrame(width?: number, height?: number): PixelBuffer;
  captureShot(options?: { width?: number; height?: number }): PixelBuffer;
  resetSession(): BoothCameraStatus;
  close(): void;
  unmount(): void;
}

function defaultBrowserAdapter(): BoothCameraAdapter {
  return {
    isSecureContext: () =>
      typeof window !== "undefined" ? Boolean(window.isSecureContext) : false,
    getUserMedia: (constraints) => {
      if (
        typeof navigator === "undefined" ||
        !navigator.mediaDevices ||
        typeof navigator.mediaDevices.getUserMedia !== "function"
      ) {
        return Promise.reject(new Error("Camera unavailable"));
      }
      return navigator.mediaDevices.getUserMedia(
        constraints as unknown as MediaStreamConstraints,
      ) as unknown as Promise<BoothCameraStream>;
    },
    documentTarget: typeof document !== "undefined" ? document : null,
    windowTarget: typeof window !== "undefined" ? window : null,
  };
}

export function createBoothCameraController(
  customAdapter: BoothCameraAdapter = {},
  onStatusChange?: (status: BoothCameraStatus) => void,
): BoothCameraController {
  const defaults = defaultBrowserAdapter();
  const adapter: BoothCameraAdapter = {
    ...defaults,
    ...customAdapter,
  };
  const baseSeed = adapter.seed ?? SAMPLE_PORTRAIT_SEED;

  let generation = 0;
  let state: BoothCameraState = "idle";
  let fallbackReason: string | null = null;
  let activeStream: BoothCameraStream | null = null;
  let captured: PixelBuffer[] = [];
  let listenersAttached = false;

  const currentStatus = (): BoothCameraStatus =>
    Object.freeze({
      state,
      generation,
      capturedCount: captured.length,
      streamActive: activeStream !== null,
      fallbackReason,
    });

  const notify = (): BoothCameraStatus => {
    const snap = currentStatus();
    onStatusChange?.(snap);
    return snap;
  };

  const stopStreamTracks = (streamToStop: BoothCameraStream | null) => {
    if (!streamToStop) return;
    for (const track of streamToStop.getTracks()) {
      try {
        track.removeEventListener?.("ended", onTrackEnded);
        track.stop();
      } catch {
        // ignore already-stopped tracks
      }
    }
  };

  const detachEnvironmentListeners = () => {
    if (!listenersAttached) return;
    listenersAttached = false;
    adapter.documentTarget?.removeEventListener("visibilitychange", onVisibilityChange);
    adapter.windowTarget?.removeEventListener("pagehide", onPageHide);
    adapter.signal?.removeEventListener("abort", onAbort);
  };

  const releaseActiveStream = () => {
    const s = activeStream;
    activeStream = null;
    stopStreamTracks(s);
    detachEnvironmentListeners();
  };

  function onTrackEnded() {
    if (!activeStream) return;
    releaseActiveStream();
    if (state === "streaming") {
      state = "sample";
      fallbackReason = "camera_ended";
      notify();
    }
  }

  function onVisibilityChange() {
    const doc = adapter.documentTarget;
    if (doc && (doc.hidden === true || doc.visibilityState === "hidden")) {
      generation++;
      releaseActiveStream();
      if (state === "streaming" || state === "requesting") {
        state = "idle";
        notify();
      }
    }
  }

  function onPageHide() {
    generation++;
    releaseActiveStream();
    if (state === "streaming" || state === "requesting") {
      state = "idle";
      notify();
    }
  }

  function onAbort() {
    generation++;
    releaseActiveStream();
    state = "idle";
    notify();
  }

  const attachEnvironmentListeners = () => {
    if (listenersAttached) return;
    listenersAttached = true;
    adapter.documentTarget?.addEventListener("visibilitychange", onVisibilityChange);
    adapter.windowTarget?.addEventListener("pagehide", onPageHide);
    adapter.signal?.addEventListener("abort", onAbort, { once: true });
  };

  const switchToSampleFallback = (reason: string): BoothCameraStatus => {
    generation++;
    releaseActiveStream();
    state = "sample";
    fallbackReason = reason;
    return notify();
  };

  const readFrameFromSource = (
    width = SAMPLE_PORTRAIT_WIDTH,
    height = SAMPLE_PORTRAIT_HEIGHT,
    poseIndex = 0,
  ): PixelBuffer => {
    if (activeStream && adapter.readStreamFrame) {
      const fromStream = adapter.readStreamFrame(activeStream, width, height, poseIndex);
      if (fromStream) return fromStream;
    }
    if (activeStream) {
      // Synthetic live feed frame when no custom DOM video reader is attached (e.g. unit test stream)
      return generateSamplePortrait({
        width,
        height,
        poseIndex,
        seed: baseSeed ^ 0x1111,
      });
    }
    return generateSamplePortrait({
      width,
      height,
      poseIndex,
      seed: baseSeed,
    });
  };

  return {
    get status() {
      return currentStatus();
    },
    get capturedFrames() {
      return Object.freeze([...captured]);
    },
    get stream() {
      return activeStream;
    },
    async openCamera(): Promise<BoothCameraStatus> {
      releaseActiveStream();
      captured = [];
      fallbackReason = null;
      const token = ++generation;

      if (adapter.signal?.aborted) {
        state = "idle";
        return notify();
      }

      const secure = adapter.isSecureContext ? adapter.isSecureContext() : false;
      if (!secure || typeof adapter.getUserMedia !== "function") {
        return switchToSampleFallback(!secure ? "insecure_context" : "camera_unavailable");
      }

      state = "requesting";
      attachEnvironmentListeners();
      notify();

      try {
        const acquired = await adapter.getUserMedia(BOOTH_CAMERA_CONSTRAINTS);
        if (token !== generation || adapter.signal?.aborted) {
          stopStreamTracks(acquired);
          return currentStatus();
        }
        const doc = adapter.documentTarget;
        if (doc && (doc.hidden === true || doc.visibilityState === "hidden")) {
          stopStreamTracks(acquired);
          state = "idle";
          return notify();
        }
        activeStream = acquired;
        for (const track of acquired.getTracks()) {
          track.addEventListener?.("ended", onTrackEnded, { once: true });
        }
        state = "streaming";
        return notify();
      } catch (err) {
        if (token !== generation) {
          return currentStatus();
        }
        const reason =
          err instanceof Error && err.name && err.name !== "Error"
            ? err.name
            : err instanceof Error && err.message
              ? err.message
              : "permission_denied";
        return switchToSampleFallback(reason);
      }
    },
    useSamplePortrait(reason = "manual_sample"): BoothCameraStatus {
      captured = [];
      return switchToSampleFallback(reason);
    },
    readPreviewFrame(
      width = SAMPLE_PORTRAIT_WIDTH,
      height = SAMPLE_PORTRAIT_HEIGHT,
    ): PixelBuffer {
      return readFrameFromSource(width, height, captured.length % MAX_BOOTH_CAPTURES);
    },
    captureShot(
      options: { width?: number; height?: number } = {},
    ): PixelBuffer {
      const width = options.width ?? SAMPLE_PORTRAIT_WIDTH;
      const height = options.height ?? SAMPLE_PORTRAIT_HEIGHT;
      if (state === "idle") {
        switchToSampleFallback("auto_sample");
      }
      const shotIndex = captured.length;
      const frame =
        shotIndex < MAX_BOOTH_CAPTURES
          ? readFrameFromSource(width, height, shotIndex)
          : captured[MAX_BOOTH_CAPTURES - 1] ?? createPixelBuffer(width, height);

      if (captured.length < MAX_BOOTH_CAPTURES) {
        captured = [...captured, frame];
      }

      // Immediately stop all camera tracks after the 4th capture!
      if (captured.length >= MAX_BOOTH_CAPTURES) {
        releaseActiveStream();
        state = "completed";
      }
      notify();
      return frame;
    },
    resetSession(): BoothCameraStatus {
      captured = [];
      if (activeStream) {
        state = "streaming";
      } else if (fallbackReason) {
        state = "sample";
      } else {
        state = "idle";
      }
      return notify();
    },
    close(): void {
      generation++;
      releaseActiveStream();
      state = "idle";
      notify();
    },
    unmount(): void {
      generation++;
      releaseActiveStream();
      state = "idle";
      notify();
    },
  };
}
