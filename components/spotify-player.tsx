"use client";

import { CassetteDeck } from "@/components/cassette-deck";
import { swatches } from "@/components/figures";
import type { Song } from "@/content/site";
import { useEffect, useRef, useState } from "react";

// The parts of Spotify's iFrame API this page uses:
// developer.spotify.com/documentation/embeds/references/iframe-api
type Playback = {
  playingURI: string;
  isPaused: boolean;
  duration: number; // ms
  position: number; // ms
};
type EmbedController = {
  addListener(event: "ready", listener: () => void): void;
  addListener(event: "playback_update", listener: (event: { data: Playback }) => void): void;
  togglePlay(): void;
  pause(): void;
  seek(seconds: number): void;
  destroy(): void;
};
type IFrameAPI = {
  createController(
    element: HTMLElement,
    options: { uri: string; width?: number | string; height?: number | string },
    callback: (controller: EmbedController) => void,
  ): void;
};

declare global {
  interface Window {
    onSpotifyIframeApiReady?: (api: IFrameAPI) => void;
  }
}

// Spotify hands its API to a global callback once per page load, so the
// promise is kept for later visits to /music.
let api: Promise<IFrameAPI> | undefined;
function iframeApi() {
  api ??= new Promise((resolve, reject) => {
    window.onSpotifyIframeApiReady = resolve;
    const script = document.createElement("script");
    script.src = "https://open.spotify.com/embed/iframe-api/v1";
    script.async = true;
    script.onerror = () => {
      script.remove();
      api = undefined; // the next visit tries again
      reject(new Error("Spotify's iFrame API didn't load"));
    };
    document.body.append(script);
  });
  return api;
}

const IDLE: { ready: boolean; failed: boolean; playback: Playback | null } = {
  ready: false,
  failed: false,
  playback: null,
};

// Spotify's own player does the playing; the tape deck above it drives it.
// ponytail: the music stops when you leave /music; a player in the layout
// would keep it going between pages.
export function SpotifyPlayer({ playlist, songs }: { playlist: string; songs: Song[] }) {
  const host = useRef<HTMLDivElement>(null);
  const controller = useRef<EmbedController | null>(null);
  const stopping = useRef(false);
  const [s, setS] = useState(IDLE);

  useEffect(() => {
    const box = host.current;
    if (!box) return;
    // Spotify swaps this node for its iframe, so React never renders into it.
    const slot = document.createElement("div");
    box.append(slot);
    let live = true;
    iframeApi().then(
      (IFrameAPI) => {
        if (!live) return;
        const options = { uri: `spotify:playlist:${playlist}`, width: "100%", height: 352 };
        IFrameAPI.createController(slot, options, (c) => {
          if (!live) return c.destroy();
          controller.current = c;
          box.querySelector("iframe")?.setAttribute("title", "Spotify playlist");
          c.addListener("ready", () => {
            if (live) setS((s) => ({ ...s, ready: true }));
          });
          c.addListener("playback_update", ({ data }) => {
            if (!live) return;
            if (stopping.current && data.isPaused) {
              // Stop rewinds once the pause has landed, so the pause's own
              // report can't put the old spot back on the deck.
              stopping.current = false;
              c.seek(1); // the start, see seekTo
              data = { ...data, position: 0 };
            }
            setS((s) => ({ ...s, playback: data }));
          });
        });
      },
      () => {
        if (live) setS((s) => ({ ...s, failed: true }));
      },
    );
    // Also runs when <Activity> hides the page after a navigation.
    return () => {
      live = false;
      controller.current?.destroy();
      controller.current = null;
      stopping.current = false;
      box.replaceChildren();
      setS(IDLE);
    };
  }, [playlist]);

  const p = s.playback;
  const playing = s.ready && !!p && !p.isPaused;
  const position = p?.position ?? 0;
  const duration = p?.duration ?? 0;
  const song = songs.find(({ track }) => track && p?.playingURI === `spotify:track:${track}`);

  // Past the end of a song the embed moves on to the next one. It ignores
  // seeks under a second, so the start is 0:01 (the deck still says 0:00),
  // and it reports nothing while paused, so the deck shows the new spot now.
  function seekTo(seconds: number) {
    controller.current?.seek(Math.max(1, seconds));
    setS((s) =>
      s.playback ? { ...s, playback: { ...s.playback, position: Math.min(seconds * 1000, s.playback.duration) } } : s,
    );
  }

  return (
    <>
      <CassetteDeck
        ready={s.ready}
        failed={s.failed}
        playing={playing}
        position={position}
        duration={duration}
        title={song?.title}
        label={song ? swatches[song.colour] : undefined}
        onToggle={() => controller.current?.togglePlay()}
        onStop={() => {
          if (!playing) return seekTo(0);
          stopping.current = true;
          controller.current?.pause();
        }}
        onSeek={(seconds) => seekTo(Math.max(0, Math.floor(position / 1000) + seconds))}
        below={<div ref={host} className={s.failed ? "hidden" : "my-4 min-h-[352px]"} />}
      />
      <p className="mt-6">
        <a href={`https://open.spotify.com/playlist/${playlist}`} className="btn" target="_blank" rel="noreferrer">
          Open in Spotify <span aria-hidden="true">→</span>
        </a>
      </p>
    </>
  );
}
