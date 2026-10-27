// What the Music page's cassette and game cartridge can say, and the pure parsers that turn a provider's answer
// into it. Everything here takes `unknown` and returns null for anything unexpected: a malformed body, an error
// shape, a private session or profile, nothing playing. Only the fields the labels print survive, display text is
// capped, and the only links kept are the providers' own public pages. No fetch, no env, no clock: lib/now-playing.ts
// is the one module that talks to the selected music provider and the selected game provider.

// Display caps, in characters. A longer title is cut and ends in an ellipsis, so a label always fits its space.
export const LIMITS = { title: 64, artists: 64, game: 48 } as const;

export type Track = {
  title: string;
  artists: string;
  // An approved public track page, or null when unavailable.
  url: string | null;
  // false when the owner paused it: the label still names it, the reels stay still.
  playing: boolean;
  // Only ListenBrainz last listens carry a full UTC instant; current listens carry null.
  listenedAt?: string | null;
};

export type Game = {
  title: string;
  // The game's page on store.steampowered.com, or null.
  url: string | null;
};

// off: no credentials, so nothing was asked. quiet: asked, and the answer was unusable (an error status, a timeout,
// a malformed or private reply). live: a usable answer from the real provider, which may still be "nothing
// playing". fixture: the same as live, from a loopback test host, so a fake can never claim the live state.
export type SpotifyState = "spotify-off" | "spotify-quiet" | "spotify-live" | "spotify-fixture";
export type SteamState = "steam-off" | "steam-quiet" | "steam-live" | "steam-fixture";

export type SourceState = "off" | "quiet" | "live" | "fixture";
export type SourceReading<S extends string> = { source: S | null; state: SourceState; profileUrl: string | null };
export type MusicReading = SourceReading<"spotify" | "listenbrainz">;
export type PlayReading = SourceReading<"steam" | "lanyard">;

export type NowPlaying = {
  music: MusicReading;
  play: PlayReading;
  spotify: SpotifyState;
  track: Track | null;
  steam: SteamState;
  game: Game | null;
  // When the providers were last read (ISO 8601), or null when the label has never been read.
  readAt: string | null;
};

// The label at rest: nothing read, nothing claimed.
export const QUIET: NowPlaying = { music: { source: null, state: "off", profileUrl: null }, play: { source: null, state: "off", profileUrl: null }, spotify: "spotify-off", track: null, steam: "steam-off", game: null, readAt: null };

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

// Collapses whitespace and control characters, trims, and cuts to max characters (code points, so an emoji is never
// split), ending a cut one in "…". Null for anything that is not a string with something left in it.
export function clip(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const s = v.replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2060-\u206f\ufeff]/g, " ").replace(/\s+/g, " ").trim();
  if (!s) return null;
  const chars = Array.from(s);
  return chars.length <= max ? s : `${chars.slice(0, max - 1).join("").trimEnd()}…`;
}

// A public provider page, rebuilt from its path so no query, fragment or credentials survive. Null otherwise.
function providerUrl(v: unknown, host: string, path: RegExp): string | null {
  if (typeof v !== "string" || v.length > 512) return null;
  let u: URL;
  try {
    u = new URL(v);
  } catch {
    return null;
  }
  if (u.protocol !== "https:" || u.hostname !== host || u.port || u.username || u.password) return null;
  return path.test(u.pathname) ? `https://${host}${u.pathname}` : null;
}

export const spotifyUrl = (v: unknown) =>
  providerUrl(v, "open.spotify.com", /^\/(?:track|album|artist)\/[A-Za-z0-9]{1,64}$/);

// Steam's appid is a number; its store page is the only link a game gets.
export function steamStoreUrl(appid: unknown): string | null {
  return typeof appid === "string" && /^[1-9]\d{0,9}$/.test(appid) ? `https://store.steampowered.com/app/${appid}/` : null;
}

// MusicBrainz names may contain Unicode and spaces, but never path delimiters, controls or dot segments.
export function listenBrainzUser(v: unknown): string | null {
  return typeof v === "string" && /^[\p{L}\p{N}][\p{L}\p{N} ._-]{0,63}$/u.test(v) && v.trim() === v ? v : null;
}

export function listenBrainzProfile(user: string): string | null {
  return listenBrainzUser(user) ? `https://listenbrainz.org/user/${encodeURIComponent(user)}/` : null;
}

export function listenBrainzProfileUrl(v: unknown): string | null {
  if (typeof v !== "string") return null;
  try {
    const u = new URL(v);
    const match = /^\/user\/([^/]+)\/$/.exec(u.pathname);
    if (u.protocol !== "https:" || u.hostname !== "listenbrainz.org" || u.port || u.username || u.password || !match) return null;
    return listenBrainzProfile(decodeURIComponent(match[1]));
  } catch { return null; }
}

