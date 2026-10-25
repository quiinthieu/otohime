// What the Music page's cassette and game cartridge can say, and the pure parsers that turn a provider's answer
// into it. Everything here takes `unknown` and returns null for anything unexpected: a malformed body, an error
// shape, a private session or profile, nothing playing. Only the fields the labels print survive, display text is
// capped, and the only links kept are the providers' own public pages. No fetch, no env, no clock: lib/now-playing.ts
// is the one module that talks to Spotify and Steam.

// Display caps, in characters. A longer title is cut and ends in an ellipsis, so a label always fits its space.
export const LIMITS = { title: 64, artists: 64, game: 48 } as const;

export type Track = {
  title: string;
  artists: string;
  // The track's page on open.spotify.com, or null for a local file.
  url: string | null;
  // false when the owner paused it: the label still names it, the reels stay still.
  playing: boolean;
};

export type Game = {
  title: string;
  // The game's page on store.steampowered.com, or null.
  url: string | null;
};

// off: no credentials, so nothing was asked. quiet: asked, and the answer was unusable (an error status, a timeout,
// a malformed or private reply). live: an authenticated answer from the real provider, which may still be "nothing
// playing". fixture: the same as live, from a loopback test host, so a fake can never claim the live state.
export type SpotifyState = "spotify-off" | "spotify-quiet" | "spotify-live" | "spotify-fixture";
export type SteamState = "steam-off" | "steam-quiet" | "steam-live" | "steam-fixture";

export type NowPlaying = {
  spotify: SpotifyState;
  track: Track | null;
  steam: SteamState;
  game: Game | null;
  // When the providers were last read (ISO 8601), or null when the label has never been read.
  readAt: string | null;
};

// The label at rest: nothing read, nothing claimed.
export const QUIET: NowPlaying = { spotify: "spotify-off", track: null, steam: "steam-off", game: null, readAt: null };

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

const SPOTIFY_STATES: readonly SpotifyState[] = ["spotify-off", "spotify-quiet", "spotify-live", "spotify-fixture"];
const STEAM_STATES: readonly SteamState[] = ["steam-off", "steam-quiet", "steam-live", "steam-fixture"];

// Rebuilds a NowPlaying from anything (a cached or serialised copy) keeping only the known fields; what does not
// check out becomes the quiet value. The API route and the page both print through this.
export function sanitize(v: unknown): NowPlaying {
  if (!isRecord(v)) return QUIET;
  const spotify = SPOTIFY_STATES.find((s) => s === v.spotify) ?? "spotify-off";
  const steam = STEAM_STATES.find((s) => s === v.steam) ?? "steam-off";
  const t = v.track;
  const g = v.game;
  const title = isRecord(t) ? clip(t.title, LIMITS.title) : null;
  const artists = isRecord(t) ? clip(t.artists, LIMITS.artists) : null;
  const game = isRecord(g) ? clip(g.title, LIMITS.game) : null;
  const readAt = typeof v.readAt === "string" && !Number.isNaN(Date.parse(v.readAt)) ? new Date(v.readAt).toISOString() : null;
  const connected = (s: string) => s.endsWith("-live") || s.endsWith("-fixture");
  return {
    spotify,
    track:
      isRecord(t) && title && artists && connected(spotify)
        ? {
            title,
            artists,
            url: spotifyUrl(t.url),
            playing: t.playing === true,
          }
        : null,
    steam,
    game:
      isRecord(g) && game && connected(steam)
        ? { title: game, url: typeof g.url === "string" ? steamStoreUrl(/^https:\/\/store\.steampowered\.com\/app\/(\d+)\/$/.exec(g.url)?.[1]) : null }
        : null,
    readAt,
  };
}

// "14:05 UTC" for the label's stamp; the page's <time> carries the full instant.
export function readTime(iso: string): string {
  return `${iso.slice(11, 16)} UTC`;
}
