import type { Landmark } from "@/lib/shadow-poses";
export const HAND_WORKER = "/vendor/hand-landmarker/vision-0.10.32-hand-1/hand-worker.js";
type Callbacks = { onHands: (hands: Landmark[][]) => void; onReady: (delegate: string) => void; onError: (message: string) => void };
export type TrackerPlatform = {
  camera: () => Promise<MediaStream>;
  worker: () => Worker;
  video: () => HTMLVideoElement;
  bitmap: (video: HTMLVideoElement) => Promise<ImageBitmap>;
};
/** Constructing/importing this controller never requests camera access. start() is user initiated. */
export function createHandTracker(callbacks: Callbacks, platform?: TrackerPlatform) {
  const p: TrackerPlatform = platform ?? {
    camera: () => navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: "user", width: { max: 640 }, height: { max: 480 } } }),
    worker: () => new Worker(HAND_WORKER),
    video: () => document.createElement("video"),
    bitmap: video => createImageBitmap(video),
  };
  let stopped = false, started = false, stream: MediaStream | undefined, worker: Worker | undefined, video: HTMLVideoElement | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined, deadline: ReturnType<typeof setTimeout> | undefined;
  function stop() {
    stopped = true;
    clearTimeout(timer); clearTimeout(deadline);
    worker?.terminate(); worker = undefined;
    stream?.getTracks().forEach(t => t.stop()); stream = undefined;
    if (video) { video.pause(); video.srcObject = null; video.remove(); video = undefined; }
  }
  function fail(message: string) { if (stopped) return; stop(); callbacks.onError(message); }
  async function frame() {
    if (stopped || !video || !worker) return;
    try {
      const bitmap = await p.bitmap(video);
      if (stopped || !worker) { bitmap.close(); return; }
      if (bitmap.width > 640 || bitmap.height > 480) { bitmap.close(); throw new Error("frame size"); }
      worker.postMessage({ type: "frame", bitmap, time: performance.now() }, [bitmap]);
      deadline = setTimeout(() => fail("Hand tracking stopped responding. Paper puppets are ready."), 10000);
    } catch { fail("This browser cannot track hands. Paper puppets are ready."); }
  }
  async function start() {
    if (started || stopped) return;
    started = true;
    try {
      // Stop may be clicked while the native permission prompt is still open.
      const acquired = await p.camera();
      if (stopped) { acquired.getTracks().forEach(t => t.stop()); return; }
      stream = acquired;
      stream.getVideoTracks().forEach(t => t.addEventListener("ended", () => fail("Camera disconnected. Paper puppets are ready."), { once: true }));
      video = p.video(); video.muted = true; video.playsInline = true; video.srcObject = stream;
      await video.play();
      if (stopped) return;
      worker = p.worker();
      deadline = setTimeout(() => fail("The hand model could not start. Paper puppets are ready."), 30000);
      worker.onerror = () => fail("The hand model could not start. Paper puppets are ready.");
      worker.onmessage = ({ data }) => {
        if (stopped) return;
        clearTimeout(deadline);
        if (data.type === "error") { fail("The hand model is unavailable. Paper puppets are ready."); return; }
        if (data.type === "ready") callbacks.onReady(data.delegate);
        if (data.type === "hands") callbacks.onHands(data.hands);
        if (["ready", "hands", "skipped"].includes(data.type)) timer = setTimeout(() => void frame(), 55);
      };
      worker.postMessage({ type: "init" });
    } catch { fail("Camera access was unavailable or declined. Paper puppets are ready."); }
  }
  return { start, stop };
}
