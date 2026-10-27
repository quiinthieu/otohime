#!/usr/bin/env bash
# Walk Music's Now playing shelf over HTTP, one "ok -" / "not ok -" line per check.
#
#   bash scripts/walk-now-playing.sh                                # build + next start on :4121, walk it
#   SKIP_BUILD=1 PORT=4122 bash scripts/walk-now-playing.sh         # reuse an existing .next build
#   QUIET_ONLY=1 SKIP_BUILD=1 bash scripts/walk-now-playing.sh      # only the quiet face, no provider configured
#   BASE_URL=https://otohime.dev bash scripts/walk-now-playing.sh   # read-only: the shelf's shape, no fakes
#
# The quiet walk serves the production build with every provider variable unset: /music must hold exactly one
# shelf in the first HTML (outside any streamed boundary, so it is there with JavaScript off), both labels quiet,
# the playlist link, the static "Playing" line from content/site.ts, both credits, and the television, listings
# and Ink Radio as before, with no owner tools for a visitor; GET /api/now-playing is 200 with both providers off.
#
# Without QUIET_ONLY=1 it then serves the build against loopback fakes for Spotify's token and API hosts and for
# Steam (node scripts/probe-cassette.mjs fake), with throwaway sentinel credentials that exist only for this run:
# the first read asks each fake once; /music then prints the very reading the API returned (same read time, no new
# request); a changed answer stays cached until the cache clock (a --require preload that shifts performance.now,
# which Next's "use cache" handler reads) moves 61 s on; 204, 401, 429, a malformed body, a private session, a
# failed token, a private or broken Steam profile and capped long labels each give a safe 200 with the other
# provider unharmed; a 10 s hang is cut at the 4 s budget; query strings, POST and a dead upstream change nothing;
# no sentinel shows in any response, client chunk or the server's log. Then a server with Spotify on a dead port,
# and one with no credentials (which must not ask the fakes anything). A build this walk runs itself has the fakes
# and sentinels in its env and must make no request; the full fixture walk runs this build even with SKIP_BUILD=1.
# Build output is also checked for prerendered readings. Production code has no fixture switch: the fakes are reached only through the loopback-only
# NOW_PLAYING_*_HOST overrides, and through them the state says *-fixture, never *-live.
#
# Env: PORT (4121), BASE_URL (read-only mode), EXPECT_SHA (build-sha to expect; defaults to GITHUB_SHA locally,
# any 40-hex sha remotely; with SKIP_BUILD=1 and neither set, a 40-hex sha or "dev" passes), SKIP_BUILD=1,
# QUIET_ONLY=1, FAKE_PORT (4131; the fakes use it and the next two). Counts use grep -c and numeric tests only: BSD wc pads its output. Things are counted by attribute
# form (data-face=") because App Router repeats the server's text in the inline RSC payload.
# No `set -e`: every check runs, and the summary names the ones that failed.
set -u

cd "$(dirname "$0")/.." || exit 2
ROOT="$(pwd)"

PORT="${PORT:-4121}"
BASE_URL="${BASE_URL:-}"
EXPECT_SHA="${EXPECT_SHA:-}"
QUIET_ONLY="${QUIET_ONLY:-}"
WORK="$(mktemp -d "${TMPDIR:-/tmp}/walk-now-playing.XXXXXX")"
SERVER_PID=""
FAKE_PID=""
FAKE_DIR="$WORK/fake"
FAKE_PORT="${FAKE_PORT:-4131}"
FAKE_TOKEN_PORT="$FAKE_PORT"
FAKE_API_PORT="$((FAKE_PORT + 1))"
FAKE_STEAM_PORT="$((FAKE_PORT + 2))"
FAKE_LISTENBRAINZ_PORT="$((FAKE_PORT + 3))"
FAKE_LANYARD_PORT="$((FAKE_PORT + 4))"
OK=0
FAILED=0

# kill_group <pid>: the process was started under job control, so its pid is its process group id.
kill_group() {
  [ -n "$1" ] || return 0
  kill -TERM -- "-$1" 2>/dev/null
  for _ in 1 2 3 4 5 6 7 8 9 10; do
    kill -0 -- "-$1" 2>/dev/null || break
    sleep 0.5
  done
  kill -KILL -- "-$1" 2>/dev/null
}

cleanup() {
  kill_group "$SERVER_PID"
  kill_group "$FAKE_PID"
  rm -rf "$WORK"
}
trap cleanup EXIT
trap 'exit 130' INT TERM

# check <name> <command...>: the command's output is the detail when it returns non-zero.
check() {
  local name="$1" out
  shift
  if out="$("$@" 2>&1)"; then
    OK=$((OK + 1))
    echo "ok - $name"
  else
    FAILED=$((FAILED + 1))
    echo "not ok - $name: $(printf '%s' "$out" | tr '\n' ' ' | cut -c1-300)"
  fi
}

# The provider variables lib/now-playing.ts reads. Every server this walk starts gets exactly the ones it names.
PROVIDER_VARS="LANYARD_USER_ID NOW_PLAYING_LANYARD_HOST LISTENBRAINZ_USER NOW_PLAYING_LISTENBRAINZ_HOST SPOTIFY_CLIENT_ID SPOTIFY_CLIENT_SECRET SPOTIFY_REFRESH_TOKEN STEAM_API_KEY STEAM_ID NOW_PLAYING_SPOTIFY_ACCOUNTS_HOST NOW_PLAYING_SPOTIFY_API_HOST NOW_PLAYING_STEAM_HOST"

# start_server [VAR=value...]: next start on $PORT in its own process group, with every provider variable unset
# and then the given ones set.
start_server() {
  local unset_args=() v
  for v in $PROVIDER_VARS; do unset_args+=(-u "$v"); done
  set -m
  env "${unset_args[@]}" "$@" ./node_modules/.bin/next start -p "$PORT" >"$WORK/server.log" 2>&1 &
  SERVER_PID=$!
  set +m
}

stop_server() {
  kill_group "$SERVER_PID"
  SERVER_PID=""
}

