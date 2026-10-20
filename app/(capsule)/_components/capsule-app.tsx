"use client";

import { useEffect, useReducer, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from "react";
import { resetAlbum, turn } from "../_lib/actions.ts";
import type { Card as CardData } from "../_lib/cards.ts";
import { DAILY_COINS, MAX_COINS, STORAGE_KEY, normalizeLedger, serialize, type Ledger } from "../_lib/ledger.ts";
import { machineBusy, newMachine, step, type MachineAction } from "../_lib/machine.ts";
import { albumView, isNewCard, revealView } from "../_lib/reveal.ts";
import { Album } from "./album";
import { Card } from "./card";
import { Machine } from "./machine";

// localStorage as an external store: the server renders an empty album and 5
// coins, and the real ledger shows up after hydration without a mismatch.
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

// The seed decides every draw, so it is minted once, on the first Turn, and
// stored. Render only shows coins and cards, which a seed does not change.
const mintSeed = () => crypto.getRandomValues(new Uint32Array(1))[0];
const noSeed = () => 0;

function save(ledger: Ledger) {
  const next = serialize(ledger);
  latest = next;
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // full or blocked: the album lasts until the page closes
  }
  listeners.forEach((cb) => cb());
}

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const tierName = (c: CardData) => c.tier[0].toUpperCase() + c.tier.slice(1);

export function CapsuleApp({ header, rates, footer }: { header: ReactNode; rates: ReactNode; footer: ReactNode }) {
  const raw = useSyncExternalStore(subscribe, read, readServer);
  const now = useSyncExternalStore(subscribeClock, readClock, readClockServer);
  const [machine, dispatch] = useReducer(step, undefined, newMachine);
  const [drawn, setDrawn] = useState<CardData | null>(null);

  const ledger = normalizeLedger(raw, now, noSeed);
  const { phase } = machine;
  // The reveal reads only this view of the machine: no edge and no face until
  // the edge stage, whatever card `drawn` holds.
  const view = revealView(machine);
  const coinIn = phase === "loaded";
  // Insert coin spends nothing: the coin in the slot still belongs to the ledger.
  const coins = ledger.coins - (coinIn ? 1 : 0);

  // 12 fps while the crank turns or the capsule opens; reduced motion settles at once.
  const busy = machineBusy(machine);
  useEffect(() => {
    if (!busy) return;
    const id = setInterval(() => dispatch(reducedMotion() ? "settle" : "tick"), 1000 / 12);
    return () => clearInterval(id);
  }, [busy]);

  const press = (action: MachineAction) => {
    dispatch(action);
    if (reducedMotion()) dispatch("settle");
  };

  const insert = () => {
    if (ledger.coins < 1) return;
    setDrawn(null);
    press("insert");
  };

  // Turn commits the draw (a reload mid-round keeps the card), but the album
  // holds it back until the reveal, and the round plays the turn it was dealt.
  const crank = () => {
    if (phase !== "loaded") return;
    const t = Date.now();
    const result = turn(normalizeLedger(read(), t, mintSeed), t);
    setClock(t);
    if (!result) return;
    save(result.ledger);
    setDrawn(result.card);
    press({ type: "turn", frames: result.frames, drop: result.drop, tier: result.card.tier });
  };

  // Reset album clears the cards only: seed, coins and day stay, so it mints nothing.
  const wipe = () => {
    const t = Date.now();
    save(resetAlbum(normalizeLedger(read(), t, mintSeed)));
    setClock(t);
  };

  const status =
    phase === "loaded"
      ? "Coin in. Turn the crank."
      : phase === "turning"
        ? "Turning…"
        : phase === "ready"
          ? "Something rolled out. Open it."
          : phase === "opening"
            ? "Opening…"
            : phase === "revealed" && drawn
              ? `${drawn.name}. ${tierName(drawn)}.${isNewCard(ledger, drawn.id) ? " New to your album." : ""}`
              : ledger.coins > 0
                ? "Insert a coin to begin."
                : "No coins left. More tomorrow.";

  const pending = drawn && (phase === "turning" || phase === "ready" || phase === "opening") ? drawn.id : null;

  // The card rising out of the chute, from the rise stage to the end of the
  // flip: a plain back with no number, then its tier edge, then (from the
  // second half of the flip) its face. --rise and --flip are set from the
  // 12 fps frames; capsule.css turns them into the pose.
  const riser =
    view.card !== "none" && view.stage !== "revealed" ? (
      <div
        className="riser"
        style={{ "--rise": view.stage === "rise" ? view.progress : 1, "--flip": view.flip } as CSSProperties}
      >
        <div className="riser-card" data-side={view.card}>
          {view.card === "face" && drawn ? (
            <Card card={drawn} grain />
          ) : (
            <Card back={view.edge ? { edge: view.edge } : {}} label="A card, face down" grain />
          )}
        </div>
        {view.stage === "hold" && (
          <span className="sparks" aria-hidden="true">
            {Array.from({ length: 8 }, (_, i) => (
              <i key={i} style={{ "--a": `${i * 45 + 22}deg` } as CSSProperties} />
            ))}
          </span>
        )}
      </div>
    ) : null;

  const refill =
    ledger.coins >= MAX_COINS
      ? "The tray is full."
      : `${Math.min(DAILY_COINS, MAX_COINS - ledger.coins)} more tomorrow`;

  return (
    <div className="capsule">
      {header}
      <main className="stage">
        <p className="eyebrow">ONE COIN. ONE CRANK. ONE CARD.</p>
        <h1>
          Put a coin in.
          <br />
          <em>See who rolls out.</em>
        </h1>

        <section className="booth" aria-label="Machine" data-stage={view.stage}>
          <div className="machine-wrap">
            <Machine state={machine} coinIn={coinIn} />
            {riser}
          </div>

          <div className="controls">
            <div className="reveal">
              {view.card === "face" && view.stage === "revealed" && drawn && (
                <div className="reveal-card">
                  <Card card={drawn} grain />
                  <p className="reveal-name">{drawn.name}</p>
                  <p className="reveal-film">{`${drawn.film} · ${drawn.year}`}</p>
                </div>
              )}
            </div>

            <div className="buttons">
              <button
                type="button"
                className="button"
                disabled={coins < 1 || !(phase === "idle" || phase === "revealed")}
                onClick={insert}
              >
                Insert coin
              </button>
              <button type="button" className="button" disabled={phase !== "loaded"} onClick={crank}>
                Turn
              </button>
              <button type="button" className="button" disabled={phase !== "ready"} onClick={() => press("open")}>
                Open
              </button>
            </div>

            <p className="status" role="status" aria-live="polite">
              {status}
            </p>

            <div className="tray" aria-label="Coin tray">
              <span className="coins" aria-hidden="true">
                {Array.from({ length: MAX_COINS }, (_, i) => (
                  <i key={i} className={i < coins ? "coin" : "coin spent"} />
                ))}
              </span>
              <span>{`${coins} ${coins === 1 ? "coin" : "coins"} · ${refill}`}</span>
            </div>
          </div>
        </section>

        {rates}

        <Album ledger={albumView(ledger, pending)} onReset={wipe} />
      </main>
      {footer}
    </div>
  );
}
