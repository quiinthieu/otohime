"use client";

import { bootStyle, booted, chimeAllowed, finishBoot, splashStyle } from "@/lib/boot";
import { box } from "@/components/figures";
import { Chip, Machine, useTick } from "@/components/machine";
import { site } from "@/content/site";
import { CONSOLE_MENU, LCD, menuBaseline } from "@/lib/pages";
import { newPad, pad, type Button } from "@/lib/machines";
import {
  ACHIEVEMENT_KEY,
  CODE,
  codeStep,
  HIGH_KEY,
  newSnake,
  parseAchievement,
  parseHigh,
  snake,
  xy,
  type Dir,
  type PocketKey,
} from "@/lib/snake";
import { play } from "@/lib/sound-client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useEffectEvent, useReducer, useRef, useState, useSyncExternalStore } from "react";

// A pocket console standing up, its screen a menu of the site. W is its
// thickness, D the front's width.
const O: [number, number] = [176, 232];
const W = 24;
const D = 112;
const H = 176;
const body = box(O, W, D, H, [0, 0, 0], 60);
const cartridge = box(O, 12, 76, 14, [2, 18, H]);
const MENU = CONSOLE_MENU;
const REDUCED = "(prefers-reduced-motion: reduce)";

const root = () => document.documentElement;
const session = () => sessionStorage;
const onReducedChange = (listener: () => void) => {
  const query = matchMedia(REDUCED);
  query.addEventListener("change", listener);
  return () => query.removeEventListener("change", listener);
};

// The game's board fills the LCD: 16 x 14 cells of 4 figure units.
const CELL = 4;
const LCD_X = 24;
const KEYS: Record<string, Dir> = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right" };
const P = site.pocket;