# wait_ready: the site answers at $BASE_URL/ within READY_TRIES seconds, from our own server.
wait_ready() {
  local ready=0
  for _ in $(seq 1 "$READY_TRIES"); do
    if curl -s -o /dev/null --max-time 5 "$BASE_URL/"; then
      ready=1
      break
    fi
    sleep 1
  done
  if [ "$ready" -ne 1 ] || { [ "$LOCAL" -eq 1 ] && ! kill -0 "$SERVER_PID" 2>/dev/null; }; then
    echo "not ok - ready: our server did not answer at $BASE_URL after $READY_TRIES tries"
    [ "$LOCAL" -eq 1 ] && [ -s "$WORK/server.log" ] && tail -n 20 "$WORK/server.log"
    echo "walk: $OK ok, $((FAILED + 1)) failed"
    exit 1
  fi
}

# Throwaway credentials for this run only: the fakes accept exactly these, and no response may ever contain one.
RUN_ID="$(node -e 'console.log(require("crypto").randomBytes(8).toString("hex"))')"
SENT_ID="SentinelId$RUN_ID"
SENT_SECRET="SentinelSecret$RUN_ID"
SENT_REFRESH="Sentinel-Refresh_$RUN_ID"
SENT_KEY="SentinelSteamKey$RUN_ID"
SENT_STEAM_ID="76561197960435530"
SENTINELS="$SENT_ID,$SENT_SECRET,$SENT_REFRESH,$SENT_KEY,$SENT_STEAM_ID,FakeAccessToken0123456789abcdef,123456789012345678,PrivateFixtureName,PrivateFixtureAvatar,PrivateFixtureFriends"
CREDS=(SPOTIFY_CLIENT_ID="$SENT_ID" SPOTIFY_CLIENT_SECRET="$SENT_SECRET" SPOTIFY_REFRESH_TOKEN="$SENT_REFRESH" STEAM_API_KEY="$SENT_KEY" STEAM_ID="$SENT_STEAM_ID")
HOSTS=(NOW_PLAYING_SPOTIFY_ACCOUNTS_HOST="http://127.0.0.1:$FAKE_TOKEN_PORT" NOW_PLAYING_SPOTIFY_API_HOST="http://127.0.0.1:$FAKE_API_PORT" NOW_PLAYING_STEAM_HOST="http://127.0.0.1:$FAKE_STEAM_PORT")
FIXTURE_ENV=()
[ "$QUIET_ONLY" = "1" ] || FIXTURE_ENV=("${CREDS[@]}" "${HOSTS[@]}" LISTENBRAINZ_USER="Fixture Owner" NOW_PLAYING_LISTENBRAINZ_HOST="http://127.0.0.1:$FAKE_LISTENBRAINZ_PORT" LANYARD_USER_ID="123456789012345678" NOW_PLAYING_LANYARD_HOST="http://127.0.0.1:$FAKE_LANYARD_PORT")

# The cache clock: performance.now plus the milliseconds in $WORK/clock-offset, re-read at most every 50 ms. Only
# the servers this walk starts load it (NODE_OPTIONS=--require); nothing in the app knows it exists.
cat >"$WORK/clock.cjs" <<'CLOCK'
const fs = require("node:fs");
const file = process.env.WALK_CLOCK_FILE;
const real = performance.now.bind(performance);
let offset = 0;
let readAt = -Infinity;
performance.now = () => {
  const t = real();
  if (t - readAt > 50) {
    readAt = t;
    try {
      offset = Number(fs.readFileSync(file, "utf8")) || 0;
    } catch {
      offset = 0;
    }
  }
  return t + offset;
};
CLOCK
CLOCK_MS=0
printf '0' >"$WORK/clock-offset"
CLOCK_ENV=(NODE_OPTIONS="--require \"$WORK/clock.cjs\"" WALK_CLOCK_FILE="$WORK/clock-offset")

# start_fakes: the three loopback providers, answering $FAKE_DIR/mode.json, logging to $FAKE_DIR/requests.log.
start_fakes() {
  local p
  mkdir -p "$FAKE_DIR"
  : >"$FAKE_DIR/requests.log"
  printf '{}' >"$FAKE_DIR/mode.json"
  for p in "$FAKE_TOKEN_PORT" "$FAKE_API_PORT" "$FAKE_STEAM_PORT" "$FAKE_LISTENBRAINZ_PORT" "$FAKE_LANYARD_PORT"; do
    if curl -s -o /dev/null --max-time 2 "http://127.0.0.1:$p/"; then
      echo "not ok - fakes: port $p is taken; set FAKE_PORT to a free range of three"
      return 1
    fi
  done
  set -m
  env "${CREDS[@]}" FAKE_DIR="$FAKE_DIR" FAKE_TOKEN_PORT="$FAKE_TOKEN_PORT" FAKE_API_PORT="$FAKE_API_PORT" FAKE_STEAM_PORT="$FAKE_STEAM_PORT" FAKE_LISTENBRAINZ_PORT="$FAKE_LISTENBRAINZ_PORT" FAKE_LANYARD_PORT="$FAKE_LANYARD_PORT" \
    node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON \
    "$ROOT/scripts/probe-cassette.mjs" fake >"$WORK/fake.log" 2>&1 &
  FAKE_PID=$!
  set +m
  for _ in $(seq 1 50); do
    [ -f "$FAKE_DIR/ready" ] && return 0
    sleep 0.2
  done
  echo "not ok - fakes: the loopback providers did not start; log:"
  tail -n 20 "$WORK/fake.log"
  return 1
}

