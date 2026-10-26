import { RisoText } from "@/components/riso-heading";
import { swatches } from "@/components/figures";
import { site } from "@/content/site";
import { readTime, type Game, type NowPlaying, type Track } from "@/lib/now-playing-data";
import type { CSSProperties } from "react";

// Music's Now playing shelf: a paper cassette for what is on Spotify and a game cartridge for what is on Steam.
// Server-rendered from a NowPlaying reading (lib/now-playing.ts reads it). The words are ordinary HTML on a
// paper label of fixed height, so a long title wraps inside its reserved space and the page never jumps. The
// shells are unfiltered SVGs stretched to their labels (percentage lengths, like components/cartridge.tsx).
// At rest, or when a provider is off or quiet, the cassette is the playlist and the cartridge is the "Playing"
// line of site.now. The reels turn only while a track plays, never under reduced motion (globals.css).
export function NowPlayingShelf({ reading }: { reading: NowPlaying }) {
  const copy = site.nowPlaying;
  const read = reading.readAt && (reading.spotify !== "spotify-off" || reading.steam !== "steam-off");
  return (
    <section
      aria-labelledby="now-playing"
      className="now-playing mt-12"
      data-now-playing=""
      data-spotify={reading.spotify}
      data-steam={reading.steam}
    >
      <h2 id="now-playing" className="caption"><RisoText>{copy.heading}</RisoText></h2>
      <div className="now-playing-shelf mt-6">
        <Cassette track={reading.track} />
        <GameCart game={reading.game} />
      </div>
      <p className="mt-4 text-[12px] text-muted" data-now-playing-credit="">
        {read && reading.readAt ? (
          <>
            {copy.read} <time dateTime={reading.readAt}>{readTime(reading.readAt)}</time>.
          </>
        ) : (
          copy.unread
        )}{" "}
        <a href="https://www.spotify.com" className="underline" target="_blank" rel="noreferrer">
          {copy.credit.spotify}
        </a>
        ,{" "}
        <a href="https://store.steampowered.com" className="underline" target="_blank" rel="noreferrer">
          {copy.credit.steam}
        </a>
        .
      </p>
    </section>
  );
}

function Cassette({ track }: { track: Track | null }) {
  const copy = site.nowPlaying;
  const playlist = `https://open.spotify.com/playlist/${site.playlist}`;
  return (
    <figure
      className="tape"
      data-face={track ? "track" : "quiet"}
      data-spin={track?.playing ? "" : undefined}
      style={{ "--fig": swatches.pink } as CSSProperties}
    >
      <TapeShell />
      <figcaption className="np-label tape-label">
        <span className="np-side">{copy.tape}</span>
        <span className="np-status" data-label="status">
          {track ? (track.playing ? copy.playing : copy.paused) : copy.quiet}
        </span>
        <span className="np-title" data-label="title">
          {track ? track.title : copy.quietTape}
        </span>
        <span className="np-sub" data-label="sub">
          {track ? track.artists : copy.quietTapeNote}
        </span>
        <a className="np-link" href={track?.url ?? playlist} target="_blank" rel="noreferrer">
          {track?.url ? copy.track : copy.playlist} <span aria-hidden="true">→</span>
        </a>
      </figcaption>
      <Reels />
    </figure>
  );
}

function GameCart({ game }: { game: Game | null }) {
  const copy = site.nowPlaying;
  const playing = site.now.find((n) => n.what === "Playing")?.note ?? "";
  return (
    <figure
      className="game-cart"
      data-face={game ? "game" : "quiet"}
      style={{ "--fig": swatches.mint } as CSSProperties}
    >
      <CartShell />
      <figcaption className="np-label game-label">
        <span className="np-side">{copy.cart}</span>
        <span className="np-status" data-label="status">
          {game ? copy.inGame : copy.quiet}
        </span>
        <span className="np-title" data-label="game">
          {game ? game.title : playing}
        </span>
        {game ? (
          game.url ? (
            <a className="np-link" href={game.url} target="_blank" rel="noreferrer">
              {copy.game} <span aria-hidden="true">→</span>
            </a>
          ) : null
        ) : (
          <span className="np-sub" data-label="sub">
            {copy.quietGame}
          </span>
        )}
      </figcaption>
    </figure>
  );
}

// The cassette's shell: shadow, body, four screws and the head opening at the bottom.
function TapeShell() {
  return (
    <svg className="np-shell" aria-hidden="true" focusable="false" overflow="visible">
      <rect className="np-shadow" x="5" y="5" width="100%" height="100%" rx="12" />
      <rect className="np-body" width="100%" height="100%" rx="12" />
      <circle className="np-screw" cx="9" cy="9" r="2.5" />
      <svg x="100%" overflow="visible">
        <circle className="np-screw" cx="-9" cy="9" r="2.5" />
      </svg>
      <svg y="100%" overflow="visible">
        <circle className="np-screw" cx="9" cy="-9" r="2.5" />
      </svg>
      <svg x="100%" y="100%" overflow="visible">
        <circle className="np-screw" cx="-9" cy="-9" r="2.5" />
      </svg>
      <svg x="50%" y="100%" overflow="visible">
        <path className="np-head" d="M -70 0 L -58 -14 H 58 L 70 0" />
        <circle className="np-hole" cx="-34" cy="-7" r="3" />
        <circle className="np-hole" cx="34" cy="-7" r="3" />
      </svg>
    </svg>
  );
}

// The window: two reels of tape, each with a toothed hub, and the band between them.
function Reels() {
  return (
    <svg className="tape-reels" viewBox="0 0 240 64" aria-hidden="true" focusable="false">
      <rect className="tape-window" x="40" y="5" width="160" height="54" rx="27" />
      <path className="tape-band" d="M 84 54 H 156" />
      {[84, 156].map((cx) => (
        <g key={cx} transform={`translate(${cx} 32)`}>
          <circle className="tape-spool" r="21" />
          <g className="reel">
            <circle className="tape-hub" r="11" />
            <path className="tape-teeth" d="M 0 -11 V -5 M 9.5 5.5 L 4.3 2.5 M -9.5 5.5 L -4.3 2.5" />
          </g>
        </g>
      ))}
    </svg>
  );
}

// The game cartridge's shell, a smaller cousin of the project cartridges: ridges, a clipped corner, the connector.
function CartShell() {
  return (
    <svg className="np-shell" aria-hidden="true" focusable="false" overflow="visible">
      <rect className="np-shadow" x="5" y="5" width="100%" height="100%" rx="7" />
      <rect className="np-body" width="100%" height="100%" rx="7" />
      <g className="np-ridges">
        <line x1="12" x2="30%" y1="8" y2="8" />
        <line x1="12" x2="30%" y1="12" y2="12" />
        <line x1="12" x2="30%" y1="16" y2="16" />
      </g>
      <svg x="100%" overflow="visible">
        <path className="np-cut" d="M -16 -2 L 2 -2 L 2 16 Z" />
        <path d="M -16 0 L 0 16" />
      </svg>
      <svg x="50%" y="100%" overflow="visible">
        <rect className="np-notch" x="-22" y="-7" width="44" height="7" rx="1.5" />
        <path className="np-pins" d="M -16 -5 V -1 M -10 -5 V -1 M -4 -5 V -1 M 2 -5 V -1 M 8 -5 V -1 M 14 -5 V -1" />
      </svg>
    </svg>
  );
}
