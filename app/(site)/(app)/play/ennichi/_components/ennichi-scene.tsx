"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  ENNICHI_MOTIFS,
  ENNICHI_SCENE_HEIGHT,
  ENNICHI_SCENE_WIDTH,
  ENNICHI_STORAGE_KEY,
  clampEnnichiViewport,
  getEnnichiPlates,
  isEnnichiStampUnlocked,
  panEnnichiViewport,
  parseEnnichiProgress,
  requestEnnichiHint,
  serializeEnnichiProgress,
  zoomEnnichiViewport,
  type EnnichiMotifId,
  type EnnichiPlate,
  type EnnichiViewport,
} from "@/lib/ennichi";
import { play } from "@/lib/sound-client";

const MOTION = "(prefers-reduced-motion: reduce)";
const ZOOM_IN = 1.25;
const PAN_STEP = 48;
const DRAG_THRESHOLD = 6;

const subscribeMotion = (listener: () => void) => {
  const media = matchMedia(MOTION);
  media.addEventListener("change", listener);
  return () => media.removeEventListener("change", listener);
};

function pointerSpan(points: Map<number, { x: number; y: number }>) {
  const [a, b] = [...points.values()];
  if (!a || !b) return 0;
  return Math.hypot(a.x - b.x, a.y - b.y);
}

const EMPTY_FOUND: ReadonlySet<EnnichiMotifId> = new Set();
const PROGRESS_EVENT = "ennichi-progress";
let cachedRaw: string | null = null;
let cachedFound: ReadonlySet<EnnichiMotifId> = EMPTY_FOUND;

function readProgress(): ReadonlySet<EnnichiMotifId> {
  let raw: string | null = null;
  try { raw = localStorage.getItem(ENNICHI_STORAGE_KEY); } catch { return cachedFound; }
  if (raw === cachedRaw) return cachedFound;
  cachedRaw = raw;
  const parsed = parseEnnichiProgress(raw);
  cachedFound = parsed.size === 0 ? EMPTY_FOUND : parsed;
  return cachedFound;
}

function writeProgress(ids: ReadonlySet<EnnichiMotifId>) {
  const raw = serializeEnnichiProgress(ids);
  try { localStorage.setItem(ENNICHI_STORAGE_KEY, raw); } catch { /* private mode keeps the in-memory sheet */ }
  cachedRaw = raw;
  cachedFound = ids.size === 0 ? EMPTY_FOUND : ids;
  window.dispatchEvent(new Event(PROGRESS_EVENT));
}

function subscribeProgress(listener: () => void) {
  window.addEventListener(PROGRESS_EVENT, listener);
  window.addEventListener("storage", listener);
  return () => {
    window.removeEventListener(PROGRESS_EVENT, listener);
    window.removeEventListener("storage", listener);
  };
}

