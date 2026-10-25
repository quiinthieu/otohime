"use client";

import { Inked, swatches } from "@/components/figures";
import { Chip, Machine, Stat, type Pen } from "@/components/machine";
import type { Song } from "@/content/site";
import { air } from "@/lib/on-air";
import { useEffect, useRef, useState } from "react";

// The parts of YouTube's IFrame Player API this page uses:
// developers.google.com/youtube/iframe_api_reference
type Player = {
  cuePlaylist(videos: string[]): void;
  playVideo(): void;
  pauseVideo(): void;
  playVideoAt(index: number): void;
  getPlaylistIndex(): number;
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
const BUFFERING = 3; // still on air, between chunks

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
  error: false, // this channel's song won't play here
  playing: false,
  index: 0, // the channel, from 0
};

// A television with a song on every channel. YouTube's player is the
// screen, and the remote changes channel.
// ponytail: the music stops when you leave /music; a player in the layout
// would keep it going between pages.
export function Television({ songs, playlist }: { songs: Song[]; playlist: string }) {
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
            // Also how the set learns that a song ended and the next began.
            onStateChange: ({ target, data }) => {
              if (!live) return;
              // One sound at a time: playing here stops Ink Radio.
              if (data === PLAYING) air.claim("tv");
              else if (data !== BUFFERING) air.release("tv");
              setS((s) => ({ ...s, index: Math.max(0, target.getPlaylistIndex()), playing: data === PLAYING, error: false }));
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
    // Ink Radio starting pauses the set.
    const off = air.subscribe("tv", () => player.current?.pauseVideo());
    // Also runs when <Activity> hides the page after a navigation.
    return () => {
      live = false;
      off();
      created?.destroy();
      player.current = null;
      box.replaceChildren();
      setS(IDLE);
    };
  }, [videos]);

  // The set shows the new channel at once; YouTube's own report follows.
  function tune(index: number) {
    player.current?.playVideoAt(index);
    setS((s) => ({ ...s, index }));
  }

  const n = songs.length;
  const song = songs[s.index];
  const channel = `CH ${s.index + 1}: ${song.title}, ${song.artist}.`;
  const readout = s.failed
    ? "YouTube didn't load. The songs are on Spotify too."
    : !s.ready
      ? "Warming up…"
      : s.error
        ? "Static on this channel. Try the next one."
        : s.playing
          ? channel
          : `${channel} Press play.`;

  return (
    <>
      <Machine
        label="Television"
        caption="Remote"
        colour="coral"
        busy={s.playing}
        readout={readout}
        figure={(wobble, pen) => (
          <TVSet wobble={wobble} pen={pen} channel={s.index + 1} lamp={s.ready ? swatches[song.colour] : undefined}>
            <div ref={host} className="size-full" />
          </TVSet>
        )}
        controls={
          <>
            <Chip
              aria-disabled={!s.ready || undefined}
              aria-label={s.playing ? "Pause" : "Play"}
              onClick={() => (s.playing ? player.current?.pauseVideo() : player.current?.playVideo())}
            >
              {s.playing ? "❚❚ Pause" : "▶ Play"}
            </Chip>
            <Chip aria-disabled={!s.ready || undefined} aria-label="Channel up" onClick={() => tune((s.index + 1) % n)}>
              ▲ Ch
            </Chip>
            <Chip aria-disabled={!s.ready || undefined} aria-label="Channel down" onClick={() => tune((s.index + n - 1) % n)}>
              ▼ Ch
            </Chip>
          </>
        }
        stats={
          <>
            <Stat k="Channel" v={s.index + 1} />
            <Stat k="On air" v={song.title} small />
          </>
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
const pct = (n: number, of: number) => `${(n / of) * 100}%`;

// A hand-inked television with YouTube's player in its screen. YouTube wants
// the player at least 200px each way with nothing in front of it, so the
// screen is most of the set and the drawing stays behind it: 6:5 keeps it
// tall enough down to a 267px-wide set. The lamp takes the channel's colour
// and the first knob points at the channel.
function TVSet({
  wobble,
  pen,
  channel,
  lamp,
  children,
}: {
  wobble: number;
  pen?: Pen;
  channel: number;
  lamp?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="relative mx-auto w-full max-w-[440px]">
      <Inked viewBox={`0 0 ${SET.w} ${SET.h}`} wobble={wobble} {...pen} className="block w-full">
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
        <path d="M28 376h108M28 386h108" className="fig-belt" />
        <rect x={150} y={370} width={58} height={22} rx={2} className="fig-lcd" />
        <text x={179} y={385} textAnchor="middle" className="fig-text lcd">
          CH {channel}
        </text>
        <circle cx={284} cy={381} r={4.5} className="led" fill={lamp ?? "var(--coral)"} />
        <g transform={`rotate(${-45 + 45 * Math.min(channel - 1, 6)} 318 381)`}>
          <circle cx={318} cy={381} r={10} className="fig-top" />
          <path d="M318 381v-8" fill="none" strokeWidth={2} />
        </g>
        <circle cx={354} cy={381} r={10} className="fig-top" />
        <path d="M354 381l6 -5" fill="none" strokeWidth={2} />
      </Inked>
      <div
        className="absolute"
        style={{
          left: pct(SCREEN.x, SET.w),
          top: pct(SCREEN.y, SET.h),
          width: pct(SCREEN.w, SET.w),
          height: pct(SCREEN.h, SET.h),
        }}
      >
        {children}
      </div>
    </div>
  );
}