if [ -z "$BASE_URL" ]; then
  LOCAL=1
  BASE_URL="http://localhost:$PORT"
  export BETTER_AUTH_SECRET="${BETTER_AUTH_SECRET:-ci-placeholder-not-a-real-secret-0123456789abcdef}"
  export BETTER_AUTH_URL="${BETTER_AUTH_URL:-http://localhost:$PORT}"
  export DATABASE_URL="${DATABASE_URL:-postgresql://otohime:otohime@127.0.0.1:9/otohime}"
  if [ "${SKIP_BUILD:-}" = "1" ] && [ -z "$EXPECT_SHA" ] && [ -z "${GITHUB_SHA:-}" ]; then
    ANY_SHA_OR_DEV=1
  fi
  export GITHUB_SHA="${GITHUB_SHA:-0123456789abcdef0123456789abcdef01234567}"
  [ -n "${ANY_SHA_OR_DEV:-}" ] || EXPECT_SHA="${EXPECT_SHA:-$GITHUB_SHA}"
  READY_TRIES=60

  if curl -s -o /dev/null --max-time 2 "$BASE_URL/"; then
    echo "not ok - port: something already listens on port $PORT; set PORT to a free port"
    exit 1
  fi

  if [ "$QUIET_ONLY" != "1" ]; then
    start_fakes || exit 1
  fi
  if [ "${SKIP_BUILD:-}" != "1" ] || [ "$QUIET_ONLY" != "1" ]; then
    # With the fakes up and the sentinels set, so a build that read a provider would be caught.
    if ! env ${FIXTURE_ENV[@]+"${FIXTURE_ENV[@]}"} npm run build >"$WORK/build.log" 2>&1; then
      echo "not ok - build: npm run build failed; log:"
      cat "$WORK/build.log"
      exit 1
    fi
  fi
  start_server
else
  LOCAL=0
  BASE_URL="${BASE_URL%/}"
  READY_TRIES=5
fi
wait_ready

# get <key> <path> [curl args...]: fetch once, never following a redirect; status in $WORK/<key>.status,
# body in $WORK/<key>.body, seconds in $WORK/<key>.time.
get() {
  local key="$1" path="$2" out
  shift 2
  out="$(LC_ALL=C curl -s --max-time 30 -o "$WORK/$key.body" -w '%{http_code} %{time_total}' "$@" "$BASE_URL$path")"
  printf '%s' "${out%% *}" >"$WORK/$key.status"
  printf '%s' "${out#* }" >"$WORK/$key.time"
}

status_is() {
  local got
  got="$(cat "$WORK/$1.status" 2>/dev/null)"
  [ "$got" = "$2" ] || { echo "expected HTTP $2, got ${got:-none}"; return 1; }
}

has() {
  [ -f "$WORK/$1.body" ] && grep -qF -- "$2" "$WORK/$1.body" || { echo "missing: $2"; return 1; }
}
lacks() {
  [ -f "$WORK/$1.body" ] || { echo "no body"; return 1; }
  ! grep -qF -- "$2" "$WORK/$1.body" || { echo "unexpected: $2"; return 1; }
}

count_eq() {
  local n
  [ -f "$WORK/$1.body" ] || { echo "no body"; return 1; }
  n="$(grep -oF -- "$2" "$WORK/$1.body" | grep -c .)"
  [ "$n" -eq "$3" ] || { echo "found $n of '$2', want exactly $3"; return 1; }
}

build_sha_matches() {
  local sha
  sha="$(grep -oE '<meta name="build-sha" content="[^"]*"' "$WORK/$1.body" | head -n 1 | sed -E 's/.*content="([^"]*)"/\1/')"
  if [ -n "$EXPECT_SHA" ]; then
    [ "$sha" = "$EXPECT_SHA" ] || { echo "build-sha is '${sha:-none}', want $EXPECT_SHA"; return 1; }
  elif [ -n "${ANY_SHA_OR_DEV:-}" ]; then
    printf '%s' "$sha" | grep -qE '^([0-9a-f]{40}|dev)$' || { echo "build-sha is '${sha:-none}', want 40 hex or dev"; return 1; }
  else
    printf '%s' "$sha" | grep -qE '^[0-9a-f]{40}$' || { echo "build-sha is '${sha:-none}', want 40 hex"; return 1; }
  fi
}

# shelf <key>: the shelf's own markup, from its <section> to its </section>, in $WORK/<key>.shelf.
shelf() {
  node -e '
    const html = require("fs").readFileSync(process.argv[1], "utf8");
    const at = html.indexOf("<section aria-labelledby=\"now-playing\"");
    if (at < 0) process.exit(1);
    const end = html.indexOf("</section>", at);
    require("fs").writeFileSync(process.argv[2], html.slice(at, end + 10));
  ' "$WORK/$1.body" "$WORK/$1.shelf" || { echo "no Now playing section"; return 1; }
}

# in_shelf <key> <fixed-text> / not_in_shelf <key> <fixed-text>: within the shelf's markup only.
in_shelf() {
  grep -qF -- "$2" "$WORK/$1.shelf" 2>/dev/null || { echo "shelf lacks: $2"; return 1; }
}
not_in_shelf() {
  [ -f "$WORK/$1.shelf" ] || { echo "no shelf"; return 1; }
  ! grep -qF -- "$2" "$WORK/$1.shelf" || { echo "shelf has: $2"; return 1; }
}

