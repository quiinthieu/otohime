// The one place the site talks to Spotify and Steam, and the only code that reads their credentials. Music's
// cassette (app/(site)/(app)/music/page.tsx) and GET /api/now-playing both print readNowPlaying(), one "use cache"
// function, so the page and the API always agree and a minute's views cost one read.
//
// Spotify: refresh the owner's access token (Authorization Code, scope user-read-currently-playing), then ask for
// the currently playing track. Steam (optional): the owner's public player summary. Both run at once, each with
// its own 4 s budget and no retry, so one provider failing never blanks the other. Missing or malformed
// configuration means that provider is off and nothing is asked. No credential is logged, returned or put in an
// error: only the parsed labels in lib/now-playing-data.ts leave this module.
//
// Host overrides (NOW_PLAYING_*_HOST) exist for the local walks' fake providers and are honoured only for a
// loopback origin; with one in effect the state reads *-fixture, never *-live.
import "server-only";
import { cacheLife } from "next/cache";
import {
  isPublicSteamProfile,
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
} as const;

export type Env = Record<string, string | undefined>;

export type Config = {
  spotify: { clientId: string; clientSecret: string; refreshToken: string } | null;
  steam: { key: string; id: string } | null;
  hosts: { accounts: string; api: string; steam: string };
  // A loopback host override is in effect for that provider.
  fixture: { spotify: boolean; steam: boolean };
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

export function configFrom(env: Env): Config {
  const clientId = valid(env.SPOTIFY_CLIENT_ID, CLIENT);
  const clientSecret = valid(env.SPOTIFY_CLIENT_SECRET, CLIENT);
  const refreshToken = valid(env.SPOTIFY_REFRESH_TOKEN, REFRESH);
  const key = valid(env.STEAM_API_KEY, STEAM_KEY);
  const id = valid(env.STEAM_ID, STEAM_ID);
  const accounts = loopbackOrigin(env.NOW_PLAYING_SPOTIFY_ACCOUNTS_HOST);
  const api = loopbackOrigin(env.NOW_PLAYING_SPOTIFY_API_HOST);
  const steam = loopbackOrigin(env.NOW_PLAYING_STEAM_HOST);
  return {
    spotify: clientId && clientSecret && refreshToken ? { clientId, clientSecret, refreshToken } : null,
    steam: key && id ? { key, id } : null,
    hosts: { accounts: accounts ?? HOSTS.accounts, api: api ?? HOSTS.api, steam: steam ?? HOSTS.steam },
    fixture: { spotify: Boolean(accounts || api), steam: Boolean(steam) },
  };
}

type Fetch = (url: string, init: RequestInit) => Promise<Response>;

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
  const [spotify, steam] = await Promise.all([readSpotify(config, fetcher), readSteam(config, fetcher)]);
  return { ...spotify, ...steam, readAt: now().toISOString() };
}

// The cached reading. A minute's views share one read (60 s revalidate, a browser may reuse it 30 s); after five
// minutes with no view the next one waits for a fresh read. Failures are cached the same way, so an outage costs
// one call a minute, not one per view. The callers await connection() first, so nothing runs at build.
export async function readNowPlaying(): Promise<NowPlaying> {
  "use cache";
  cacheLife({ stale: 30, revalidate: 60, expire: 300 });
  return readProviders(configFrom(process.env));
}
