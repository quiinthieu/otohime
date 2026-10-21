"use client";

import { useEffect, useReducer, useSyncExternalStore, type CSSProperties } from "react";
import { describe, KNOBS, PAPERS, SAY, SPOTS, turn, type Board, type Face, type Knob, type Part, type Pots, type Turn } from "../_lib/board.ts";
import { rule } from "../_lib/contrast.ts";
import { scene, wordOf } from "../_lib/scenes.ts";
import { DRESSES } from "../_lib/siblings.ts";

// The one client island. It is server-rendered like the rest of the page, so
// with JavaScript off its HTML is the board at the start, the counter's and
// the rule line's start sentences, and the knobs greyed in a disabled
// fieldset. Hydrated, the knobs wake up and every press runs the engine's pure
// turn(): the board, the sentence and the parts that followed.
//
// The pots are custom properties on the <svg> (--board-paper, --board-ink,
// --board-spot, --board-face, --board-speed). With the system on every part
// paints from them (its --part-* are var(--board-*)), so one change repaints
// all nine; with it off each part carries its own hex and nothing reads the
// pots. The ink arrives finished as path strings, drawn once in <defs> as 27
// <symbol>s and placed nine times with <use>, so rough.js never reaches the
// browser. A corner change swaps a <use>'s href; a gap change its transform.

// A part's stamps as the server inked them: one body a corner (the closed
// shape the fill goes on, under its <symbol> id), and the ink details and the
// spot mark its three corners share.
export type Stamp = { part: string; bodies: { id: string; d: string }[]; details: string; accent: string };

type State = { board: Board; say: string; hot: readonly Part[]; beat: number };
type Event = { type: "turn"; turn: Turn } | { type: "cool"; beat: number };

function reduce(s: State, e: Event): State {
  if (e.type === "cool") return e.beat === s.beat ? { ...s, hot: [] } : s;
  const t = turn(s.board, e.turn);
  return { board: t.board, say: t.say, hot: t.hot, beat: s.beat + 1 };
}

const HOT_MS = 500;

const KNOB_ORDER: readonly Knob[] = ["paper", "spot", "corner", "gap", "size", "speed", "face"];
const TITLES: Record<Knob, string> = { paper: "Paper", spot: "Spot", corner: "Corner", gap: "Gap", size: "Size", speed: "Speed", face: "Face" };

// The preset a knob stands at, if the pots match one (a dress can leave none).
function chosen(knob: Knob, pots: Pots): string | undefined {
  return Object.keys(KNOBS[knob]).find((name) => Object.entries(KNOBS[knob][name]).every(([k, v]) => pots[k as keyof Pots] === v));
}

// A face pot as a font stack: the page's own hand for cursive, else the generic family.
const stack = (face: Face) => (face === "cursive" ? "var(--hand-face)" : face);

// The ink dot beside a paper or spot preset.
function dotFor(knob: Knob, name: string): string | undefined {
  if (knob === "spot") return SPOTS[name as keyof typeof SPOTS];
  if (knob === "paper") return PAPERS[name as keyof typeof PAPERS].paper;
  return undefined;
}

const noop = () => () => {};
const vars = (v: Record<string, string>) => v as CSSProperties;

function Drawing({ board, hot }: { board: Board; hot: ReadonlySet<Part> }) {
  const s = scene(board);
  const on = board.system;
  const p = board.pots;
  const lit = (part: Part) => (hot.has(part) ? "" : undefined);
  return (
    <svg
      className="board-svg"
      viewBox={`0 0 ${s.width} ${s.height}`}
      role="img"
      aria-label={describe(board)}
      style={vars({ "--board-paper": p.paper, "--board-ink": p.ink, "--board-spot": p.spot, "--board-face": stack(p.face), "--board-speed": `${p.speed}ms` })}
    >
      <rect className="screen" x={0} y={0} width={s.width} height={s.height} style={vars({ "--part-paper": on ? "var(--board-paper)" : s.paper })} />
      {s.parts.map((part) => (
        <use
          key={part.part}
          href={`#${part.stamp}`}
          data-part={part.part}
          data-hot={lit(part.part)}
          style={vars({
            transform: `translate(${part.x}px, ${part.y}px)`,
            ...(on
              ? { "--part-body": part.part === "button" ? "var(--board-spot)" : "var(--board-paper)", "--part-ink": "var(--board-ink)", "--part-accent": "var(--board-spot)" }
              : { "--part-body": part.fill, "--part-ink": part.stroke, "--part-accent": part.accent, "--board-speed": `${part.speed}ms` }),
          })}
        />
      ))}
      {s.parts.map((part) => {
        const l = wordOf(part);
        return (
          <text
            key={`word-${part.part}`}
            className="word"
            data-word={part.part}
            data-hot={lit(part.part)}
            x={0}
            y={0}
            fontSize={l.size}
            textAnchor={l.anchor}
            style={vars({
              transform: `translate(${l.x}px, ${l.y}px)`,
              ...(on ? { "--part-ink": "var(--board-ink)", "--part-face": "var(--board-face)" } : { "--part-ink": part.stroke, "--part-face": stack(part.label.face), "--board-speed": `${part.speed}ms` }),
            })}
          >
            {l.text}
          </text>
        );
      })}
    </svg>
  );
}

