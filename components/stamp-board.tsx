"use client";

import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import {
  advance,
  awake,
  drag,
  grab,
  homeError,
  makeBox,
  makeWorld,
  MAX_MARKS,
  nudge,
  release,
  resize,
  startTidy,
  tossVelocity,
  type Box,
  type Mark,
  type World,
} from "@/lib/stamps";

// The rubber-stamp board: the letters of a StampHeading as loose blocks in a tray that grows under the heading.
// Each glyph is measured with a Range over the heading's text node; its centre is the block's home and its box,
// scaled up to a size a finger can hold, the block. The solver (lib/stamps.ts) moves them; this file draws its
// poses straight onto the blocks' transforms, one frame loop that stops when everything sleeps. Landings leave
// ink on a canvas under the blocks. Under reduced motion there is no loop at all: the blocks lie where they are
// put, a drop stamps where it lands, and Tidy snaps.

// Loose blocks are at least this tall, in px.
const BLOCK_HEIGHT = 48;
// The strip under the tray's floor that holds the Tidy chip.
const FOOT = 44;
// Tidy runs at least as long as the marks take to fade.
const FADE_MS = 300;
const NUDGE = 8;
// Lifted this far when Space picks a block up.
const LIFT = 40;

type Glyph = { char: string; w: number; h: number };
type Ink = { family: string; weight: string; size: number; color: string };
type State = "falling" | "settled" | "tidying" | "static";

const rand = (seed: number) => () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 2 ** 32;
};

// The text node of the heading's words and a box per letter, in tray coordinates.
function measure(root: HTMLElement): { glyphs: Glyph[]; homes: { x: number; y: number }[]; ink: Ink } {
  const text = root.querySelector(".stamp-text");
  const node = text?.firstChild;
  const glyphs: Glyph[] = [];
  const homes: { x: number; y: number }[] = [];
  const style = getComputedStyle(text ?? root);
  const ink = { family: style.fontFamily, weight: style.fontWeight, size: parseFloat(style.fontSize), color: style.color };
  if (!node || node.nodeType !== Node.TEXT_NODE) return { glyphs, homes, ink };
  const origin = root.getBoundingClientRect();
  const range = document.createRange();
  const value = node.textContent ?? "";
  for (let i = 0; i < value.length; i++) {
    if (/\s/.test(value[i])) continue;
    range.setStart(node, i);
    range.setEnd(node, i + 1);
    const r = range.getBoundingClientRect();
    glyphs.push({ char: value[i], w: r.width, h: r.height });
    homes.push({ x: r.left + r.width / 2 - origin.left, y: r.top + r.height / 2 - origin.top });
  }
  return { glyphs, homes, ink };
}

// Where the loose blocks start: a row over the heading's middle, near the top of the tray, a little askew.
function spawn(world: World, homes: { x: number; y: number }[], reduced: boolean, seed: number) {
  const next = rand(seed);
  const { boxes } = world;
  const gap = 6;
  const row = boxes.reduce((s, b) => s + b.hw * 2, 0) + gap * (boxes.length - 1);
  const mid = homes.reduce((s, h) => s + h.x, 0) / Math.max(1, homes.length);
  let x = Math.max(0, Math.min(world.width - row, mid - row / 2));
  for (const b of boxes) {
    const tilt = (next() - 0.5) * (reduced ? 0.16 : 0.3);
    b.a = tilt;
    b.x = x + b.hw + (reduced ? (next() - 0.5) * 8 : 0);
    // reduced: already lying on the floor, its lowest corner touching it
    const reach = b.hh * Math.cos(tilt) + b.hw * Math.abs(Math.sin(tilt));
    b.y = reduced ? world.height - reach : Math.max(reach + 1, b.home.y);
    x += b.hw * 2 + gap;
  }
}

