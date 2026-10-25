import assert from "node:assert/strict";
import { test } from "node:test";
import {
  clip,
  isPublicSteamProfile,
  LIMITS,
  parseSpotifyToken,
  parseSpotifyTrack,
  parseSteamGame,
  QUIET,
  readTime,
  sanitize,
  spotifyUrl,
  steamStoreUrl,
} from "./now-playing-data.ts";

// Shapes of the providers' documented answers, trimmed to what matters, with the extra fields a real answer carries
// so the tests show they are dropped.
const TRACK = {
  timestamp: 1761400000000,
  context: { type: "playlist", uri: "spotify:playlist:609w1YzsoSy1zuHmyBhYwu" },
  progress_ms: 42000,
  currently_playing_type: "track",
  actions: { disallows: { resuming: true } },
  is_playing: true,
  item: {
    type: "track",
    name: "Nicole Kidman",
    artists: [
      { name: "ADÉLA", id: "a1", external_urls: { spotify: "https://open.spotify.com/artist/a1" } },
      { name: "Guest", id: "a2" },
    ],
    album: { name: "The Provider", images: [{ url: "https://i.scdn.co/image/x" }] },
    duration_ms: 190000,
    explicit: false,
    external_urls: { spotify: "https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC?si=abc#t=1" },
    is_local: false,
    popularity: 50,
    preview_url: "https://p.scdn.co/mp3-preview/x",
  },
};

const PLAYER = (over: Record<string, unknown> = {}) => ({
  response: {
    players: [
      {
        steamid: "76561197960435530",
        communityvisibilitystate: 3,
        profilestate: 1,
        personaname: "otohime",
        profileurl: "https://steamcommunity.com/id/otohime/",
        avatar: "https://avatars.steamstatic.com/x.jpg",
        realname: "Not for the page",
        loccountrycode: "VN",
        gameextrainfo: "Hades II",
        gameid: "1145350",
        ...over,
      },
    ],
  },
});

test("clip trims, collapses whitespace and control characters, and caps by code point", () => {
  assert.equal(clip("  a \n\t b\u0000c  ", 10), "a b c");
  assert.equal(clip("\u202eevil", 10), "evil");
  assert.equal(clip("abcdefghij", 10), "abcdefghij");
  assert.equal(clip("abcdefghijk", 10), "abcdefghi…");
  assert.equal(Array.from(clip("🎵".repeat(20), 10)!).length, 10);
  assert.equal(clip("   ", 10), null);
  assert.equal(clip(42, 10), null);
  assert.equal(clip(null, 10), null);
});

test("only the providers' own public pages are kept as links, rebuilt without query or fragment", () => {
  assert.equal(spotifyUrl("https://open.spotify.com/track/abc123?si=x#y"), "https://open.spotify.com/track/abc123");
  for (const bad of [
    "http://open.spotify.com/track/abc",
    "https://open.spotify.com.evil.example/track/abc",
    "https://user:pw@open.spotify.com/track/abc",
    "https://open.spotify.com:8443/track/abc",
    "https://open.spotify.com/track/../../x",
    "https://open.spotify.com/user/someone",
    "javascript:alert(1)",
    "not a url",
    42,
    `https://open.spotify.com/track/${"a".repeat(600)}`,
  ])
    assert.equal(spotifyUrl(bad), null, String(bad));
  assert.equal(steamStoreUrl("1145350"), "https://store.steampowered.com/app/1145350/");
  for (const bad of ["0", "12a", "", "1".repeat(11), 1145350, null]) assert.equal(steamStoreUrl(bad), null, String(bad));
});

test("the token answer keeps only a bearer access token", () => {
  const token = "BQD-a_long.token~value+with/sym=bols";
  assert.equal(parseSpotifyToken({ access_token: token, token_type: "Bearer", expires_in: 3600, scope: "user-read-currently-playing" }), token);
  assert.equal(parseSpotifyToken({ access_token: token, token_type: "bearer" }), token);
  assert.equal(parseSpotifyToken({ access_token: token, token_type: "mac" }), null);
  assert.equal(parseSpotifyToken({ access_token: "short", token_type: "Bearer" }), null);
  assert.equal(parseSpotifyToken({ access_token: "has spaces in it, oh no", token_type: "Bearer" }), null);
  assert.equal(parseSpotifyToken({ error: "invalid_grant", error_description: "Refresh token revoked" }), null);
  assert.equal(parseSpotifyToken("garbage"), null);
  assert.equal(parseSpotifyToken(null), null);
});

test("a playing track keeps title, artists and a clean link, and nothing else", () => {
  const track = parseSpotifyTrack(TRACK);
  assert.deepEqual(track, {
    title: "Nicole Kidman",
    artists: "ADÉLA, Guest",
    url: "https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC",
    playing: true,
  });
  assert.doesNotMatch(JSON.stringify(track), /scdn|preview|progress|playlist|popularity|Provider/);
});

test("a paused track is still named; a local file has no link", () => {
  assert.equal(parseSpotifyTrack({ ...TRACK, is_playing: false })?.playing, false);
  const local = parseSpotifyTrack({ ...TRACK, item: { ...TRACK.item, is_local: true } });
  assert.equal(local?.url, null);
  assert.equal(local?.title, "Nicole Kidman");
});

