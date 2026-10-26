"use client";

import { useEffect, useRef, useState } from "react";
import { animating, bufferSize, createWater, sceneMode, type Mode, type Water } from "../_lib/scene";
import { fishTransform, newSchool, SEA, stepSchool, toSea, type Point } from "../_lib/school";

const REDUCED = "(prefers-reduced-motion: reduce)";
// The same school on the server and the first client frame: the still sea is the served one.
const SCHOOL = newSchool();
const VIEWBOX = `0 0 ${SEA.w} ${SEA.h}`;

// The sea and Otohime's palace on its floor. Served still: a static SVG-filter caustic, the fish where the seed
// puts them. Once here, the client draws the water with WebGL and lets the fish swim and flee a pointer or a touch,
// but only when motion is welcome (../_lib/scene.ts) and only while the page can be seen. Without WebGL, or under
// reduced motion, the served sea stays as it is: no context is asked for under reduced motion, and no frame runs.
export function Sea() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fishRef = useRef<SVGSVGElement>(null);
  const pointer = useRef<Point>(null);
  const [mode, setMode] = useState<Mode | "served">("served");

  useEffect(() => {
    const canvas = canvasRef.current;
    const layer = fishRef.current;
    if (!canvas || !layer) return;
    const fish = [...layer.querySelectorAll<SVGGElement>("[data-fish]")];
    const reduced = matchMedia(REDUCED);
    let school = SCHOOL;
    let water: Water | null = null;
    let tried = false;
    let mode: Mode = "static";
    let raf = 0;
    let last = 0;
    const start = performance.now();

    const fit = () => {
      const box = canvas.getBoundingClientRect();
      const { w, h } = bufferSize(box.width, box.height, devicePixelRatio);
      if (w > 0) water?.resize(w, h);
    };
    const frame = (now: number) => {
      raf = 0;
      const t = (now - start) / 1000;
      school = stepSchool(school, last ? (now - last) / 1000 : 0, t, pointer.current);
      last = now;
      school.forEach((f, i) => fish[i]?.setAttribute("transform", fishTransform(f)));
      water?.draw(t);
      schedule();
    };
    const schedule = () => {
      if (!raf && animating(mode, document.hidden)) raf = requestAnimationFrame(frame);
    };
    const stop = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      last = 0;
    };
    const update = () => {
      if (!reduced.matches && !tried) {
        tried = true;
        water = createWater(canvas);
        fit();
      }
      mode = sceneMode({ reduced: reduced.matches, webgl: water !== null });
      setMode(mode);
      if (animating(mode, document.hidden)) schedule();
      else stop();
    };
    // A lost context leaves the still sea.
    const lost = (event: Event) => {
      event.preventDefault();
      water = null;
      update();
    };

    update();
    const resized = new ResizeObserver(fit);
    resized.observe(canvas);
    reduced.addEventListener("change", update);
    document.addEventListener("visibilitychange", update);
    canvas.addEventListener("webglcontextlost", lost);
    return () => {
      stop();
      resized.disconnect();
      reduced.removeEventListener("change", update);
      document.removeEventListener("visibilitychange", update);
      canvas.removeEventListener("webglcontextlost", lost);
      water?.dispose();
    };
  }, []);

  // A pointer or a finger frightens the fish where it is; it lets go when it leaves or lifts.
  const near = (event: React.PointerEvent) => {
    const box = fishRef.current?.getBoundingClientRect();
    pointer.current = box ? toSea(event.clientX, event.clientY, box) : null;
  };
  const gone = () => {
    pointer.current = null;
  };

  return (
    <div
      className="sea"
      data-water={mode}
      role="img"
      aria-label="An ink sea. Light plays on the floor around Otohime's palace, and ink fish dart away from your pointer or your touch."
      onPointerMove={near}
      onPointerDown={near}
      onPointerUp={(event) => event.pointerType !== "mouse" && gone()}
      onPointerLeave={gone}
      onPointerCancel={gone}
    >
      <svg className="sea-still" viewBox={VIEWBOX} preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <defs>
          {/* Still caustics: turbulence whose middle values (the contours where it crosses one half) are lit, so
             the lines meet in the net that light leaves on a sea floor. No animation: this is the fallback. */}
          <filter id="ryugu-caustic" x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
            <feTurbulence type="fractalNoise" baseFrequency="0.009 0.016" numOctaves={2} seed={7} />
            <feColorMatrix type="matrix" values="0 0 0 0 0.84  0 0 0 0 0.91  0 0 0 0 0.93  1 0 0 0 0" />
            <feComponentTransfer>
              <feFuncA type="table" tableValues="0 0 0 0.04 0.55 0.04 0 0 0" />
            </feComponentTransfer>
          </filter>
        </defs>
        <rect className="caustic" width={SEA.w} height={SEA.h} filter="url(#ryugu-caustic)" />
        <Palace />
      </svg>
      <canvas ref={canvasRef} className="sea-water" aria-hidden="true" />
      <svg ref={fishRef} className="sea-fish" viewBox={VIEWBOX} preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        {SCHOOL.map((f, i) => (
          <g key={i} data-fish="" transform={fishTransform(f)}>
            <path className="fish-body" d="M28 0C18-12-8-13-20-2L-34-12-30 0-34 12-20 2C-8 13 18 12 28 0Z" />
            <path className="fish-fin" d="M2-9C-2-16-8-18-12-17M2 9C-2 15-7 17-10 16" />
            <circle className="fish-eye" cx={17} cy={-3} r={2} />
          </g>
        ))}
      </svg>
    </div>
  );
}

// Ryugu-jo on the sea floor: a plinth, two storeys of pillars and three curved roofs, drawn in pale ink lines.
function Palace() {
  return (
    <g className="palace-ink" transform={`translate(${SEA.w / 2} ${SEA.h - 18})`}>
      <path d="M-210 0H210M-170 -12H170V0H-170Z" />
      <path d="M-130 -12V-82M-78 -12V-82M-26 -12V-82M26 -12V-82M78 -12V-82M130 -12V-82" />
      <path d="M-180 -82Q-90 -92 0 -94Q90 -92 180 -82L156 -100Q0 -114 -156 -100Z" />
      <path d="M-92 -102V-148M-46 -102V-148M0 -102V-148M46 -102V-148M92 -102V-148" />
      <path d="M-126 -148Q0 -160 126 -148L104 -166Q0 -176 -104 -166Z" />
      <path d="M-34 -168V-198M34 -168V-198" />
      <path d="M-74 -198Q0 -208 74 -198L54 -214Q0 -222 -54 -214Z" />
      <path d="M0 -220V-246M-6 -234H6" />
      <path className="palace-gate" d="M-14 -12V-52Q0 -64 14 -52V-12" />
    </g>
  );
}
