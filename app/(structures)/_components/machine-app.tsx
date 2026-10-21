"use client";

import { useEffect, useReducer, useState, useSyncExternalStore, type CSSProperties, type KeyboardEvent } from "react";
import { stepsWord, type Action, type Beat, type MoveSpec } from "../_lib/machine.ts";
import { busy, finished, landing, lit, next, saying, setMode, settle, shown, sofar, start, stepsSoFar, tick, TICK_MS, type Mode, type Play } from "../_lib/play.ts";
import { arrowEnds, placedText, pointerText, sceneFor, type Scene } from "../_lib/scenes.ts";
import { bySlug } from "../_lib/structures/index.ts";

// The one client island. It is server-rendered like the rest of the page, so
// with JavaScript off its HTML is the worked example's end state, its last
// sentence and its steps, with the controls greyed in a disabled fieldset.
// Hydrated, the controls wake up: a move runs the structure's own pure
// reducer, and play.ts plays its trace one beat a picture and a sentence, at
// 12 fps only while a move plays, or one beat a press in step mode. Under
// reduced motion a move lands at once. The ink arrives finished as path
// strings, drawn once in <defs> and placed with <use>, so rough.js never
// reaches the browser.

// A stamp as the server inked it (stamps.ts's shape, which this file may not import).
type Stamp = { id: string; kind: string; paths: string[] };

type Machine = { slug: string; play: Play<unknown> };
type Event =
  | { type: "move"; action: Action; reduced: boolean }
  | { type: "tick" }
  | { type: "next" }
  | { type: "mode"; mode: Mode }
  | { type: "settle" }
  | { type: "reset"; initial: unknown; trace: readonly Beat[] };

const ids = (scene: Scene) => new Set([...scene.stamps.map((p) => p.id), ...scene.arrows.map((a) => a.id), ...scene.pointers.map((p) => p.id)]);

function machine(m: Machine, e: Event): Machine {
  const p = m.play;
  switch (e.type) {
    case "move": {
      const structure = bySlug(m.slug)!;
      const from = p.state;
      const move = structure.reduce(from, e.action);
      const played = start(from, move, p.mode, landing(move.trace, ids(sceneFor(m.slug, from))));
      return { ...m, play: e.reduced && p.mode === "play" ? settle(played) : played };
    }
    case "tick":
      return { ...m, play: tick(p) };
    case "next":
      return { ...m, play: next(p) };
    case "mode":
      return { ...m, play: setMode(p, e.mode) };
    case "settle":
      return { ...m, play: settle(p) };
    case "reset":
      return { ...m, play: finished(e.initial, e.trace, p.mode) };
  }
}

const noop = () => () => {};
const REDUCED = "(prefers-reduced-motion: reduce)";
const reducedNow = () => window.matchMedia(REDUCED).matches;

// The boxes a structure's moves need: a number, a drawer, a word, or two stations.
function boxesFor(moves: readonly MoveSpec[]) {
  const pair = moves.some((m) => m.takes === "pair");
  return {
    number: moves.some((m) => m.takes === "number"),
    drawer: moves.some((m) => m.takes === "index" || m.at),
    word: !pair && moves.some((m) => m.takes === "word"),
    pair,
  };
}

type Values = { number: string; drawer: string; word: string; start: string; end: string };

function actionFor(m: MoveSpec, v: Values, pair: boolean): Action {
  switch (m.takes) {
    case "none":
      return { move: m.id };
    case "index":
      return { move: m.id, value: v.drawer };
    case "word":
      return { move: m.id, value: pair ? v.start : v.word };
    case "pair":
      return { move: m.id, value: v.start, to: v.end };
    default:
      return m.at ? { move: m.id, value: v.number, to: v.drawer } : { move: m.id, value: v.number };
  }
}

const at = (x: number, y: number, turn = 0): CSSProperties => ({ transform: `translate(${x}px, ${y}px)${turn ? ` rotate(${turn}deg)` : ""}` });

