"use client";

import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type RefObject,
} from "react";
import {
  boundEye,
  NEUTRAL,
  orientationPose,
  PoseSession,
  projectLayer,
  smoothAxis,
  type EyePose,
  type PoseSource,
} from "@/lib/peep-box";

import { cameraTracker } from "./camera";
import type { HeadStatus } from "@/lib/head-tracker";

const MOTION = "(prefers-reduced-motion: reduce)";
const subscribe = (notify: () => void) => {
  const q = matchMedia(MOTION);
  q.addEventListener("change", notify);
  return () => q.removeEventListener("change", notify);
};
type Controls = {
  look: (x: number, y: number) => void;
  tilt: () => void;
  calibrate: () => void;
  camera: () => void;
  cameraOff: () => void;
};
type OrientationPermission = typeof DeviceOrientationEvent & {
  requestPermission?: () => Promise<string>;
};

export default function Active({
  root,
}: {
  root: RefObject<HTMLDivElement | null>;
}) {
  const reduced = useSyncExternalStore(
    subscribe,
    () => matchMedia(MOTION).matches,
    () => true,
  );
  const control = useRef<Controls | null>(null);
  const status = useRef<HTMLParagraphElement>(null);
  const [cameraState, setCameraState] = useState<HeadStatus>({
    state: "idle",
    generation: 0,
  });

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const layers = [...el.querySelectorAll<SVGGElement>("[data-peep-layer]")];
    const aperture = el.querySelector<HTMLElement>("[data-peep-aperture]")!;
    const session = new PoseSession();
    let frame = 0,
      last = 0,
      inView = false,
      gone = false,
      disposed = false,
      running = false,
      generation = 0;
    let target = { ...NEUTRAL },
      eye = { ...NEUTRAL };
    let x = { position: 0, velocity: 0 },
      y = { position: 0, velocity: 0 },
      z = { position: 600, velocity: 0 };
    let zero: { beta: number; gamma: number } | null = null,
      lastAngle: number | null = null;
    const say = (text: string) => {
      if (status.current) status.current.textContent = text;
    };
    const paint = () => {
      for (const layer of layers) {
        const p = projectLayer(eye, Number(layer.dataset.peepLayer));
        layer.setAttribute(
          "transform",
          `matrix(${p.scale} 0 0 ${p.scale} ${p.x} ${p.y})`,
        );
      }
    };
    const cancel = () => {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      last = 0;
      el.setAttribute("data-moving", "false");
    };
    const reset = () => {
      cancel();
      eye = { ...NEUTRAL };
      target = { ...NEUTRAL };
      x = { position: 0, velocity: 0 };
      y = { position: 0, velocity: 0 };
      z = { position: 600, velocity: 0 };
      paint();
    };
    const tick = (time: number) => {
      frame = 0;
      if (!running) return;
      const dt = last ? (time - last) / 1000 : 1 / 60;
      last = time;
      x = smoothAxis(x, target.x, dt);
      y = smoothAxis(y, target.y, dt);
      z = smoothAxis(z, target.z, dt);
      eye = boundEye({ x: x.position, y: y.position, z: z.position });
      paint();
      if (
        x.position !== target.x ||
        y.position !== target.y ||
        z.position !== target.z ||
        x.velocity ||
        y.velocity ||
        z.velocity
      ) {
        frame = requestAnimationFrame(tick);
      } else {
        last = 0;
        el.setAttribute("data-moving", "false");
      }
    };
    const emit = (pose: EyePose) => {
      if (!running) return;
      target = boundEye(pose);
      if (
        !frame &&
        (eye.x !== target.x || eye.y !== target.y || eye.z !== target.z)
      ) {
        el.setAttribute("data-moving", "true");
        frame = requestAnimationFrame(tick);
      }
    };
    const pointer: PoseSource = {
      kind: "pointer",
      start(emit) {
        const move = (e: PointerEvent) => {
          if (e.pointerType === "touch") return;
          const r = aperture.getBoundingClientRect();
          if (r.width && r.height)
            emit({
              x: ((e.clientX - r.left) / r.width - 0.5) * 300,
              y: ((e.clientY - r.top) / r.height - 0.5) * 200,
              z: 600,
            });
        };
        const leave = () => emit(NEUTRAL);
        aperture.addEventListener("pointermove", move, { passive: true });
        aperture.addEventListener("pointerleave", leave, { passive: true });
        return () => {
          aperture.removeEventListener("pointermove", move);
          aperture.removeEventListener("pointerleave", leave);
        };
      },
    };
    const tilt: PoseSource = {
      kind: "tilt",
      start(emit) {
        zero = null;
        lastAngle = null;
        const read = (e: DeviceOrientationEvent) => {
          if (
            e.beta === null ||
            e.gamma === null ||
            !Number.isFinite(e.beta) ||
            !Number.isFinite(e.gamma)
          )
            return;
          const angle =
            screen.orientation?.angle ??
            (window as Window & { orientation?: number }).orientation ??
            0;
          if (!zero || lastAngle !== angle) {
            zero = { beta: e.beta, gamma: e.gamma };
            lastAngle = angle;
          }
          const pose = orientationPose(e.beta, e.gamma, angle, zero);
          if (pose) emit(pose);
        };
        window.addEventListener("deviceorientation", read, { passive: true });
        return () => window.removeEventListener("deviceorientation", read);
      },
    };
    const tracker = cameraTracker((state, pose) => {
      el.setAttribute("data-camera", state.state);
      setCameraState(state);
      if (state.state === "fallback") {
        if (running) choose(pointer);
        const explanation =
          state.error === "NotAllowedError"
            ? "Camera permission was not allowed."
            : state.error === "NotFoundError"
              ? "No camera was found."
              : /worker|model/.test(state.error)
                ? "Camera unavailable: its local model or worker could not start."
                : "Camera unavailable or disconnected.";
        say(`${explanation} Use your pointer or tilt.`);
      } else if (state.state === "active" && running) {
        if (pose) emit(pose);
        say(
          state.face
            ? "Camera on. Gently move your head."
            : "Camera on. No face found; view centred. Pointer controls are available.",
        );
      }
    });
    const camera: PoseSource = {
      kind: "camera",
      start() {
        void tracker.start();
        return () => {
          if (tracker.status.state !== "fallback") tracker.stop();
        };
      },
    };
    const choose = (source: PoseSource) => {
      session.select(source, emit);
      el.setAttribute("data-source", source.kind);
    };
    const suspend = () => {
      generation++;
      running = false;
      session.stop();
      tracker.stop();
      reset();
      el.setAttribute("data-running", "false");
      el.setAttribute("data-source", "pointer");
    };
    const decide = () => {
      const next = !reduced && inView && !document.hidden && !gone && !disposed;
      if (!next) {
        suspend();
        return;
      }
      if (running) return;
      running = true;
      el.setAttribute("data-running", "true");
      choose(pointer);
      say("Move your pointer or use the direction buttons. Tilt is optional.");
    };
    reset();
    el.setAttribute("data-source", "pointer");
    el.setAttribute("data-running", "false");
    if (reduced) {
      say("Motion is reduced. Enjoy the still paper scene.");
      return () => suspend();
    }
    control.current = {
      camera() {
        if (running) {
          generation++;
          choose(camera);
        }
      },
      cameraOff() {
        generation++;
        tracker.stop();
        if (running) choose(pointer);
        emit(NEUTRAL);
        say("Camera off. Use your pointer or tilt.");
      },
      look(px, py) {
        generation++;
        if (!running) return;
        choose(pointer);
        say("Pointer and direction buttons on.");
        emit({ x: px, y: py, z: 600 });
      },
      calibrate() {
        if (el.getAttribute("data-source") !== "tilt") {
          say("Choose Enable tilt first, or use Center for the pointer view.");
          return;
        }
        zero = null;
        lastAngle = null;
        emit(NEUTRAL);
        say("Tilt centred. Hold your device comfortably.");
      },
      async tilt() {
        tracker.stop();
        if (running) choose(pointer);
        const token = ++generation;
        const sensor = window.DeviceOrientationEvent as
          | OrientationPermission
          | undefined;
        if (!sensor) {
          say(
            "Tilt is unavailable here. Use your pointer or direction buttons.",
          );
          return;
        }
        if (!running) return;
        try {
          // This is reached only by the separate Enable tilt gesture.
          const permission = await sensor.requestPermission?.();
          if (disposed || token !== generation || !running) return;
          if (permission && permission !== "granted") {
            choose(pointer);
            say("Tilt was not allowed. Use your pointer or direction buttons.");
            return;
          }
          choose(tilt);
          say(
            "Tilt enabled. Hold still to centre, then gently move. Direction buttons return to pointer.",
          );
        } catch {
          if (!disposed && token === generation && running) {
            choose(pointer);
            say(
              "Tilt is unavailable here. Use your pointer or direction buttons.",
            );
          }
        }
      },
    };
    const observer = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      decide();
    });
    observer.observe(aperture);
    const visibility = () => decide();
    const hide = () => {
      gone = true;
      suspend();
    };
    const show = () => {
      gone = false;
      decide();
    };
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("pagehide", hide);
    window.addEventListener("pageshow", show);
    return () => {
      disposed = true;
      control.current = null;
      suspend();
      observer.disconnect();
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("pagehide", hide);
      window.removeEventListener("pageshow", show);
    };
  }, [root, reduced]);

  return (
    <div data-peep-controller="peep-box-active">
      {!reduced && (
        <>
          <div
            className="peep-row"
            role="group"
            aria-label="View direction"
            onKeyDown={(e) => {
              const poses: Record<string, [number, number]> = {
                ArrowLeft: [-120, 0],
                ArrowRight: [120, 0],
                ArrowUp: [0, -80],
                ArrowDown: [0, 80],
                Home: [0, 0],
              };
              const pose = poses[e.key];
              if (pose) {
                e.preventDefault();
                control.current?.look(...pose);
              }
            }}
          >
            {(
              [
                ["Look left", -120, 0],
                ["Look right", 120, 0],
                ["Look up", 0, -80],
                ["Look down", 0, 80],
                ["Center", 0, 0],
              ] as const
            ).map(([label, x, y]) => (
              <button
                key={label}
                type="button"
                className="btn"
                onClick={() => control.current?.look(x, y)}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="peep-row">
            <button
              disabled={
                cameraState.state === "active" ||
                cameraState.state === "loading"
              }
              type="button"
              className="btn"
              onClick={() => control.current?.camera()}
            >
              Use my camera
            </button>
            <button
              type="button"
              className="btn"
              disabled={
                cameraState.state !== "active" &&
                cameraState.state !== "loading"
              }
              onClick={() => control.current?.cameraOff()}
            >
              Turn camera off
            </button>
            <span className="peep-status">
              {cameraState.state === "active"
                ? "Camera on"
                : cameraState.state === "loading"
                  ? "Opening camera…"
                  : "Camera off"}
            </span>
          </div>
          <p className="peep-status">
            Frames stay on your device. Nothing is uploaded. Camera is optional.
          </p>
          <div className="peep-row">
            <button
              type="button"
              className="btn"
              onClick={() => control.current?.tilt()}
            >
              Enable tilt
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => control.current?.calibrate()}
            >
              Recenter tilt
            </button>
          </div>
        </>
      )}
      <p ref={status} className="peep-status" role="status">
        {reduced
          ? "Motion is reduced. Enjoy the still paper scene."
          : "Move your pointer or use the direction buttons. Tilt is optional."}
      </p>
    </div>
  );
}
