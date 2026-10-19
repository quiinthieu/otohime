"use client";

import { useEffect, useRef, useState } from "react";
import { tally } from "../_lib/actions.ts";
import { CARDS, type Card as CardData } from "../_lib/cards.ts";
import type { Ledger } from "../_lib/ledger.ts";
import { Card } from "./card";

const tierName = (c: CardData) => c.tier[0].toUpperCase() + c.tier.slice(1);

// The album: twelve slots in CARDS order. An owned slot is a button that opens
// the card large in a native <dialog> (Esc and Close shut it, focus goes back
// to the slot); an unowned slot is a silhouette and nothing to press. Reset
// album asks inline, in the page, never in a browser prompt.
export function Album({ ledger, onReset }: { ledger: Ledger; onReset: () => void }) {
  const count = tally(ledger);
  const copies = CARDS.reduce((sum, c) => sum + (ledger.owned[c.id] ?? 0), 0);

  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState<CardData | null>(null);

  useEffect(() => {
    const d = dialog.current;
    if (open && d && !d.open) d.showModal();
  }, [open]);

  const show = (card: CardData, button: HTMLButtonElement) => {
    opener.current = button;
    setOpen(card);
  };
  // Esc fires cancel then close, the Close button calls close(): both land here.
  const closed = () => {
    setOpen(null);
    opener.current?.focus();
  };

  const [confirming, setConfirming] = useState(false);
  const [cleared, setCleared] = useState(false);
  const resetButton = useRef<HTMLButtonElement>(null);
  const keepButton = useRef<HTMLButtonElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);

  // The confirm opens on Keep, the safe choice.
  useEffect(() => {
    if (confirming) keepButton.current?.focus();
  }, [confirming]);

  const ask = () => {
    setCleared(false);
    setConfirming(true);
  };
  const keep = () => {
    setConfirming(false);
    // after the re-render, the button is back
    requestAnimationFrame(() => resetButton.current?.focus());
  };
  const reset = () => {
    onReset();
    setConfirming(false);
    setCleared(true);
    // an empty album disables Reset album, so focus goes to the heading
    heading.current?.focus();
  };

  const n = open ? (ledger.owned[open.id] ?? 0) : 0;

  return (
    <section className="album-section" aria-label="Album">
      <h2 ref={heading} tabIndex={-1}>
        Album
      </h2>
      <ol className="album">
        {CARDS.map((card) => {
          const owned = ledger.owned[card.id] ?? 0;
          return (
            <li key={card.id} data-slot={card.id} className={owned > 0 ? "slot owned" : "slot"}>
              {owned > 0 ? (
                <button
                  type="button"
                  className="slot-button"
                  aria-haspopup="dialog"
                  aria-label={`${card.name} ×${owned}. Open large`}
                  onClick={(e) => show(card, e.currentTarget)}
                >
                  <Card card={card} />
                  <span className="count">{`×${owned}`}</span>
                </button>
              ) : (
                <>
                  <Card card={card} ghost />
                  <span className="count">{"\u00a0"}</span>
                </>
              )}
            </li>
          );
        })}
      </ol>
      <p className="tally">{`${count.owned} of ${count.total} · ${count.draws} ${count.draws === 1 ? "draw" : "draws"}`}</p>

      <div className="reset">
        {confirming ? (
          <div className="reset-confirm" role="group" aria-label="Reset album">
            <span>{`Reset album? This clears your ${copies} ${copies === 1 ? "card" : "cards"}.`}</span>
            <button type="button" className="button button-small button-danger" onClick={reset}>
              Reset
            </button>
            <button type="button" className="button button-small" ref={keepButton} onClick={keep}>
              Keep
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="button button-small"
            ref={resetButton}
            disabled={copies === 0}
            onClick={ask}
          >
            Reset album
          </button>
        )}
        <p className="reset-note" aria-live="polite">
          {cleared ? "Album cleared. Your coins stay." : ""}
        </p>
      </div>

      <dialog
        ref={dialog}
        className="enlarge"
        aria-labelledby={open ? "enlarge-name" : undefined}
        onClose={closed}
      >
        {open && (
          <div className="enlarge-body">
            <Card card={open} className="card-large" />
            <div className="enlarge-text">
              <p className="enlarge-name" id="enlarge-name">
                {open.name}
              </p>
              <p className="enlarge-film">{`${open.film} · ${open.year}`}</p>
              <p className="enlarge-meta">
                <span className={`tier tier-${open.tier}`}>{tierName(open)}</span>
                <span>{`×${n}`}</span>
              </p>
              <p className="enlarge-note">{open.note}</p>
              <button type="button" className="button" onClick={() => dialog.current?.close()}>
                Close
              </button>
            </div>
          </div>
        )}
      </dialog>
    </section>
  );
}