export function Handheld() {
  const router = useRouter();
  const [s, dispatch] = useReducer(pad, MENU.length, newPad);
  useTick(s.pressed !== null, dispatch);
  const item = MENU[s.cursor];
  const lit = (button: Button) => (s.pressed === button ? "fig-lamp" : "fig-dark");
  const menuRef = useRef<SVGGElement>(null);
  const chime = useRef(false);
  // B's game (lib/snake.ts). The server and the first render hold a still, unseeded board that never shows;
  // B deals a seeded one.
  const [g, dispatchGame] = useReducer(snake, 0, newSnake);
  // the achievement, once unlocked, stays
  const [unlocked, unlock] = useReducer(() => true, false);
  const code = useRef(0);
  const reduced = useSyncExternalStore(onReducedChange, () => matchMedia(REDUCED).matches, () => false);
  const lcdRef = useRef<SVGRectElement>(null);
  const [onscreen, setOnscreen] = useState(true);
  // On its own clock only while it is played, seen and motion is allowed; reduced motion moves a cell an arrow.
  useTick(s.game === true && g.status === "playing" && onscreen && !reduced, dispatchGame);

  // The game holds still while the console is scrolled away or the page is hidden.
  useEffect(() => {
    const el = lcdRef.current;
    if (!el || !s.game) return;
    let seen = true;
    const update = () => setOnscreen(seen && !document.hidden);
    const view = new IntersectionObserver(([entry]) => {
      seen = entry.isIntersecting;
      update();
    });
    view.observe(el);
    document.addEventListener("visibilitychange", update);
    return () => {
      view.disconnect();
      document.removeEventListener("visibilitychange", update);
    };
  }, [s.game]);

  // The best score and the pocket's achievement come back from storage after hydration; blocked or garbled
  // storage is a first visit. The footer's end:achievement is its own.
  useEffect(() => {
    try {
      dispatchGame({ type: "best", best: parseHigh(localStorage.getItem(HIGH_KEY)) });
      if (parseAchievement(localStorage.getItem(ACHIEVEMENT_KEY))) {
        unlock();
        dispatchGame({ type: "wrap", on: true });
      }
    } catch {
      // storage blocked: scores last this visit
    }
  }, []);
  useEffect(() => {
    if (g.best <= 0) return;
    try {
      localStorage.setItem(HIGH_KEY, String(g.best));
    } catch {
      // storage blocked
    }
  }, [g.best]);
  useEffect(() => {
    if (!unlocked) return;
    try {
      localStorage.setItem(ACHIEVEMENT_KEY, "1");
    } catch {
      // storage blocked
    }
  }, [unlocked]);

  // A record eaten and a crash beep (if the speaker is on); the steering beeps on the press itself.
  useEffect(() => {
    if (g.cue === "eat") play("eat");
    else if (g.cue === "burst") play("burst");
  }, [g]);

  // The console boots once a session (lib/boot.ts). The root layout's script has already marked a returning
  // visit, whose parts rest booted from the first paint. Otherwise the boot is marked done when the menu's
  // step finishes, so a reload or a return to Home skips it; it is cancelled (and plays again next time) only
  // if Home goes away before then. Reduced motion has no boot (globals.css), from the start or turned on
  // midway, and counts as booted.
  useEffect(() => {
    if (booted(root())) return;
    const reduced = matchMedia(REDUCED);
    chime.current = chimeAllowed({
      booted: false,
      reduced: reduced.matches,
      activated: navigator.userActivation?.hasBeenActive === true,
    });
    const run = menuRef.current?.getAnimations?.()[0];
    if (!run || reduced.matches) return finishBoot(root(), session);
    let live = true;
    const done = () => {
      if (live) skipBoot();
    };
    run.finished.then(done, () => {});
    reduced.addEventListener("change", done);
    return () => {
      live = false;
      chime.current = false;
      reduced.removeEventListener("change", done);
    };
  }, []);

  // Pressing anything on the console during its boot ends the boot: the menu shows at once.
  function skipBoot() {
    chime.current = false;
    if (!booted(root())) finishBoot(root(), session);
  }

  // Only the console beeps, and only once the masthead's speaker is on.
  function move(button: "up" | "down") {
    skipBoot();
    dispatch(button);
    play("move");
  }

  function open() {
    skipBoot();
    dispatch("a");
    play("open");
    // let the press show first, unless motion is reduced
    const wait = matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 180;
    setTimeout(() => router.push(item.href), wait);
  }

  // B: into the game, a fresh seeded board each time, or back to the menu, the cursor where it was.
  function swap() {
    code.current = 0;
    if (!s.game) dispatchGame({ type: "new", seed: Math.floor(Math.random() * 2 ** 32) });
    dispatch("b");
    play(s.game ? "back" : "open");
  }

  // In the game, A starts the board or deals a new one, and the d-pad steers: under reduced motion each
  // press moves the train one cell, with no clock.
  function startGame() {
    dispatch("a");
    play("open");
    dispatchGame(g.status === "ready" ? "start" : "restart");
  }
  function steer(dir: Dir) {
    dispatch(dir);
    play("move");
    dispatchGame(reduced ? { type: "step", dir } : { type: "dir", dir });
  }

  // Every console input, from a key or a chip. In the game it is matched against the console's own code
  // first: the code's B and A are taken by the code (no menu, no restart), and the full code switches
  // debug mode (walls wrap) and keeps the achievement.
  function input(key: PocketKey) {
    skipBoot();
    if (!s.game) {
      if (key === "b") swap();
      else if (key === "a") open();
      else if (key === "up" || key === "down") move(key);
      return;
    }
    const progress = codeStep(code.current, key);
    code.current = progress === CODE.length ? 0 : progress;
    if (progress === CODE.length) {
      unlock();
      dispatchGame({ type: "wrap", on: !g.wrap });
      play("chime");
    } else if (key === "b" && progress === CODE.length - 1) {
      play("move");
    } else if (key === "b") swap();
    else if (key === "a") startGame();
    else steer(key);
  }

  // The keys work the console from anywhere on the page, except in a form field or with a modifier, and
  // only while it is on screen at the top. Arrows, A and Enter always; B for the game, and the other two
  // arrows and Escape inside it. The listener runs in the capture phase and marks what it takes, so the
  // footer's own Konami listener (which skips handled keys) never counts console input.
  const onKey = useEffectEvent((event: KeyboardEvent) => {
    if (event.metaKey || event.ctrlKey || event.altKey || event.defaultPrevented) return;
    const target = event.target instanceof Element ? event.target : null;
    if (
      target?.closest("input, textarea, select, [contenteditable]:not([contenteditable='false'])") ||
      (target instanceof HTMLElement && target.isContentEditable)
    )
      return;
    // ponytail: the console has the arrows only at the top of the page;
    // scrolled down at all, they scroll it again
    if (scrollY > 0) return;
    const console_ = menuRef.current?.closest("section");
    if (console_ && typeof console_.checkVisibility === "function" && !console_.checkVisibility()) return;
    const dir = KEYS[event.key];
    const k = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    let key: PocketKey | null = null;
    if (dir && (s.game || dir === "up" || dir === "down")) key = dir;
    else if (k === "a" || (k === "Enter" && !target?.closest("a, button"))) key = "a";
    else if (k === "b" || (k === "Escape" && s.game)) key = "b";
    if (!key || ((key === "a" || key === "b") && event.repeat)) return;
    event.preventDefault();
    input(key);
  });
  useEffect(() => {
    const listener = (event: KeyboardEvent) => onKey(event);
    window.addEventListener("keydown", listener, { capture: true });
    return () => window.removeEventListener("keydown", listener, { capture: true });
  }, []);

  const best = Math.max(g.best, g.score);
  const readout = !s.game
    ? `Press A to open ${item.label.toLowerCase()}.`
    : `${g.wrap ? `${P.wrap} ` : ""}${
        g.status === "ready"
          ? P.ready(best, reduced)
          : g.status === "playing"
            ? P.playing(g.score, best)
            : g.status === "won"
              ? P.full(g.score)
              : P.lost(g.score, best)
      }`;
  const [foodX, foodY] = g.food === null ? [0, 0] : xy(g.food);
  const banner =
    g.status === "ready" ? [P.title, P.pressA] : g.status === "over" ? [P.over, P.pressA] : g.status === "won" ? [P.won, P.pressA] : null;

  return (
    <Machine
      label="Pocket console"
      caption="Handheld"
      colour="blue"
      viewBox="0 0 230 310"
      busy={s.pressed !== null || (s.game === true && g.status === "playing")}
      tilt
      readout={readout}
      below={
        // The menu as plain links, for screen readers; they show when tabbed to.
        <nav aria-label="Pages" className="sr-only focus-within:not-sr-only">
          <ul className="flex flex-wrap justify-center gap-2 pb-3">
            {MENU.map(({ label, href }) => (
              <li key={href}>
                <Link href={href} className="btn btn-sm">
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      }
      controls={
        <>
          <Chip onClick={() => input("up")}>▲ Up</Chip>
          <Chip onClick={() => input("down")}>▼ Down</Chip>
          {s.game ? (
            <>
              <Chip onClick={() => input("left")}>{P.left}</Chip>
              <Chip onClick={() => input("right")}>{P.right}</Chip>
              <Chip onClick={() => input("a")}>{g.status === "ready" ? P.start : P.restart}</Chip>
            </>
          ) : (
            <Chip onClick={() => input("a")}>A Open</Chip>
          )}
          <Chip onClick={() => input("b")} aria-pressed={s.game === true}>
            {s.game ? P.menu : P.play}
          </Chip>
        </>
      }
    >
      <polygon className="fig-shade" points={body.shadow} />
      {/* The boot, once a session (lib/boot.ts; .boot-* in globals.css): the cartridge clicks in, the power
          light comes on, the screen flickers up, a scan line runs down it, the name types out, then the menu. */}
      <g className="boot-cart" style={{ "--fig": "#a39e93", ...bootStyle("cart") } as React.CSSProperties}>
        <polygon className="fig-shaded" points={cartridge.shaded} />
        <polygon className="fig-lit" points={cartridge.lit} />
        <polygon className="fig-top" points={cartridge.top} />
      </g>
      <polygon className="fig-top" points={body.top} />
      <polygon className="fig-shaded" points={body.shaded} />
      <polygon className="fig-lit" points={body.lit} />
      <g transform={body.onShaded}>
        <path d="M8 -120h8M8 -112h8M8 -104h8" fill="none" strokeWidth={1.6} />
      </g>
      <g transform={body.onLit}>
        <rect x={10} y={-166} width={92} height={74} rx={4} className="fig-dark" />
        <circle cx={17} cy={-140} r={2.4} className="fig-lamp boot-lamp" style={bootStyle("lamp")} />
        <rect
          ref={lcdRef}
          x={24}
          y={LCD.y}
          width={64}
          height={LCD.h}
          rx={1.5}
          className="fig-lcd boot-lcd"
          style={bootStyle("lcd")}
        />
        <rect x={24} y={LCD.y} width={64} height={2} className="boot-scan" stroke="none" style={bootStyle("scan")} />
        <g className="splash" style={splashStyle()}>
          <text
            x={56}
            y={-127}
            textAnchor="middle"
            className="fig-text lcd boot-print"
            style={bootStyle("print")}
            onAnimationStart={() => {
              if (!chime.current) return;
              chime.current = false;
              play("chime");
            }}
          >
            OTOHIME
          </text>
        </g>
        <g ref={menuRef} className="boot" style={bootStyle("menu")} visibility={s.game ? "hidden" : undefined}>
          {MENU.map(({ label }, i) => (
            <text key={label} x={40} y={menuBaseline(i)} className="fig-text lcd">
              {label.toUpperCase()}
            </text>
          ))}
          <polygon
            points={`29,${menuBaseline(s.cursor) - 7} 35,${menuBaseline(s.cursor) - 3.5} 29,${menuBaseline(s.cursor)}`}
            className="lcd lcd-cursor"
            stroke="none"
          />
        </g>
        {s.game ? (
          // At most one rect a cell: the board bounds the work.
          <g
            className="pocket-game"
            data-status={g.status}
            data-score={g.score}
            data-best={best}
            data-steps={g.steps}
            data-head={g.body[0]}
            data-food={g.food ?? ""}
            data-length={g.body.length}
            data-wrap={g.wrap || undefined}
          >
            {g.food === null ? null : (
              <rect
                x={LCD_X + foodX * CELL + 0.9}
                y={LCD.y + foodY * CELL + 0.9}
                width={CELL - 1.8}
                height={CELL - 1.8}
                className="pocket-food"
              />
            )}
            {g.body.map((c, i) => {
              const [x, y] = xy(c);
              return (
                <rect
                  key={i}
                  x={LCD_X + x * CELL + 0.3}
                  y={LCD.y + y * CELL + 0.3}
                  width={CELL - 0.6}
                  height={CELL - 0.6}
                  className="lcd"
                  stroke="none"
                />
              );
            })}
            {banner ? (
              <>
                <rect x={30} y={-142} width={52} height={25} rx={1} className="fig-lcd" stroke="none" opacity={0.85} />
                {banner.map((line, i) => (
                  <text key={line} x={56} y={-132 + i * 10} textAnchor="middle" className="fig-text lcd">
                    {line}
                  </text>
                ))}
              </>
            ) : null}
          </g>
        ) : null}
        <text x={12} y={-80} className="fig-text" style={{ fontSize: 7 }} data-pocket-achievement={unlocked || undefined}>
          POCKET
          {unlocked ? (
            <tspan dx={3} className="pocket-badge">
              {P.badge}
            </tspan>
          ) : null}
        </text>
        {/* d-pad: the pressed arm lights up */}
        <rect x={16} y={-57} width={28} height={10} rx={1.5} className="fig-dark" />
        <rect x={25} y={-66} width={10} height={28} rx={1.5} className="fig-dark" />
        <rect x={26.5} y={-64.5} width={7} height={8} className={lit("up")} stroke="none" />
        <rect x={26.5} y={-47.5} width={7} height={8} className={lit("down")} stroke="none" />
        <rect x={17.5} y={-55.5} width={8} height={7} className={lit("left")} stroke="none" />
        <rect x={34.5} y={-55.5} width={8} height={7} className={lit("right")} stroke="none" />
        {/* B and A, start and select, the speaker */}
        <circle cx={72} cy={-46} r={7.5} className={lit("b")} />
        <circle cx={90} cy={-58} r={7.5} className={lit("a")} />
        <path d="M40 -18l10 -4M56 -18l10 -4" fill="none" strokeWidth={4} />
        <path d="M80 -6l12 -16M86 -6l12 -16M92 -6l12 -16" fill="none" strokeWidth={2} />
      </g>
    </Machine>
  );
}
