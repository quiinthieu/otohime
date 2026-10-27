// The provider adapter, driven with a fake fetch: no network in npm test. lib/now-playing.ts imports "server-only"
// and next/cache, which plain Node cannot load, so a resolve hook stands in for both before it is imported:
// server-only becomes an empty module and cacheLife throws (readNowPlaying itself only runs inside Next; its
// shape is read as text below).
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { register } from "node:module";
import { join, relative, resolve } from "node:path";
import { test } from "node:test";

const HOOKS = `
export async function resolve(specifier, context, next) {
  if (specifier === "server-only") return { url: "data:text/javascript,export%20%7B%7D", shortCircuit: true };
  if (specifier === "next/cache")
    return { url: "data:text/javascript,export%20const%20cacheLife%20%3D%20()%20%3D%3E%20%7B%20throw%20new%20Error(%22outside%20Next%22)%3B%20%7D%3B", shortCircuit: true };
  return next(specifier, context);
}`;
register(`data:text/javascript,${encodeURIComponent(HOOKS)}`);
const { configFrom, loopbackOrigin, readProviders, TIMEOUT_MS } = await import("./now-playing.ts");
type Config = ReturnType<typeof configFrom>;

const ROOT = resolve(import.meta.dirname, "..");
const SOURCE = readFileSync(join(ROOT, "lib/now-playing.ts"), "utf8");
const CODE = SOURCE.replace(/^\s*\/\/.*$/gm, "");

const SECRETS = {
  SPOTIFY_CLIENT_ID: "SentinelClientId0123456789abcd",
  SPOTIFY_CLIENT_SECRET: "SentinelClientSecret0123456789",
  SPOTIFY_REFRESH_TOKEN: "Sentinel-Refresh_Token.0123456789~abc",
  STEAM_API_KEY: "SentinelSteamKey0123456789ABCDEF",
  STEAM_ID: "76561197960435530",
};
const TOKEN = "SentinelAccessToken-0123456789";
const LOOP = {
  NOW_PLAYING_SPOTIFY_ACCOUNTS_HOST: "http://127.0.0.1:4131",
  NOW_PLAYING_SPOTIFY_API_HOST: "http://127.0.0.1:4132",
  NOW_PLAYING_STEAM_HOST: "http://127.0.0.1:4133",
};

const TRACK = {
  is_playing: true,
  currently_playing_type: "track",
  item: {
    type: "track",
    name: "Nicole Kidman",
    artists: [{ name: "ADÉLA" }],
    external_urls: { spotify: "https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC" },
  },
};
const PLAYER = (over: Record<string, unknown> = {}) => ({
  response: { players: [{ steamid: SECRETS.STEAM_ID, communityvisibilitystate: 3, gameextrainfo: "Hades II", gameid: "1145350", ...over }] },
});

type Call = { url: string; init: RequestInit };
type Answer = Response | Error | "hang";
type Answers = { token?: Answer; track?: Answer; steam?: Answer };

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

// A fetch that records every call and answers by URL path; "hang" waits for the abort signal.
function fake(answers: Answers = {}) {
  const calls: Call[] = [];
  const fetcher = async (url: string, init: RequestInit): Promise<Response> => {
    calls.push({ url, init });
    const path = new URL(url).pathname;
    const answer =
      path === "/api/token"
        ? (answers.token ?? json({ access_token: TOKEN, token_type: "Bearer", expires_in: 3600 }))
        : path === "/v1/me/player/currently-playing"
          ? (answers.track ?? json(TRACK))
          : path === "/ISteamUser/GetPlayerSummaries/v0002/"
            ? (answers.steam ?? json(PLAYER()))
            : new Error(`unexpected ${path}`);
    if (answer === "hang")
      return new Promise((_, reject) => init.signal?.addEventListener("abort", () => reject(init.signal?.reason)));
    if (answer instanceof Error) throw answer;
    return answer.clone();
  };
  return { calls, fetcher };
}

