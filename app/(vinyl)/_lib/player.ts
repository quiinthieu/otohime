// The one YouTube player, seen through the part of the IFrame Player API the
// deck uses (developers.google.com/youtube/iframe_api_reference). runEffect
// turns deck effects into player calls; the shell keeps ensurePlayer and the
// timers for itself. Nothing here touches the DOM.

import type { Action, Effect } from "./deck.ts";

export type CueArgs = { videoId: string; startSeconds?: number; endSeconds?: number };

export type PlayerLike = {
  cueVideoById(args: CueArgs): void;
  loadVideoById(args: CueArgs): void;
  playVideo(): void;
  pauseVideo(): void;
  stopVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  setVolume(volume: number): void;
  getCurrentTime(): number;
  getDuration(): number;
  getPlayerState(): number;
  destroy(): void;
};

export type PlayerVars = { playsinline: 1; rel: 0; origin: string };

export type PlayerEvent = { target: PlayerLike; data: number };
export type PlayerOptions = {
  width: string;
  height: string;
  playerVars: PlayerVars;
  events: Record<"onReady" | "onStateChange" | "onError", (event: PlayerEvent) => void>;
};
export type YTNamespace = { Player: new (element: HTMLElement | string, options: PlayerOptions) => PlayerLike };

// Documented parameters only, and only these: inline on iOS, related videos
// from the same channel, and our origin so YouTube can check the embedder.
// No autoplay, no hidden controls, no muting.
export function PLAYER_VARS(origin: string): PlayerVars {
  return { playsinline: 1, rel: 0, origin };
}

// YT.PlayerState
export const YT_STATE = { UNSTARTED: -1, ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3, CUED: 5 } as const;

export function mapState(n: number): Action | null {
  switch (n) {
    case YT_STATE.UNSTARTED:
      return { type: "yt", state: "unstarted" };
    case YT_STATE.ENDED:
      return { type: "yt", state: "ended" };
    case YT_STATE.PLAYING:
      return { type: "yt", state: "playing" };
    case YT_STATE.PAUSED:
      return { type: "yt", state: "paused" };
    case YT_STATE.BUFFERING:
      return { type: "yt", state: "buffering" };
    case YT_STATE.CUED:
      return { type: "yt", state: "cued" };
    default:
      return null;
  }
}

function cueArgs(effect: CueArgs): CueArgs {
  const args: CueArgs = { videoId: effect.videoId };
  if (effect.startSeconds !== undefined) args.startSeconds = effect.startSeconds;
  if (effect.endSeconds !== undefined) args.endSeconds = effect.endSeconds;
  return args;
}

// Runs one effect on the player; false means it is the shell's to run
// (ensurePlayer, timers) or there is no player yet to run it on.
export function runEffect(player: PlayerLike | null, effect: Effect): boolean {
  if (effect.type === "ensurePlayer" || effect.type === "timer" || effect.type === "clearTimer") return false;
  if (!player) return false;
  switch (effect.type) {
    case "cue":
      player.cueVideoById(cueArgs(effect));
      return true;
    case "play":
      player.playVideo();
      return true;
    case "pause":
      player.pauseVideo();
      return true;
    case "stop":
      player.stopVideo();
      player.cueVideoById(cueArgs(effect));
      return true;
    case "seek":
      player.seekTo(effect.seconds, true);
      return true;
    case "volume":
      player.setVolume(effect.value);
      return true;
    case "destroy":
      player.destroy();
      return true;
  }
}