function PlateArt({ plate }: { plate: EnnichiPlate["id"] }) {
  const line = { fill: "none", stroke: "currentColor", strokeWidth: 2.4, strokeLinejoin: "round" as const, strokeLinecap: "round" as const };
  if (plate === "cyan") return (
    <g>
      <rect x="0" y="0" width="1200" height="250" fill="currentColor" opacity="0.22" />
      <ellipse cx="180" cy="600" rx="96" ry="34" fill="currentColor" opacity="0.55" />
      <rect x="470" y="590" width="280" height="18" fill="currentColor" opacity="0.28" />
      <rect x="440" y="640" width="340" height="16" fill="currentColor" opacity="0.22" />
      <rect x="410" y="690" width="400" height="14" fill="currentColor" opacity="0.18" />
      <rect x="792" y="448" width="22" height="12" fill="currentColor" />
    </g>
  );
  if (plate === "magenta") return (
    <g>
      <rect x="468" y="56" width="264" height="26" rx="3" fill="currentColor" />
      <rect x="452" y="80" width="296" height="12" fill="currentColor" />
      {[150, 250, 860, 960, 1060].map((x) => <rect key={x} x={x} y="250" width="34" height="58" rx="16" fill="currentColor" />)}
      {[700, 790, 880].map((x) => <rect key={x} x={x} y="330" width="30" height="50" rx="14" fill="currentColor" />)}
      <ellipse cx="128" cy="586" rx="16" ry="9" fill="currentColor" transform="rotate(-20 128 586)" />
      <ellipse cx="214" cy="608" rx="14" ry="8" fill="currentColor" transform="rotate(24 214 608)" />
      <circle cx="370" cy="330" r="18" fill="currentColor" />
      <path d="M988 286 C1000 250 1024 268 1016 300 C1034 286 1044 310 1020 322 C1030 340 1004 348 992 328 C976 346 960 324 978 308 C962 292 972 264 988 286 Z" fill="currentColor" />
      <circle cx="948" cy="250" r="22" fill="currentColor" />
      <circle cx="1048" cy="236" r="20" fill="currentColor" />
      <circle cx="980" cy="560" r="16" fill="currentColor" />
      <circle cx="1048" cy="548" r="15" fill="currentColor" />
      <circle cx="1010" cy="620" r="15" fill="none" stroke="currentColor" strokeWidth="3" />
      <path d="M600 642 V668 M586 655 H614" stroke="currentColor" strokeWidth="3" />
      <path d="M600 118 V146" stroke="currentColor" strokeWidth="2" />
    </g>
  );
  if (plate === "yellow") return (
    <g>
      <circle cx="160" cy="78" r="28" fill="currentColor" />
      {[167, 267, 877, 977, 1077].map((x) => <rect key={x} x={x} y="262" width="16" height="34" rx="8" fill="currentColor" />)}
      <path d="M430 360 Q450 320 470 362 Q450 348 430 360 Z" fill="currentColor" />
      <ellipse cx="370" cy="336" rx="10" ry="7" fill="currentColor" opacity="0.85" />
      <circle cx="1004" cy="292" r="5" fill="currentColor" />
      <circle cx="980" cy="552" r="5" fill="currentColor" />
      <circle cx="1048" cy="540" r="4" fill="currentColor" />
      <rect x="500" y="560" width="200" height="6" fill="currentColor" opacity="0.7" />
      <rect x="470" y="610" width="260" height="5" fill="currentColor" opacity="0.55" />
    </g>
  );
  return (
    <g>
      <path d="M24 24 H64 M24 24 V64 M1176 24 H1136 M1176 24 V64 M24 776 H64 M24 776 V736 M1176 776 H1136 M1176 776 V736" {...line} />
      <rect x="526" y="92" width="18" height="168" fill="currentColor" />
      <rect x="656" y="92" width="18" height="168" fill="currentColor" />
      <rect x="508" y="148" width="184" height="12" fill="currentColor" />
      <path d="M600 104 V132" {...line} />
      <path d="M586 150 Q600 176 614 150" {...line} />
      <circle cx="600" cy="140" r="8" fill="none" stroke="currentColor" strokeWidth="2.2" />
      <path d="M40 300 H1160" {...line} strokeWidth="1.2" />
      <path d="M70 430 H300 M78 430 V690 M274 430 V690" {...line} />
      <ellipse cx="180" cy="600" rx="100" ry="38" {...line} />
      <ellipse cx="180" cy="534" rx="16" ry="11" {...line} />
      <circle cx="196" cy="526" r="5" {...line} />
      <path d="M168 530 H192 M174 538 H186 M180 526 V542" {...line} strokeWidth="1.4" />
      <path d="M280 248 H490 M292 248 V470 M468 248 V470" {...line} />
      <path d="M424 390 V430 M410 430 H470" {...line} />
      <circle cx="370" cy="324" r="2" fill="currentColor" />
      <circle cx="382" cy="324" r="2" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M366 336 Q370 342 378 336" {...line} strokeWidth="1.5" />
      <path d="M640 300 H940" {...line} />
      {[688, 778, 868].map((x) => <path key={x} d={`M${x} 300 V328`} {...line} />)}
      <rect x="764" y="418" width="34" height="24" rx="3" {...line} />
      <rect x="768" y="422" width="16" height="12" {...line} strokeWidth="1.4" />
      <path d="M900 190 H1140 M912 190 V430 M1128 190 V430 M900 250 H1140 M900 320 H1140" {...line} />
      <path d="M936 250 Q948 226 960 250 M1036 236 Q1048 214 1060 236" {...line} strokeWidth="1.6" />
      <path d="M900 500 H1148 M912 500 V700 M1136 500 V700 M900 560 H1148" {...line} />
      <path d="M980 544 V500 M1048 532 V500" {...line} strokeWidth="1.6" />
      <rect x="996" y="606" width="28" height="28" {...line} transform="rotate(8 1010 620)" />
      {[0, 1, 2, 3, 4].map((step) => (
        <rect key={step} x={500 - step * 18} y={548 + step * 42} width={200 + step * 36} height="30" {...line} />
      ))}
      <rect x="582" y="636" width="36" height="26" {...line} />
      <path d="M582 648 H618" {...line} strokeWidth="1.4" />
      <path d="M80 740 H1120" {...line} />
      <text x="36" y="430" fill="currentColor" fontSize="18" style={{ letterSpacing: "0.35em" }}>縁日</text>
    </g>
  );
}