# first_html <key>: the shelf is in the document's first pass, before any streamed boundary's hidden content
# (<div hidden id="S:...">), so a browser with JavaScript off shows it.
first_html() {
  node -e '
    const html = require("fs").readFileSync(process.argv[1], "utf8");
    const at = html.indexOf("data-now-playing=\"\"");
    const hidden = html.search(/<div hidden id="S:/);
    if (at < 0) { console.log("no shelf"); process.exit(1); }
    if (hidden >= 0 && hidden < at) { console.log(`shelf at ${at} is after streamed content at ${hidden}`); process.exit(1); }
  ' "$WORK/$1.body"
}

# The "Playing" line of site.now in content/site.ts: the cartridge's static label.
STATIC_GAME="$(sed -nE 's/^ *\{ what: "Playing", note: "([^"]*)" \},$/\1/p' content/site.ts | head -n 1)"
PLAYLIST_ID="$(sed -nE 's/^  playlist: "([^"]*)",$/\1/p' content/site.ts | head -n 1)"

# quiet_face <key>: both labels at rest, with the static words and both credits.
quiet_face() {
  local key="$1"
  check "$key: 200" status_is "$key" 200
  check "$key: one shelf" count_eq "$key" 'data-now-playing=""' 1
  check "$key: shelf in the first HTML, outside any boundary" first_html "$key"
  check "$key: shelf markup" shelf "$key"
  check "$key: one cassette, quiet" count_eq "$key" 'class="tape" data-face="quiet"' 1
  check "$key: one cartridge, quiet" count_eq "$key" 'class="game-cart" data-face="quiet"' 1
  check "$key: reels still" not_in_shelf "$key" 'data-spin'
  check "$key: the quiet tape's words" in_shelf "$key" 'Nothing on the deck right now.'
  check "$key: the playlist link" in_shelf "$key" "href=\"https://open.spotify.com/playlist/$PLAYLIST_ID\""
  check "$key: static game line ($STATIC_GAME)" in_shelf "$key" "$STATIC_GAME"
  check "$key: Spotify credit" in_shelf "$key" 'href="https://www.spotify.com"'
  check "$key: Steam credit" in_shelf "$key" 'href="https://store.steampowered.com"'
}

# json_is <key> <js predicate over r>: the body parses as JSON and the predicate holds.
json_is() {
  node -e '
    const r = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
    if (!new Function("r", `return (${process.argv[2]});`)(r)) { console.log(JSON.stringify(r).slice(0, 280)); process.exit(1); }
  ' "$WORK/$1.body" "$2"
}

# fails <command...>: the command fails. Each negative control runs a check's own assertion on doctored input.
fails() {
  ! "$@" >/dev/null 2>&1 || { echo "the assertion passed on input it must reject"; return 1; }
}

# --- The quiet face: no provider configured ---------------------------------------------------------------------

get music /music
check "music: build-sha" build_sha_matches music
if [ "$LOCAL" -eq 1 ]; then
  quiet_face music
  check "music: providers off" in_shelf music 'data-spotify="spotify-off" data-steam="steam-off"'
  check "music: says it was not read live" in_shelf music 'Not read live'
  check "music: no read stamp" not_in_shelf music '<time'
else
  check "music: one shelf" count_eq music 'data-now-playing=""' 1
  check "music: shelf in the first HTML, outside any boundary" first_html music
fi
check "music: television still there" has music 'The playlist on Spotify'
check "music: listings still there" node -e '
  const html = require("fs").readFileSync(process.argv[1], "utf8");
  const headings = [...html.matchAll(/<h2\b[^>]*>([\s\S]*?)<\/h2>/g)];
  if (!headings.some(([, h]) => /class="riso-source(?:\s[^"]*)?"[^>]*>Listings<\/span>/.test(h))) process.exit(1);
' "$WORK/music.body"
check "music: Ink Radio still there" has music 'id="ink-radio"'
check "music: no owner tools for a visitor" lacks music 'Add a channel'
if [ "$LOCAL" -eq 1 ]; then
  { printf '<div hidden id="S:0"></div>'; cat "$WORK/music.body"; } >"$WORK/streamed.body"
  check "control: a shelf after streamed content is caught" fails first_html streamed
  sed 's/class="tape" data-face="quiet"/class="tape" data-face="track"/' "$WORK/music.body" >"$WORK/wrongface.body"
  check "control: a cassette that is not quiet is caught" fails count_eq wrongface 'class="tape" data-face="quiet"' 1
fi
get api /api/now-playing
check "api: 200" status_is api 200
if [ "$LOCAL" -eq 1 ]; then
  check "api, nothing configured: both providers off" json_is api 'r.spotify === "spotify-off" && r.steam === "steam-off" && r.track === null && r.game === null'
else
  check "api: a known state for each provider" json_is api '/^spotify-(off|quiet|live)$/.test(r.spotify) && /^steam-(off|quiet|live)$/.test(r.steam)'
fi

# --- The fake providers ------------------------------------------------------------------------------------------

if [ "$LOCAL" -eq 1 ] && [ "$QUIET_ONLY" != "1" ]; then

stop_server

# calls <role>: requests the fakes have logged for that role (token, api, steam).
calls() {
  local n
  n="$(grep -c "^$1 " "$FAKE_DIR/requests.log" 2>/dev/null)"
  printf '%s' "${n:-0}"
}
# mark: remember the counts; delta <token> <api> <steam>: exactly that many new requests since the mark.
mark() {
  MARK_T="$(calls token)"
  MARK_A="$(calls api)"
  MARK_S="$(calls steam)"
}
delta() {
  local t a s
  t=$(($(calls token) - MARK_T))
  a=$(($(calls api) - MARK_A))
  s=$(($(calls steam) - MARK_S))
  [ "$t $a $s" = "$1 $2 $3" ] || { echo "new requests token/api/steam: $t/$a/$s, want $1/$2/$3"; return 1; }
}
no_bad_auth() {
  ! grep -q 'auth=bad' "$FAKE_DIR/requests.log" || { echo "a fake saw wrong credentials: $(grep 'auth=bad' "$FAKE_DIR/requests.log" | head -n 3 | tr '\n' ' ')"; return 1; }
}

# set_mode <json>: what the fakes answer next. advance [ms]: move the cache clock on (default 61 s).
set_mode() {
  printf '%s' "$1" >"$FAKE_DIR/mode.json"
}
advance() {
  CLOCK_MS=$((CLOCK_MS + ${1:-61000}))
  printf '%s' "$CLOCK_MS" >"$WORK/clock-offset"
  sleep 0.2
}

# same_read <api-key> <music-key>: the page printed the reading the API returned: same read time, same labels.
same_read() {
  node -e '
    const fs = require("fs");
    const r = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
    const html = fs.readFileSync(process.argv[2], "utf8");
    const at = html.indexOf("<section aria-labelledby=\"now-playing\"");
    const shelf = html.slice(at, html.indexOf("</section>", at));
    const esc = (t) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    const want = [`data-spotify="${r.spotify}" data-steam="${r.steam}"`];
    want.push(`data-music-source="${r.music.source ?? "none"}"`, `data-music-state="${r.music.state}"`);
    want.push(`data-play-source="${r.play.source ?? "none"}"`, `data-play-state="${r.play.state}"`);
    if (r.track?.listenedAt) want.push(`dateTime="${r.track.listenedAt}"`);
    if (r.readAt && (r.music.state !== "off" || r.play.state !== "off")) want.push(`dateTime="${r.readAt}"`);
    if (r.track) want.push(esc(r.track.title), "data-face=\"track\"");
    else want.push("class=\"tape\" data-face=\"quiet\"");
    if (r.game) want.push(esc(r.game.title), "data-face=\"game\"");
    else want.push("class=\"game-cart\" data-face=\"quiet\"");
    const missing = want.filter((w) => !shelf.includes(w));
    if (at < 0 || missing.length) { console.log(`page lacks ${missing.join(" | ")}`); process.exit(1); }
  ' "$WORK/$1.body" "$WORK/$2.body"
}

# exact_keys <key>: the API's whole answer is the sanitized display shape, nothing more.
exact_keys() {
  json_is "$1" 'JSON.stringify(Object.keys(r.music)) === JSON.stringify(["source","state","profileUrl"]) && JSON.stringify(Object.keys(r.play)) === JSON.stringify(["source","state","profileUrl"]) && JSON.stringify(Object.keys(r)) === JSON.stringify(["music","play","spotify","track","steam","game","readAt"]) && (r.track === null || JSON.stringify(Object.keys(r.track)) === JSON.stringify(r.music.source === "listenbrainz" ? ["title","artists","url","playing","listenedAt"] : ["title","artists","url","playing"])) && (r.game === null || JSON.stringify(Object.keys(r.game)) === JSON.stringify(["title","url"]))'
}

# no_sentinel <file...>: none of this run's credentials, nor the fake access token, in these files.
no_sentinel() {
  local f s
  for f in "$@"; do
    [ -f "$f" ] || continue
    for s in ${SENTINELS//,/ }; do
      ! grep -qF -- "$s" "$f" || { echo "$(basename "$f") contains a sentinel (${s:0:10}...)"; return 1; }
    done
  done
}

# chunks <music-key>: fetch every script the page references into $WORK/chunks/, for the sentinel scan.
chunks() {
  local src n=0
  mkdir -p "$WORK/chunks"
  for src in $(grep -oE '/_next/static/[^"]+\.js' "$WORK/$1.body" | sort -u); do
    curl -s --max-time 10 -o "$WORK/chunks/$n.js" "$BASE_URL$src" && n=$((n + 1))
  done
  [ "$n" -ge 3 ] || { echo "fetched $n scripts, want at least 3"; return 1; }
}

# timed_between <key> <min> <max>: the request took between min and max seconds.
timed_between() {
  node -e 'const t = +process.argv[1]; if (!(t >= +process.argv[2] && t <= +process.argv[3])) { console.log(`took ${t} s`); process.exit(1); }' \
    "$(cat "$WORK/$1.time")" "$2" "$3"
}

# --- No requests at build ---
if [ "${SKIP_BUILD:-}" != "1" ] || [ "$QUIET_ONLY" != "1" ]; then
  check "build: the fakes saw no request while the build ran" test "$(grep -c . "$FAKE_DIR/requests.log")" -eq 0
  check "build: no sentinel in the client output" no_sentinel $(find .next/static -type f -name '*.js')
fi
# /music may have an empty shell in the manifest (it renders blocking, at request time); it must hold no reading.
check "build: the API is not prerendered, and /music's shell is empty" node -e '
  const fs = require("fs");
  const m = JSON.parse(fs.readFileSync(".next/prerender-manifest.json", "utf8"));
  if ("/api/now-playing" in (m.routes || {})) { console.log("/api/now-playing is prerendered"); process.exit(1); }
  const music = m.routes?.["/music"];
  if (music && music.htmlSize !== 0) { console.log(`/music prerendered ${music.htmlSize} bytes`); process.exit(1); }
'
check "build: no prerendered reading on disk" sh -c '! test -e .next/server/app/api/now-playing.body && ! grep -qs "data-now-playing" .next/server/app/music.html .next/server/app/music.rsc' 

# --- A server reading the fakes ---
start_server "${CREDS[@]}" "${HOSTS[@]}" "${CLOCK_ENV[@]}"
wait_ready
check "fixture: starting the server asked no provider" test "$(grep -c . "$FAKE_DIR/requests.log")" -eq 0

set_mode '{"title":"Fixture Track One","game":"Fixture Game One"}'
mark
get api1 /api/now-playing
check "first read: 200" status_is api1 200
check "first read: track and game, as fixture, never live" json_is api1 'r.spotify === "spotify-fixture" && r.steam === "steam-fixture" && r.track.title === "Fixture Track One" && r.track.artists === "Fixture Artist" && r.track.playing === true && r.game.title === "Fixture Game One"'
check "first read: links rebuilt clean" json_is api1 'r.track.url === "https://open.spotify.com/track/FixtureTrack0001" && r.game.url === "https://store.steampowered.com/app/1145350/"'
check "first read: only the display fields" exact_keys api1
check "first read: one token, one track, one Steam request" delta 1 1 1
check "first read: the fakes got the right credentials" no_bad_auth

mark
get music1 /music
check "music: 200" status_is music1 200
check "music: prints the API's reading (same read time and labels)" same_read api1 music1
check "music: no new request (one cached reader for both)" delta 0 0 0
check "music: the reading is in the first HTML" first_html music1
check "music: a playing tape's reels may turn" has music1 'class="tape" data-face="track" data-spin=""'
check "music: a visible read stamp" grep -qE 'Read(<!-- -->)? <time dateTime="[^"]+">[0-9]{2}:[0-9]{2} UTC</time>' "$WORK/music1.body"

set_mode '{"title":"Fixture Track Two","game":"Fixture Game Two"}'
mark
get api2 /api/now-playing
check "cached: a changed answer is not read inside the minute" json_is api2 'r.track.title === "Fixture Track One"'
check "cached: no new request" delta 0 0 0

advance
mark
get api3 /api/now-playing
check "61 s on the cache clock: the new answer" json_is api3 'r.track.title === "Fixture Track Two" && r.game.title === "Fixture Game Two"'
check "61 s on: one fresh read of each" delta 1 1 1
check "61 s on: a later read time" node -e 'const f = (k) => JSON.parse(require("fs").readFileSync(`'"$WORK"'/${k}.body`, "utf8")).readAt; if (!(f("api3") > f("api1"))) process.exit(1);'
mark
get music3 /music
check "61 s on: the page agrees, without asking again" same_read api3 music3
check "61 s on: no new request for the page" delta 0 0 0

# Bypass controls a visitor might try: none exist.
mark
get byq '/api/now-playing?refresh=1&fixture=1&host=http://127.0.0.1:9&nocache=1'
check "query strings: the same cached reading" node -e 'const f = (k) => JSON.parse(require("fs").readFileSync(`'"$WORK"'/${k}.body`, "utf8")).readAt; if (f("byq") !== f("api3")) process.exit(1);'
get bym '/music?refresh=1&fixture=1'
check "query strings on /music: the same reading" same_read api3 bym
check "query strings: no new request" delta 0 0 0
get post /api/now-playing -X POST
check "POST /api/now-playing: 405" status_is post 405
get purge /api/now-playing/revalidate
check "no purge endpoint: 404" status_is purge 404

# Each failure is a safe 200, and the other provider is unharmed. read_case <name> <mode> <predicate> <token> <api> <steam>
read_case() {
  set_mode "$2"
  advance
  mark
  get "case" /api/now-playing
  check "$1: 200" status_is case 200
  check "$1: $3" json_is case "$3"
  check "$1: requests $4/$5/$6, no retries" delta "$4" "$5" "$6"
  check "$1: only the display fields" exact_keys case
  get "case-music" /music
  check "$1: /music 200 and agrees" same_read case case-music
  shelf case-music >/dev/null
}
read_case "204 nothing playing" '{"track":"204"}' 'r.spotify === "spotify-fixture" && r.track === null && r.steam === "steam-fixture" && r.game.title === "Fixture Game"' 1 1 1
check "204: the tape shows the quiet face" has case-music 'class="tape" data-face="quiet"'
read_case "paused" '{"track":"paused"}' 'r.track.playing === false && r.track.title === "Fixture Track One"' 1 1 1
check "paused: the reels are still" sh -c 'shelf_file="$1"; ! grep -q "data-spin" "$shelf_file"' _ "$WORK/case-music.shelf"
read_case "track 401" '{"track":"401"}' 'r.spotify === "spotify-quiet" && r.track === null && r.steam === "steam-fixture" && r.game.title === "Fixture Game"' 1 1 1
read_case "track 429" '{"track":"429"}' 'r.spotify === "spotify-quiet" && r.track === null && r.game !== null' 1 1 1
read_case "track malformed" '{"track":"malformed"}' 'r.spotify === "spotify-quiet" && r.track === null && r.game !== null' 1 1 1
read_case "private session" '{"track":"private"}' 'r.spotify === "spotify-quiet" && r.track === null && r.game !== null' 1 1 1
read_case "token 401" '{"token":"401"}' 'r.spotify === "spotify-quiet" && r.track === null && r.game !== null' 1 0 1
read_case "token malformed" '{"token":"malformed"}' 'r.spotify === "spotify-quiet" && r.game !== null' 1 0 1
read_case "Steam private" '{"steam":"private"}' 'r.steam === "steam-quiet" && r.game === null && r.spotify === "spotify-fixture" && r.track.title === "Fixture Track One"' 1 1 1
check "Steam private: the cartridge shows the quiet face" has case-music 'class="game-cart" data-face="quiet"'
read_case "Steam idle" '{"steam":"idle"}' 'r.steam === "steam-fixture" && r.game === null && r.track !== null' 1 1 1
read_case "Steam malformed" '{"steam":"malformed"}' 'r.steam === "steam-quiet" && r.game === null && r.track !== null' 1 1 1
read_case "Steam 500" '{"steam":"500"}' 'r.steam === "steam-quiet" && r.game === null && r.track !== null' 1 1 1
read_case "both broken" '{"token":"401","steam":"500"}' 'r.spotify === "spotify-quiet" && r.steam === "steam-quiet" && r.track === null && r.game === null' 1 0 1
check "both broken: the whole quiet face, with the static game line" has case-music "$STATIC_GAME"
read_case "long labels" '{"track":"long","steam":"long"}' '[...r.track.title].length === 64 && r.track.title.endsWith("…") && [...r.track.artists].length === 64 && [...r.game.title].length === 48' 1 1 1
read_case "fixed again" '{}' 'r.spotify === "spotify-fixture" && r.steam === "steam-fixture" && r.track !== null && r.game !== null' 1 1 1

# A hang is cut at the 4 s budget; the other provider still answers.
set_mode '{"track":"slow"}'
advance
mark
get slow /api/now-playing
check "slow Spotify: 200 in 3.5 to 6.5 s (the 4 s abort fired)" timed_between slow 3.5 6.5
check "slow Spotify: quiet, Steam unharmed" json_is slow 'r.spotify === "spotify-quiet" && r.steam === "steam-fixture" && r.game !== null'
check "slow Spotify: the request reached the fake" delta 1 1 1
set_mode '{"steam":"slow","token":"slow"}'
advance
get slow2 /api/now-playing
check "slow everything: 200 in 3.5 to 6.5 s, not 8 (the budgets run side by side)" timed_between slow2 3.5 6.5
check "slow everything: both quiet" json_is slow2 'r.spotify === "spotify-quiet" && r.steam === "steam-quiet"'
set_mode '{}'
advance
get final /api/now-playing
get finalmusic /music

# Nothing secret, anywhere a visitor (or the log) could see it.
printf 'leak %s\n' "$SENT_SECRET" >"$WORK/leak.txt"
check "control: a sentinel in a file is caught" fails no_sentinel "$WORK/leak.txt"
rm -f "$WORK/leak.txt"
check "control: a page with another reading is caught" fails same_read api1 music3
check "scripts: fetched every chunk /music references" chunks finalmusic
check "no sentinel in any HTTP response" no_sentinel "$WORK"/*.body
check "no sentinel in the client chunks" no_sentinel "$WORK"/chunks/*.js
check "no sentinel in the server log" no_sentinel "$WORK/server.log"
check "no provider host in the HTML or chunks" sh -c "! grep -lE 'accounts\.spotify\.com|api\.spotify\.com|api\.steampowered\.com|api\.listenbrainz\.org|api\.lanyard\.rest|127\.0\.0\.1:$FAKE_PORT' '$WORK/finalmusic.body' '$WORK'/chunks/*.js"
check "the fakes never saw a wrong credential" no_bad_auth
stop_server

# --- Spotify's hosts on a dead port, Steam on its fake ---
start_server "${CREDS[@]}" NOW_PLAYING_SPOTIFY_ACCOUNTS_HOST="http://127.0.0.1:9" NOW_PLAYING_SPOTIFY_API_HOST="http://127.0.0.1:9" NOW_PLAYING_STEAM_HOST="http://127.0.0.1:$FAKE_STEAM_PORT"
wait_ready
mark
get dead /api/now-playing
check "dead Spotify: 200 in under 3 s" timed_between dead 0 3
check "dead Spotify: quiet, Steam unharmed" json_is dead 'r.spotify === "spotify-quiet" && r.track === null && r.steam === "steam-fixture" && r.game !== null'
check "dead Spotify: only Steam's fake was asked" delta 0 0 1
get deadmusic /music
check "dead Spotify: /music 200, quiet tape" same_read dead deadmusic
stop_server

# --- Hosts pointed at the fakes, but no credentials: nothing is asked ---
start_server "${HOSTS[@]}"
wait_ready
mark
get nocred /api/now-playing
get nocredmusic /music
check "no credentials: both off" json_is nocred 'r.spotify === "spotify-off" && r.steam === "steam-off"'
check "no credentials: no request at all" delta 0 0 0
quiet_face nocredmusic
stop_server

# --- Selected public ListenBrainz music; keyed Spotify must not be read ---
start_server "${CREDS[@]}" "${HOSTS[@]}" "${CLOCK_ENV[@]}" LISTENBRAINZ_USER="Fixture Owner" NOW_PLAYING_LISTENBRAINZ_HOST="http://127.0.0.1:$FAKE_LISTENBRAINZ_PORT"
wait_ready
lb_case() {
  set_mode "$2"
  advance
  local before after
  before="$(grep -c '^listenbrainz ' "$FAKE_DIR/requests.log")"
  mark
  get lb /api/now-playing
  check "$1: HTTP 200" status_is lb 200
  check "$1: reading" json_is lb "$3"
  check "$1: sanitized shape" exact_keys lb
  after="$(grep -c '^listenbrainz ' "$FAKE_DIR/requests.log")"
  check "$1: exactly two public requests, no retries" test "$((after - before))" -eq 2
  check "$1: Spotify unused, Steam read" delta 0 0 1
  get lbmusic /music
  check "$1: shared cached page/API reading" same_read lb lbmusic
  shelf lbmusic >/dev/null
  check "$1: page uses cache, no new public requests" test "$(grep -c '^listenbrainz ' "$FAKE_DIR/requests.log")" -eq "$after"
}
lb_case "Brainz current" '{}' 'r.music.source === "listenbrainz" && r.music.state === "fixture" && r.spotify === "spotify-off" && r.track.title === "Fixture Brainz Track" && r.track.playing && r.track.listenedAt === null'
check "Brainz current: spinning" has lbmusic 'data-spin=""'
check "Brainz current: fixture credit" has lbmusic 'Track details from ListenBrainz (CC0)'
check "Brainz current: public profile" has lbmusic 'href="https://listenbrainz.org/user/Fixture%20Owner/"'
lb_case "Brainz last" '{"lbNow":"empty"}' 'r.track.title === "Fixture Last Track" && !r.track.playing && r.track.listenedAt === new Date(1793066523000).toISOString()'
check "Brainz last: full UTC date and time" has lbmusic "$(node -e 'const d=new Date(1793066523000).toISOString();console.log(d.slice(0,10)+" · "+d.slice(11,19)+" UTC")')"
check "Brainz last: stationary" not_in_shelf lbmusic 'data-spin'
lb_case "Brainz old last" '{"lbNow":"empty","lbLast":"old"}' 'r.track.listenedAt === "2000-01-01T00:00:00.000Z" && !r.track.playing'
check "Brainz old: dated honestly" has lbmusic '2000-01-01 · 00:00:00 UTC'
lb_case "Brainz empty" '{"lbNow":"empty","lbLast":"empty"}' 'r.music.state === "fixture" && r.track === null'
lb_case "Brainz 404" '{"lbNow":"404","lbLast":"404"}' 'r.music.state === "quiet" && r.track === null && r.spotify === "spotify-off"'
lb_case "Brainz rate limit" '{"lbNow":"429","lbLast":"429"}' 'r.music.state === "quiet" && r.track === null'
lb_case "Brainz challenge" '{"lbNow":"html","lbLast":"html"}' 'r.music.state === "quiet" && r.track === null'
lb_case "Brainz malformed JSON" '{"lbNow":"bad-json","lbLast":"bad-json"}' 'r.music.state === "quiet" && r.track === null'
lb_case "Brainz error envelope" '{"lbNow":"error","lbLast":"error"}' 'r.music.state === "quiet" && r.track === null'
lb_case "Brainz redirects" '{"lbNow":"redirect","lbLast":"redirect"}' 'r.music.state === "quiet" && r.track === null'
lb_case "Brainz one endpoint failure" '{"lbNow":"500"}' 'r.track.title === "Fixture Last Track" && !r.track.playing'
lb_case "Brainz current wins broken last" '{"lbLast":"429"}' 'r.track.title === "Fixture Brainz Track" && r.track.playing'
lb_case "Brainz unsafe URL" '{"lbNow":"unsafe"}' 'r.track.url === null && r.track.playing'
check "Brainz unsafe URL: profile fallback" has lbmusic 'href="https://listenbrainz.org/user/Fixture%20Owner/"'
check "Brainz unsafe URL: evil absent" not_in_shelf lbmusic 'evil.example'
lb_case "Brainz timeout" '{"lbNow":"slow","lbLast":"slow"}' 'r.music.state === "quiet" && r.track === null'
check "Brainz timeout: one four-second budget" timed_between lb 3.5 6.5
check "Brainz: headers and username checked by fake" no_bad_auth
check "Brainz: no secret in HTTP responses" no_sentinel "$WORK"/*.body
check "Brainz: fetched every referenced client chunk" chunks lbmusic
check "Brainz: no secret in client chunks or log" no_sentinel "$WORK"/chunks/*.js "$WORK/server.log"
check "Brainz: mismatched selected source is caught" fails same_read api1 lbmusic
stop_server
# Invalid public identity does not request the endpoint; legacy selection remains available.
start_server "${HOSTS[@]}" LISTENBRAINZ_USER='../invalid' NOW_PLAYING_LISTENBRAINZ_HOST="http://127.0.0.1:$FAKE_LISTENBRAINZ_PORT"
wait_ready
mark
lb_before_invalid="$(grep -c '^listenbrainz ' "$FAKE_DIR/requests.log")"
get invalid /api/now-playing
check "invalid identity: off, no account selected" json_is invalid 'r.music.source === null && r.music.state === "off" && r.track === null'
check "invalid identity: no provider requests" delta 0 0 0
check "invalid identity: no public endpoint requests" test "$(grep -c '^listenbrainz ' "$FAKE_DIR/requests.log")" -eq "$lb_before_invalid"
stop_server

# --- Selected public Lanyard games; Steam credentials are present but never read ---
start_server "${CREDS[@]}" "${HOSTS[@]}" "${CLOCK_ENV[@]}" LISTENBRAINZ_USER="Fixture Owner" NOW_PLAYING_LISTENBRAINZ_HOST="http://127.0.0.1:$FAKE_LISTENBRAINZ_PORT" LANYARD_USER_ID="123456789012345678" NOW_PLAYING_LANYARD_HOST="http://127.0.0.1:$FAKE_LANYARD_PORT"
wait_ready
ly_case() {
  set_mode "$2"
  advance
  local before after
  before="$(calls lanyard)"
  mark
  get ly /api/now-playing
  check "$1: HTTP 200" status_is ly 200
  check "$1: Lanyard reading" json_is ly "r.play.source === \"lanyard\" && r.steam === \"steam-off\" && ($3)"
  check "$1: sanitized shape" exact_keys ly
  check "$1: Spotify and Steam unasked" delta 0 0 0
  after="$(calls lanyard)"
  check "$1: one public request, no retry" test "$((after - before))" -eq 1
  get lymusic /music
  check "$1: shared cached API/page game and source" same_read ly lymusic
  check "$1: page uses cache" test "$(calls lanyard)" -eq "$after"
  shelf lymusic >/dev/null
  check "$1: official Lanyard credit link" in_shelf lymusic 'href="https://github.com/Phineas/lanyard"'
  check "$1: credited Lanyard" in_shelf lymusic 'game presence from Lanyard / Discord'
  check "$1: no invented store or Discord profile link" not_in_shelf lymusic 'href="https://store.steampowered.com'
}
ly_case "Lanyard game" '{}' 'r.play.state === "fixture" && r.game.title === "Fixture Lanyard Game" && r.game.url === null && r.track.title === "Fixture Brainz Track"'
for mode in empty spotify invalidActivities; do
  ly_case "Lanyard $mode" "{\"lanyard\":\"$mode\"}" 'r.play.state === "fixture" && r.game === null && r.track.title === "Fixture Brainz Track"'
  check "Lanyard $mode: static Now-list fallback" in_shelf lymusic "$STATIC_GAME"
done
ly_case "Lanyard long" '{"lanyard":"long"}' 'r.play.state === "fixture" && [...r.game.title].length === 48 && r.game.title.endsWith("…") && !/\p{Cc}/u.test(r.game.title)'
for mode in unknown malformed bad-json html 429 500 redirect slow; do
  ly_case "Lanyard $mode" "{\"lanyard\":\"$mode\"}" 'r.play.state === "quiet" && r.game === null && r.track.title === "Fixture Brainz Track"'
  if [ "$mode" = slow ]; then check "Lanyard timeout: four-second abort" timed_between ly 3.5 6.5; fi
done
ly_case "Lanyard survives music failure" '{"lbNow":"429","lbLast":"html"}' 'r.music.state === "quiet" && r.track === null && r.play.state === "fixture" && r.game.title === "Fixture Lanyard Game"'
node -e 'const fs=require("fs"); const r=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));r.play.source="steam";fs.writeFileSync(process.argv[2],JSON.stringify(r));' "$WORK/ly.body" "$WORK/wrong-play.body"
check "Lanyard: wrong game provider alone is caught" fails same_read wrong-play lymusic
check "Lanyard: headers and identity checked by fake" no_bad_auth
check "Lanyard: no secrets or Discord identifiers in HTTP responses" no_sentinel "$WORK"/*.body
check "Lanyard: all referenced chunks fetched" chunks lymusic
check "Lanyard: no sentinel in chunks or logs" no_sentinel "$WORK"/chunks/*.js "$WORK/server.log"
stop_server
for identity in '' 'invalid' '1234567890123456' '123456789012345678901'; do
  start_server LANYARD_USER_ID="$identity" NOW_PLAYING_LANYARD_HOST="http://127.0.0.1:$FAKE_LANYARD_PORT"
  wait_ready
  before_invalid="$(calls lanyard)"
  get lyinvalid /api/now-playing
  check "Lanyard missing/invalid identity: off" json_is lyinvalid 'r.play.source === null && r.play.state === "off" && r.game === null'
  check "Lanyard missing/invalid identity: no request" test "$(calls lanyard)" -eq "$before_invalid"
  stop_server
done

fi

echo "walk: $OK ok, $FAILED failed"
[ "$FAILED" -eq 0 ]
