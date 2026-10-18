"use client";

import { box } from "@/components/figures";
import { Chip, Machine, Stat } from "@/components/machine";
import { useEffect, useState } from "react";

// A front-loading tape deck: a cassette behind its door, a counter, a VU
// meter and piano keys. W is its depth, D the front's width.
const O: [number, number] = [212, 84];
const W = 60;
const D = 170;
const H = 68;
const body = box(O, W, D, H, [0, 0, 0], 40);

type Key = "rew" | "play" | "stop" | "ff";
// Each key is 14 × 12 and its glyph is drawn from the key's top-left corner.
const KEYS: [Key, string][] = [
  ["rew", "M7 3 3 6l4 3zM11 3 7 6l4 3z"],
  ["play", "M5 3l5 3-5 3z"],
  ["stop", "M4.5 3.5h5v5h-5z"],
  ["ff", "M3 3l4 3-4 3zM7 3l4 3-4 3z"],
];

const clock = (ms: number) => {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

// A cassette hub; its teeth turn while the deck plays (.reel in globals.css).
function Hub({ x }: { x: number }) {
  return (
    <g transform={`translate(${x} -32)`}>
      <circle r={5} className="fig-paper" strokeWidth={1.4} />
      <path d="M0 -3.5V3.5M-3.5 0H3.5" className="reel" fill="none" strokeWidth={1.4} />
    </g>
  );
}

export function CassetteDeck({
  ready,
  playing,
  position,
  duration,
  title,
  label,
  readout,
  onToggle,
  onStop,
  onSeek,
  onPrev,
  onNext,
  below,
}: {
  ready: boolean;
  playing: boolean;
  position: number; // ms into the song
  duration: number; // ms
  title?: string;
  label?: string; // the cassette label's colour
  readout: string;
  onToggle: () => void;
  onStop: () => void;
  onSeek: (seconds: number) => void;
  onPrev: () => void;
  onNext: () => void;
  below: React.ReactNode;
}) {
  // the last key pressed stays down for a moment, so the press shows
  const [pressed, setPressed] = useState<Key | null>(null);
  useEffect(() => {
    if (!pressed) return;
    const id = setTimeout(() => setPressed(null), 170);
    return () => clearTimeout(id);
  }, [pressed]);

  function act(key: Key, action: () => void) {
    if (!ready) return;
    setPressed(key);
    action();
  }

  // Tape winds from the left pack onto the right one as the song plays.
  const t = duration > 0 ? Math.min(position / duration, 1) : 0;

  return (
    <Machine
      label="Tape deck"
      caption="Deck"
      colour="coral"
      viewBox="0 0 280 220"
      busy={playing}
      readout={readout}
      controls={
        <>
          <Chip
            aria-disabled={!ready || undefined}
            aria-label={playing ? "Pause" : "Play"}
            onClick={() => act("play", onToggle)}
          >
            {playing ? "❚❚ Pause" : "▶ Play"}
          </Chip>
          <Chip aria-disabled={!ready || undefined} aria-label="Stop" onClick={() => act("stop", onStop)}>
            ■ Stop
          </Chip>
          <Chip aria-disabled={!ready || undefined} aria-label="Back 10 seconds" onClick={() => act("rew", () => onSeek(-10))}>
            ◀◀ 10s
          </Chip>
          <Chip aria-disabled={!ready || undefined} aria-label="Forward 10 seconds" onClick={() => act("ff", () => onSeek(10))}>
            ▶▶ 10s
          </Chip>
          <Chip aria-disabled={!ready || undefined} aria-label="Previous song" onClick={() => act("rew", onPrev)}>
            |◀ Prev
          </Chip>
          <Chip aria-disabled={!ready || undefined} aria-label="Next song" onClick={() => act("ff", onNext)}>
            Next ▶|
          </Chip>
        </>
      }
      stats={<Stat k="Track" v={title ?? "—"} small />}
      below={below}
    >
      <polygon className="fig-shade" points={body.shadow} />
      <polygon className="fig-top" points={body.top} />
      <polygon className="fig-shaded" points={body.shaded} />
      <polygon className="fig-lit" points={body.lit} />
      {/* vents on the lid, a speaker in the side */}
      {[16, 26, 36, 46].map((y) => (
        <polyline key={y} points={body.poly([[14, y, H], [W - 14, y, H]])} fill="none" strokeWidth={1.6} />
      ))}
      <g transform={body.onShaded}>
        <circle cx={30} cy={-34} r={20} className="fig-dark" />
        <circle cx={30} cy={-34} r={13} className="fig-belt" />
        <circle cx={30} cy={-34} r={7} className="fig-belt" />
        <circle cx={30} cy={-34} r={3} className="fig-paper" strokeWidth={1.4} />
      </g>
      <g transform={body.onLit}>
        {/* the door, and through the cassette's window the tape packs */}
        <rect x={8} y={-60} width={86} height={50} rx={3} className="fig-dark" />
        <rect x={24} y={-42} width={54} height={20} className="fig-floor" />
        <circle cx={36} cy={-32} r={7 + 9 * (1 - t)} className="fig-dark" strokeWidth={1.4} />
        <circle cx={66} cy={-32} r={7 + 9 * t} className="fig-dark" strokeWidth={1.4} />
        <Hub x={36} />
        <Hub x={66} />
        <path d="M14 -55h74v40h-74zM24 -42v20h54v-20z" className="fig-paper" fillRule="evenodd" />
        <rect x={18} y={-52} width={66} height={7} rx={1.5} className="fig-top" style={label ? { fill: label } : undefined} />
        <g className="fig-glint">
          <path d="M16 -18 30 -50M26 -16 34 -34" />
        </g>
        {/* counter and VU meter */}
        <rect x={102} y={-60} width={30} height={14} rx={1.5} className="fig-lcd" />
        <text x={117} y={-50} textAnchor="middle" className="fig-text lcd">
          {clock(position)}
        </text>
        <rect x={136} y={-60} width={26} height={14} rx={1.5} className="fig-paper" />
        <path d="M140 -50q9 -7 18 0" fill="none" strokeWidth={1} />
        <path d="M154.6 -52.4q2 1 3.4 2.4" fill="none" stroke="var(--coral)" strokeWidth={2} />
        <line x1={149} y1={-47} x2={149} y2={-57} className="needle" strokeWidth={1.2} />
        {/* piano keys: the pressed one sits lower and lights up */}
        {KEYS.map(([key, glyph], i) => {
          const down = pressed === key || (key === "play" && playing);
          return (
            <g key={key} transform={`translate(${102 + 15 * i} ${down ? -34 : -36})`}>
              <rect width={14} height={12} rx={1.5} className={down ? "fig-lamp" : "fig-dark"} />
              <path d={glyph} className="fig-paper" stroke="none" />
            </g>
          );
        })}
        <text x={102} y={-8} className="fig-text" style={{ fontSize: 7 }}>
          STEREO
        </text>
        <circle cx={157} cy={-11} r={2.4} className="fig-lamp" />
      </g>
    </Machine>
  );
}
