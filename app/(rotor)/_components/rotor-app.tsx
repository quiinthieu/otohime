"use client";

import { useEffect, useReducer, useState, type CSSProperties, type ReactNode } from "react";
import { LAMP_R, LAMPS, ROWS, VIEW, WINDOWS } from "../_lib/board.ts";
import { MESSAGE_CAP, parsePlugs, toQuery, type Settings } from "../_lib/enigma.ts";
import { plugText } from "../_lib/form.ts";
import { FRAME_MS, KEY_FRAMES, LAMP_FRAMES, machine, pending, restore, type MachineAction, type Slot } from "../_lib/machine.ts";
import { tape } from "../_lib/tape.ts";
import { ALPHABET, REFLECTOR_NAMES, ROTOR_NAMES, type ReflectorName, type RotorName } from "../_lib/wiring.ts";

// The one client island. It is server-rendered like the rest of the page, so
// with JavaScript off its HTML is the whole machine: the windows at the final
// positions, the last lamp lit, the tape and the lid's GET form. Hydrated, it
// takes over typing: the real keyboard (A–Z, no repeats, no Ctrl/Alt/Meta)
// and the drawn keys, through machine.ts's reducer. Frames tick at 12 fps only
// while one is pending, and never under reduced motion. Every change rewrites
// the share URL with history.replaceState. The ink arrives finished from
// box.tsx, so rough.js never reaches the browser.

const SLOTS = ["Left", "Middle", "Right"] as const;
const LETTERS = [...ALPHABET];

const reducedNow = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const isTyping = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.isContentEditable || t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT");
const letterOf = (key: string) => (/^[a-z]$/i.test(key) ? key.toUpperCase() : null);

// A rotor window's letter. Whether it rolls in is fixed when it mounts: a letter
// that arrives after the first press rolls, and the ones already showing when
// typing starts stay put, so the server render and the first paint never roll.
function WindowLetter({ slot, letter, x, y, rolls }: { slot: number; letter: string; x: number; y: number; rolls: boolean }) {
  const [rolled] = useState(rolls);
  return (
    <text data-window={slot} data-rolled={rolled ? "" : undefined} className="window-letter" x={x} y={y} dy="0.36em" textAnchor="middle">
      {letter}
    </text>
  );
}

