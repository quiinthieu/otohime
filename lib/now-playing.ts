// Shared on-demand server reader for selected ListenBrainz/Spotify music and independent Steam games.
// Credentials and provider hosts stay here. Loopback overrides label fake readings as fixture.
// Selected music failures remain quiet; nothing falls through to an unrelated account.
import "server-only";
import { nowPlaying } from "../content/now-playing.ts";
import { cacheLife } from "next/cache";
import {
  isPublicSteamProfile,
  listenBrainzUser,
  listenBrainzProfile,
  parseListenBrainzPlayingNow,
  parseListenBrainzListens,
  type MusicReading,
  parseSpotifyToken,
  parseSpotifyTrack,
  parseSteamGame,
  type Game,
  type NowPlaying,
  type SpotifyState,
  type SteamState,
  type Track,
} from "./now-playing-data.ts";

export const TIMEOUT_MS = 4000;

const HOSTS = {
  accounts: "https://accounts.spotify.com",
  api: "https://api.spotify.com",
  steam: "https://api.steampowered.com",
  listenbrainz: "https://api.listenbrainz.org",
} as const;

export type Env = Record<string, string | undefined>;

export type Config = {
  listenbrainz: { user: string } | null;
  spotify: { clientId: string; clientSecret: string; refreshToken: string } | null;
  steam: { key: string; id: string } | null;
  hosts: { accounts: string; api: string; steam: string; listenbrainz: string };
  // A loopback host override is in effect for that provider.
  fixture: { spotify: boolean; steam: boolean; listenbrainz: boolean };
};

// A loopback http(s) origin (127.0.0.1, ::1 or localhost) for the walks' fakes, or null for anything else, so a
// misconfigured server can never send the credentials to another host.
export function loopbackOrigin(raw: string | undefined): string | null {
  if (!raw) return null;
  try {
    const u = new URL(raw);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    if (u.username || u.password || (u.pathname !== "/" && u.pathname !== "") || u.search || u.hash) return null;
    return ["127.0.0.1", "[::1]", "localhost"].includes(u.hostname) ? u.origin : null;
  } catch {
    return null;
  }
}

const CLIENT = /^[A-Za-z0-9]{16,64}$/;
const REFRESH = /^[A-Za-z0-9._~+/=-]{16,1024}$/;
const STEAM_KEY = /^[A-Za-z0-9]{16,64}$/;
const STEAM_ID = /^7656\d{13}$/;

const valid = (v: string | undefined, re: RegExp) => (v !== undefined && re.test(v) ? v : null);

export function configFrom(env: Env, publicDefault: string = nowPlaying.listenBrainzUser): Config {
  const user = listenBrainzUser(env.LISTENBRAINZ_USER ?? publicDefault);
  const listenbrainz = loopbackOrigin(env.NOW_PLAYING_LISTENBRAINZ_HOST);
  const clientId = valid(env.SPOTIFY_CLIENT_ID, CLIENT);
  const clientSecret = valid(env.SPOTIFY_CLIENT_SECRET, CLIENT);
  const refreshToken = valid(env.SPOTIFY_REFRESH_TOKEN, REFRESH);
  const key = valid(env.STEAM_API_KEY, STEAM_KEY);
  const id = valid(env.STEAM_ID, STEAM_ID);
  const accounts = loopbackOrigin(env.NOW_PLAYING_SPOTIFY_ACCOUNTS_HOST);
  const api = loopbackOrigin(env.NOW_PLAYING_SPOTIFY_API_HOST);
  const steam = loopbackOrigin(env.NOW_PLAYING_STEAM_HOST);
  return {
    listenbrainz: user ? { user } : null,
    spotify: clientId && clientSecret && refreshToken ? { clientId, clientSecret, refreshToken } : null,
    steam: key && id ? { key, id } : null,
    hosts: { accounts: accounts ?? HOSTS.accounts, api: api ?? HOSTS.api, steam: steam ?? HOSTS.steam, listenbrainz: listenbrainz ?? HOSTS.listenbrainz },
    fixture: { spotify: Boolean(accounts || api), steam: Boolean(steam), listenbrainz: Boolean(listenbrainz) },
  };
}

type Fetch = (url: string, init: RequestInit) => Promise<Response>;

