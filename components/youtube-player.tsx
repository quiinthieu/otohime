"use client";

import { CassetteDeck } from "@/components/cassette-deck";
import { Inked, swatches } from "@/components/figures";
import type { Song } from "@/content/site";
import { useEffect, useRef, useState } from "react";

// The parts of YouTube's IFrame Player API this page uses:
// developers.google.com/youtube/iframe_api_reference
type Player = {
  cuePlaylist(videos: string[]): void;
  playVideo(): void;
  pauseVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  previousVideo(): void;
  nextVideo(): void;
  getPlaylistIndex(): number;
  getCurrentTime(): number; // seconds
  getDuration(): number; // seconds
  getIframe(): HTMLIFrameElement;
  destroy(): void;
};
type PlayerEvent = { target: Player; data: number };
type YT = {
  Player: new (
    element: HTMLElement,
    options: {
      width: string;
      height: string;
      playerVars: Record<string, string | number>;
      events: Record<"onReady" | "onStateChange" | "onError", (event: PlayerEvent) => void>;
    },
  ) => Player;
};

declare global {
  interface Window {
    YT?: YT;
    onYouTubeIframeAPIReady?: () => void;
  }
}

const PLAYING = 1; // YT.PlayerState.PLAYING

// YouTube calls a global function once its API has loaded, so the promise is
// kept for later visits to /music.
let api: Promise<YT> | undefined;
function iframeApi() {
  api ??= new Promise((resolve, reject) => {
    window.onYouTubeIframeAPIReady = () => resolve(window.YT!);
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.onerror = () => {
      script.remove();
      api = undefined; // the next visit tries again
      reject(new Error("YouTube's player API didn't load"));
    };
    document.body.append(script);
  });
  return api;
}

const IDLE = {
  ready: false,
  failed: false, // the API didn't load
  error: false, // the current song won't play here
  playing: false,
  index: 0,
  position: 0, // ms
  duration: 0, // ms
};

// The player sends no time updates, so the deck reads them.
const playhead = (p: Player) => ({
  index: Math.max(0, p.getPlaylistIndex()),
  position: p.getCurrentTime() * 1000,
  duration: p.getDuration() * 1000,
});

// YouTube plays the songs in a hand-drawn TV; the tape deck above drives it.
// ponytail: the music stops when you leave /music; a player in the layout
// would keep it going between pages.
export function YouTubePlayer({ songs, playlist }: { songs: Song[]; playlist: string }) {
  const host = useRef<HTMLDivElement>(null);
  const player = useRef<Player | null>(null);
  const [s, setS] = useState(IDLE);
  const videos = songs.map((song) => song.video).join(",");

  useEffect(() => {
    const box = host.current;
    if (!box) return;
    // YouTube swaps this node for its iframe, so React never renders into it.
    const slot = document.createElement("div");
    box.append(slot);
    let live = true;
    let created: Player | undefined;
    iframeApi().then(
      (YT) => {
        if (!live) return;
        created = new YT.Player(slot, {
          width: "100%",
          height: "100%",
          playerVars: { playsinline: 1, rel: 0, origin: location.origin },
          events: {
            onReady: ({ target }) => {
              if (!live) return;
              target.cuePlaylist(videos.split(","));
              player.current = target;
              setS((s) => ({ ...s, ready: true }));
            },
            onStateChange: ({ target, data }) => {
              if (live) setS((s) => ({ ...s, ...playhead(target), playing: data === PLAYING, error: false }));
            },
            onError: () => {
              if (live) setS((s) => ({ ...s, playing: false, error: true }));
            },
          },
        });
      },
      () => {
        if (live) setS((s) => ({ ...s, failed: true }));
      },
    );
    // Also runs when <Activity> hides the page after a navigation.
    return () => {
      live = false;
      created?.destroy();
      player.current = null;
      box.replaceChildren();
      setS(IDLE);
    };
  }, [videos]);

  useEffect(() => {
    if (!s.playing) return;
    const id = setInterval(() => {
      const p = player.current;
      if (p) setS((s) => ({ ...s, ...playhead(p) }));
    }, 500);
    return () => clearInterval(id);
  }, [s.playing]);

  // Moves land straight on the deck, even while paused. A seek returns
  // where it went, because the player reports a seek late.
  function act(move: (p: Player) => number | void) {
    const p = player.current;
    if (!p) return;
    const to = move(p);
    setS((s) => ({ ...s, ...playhead(p), ...(typeof to === "number" && { position: to * 1000 }) }));
  }

  const song = s.ready ? songs[s.index] : undefined;
  const readout = s.failed
    ? "YouTube didn't load. The playlist is on Spotify too."
    : !s.ready
      ? "Loading the tape…"
      : s.error
        ? "That song won't play here. Try the next one."
        : s.playing
          ? `Playing ${song?.title ?? "the tape"}.`
          : s.position > 0
            ? "Paused."
            : "Press play.";

  return (
    <>
      <CassetteDeck
        ready={s.ready}
        playing={s.playing}
        position={s.position}
        duration={s.duration}
        title={song?.title}
        label={song ? swatches[song.colour] : undefined}
        readout={readout}
        onToggle={() => act((p) => (s.playing ? p.pauseVideo() : p.playVideo()))}
        onStop={() => {
          // seekTo leaves a paused player paused but starts any other, so an
          // untouched tape stays put
          if (!s.playing && s.position === 0) return;
          act((p) => {
            p.pauseVideo();
            p.seekTo(0, true);
            return 0;
          });
        }}
        onSeek={(seconds) =>
          act((p) => {
            const to = Math.max(0, p.getCurrentTime() + seconds);
            p.seekTo(to, true);
            return to;
          })
        }
        onPrev={() => act((p) => p.previousVideo())}
        onNext={() => act((p) => p.nextVideo())}
        below={
          <Television busy={s.playing} hidden={s.failed}>
            <div ref={host} className="size-full" />
          </Television>
        }
      />
      <p className="mt-6">
        <a href={`https://open.spotify.com/playlist/${playlist}`} className="btn" target="_blank" rel="noreferrer">
          The playlist on Spotify <span aria-hidden="true">→</span>
        </a>
      </p>
    </>
  );
}