const AT = new Date("2026-10-26T01:02:03.000Z");
const read = (config: Config, answers: Answers = {}) => {
  const f = fake(answers);
  return readProviders(config, f.fetcher, () => AT).then((r) => ({ ...r, calls: f.calls, result: r }));
};
const leaks = (v: unknown) => Object.values({ ...SECRETS, TOKEN }).filter((s) => JSON.stringify(v).includes(s));

test("no configuration: both providers off and nothing is asked", async () => {
  const config = configFrom({});
  assert.equal(config.spotify, null);
  assert.equal(config.steam, null);
  assert.deepEqual(config.fixture, { spotify: false, steam: false, listenbrainz: false, lanyard: false });
  const r = await read(config);
  assert.deepEqual(r.result, { music: { source: null, state: "off", profileUrl: null }, play: { source: null, state: "off", profileUrl: null }, spotify: "spotify-off", track: null, steam: "steam-off", game: null, readAt: AT.toISOString() });
  assert.equal(r.calls.length, 0);
});

test("half or malformed credentials count as none", async () => {
  for (const env of [
    { SPOTIFY_CLIENT_ID: SECRETS.SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET: SECRETS.SPOTIFY_CLIENT_SECRET },
    { ...SECRETS, SPOTIFY_CLIENT_SECRET: "has spaces in it, sorry" },
    { ...SECRETS, SPOTIFY_REFRESH_TOKEN: "" },
    { ...SECRETS, SPOTIFY_CLIENT_ID: "short" },
  ])
    assert.equal(configFrom(env).spotify, null, JSON.stringify(env));
  assert.equal(configFrom({ ...SECRETS, STEAM_ID: "123" }).steam, null);
  assert.equal(configFrom({ ...SECRETS, STEAM_API_KEY: "key&steamids=1" }).steam, null);
  const r = await read(configFrom({ STEAM_API_KEY: SECRETS.STEAM_API_KEY }));
  assert.equal(r.calls.length, 0);
});

test("host overrides are honoured only as bare loopback origins", () => {
  for (const ok of ["http://127.0.0.1:4131", "http://localhost:9", "http://[::1]:4000", "https://127.0.0.1:8443/"])
    assert.ok(loopbackOrigin(ok), ok);
  for (const bad of [
    undefined,
    "",
    "https://evil.example",
    "http://10.0.0.1:80",
    "http://127.0.0.1.evil.example",
    "http://user:pw@127.0.0.1:4131",
    "http://127.0.0.1:4131/v1",
    "http://127.0.0.1:4131/?x=1",
    "file:///etc/passwd",
    "ftp://127.0.0.1",
    "not a url",
  ])
    assert.equal(loopbackOrigin(bad), null, String(bad));
  const config = configFrom({ ...SECRETS, NOW_PLAYING_SPOTIFY_API_HOST: "https://evil.example", NOW_PLAYING_STEAM_HOST: "http://10.0.0.1" });
  assert.deepEqual(config.hosts, { accounts: "https://accounts.spotify.com", api: "https://api.spotify.com", steam: "https://api.steampowered.com", listenbrainz: "https://api.listenbrainz.org", lanyard: "https://api.lanyard.rest" });
  assert.deepEqual(config.fixture, { spotify: false, steam: false, listenbrainz: false, lanyard: false });
});