async function readListenBrainz(config: Config, fetcher: Fetch): Promise<{ music: MusicReading; track: Track | null }> {
  const user = config.listenbrainz!.user;
  const music: MusicReading = { source: "listenbrainz", state: "quiet", profileUrl: listenBrainzProfile(user) };
  const signal = AbortSignal.timeout(TIMEOUT_MS);
  const base = `${config.hosts.listenbrainz}/1/user/${encodeURIComponent(user)}`;
  const get = async (path: string, parse: typeof parseListenBrainzListens) => {
    try {
      const res = await fetcher(`${base}/${path}`, {
        headers: { "user-agent": "otohime.dev/1.0 (+https://otohime.dev)", accept: "application/json" },
        signal,
        redirect: "error",
      });
      if (res.status !== 200 || !/^application\/json(?:\s*;|$)/i.test(res.headers.get("content-type") ?? "")) return null;
      return parse(await res.json());
    } catch { return null; }
  };
  const [current, last] = await Promise.all([
    get("playing-now", parseListenBrainzPlayingNow),
    get("listens?count=1", parseListenBrainzListens),
  ]);
  const track = current?.track ?? last?.track ?? null;
  if (current || last) music.state = config.fixture.listenbrainz ? "fixture" : "live";
  return { music, track };
}

async function readSpotify(config: Config, fetcher: Fetch): Promise<{ spotify: SpotifyState; track: Track | null }> {
  const quiet = { spotify: "spotify-quiet", track: null } as const;
  const creds = config.spotify;
  if (!creds) return { spotify: "spotify-off", track: null };
  const connected: SpotifyState = config.fixture.spotify ? "spotify-fixture" : "spotify-live";
  // One budget for both calls: the token and the track together never take more than 4 s.
  const signal = AbortSignal.timeout(TIMEOUT_MS);
  try {
    const basic = Buffer.from(`${creds.clientId}:${creds.clientSecret}`).toString("base64");
    const tokenRes = await fetcher(`${config.hosts.accounts}/api/token`, {
      method: "POST",
      headers: {
        authorization: `Basic ${basic}`,
        "content-type": "application/x-www-form-urlencoded",
        accept: "application/json",
      },
      body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: creds.refreshToken }).toString(),
      signal,
      redirect: "error",
    });
    if (!tokenRes.ok) return quiet;
    const token = parseSpotifyToken(await tokenRes.json());
    if (!token) return quiet;
    const res = await fetcher(`${config.hosts.api}/v1/me/player/currently-playing`, {
      headers: { authorization: `Bearer ${token}`, accept: "application/json" },
      signal,
      redirect: "error",
    });
    // 204: connected, and nothing is playing.
    if (res.status === 204) return { spotify: connected, track: null };
    if (res.status !== 200) return quiet;
    const track = parseSpotifyTrack(await res.json());
    return track ? { spotify: connected, track } : quiet;
  } catch {
    // An abort, a refused connection or a body that is not JSON. The error is dropped, not logged: it may
    // carry the request.
    return quiet;
  }
}

async function readSteam(config: Config, fetcher: Fetch): Promise<{ steam: SteamState; game: Game | null }> {
  const quiet = { steam: "steam-quiet", game: null } as const;
  const creds = config.steam;
  if (!creds) return { steam: "steam-off", game: null };
  try {
    const url = `${config.hosts.steam}/ISteamUser/GetPlayerSummaries/v0002/?key=${encodeURIComponent(creds.key)}&steamids=${creds.id}`;
    const res = await fetcher(url, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      redirect: "error",
    });
    if (res.status !== 200) return quiet;
    const body: unknown = await res.json();
    // A private profile answers, but tells nothing: quiet, not connected.
    if (!isPublicSteamProfile(body)) return quiet;
    return { steam: config.fixture.steam ? "steam-fixture" : "steam-live", game: parseSteamGame(body) };
  } catch {
    return quiet;
  }
}

// Both providers at once, each failing on its own. Framework-free, so lib/now-playing.test.ts drives it with a
// fake fetch.
export async function readProviders(config: Config, fetcher: Fetch = fetch, now: () => Date = () => new Date()): Promise<NowPlaying> {
  const [selected, steam] = await Promise.all([
    config.listenbrainz ? readListenBrainz(config, fetcher) : readSpotify(config, fetcher),
    readSteam(config, fetcher),
  ]);
  const spotify = "spotify" in selected ? selected.spotify : "spotify-off";
  const music: MusicReading = "music" in selected ? selected.music : {
    source: spotify === "spotify-off" ? null : "spotify", state: spotify.slice(8) as MusicReading["state"], profileUrl: null,
  };
  return { music, play: { source: config.steam ? "steam" : null, state: steam.steam.slice(6) as MusicReading["state"], profileUrl: null },
    spotify, track: selected.track, ...steam, readAt: now().toISOString() };
}

// The cached reading. A minute's views share one read (60 s revalidate, a browser may reuse it 30 s); after five
// minutes with no view the next one waits for a fresh read. Failures are cached the same way, so an outage costs
// one call a minute, not one per view. The callers await connection() first, so nothing runs at build.
export async function readNowPlaying(): Promise<NowPlaying> {
  "use cache";
  cacheLife({ stale: 30, revalidate: 60, expire: 300 });
  return readProviders(configFrom(process.env));
}
