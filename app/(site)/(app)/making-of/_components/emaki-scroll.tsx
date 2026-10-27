"use client";

import {
  computeEmakiParallax,
  computeScrollProgress,
  ROLE_KEYS,
  ROLE_LABELS,
  sceneProgressForIndex,
  stepSceneIndex,
  type AgentRoleKey,
  type MakingOfScene,
} from "@/lib/making-of";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent,
} from "react";
import { flushSync } from "react-dom";

const REDUCED_QUERY = "(prefers-reduced-motion: reduce)";

function subscribeReducedMotion(onChange: () => void): () => void {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return () => {};
  }
  const media = window.matchMedia(REDUCED_QUERY);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

function getReducedMotionSnapshot(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia(REDUCED_QUERY).matches;
}

const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

export type EmakiScrollProps = {
  scenes: readonly MakingOfScene[];
  head: string | null;
};

export function EmakiScroll({ scenes, head }: EmakiScrollProps) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const listRef = useRef<HTMLOListElement | null>(null);

  const reducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotionSnapshot,
    () => false,
  );

  const [hydrated, setHydrated] = useState(false);
  const [progress, setProgress] = useState(0);
  const [trackOverflowPx, setTrackOverflowPx] = useState(() =>
    Math.max(1200, Math.max(0, scenes.length - 1) * 356),
  );
  const [manualSceneIndex, setManualSceneIndex] = useState<number | null>(null);

  useIsomorphicLayoutEffect(() => {
    setHydrated(true);

    const measureAndSync = (fromScrollEvent = false) => {
      const stageEl = stageRef.current;
      const frameEl = frameRef.current;
      const listEl = listRef.current;
      if (!stageEl || !frameEl || !listEl) return;

      const measuredOverflow = Math.max(
        800,
        listEl.scrollWidth - frameEl.clientWidth,
      );
      const rect = stageEl.getBoundingClientRect();
      const containerTop = window.scrollY + rect.top;
      const containerHeight = stageEl.offsetHeight;
      const viewportHeight = window.innerHeight;
      const nextProgress = computeScrollProgress({
        scrollY: window.scrollY,
        containerTop,
        containerHeight,
        viewportHeight,
      });

      const apply = () => {
        setTrackOverflowPx(measuredOverflow);
        setProgress(nextProgress);
        if (fromScrollEvent) {
          setManualSceneIndex(null);
        }
      };

      if (fromScrollEvent) {
        try {
          flushSync(apply);
        } catch {
          apply();
        }
      } else {
        apply();
      }
    };

    measureAndSync(false);

    const onScroll = () => measureAndSync(true);
    const onResize = () => measureAndSync(false);

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
    };
  }, [scenes.length, reducedMotion]);

  const parallax = computeEmakiParallax({
    progress,
    trackOverflowPx,
    sceneCount: scenes.length,
    reducedMotion,
  });

  const activeSceneIndex =
    manualSceneIndex !== null
      ? Math.min(Math.max(0, manualSceneIndex), Math.max(0, scenes.length - 1))
      : parallax.activeSceneIndex;
  const activeScene = scenes[activeSceneIndex] ?? scenes[0] ?? null;
  const activeRoleKey: AgentRoleKey = ROLE_KEYS[parallax.activeRoleIndex] ?? "research";

  function jumpToScene(targetIndex: number) {
    if (scenes.length === 0) return;
    const clamped = Math.min(scenes.length - 1, Math.max(0, targetIndex));
    const nextProgress = sceneProgressForIndex(clamped, scenes.length);

    const apply = () => {
      setManualSceneIndex(clamped);
      setProgress(nextProgress);
    };
    try {
      flushSync(apply);
    } catch {
      apply();
    }

    if (typeof window !== "undefined" && !reducedMotion && stageRef.current) {
      const stageEl = stageRef.current;
      const rect = stageEl.getBoundingClientRect();
      const containerTop = window.scrollY + rect.top;
      const scrollable = Math.max(0, stageEl.offsetHeight - window.innerHeight);
      if (scrollable > 0) {
        window.scrollTo({
          top: Math.round(containerTop + nextProgress * scrollable),
          behavior: "instant" as ScrollBehavior,
        });
      }
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    const next = stepSceneIndex(activeSceneIndex, event.key, scenes.length);
    if (next === null) return;
    event.preventDefault();
    jumpToScene(next);
  }

  const totalCommits = scenes.reduce((sum, s) => sum + s.commitCount, 0);
  const progressPercent = Math.round(parallax.progress * 100);

  return (
    <div
      className="emaki-root"
      data-testid="emaki-root"
      data-hydrated={hydrated ? "true" : "false"}
      data-reduced-motion={reducedMotion ? "true" : "false"}
      data-active-scene={activeScene?.planId ?? ""}
      data-active-scene-index={activeSceneIndex}
      data-progress={parallax.progress.toFixed(3)}
    >
      {/* Shared reusable SVG definitions for the four agent ink figures and handscroll seal */}
      <EmakiFigureDefs />

      <div
        className="emaki-controls-bar"
        role="region"
        aria-label="Emaki handscroll controls"
        tabIndex={0}
        onKeyDown={handleKeyDown}
        data-testid="emaki-controls"
      >
        <div className="emaki-controls-meta">
          <span className="emaki-seal-chip" aria-hidden="true">
            絵巻
          </span>
          <p
            role="status"
            aria-live="polite"
            aria-atomic="true"
            className="emaki-live-status"
            data-testid="emaki-live-status"
          >
            {activeScene
              ? `Scene ${activeSceneIndex + 1} of ${scenes.length}: ${activeScene.planId} — ${activeScene.title} (${activeScene.date})`
              : "No scenes indexed"}
          </p>
          <span className="text-muted text-xs">
            {scenes.length} plans · {totalCommits} commits
            {head ? ` · head ${head.slice(0, 10)}` : ""} · {progressPercent}% unrolled
          </span>
        </div>

        <div className="emaki-nav-buttons" role="group" aria-label="Step through scenes">
          <button
            type="button"
            className="btn btn-sm emaki-nav-btn"
            data-testid="emaki-prev-scene"
            disabled={activeSceneIndex <= 0}
            onClick={() => jumpToScene(activeSceneIndex - 1)}
          >
            ← Newer plan
          </button>
          <button
            type="button"
            className="btn btn-sm emaki-nav-btn"
            data-testid="emaki-next-scene"
            disabled={activeSceneIndex >= scenes.length - 1}
            onClick={() => jumpToScene(activeSceneIndex + 1)}
          >
            Older plan →
          </button>
        </div>
      </div>

      {/* Scroll-scrubbed sticky stage (collapses to static flow under prefers-reduced-motion or no-JS) */}
      <div
        ref={stageRef}
        className="emaki-scroll-stage"
        data-testid="emaki-scroll-stage"
        tabIndex={0}
        aria-label="Making-of Emaki handscroll stage (use Left and Right arrow keys or scroll to unroll)"
        onKeyDown={handleKeyDown}
      >
        <div className="emaki-sticky-viewport" data-testid="emaki-sticky-viewport">
          {/* Top relay frieze: four reusable ink figures passing the active plan scroll */}
          <div
            className="emaki-relay-banner"
            data-testid="emaki-relay-stage"
            data-active-role={activeRoleKey}
          >
            <div className="emaki-relay-caption">
              <span className="caption">Agent relay</span>
              <span className="text-muted text-xs">
                Researcher → Product Owner → Software Engineer → Quality Engineer ({ROLE_LABELS[activeRoleKey]} holding scroll)
              </span>
            </div>
            <svg
              className="emaki-relay-svg"
              viewBox="0 0 640 96"
              role="img"
              aria-label="Four ink figures passing a handscroll from Researcher to Product Owner, Software Engineer, and Quality Engineer"
            >
              {/* Unrolling handscroll paper bridge connecting all four figures */}
              <path
                className="emaki-relay-scroll-path"
                d="M 56 58 C 145 38, 225 76, 320 54 C 415 32, 495 72, 584 52"
                fill="none"
              />
              {ROLE_KEYS.map((roleKey, idx) => {
                const cx = 80 + idx * 160;
                const isHolder = idx === parallax.activeRoleIndex;
                return (
                  <g
                    key={roleKey}
                    className="emaki-relay-node"
                    data-relay-figure={roleKey}
                    data-active={isHolder ? "true" : "false"}
                    transform={`translate(${cx}, 48)`}
                  >
                    <use href={`#emaki-figure-${roleKey}`} x="-32" y="-36" width="64" height="64" />
                    <text x="0" y="38" textAnchor="middle" className="emaki-relay-label">
                      {ROLE_LABELS[roleKey]}
                    </text>
                  </g>
                );
              })}
              {/* Scroll baton travelling across the four figures with scroll progress */}
              <g
                className="emaki-scroll-baton"
                data-testid="emaki-scroll-baton"
                transform={`translate(${Math.round(80 + parallax.figurePassPhase * 480)}, 48)`}
              >
                <rect x="-14" y="-8" width="28" height="14" rx="3" className="emaki-baton-paper" />
                <line x1="-14" y1="-9" x2="-14" y2="7" className="emaki-baton-roller" />
                <line x1="14" y1="-9" x2="14" y2="7" className="emaki-baton-roller" />
                <circle cx="0" cy="-1" r="3.5" className="emaki-baton-seal" />
              </g>
            </svg>
          </div>

          {/* Horizontal handscroll frame with wooden rollers and 3 parallax layers */}
          <div
            ref={frameRef}
            className="emaki-viewport-frame"
            data-testid="emaki-viewport-frame"
          >
            <div className="emaki-roller emaki-roller-left" aria-hidden="true">
              <span className="emaki-roller-cap" />
            </div>

            {/* Parallax Layer 1 (Background): Sumi-ink clouds */}
            <div
              className="emaki-parallax-layer emaki-parallax-clouds"
              data-testid="emaki-layer-clouds"
              data-offset-x={parallax.cloudOffsetPx}
              aria-hidden="true"
              style={{
                transform: reducedMotion
                  ? "none"
                  : `translate3d(${parallax.cloudOffsetPx}px, 0, 0)`,
              }}
            >
              <svg viewBox="0 0 2400 180" preserveAspectRatio="none" className="emaki-bg-svg">
                <path
                  d="M 40 48 Q 140 18 240 48 T 440 44 T 660 52 T 920 40 T 1180 50 T 1460 38 T 1740 48 T 2040 42 T 2340 48"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeDasharray="12 8"
                />
                <path
                  d="M 120 92 Q 240 66 360 92 T 620 86 T 900 94 T 1220 82 T 1540 94 T 1860 84 T 2220 92"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                />
              </svg>
            </div>

            {/* Parallax Layer 2 (Midground): Pine boughs and Seigaiha ink waves */}
            <div
              className="emaki-parallax-layer emaki-parallax-pines"
              data-testid="emaki-layer-pines"
              data-offset-x={parallax.pineWaveOffsetPx}
              aria-hidden="true"
              style={{
                transform: reducedMotion
                  ? "none"
                  : `translate3d(${parallax.pineWaveOffsetPx}px, 0, 0)`,
              }}
            >
              <svg viewBox="0 0 2400 120" preserveAspectRatio="none" className="emaki-bg-svg">
                <path
                  d="M 0 96 Q 60 68 120 96 T 240 96 T 360 96 T 480 96 T 600 96 T 720 96 T 840 96 T 960 96 T 1080 96 T 1200 96 T 1320 96 T 1440 96 T 1560 96 T 1680 96 T 1800 96 T 1920 96 T 2040 96 T 2160 96 T 2280 96 T 2400 96"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                />
              </svg>
            </div>

            {/* Parallax Layer 3 (Foreground): Semantic <ol> of shipped plan scenes */}
            <ol
              ref={listRef}
              className="emaki-scene-list"
              data-testid="emaki-scene-list"
              data-translate-x={parallax.translateXPx}
              aria-label="Shipped plans in the Making-of Emaki handscroll"
              style={{
                transform: reducedMotion
                  ? "none"
                  : `translate3d(${parallax.translateXPx}px, 0, 0)`,
              }}
            >
              {scenes.map((scene, index) => {
                const isActive = index === activeSceneIndex;
                return (
                  <li
                    key={scene.planId}
                    className="emaki-scene"
                    data-testid="emaki-scene"
                    data-scene-plan={scene.planId}
                    data-scene-index={index}
                    data-active={isActive ? "true" : "false"}
                  >
                    <article className="emaki-scene-card" aria-labelledby={`scene-heading-${scene.planId}`}>
                      <header className="emaki-scene-header">
                        <div className="emaki-scene-topline">
                          <span className="emaki-scene-number">
                            Scene {String(index + 1).padStart(2, "0")}
                          </span>
                          <span className="emaki-plan-badge" data-testid="emaki-plan-id">
                            {scene.planId}
                          </span>
                          <time
                            dateTime={scene.date}
                            className="emaki-scene-date"
                            data-testid="emaki-scene-date"
                          >
                            {scene.date}
                          </time>
                        </div>

                        <h2
                          id={`scene-heading-${scene.planId}`}
                          className="emaki-scene-title"
                          data-testid="emaki-scene-heading"
                        >
                          <span className="sr-only">{scene.planId}: </span>
                          {scene.title}
                        </h2>
                      </header>

                      {/* Reusable 4-figure ink vignette passing the scroll for this plan */}
                      <div className="emaki-scene-vignette">
                        <svg
                          className="emaki-scene-svg"
                          viewBox="0 0 340 84"
                          role="img"
                          aria-label={`${scene.planId}: four ink figures (Researcher, Product Owner, Software Engineer, Quality Engineer) passing the plan scroll`}
                        >
                          <path
                            className="emaki-scene-scroll-ribbon"
                            d="M 28 50 Q 95 30, 170 48 T 312 44"
                            fill="none"
                          />
                          {ROLE_KEYS.map((roleKey, rIdx) => {
                            const x = 44 + rIdx * 84;
                            const present = scene.roles.some((r) => r.role === roleKey);
                            return (
                              <g
                                key={roleKey}
                                className="emaki-scene-figure"
                                data-figure-role={roleKey}
                                data-role-present={present ? "true" : "false"}
                                transform={`translate(${x}, 44)`}
                              >
                                <use
                                  href={`#emaki-figure-${roleKey}`}
                                  x="-26"
                                  y="-30"
                                  width="52"
                                  height="52"
                                />
                              </g>
                            );
                          })}
                          {/* Vermilion hanko stamp on the right end of the scroll */}
                          <g transform="translate(316, 22)" className="emaki-scene-hanko">
                            <rect x="-10" y="-10" width="20" height="20" rx="2" />
                            <text x="0" y="4" textAnchor="middle">
                              済
                            </text>
                          </g>
                        </svg>
                      </div>

                      <p className="emaki-scene-summary">{scene.summary}</p>

                      {/* Role & public model ID badges (omitted roles render as emaki-role-absent without data-model-id) */}
                      <ul
                        className="emaki-role-list"
                        aria-label={`Models per role for ${scene.planId}`}
                      >
                        {ROLE_KEYS.map((roleKey) => {
                          const recorded = scene.roles.find((r) => r.role === roleKey);
                          if (!recorded) {
                            return (
                              <li
                                key={roleKey}
                                className="emaki-role-item emaki-role-item-absent"
                                data-testid="emaki-role-absent"
                                data-role={roleKey}
                              >
                                <span className="emaki-role-name">{ROLE_LABELS[roleKey]}</span>
                                <span className="emaki-role-skipped">— skipped</span>
                              </li>
                            );
                          }
                          return (
                            <li
                              key={roleKey}
                              className="emaki-role-item"
                              data-testid="emaki-role-badge"
                              data-role={roleKey}
                              data-model-id={recorded.modelId}
                            >
                              <span className="emaki-role-name">{recorded.label}</span>
                              <code className="emaki-role-model">{recorded.modelId}</code>
                            </li>
                          );
                        })}
                      </ul>

                      <footer className="emaki-scene-footer">
                        <div className="emaki-scene-areas">
                          <span className="badge">
                            {scene.commitCount} {scene.commitCount === 1 ? "commit" : "commits"}
                          </span>
                          {scene.areas.map((area) => (
                            <span key={area} className="badge">
                              {area}
                            </span>
                          ))}
                        </div>

                        <a
                          href={scene.commitUrl}
                          className="emaki-commit-link"
                          data-testid="emaki-commit-link"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Commit <code>{scene.sha}</code> ↗
                        </a>
                      </footer>
                    </article>
                  </li>
                );
              })}
            </ol>

            <div className="emaki-roller emaki-roller-right" aria-hidden="true">
              <span className="emaki-roller-cap" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function EmakiFigureDefs() {
  return (
    <svg className="emaki-figure-defs" aria-hidden="true" width="0" height="0">
      <defs>
        {/* 1. Researcher: Scholar with wide sedge hat, lantern, and open field scroll */}
        <g id="emaki-figure-research" viewBox="-32 -36 64 64">
          <ellipse cx="0" cy="24" rx="18" ry="4" fill="rgba(30, 25, 20, 0.14)" />
          {/* Sedge hat (kasa) */}
          <path
            d="M -22 -14 Q 0 -30 22 -14 Z"
            fill="#fbf6ea"
            stroke="#1e1914"
            strokeWidth="2.4"
            strokeLinejoin="round"
          />
          {/* Head */}
          <circle cx="0" cy="-7" r="7" fill="#fbf6ea" stroke="#1e1914" strokeWidth="2.2" />
          {/* Robe */}
          <path
            d="M -13 22 C -12 4, -8 -1, 0 -1 C 8 -1, 12 4, 13 22 Z"
            fill="#fbf6ea"
            stroke="#1e1914"
            strokeWidth="2.4"
            strokeLinejoin="round"
          />
          {/* Magnifying lens / lantern & unrolling scroll */}
          <circle cx="-15" cy="4" r="5" fill="#f4b829" stroke="#1e1914" strokeWidth="2" />
          <rect
            x="4"
            y="3"
            width="16"
            height="9"
            rx="1.5"
            fill="#fffdf8"
            stroke="#1e1914"
            strokeWidth="2"
          />
        </g>

        {/* 2. Product Owner: Court architect in eboshi cap stamping a plan scroll */}
        <g id="emaki-figure-product_owner" viewBox="-32 -36 64 64">
          <ellipse cx="0" cy="24" rx="18" ry="4" fill="rgba(30, 25, 20, 0.14)" />
          {/* Tall eboshi cap */}
          <path
            d="M -9 -14 L -6 -28 Q 0 -31 6 -28 L 9 -14 Z"
            fill="#1e1914"
            stroke="#1e1914"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          {/* Head */}
          <circle cx="0" cy="-7" r="7" fill="#fbf6ea" stroke="#1e1914" strokeWidth="2.2" />
          {/* Haori robe */}
          <path
            d="M -14 22 C -14 3, -9 -1, 0 -1 C 9 -1, 14 3, 14 22 Z"
            fill="#fbf6ea"
            stroke="#1e1914"
            strokeWidth="2.4"
            strokeLinejoin="round"
          />
          {/* Blueprint scroll with vermilion plan seal */}
          <rect
            x="-12"
            y="3"
            width="24"
            height="10"
            rx="2"
            fill="#fffdf8"
            stroke="#1e1914"
            strokeWidth="2"
          />
          <circle cx="4" cy="8" r="2.8" fill="#d63c2d" />
        </g>

        {/* 3. Software Engineer: Artisan in hachimaki headband brushing code lines */}
        <g id="emaki-figure-software_engineer" viewBox="-32 -36 64 64">
          <ellipse cx="0" cy="24" rx="18" ry="4" fill="rgba(30, 25, 20, 0.14)" />
          {/* Head + twisted hachimaki headband */}
          <circle cx="0" cy="-7" r="7.5" fill="#fbf6ea" stroke="#1e1914" strokeWidth="2.2" />
          <path
            d="M -8 -10 L 8 -10 M 8 -10 L 14 -14 M 8 -10 L 15 -7"
            fill="none"
            stroke="#d63c2d"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
          {/* Work tunic */}
          <path
            d="M -13 22 C -12 3, -8 -1, 0 -1 C 8 -1, 12 3, 13 22 Z"
            fill="#fbf6ea"
            stroke="#1e1914"
            strokeWidth="2.4"
            strokeLinejoin="round"
          />
          {/* Sumi ink brush & scroll */}
          <path
            d="M -14 14 L 12 -2"
            stroke="#1e1914"
            strokeWidth="2.8"
            strokeLinecap="round"
          />
          <path d="M 12 -2 L 17 -6 L 15 1 Z" fill="#1e1914" />
        </g>

        {/* 4. Quality Engineer: Gatekeeper inspector with vermilion hanko stamp & scale */}
        <g id="emaki-figure-quality_engineer" viewBox="-32 -36 64 64">
          <ellipse cx="0" cy="24" rx="18" ry="4" fill="rgba(30, 25, 20, 0.14)" />
          {/* Inspector cap */}
          <path
            d="M -12 -13 Q 0 -23 12 -13 Z"
            fill="#1e1914"
            stroke="#1e1914"
            strokeWidth="2"
          />
          {/* Head */}
          <circle cx="0" cy="-7" r="7" fill="#fbf6ea" stroke="#1e1914" strokeWidth="2.2" />
          {/* Robe */}
          <path
            d="M -13 22 C -12 3, -8 -1, 0 -1 C 8 -1, 12 3, 13 22 Z"
            fill="#fbf6ea"
            stroke="#1e1914"
            strokeWidth="2.4"
            strokeLinejoin="round"
          />
          {/* Vermilion hanko stamp block */}
          <rect
            x="6"
            y="0"
            width="10"
            height="13"
            rx="1.5"
            fill="#d63c2d"
            stroke="#1e1914"
            strokeWidth="2"
          />
          {/* Balance beam */}
          <path
            d="M -16 5 L -4 5 M -10 1 L -10 12"
            stroke="#1e1914"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
        </g>
      </defs>
    </svg>
  );
}
