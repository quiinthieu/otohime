"use client";

import { inkFilter } from "@/lib/ink-modes";
import { INK, ledgerGrid, receiptLines, SMUDGES, type LedgerCell } from "@/lib/ledger";
import type { Ledger } from "@/lib/ledger-data";
import { createElement, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { cellLabel, centre, daysOf, longDate, moveIndex, PITCH, rosette, SMUDGE_FILTERS, STAMP, VIEW } from "../_lib/calendar";

// The year as hand-pressed stamps: one SVG, one <symbol> per mark and a <use> per day. The visible stamps sit in
// SMUDGES groups, one shared ink filter each (not a filter per day), and are hidden from assistive tech. Over them a
// layer of transparent squares in date order are the cells: role=button, one tab stop (roving tabindex), arrow
// keys to move, and a receipt for the day on hover, focus and tap. The grid is computed here from the sparse ledger
// (lib/ledger.ts is pure and hash-seeded, so server and client draw the same year).

type Open = { i: number; pinned: boolean; x: number; y: number; flip: boolean };

const WEEKDAY_LABELS = [
  [1, "Mon"],
  [3, "Wed"],
  [5, "Fri"],
] as const;
const ROSETTE = rosette(7, 4.6, 10);

export function StampCalendar({ ledger, end }: { ledger: Ledger; end: string }) {
  const grid = useMemo(() => ledgerGrid(ledger, end), [ledger, end]);
  const cells = useMemo(() => daysOf(grid), [grid]);
  const id = `ledger${useId().replace(/[^\w-]/g, "")}`;
  const [active, setActive] = useState(cells.length - 1);
  const [open, setOpen] = useState<Open | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const svg = useRef<SVGSVGElement>(null);

  const cellAt = (i: number) => svg.current?.querySelector<SVGRectElement>(`[data-i="${i}"]`) ?? null;
  // Where the receipt hangs: under the cell, measured against the box, so the scroller can't clip it.
  const place = (i: number) => {
    const el = cellAt(i);
    const outer = box.current?.getBoundingClientRect();
    if (!el || !outer) return { x: 0, y: 0, flip: false };
    const r = el.getBoundingClientRect();
    const x = r.left + r.width / 2 - outer.left;
    return { x, y: r.bottom - outer.top + 4, flip: x > outer.width / 2 };
  };
  const show = (i: number, pinned: boolean) => setOpen({ i, pinned, ...place(i) });
  const toggle = (i: number) => {
    setActive(i);
    setOpen((o) => (o?.i === i && o.pinned ? null : { i, pinned: true, ...place(i) }));
  };

  // A tap anywhere else puts a pinned receipt away (a tapped SVG square need not take focus everywhere).
  const pinned = open?.pinned ?? false;
  useEffect(() => {
    if (!pinned) return;
    const away = (e: PointerEvent) => {
      if (!svg.current?.contains(e.target as Node)) setOpen(null);
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [pinned]);

  const onKeyDown = (e: KeyboardEvent, i: number) => {
    if (e.key === "Escape") {
      if (open) e.preventDefault();
      setOpen(null);
      return;
    }
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      toggle(i);
      return;
    }
    const next = moveIndex(i, e.key, cells.length);
    if (next === null) return;
    e.preventDefault();
    setActive(next);
    cellAt(next)?.focus();
  };

  const receipt = open ? cells[open.i] : null;
  return (
    <div ref={box} className="ledger">
      <p id={`${id}-help`} className="sr-only">
        Arrow keys move a day up and down and a week left and right; Home and End go to the first and last day.
      </p>
      <div className="ledger-scroll" onScroll={() => open && setOpen({ ...open, ...place(open.i) })}>
        <svg
          ref={svg}
          viewBox={`0 0 ${VIEW.w} ${VIEW.h}`}
          className="ledger-sheet"
          role="group"
          aria-label={`Ink stamps, ${longDate(grid.from)} to ${longDate(grid.to)}`}
          aria-describedby={`${id}-help`}
          onBlur={(e) => {
            if (!svg.current?.contains(e.relatedTarget as Node | null)) setOpen(null);
          }}
        >
          <defs>
            {SMUDGE_FILTERS.map(({ hand, seed, wobble }, s) => (
              <filter key={s} id={`${id}-smudge-${s}`} x="-2%" y="-6%" width="104%" height="112%">
                {inkFilter(hand, seed, wobble).map((p, k) =>
                  p.tag === "feMerge" ? (
                    <feMerge key={k}>
                      {p.nodes.map((node) => (
                        <feMergeNode key={node} in={node} />
                      ))}
                    </feMerge>
                  ) : (
                    createElement(p.tag, { key: k, ...p.attrs })
                  ),
                )}
              </filter>
            ))}
            {/* a framed block, the frame and the block cut apart by a ring of bare paper */}
            <symbol id={`${id}-stamp`} viewBox="-6.5 -6.5 13 13" overflow="visible">
              <path d="M-6 -6h12v12h-12zM-4.4 -4.4v8.8h8.8v-8.8zM-3.2 -3.2h6.4v6.4h-6.4z" fillRule="evenodd" fill="currentColor" />
            </symbol>
            <symbol id={`${id}-blank`} viewBox="-6.5 -6.5 13 13" overflow="visible">
              <rect x="-5" y="-5" width="10" height="10" rx="1" fill="none" stroke="currentColor" strokeWidth="0.6" strokeDasharray="1 2" />
            </symbol>
            <symbol id={`${id}-rosette`} viewBox="-8 -8 16 16" overflow="visible">
              <path d={ROSETTE} fill="var(--coral)" stroke="currentColor" strokeWidth="0.7" strokeLinejoin="round" />
              <circle r="2.2" fill="none" stroke="currentColor" strokeWidth="0.7" />
            </symbol>
            <symbol id={`${id}-new`} viewBox="-7 -3.5 14 7" overflow="visible">
              <rect x="-6.5" y="-3" width="13" height="6" rx="1" fill="var(--paper)" stroke="var(--danger)" strokeWidth="0.8" />
              <text y="1.7" textAnchor="middle" fontSize="4.6" fontWeight="700" fill="var(--danger)" letterSpacing="0.3">
                NEW
              </text>
            </symbol>
          </defs>

          <g aria-hidden="true" className="ledger-labels">
            {grid.months.map(({ week, label }) => (
              <text key={`${week}-${label}`} x={centre(week, 0).x - PITCH / 2} y={11}>
                {label}
              </text>
            ))}
            {WEEKDAY_LABELS.map(([d, label]) => (
              <text key={label} x={0} y={centre(0, d).y + 3}>
                {label}
              </text>
            ))}
          </g>

          <g aria-hidden="true" className="ledger-blanks">
            {cells.map((c) => (c.level === 0 ? <Mark key={c.date} href={`#${id}-blank`} cell={c} /> : null))}
          </g>
          {Array.from({ length: SMUDGES }, (_, s) => (
            <g key={s} aria-hidden="true" filter={`url(#${id}-smudge-${s})`}>
              {cells.map((c) =>
                c.level > 0 && c.style.smudge === s ? <Mark key={c.date} href={`#${id}-stamp`} cell={c} opacity={c.style.ink} /> : null,
              )}
            </g>
          ))}
          <g aria-hidden="true" filter={`url(#${id}-smudge-0)`}>
            {cells.map((c) => <Milestones key={c.date} id={id} cell={c} />)}
          </g>

          <g>
            {cells.map((c, i) => {
              const { x, y } = centre(c.week, c.weekday);
              return (
                <rect
                  key={c.date}
                  data-i={i}
                  data-open={open?.i === i ? "" : undefined}
                  className="ledger-cell"
                  x={x - PITCH / 2 + 0.5}
                  y={y - PITCH / 2 + 0.5}
                  width={PITCH - 1}
                  height={PITCH - 1}
                  rx={2}
                  role="button"
                  tabIndex={i === active ? 0 : -1}
                  aria-label={cellLabel(c)}
                  onFocus={() => {
                    setActive(i);
                    setOpen((o) => (o?.i === i ? o : { i, pinned: false, ...place(i) }));
                  }}
                  onPointerEnter={(e) => {
                    if (e.pointerType === "mouse" && !open?.pinned) show(i, false);
                  }}
                  onPointerLeave={(e) => {
                    if (e.pointerType === "mouse") setOpen((o) => (o?.i === i && !o.pinned && document.activeElement !== e.currentTarget ? null : o));
                  }}
                  onClick={() => toggle(i)}
                  onKeyDown={(e) => onKeyDown(e, i)}
                />
              );
            })}
          </g>
        </svg>
      </div>

      {open && receipt ? (
        <div
          aria-hidden="true"
          className="ledger-receipt"
          data-flip={open.flip ? "" : undefined}
          style={{ left: open.x, top: open.y }}
        >
          {receiptLines(receipt).map((line, k) => (
            <p key={k} className={k === 0 ? "ledger-receipt-head" : undefined}>
              {line}
            </p>
          ))}
          {receipt.total ? <p className="ledger-receipt-foot">TOTAL {receipt.total}</p> : null}
        </div>
      ) : null}

      <Legend id={id} />
    </div>
  );
}

function Mark({ href, cell, opacity }: { href: string; cell: LedgerCell; opacity?: number }) {
  const { x, y } = centre(cell.week, cell.weekday);
  return (
    <use
      href={href}
      x={-STAMP / 2}
      y={-STAMP / 2}
      width={STAMP}
      height={STAMP}
      opacity={opacity}
      transform={`translate(${x} ${y}) rotate(${cell.style.rotation})`}
    />
  );
}

// A release is a rosette over the day's stamp; a new post a small NEW stamp on its corner.
function Milestones({ id, cell }: { id: string; cell: LedgerCell }) {
  if (!cell.milestones.length) return null;
  const { x, y } = centre(cell.week, cell.weekday);
  const release = cell.milestones.some((m) => m.kind === "release");
  const post = cell.milestones.some((m) => m.kind === "post");
  return (
    <>
      {release ? (
        <use href={`#${id}-rosette`} x={-6} y={-6} width={12} height={12} transform={`translate(${x} ${y}) rotate(${cell.style.rotation * 2})`} />
      ) : null}
      {post ? (
        <use href={`#${id}-new`} x={-5} y={-2.5} width={10} height={5} transform={`translate(${x + 3} ${y + 5}) rotate(${-8 + cell.style.rotation})`} />
      ) : null}
    </>
  );
}

function Legend({ id }: { id: string }) {
  return (
    <div aria-hidden="true" className="ledger-legend">
      <span>less</span>
      {INK.slice(1).map((ink) => (
        <svg key={ink} viewBox="-8 -8 16 16" width="16" height="16">
          <use href={`#${id}-stamp`} x={-6.5} y={-6.5} width={13} height={13} opacity={ink} />
        </svg>
      ))}
      <span>more</span>
      <svg viewBox="-8 -8 16 16" width="16" height="16" className="ml-4">
        <use href={`#${id}-rosette`} x={-7} y={-7} width={14} height={14} />
      </svg>
      <span>release</span>
      <svg viewBox="-8 -4 16 8" width="22" height="11" className="ml-4">
        <use href={`#${id}-new`} x={-7} y={-3.5} width={14} height={7} />
      </svg>
      <span>new post</span>
    </div>
  );
}