test("a live read: token refresh, then the track; and the public summary; nothing secret comes back", async () => {
  const r = await read(configFrom(SECRETS));
  assert.deepEqual(r.result, {
    music: { source: "spotify", state: "live", profileUrl: null },
    play: { source: "steam", state: "live", profileUrl: null },
    spotify: "spotify-live",
    track: { title: "Nicole Kidman", artists: "ADÉLA", url: "https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC", playing: true },
    steam: "steam-live",
    game: { title: "Hades II", url: "https://store.steampowered.com/app/1145350/" },
    readAt: AT.toISOString(),
  });
  assert.deepEqual(leaks(r.result), []);
  const [token, track] = r.calls.filter((c) => c.url.includes("spotify"));
  assert.equal(token.url, "https://accounts.spotify.com/api/token");
  assert.equal(token.init.method, "POST");
  const headers = token.init.headers as Record<string, string>;
  assert.equal(headers.authorization, `Basic ${Buffer.from(`${SECRETS.SPOTIFY_CLIENT_ID}:${SECRETS.SPOTIFY_CLIENT_SECRET}`).toString("base64")}`);
  assert.equal(headers["content-type"], "application/x-www-form-urlencoded");
  assert.deepEqual(Object.fromEntries(new URLSearchParams(String(token.init.body))), {
    grant_type: "refresh_token",
    refresh_token: SECRETS.SPOTIFY_REFRESH_TOKEN,
  });
  assert.equal(track.url, "https://api.spotify.com/v1/me/player/currently-playing");
  assert.equal((track.init.headers as Record<string, string>).authorization, `Bearer ${TOKEN}`);
  const steam = r.calls.find((c) => c.url.includes("steampowered"))!;
  assert.equal(
    steam.url,
    `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?key=${SECRETS.STEAM_API_KEY}&steamids=${SECRETS.STEAM_ID}`,
  );
  for (const c of r.calls) {
    assert.ok(c.init.signal instanceof AbortSignal, c.url);
    assert.equal(c.init.redirect, "error", c.url);
  }
  assert.equal(r.calls.length, 3);
});

test("through loopback overrides the same read says fixture, never live", async () => {
  const r = await read(configFrom({ ...SECRETS, ...LOOP }));
  assert.equal(r.result.spotify, "spotify-fixture");
  assert.equal(r.result.steam, "steam-fixture");
  assert.deepEqual(
    r.calls.map((c) => new URL(c.url).origin).sort(),
    Object.values(LOOP).sort(),
  );
});

test("204 from Spotify is connected with nothing playing", async () => {
  const r = await read(configFrom(SECRETS), { track: new Response(null, { status: 204 }) });
  assert.equal(r.result.spotify, "spotify-live");
  assert.equal(r.result.track, null);
});

test("Spotify's failures are quiet, and Steam carries on", async () => {
  const cases: [string, Answers, number][] = [
    ["token 401", { token: json({ error: "invalid_client" }, 401) }, 1],
    ["token 400 invalid_grant", { token: json({ error: "invalid_grant" }, 400) }, 1],
    ["token malformed", { token: new Response("<html>oops</html>", { status: 200 }) }, 1],
    ["token not bearer", { token: json({ access_token: TOKEN, token_type: "mac" }) }, 1],
    ["track 401", { track: json({ error: { status: 401, message: "expired" } }, 401) }, 2],
    ["track 429", { track: new Response("", { status: 429, headers: { "retry-after": "30" } }) }, 2],
    ["track 503", { track: new Response("", { status: 503 }) }, 2],
    ["track malformed", { track: new Response("{not json", { status: 200 }) }, 2],
    ["track private session", { track: json({ ...TRACK, device: { is_private_session: true } }) }, 2],
    ["track an episode", { track: json({ ...TRACK, currently_playing_type: "episode" }) }, 2],
    ["track a 200 with nothing", { track: json({}) }, 2],
    ["refused", { token: new TypeError("fetch failed") }, 1],
  ];
  for (const [name, answers, spotifyCalls] of cases) {
    const r = await read(configFrom(SECRETS), answers);
    assert.equal(r.result.spotify, "spotify-quiet", name);
    assert.equal(r.result.track, null, name);
    assert.equal(r.result.steam, "steam-live", name);
    assert.equal(r.result.game?.title, "Hades II", name);
    // No retries: one call per step, and no track request after a failed token.
    assert.equal(r.calls.filter((c) => !c.url.includes("steampowered")).length, spotifyCalls, name);
  }
});