test("long track text is capped to the label's space", () => {
  const long = parseSpotifyTrack({
    ...TRACK,
    item: {
      ...TRACK.item,
      name: "W".repeat(300),
      artists: Array.from({ length: 30 }, (_, i) => ({ name: `Artist number ${i}` })),
    },
  });
  assert.ok(long);
  assert.equal(Array.from(long.title).length, LIMITS.title);
  assert.equal(Array.from(long.artists).length, LIMITS.artists);
  assert.ok(long.title.endsWith("…"));
});

test("episodes, ads, private sessions, empty and error answers are null", () => {
  const fixtures: [string, unknown][] = [
    ["episode", { ...TRACK, currently_playing_type: "episode", item: { ...TRACK.item, type: "episode" } }],
    ["ad", { ...TRACK, currently_playing_type: "ad", item: null }],
    ["unknown type", { ...TRACK, currently_playing_type: "unknown", item: null }],
    ["private session", { ...TRACK, device: { is_private_session: true } }],
    ["no item", { ...TRACK, item: null }],
    ["no title", { ...TRACK, item: { ...TRACK.item, name: "   " } }],
    ["no artists", { ...TRACK, item: { ...TRACK.item, artists: [] } }],
    ["artists not objects", { ...TRACK, item: { ...TRACK.item, artists: ["ADÉLA"] } }],
    ["error", { error: { status: 401, message: "The access token expired" } }],
    ["rate limit", { error: { status: 429, message: "API rate limit exceeded" } }],
    ["empty object", {}],
    ["empty string", ""],
    ["array", [TRACK]],
    ["null", null],
    ["number", 7],
  ];
  for (const [name, body] of fixtures) assert.equal(parseSpotifyTrack(body), null, name);
});

test("a public profile in a game gives the game and its store page, and drops the rest", () => {
  const game = parseSteamGame(PLAYER());
  assert.deepEqual(game, { title: "Hades II", url: "https://store.steampowered.com/app/1145350/" });
  assert.doesNotMatch(JSON.stringify(game), /otohime|avatar|VN|Not for the page|7656/);
  assert.equal(isPublicSteamProfile(PLAYER()), true);
  assert.deepEqual(parseSteamGame(PLAYER({ gameid: "nope" })), { title: "Hades II", url: null });
  assert.equal(Array.from(parseSteamGame(PLAYER({ gameextrainfo: "G".repeat(200) }))!.title).length, LIMITS.game);
});

test("a private profile, no game, an empty list, an error or garbage is null", () => {
  const fixtures: [string, unknown][] = [
    ["private", PLAYER({ communityvisibilitystate: 1 })],
    ["friends only", PLAYER({ communityvisibilitystate: 2 })],
    ["not in a game", PLAYER({ gameextrainfo: undefined, gameid: undefined })],
    ["blank game", PLAYER({ gameextrainfo: " " })],
    ["no players", { response: { players: [] } }],
    ["two players", { response: { players: [PLAYER().response.players[0], PLAYER().response.players[0]] } }],
    ["no response", { players: [] }],
    ["error page", "<html><body>Forbidden</body></html>"],
    ["null", null],
  ];
  for (const [name, body] of fixtures) assert.equal(parseSteamGame(body), null, name);
  assert.equal(isPublicSteamProfile(PLAYER({ communityvisibilitystate: 1 })), false);
  assert.equal(isPublicSteamProfile(PLAYER({ gameextrainfo: undefined })), true);
  assert.equal(isPublicSteamProfile(null), false);
});

test("sanitize keeps the known fields only, and drops labels for providers that are not connected", () => {
  const good = {
    spotify: "spotify-fixture",
    track: { title: "A", artists: "B", album: "dropped", url: "https://open.spotify.com/track/x1", playing: true, secret: "s" },
    steam: "steam-live",
    game: { title: "G", url: "https://store.steampowered.com/app/10/", token: "t" },
    readAt: "2026-10-26T01:02:03.000Z",
    extra: "dropped",
  };
  assert.deepEqual(sanitize(good), {
    spotify: "spotify-fixture",
    track: { title: "A", artists: "B", url: "https://open.spotify.com/track/x1", playing: true },
    steam: "steam-live",
    game: { title: "G", url: "https://store.steampowered.com/app/10/" },
    readAt: "2026-10-26T01:02:03.000Z",
  });
  const quiet = sanitize({ ...good, spotify: "spotify-quiet", steam: "steam-off" });
  assert.equal(quiet.track, null);
  assert.equal(quiet.game, null);
  assert.deepEqual(sanitize({ spotify: "spotify-hacked", steam: 3, readAt: "never" }), QUIET);
  assert.deepEqual(sanitize("nope"), QUIET);
  assert.equal(sanitize({ ...good, game: { title: "G", url: "https://evil.example/app/10/" } }).game?.url, null);
});

test("the read stamp is the UTC hour and minute", () => {
  assert.equal(readTime("2026-10-26T01:02:03.000Z"), "01:02 UTC");
});
