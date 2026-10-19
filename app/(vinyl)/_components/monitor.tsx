import type { Ref } from "react";
import type { Phase } from "../_lib/deck.ts";
import { watchUrl, type VinylRecord } from "../_lib/records.ts";

// The retro monitor: a bezel drawn as padding *around* the YouTube player and
// a chin under it. Nothing is ever in front of the player. The placeholder
// shares the screen's grid cell but sits behind the host (z-index), and it is
// gone once the iframe exists; error and tap notes live in the chin, beside
// the player. The host's box is reserved from the first paint, so the player
// arrives without a layout shift. React renders no children into the host:
// YouTube replaces the node vinyl-app.tsx puts there with its iframe.
export function Monitor({
  record,
  phase,
  error,
  failed,
  hasPlayer,
  hostRef,
  onSkip,
  onRetry,
}: {
  record: VinylRecord | null;
  phase: Phase;
  error: string | null;
  failed: boolean;
  hasPlayer: boolean;
  hostRef: Ref<HTMLDivElement>;
  onSkip: () => void;
  onRetry: () => void;
}) {
  return (
    <section className="monitor" data-monitor="" aria-label="YouTube player">
      <div className="bezel">
        <div className="screen">
          {!hasPlayer && (
            <p className="screen-idle">{record ? (failed ? "YouTube didn't load" : "Loading the player…") : "Pick a record to load the player"}</p>
          )}
          <div className="player-host" data-player-host="" ref={hostRef} />
        </div>
      </div>
      <div className="chin">
        <span className="knob" aria-hidden="true" />
        <div className="note">
          {phase === "error" && record ? (
            <>
              <p>{error}</p>
              <p className="note-actions">
                <button type="button" onClick={onSkip}>
                  Skip
                </button>
                <a href={watchUrl(record)} target="_blank" rel="noopener">
                  Watch on YouTube
                </a>
              </p>
            </>
          ) : phase === "tap" ? (
            <p>Tap the video to play</p>
          ) : failed && record ? (
            <p className="note-actions">
              <span>YouTube&apos;s player didn&apos;t load.</span>
              <button type="button" onClick={onRetry}>
                Try again
              </button>
            </p>
          ) : record ? (
            <p>
              <a href={watchUrl(record)} target="_blank" rel="noopener" aria-label={`Watch on YouTube: ${record.title}`}>
                Watch on YouTube
              </a>
            </p>
          ) : (
            <p>The video plays here, in YouTube&apos;s own player.</p>
          )}
        </div>
        <span className="knob" aria-hidden="true" />
      </div>
    </section>
  );
}