test("Steam's failures and a private profile are quiet, and Spotify carries on", async () => {
  const cases: [string, Answers][] = [
    ["private", { steam: json(PLAYER({ communityvisibilitystate: 1 })) }],
    ["no player", { steam: json({ response: { players: [] } }) }],
    ["403", { steam: new Response("<html>Forbidden</html>", { status: 403 }) }],
    ["429", { steam: new Response("", { status: 429 }) }],
    ["malformed", { steam: new Response("nope", { status: 200 }) }],
    ["refused", { steam: new TypeError("fetch failed") }],
  ];
  for (const [name, answers] of cases) {
    const r = await read(configFrom(SECRETS), answers);
    assert.equal(r.result.steam, "steam-quiet", name);
    assert.equal(r.result.game, null, name);
    assert.equal(r.result.spotify, "spotify-live", name);
    assert.equal(r.result.track?.title, "Nicole Kidman", name);
    assert.equal(r.calls.filter((c) => c.url.includes("steampowered")).length, 1, name);
  }
  const idle = await read(configFrom(SECRETS), { steam: json(PLAYER({ gameextrainfo: undefined, gameid: undefined })) });
  assert.equal(idle.result.steam, "steam-live");
  assert.equal(idle.result.game, null);
});

test("hung providers are abandoned at the 4 s budget, together, not one after the other", async () => {
  assert.equal(TIMEOUT_MS, 4000);
  // AbortSignal.timeout's timer does not hold the process open; a server's sockets do, and this stands in for them.
  const alive = setInterval(() => {}, 1000);
  const started = Date.now();
  const r = await read(configFrom(SECRETS), { track: "hang", steam: "hang" }).finally(() => clearInterval(alive));
  const took = Date.now() - started;
  assert.equal(r.result.spotify, "spotify-quiet");
  assert.equal(r.result.steam, "steam-quiet");
  assert.ok(took >= TIMEOUT_MS - 100 && took < TIMEOUT_MS + 1500, `took ${took} ms`);
});

test("an error that quotes the credentials is dropped: not returned, not logged", async () => {
  const logged: unknown[] = [];
  const saved = { error: console.error, warn: console.warn, log: console.log, info: console.info };
  console.error = console.warn = console.log = console.info = (...args: unknown[]) => void logged.push(args);
  try {
    const boom = new Error(`connect failed for key=${SECRETS.STEAM_API_KEY} secret=${SECRETS.SPOTIFY_CLIENT_SECRET}`);
    const r = await read(configFrom(SECRETS), { token: boom, steam: boom });
    assert.equal(r.result.spotify, "spotify-quiet");
    assert.equal(r.result.steam, "steam-quiet");
    assert.deepEqual(leaks(r.result), []);
  } finally {
    Object.assign(console, saved);
  }
  assert.deepEqual(logged, []);
});

test("readNowPlaying: one use-cache function, one cacheLife of about a minute that expires after five", () => {
  assert.match(CODE, /export async function readNowPlaying\(\): Promise<NowPlaying> \{\s*"use cache";/);
  const calls = [...CODE.matchAll(/cacheLife\(([^)]*)\)/g)].map((m) => m[1]);
  assert.deepEqual(calls, ["{ stale: 30, revalidate: 60, expire: 300 }"]);
  assert.match(CODE, /return readProviders\(configFrom\(process\.env\)\);/);
  assert.equal(CODE.match(/process\.env/g)?.length, 1);
  assert.equal(CODE.match(/AbortSignal\.timeout\(TIMEOUT_MS\)/g)?.length, 4);
  assert.doesNotMatch(CODE, /retry|retries|console\./i);
  assert.match(CODE, /^import "server-only";$/m);
});

// Every source file of the app, not the tests or the scripts.
function sources(dir: string): string[] {
  return readdirSync(join(ROOT, dir), { withFileTypes: true }).flatMap((e) => {
    if (e.name === "node_modules" || e.name.startsWith(".")) return [];
    const path = join(dir, e.name);
    if (e.isDirectory()) return sources(path);
    return /\.(?:[cm]?[jt]sx?)$/.test(e.name) && !/\.test\.ts$/.test(e.name) ? [path] : [];
  });
}
const APP = ["app", "components", "content", "lib", "db"].flatMap(sources);

