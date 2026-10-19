"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type KeyboardEvent } from "react";
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
import { mapState, PLAYER_VARS, runEffect, YT_STATE, type PlayerLike } from "../_lib/player.ts";
import type { VinylRecord } from "../_lib/records.ts";
import { advance, settled, type Spin } from "../_lib/spin.ts";
import { loadYouTubeApi } from "../_lib/youtube.ts";
import { Crate } from "./crate";
import { Lcd } from "./lcd";
import { Monitor } from "./monitor";
import { Transport } from "./transport";
import { Turntable } from "./turntable";

// The shell around deck.ts. dispatch() runs the pure reducer, keeps its state
// and runs its effects at once, inside the click or key that caused them, so
// playVideo() is always part of a user gesture. Only this file touches the
// player: one YT.Player, created the first time a record is placed, reused
// for every record after that and destroyed on pagehide and unmount.

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
      if (document.visibilityState === "hidden") dispatch({ type: "hidden" });
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
    <div className="deck" onKeyDown={onKeyDown} data-phase={deck.phase}>
      <Crate records={records} current={record?.id ?? null} onPlace={(index) => dispatch({ type: "select", index, user: true })} />
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
          onRpm={(rpm) => dispatch({ type: "rpm", rpm, user: true })}
          platterRef={platterRef}
        />
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
        time={deck.time}
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
    </div>
  );
}