export function BoardApp({ stamps, initial }: { stamps: Stamp[]; initial: Board }) {
  const hydrated = useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
  const [state, dispatch] = useReducer(reduce, { board: initial, say: SAY.start, hot: [], beat: 0 });
  const { board, beat } = state;
  const warm = state.hot.length > 0;

  // The parts a turn moved stay marked for 500 ms; a newer turn restarts the clock.
  useEffect(() => {
    if (!warm) return;
    const id = setTimeout(() => dispatch({ type: "cool", beat }), HOT_MS);
    return () => clearTimeout(id);
  }, [beat, warm]);

  const send = (t: Turn) => dispatch({ type: "turn", turn: t });
  const r = rule(board);

  return (
    <div className="board-app">
      <svg className="stamp-defs" width="0" height="0" aria-hidden="true" focusable="false">
        <defs>
          {stamps.map((s) => (
            <g key={s.part} id={`marks-${s.part}`}>
              {s.details && <path d={s.details} fill="none" strokeWidth={1.4} strokeLinecap="round" />}
              <path d={s.accent} strokeWidth={1} strokeLinejoin="round" />
            </g>
          ))}
          {stamps.flatMap((s) =>
            s.bodies.map((b) => (
              <symbol key={b.id} id={b.id} overflow="visible">
                <path d={b.d} fill="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
                <use href={`#marks-${s.part}`} />
              </symbol>
            )),
          )}
        </defs>
      </svg>
      <Drawing board={board} hot={new Set(state.hot)} />
      <div className="readout">
        <output className="counter" aria-live="polite" data-counter="">
          {state.say}
        </output>
        <output className="rule" data-rule="" data-passes={board.system ? String(r.passes) : undefined}>
          {r.say}
        </output>
      </div>
      <fieldset disabled={!hydrated} data-knobs="" className="knobs">
        <legend>Turn the knobs</legend>
        <div className="knob-groups">
          {KNOB_ORDER.map((knob) => {
            const at = chosen(knob, board.pots);
            return (
              <fieldset key={knob} className={knob === "spot" ? "knob wide" : "knob"} data-knob={knob}>
                <legend>{TITLES[knob]}</legend>
                <div className="choices">
                  {Object.keys(KNOBS[knob]).map((name) => {
                    const dot = dotFor(knob, name);
                    return (
                      <label key={name} className="choice">
                        <input type="radio" name={`knob-${knob}`} value={name} checked={at === name} onChange={() => send({ knob, to: name })} />
                        {dot && <span className="dot" aria-hidden="true" style={{ background: dot }} />}
                        {name}
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            );
          })}
        </div>
        <div className="system">
          <label className="switch">
            <input type="checkbox" role="switch" data-system="" checked={!board.system} onChange={(e) => send({ knob: "system", to: !e.target.checked })} />
            No system
          </label>
        </div>
        <div className="dresses" role="group" aria-label="Dress as">
          {DRESSES.map((d) => (
            <button key={d.group} type="button" data-dress={d.group} onClick={() => send({ knob: "dress", to: d.group })}>
              Dress as {d.dress.name}
            </button>
          ))}
        </div>
        <div className="reset">
          <button type="button" data-reset="" onClick={() => send({ knob: "reset" })}>
            Reset
          </button>
        </div>
      </fieldset>
    </div>
  );
}
