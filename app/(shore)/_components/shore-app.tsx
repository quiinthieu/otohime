"use client";

import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { clearDay, sceneClass, washUp, withScene } from "../_lib/actions";
import { STORAGE_KEY, normalizeLedger, serialize, today, type Ledger, type Scene } from "../_lib/ledger";
import { LENGTHS, tally, type Length } from "../_lib/pebbles";
import { begin, format, pause, remaining, resume, type Session } from "../_lib/timer";
import { Glass } from "./glass";
import { Icon } from "./icons";

type Phase = "idle" | "running" | "paused" | "done";

// localStorage as an external store: the server renders an empty shore, and the
// real ledger shows up after hydration without a mismatch.
const listeners = new Set<() => void>();
let latest: string | null | undefined; // survives a browser that refuses to store
const read = (): string | null => {
  if (latest !== undefined) return latest;
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
};
const subscribe = (cb: () => void) => {
  listeners.add(cb);
  const onStorage = () => {
    latest = undefined;
    cb();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
};
const readServer = () => null;

// The wall clock, as a store too: render never calls Date.now(), and the server
// (which prerenders this page) sees 0.
let clock = 0;
const clockListeners = new Set<() => void>();
const setClock = (t: number) => {
  clock = t;
  clockListeners.forEach((cb) => cb());
};
const subscribeClock = (cb: () => void) => {
  clockListeners.add(cb);
  setClock(Date.now());
  return () => {
    clockListeners.delete(cb);
  };
};
const readClock = () => clock;
const readClockServer = () => 0;

function update(change: (ledger: Ledger) => Ledger) {
  const next = serialize(change(normalizeLedger(read(), Date.now())));
  latest = next;
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // full or blocked: the shore lasts until the page closes
  }
  listeners.forEach((cb) => cb());
}

const finish = (session: Session) => update((ledger) => washUp(ledger, session));