export function listenBrainzTrackUrl(v: unknown): string | null {
  return providerUrl(v, "open.spotify.com", /^\/track\/[A-Za-z0-9]{1,64}$/)
    ?? providerUrl(v, "musicbrainz.org", /^\/recording\/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i)
    ?? listenBrainzProfileUrl(v);
}

export function listenedAtISO(v: unknown): string | null {
  if (typeof v !== "number" || !Number.isSafeInteger(v) || v <= 0 || v > 253402300799) return null;
  return new Date(v * 1000).toISOString();
}

// null = unusable envelope/listen; {track:null} = a valid empty reading. No clock or network here.
export type ListenBrainzResult = { track: Track | null };
function parseListenBrainz(body: unknown, playing: boolean): ListenBrainzResult | null {
  if (!isRecord(body) || "error" in body || "code" in body || !isRecord(body.payload)) return null;
  const payload = body.payload;
  if ("error" in payload || !Array.isArray(payload.listens) || payload.listens.length > 1) return null;
  if (playing && typeof payload.playing_now !== "boolean") return null;
  if (payload.count !== undefined && payload.count !== payload.listens.length) return null;
  if (playing && payload.listens.length === 1 && payload.playing_now !== true) return null;
  if (!payload.listens.length) return { track: null };
  const listen = payload.listens[0];
  if (!isRecord(listen) || !isRecord(listen.track_metadata)) return null;
  const metadata = listen.track_metadata;
  const title = clip(metadata.track_name, LIMITS.title);
  const artists = clip(metadata.artist_name, LIMITS.artists);
  const listenedAt = playing ? null : listenedAtISO(listen.listened_at);
  if (!title || !artists || (!playing && !listenedAt)) return null;
  const info = isRecord(metadata.additional_info) ? metadata.additional_info : {};
  const url = listenBrainzTrackUrl(info.spotify_id) ?? listenBrainzTrackUrl(info.origin_url);
  return { track: { title, artists, url, playing, listenedAt } };
}
export const parseListenBrainzPlayingNow = (body: unknown) => parseListenBrainz(body, true);
export const parseListenBrainzListens = (body: unknown) => parseListenBrainz(body, false);

// POST /api/token with grant_type=refresh_token: the access token, or null. Nothing else is kept.
export function parseSpotifyToken(body: unknown): string | null {
  if (!isRecord(body) || "error" in body) return null;
  const { access_token: token, token_type: type } = body;
  if (typeof type !== "string" || type.toLowerCase() !== "bearer") return null;
  return typeof token === "string" && /^[A-Za-z0-9._~+/=-]{16,2048}$/.test(token) ? token : null;
}

// GET /v1/me/player/currently-playing (a 200; a 204 means nothing is playing and has no body). A track only:
// episodes, ads, a private session and an unknown type are all null.
export function parseSpotifyTrack(body: unknown): Track | null {
  if (!isRecord(body) || "error" in body) return null;
  if (body.currently_playing_type !== "track") return null;
  if (isRecord(body.device) && body.device.is_private_session === true) return null;
  const item = body.item;
  if (!isRecord(item) || (item.type !== undefined && item.type !== "track")) return null;
  const title = clip(item.name, LIMITS.title);
  const names = Array.isArray(item.artists)
    ? item.artists.flatMap((a) => (isRecord(a) && typeof a.name === "string" ? [a.name] : []))
    : [];
  const artists = clip(names.join(", "), LIMITS.artists);
  if (!title || !artists) return null;
  return {
    title,
    artists,
    url: item.is_local === true || !isRecord(item.external_urls) ? null : spotifyUrl(item.external_urls.spotify),
    playing: body.is_playing === true,
  };
}

// ISteamUser/GetPlayerSummaries/v2 for one SteamID64: the one player, or null.
function steamPlayer(body: unknown): Record<string, unknown> | null {
  if (!isRecord(body) || !isRecord(body.response)) return null;
  const players = body.response.players;
  if (!Array.isArray(players) || players.length !== 1 || !isRecord(players[0])) return null;
  return players[0];
}

// A public profile (communityvisibilitystate 3) answered: the owner is connected, even if not in a game.
export function isPublicSteamProfile(body: unknown): boolean {
  return steamPlayer(body)?.communityvisibilitystate === 3;
}

// The game a public profile is in, by name, with its store page. Null for a private profile, no game, or garbage.
// Name, avatar, location and every other field of the summary are dropped.
export function parseSteamGame(body: unknown): Game | null {
  const player = steamPlayer(body);
  if (!player || player.communityvisibilitystate !== 3) return null;
  const title = clip(player.gameextrainfo, LIMITS.game);
  return title ? { title, url: steamStoreUrl(player.gameid) } : null;
}