test("the providers' hosts, credentials and overrides appear in lib/now-playing.ts only", () => {
  for (const file of APP) {
    if (file === join("lib", "now-playing.ts")) continue;
    const text = readFileSync(join(ROOT, file), "utf8");
    assert.doesNotMatch(text, /accounts\.spotify\.com|api\.spotify\.com|api\.steampowered\.com|api\.listenbrainz\.org|api\.lanyard\.rest/, file);
    assert.doesNotMatch(text, /SPOTIFY_(?:CLIENT|REFRESH)|STEAM_(?:API_KEY|ID)\b|LANYARD_USER_ID|NOW_PLAYING_\w+_HOST/, file);
  }
});

test("no client module imports the adapter", () => {
  for (const file of APP) {
    const text = readFileSync(join(ROOT, file), "utf8");
    if (/^\s*["']use client["']/m.test(text)) assert.doesNotMatch(text, /lib\/now-playing["']|\.\/now-playing(?:\.ts)?["']/, file);
  }
});

test("the page and the API both await connection() before the one cached reader", () => {
  const page = readFileSync(join(ROOT, "app/(site)/(app)/music/page.tsx"), "utf8");
  const route = readFileSync(join(ROOT, "app/api/now-playing/route.ts"), "utf8");
  assert.match(page, /^export const instant = false;$/m);
  for (const [name, text] of [
    ["page", page],
    ["route", route],
  ]) {
    assert.match(text, /import \{ readNowPlaying \} from "@\/lib\/now-playing";/, name);
    assert.match(text, /import \{ connection \} from "next\/server";/, name);
    const wait = text.indexOf("await connection();");
    const reading = text.indexOf("await readNowPlaying()");
    assert.ok(wait > 0 && reading > wait, `${name}: connection() must come before readNowPlaying()`);
    assert.equal(text.match(/readNowPlaying\(\)/g)?.length, 1, name);
  }
  // The page reads before any <Suspense>, so the reading is in the first HTML.
  const body = page.slice(page.indexOf("export default async function MusicPage"));
  assert.ok(body.indexOf("await readNowPlaying()") < body.indexOf("<Suspense"), "the reading is outside Suspense");
  // GET only, sanitized output, no knob a visitor can turn.
  assert.match(route, /export async function GET\(\)/);
  assert.doesNotMatch(route, /export (?:async )?function (?:POST|PUT|PATCH|DELETE)/);
  assert.doesNotMatch(route, /searchParams|request\.|req\.|revalidate(?:Tag|Path)|updateTag|cookies\(|headers\(/);
  assert.match(route, /sanitize\(/);
  assert.equal(relative(ROOT, join(ROOT, "app/api/now-playing/route.ts")), "app/api/now-playing/route.ts");
});

const LB = JSON.parse(readFileSync(join(ROOT, 'lib/fixtures/listenbrainz.json'), 'utf8'));
test("ListenBrainz configuration: explicit env beats public default; invalid names are off", () => {
  assert.equal(configFrom({}, "Owner").listenbrainz?.user, "Owner");
  assert.equal(configFrom({ LISTENBRAINZ_USER: "Env Owner" }, "Owner").listenbrainz?.user, "Env Owner");
  for (const user of ["", "../other", "x/y", "x\ny", "a".repeat(65)]) assert.equal(configFrom({ LISTENBRAINZ_USER: user }, "Owner").listenbrainz, null);
  assert.equal(configFrom({ LISTENBRAINZ_USER: "Owner", NOW_PLAYING_LISTENBRAINZ_HOST: "https://evil.example" }).hosts.listenbrainz, "https://api.listenbrainz.org");
});
test("ListenBrainz reads concurrently under one abort budget and wins selection without reading Spotify", async () => {
  const calls: Call[] = [];
  const config = configFrom({ ...SECRETS, LISTENBRAINZ_USER: "Nhạc Owner", NOW_PLAYING_LISTENBRAINZ_HOST: "http://127.0.0.1:4134" });
  let release!: () => void;
  const bothStarted = new Promise<void>((resolve) => { release = resolve; });
  const fetcher = async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    if (url.includes("steampowered")) return json(PLAYER());
    if (calls.filter(c => c.url.includes("4134")).length === 2) release();
    await bothStarted;
    return json(url.endsWith("playing-now") ? LB.current : LB.last);
  };
  const r = await readProviders(config, fetcher, () => AT);
  assert.equal(r.music.source, "listenbrainz");
  assert.equal(r.music.state, "fixture");
  assert.equal(r.spotify, "spotify-off");
  assert.equal(r.track?.playing, true);
  assert.equal(r.track?.title, "Fixture Brainz Track");
  assert.equal(r.play.source, "steam");
  assert.equal(calls.length, 3);
  const lb = calls.filter(c => c.url.includes("4134"));
  assert.equal(lb[0].init.signal, lb[1].init.signal);
  for (const c of lb) {
    assert.ok(c.url.includes('/1/user/Nh%E1%BA%A1c%20Owner/'));
    assert.equal(c.init.redirect, "error");
    assert.equal(new Headers(c.init.headers).get('user-agent'), 'otohime.dev/1.0 (+https://otohime.dev)');
    assert.equal(new Headers(c.init.headers).get('accept'), 'application/json');
  }
});
test("ListenBrainz endpoint failures isolate, valid empty connects, selected failures never fall back", async () => {
  const config = configFrom({ ...SECRETS, LISTENBRAINZ_USER: "Owner" });
  for (const [current, last, state, title] of [
    [LB.emptyCurrent, LB.last, "live", "Fixture Last Track"],
    [LB.current, new Response("", {status:429}), "live", "Fixture Brainz Track"],
    [new Response("<html>challenge</html>", {headers:{'content-type':'text/html'}}), LB.last, "live", "Fixture Last Track"],
    [LB.emptyCurrent, LB.emptyLast, "live", null],
    [{ error: "bad" }, { error: "bad" }, "quiet", null],
    [new Response("{bad", {headers:{'content-type':'application/json'}}), new Response("",{status:404}), "quiet", null],
    [new Response("", {status:302, headers:{location:'https://evil.example'}}), null, "quiet", null],
  ] as const) {
    const calls: string[] = [];
    const r = await readProviders(config, async (url) => {
      calls.push(url);
      if (url.includes('steampowered')) return json(PLAYER());
      const body = url.endsWith('playing-now') ? current : last;
      return body instanceof Response ? body.clone() : json(body);
    });
    assert.equal(r.music.state, state);
    assert.equal(r.track?.title ?? null, title);
    assert.equal(r.spotify, 'spotify-off');
    assert.equal(r.steam, 'steam-live');
    assert.equal(calls.length, 3);
    assert.ok(!calls.some(url => url.includes('spotify')));
  }
});
test("ListenBrainz hung endpoints share the four-second deadline, with no retry", async () => {
  const alive = setInterval(() => {}, 1000);
  const calls: Call[] = [];
  const start = Date.now();
  const r = await readProviders(configFrom({LISTENBRAINZ_USER:'Owner'}), async (url, init) => {
    calls.push({url,init});
    return new Promise((_, reject) => init.signal?.addEventListener('abort', () => reject(init.signal?.reason)));
  }).finally(() => clearInterval(alive));
  assert.equal(r.music.state, 'quiet');
  assert.equal(calls.length, 2);
  assert.ok(Date.now() - start >= 3900 && Date.now() - start < 5500);
});

const LANYARD_ID = "123456789012345678";
const LY = JSON.parse(readFileSync(join(ROOT, "lib/fixtures/lanyard.json"), "utf8"));
test("Lanyard configuration uses env over the empty server default; identifiers and hosts are validated", () => {
  assert.equal(configFrom({}).lanyard, null);
  assert.deepEqual(configFrom({}, "", LANYARD_ID).lanyard, { id: LANYARD_ID });
  assert.equal(configFrom({LANYARD_USER_ID:""}, "", LANYARD_ID).lanyard, null);
  for (const id of ["1".repeat(16), "1".repeat(21), "12345678901234567x", " 123456789012345678", "123456789012345678\n"]) assert.equal(configFrom({LANYARD_USER_ID:id}).lanyard, null, id);
  for (const id of ["1".repeat(17), "1".repeat(20)]) assert.equal(configFrom({LANYARD_USER_ID:id}).lanyard?.id, id);
  assert.equal(configFrom({NOW_PLAYING_LANYARD_HOST:"https://evil.example"}).hosts.lanyard, "https://api.lanyard.rest");
  assert.equal(configFrom({NOW_PLAYING_LANYARD_HOST:"http://localhost:4135"}).fixture.lanyard, true);
});
test("Lanyard selected games and valid empty presence keep music independent and Steam unasked", async () => {
  for (const fixture of [false, true]) for (const key of ["game", "empty", "spotify", "invalidActivities"]) {
    const f = fake();
    const seen: Call[] = [];
    const config = configFrom({...SECRETS, LANYARD_USER_ID:LANYARD_ID, ...(fixture ? {NOW_PLAYING_LANYARD_HOST:"http://127.0.0.1:4135"} : {})});
    const r = await readProviders(config, async (url, init) => {
      if (!url.includes("/v1/users/")) return f.fetcher(url, init);
      seen.push({url, init}); return json(LY[key]);
    });
    assert.equal(r.play.source, "lanyard");
    assert.equal(r.play.state, fixture ? "fixture" : "live");
    assert.deepEqual(r.game, key === "game" ? {title:"Fixture Lanyard Game",url:null} : null);
    assert.equal(r.steam, "steam-off");
    assert.equal(r.track?.title, "Nicole Kidman");
    assert.equal(f.calls.length, 2);
    assert.equal(seen.length, 1);
    assert.equal(seen[0].url, `${config.hosts.lanyard}/v1/users/${LANYARD_ID}`);
    assert.equal(seen[0].init.redirect, "error");
    assert.ok(seen[0].init.signal instanceof AbortSignal);
    assert.deepEqual(seen[0].init.headers, {"user-agent":"otohime.dev/1.0 (+https://otohime.dev)",accept:"application/json"});
    assert.doesNotMatch(JSON.stringify(r), /123456789012345678|PrivateFixture|application_id/);
  }
});
test("Lanyard errors, HTML, invalid JSON, redirects and abort are quiet without provider fallback", async () => {
  const keeper = setInterval(() => {}, 1000);
  try {
    for (const answer of [json(LY.unknown), json({},429), json({},500), json({},302), json({success:true,data:{activities:null}}), new Response("<html>challenge</html>", {headers:{"content-type":"text/html"}}), new Response("bad",{headers:{"content-type":"application/json"}}), new Error("redirect refused"), "hang"]) {
      const f = fake(); let requests = 0;
      const start = performance.now();
      const r = await readProviders(configFrom({...SECRETS,LANYARD_USER_ID:LANYARD_ID}), async (url, init) => {
        if (!url.includes("/v1/users/")) return f.fetcher(url, init);
        requests++;
        if (answer === "hang") return new Promise((_, reject) => init.signal?.addEventListener("abort", () => reject(init.signal?.reason)));
        if (answer instanceof Error) throw answer;
        return (answer as Response).clone();
      });
      assert.deepEqual(r.play, {source:"lanyard",state:"quiet",profileUrl:null});
      assert.equal(r.game, null);
      assert.equal(r.track?.title,"Nicole Kidman");
      assert.equal(r.steam,"steam-off");
      assert.equal(f.calls.length,2);
      assert.equal(requests,1);
      if (answer === "hang") assert.ok(performance.now()-start >= 3500 && performance.now()-start < 6500);
    }
    const r = await readProviders(configFrom({...SECRETS,LANYARD_USER_ID:LANYARD_ID}), async (url) => url.includes("/v1/users/") ? json(LY.game) : json({},401));
    assert.equal(r.music.state,"quiet");
    assert.equal(r.game?.title,"Fixture Lanyard Game");
  } finally { clearInterval(keeper); }
});
