import { clock } from "../_lib/deck.ts";

// The transport: one play/pause toggle, stop, previous, next, eject, volume
// and a seek bar. Each control is disabled while it would do nothing.
export function Transport({
  hasRecord,
  canPlay,
  active,
  canStop,
  time,
  duration,
  volume,
  onToggle,
  onStop,
  onPrev,
  onNext,
  onEject,
  onSeek,
  onVolume,
}: {
  hasRecord: boolean;
  canPlay: boolean;
  active: boolean; // playing, or on its way to it
  canStop: boolean;
  time: number;
  duration: number;
  volume: number;
  onToggle: () => void;
  onStop: () => void;
  onPrev: () => void;
  onNext: () => void;
  onEject: () => void;
  onSeek: (seconds: number) => void;
  onVolume: (value: number) => void;
}) {
  const seekable = hasRecord && duration > 0;
  return (
    <section className="transport" aria-label="Transport">
      <div className="buttons">
        <button type="button" onClick={onPrev} disabled={!hasRecord} aria-label="Previous record" title="Previous record (←)">
          <span aria-hidden="true">⏮</span>
        </button>
        <button
          type="button"
          className="toggle"
          onClick={onToggle}
          disabled={!active && !canPlay}
          aria-label="Play"
          aria-pressed={active}
          title={active ? "Pause (Space)" : "Play (Space)"}
        >
          <span aria-hidden="true">{active ? "⏸" : "▶"}</span>
        </button>
        <button type="button" onClick={onStop} disabled={!canStop} aria-label="Stop" title="Stop">
          <span aria-hidden="true">⏹</span>
        </button>
        <button type="button" onClick={onNext} disabled={!hasRecord} aria-label="Next record" title="Next record (→)">
          <span aria-hidden="true">⏭</span>
        </button>
        <button type="button" onClick={onEject} disabled={!hasRecord} aria-label="Eject" title="Eject (Esc)">
          <span aria-hidden="true">⏏</span>
        </button>
      </div>
      <label className="seek">
        <span className="sr-only">Seek</span>
        <input
          type="range"
          min={0}
          max={seekable ? Math.floor(duration) : 0}
          step={1}
          value={seekable ? Math.min(Math.floor(time), Math.floor(duration)) : 0}
          disabled={!seekable}
          aria-valuetext={`${clock(time)} of ${clock(duration)}`}
          onChange={(e) => onSeek(Number(e.target.value))}
        />
        <span className="times" aria-hidden="true">
          {clock(time)} / {clock(duration)}
        </span>
      </label>
      <label className="volume">
        <span>Volume</span>
        <input type="range" min={0} max={100} step={1} value={volume} onChange={(e) => onVolume(Number(e.target.value))} />
      </label>
    </section>
  );
}
