"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type KeyboardEvent } from "react";
import { CRACKLE_ENABLED, crackleShouldPlay, createCrackle, type Crackle } from "../_lib/crackle.ts";
import {
  current,
  initialDeck,
  lcd,
  reduce,
  selectedRpm,
  targetRpm,
  tonearm,
  type Action,
  type Effect,
  type Phase,
  type TimerName,
} from "../_lib/deck.ts";
import { boxOf, flightPlan } from "../_lib/flight.ts";
import type { Box } from "../_lib/geometry.ts";
import { mapState, PLAYER_VARS, runEffect, YT_STATE, type PlayerLike } from "../_lib/player.ts";
import type { VinylRecord } from "../_lib/records.ts";
import { advance, settled, type Spin } from "../_lib/spin.ts";
import { armAria, dropAction, keyAction } from "../_lib/tonearm.ts";
import { loadYouTubeApi } from "../_lib/youtube.ts";
import { Crate } from "./crate";
import { Lcd } from "./lcd";
import { Monitor } from "./monitor";
import { useSleeveDrag } from "./sleeve-drag";
import { Transport } from "./transport";
import { Turntable } from "./turntable";

// The shell around deck.ts. dispatch() runs the pure reducer, keeps its state
// and runs its effects at once, inside the click or key that caused them, so
// playVideo() is always part of a user gesture. Only this file touches the
// player: one YT.Player, created the first time a record is placed, reused
// for every record after that and destroyed on pagehide and unmount.
//
// Placing a record (button or drag) flies a disc from the sleeve to the
// platter: a FLIP animation on a fixed layer, transform and opacity only,
// skipped under reduced motion and whenever its path would cross the
// monitor. With NEXT_PUBLIC_VINYL_CRACKLE=1 a synthesised crackle
// (_lib/crackle.ts) runs while the record plays; without it no audio code
// runs at all. Every listener, timer, frame, animation and sound started here
// is released on unmount, one cleanup per effect.

const POLL_MS = 250;
const ACTIVE: readonly Phase[] = ["starting", "buffering", "playing"];
const PLAYABLE: readonly Phase[] = ["loaded", "paused", "tap", "ended"];

// prefers-reduced-motion, live: the OS setting can change while the page is open.
const REDUCED = "(prefers-reduced-motion: reduce)";
function subscribeReduced(onChange: () => void) {
  const query = matchMedia(REDUCED);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}
const reducedNow = () => matchMedia(REDUCED).matches;
const reducedOnServer = () => false;

