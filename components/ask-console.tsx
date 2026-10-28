"use client";

import { RisoText } from "@/components/riso-heading";

// Ask the console: a native modal dialog with a > prompt that prints its reply on a paper receipt. On mount
// (the first open) it asks GET /api/ask once whether the model tier is on (lib/ask-tier.ts); when it is, a
// question is one POST /api/ask and the model's lines and cited pages print. When it is off, or the POST
// fails, times out or sends back something unusable, the answer comes from public/ask-index.json through
// lib/ask.ts (offline, no model), with no error shown. The receipt is a fixed 32 columns, so
// each printed row is one unwrapped line of text. lib/typewriter.ts steps through the rows' text from
// requestAnimationFrame, 40 chars a second; a row takes room on the strip only once it starts, and keeps its
// final width so the paper does not jitter. A new question remounts the receipt and an unmount cancels the
// frame. The typed receipt is not live: a screen-reader-only aria-live region gets the whole answer once it is
// typed. Under reduced motion the stepper returns the whole text at once, so both show on the first render.
// Loaded on first open by components/ask-console-loader.tsx, its own chunk.
import { answer, type AskIndex, type Reply } from "@/lib/ask";
import { askModel, tierEnabled } from "@/lib/ask-tier";
import { due, step } from "@/lib/typewriter";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

const COLS = 32;

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

type Printed = { query: string; reply: Reply; reduced: boolean };
type Row = { text: string; at: number };

// Each row starts printing when the one before it has finished: `at` is its offset in the typed text.
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

// How much of `text` is on paper: steps from requestAnimationFrame until done. The receipt is keyed per
// question, so `text` and `reduced` never change under one mount; the cleanup cancels the pending frame.
function useTyped(text: string, reduced: boolean): number {
  const [typed, setTyped] = useState(() => step(text, 0, reduced, 0).index);
  useEffect(() => {
    if (step(text, 0, reduced, 0).done) return;
    let frame = 0;
    let start: number | undefined;
    let index = 0;
    const tick = (now: number) => {
      start ??= now;
      const next = step(text, index, reduced, due(now - start) - index);
      index = next.index;
      setTyped(index);
      if (!next.done) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [text, reduced]);
  return typed;
}

function Rows({ rows, typed }: { rows: Row[]; typed: number }) {
  return rows
    .filter(({ at }) => typed > at)
    .map(({ text, at }, i) => (
      <span key={i} className="ask-row" data-n={text.length} style={{ minWidth: `${text.length}ch` }}>
        {text.slice(0, typed - at)}
      </span>
    ));
}

const started = (block: Row[] | undefined, typed: number) => !!block?.length && typed > block[0].at;

function Receipt({ query, reply, reduced }: Printed) {
  const links = reply.sources.map(({ title }) => `-> ${title}`);
  const rule = links.length > 0 ? ["-".repeat(COLS)] : [];
  const blocks = rows([`> ${query}`, ...reply.lines, ...rule, ...links]);
  const all = blocks.flat();
  const text = all.map((r) => r.text).join("");
  const cols = Math.max(0, ...all.map((r) => r.text.length));
  const typed = useTyped(text, reduced);
  const done = typed >= text.length;

  const [echo, ...printed] = blocks;
  const lines = printed.slice(0, reply.lines.length);
  const [sep] = printed.slice(reply.lines.length, reply.lines.length + rule.length);
  const sources = printed.slice(reply.lines.length + rule.length);
  const spoken = [...reply.lines, ...(reply.sources.length > 0 ? [`Sources: ${reply.sources.map((s) => s.title).join(", ")}.`] : [])].join(" ");
  return (
    <>
      <div className="ask-receipt" data-typed={typed} data-total={text.length} style={{ width: `calc(${cols}ch + 2rem)` }}>
        <p className="ask-echo">
          <Rows rows={echo} typed={typed} />
        </p>
        {lines.map(
          (line, i) =>
            started(line, typed) && (
              <p key={i}>
                <Rows rows={line} typed={typed} />
              </p>
            ),
        )}
        {started(sep, typed) && (
          <div className="ask-sep" aria-hidden="true">
            <Rows rows={sep} typed={typed} />
          </div>
        )}
        {started(sources[0], typed) && (
          <ul>
            {reply.sources.map(
              ({ href }, i) =>
                started(sources[i], typed) && (
                  <li key={href}>
                    <Link href={href} className="ask-link">
                      <Rows rows={sources[i]} typed={typed} />
                    </Link>
                  </li>
                ),
            )}
          </ul>
        )}
      </div>
      <div className="ask-said sr-only" aria-live="polite" aria-atomic="true">
        {done ? spoken : ""}
      </div>
    </>
  );
}

export default function AskConsole({ open, index, onClose }: { open: boolean; index: Promise<AskIndex>; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [printed, setPrinted] = useState<(Printed & { n: number }) | null>(null);
  const [pending, setPending] = useState(false);
  const tier = useRef<Promise<boolean> | null>(null);
  const latest = useRef(0);

  // Once per mount: the loader mounts this on the first open and keeps it, so a reopen asks nothing again.
  useEffect(() => {
    tier.current ??= tierEnabled();
  }, []);

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
    // Only the latest question prints; an earlier one still waiting on the model is dropped.
    const asked = ++latest.current;
    setPending(true);
    let reply = (await tier.current) ? await askModel(query) : null;
    if (!reply) {
      try {
        reply = answer(await index, query);
      } catch {
        reply = { intent: "none", lines: ["THE INDEX DID NOT LOAD. CLOSE AND ASK AGAIN."], sources: [] };
      }
    }
    if (asked !== latest.current) return;
    setPending(false);
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    setPrinted((p) => ({ query, reply, reduced, n: (p?.n ?? 0) + 1 }));
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
        <h2 id="ask-title" className="caption"><RisoText>Ask the console</RisoText></h2>
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
      <div className="ask-out" aria-busy={pending}>
        {pending && <p role="status" className="text-muted">Consulting the ink…</p>}
        {!pending && printed && <Receipt key={printed.n} query={printed.query} reply={printed.reply} reduced={printed.reduced} />}
      </div>
    </dialog>
  );
}