// A valid envelope with no game differs from an unreadable/error envelope.
// Discord identities, assets, Spotify data and activity URLs never leave this parser.
export function parseLanyardGame(body: unknown): { game: Game | null } | null {
  if (!isRecord(body) || body.success !== true || "error" in body || !isRecord(body.data) || !Array.isArray(body.data.activities)) return null;
  for (const activity of body.data.activities) {
    if (!isRecord(activity) || activity.type !== 0) continue;
    const title = clip(activity.name, LIMITS.game);
    if (title) return { game: { title, url: null } };
  }
  return { game: null };
}

function validISO(v: unknown): string | null {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(v)) return null;
  const date = new Date(v);
  return !Number.isNaN(date.getTime()) && date.toISOString() === v ? v : null;
}

const SPOTIFY_STATES: readonly SpotifyState[] = ["spotify-off", "spotify-quiet", "spotify-live", "spotify-fixture"];
const STEAM_STATES: readonly SteamState[] = ["steam-off", "steam-quiet", "steam-live", "steam-fixture"];

// Rebuilds a NowPlaying from anything (a cached or serialised copy) keeping only the known fields; what does not
// check out becomes the quiet value. The API route and the page both print through this.
export function sanitize(v: unknown): NowPlaying {
  if (!isRecord(v)) return QUIET;
  const spotify = SPOTIFY_STATES.find((s) => s === v.spotify) ?? "spotify-off";
  const steam = STEAM_STATES.find((s) => s === v.steam) ?? "steam-off";
  const music: MusicReading = isRecord(v.music)
    ? { source: v.music.source === "listenbrainz" || v.music.source === "spotify" ? v.music.source : null,
        state: typeof v.music.state === "string" && ["off", "quiet", "live", "fixture"].includes(v.music.state) ? v.music.state as SourceState : "off",
        profileUrl: v.music.source === "listenbrainz" ? listenBrainzProfileUrl(v.music.profileUrl) : null }
    : { source: spotify === "spotify-off" ? null : "spotify", state: spotify.slice(8) as SourceState, profileUrl: null };
  if (music.source === "spotify") {
    music.state = spotify.slice(8) as SourceState;
    if (spotify === "spotify-off") music.source = null;
  }
  if (!music.source) music.state = "off";
  const play: PlayReading = isRecord(v.play) && v.play.source === "lanyard"
    ? { source: "lanyard", state: typeof v.play.state === "string" && ["off", "quiet", "live", "fixture"].includes(v.play.state) ? v.play.state as SourceState : "quiet", profileUrl: null }
    : { source: steam === "steam-off" ? null : "steam", state: steam.slice(6) as SourceState, profileUrl: null };
  const t = v.track;
  const g = v.game;
  const title = isRecord(t) ? clip(t.title, LIMITS.title) : null;
  const artists = isRecord(t) ? clip(t.artists, LIMITS.artists) : null;
  const game = isRecord(g) ? clip(g.title, LIMITS.game) : null;
  const readAt = typeof v.readAt === "string" && !Number.isNaN(Date.parse(v.readAt)) ? new Date(v.readAt).toISOString() : null;
  return {
    music,
    play,
    spotify: music.source === "spotify" ? spotify : "spotify-off",
    track:
      isRecord(t) && title && artists && (music.state === "live" || music.state === "fixture") && (music.source !== "listenbrainz" || t.playing === true || validISO(t.listenedAt) !== null)
        ? {
            title,
            artists,
            url: music.source === "listenbrainz" ? listenBrainzTrackUrl(t.url) : spotifyUrl(t.url),
            playing: t.playing === true,
            ...(music.source === "listenbrainz" ? { listenedAt: t.playing === true ? null : validISO(t.listenedAt) } : {}),
          }
        : null,
    steam: play.source === "lanyard" ? "steam-off" : steam,
    game:
      isRecord(g) && game && (play.state === "live" || play.state === "fixture")
        ? { title: game, url: play.source !== "lanyard" && typeof g.url === "string" ? steamStoreUrl(/^https:\/\/store\.steampowered\.com\/app\/(\d+)\/$/.exec(g.url)?.[1]) : null }
        : null,
    readAt,
  };
}

// "14:05 UTC" for the label's stamp; the page's <time> carries the full instant.
export function readTime(iso: string): string {
  return `${iso.slice(11, 16)} UTC`;
}

// A last listen may be years old: retain the complete UTC date and time rather than implying freshness.
export function listenTime(iso: string): string {
  return `${iso.slice(0, 10)} · ${iso.slice(11, 19)} UTC`;
}