function drawMark(ctx: CanvasRenderingContext2D, mark: Mark, box: Box, glyph: Glyph, ink: Ink, scale: number) {
  // the same speckle every time this mark is drawn
  const next = rand(Math.floor(mark.x * 7919 + mark.y * 104729) + mark.box);
  ctx.save();
  ctx.translate(mark.x, mark.y);
  ctx.rotate(mark.a);
  ctx.fillStyle = ink.color;
  ctx.strokeStyle = ink.color;
  ctx.globalAlpha = 0.07;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(-box.hw + 2, -box.hh + 2, box.hw * 2 - 4, box.hh * 2 - 4);
  ctx.globalAlpha = 0.2;
  ctx.font = `${ink.weight} ${ink.size * scale}px ${ink.family}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(glyph.char, 0, 0);
  // the speckle of a dry stamp: bites out of the ink
  ctx.globalCompositeOperation = "destination-out";
  ctx.globalAlpha = 0.75;
  for (let i = 0; i < 70; i++) {
    ctx.beginPath();
    ctx.arc((next() - 0.5) * box.hw * 2, (next() - 0.5) * box.hh * 2, 0.4 + next() * 1.2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

type Setup = { glyphs: Glyph[]; homes: { x: number; y: number }[]; ink: Ink; scale: number };
type Els = { board: HTMLDivElement; canvas: HTMLCanvasElement; blocks: (HTMLButtonElement | null)[] };

// The live board: the world, its frame loop, the pointer and the keys. A plain object driven from effects and
// event handlers, so nothing here runs during a render.
class Board {
  world: World;
  frame = 0;
  last = 0;
  state: State;
  // when the tidy began, and each block's distance from home then
  tidyAt = 0;
  from: number[] = [];
  pointer: { id: number; box: number; dx: number; dy: number; samples: { t: number; x: number; y: number }[] } | null = null;
  held = -1;
  count = 0;
  finished = false;

  constructor(
    readonly root: HTMLElement,
    readonly els: Els,
    readonly setup: Setup,
    public reduced: boolean,
    readonly onDone: () => void,
  ) {
    const { glyphs, homes, scale } = setup;
    const boxes = glyphs.map((g, i) => makeBox({ ...homes[i], a: 0 }, g.w * scale, g.h * scale));
    this.world = makeWorld(root.clientWidth, root.clientHeight - FOOT, boxes);
    spawn(this.world, homes, reduced, Math.floor(Math.random() * 2 ** 31));
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    els.canvas.width = Math.round(root.clientWidth * dpr);
    els.canvas.height = Math.round(root.clientHeight * dpr);
    this.state = reduced ? "static" : "falling";
    this.show(this.state);
    this.paint();
    this.run();
  }

  // Each block's transform from its pose; while tidying it shrinks back to the glyph's own size.
  paint() {
    const { scale } = this.setup;
    this.world.boxes.forEach((b, i) => {
      const el = this.els.blocks[i];
      if (!el) return;
      let k = 1;
      if (this.state === "tidying" && this.from[i] > 0) {
        const left = Math.min(1, Math.hypot(b.x - b.home.x, b.y - b.home.y) / this.from[i]);
        k = 1 / scale + (1 - 1 / scale) * left;
      }
      el.style.transform = `translate(${b.x - b.hw}px, ${b.y - b.hh}px) rotate(${b.a}rad) scale(${k})`;
    });
  }

  show(state: State) {
    this.state = state;
    this.els.board.setAttribute("data-state", state);
  }

  addMarks(marks: Mark[]) {
    const { world, els, setup } = this;
    const ctx = els.canvas.getContext("2d");
    if (!ctx || marks.length === 0) return;
    // the solver keeps its own landings; a reduced-motion drop is kept here
    if (this.reduced) {
      world.marks.push(...marks);
      if (world.marks.length > MAX_MARKS) world.marks.splice(0, world.marks.length - MAX_MARKS);
    }
    const dropped = this.count + marks.length > MAX_MARKS;
    this.count = world.marks.length;
    const dpr = els.canvas.width / world.width;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // past the cap the oldest go: draw the kept ones again
    if (dropped) ctx.clearRect(0, 0, world.width, world.height + FOOT);
    for (const m of dropped ? world.marks : marks) drawMark(ctx, m, world.boxes[m.box], setup.glyphs[m.box], setup.ink, setup.scale);
    els.board.setAttribute("data-marks", String(this.count));
  }

  finish() {
    if (this.finished) return;
    this.finished = true;
    this.stop();
    this.onDone();
  }

  stop() {
    cancelAnimationFrame(this.frame);
    this.frame = 0;
  }

  tick = (t: number) => {
    const { world } = this;
    this.frame = 0;
    if (this.reduced) return;
    const dt = this.last ? (t - this.last) / 1000 : 0;
    this.last = t;
    this.addMarks(advance(world, dt));
    this.paint();
    if (this.state === "tidying") {
      if (homeError(world) <= 0.5 && performance.now() - this.tidyAt >= FADE_MS) return this.finish();
    } else this.show(awake(world) ? "falling" : "settled");
    if (awake(world)) this.frame = requestAnimationFrame(this.tick);
  };

  run() {
    if (this.reduced || this.frame || this.finished) return;
    this.last = 0;
    this.frame = requestAnimationFrame(this.tick);
  }

  tidy() {
    if (this.state === "tidying") return;
    if (this.reduced) return this.finish();
    this.pointer = null;
    this.held = -1;
    this.from = this.world.boxes.map((b) => Math.hypot(b.x - b.home.x, b.y - b.home.y));
    this.tidyAt = performance.now();
    startTidy(this.world);
    this.show("tidying");
    this.run();
  }

  // Reduced motion switched on mid-play: everything stops where it is.
  still() {
    if (this.reduced) return;
    this.reduced = true;
    this.stop();
    this.world.grab = null;
    if (this.state === "tidying") return this.finish();
    this.show("static");
  }

  // A reflow moves the homes and the tray. A hidden page (display: none) has no tray to fit.
  reflow() {
    if (this.state === "tidying" || this.root.clientWidth === 0) return;
    const m = measure(this.root);
    this.world.boxes.forEach((b, i) => {
      if (m.homes[i]) b.home = { ...m.homes[i], a: 0 };
    });
    resize(this.world, this.root.clientWidth, this.root.clientHeight - FOOT);
    this.paint();
    this.run();
  }

  toTray(e: { clientX: number; clientY: number }) {
    const r = this.root.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  // Reduced motion: a block put down where it is told, stamping the paper if it is a drop.
  place(i: number, x: number, y: number, stampIt: boolean) {
    const b = this.world.boxes[i];
    b.x = Math.max(b.hw, Math.min(this.world.width - b.hw, x));
    b.y = Math.max(b.hh, Math.min(this.world.height - b.hh, y));
    this.paint();
    if (stampIt) this.addMarks([{ box: i, x: b.x, y: b.y, a: b.a, speed: 0 }]);
  }

  down(i: number, e: PointerEvent<HTMLButtonElement>) {
    if (this.state === "tidying" || e.button !== 0 || this.pointer) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = this.toTray(e);
    const b = this.world.boxes[i];
    this.pointer = { id: e.pointerId, box: i, dx: b.x - p.x, dy: b.y - p.y, samples: [{ t: e.timeStamp / 1000, ...p }] };
    e.currentTarget.setAttribute("data-held", "");
    if (this.reduced) return;
    grab(this.world, i, p.x, p.y);
    this.show("falling");
    this.run();
  }

  move(e: PointerEvent<HTMLButtonElement>) {
    const ptr = this.pointer;
    if (!ptr || ptr.id !== e.pointerId) return;
    const p = this.toTray(e);
    ptr.samples.push({ t: e.timeStamp / 1000, ...p });
    if (ptr.samples.length > 12) ptr.samples.shift();
    if (this.reduced) this.place(ptr.box, p.x + ptr.dx, p.y + ptr.dy, false);
    else drag(this.world, p.x, p.y);
  }

  up(e: PointerEvent<HTMLButtonElement>) {
    const ptr = this.pointer;
    if (!ptr || ptr.id !== e.pointerId) return;
    this.pointer = null;
    this.els.blocks[ptr.box]?.removeAttribute("data-held");
    if (this.reduced) {
      const b = this.world.boxes[ptr.box];
      return this.place(ptr.box, b.x, b.y, true);
    }
    const toss = e.type === "pointerup" ? tossVelocity(ptr.samples) : { vx: 0, vy: 0 };
    release(this.world, toss.vx, toss.vy);
    this.run();
  }

  // Arrows nudge (or carry a picked-up block), Space picks up or drops.
  key(i: number, e: KeyboardEvent<HTMLButtonElement>) {
    if (this.state === "tidying") return;
    const { world } = this;
    const b = world.boxes[i];
    const step = e.shiftKey ? NUDGE * 3 : NUDGE;
    const arrows: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const el = e.currentTarget;
    if (e.key in arrows) {
      e.preventDefault();
      const [dx, dy] = arrows[e.key];
      if (this.reduced) this.place(i, b.x + dx, b.y + dy, false);
      else if (this.held === i && world.grab) drag(world, world.grab.tx + dx, world.grab.ty + dy);
      else nudge(world, i, dx, dy);
      this.run();
    } else if (e.key === " ") {
      e.preventDefault();
      if (this.held === i) {
        this.held = -1;
        el.removeAttribute("data-held");
        el.setAttribute("aria-pressed", "false");
        if (this.reduced) this.place(i, b.x, b.y, true);
        else {
          release(world);
          this.run();
        }
      } else if (this.held < 0) {
        this.held = i;
        el.setAttribute("data-held", "");
        el.setAttribute("aria-pressed", "true");
        if (this.reduced) return;
        grab(world, i, b.x, b.y);
        drag(world, b.x, b.y - LIFT);
        this.run();
      }
    }
  }
}

export default function StampBoard({ root, reduced, onDone }: { root: HTMLElement; reduced: boolean; onDone: () => void }) {
  const boardEl = useRef<HTMLDivElement>(null);
  const canvasEl = useRef<HTMLCanvasElement>(null);
  const tidyEl = useRef<HTMLButtonElement>(null);
  const blockEls = useRef<(HTMLButtonElement | null)[]>([]);
  const board = useRef<Board | null>(null);
  // measured once, as the board mounts: the heading is still showing its words
  const [setup] = useState<Setup>(() => {
    const m = measure(root);
    // scale the 13 px glyphs up to blocks a finger can hold
    const tallest = Math.max(1, ...m.glyphs.map((g) => g.h));
    return { ...m, scale: Math.min(4, Math.max(1, BLOCK_HEIGHT / tallest)) };
  });
  const { glyphs, ink, scale } = setup;
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  });

  // Grow the tray, build the world and lay the blocks out before the first paint; focus goes to Tidy.
  useLayoutEffect(() => {
    root.setAttribute("data-stamped", "");
    const b = new Board(
      root,
      { board: boardEl.current!, canvas: canvasEl.current!, blocks: blockEls.current },
      setup,
      reduced,
      () => done.current(),
    );
    board.current = b;
    tidyEl.current?.focus();
    return () => {
      b.stop();
      board.current = null;
      root.removeAttribute("data-stamped");
    };
  }, [root, setup, reduced]);

  // Escape anywhere tidies; a reflow moves the homes; reduced motion switched on stops the loop.
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") board.current?.tidy();
    };
    const mq = matchMedia("(prefers-reduced-motion: reduce)");
    const onMotion = () => {
      if (mq.matches) board.current?.still();
    };
    const observer = new ResizeObserver(() => board.current?.reflow());
    document.addEventListener("keydown", onKey);
    mq.addEventListener("change", onMotion);
    observer.observe(root);
    return () => {
      document.removeEventListener("keydown", onKey);
      mq.removeEventListener("change", onMotion);
      observer.disconnect();
    };
  }, [root]);

  return (
    <div ref={boardEl} className="stamp-board" data-state={reduced ? "static" : "falling"} data-marks="0">
      <canvas ref={canvasEl} className="stamp-marks" aria-hidden="true" />
      {glyphs.map((g, i) => (
        <button
          key={i}
          ref={(el) => {
            blockEls.current[i] = el;
          }}
          type="button"
          className="stamp-block"
          aria-label={`${g.char}, letter ${i + 1} of ${glyphs.length}`}
          aria-describedby="stamp-keys"
          aria-pressed="false"
          style={{ width: g.w * scale, height: g.h * scale, fontSize: ink.size * scale, fontWeight: ink.weight }}
          onPointerDown={(e) => board.current?.down(i, e)}
          onPointerMove={(e) => board.current?.move(e)}
          onPointerUp={(e) => board.current?.up(e)}
          onPointerCancel={(e) => board.current?.up(e)}
          onLostPointerCapture={(e) => board.current?.up(e)}
          onKeyDown={(e) => board.current?.key(i, e)}
        >
          <span aria-hidden="true">{g.char}</span>
        </button>
      ))}
      <div className="stamp-foot">
        <p id="stamp-keys" className="text-muted">
          <span aria-hidden="true">Letters loose. </span>
          <span className="sr-only">Arrows nudge, Space picks up or drops, Escape tidies.</span>
        </p>
        <button ref={tidyEl} type="button" className="chip" onClick={() => board.current?.tidy()}>
          Tidy
        </button>
      </div>
    </div>
  );
}