// The set, face on, in a 400 × 424 drawing; the player fills its screen.
const SET = { w: 400, h: 424 };
const SCREEN = { x: 20, y: 60, w: 360, h: 300 };
const EARS = ["M200 40 136 8", "M200 40 264 8"];

// A hand-inked television with YouTube's player in its screen. YouTube wants
// the player at least 200px each way with nothing in front of it, so the
// screen is most of the set and the drawing stays behind it: 6:5 keeps it
// tall enough down to a 267px-wide set.
function Television({ busy, hidden, children }: { busy: boolean; hidden: boolean; children: React.ReactNode }) {
  return (
    <div className={hidden ? "hidden" : "relative mx-auto my-4 w-full max-w-[440px]"} data-busy={busy || undefined}>
      <Inked viewBox={`0 0 ${SET.w} ${SET.h}`} className="block w-full">
        <ellipse cx={200} cy={410} rx={180} ry={10} className="fig-shade" />
        <rect x={52} y={392} width={18} height={16} rx={3} className="fig-shaded" />
        <rect x={330} y={392} width={18} height={16} rx={3} className="fig-shaded" />
        {/* rabbit ears, steel with an ink edge so they show on dark paper */}
        {EARS.map((d) => (
          <g key={d}>
            <path d={d} fill="none" strokeWidth={6} />
            <path d={d} fill="none" className="fig-metal" strokeWidth={2.6} />
          </g>
        ))}
        <circle cx={136} cy={8} r={5} className="fig-paper" />
        <circle cx={264} cy={8} r={5} className="fig-paper" />
        <path d="M170 45a30 16 0 0 1 60 0z" className="fig-top" />
        {/* the cabinet, the screen's dark rim, and the panel under it */}
        <rect x={4} y={44} width={392} height={352} rx={30} className="fig-lit" />
        <rect x={SCREEN.x - 6} y={SCREEN.y - 6} width={SCREEN.w + 12} height={SCREEN.h + 12} rx={18} className="fig-dark" />
        <path d="M28 376h150M28 386h150" className="fig-belt" />
        <circle cx={284} cy={381} r={3.6} className="fig-lamp" />
        <circle cx={318} cy={381} r={10} className="fig-top" />
        <path d="M318 381v-8" fill="none" strokeWidth={2} />
        <circle cx={354} cy={381} r={10} className="fig-top" />
        <path d="M354 381l6 -5" fill="none" strokeWidth={2} />
      </Inked>
      <div
        className="absolute"
        style={{
          left: `${(SCREEN.x / SET.w) * 100}%`,
          top: `${(SCREEN.y / SET.h) * 100}%`,
          width: `${(SCREEN.w / SET.w) * 100}%`,
          height: `${(SCREEN.h / SET.h) * 100}%`,
        }}
      >
        {children}
      </div>
    </div>
  );
}