export function EnnichiScene() {
  const rawId = useId().replace(/:/g, "");
  const reducedMotion = useSyncExternalStore(subscribeMotion, () => matchMedia(MOTION).matches, () => false);
  const found = useSyncExternalStore(subscribeProgress, readProgress, () => EMPTY_FOUND);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [viewport, setViewport] = useState<EnnichiViewport>({ scale: 1, tx: 0, ty: 0 });
  const [hintText, setHintText] = useState("Raise the lantern when you would like a nudge toward a stall.");
  const [lanternId, setLanternId] = useState<EnnichiMotifId | null>(null);
  const lastHintAt = useRef<number | null>(null);
  const nodeRef = useRef<HTMLDivElement>(null);
  const sizeRef = useRef({ w: 0, h: 0 });
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef(0);
  const gesture = useRef({ startX: 0, startY: 0, lastX: 0, lastY: 0, moved: false });
  const suppressClick = useRef(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(ENNICHI_STORAGE_KEY);
      const clean = serializeEnnichiProgress(parseEnnichiProgress(raw));
      if (raw !== clean) localStorage.setItem(ENNICHI_STORAGE_KEY, clean);
    } catch { /* a blocked store still plays for this visit */ }
  }, []);

  useLayoutEffect(() => {
    const node = nodeRef.current;
    if (!node) return;
    const measure = () => {
      // client box matches the svg, which is inside the 1px print border.
      const next = { w: node.clientWidth, h: node.clientHeight };
      sizeRef.current = next;
      setSize((prev) => (prev.w === next.w && prev.h === next.h ? prev : next));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const move = (event: PointerEvent) => {
      if (!pointers.current.has(event.pointerId)) return;
      pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
      const { w, h } = sizeRef.current;
      const node = nodeRef.current;
      if (!node || w <= 0 || h <= 0) return;
      const rect = node.getBoundingClientRect();
      if (pointers.current.size >= 2) {
        const dist = pointerSpan(pointers.current);
        const prev = pinch.current || dist;
        pinch.current = dist;
        gesture.current.moved = true;
        if (prev > 0 && dist > 0) {
          const pts = [...pointers.current.values()];
          setViewport((view) => zoomEnnichiViewport(view, dist / prev, (pts[0].x + pts[1].x) / 2 - rect.left, (pts[0].y + pts[1].y) / 2 - rect.top, w, h));
        }
        return;
      }
      const travel = Math.hypot(event.clientX - gesture.current.startX, event.clientY - gesture.current.startY);
      if (travel > DRAG_THRESHOLD) gesture.current.moved = true;
      if (!gesture.current.moved) return;
      const dx = event.clientX - gesture.current.lastX;
      const dy = event.clientY - gesture.current.lastY;
      gesture.current.lastX = event.clientX;
      gesture.current.lastY = event.clientY;
      setViewport((view) => panEnnichiViewport(view, dx, dy, w, h));
    };
    const up = (event: PointerEvent) => {
      if (!pointers.current.has(event.pointerId)) return;
      pointers.current.delete(event.pointerId);
      if (pointers.current.size < 2) pinch.current = 0;
      if (pointers.current.size === 0 && gesture.current.moved) {
        suppressClick.current = true;
        requestAnimationFrame(() => { suppressClick.current = false; });
      }
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, []);

  useEffect(() => {
    const node = nodeRef.current;
    if (!node) return;
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      const { w, h } = sizeRef.current;
      if (w <= 0 || h <= 0) return;
      const rect = node.getBoundingClientRect();
      setViewport((view) => zoomEnnichiViewport(view, Math.exp(-event.deltaY * 0.0016), event.clientX - rect.left, event.clientY - rect.top, w, h));
    };
    node.addEventListener("wheel", wheel, { passive: false });
    return () => node.removeEventListener("wheel", wheel);
  }, []);

  const ready = size.w > 0 && size.h > 0;
  const view = ready ? clampEnnichiViewport(viewport, size.w, size.h) : viewport;
  const unit = ready ? Math.min(size.w / ENNICHI_SCENE_WIDTH, size.h / ENNICHI_SCENE_HEIGHT) * view.scale : 1;
  const frame = {
    x: -view.tx / unit,
    y: -view.ty / unit,
    w: (ready ? size.w : ENNICHI_SCENE_WIDTH) / unit,
    h: (ready ? size.h : ENNICHI_SCENE_HEIGHT) / unit,
  };
  const plates = getEnnichiPlates(reducedMotion);
  const lantern = ENNICHI_MOTIFS.find((motif) => motif.id === lanternId);
  const unlocked = isEnnichiStampUnlocked(found);

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.current.size === 1) {
      gesture.current = { startX: event.clientX, startY: event.clientY, lastX: event.clientX, lastY: event.clientY, moved: false };
      pinch.current = 0;
    } else {
      pinch.current = pointerSpan(pointers.current);
      gesture.current.moved = true;
    }
  };

  const onClickCapture = (event: React.MouseEvent) => {
    if (!suppressClick.current) return;
    suppressClick.current = false;
    event.preventDefault();
    event.stopPropagation();
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!ready) return;
    const step = event.shiftKey ? PAN_STEP * 2 : PAN_STEP;
    const delta: Record<string, [number, number]> = {
      ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step],
    };
    const change = delta[event.key];
    if (!change) return;
    event.preventDefault();
    setViewport((current) => panEnnichiViewport(current, change[0], change[1], size.w, size.h));
  };

  const zoom = (factor: number) => {
    if (!ready) return;
    setViewport((current) => zoomEnnichiViewport(current, factor, size.w / 2, size.h / 2, size.w, size.h));
  };

  const find = (id: EnnichiMotifId) => {
    const current = readProgress();
    if (current.has(id)) return;
    const next = new Set(current);
    next.add(id);
    writeProgress(next);
    play("stamp");
  };

  const askHint = () => {
    if (!ready) return;
    const nowMs = Date.now();
    const result = requestEnnichiHint({
      foundIds: readProgress(),
      focusX: (size.w / 2 - view.tx) / unit,
      focusY: (size.h / 2 - view.ty) / unit,
      nowMs,
      lastHintAtMs: lastHintAt.current,
    });
    if (result.status === "ready") {
      lastHintAt.current = nowMs;
      setLanternId(result.motifId);
      setHintText(result.clue);
      play("rustle");
      return;
    }
    if (result.status === "cooldown") {
      setHintText("The lantern is still warm. Give it a moment.");
      return;
    }
    setHintText("Every keepsake is found. The festival stamp is yours.");
  };

  const reset = () => {
    lastHintAt.current = null;
    writeProgress(EMPTY_FOUND);
    setLanternId(null);
    setHintText("The sheet is blank again. The keepsakes are back in the crowd.");
  };

  return (
    <section className="ennichi-scene" data-testid="ennichi-scene" data-own-sound="" data-reduced-motion={reducedMotion ? "true" : "false"}>
      <div className="ennichi-tools">
        <button type="button" className="btn" data-testid="ennichi-zoom-in" onClick={() => zoom(ZOOM_IN)} aria-label="Zoom in">+</button>
        <button type="button" className="btn" data-testid="ennichi-zoom-out" onClick={() => zoom(1 / ZOOM_IN)} aria-label="Zoom out">−</button>
        <button type="button" className="btn" data-testid="ennichi-zoom-reset" onClick={() => setViewport(clampEnnichiViewport({ scale: 1, tx: 0, ty: 0 }, size.w || 1, size.h || 1))}>Reset view</button>
        <button type="button" className="btn" data-testid="ennichi-hint-btn" onClick={askHint}>Raise hint lantern</button>
        <button type="button" className="btn" data-testid="ennichi-reset-btn" onClick={reset}>Reset progress</button>
      </div>
      <div
        ref={nodeRef}
        className="ennichi-viewport"
        data-testid="ennichi-viewport"
        data-ready={ready ? "true" : "false"}
        data-scale={Number(view.scale.toFixed(4))}
        data-tx={Number(view.tx.toFixed(2))}
        data-ty={Number(view.ty.toFixed(2))}
        tabIndex={0}
        aria-label="Festival print. Drag to pan, pinch or scroll to zoom, arrow keys to look around."
        onPointerDown={onPointerDown}
        onClickCapture={onClickCapture}
        onKeyDown={onKeyDown}
      >
        {ready && (
          <svg
            className="ennichi-svg"
            data-testid="ennichi-svg"
            viewBox={`${frame.x} ${frame.y} ${frame.w} ${frame.h}`}
            preserveAspectRatio="xMinYMin meet"
            role="group"
          >
            <defs>
              <pattern id={`${rawId}-dots`} data-testid="ennichi-halftone" width="7" height="7" patternUnits="userSpaceOnUse">
                <circle cx="1.4" cy="1.4" r="0.9" fill="#292723" />
              </pattern>
              <radialGradient id={`${rawId}-glow`}>
                <stop offset="0%" stopColor="#f0c14a" stopOpacity="0.9" />
                <stop offset="48%" stopColor="#e0903a" stopOpacity="0.28" />
                <stop offset="100%" stopColor="#e0903a" stopOpacity="0" />
              </radialGradient>
            </defs>
            <rect x={frame.x - 4} y={frame.y - 4} width={frame.w + 8} height={frame.h + 8} fill="#f4efe4" />
            {plates.map((plate) => (
              <g
                key={plate.id}
                data-plate={plate.id}
                className="ennichi-plate"
                style={{
                  color: plate.colour,
                  ["--plate-dx" as string]: `${plate.resting.dx}px`,
                  ["--plate-dy" as string]: `${plate.resting.dy}px`,
                  ["--plate-hx" as string]: `${plate.hover.dx}px`,
                  ["--plate-hy" as string]: `${plate.hover.dy}px`,
                }}
              >
                <PlateArt plate={plate.id} />
              </g>
            ))}
            <rect x="0" y="0" width={ENNICHI_SCENE_WIDTH} height={ENNICHI_SCENE_HEIGHT} fill={`url(#${rawId}-dots)`} opacity="0.28" pointerEvents="none" />
            {lantern && (
              <circle className="ennichi-lantern" data-testid="ennichi-lantern-glow" data-active="true" cx={lantern.x} cy={lantern.y} r="150" fill={`url(#${rawId}-glow)`} />
            )}
            {ENNICHI_MOTIFS.map((motif) => {
              const isFound = found.has(motif.id);
              return (
                <g
                  key={motif.id}
                  className="ennichi-motif"
                  data-testid={`ennichi-motif-${motif.id}`}
                  data-found={isFound ? "true" : "false"}
                  role="button"
                  tabIndex={0}
                  aria-label={isFound ? `Found: ${motif.title}` : motif.unfoundLabel}
                  aria-pressed={isFound}
                  onClick={() => find(motif.id)}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter" && event.key !== " ") return;
                    event.preventDefault();
                    find(motif.id);
                  }}
                >
                  <circle className="ennichi-hit" cx={motif.x} cy={motif.y} r={motif.hitRadius} />
                </g>
              );
            })}
          </svg>
        )}
        {unlocked && (
          <div className="ennichi-stamp" data-testid="ennichi-stamp-unlocked" role="status">
            <p className="ennichi-hanko"><span>縁日</span><small>ENNICHI</small></p>
          </div>
        )}
      </div>
      <p className="ennichi-status" role="status" aria-live="polite" data-testid="ennichi-hint-status">{hintText}</p>
      <p className="ennichi-help">Drag the print to wander. A drag will not mark a find. Zoom in, then use the arrow keys while the sheet is focused. The lantern names a direction and a stall.</p>
      <ul className="ennichi-checklist" data-testid="ennichi-checklist">
        {ENNICHI_MOTIFS.map((motif) => {
          const isFound = found.has(motif.id);
          return (
            <li key={motif.id} data-motif={motif.id} data-found={isFound ? "true" : "false"}>
              <strong>{isFound ? motif.title : motif.stallRegion}</strong>
              <p>{isFound ? motif.foundStory : "Still somewhere in this stall."}</p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