function Drawing({ slug, scene, hot, label }: { slug: string; scene: Scene; hot: ReadonlySet<string>; label: string }) {
  const lit = (id: string) => (hot.has(id) ? "" : undefined);
  return (
    <svg className="machine-svg" viewBox={`0 0 ${scene.width} ${scene.height}`} role="img" aria-label={label}>
      {scene.labels.map((l, i) => (
        <text key={`label${i}`} className="scene-label" x={l.x} y={l.y} fontSize={l.size} textAnchor={l.anchor}>
          {l.text}
        </text>
      ))}
      {scene.arrows.map((a, i) => {
        const [x1, y1, x2, y2] = arrowEnds(scene, a);
        const length = Math.hypot(x2 - x1, y2 - y1);
        const turn = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;
        const seed = i % 3;
        return (
          <g key={a.id} className="arrow" data-arrow={a.id} data-hot={lit(a.id)} transform={`translate(${x1} ${y1}) rotate(${turn.toFixed(2)})`}>
            <use href={`#${slug}-line-${seed}`} transform={`scale(${(length / 100).toFixed(3)} 1)`} />
            {a.head && <use href={`#${slug}-head-${seed}`} transform={`translate(${(length - 100).toFixed(1)} 0)`} />}
          </g>
        );
      })}
      {scene.stamps.map((p) => (
        <use key={p.id} href={`#${slug}-${p.kind}-${p.seed}`} fill="none" data-stamp={p.id} data-hot={lit(p.id)} style={at(p.x, p.y)} />
      ))}
      {scene.stamps.map((p) => {
        if (!p.text) return null;
        const l = placedText(p);
        return (
          <text key={`text-${p.id}`} className="stamp-text" data-hot={lit(p.id)} x={0} y={0} fontSize={l.size} textAnchor={l.anchor} style={at(l.x, l.y)}>
            {l.text}
          </text>
        );
      })}
      {scene.pointers.map((p) => {
        const l = pointerText(p);
        return (
          <g key={p.id}>
            <use className="hand" href={`#${slug}-hand-0`} fill="none" data-hand={p.id} data-hot={lit(p.id)} style={at(p.x, p.y, p.angle)} />
            <text className="stamp-text hand-text" x={0} y={0} fontSize={l.size} textAnchor={l.anchor} style={at(l.x, l.y)}>
              {l.text}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export function MachineApp({ slug, stamps, initial, exampleTrace }: { slug: string; stamps: Stamp[]; initial: unknown; exampleTrace: readonly Beat[] }) {
  const structure = bySlug(slug)!;
  const hydrated = useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
  const [m, dispatch] = useReducer(machine, { slug, play: finished(initial, exampleTrace) });
  const [values, setValues] = useState<Values>({ number: "", drawer: "", word: "", start: "", end: "" });
  const p = m.play;
  const playing = busy(p);

  // 12 fps, only while a move plays in play mode; cleared when it is done or the page goes.
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => dispatch({ type: "tick" }), TICK_MS);
    return () => clearInterval(id);
  }, [playing]);

  // Reduced motion switched on mid-move lands the move at once.
  useEffect(() => {
    const mq = window.matchMedia(REDUCED);
    const change = () => mq.matches && dispatch({ type: "settle" });
    mq.addEventListener("change", change);
    return () => mq.removeEventListener("change", change);
  }, []);

  const boxes = boxesFor(structure.moves);
  const run = (id: string) => {
    if (playing) return;
    const spec = structure.moves.find((x) => x.id === id);
    if (spec) dispatch({ type: "move", action: actionFor(spec, values, boxes.pair), reduced: reducedNow() });
  };
  const enter = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    run(structure.defaultMove);
  };
  const box = (key: keyof Values) => ({
    value: values[key],
    onChange: (e: { target: { value: string } }) => setValues((v) => ({ ...v, [key]: e.target.value })),
    onKeyDown: enter,
  });

  const state = shown(p);
  const scene = sceneFor(slug, state);
  const steps = stepsSoFar(p);

  return (
    <div className="machine-app">
      <svg className="stamp-defs" width="0" height="0" aria-hidden="true" focusable="false">
        <defs>
          {stamps.map((s) =>
            s.kind === "arrow" ? (
              // the unit arrow: its shaft (the first path) as a line, its head (the rest) apart, so a line of any
              // length keeps a head of one size
              [
                <path key={`${s.id}-line`} id={`${slug}-${s.id.replace("arrow", "line")}`} d={s.paths[0]} fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" vectorEffect="non-scaling-stroke" />,
                <g key={`${s.id}-head`} id={`${slug}-${s.id.replace("arrow", "head")}`}>
                  {s.paths.slice(1).map((d, i) => (
                    <path key={i} d={d} fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" />
                  ))}
                </g>,
              ]
            ) : (
              <g key={s.id} id={`${slug}-${s.id}`}>
                {s.paths.map((d, i) => (
                  <path key={i} d={d} stroke="currentColor" strokeWidth={s.kind === "station" ? 2.6 : 2.2} strokeLinecap="round" strokeLinejoin="round" />
                ))}
              </g>
            ),
          )}
        </defs>
      </svg>
      <Drawing slug={slug} scene={scene} hot={lit(p)} label={structure.describe(state)} />
      <div className="narration-box">
        <output className="narration" aria-live="polite">
          {saying(p)}
        </output>
        <p className="count" data-steps={steps}>
          Counted: {stepsWord(steps)}
        </p>
      </div>
      <fieldset disabled={!hydrated} data-controls="" className="controls">
        <legend>Work the machine</legend>
        <div className="boxes">
          {boxes.number && (
            <label>
              Number
              <input type="number" inputMode="numeric" min={0} max={99} placeholder="0 to 99" name="number" {...box("number")} />
            </label>
          )}
          {boxes.drawer && (
            <label>
              Drawer
              <input type="number" inputMode="numeric" min={0} max={structure.cap - 1} placeholder={`0 to ${structure.cap - 1}`} name="drawer" {...box("drawer")} />
            </label>
          )}
          {boxes.word && (
            <label>
              Word
              <input type="text" pattern="[a-z]{1,5}" maxLength={5} autoCapitalize="none" autoComplete="off" spellCheck={false} placeholder="a to z, 1 to 5 letters" name="word" {...box("word")} />
            </label>
          )}
          {boxes.pair && (
            <>
              <label>
                From
                <input type="text" pattern="[A-Ha-h]" maxLength={1} autoComplete="off" spellCheck={false} placeholder="A to H" name="start" {...box("start")} />
              </label>
              <label>
                To
                <input type="text" pattern="[A-Ha-h]" maxLength={1} autoComplete="off" spellCheck={false} placeholder="A to H" name="end" {...box("end")} />
              </label>
            </>
          )}
        </div>
        <div className="moves" role="group" aria-label="Moves">
          {structure.moves.map((x) => (
            <button key={x.id} type="button" data-move={x.id} aria-disabled={playing || undefined} onClick={() => run(x.id)}>
              {x.label}
            </button>
          ))}
        </div>
        <div className="clock" role="group" aria-label="Playing">
          <button type="button" data-mode="play" aria-pressed={p.mode === "play"} onClick={() => dispatch({ type: "mode", mode: "play" })}>
            Play
          </button>
          <button type="button" data-mode="step" aria-pressed={p.mode === "step"} onClick={() => dispatch({ type: "mode", mode: "step" })}>
            Step
          </button>
          {p.mode === "step" && (
            <button type="button" data-next="" aria-disabled={p.done || undefined} onClick={() => dispatch({ type: "next" })}>
              Next step
            </button>
          )}
          <button type="button" data-reset="" onClick={() => dispatch({ type: "reset", initial, trace: exampleTrace })}>
            Reset
          </button>
        </div>
      </fieldset>
      <div className="steps">
        <p className="steps-title">The steps</p>
        <ol data-trace="" className="trace">
          {sofar(p).map((b, i) => (
            <li key={i} data-step={b.step ? "" : undefined}>
              {b.say}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
