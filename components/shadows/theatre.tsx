"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { PoseTracker, type Landmark, type ShadowPose } from "@/lib/shadow-poses";
import { createHandTracker } from "./hand-tracker";
import { creaturePath, DESTINATIONS } from "./creatures";
import { PaperPuppets } from "./paper-puppets";
import "./shadows.css";

export function ShadowTheatre() {
  const [mode, setMode] = useState<"puppets" | "starting" | "camera">("puppets");
  const [message, setMessage] = useState("The paper puppets are ready. A camera is optional.");
  const [pose, setPose] = useState<ShadowPose>("neutral");
  const [hands, setHands] = useState<Landmark[][]>([]);
  const tracker = useRef<ReturnType<typeof createHandTracker> | null>(null);
  const poses = useRef(new PoseTracker());
  function stop(message = "Camera stopped. The paper puppets are ready.") {
    tracker.current?.stop(); tracker.current = null; poses.current.reset();
    setMode("puppets"); setPose("neutral"); setHands([]); setMessage(message);
  }
  useEffect(() => {
    const hidden = () => { if (document.hidden) stop("Camera stopped while this page was hidden. Start it again when you are ready."); };
    const exit = () => stop();
    document.addEventListener("visibilitychange", hidden); window.addEventListener("pagehide", exit);
    return () => { document.removeEventListener("visibilitychange", hidden); window.removeEventListener("pagehide", exit); tracker.current?.stop(); tracker.current = null; };
  }, []);
  async function start() {
    if (tracker.current) return;
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia || !window.Worker || !window.createImageBitmap) { stop("Camera tracking is unavailable in this browser. Paper puppets are ready."); return; }
    setMode("starting"); setMessage("Waiting for your camera permission, then warming the local hand model…");
    poses.current.reset();
    tracker.current = createHandTracker({
      onReady: () => { setMode("camera"); setMessage("Camera on. Hold a pose for a moment to invite a creature. Stop releases the camera."); },
      onHands: landmarks => { const result = poses.current.update(landmarks, performance.now()); setPose(result.pose); setHands(result.hands); },
      onError: message => stop(message),
    });
    await tracker.current.start();
  }
  const creature = pose === "neutral" ? null : pose;
  const anchor = hands[0]?.[9];
  const x = anchor ? Math.max(90, Math.min(510, (1 - anchor.x) * 600)) : 300;
  return <section className="shadow-theatre mt-6" data-testid="shadow-theatre" data-mode={mode} data-pose={pose} aria-label="Hand shadow puppet theatre">
    <div className="shadow-privacy"><h2 className="caption">Your hands, your device</h2><p id="camera-privacy">Camera is optional. If you enable it, MediaPipe processes your hands entirely in this browser. No video, images or hand data are uploaded or saved. No microphone is used. Stop, leaving this page, or hiding the tab releases the camera.</p></div>
    <div className="shadow-controls mt-4"><button className="btn" onClick={start} disabled={mode !== "puppets"} aria-describedby="camera-privacy">Enable camera</button><button className="btn" onClick={() => stop()} disabled={mode === "puppets"}>Stop camera</button><button className="btn" onClick={() => stop("Paper puppet mode. No camera needed.")} aria-pressed={mode === "puppets"}>Use paper puppets</button></div>
    <p role="status" className="mt-3 text-muted">{message}</p>
    <div className="shadow-stage mt-5">
      <div className="shadow-candle" aria-hidden="true"><span className="shadow-flame"/><span className="shadow-wax"/></div>
      {mode === "puppets" ? <PaperPuppets/> : <svg viewBox="0 0 600 350" className="shadow-camera-stage" role="group" aria-label="Your hand shadows">
        <g fill="#302b29" stroke="#302b29" opacity={creature ? 0.12 : 0.75}>{hands.map((h, i) => <g key={i}><polygon points={[0, 5, 9, 13, 17].map(j => `${(1 - h[j].x) * 600},${h[j].y * 350}`).join(" ")}/>{[[0, 1, 2, 3, 4], [5, 6, 7, 8], [9, 10, 11, 12], [13, 14, 15, 16], [17, 18, 19, 20]].map((chain, j) => <polyline key={j} points={chain.map(k => `${(1 - h[k].x) * 600},${h[k].y * 350}`).join(" ")} fill="none" strokeWidth="15" strokeLinecap="round" strokeLinejoin="round"/>)}</g>)}</g>
        {creature ? <g transform={`translate(${x - 65} 125)`}><a href={DESTINATIONS[creature].href} aria-label={`${creature} carries ${DESTINATIONS[creature].label}`}><g className="shadow-hop"><svg width="130" height="140" viewBox="0 0 100 105"><path className="shadow-morph" d={creaturePath(creature)} style={{ d: `path("${creaturePath(creature)}")` }} fill="#302b29"/></svg><rect x="15" y="146" width="100" height="28" rx="2" fill="#f4eddb" stroke="#76604c"/><text x="65" y="165" textAnchor="middle" fill="#302b29" fontSize="15">{DESTINATIONS[creature].label} ↗</text></g></a></g> : <text x="300" y="310" textAnchor="middle" fill="#655c4c" fontSize="15">{mode === "starting" ? "A little patience while the candle warms…" : "Your hands make the story."}</text>}
      </svg>}
    </div>
    <p id="puppet-instructions" className="text-muted mt-3">Paper mode: drag any puppet with a mouse or finger. Tab to a puppet and use the arrow keys to move it; Tab again to follow its paper tag.</p>
    <details className="mt-5"><summary className="link">Four poses to try</summary><ul className="shadow-pose-guide mt-3"><li><strong>Rabbit:</strong> index and middle fingers up, others tucked.</li><li><strong>Dog:</strong> index and little fingers up, thumb tucked.</li><li><strong>Deer:</strong> index, little finger and thumb spread out.</li><li><strong>Bird:</strong> both hands open, fingers spread like wings.</li></ul><p className="text-muted mt-2">Face your palms toward the camera in even light and hold still briefly. Recognition is an experiment; the paper puppets are always available.</p></details>
    <p className="mt-5">Let a creature carry you to <Link className="link" href="/projects">Projects</Link> or <Link className="link" href="/notes">Notes</Link>.</p>
  </section>;
}