export function RotorApp({
  settings,
  message,
  frame,
  rims,
  caps,
}: {
  settings: Settings;
  message: string;
  frame: ReactNode;
  rims: Record<string, ReactNode>;
  caps: Record<string, ReactNode>;
}) {
  const [s, dispatch] = useReducer(machine, { settings, message }, (i) => restore(i.settings, i.message));
  // Until someone touches the machine the address bar keeps what they opened.
  const [touched, setTouched] = useState(false);
  // The plugboard as typed, while it is not yet a whole board; null shows the machine's.
  const [plugDraft, setPlugDraft] = useState<string | null>(null);
  // The windows roll only once a key has been pressed, never at first paint.
  const [rolled, setRolled] = useState(false);

  const act = (action: MachineAction) => {
    setTouched(true);
    dispatch(action);
  };
  const press = (letter: string) => {
    setTouched(true);
    setRolled(true);
    dispatch({ type: "motion", reduced: reducedNow() });
    dispatch({ type: "press", letter });
  };
  const release = (letter?: string) => dispatch({ type: "release", letter });

  // The real keyboard. Typing into the lid's fields is not typing on the machine.
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const letter = letterOf(e.key);
      if (!letter || e.repeat || e.ctrlKey || e.altKey || e.metaKey || isTyping(e.target)) return;
      e.preventDefault();
      setTouched(true);
      setRolled(true);
      dispatch({ type: "motion", reduced: reducedNow() });
      dispatch({ type: "press", letter });
    };
    const up = (e: KeyboardEvent) => {
      const letter = letterOf(e.key);
      if (letter) dispatch({ type: "release", letter });
    };
    const blur = () => dispatch({ type: "release" });
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, []);

  // 12 fps while the key sinks or the lamp warms; under reduced motion nothing pends.
  const busy = pending(s);
  useEffect(() => {
    if (!busy) return;
    const id = setInterval(() => dispatch({ type: "tick" }), FRAME_MS);
    return () => clearInterval(id);
  }, [busy]);

  const share = `/rotor?${toQuery(s.settings, s.plain)}`;
  const decode = `/rotor?${toQuery(s.settings, s.code)}`;
  useEffect(() => {
    if (touched) window.history.replaceState(null, "", share);
  }, [touched, share]);

  const plugValue = plugDraft ?? s.settings.plugs.join("-");
  const plugOk = plugText(plugValue) === "" || parsePlugs(plugText(plugValue)).length > 0;
  const onPlugs = (v: string) => {
    setPlugDraft(v);
    const text = plugText(v);
    const pairs = text === "" ? [] : parsePlugs(text);
    if (text === "" || pairs.length > 0) act({ type: "plugs", pairs });
  };

  const t = tape(s.plain, s.code);
  const lastLamp = s.code.replace(/[^A-Z]/g, "").at(-1);
  const count = s.code.replace(/[^A-Z]/g, "").length;

  return (
    <>
      <section className="machine" aria-labelledby="machine-title">
        <h2 id="machine-title" className="visually-hidden">
          The machine
        </h2>
        <svg
          className="box"
          viewBox={`0 0 ${VIEW.w} ${VIEW.h}`}
          role="img"
          aria-label={`Rotors ${s.settings.rotors.join(", ")}; the windows read ${[...s.positions].join(" ")}${s.lamp ? `; lamp ${s.lamp} is lit` : ""}`}
        >
          <rect className="panel" x="8" y="8" width={VIEW.w - 16} height={VIEW.h - 16} rx="10" />
          {frame}
          <g data-windows={s.positions}>
            {WINDOWS.map((w, i) => (
              <g key={i}>
                {/* keyed on its letter, so a step remounts it and it rolls in */}
                <WindowLetter key={`${i}-${s.positions[i]}`} slot={i} letter={s.positions[i]} x={w.x} y={w.y} rolls={rolled} />
                <text className="rotor-name" x={w.x} y={w.y + 48} textAnchor="middle">
                  {s.settings.rotors[i]}
                </text>
              </g>
            ))}
          </g>
          {LAMPS.map((l) => {
            const lit = s.lamp === l.letter;
            const style = lit ? ({ "--glow": s.lampFrame / LAMP_FRAMES } as CSSProperties) : undefined;
            return (
              <g key={l.letter} data-lamp={l.letter} className={lit ? "lamp lit" : "lamp"} style={style}>
                <circle className="glass" cx={l.x} cy={l.y} r={LAMP_R - 1} />
                {rims[l.letter]}
                <text x={l.x} y={l.y} dy="0.36em" textAnchor="middle">
                  {l.letter}
                </text>
              </g>
            );
          })}
        </svg>

        <div className="keyboard" role="group" aria-label="Keyboard">
          {ROWS.map((row) => (
            <div key={row} className="keys-row">
              {[...row].map((letter) => {
                const down = s.down === letter;
                const style = down ? ({ "--sink": s.keyFrame / KEY_FRAMES } as CSSProperties) : undefined;
                return (
                  <button
                    key={letter}
                    type="button"
                    className={down ? "key down" : "key"}
                    data-key={letter}
                    aria-label={letter}
                    style={style}
                    onPointerDown={(e) => {
                      if (e.button !== 0) return;
                      e.currentTarget.setPointerCapture?.(e.pointerId);
                      press(letter);
                    }}
                    onPointerUp={() => release(letter)}
                    onPointerCancel={() => release(letter)}
                    onClick={(e) => {
                      // Enter or Space on a focused key: no pointer, so press and let go.
                      if (e.detail !== 0) return;
                      press(letter);
                      setTimeout(() => release(letter), 4 * FRAME_MS);
                    }}
                  >
                    {caps[letter]}
                    <span aria-hidden="true">{letter}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        <div className="tape" data-tape="">
          <p>
            <span className="tape-label">Typed</span>
            {t.cut > 0 && <span className="cut">…</span>}
            <span data-tape="plain">{t.plain}</span>
          </p>
          <p>
            <span className="tape-label">Lamps</span>
            {t.cut > 0 && <span className="cut">…</span>}
            <span data-tape="code">{t.code}</span>
          </p>
        </div>
        <p className="visually-hidden" aria-live="polite">
          {lastLamp ? `Lamp ${lastLamp}, letter ${count}` : ""}
        </p>
      </section>

      <section className="lid" aria-labelledby="lid-title">
        <h2 id="lid-title">Inside the lid</h2>
        <form method="get" action="/rotor">
          <div className="slots">
            {SLOTS.map((name, i) => {
              const slot = i as Slot;
              return (
                <fieldset key={name} className="slot">
                  <legend>{name}</legend>
                  <label>
                    Rotor
                    <select name="r" value={s.settings.rotors[i]} onChange={(e) => act({ type: "set-rotor", slot, name: e.target.value as RotorName })}>
                      {ROTOR_NAMES.map((r) => (
                        <option key={r}>{r}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Ring
                    <select name="ring" value={s.settings.rings[i]} onChange={(e) => act({ type: "set-ring", slot, letter: e.target.value })}>
                      {LETTERS.map((c) => (
                        <option key={c}>{c}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Start
                    <select name="pos" value={s.settings.positions[i]} onChange={(e) => act({ type: "set-start", slot, letter: e.target.value })}>
                      {LETTERS.map((c) => (
                        <option key={c}>{c}</option>
                      ))}
                    </select>
                  </label>
                </fieldset>
              );
            })}
          </div>
          <fieldset className="reflector">
            <legend>Reflector</legend>
            {REFLECTOR_NAMES.map((r) => (
              <label key={r}>
                <input
                  type="radio"
                  name="ref"
                  value={r}
                  checked={s.settings.reflector === r}
                  onChange={() => act({ type: "reflector", name: r as ReflectorName })}
                />
                {r}
              </label>
            ))}
          </fieldset>
          <label className="field">
            Plugboard
            <input
              name="plug"
              value={plugValue}
              placeholder="AB-CD"
              autoComplete="off"
              spellCheck={false}
              aria-invalid={!plugOk}
              aria-describedby="plug-hint"
              onChange={(e) => onPlugs(e.target.value)}
              onBlur={() => plugOk && setPlugDraft(null)}
            />
          </label>
          <p id="plug-hint" className="hint">
            Pairs such as AB-CD: up to ten, each letter once.
          </p>
          <label className="field">
            Message
            <textarea
              name="m"
              rows={3}
              maxLength={MESSAGE_CAP}
              value={s.plain}
              spellCheck={false}
              onChange={(e) => act({ type: "message", text: e.target.value })}
            />
          </label>
          <div className="actions">
            <button type="submit">Encode</button>
            <button type="button" onClick={() => act({ type: "clear" })}>
              Clear
            </button>
          </div>
        </form>
        <p className="share">
          Share: <a href={share}>{share}</a>
        </p>
        <p className="decode">
          <a href={decode}>Open the code with these settings</a> and the message comes back on the lamps line.
        </p>
      </section>
    </>
  );
}
