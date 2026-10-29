"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { buildDepartureClackCue, buildRowFlipFrames, canPlayDepartureClack, padFlapCell, type DepartureRow } from "@/lib/departures";
import { getServerSound, getSound, playCustomCue, setSound, subscribeSound } from "@/lib/sound-client";
import "./departures-board.css";

const MOTION = "(prefers-reduced-motion: reduce)";
const reducedSnapshot = () => matchMedia(MOTION).matches;
const serverReduced = () => false;
function subscribeMotion(listener: () => void) {
  const media = matchMedia(MOTION);
  media.addEventListener("change", listener);
  return () => media.removeEventListener("change", listener);
}
type Flip = { ids: string[]; frames: Record<string, string[]>; step: number; running: boolean };

export function DeparturesBoard({ kind, rows }: { kind: "work" | "projects"; rows: readonly DepartureRow[] }) {
  const titleId = useId(), noteId = useId();
  const reducedMotion = useSyncExternalStore(subscribeMotion, reducedSnapshot, serverReduced);
  const sound = useSyncExternalStore(subscribeSound, getSound, getServerSound);
  const [flip, setFlip] = useState<Flip | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const lastClack = useRef(-Infinity);

  useEffect(() => {
    const media = matchMedia(MOTION);
    const settle = () => {
      if (media.matches || document.hidden) {
        clearTimeout(timer.current);
        setFlip(null);
      }
    };
    media.addEventListener("change", settle);
    document.addEventListener("visibilitychange", settle);
    return () => {
      clearTimeout(timer.current);
      setFlip(null); // React Activity can retain a hidden route's state.
      media.removeEventListener("change", settle);
      document.removeEventListener("visibilitychange", settle);
    };
  }, []);

  function startFlip(selected: readonly DepartureRow[]) {
    clearTimeout(timer.current);
    // Read the media query at input time too: never race a preference change.
    if (reducedSnapshot() || document.hidden) { setFlip(null); return; }
    const frames = Object.fromEntries(selected.map(row => [row.id, buildRowFlipFrames("", row.status, 10)]));
    const count = Math.max(1, ...Object.values(frames).map(value => value.length));
    const ids = selected.map(row => row.id);
    function advance(step: number) {
      if (reducedSnapshot() || document.hidden) { setFlip(null); return; }
      setFlip({ ids, frames, step, running: step < count });
      const now = performance.now();
      if (canPlayDepartureClack(lastClack.current, now, getSound(), reducedSnapshot())) {
        if (playCustomCue(buildDepartureClackCue(step), () => !reducedSnapshot())) lastClack.current = now;
      }
      if (step < count) timer.current = setTimeout(() => advance(step + 1), 70);
    }
    advance(1);
  }

  return (
    <section className="departures-board" aria-labelledby={titleId} aria-describedby={noteId}
      data-testid="departures-board" data-board-kind={kind} data-reduced-motion={reducedMotion ? "true" : "false"} data-own-sound="">
      <header className="departures-heading">
        <div><p className="departures-kicker">発車案内 · {kind === "work" ? "pipeline platform" : "project platform"}</p>
          <h2 id={titleId}>Ink Departures</h2></div>
        <span className="departures-seal" aria-hidden="true">出発</span>
      </header>
      <p id={noteId} className="departures-note">A paper timetable. Schedules and statuses are illustrative, not live telemetry. Scroll to turn the flaps, or flip a row.</p>
      <div className="departures-tools">
        <button type="button" className="btn" data-testid="departures-flip-all" onClick={() => startFlip(rows)}>Flip all departures</button>
        <button type="button" className="btn" data-testid="departures-sound-toggle" aria-pressed={sound}
          onClick={() => setSound(!sound, { silent: reducedSnapshot() })}>Clack sound {sound ? "on" : "off"}</button>
      </div>
      <div className="departures-scroll" role="region" aria-label="Departures timetable" tabIndex={0}>
        <table>
          <caption className="sr-only">{kind === "work" ? "Pipeline" : "Project"} departures — illustrative timetable</caption>
          <thead><tr><th scope="col">Code</th><th scope="col">Destination</th><th scope="col">Schedule</th><th scope="col">Status</th><th scope="col"><span className="sr-only">Controls</span></th></tr></thead>
          <tbody>{rows.map(row => {
            const active = !reducedMotion && flip?.ids.includes(row.id) ? flip : null;
            const frames = active?.frames[row.id];
            const text = frames ? frames[Math.min(active!.step - 1, frames.length - 1)] : padFlapCell(row.status, 10);
            return <tr key={row.id} data-testid="departures-row" data-row-status={row.status}
              data-flip-step={active?.step ?? 0} data-flipping={active?.running ? "true" : "false"}>
              <td className="departures-code">{row.code}</td>
              <th scope="row" title={row.note}>{row.href ? <Link href={row.href} className="link">{row.name}</Link> : row.name}</th>
              <td className="departures-schedule">{row.schedule}</td>
              <td><span className="sr-only">{row.status}</span>
                <span className="departures-drums" aria-hidden="true">{Array.from(text, (char, i) =>
                  <span className="departures-drum" key={i}><span className="departures-leaf" key={active?.step ?? 0}>{char}</span></span>)}</span>
              </td>
              <td><button type="button" className="departures-row-button" data-testid="departures-row-flip"
                aria-label={`Flip ${row.code}: ${row.name}`} onClick={() => startFlip([row])}>↻</button></td>
            </tr>;
          })}</tbody>
        </table>
      </div>
      <p className="departures-footnote">{String(rows.length).padStart(2, "0")} services · ink on paper · sound off until invited</p>
    </section>
  );
}