export function VinylApp({ records }: { records: VinylRecord[] }) {
  const [deck, setDeck] = useState(() => initialDeck(records));
  const [hasPlayer, setHasPlayer] = useState(false); // the iframe exists
  const [failed, setFailed] = useState(false); // iframe_api didn't load
  const reduced = useSyncExternalStore(subscribeReduced, reducedNow, reducedOnServer);

  const deckRef = useRef(deck);
  const rootRef = useRef<HTMLDivElement>(null);
  const crateRef = useRef<HTMLElement>(null);
  const ghostRef = useRef<HTMLDivElement>(null);
  const flightRef = useRef<HTMLDivElement>(null);
  const flying = useRef<Animation | null>(null);
  const crackle = useRef<Crackle | null>(null);
  const [crackleOn, setCrackleOn] = useState(true);
  const crackleOnRef = useRef(crackleOn);
  const [scrub, setScrub] = useState<number | null>(null); // the time a held tonearm points at
  const hostRef = useRef<HTMLDivElement>(null);
  const platterRef = useRef<SVGGElement>(null);
  const created = useRef<PlayerLike | null>(null); // constructed; callable only once ready
  const player = useRef<PlayerLike | null>(null); // ready
  const generation = useRef(0); // bumped on destroy, so late callbacks from an old player do nothing
  const timers = useRef(new Map<TimerName, ReturnType<typeof setTimeout>>());
  const spin = useRef<Spin>({ angle: 0, rpm: 0 });
  const cued = useRef(false); // YouTube has reported the last cue as done
  const wantsPlay = useRef(false); // a gesture's play, waiting for that cue

  const dispatch = useCallback(function dispatch(action: Action) {
    // A gesture that plays is also the one moment the crackle may wake its audio.
    if (CRACKLE_ENABLED && action.type === "play" && action.user === true && crackleOnRef.current) crackle.current?.unlock();
    const step = reduce(deckRef.current, action);
    deckRef.current = step.state;
    setDeck(step.state);
    for (const effect of step.effects) run(effect);

    function run(effect: Effect) {
      switch (effect.type) {
        case "ensurePlayer":
          return ensurePlayer();
        case "timer": {
          const { name, ms } = effect;
          clearTimeout(timers.current.get(name));
          timers.current.set(
            name,
            setTimeout(() => {
              timers.current.delete(name);
              dispatch({ type: "timeout", name });
            }, ms),
          );
          return;
        }
        case "clearTimer":
          clearTimeout(timers.current.get(effect.name));
          timers.current.delete(effect.name);
          return;
        case "destroy": {
          generation.current += 1;
          const old = created.current;
          created.current = null;
          player.current = null;
          cued.current = false;
          wantsPlay.current = false;
          try {
            old?.destroy();
          } catch {
            // already gone with its iframe
          }
          hostRef.current?.replaceChildren();
          setHasPlayer(false);
          return;
        }
        case "cue":
        case "stop":
          cued.current = false;
          wantsPlay.current = false;
          runEffect(player.current, effect);
          return;
        case "play":
          // YouTube answers a playVideo() that lands while a cue is still in
          // flight with error 2 about half the time, so the gesture's play
          // waits for the cue to land (onStateChange below delivers it).
          if (cued.current) runEffect(player.current, effect);
          else wantsPlay.current = true;
          return;
        case "pause":
          wantsPlay.current = false;
          runEffect(player.current, effect);
          return;
        default:
          // Before onReady there is nothing to call: "ready" re-cues the record.
          runEffect(player.current, effect);
      }
    }

    function ensurePlayer() {
      if (created.current) return;
      const gen = generation.current;
      const live = () => gen === generation.current;
      setFailed(false);
      loadYouTubeApi(window, document).then(
        (YT) => {
          const host = hostRef.current;
          if (!live() || !host || created.current) return;
          // YouTube swaps this node for its iframe, so React never renders into the host.
          const slot = document.createElement("div");
          host.replaceChildren(slot);
          created.current = new YT.Player(slot, {
            width: "100%",
            height: "100%",
            playerVars: PLAYER_VARS(location.origin),
            events: {
              onReady: ({ target }) => {
                if (!live()) return;
                player.current = target;
                dispatch({ type: "ready" });
              },
              // The platter follows YouTube's own reports, including plays and
              // pauses made with the player's controls.
              onStateChange: ({ data }) => {
                if (!live()) return;
                if (data !== YT_STATE.UNSTARTED) {
                  cued.current = true;
                  if (wantsPlay.current) {
                    wantsPlay.current = false;
                    player.current?.playVideo();
                  }
                }
                const action = mapState(data);
                if (action) dispatch(action);
              },
              onError: ({ data }) => {
                if (live()) dispatch({ type: "ytError", code: data });
              },
            },
          });
          setHasPlayer(true);
        },
        () => {
          if (live()) setFailed(true);
        },
      );
    }
  }, []);

  // The 250 ms clock for the seek bar and the LCD, while a record is on a ready player.
  const polling = deck.index !== null && deck.player === "ready";
  useEffect(() => {
    if (!polling) return;
    const id = setInterval(() => {
      const p = player.current;
      if (p) dispatch({ type: "time", current: p.getCurrentTime(), duration: p.getDuration() });
    }, POLL_MS);
    return () => clearInterval(id);
  }, [polling, dispatch]);

  // The platter: one rAF loop easing towards the deck's target speed. It
  // sleeps when the platter is still and should stay still; under reduced
  // motion it never turns (the playing lamp says it plays).
  const target = targetRpm(deck);
  useEffect(() => {
    const s = spin.current;
    if (reduced) {
      spin.current = { angle: s.angle, rpm: 0 };
      return;
    }
    let raf = 0;
    let last = performance.now();
    const frame = (now: number) => {
      const next = advance(spin.current, now - last, target, false);
      last = now;
      spin.current = next;
      platterRef.current?.style.setProperty("transform", `rotate(${next.angle.toFixed(2)}deg)`);
      raf = settled(next, target) ? 0 : requestAnimationFrame(frame);
    };
    if (!settled(s, target)) raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [target, reduced]);

  // No background play: a hidden tab pauses; leaving the page destroys the player.
  useEffect(() => {
    const pending = timers.current;
    const onVisibility = () => {
      if (document.visibilityState !== "hidden") return;
      crackle.current?.set(false);
      dispatch({ type: "hidden" });
    };
    const onPageHide = () => dispatch({ type: "unmount" });
    // Back from the back/forward cache: the player was destroyed, so put the record back.
    const onPageShow = (e: PageTransitionEvent) => {
      const index = deckRef.current.index;
      if (e.persisted && index !== null) dispatch({ type: "select", index });
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("pageshow", onPageShow);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("pageshow", onPageShow);
      dispatch({ type: "unmount" });
      for (const id of pending.values()) clearTimeout(id);
      pending.clear();
    };
  }, [dispatch]);

  // The crackle: created only with the flag, sounding only while the record plays.
  useEffect(() => {
    if (!CRACKLE_ENABLED) return;
    const c = createCrackle();
    crackle.current = c;
    return () => {
      c.close();
      crackle.current = null;
    };
  }, []);
  useEffect(() => {
    crackleOnRef.current = crackleOn;
    const hidden = document.visibilityState === "hidden";
    crackle.current?.set(crackleShouldPlay({ enabled: CRACKLE_ENABLED, on: crackleOn, phase: deck.phase, hidden }));
  }, [crackleOn, deck.phase]);

  // The crate-to-platter flight. A new flight replaces one still in the air.
  const fly = useCallback((index: number, from: Box) => {
    const root = rootRef.current;
    const el = flightRef.current;
    const to = boxOf(root?.querySelector("[data-drop-target]"));
    if (!root || !el || !to || typeof el.animate !== "function") return;
    const plan = flightPlan(from, to, boxOf(root.querySelector("[data-monitor]")), reducedNow());
    flying.current?.cancel();
    if (!plan) return;
    const { x, y, w, h } = plan.box;
    el.style.cssText = `left:${x}px;top:${y}px;width:${w}px;height:${h}px;--label:${deckRef.current.records[index]?.labelColor ?? "#888"}`;
    el.dataset.show = "true";
    const animation = el.animate(plan.keyframes, { duration: plan.duration, easing: plan.easing });
    const land = () => {
      if (flying.current === animation) flying.current = null;
      delete el.dataset.show;
    };
    animation.addEventListener("finish", land);
    animation.addEventListener("cancel", land);
    flying.current = animation;
  }, []);
  useEffect(() => () => flying.current?.cancel(), []);

  const place = useCallback(
    (index: number, from: Box | null) => {
      dispatch({ type: "select", index, user: true });
      if (from) fly(index, from);
    },
    [dispatch, fly],
  );
  const { drag, start: startDrag } = useSleeveDrag({ rootRef, crateRef, ghostRef, onDrop: place });

  const record = current(deck);
  const active = ACTIVE.includes(deck.phase);
  const canPlay = record !== null && deck.player === "ready" && PLAYABLE.includes(deck.phase);
  const canStop = record !== null && !["empty", "loaded", "error"].includes(deck.phase);
  const toggle = () => dispatch(active ? { type: "pause", user: true } : { type: "play", user: true });

  // Space, the arrows and Escape anywhere in the deck, except where the
  // focused control needs the key itself (text, selects, sliders, radios,
  // and Space on a button).
  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
    const el = e.target as HTMLElement;
    if (["INPUT", "SELECT", "TEXTAREA"].includes(el.tagName) || el.isContentEditable) return;
    if (e.key === " " && el.tagName === "BUTTON") return;
    switch (e.key) {
      case " ":
        toggle();
        break;
      case "ArrowLeft":
        dispatch({ type: "prev", user: true });
        break;
      case "ArrowRight":
        dispatch({ type: "next", user: true });
        break;
      case "Escape":
        dispatch({ type: "eject", user: true });
        break;
      default:
        return;
    }
    e.preventDefault();
  }

  return (
    <div className="deck" ref={rootRef} onKeyDown={onKeyDown} data-phase={deck.phase}>
      <Crate
        records={records}
        current={record?.id ?? null}
        dragging={drag ? (records[drag.index]?.id ?? null) : null}
        sectionRef={crateRef}
        onPlace={place}
        onDragStart={startDrag}
      />
      <div
        className="turntable-cell"
        role="group"
        tabIndex={0}
        aria-label="Turntable. Space plays or pauses, the arrow keys change record, Escape ejects."
        aria-keyshortcuts="Space ArrowLeft ArrowRight Escape"
      >
        <Turntable
          record={record}
          arm={tonearm(deck)}
          rpm={selectedRpm(deck)}
          playing={deck.phase === "playing"}
          time={deck.time}
          duration={deck.duration}
          slider={armAria(deck)}
          drop={drag ? (drag.over ? "over" : "ready") : null}
          onRpm={(rpm) => dispatch({ type: "rpm", rpm, user: true })}
          onArmDrop={(angle) => {
            for (const action of dropAction(angle, deckRef.current)) dispatch(action);
          }}
          onArmKey={(key) => {
            const actions = keyAction(key, deckRef.current);
            if (actions === null) return false;
            for (const action of actions) dispatch(action);
            return true;
          }}
          onScrub={setScrub}
          platterRef={platterRef}
        />
        {CRACKLE_ENABLED && (
          <label className="crackle" data-crackle="">
            <input
              type="checkbox"
              checked={crackleOn}
              onChange={(e) => {
                if (e.target.checked) crackle.current?.unlock();
                setCrackleOn(e.target.checked);
              }}
            />
            <span>Crackle</span>
          </label>
        )}
      </div>
      <Monitor
        record={record}
        phase={deck.phase}
        error={deck.error?.message ?? null}
        failed={failed}
        hasPlayer={hasPlayer}
        hostRef={hostRef}
        onSkip={() => dispatch({ type: "skip", user: true })}
        onRetry={() => {
          // The deck still waits for the player it asked for; ask the loader again.
          dispatch({ type: "unmount" });
          if (deckRef.current.index !== null) dispatch({ type: "select", index: deckRef.current.index, user: true });
        }}
      />
      <Lcd lcd={lcd(deck)} record={record} />
      <Transport
        hasRecord={record !== null}
        canPlay={canPlay}
        active={active}
        canStop={canStop}
        time={scrub ?? deck.time}
        duration={deck.duration}
        volume={deck.volume}
        onToggle={toggle}
        onStop={() => dispatch({ type: "stop", user: true })}
        onPrev={() => dispatch({ type: "prev", user: true })}
        onNext={() => dispatch({ type: "next", user: true })}
        onEject={() => dispatch({ type: "eject", user: true })}
        onSeek={(seconds) => dispatch({ type: "seek", seconds, user: true })}
        onVolume={(value) => dispatch({ type: "volume", value, user: true })}
      />
      {/* Fixed layers for the dragged disc and the flight; neither is ever drawn over the monitor. */}
      <div
        className="ghost"
        ref={ghostRef}
        aria-hidden="true"
        style={{ "--label": drag ? records[drag.index]?.labelColor : undefined } as CSSProperties}
      />
      <div className="flight" ref={flightRef} aria-hidden="true" />
    </div>
  );
}
