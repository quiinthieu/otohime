import {
  createHeadTracker,
  type CameraStream,
  type HeadStatus,
  type TrackingWorker,
} from "@/lib/head-tracker";
import type { EyePose } from "@/lib/peep-box";
import manifest from "@/content/peep-box-assets.json";

export function cameraTracker(
  changed: (status: HeadStatus, pose: EyePose | null) => void,
) {
  return createHeadTracker(
    {
      media() {
        if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia)
          return Promise.reject(new Error("Camera unavailable"));
        return navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            width: { ideal: 640, max: 640 },
            height: { ideal: 480, max: 480 },
            facingMode: "user",
          },
        });
      },
      async capture(stream: CameraStream, revoked, signal) {
        const video = document.createElement("video");
        video.muted = true;
        video.playsInline = true;
        const media = stream as MediaStream;
        const close = () => {
          media
            .getTracks()
            .forEach((track) => track.removeEventListener("ended", revoked));
          signal.removeEventListener("abort", close);
          video.pause();
          video.srcObject = null;
        };
        signal.addEventListener("abort", close, { once: true });
        video.srcObject = media;
        media
          .getTracks()
          .forEach((track) =>
            track.addEventListener("ended", revoked, { once: true }),
          );
        try {
          await video.play();
        } catch (error) {
          close();
          throw error;
        }
        return {
          close,
          async frame() {
            if (video.readyState < 2 || !video.videoWidth) return null;
            const ratio = Math.min(
              1,
              640 / video.videoWidth,
              480 / video.videoHeight,
            );
            return createImageBitmap(video, {
              resizeWidth: Math.max(1, Math.floor(video.videoWidth * ratio)),
              resizeHeight: Math.max(1, Math.floor(video.videoHeight * ratio)),
            });
          },
        };
      },
      worker: () =>
        new Worker(
          `/vendor/peep-box/${manifest.version}/head-worker.js`,
        ) as unknown as TrackingWorker,
      now: () => performance.now(),
      later: (callback, ms) => setTimeout(callback, ms),
      cancel: (id) => clearTimeout(id as ReturnType<typeof setTimeout>),
    },
    changed,
  );
}
