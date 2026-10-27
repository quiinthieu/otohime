"use client";

import type { Project } from "@/content/site";
import {
  formatKuyoAnnouncement,
  groupDarumaShelves,
  parseClockParam,
  parseDarumaViewParam,
  parseKuyoParam,
  resolveNowMs,
  type ClassifiedDaruma,
  type ClockInput,
  type DarumaViewMode,
} from "@/lib/daruma";
import {
  useEffect,
  useLayoutEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";

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

declare global {
  interface Window {
    __DARUMA_NOW__?: number | string | Date;
  }
}

export type DarumaBoardProps = {
  projects: readonly Project[];
  now?: ClockInput;
  initialView?: DarumaViewMode;
  initialKuyo?: boolean;
  children: ReactNode;
};

export function DarumaBoard({
  projects,
  now,
  initialView = "cartridges",
  initialKuyo = false,
  children,
}: DarumaBoardProps) {
  const [view, setView] = useState<DarumaViewMode>(initialView);
  const [kuyoOverride, setKuyoOverride] = useState<boolean>(initialKuyo);
  const [urlClockMs, setUrlClockMs] = useState<number | null>(null);
  const reducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotionSnapshot,
    () => false,
  );

  useIsomorphicLayoutEffect(() => {
    const syncFromLocation = () => {
      const search = window.location.search;
      const params = new URLSearchParams(search);
      const hasKuyo = parseKuyoParam(params);
      const parsedView = parseDarumaViewParam(params);
      const parsedClock =
        parseClockParam(params) ??
        (window.__DARUMA_NOW__ !== undefined
          ? resolveNowMs(window.__DARUMA_NOW__)
          : null);

      if (parsedClock !== null) {
        setUrlClockMs(parsedClock);
      }
      if (hasKuyo) {
        setKuyoOverride(true);
        setView("daruma");
      } else if (params.has("kuyo")) {
        setKuyoOverride(false);
      }
      if (
        parsedView === "daruma" ||
        (parsedClock !== null && new Date(parsedClock).getUTCMonth() === 11)
      ) {
        setView("daruma");
      }
    };

    syncFromLocation();
    window.addEventListener("popstate", syncFromLocation);
    return () => window.removeEventListener("popstate", syncFromLocation);
  }, []);

  const effectiveClock: ClockInput = urlClockMs ?? now;
  const shelves = groupDarumaShelves(projects, {
    now: effectiveClock,
    kuyo: kuyoOverride,
  });
  const announcement = formatKuyoAnnouncement(shelves);
  const nowDay = new Date(shelves.nowMs).toISOString().slice(0, 10);

  function selectView(nextView: DarumaViewMode) {
    setView(nextView);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      if (nextView === "daruma") {
        url.searchParams.set("view", "daruma");
      } else {
        url.searchParams.delete("view");
      }
      window.history.replaceState(window.history.state, "", url);
    }
  }

  function toggleKuyo() {
    const next = !shelves.kuyoActive;
    setKuyoOverride(next);
    setView("daruma");
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      if (next) {
        url.searchParams.set("kuyo", "1");
      } else {
        url.searchParams.delete("kuyo");
      }
      window.history.replaceState(window.history.state, "", url);
    }
  }

  return (
    <div
      className="daruma-root"
      data-active-view={view}
      data-reduced-motion={reducedMotion ? "true" : "false"}
    >
      <div className="daruma-view-bar" role="group" aria-label="Projects view">
        <div className="daruma-view-switch">
          <button
            type="button"
            className="btn btn-sm daruma-view-btn"
            aria-pressed={view === "cartridges"}
            data-view-toggle="cartridges"
            onClick={() => selectView("cartridges")}
          >
            Cartridges
          </button>
          <button
            type="button"
            className="btn btn-sm daruma-view-btn"
            aria-pressed={view === "daruma"}
            data-view-toggle="daruma"
            onClick={() => selectView("daruma")}
          >
            Daruma shelf
          </button>
        </div>
        <span className="text-muted text-xs">
          {shelves.shipped.length} shipped · {shelves.unfinished.length} on the unfinished shelf
        </span>
      </div>

      {view === "cartridges" ? (
        children
      ) : (
        <div
          className="daruma-board"
          data-testid="daruma-board"
          data-kuyo-active={shelves.kuyoActive ? "true" : "false"}
          data-now={nowDay}
        >
          <div
            className="daruma-kuyo-bar"
            data-kuyo-active={shelves.kuyoActive ? "true" : "false"}
          >
            <div className="grid gap-1">
              <p
                role="status"
                aria-live="polite"
                aria-atomic="true"
                className="daruma-kuyo-status"
                data-testid="daruma-kuyo-status"
              >
                {announcement}
              </p>
              <span className="text-muted text-xs">
                Left eye painted when started, right eye when shipped. Unshipped dolls idle 90+ days retire in the year-end Daruma Kuyo ink fire.
              </span>
            </div>
            <button
              type="button"
              className="btn btn-sm daruma-kuyo-toggle"
              aria-pressed={shelves.kuyoActive}
              data-kuyo-toggle="true"
              onClick={toggleKuyo}
            >
              {shelves.kuyoActive ? "Extinguish Daruma Kuyo" : "Light Daruma Kuyo"}
            </button>
          </div>

          <section
            className="daruma-shelf-section"
            data-shelf="shipped"
            aria-labelledby="daruma-shipped-heading"
          >
            <div className="daruma-shelf-header">
              <h2 id="daruma-shipped-heading" className="caption">
                Shipped shelf · both eyes painted ({shelves.shipped.length})
              </h2>
              <span className="text-muted text-xs">
                Wish fulfilled · rolls back upright on wobble
              </span>
            </div>
            <ul className="daruma-shelf-grid">
              {shelves.shipped.map((item) => (
                <li key={item.project.title} className="daruma-slot">
                  <DarumaCard item={item} />
                </li>
              ))}
            </ul>
          </section>

          <section
            className="daruma-shelf-section"
            data-shelf="unfinished"
            aria-labelledby="daruma-unfinished-heading"
          >
            <div className="daruma-shelf-header">
              <h2 id="daruma-unfinished-heading" className="caption">
                Unfinished shelf · waiting for the second eye ({shelves.unfinished.length})
              </h2>
              <span className="text-muted text-xs">
                {shelves.active.length} active · {shelves.abandoned.length} abandoned (90+ days or shelved)
              </span>
            </div>
            <ul className="daruma-shelf-grid">
              {shelves.unfinished.map((item) => (
                <li key={item.project.title} className="daruma-slot">
                  <DarumaCard item={item} />
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </div>
  );
}

function DarumaCard({ item }: { item: ClassifiedDaruma<Project> }) {
  const { project } = item;
  const eyeLabel =
    item.eyeState === "both"
      ? "Both eyes painted"
      : item.eyeState === "left"
        ? "Left eye painted"
        : "Blank eyes";

  return (
    <article
      className="daruma-card"
      tabIndex={0}
      data-daruma-project={project.title}
      data-eye-state={item.eyeState}
      data-shelf-kind={item.shelf}
      data-abandoned={item.abandoned ? "true" : "false"}
      data-kuyo-retiring={item.retiringInKuyo ? "true" : "false"}
    >
      <div className="daruma-doll-stage">
        <div className="daruma-doll-figure" data-testid="daruma-doll-figure">
          <DarumaDoll item={item} />
        </div>
        {item.retiringInKuyo ? <KuyoInkFire title={project.title} /> : null}
      </div>

      <div className="daruma-meta">
        {project.href ? (
          <a href={project.href} className="daruma-title">
            {project.title}
          </a>
        ) : (
          <span className="daruma-title">{project.title}</span>
        )}
        <span className="badge">{project.status}</span>
        <span className="badge" data-daruma-eye-badge={item.eyeState}>
          {eyeLabel}
        </span>
      </div>

      <p className="daruma-dates">
        {item.startedDate ? `Started ${item.startedDate}` : "Not started"}
        {item.shippedDate
          ? ` · Shipped ${item.shippedDate}`
          : item.lastActivityDate
            ? ` · Active ${item.lastActivityDate}`
            : ""}
      </p>

      {item.abandoned ? (
        <span className="daruma-kuyo-seal" data-kuyo-badge={item.retiringInKuyo ? "retiring" : "abandoned"}>
          {item.retiringInKuyo
            ? "Retiring in Kuyo ink-fire"
            : `Abandoned${item.daysInactive !== null ? ` · ${item.daysInactive}d quiet` : ""}`}
        </span>
      ) : null}

      <p className="daruma-note">{project.note}</p>
    </article>
  );
}

function DarumaDoll({ item }: { item: ClassifiedDaruma<Project> }) {
  return (
    <svg
      className="daruma-doll"
      viewBox="0 0 160 180"
      role="img"
      aria-label={`${item.project.title} Daruma doll (${item.eyeState} eyes painted)`}
    >
      {/* Weighted base shadow */}
      <ellipse
        className="daruma-shadow"
        cx="80"
        cy="168"
        rx="50"
        ry="7"
        fill="rgba(30, 25, 20, 0.18)"
      />

      {/* Hand-drawn tumbler body in vermilion wash and sumi ink */}
      <path
        className="daruma-body"
        d="M 80 14 C 36 14, 18 52, 20 104 C 22 146, 44 164, 80 164 C 116 164, 138 146, 140 104 C 142 52, 124 14, 80 14 Z"
        fill="#d63c2d"
        stroke="#1e1914"
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Subtle hand-brushed highlight arc */}
      <path
        d="M 38 44 C 30 68, 28 96, 33 124"
        fill="none"
        stroke="rgba(255, 245, 230, 0.32)"
        strokeWidth="3"
        strokeLinecap="round"
      />

      {/* Washi face window */}
      <path
        className="daruma-face"
        d="M 42 56 C 42 36, 60 30, 80 30 C 100 30, 118 36, 118 56 C 118 78, 104 92, 80 92 C 56 92, 42 78, 42 56 Z"
        fill="#fbf6ea"
        stroke="#1e1914"
        strokeWidth="2.6"
        strokeLinejoin="round"
      />

      {/* Crane-wing eyebrows */}
      <path
        className="daruma-brow-left"
        d="M 48 48 Q 60 39 73 47 M 51 44 Q 60 37 70 44"
        fill="none"
        stroke="#1e1914"
        strokeWidth="2.8"
        strokeLinecap="round"
      />
      <path
        className="daruma-brow-right"
        d="M 87 47 Q 100 39 112 48 M 90 44 Q 100 37 109 44"
        fill="none"
        stroke="#1e1914"
        strokeWidth="2.8"
        strokeLinecap="round"
      />

      {/* Left eye socket + brush-stroke pupil (painted when started) */}
      <circle
        className="daruma-eye-socket-left"
        cx="62"
        cy="61"
        r="11.5"
        fill="#fffdf8"
        stroke="#1e1914"
        strokeWidth="2.2"
      />
      <path
        className="daruma-eye-stroke daruma-eye-left"
        data-eye="left"
        data-painted={item.leftEyePainted ? "true" : "false"}
        pathLength={100}
        strokeDasharray={100}
        strokeDashoffset={item.leftEyeDashoffset}
        d="M 62 61 m -1 0 a 2 2 0 1 0 3.5 0 a 4.2 4.2 0 1 0 -8 0 a 6.4 6.4 0 1 0 12.5 0"
      />

      {/* Right eye socket + brush-stroke pupil (painted when shipped) */}
      <circle
        className="daruma-eye-socket-right"
        cx="98"
        cy="61"
        r="11.5"
        fill="#fffdf8"
        stroke="#1e1914"
        strokeWidth="2.2"
      />
      <path
        className="daruma-eye-stroke daruma-eye-right"
        data-eye="right"
        data-painted={item.rightEyePainted ? "true" : "false"}
        pathLength={100}
        strokeDasharray={100}
        strokeDashoffset={item.rightEyeDashoffset}
        d="M 98 61 m -1 0 a 2 2 0 1 0 3.5 0 a 4.2 4.2 0 1 0 -8 0 a 6.4 6.4 0 1 0 12.5 0"
      />

      {/* Tortoise cheek whiskers & resolute mouth */}
      <path
        className="daruma-whiskers"
        d="M 47 72 Q 55 78 65 76 M 95 76 Q 105 78 113 72 M 67 82 Q 80 77 93 82"
        fill="none"
        stroke="#1e1914"
        strokeWidth="2.4"
        strokeLinecap="round"
      />

      {/* Gold belly stripes and vertical brushwork */}
      <path
        className="daruma-belly-gold"
        d="M 44 114 Q 80 126 116 114 M 40 128 Q 80 142 120 128 M 48 143 Q 80 154 112 143"
        fill="none"
        stroke="#f4b829"
        strokeWidth="3.6"
        strokeLinecap="round"
      />
      <path
        className="daruma-belly-kanji"
        d="M 80 100 L 80 150 M 71 108 L 89 108 M 73 122 L 87 122"
        fill="none"
        stroke="#1e1914"
        strokeWidth="2.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function KuyoInkFire({ title }: { title: string }) {
  return (
    <svg
      className="daruma-kuyo-fire"
      viewBox="0 0 180 190"
      aria-label={`Daruma Kuyo ink-fire retiring ${title}`}
      data-testid="daruma-kuyo-fire"
    >
      {/* Sumi-ink outer smoke & brush flame */}
      <path
        className="daruma-kuyo-flame"
        d="M 28 172 C 14 140, 26 106, 40 84 C 34 108, 48 116, 54 90 C 60 62, 74 34, 88 14 C 94 42, 110 58, 108 86 C 118 72, 128 56, 134 38 C 146 72, 158 116, 146 172 Z"
        fill="rgba(30, 25, 20, 0.24)"
        stroke="#1e1914"
        strokeWidth="2.4"
        strokeLinejoin="round"
      />
      {/* Vermilion inner ritual flame */}
      <path
        className="daruma-kuyo-flame-inner"
        d="M 44 172 C 36 142, 48 114, 62 94 C 58 114, 70 118, 78 88 C 84 64, 92 48, 96 34 C 102 60, 114 82, 112 106 C 120 96, 126 84, 130 70 C 138 102, 142 138, 132 172 Z"
        fill="rgba(239, 106, 76, 0.36)"
        stroke="#b52b1d"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {/* Rising sumi ink & gold embers */}
      <circle className="daruma-kuyo-ember" cx="46" cy="54" r="3" fill="#1e1914" />
      <circle className="daruma-kuyo-ember" cx="92" cy="24" r="3.5" fill="#ef6a4c" />
      <circle className="daruma-kuyo-ember" cx="132" cy="48" r="2.8" fill="#1e1914" />
    </svg>
  );
}