export function ShoreApp({ header, footer }: { header: ReactNode; footer: ReactNode }) {
  const raw = useSyncExternalStore(subscribe, read, readServer);
  const now = useSyncExternalStore(subscribeClock, readClock, readClockServer);
  const [minutes, setMinutes] = useState<Length>(25);
  const [phase, setPhase] = useState<Phase>("idle");
  const [session, setSession] = useState<Session | null>(null);
  const [confirming, setConfirming] = useState(false);

  // `now` moves with the clock below, and on every press.
  const ledger = normalizeLedger(raw, now);
  const pebbles = today(ledger, now);
  const scene = ledger.scene;

  const left = phase === "idle" ? minutes * 60_000 : phase === "done" || !session ? 0 : remaining(now, session);

  // Tick on the wall clock, so a throttled background tab is right when it wakes.
  useEffect(() => {
    if (phase !== "running" || !session) return;
    let finished = false; // a second tick before React re-renders must not mint twice
    const tick = () => {
      const t = Date.now();
      setClock(t);
      if (!finished && remaining(t, session) <= 0) {
        finished = true;
        finish(session);
        setPhase("done");
      }
    };
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [phase, session]);

  useEffect(() => {
    document.title = phase === "running" ? `${format(left)} · Shore` : "Shore";
    return () => {
      document.title = "Shore";
    };
  }, [phase, left]);

  const start = () => {
    const t = Date.now();
    setClock(t);
    setSession(begin(minutes, t));
    setPhase("running");
  };
  const primary = () => {
    const t = Date.now();
    setClock(t);
    if (phase === "running" && session) {
      setSession(pause(session, t));
      setPhase("paused");
    } else if (phase === "paused" && session) {
      setSession(resume(session, t));
      setPhase("running");
    } else {
      start();
    }
  };
  const reset = () => {
    setSession(null);
    setPhase("idle");
  };
  const finishNow = () => {
    if (!session) return;
    finish(session);
    setClock(Date.now());
    setPhase("done");
  };
  const setScene = (value: Scene) => update((l) => withScene(l, value));
  const clearToday = () => {
    update((l) => clearDay(l, Date.now()));
    setConfirming(false);
  };

  const active = phase === "running" || phase === "paused";
  const label = phase === "running" ? "Pause" : phase === "paused" ? "Resume" : phase === "done" ? "Begin again" : "Begin";
  const note =
    phase === "running"
      ? "Stay with it."
      : phase === "paused"
        ? "Paused. The glass can wait."
        : phase === "done"
          ? "A piece of sea glass washed up."
          : "Pick a length, then press Begin.";

  return (
    <div className={sceneClass(scene)}>
      {header}
      <main className="stage">
        <p className="eyebrow">ONE SESSION. ONE PIECE OF GLASS.</p>
        <h1>
          Stay a while.
          <br />
          <em>Leave something behind.</em>
        </h1>

        <div className="stage-toolbar">
          <div className="specimen-caption">
            <span>TODAY&apos;S SHORE</span>
            <span className="live-indicator">LIVE MATERIAL</span>
          </div>
          <div className="scene-buttons" role="group" aria-label="Scene">
            {(["light", "dark"] as const).map((value) => (
              <button
                key={value}
                type="button"
                className={scene === value ? "scene-button selected" : "scene-button"}
                aria-pressed={scene === value}
                aria-label={value === "light" ? "Light scene" : "Dark scene"}
                onClick={() => setScene(value)}
              >
                <Icon name={value === "light" ? "sun" : "moon"} />
              </button>
            ))}
          </div>
        </div>

        <section className="panel" aria-label="Timer">
          <Glass as="div" press className="segmented" shape="capsule" palette="lilac" seed={155} role="group" aria-label="Session length">
            {LENGTHS.map((m) => (
              <button
                key={m}
                type="button"
                className={m === minutes ? "chosen" : undefined}
                aria-pressed={m === minutes}
                disabled={active}
                onClick={() => {
                  setMinutes(m);
                  if (phase === "done") reset();
                }}
              >
                {m} min
              </button>
            ))}
          </Glass>

          <p className="countdown" role="status" aria-live="polite">
            {format(left)}
          </p>
          <p className="countdown-note">{note}</p>

          <Glass className="begin-button" shape="rounded" palette="lagoon" seed={33} onClick={primary}>
            <Icon name={phase === "running" ? "pause" : "play"} />
            <span>{label}</span>
          </Glass>

          <Glass as="div" press className="reference-toolbar" shape="capsule" palette="lilac" seed={11} role="group" aria-label="Session actions">
            <button type="button" className="icon-action" disabled={!active && phase !== "done"} onClick={reset}>
              <Icon name="reset" />
              <span>Reset</span>
            </button>
            <button type="button" className="icon-action" disabled={!active} onClick={finishNow}>
              <Icon name="check" />
              <span>Finish now</span>
            </button>
          </Glass>

          <ul className="pebble-row" aria-label="Today's pieces">
            {pebbles.map((p) => (
              <li key={p.startedAt}>
                <Glass
                  as="div"
                  className="pebble"
                  shape="disc"
                  palette={p.palette}
                  seed={p.seed}
                  role="img"
                  aria-label={`${p.minutes} minute piece`}
                />
              </li>
            ))}
          </ul>
          <p className="tally">{tally(pebbles)}</p>

          <div className="clear-row">
            {confirming ? (
              <>
                <span>
                  Clear {pebbles.length} {pebbles.length === 1 ? "piece" : "pieces"}?
                </span>
                <button type="button" className="plain-button danger" onClick={clearToday}>
                  Yes, clear
                </button>
                <button type="button" className="plain-button" onClick={() => setConfirming(false)}>
                  Keep
                </button>
              </>
            ) : (
              <button type="button" className="plain-button" disabled={pebbles.length === 0} onClick={() => setConfirming(true)}>
                Clear today
              </button>
            )}
          </div>
        </section>

        <p className="stage-note">Same day, same glass. Each piece keeps its shape.</p>
      </main>
      {footer}
    </div>
  );
}
