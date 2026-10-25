"use client";

// Ask the console: a native modal dialog with a > prompt that answers from public/ask-index.json through
// lib/ask.ts (offline, no model) and prints the reply on a paper receipt. The receipt is a fixed 32 columns, so
// each printed row is one unwrapped line of text and a steps() clip mask can type it, 40 chars a second,
// while the row's height feeds the strip down. The whole answer is in the DOM from the first frame, inside an
// aria-live region; under reduced motion the CSS drops both animations and it simply shows.
// Loaded on first open by components/ask-console-loader.tsx, its own chunk.
import { answer, type AskIndex, type Reply } from "@/lib/ask";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

const COLS = 32;
const CHAR_MS = 25;

// Greedy word wrap to the receipt's columns; a word longer than a row is cut.
function wrap(text: string): string[] {
  const rows: string[] = [];
  let row = "";
  for (const word of text.split(/\s+/).filter(Boolean)) {
    for (let w = word; w; w = w.slice(COLS)) {
      const part = w.slice(0, COLS);
      if (!row) row = part;
      else if (row.length + 1 + part.length <= COLS) row += ` ${part}`;
      else {
        rows.push(row);
        row = part;
      }
    }
  }
  if (row) rows.push(row);
  return rows;
}

type Printed = { query: string; reply: Reply };
type Row = { text: string; at: number };

// Each row starts printing when the one before it has finished.
function rows(blocks: string[]): Row[][] {
  let at = 0;
  return blocks.map((block) =>
    wrap(block).map((text) => {
      const row = { text, at };
      at += text.length;
      return row;
    }),
  );
}

function Rows({ rows }: { rows: Row[] }) {
  return rows.map(({ text, at }, i) => (
    <span key={i} className="ask-row" style={{ "--n": text.length, "--at": `${at * CHAR_MS}ms` } as React.CSSProperties}>
      {text}
    </span>
  ));
}

function Receipt({ query, reply }: Printed) {
  const links = reply.sources.map(({ title }) => `-> ${title}`);
  const rule = links.length > 0 ? ["-".repeat(COLS)] : [];
  const [echo, ...printed] = rows([`> ${query}`, ...reply.lines, ...rule, ...links]);
  const lines = printed.slice(0, reply.lines.length);
  const [sep] = printed.slice(reply.lines.length, reply.lines.length + rule.length);
  const sources = printed.slice(reply.lines.length + rule.length);
  return (
    <div className="ask-receipt">
      <p className="ask-echo">
        <Rows rows={echo} />
      </p>
      {lines.map((line, i) => (
        <p key={i}>
          <Rows rows={line} />
        </p>
      ))}
      {sep && (
        <div className="ask-sep" aria-hidden="true">
          <Rows rows={sep} />
        </div>
      )}
      {sources.length > 0 && (
        <ul>
          {reply.sources.map(({ href }, i) => (
            <li key={href}>
              <Link href={href} className="ask-link">
                <Rows rows={sources[i]} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function AskConsole({ open, index, onClose }: { open: boolean; index: Promise<AskIndex>; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [printed, setPrinted] = useState<(Printed & { n: number }) | null>(null);

  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    if (open && !el.open) {
      el.showModal();
      input.current?.focus();
    } else if (!open && el.open) el.close();
  }, [open]);

  async function ask(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = input.current?.value.trim() ?? "";
    if (!query) return;
    let reply: Reply;
    try {
      reply = answer(await index, query);
    } catch {
      reply = { intent: "none", lines: ["THE INDEX DID NOT LOAD. CLOSE AND ASK AGAIN."], sources: [] };
    }
    setPrinted((p) => ({ query, reply, n: (p?.n ?? 0) + 1 }));
  }

  // The console's arrow and A keys listen on window; nothing typed or pressed in here reaches them. Tab wraps
  // around the dialog's own controls (showModal already makes the page behind it inert).
  function onKeyDown(event: React.KeyboardEvent<HTMLDialogElement>) {
    event.stopPropagation();
    if (event.key !== "Tab") return;
    const stops = [...event.currentTarget.querySelectorAll<HTMLElement>("input, button, a[href]")];
    const first = stops[0];
    const last = stops[stops.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <dialog ref={dialog} className="dialog ask-console" aria-labelledby="ask-title" onClose={onClose} onKeyDown={onKeyDown}>
      <div className="flex items-center justify-between gap-3">
        <h2 id="ask-title" className="caption">
          Ask the console
        </h2>
        <form method="dialog">
          <button type="submit" className="chip">
            Close
          </button>
        </form>
      </div>
      <form className="ask-prompt" onSubmit={ask}>
        <label htmlFor="ask-q" className="sr-only">
          Ask about my work, notes and projects
        </label>
        <span aria-hidden="true">&gt;</span>
        <input
          ref={input}
          id="ask-q"
          name="q"
          type="text"
          enterKeyHint="send"
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          maxLength={120}
          placeholder="shore, now, contact…"
        />
      </form>
      <div className="ask-out" aria-live="polite">
        {printed && <Receipt key={printed.n} query={printed.query} reply={printed.reply} />}
      </div>
    </dialog>
  );
}
