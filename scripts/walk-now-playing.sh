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
# and Ink Radio as before, with no owner tools for a visitor.
#
# Env: PORT (4121), BASE_URL (read-only mode), EXPECT_SHA (build-sha to expect; defaults to GITHUB_SHA locally,
# any 40-hex sha remotely; with SKIP_BUILD=1 and neither set, a 40-hex sha or "dev" passes), SKIP_BUILD=1,
# QUIET_ONLY=1. Counts use grep -c and numeric tests only: BSD wc pads its output. Things are counted by attribute
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
PROVIDER_VARS="SPOTIFY_CLIENT_ID SPOTIFY_CLIENT_SECRET SPOTIFY_REFRESH_TOKEN STEAM_API_KEY STEAM_ID NOW_PLAYING_SPOTIFY_ACCOUNTS_HOST NOW_PLAYING_SPOTIFY_API_HOST NOW_PLAYING_STEAM_HOST"

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

  if [ "${SKIP_BUILD:-}" != "1" ]; then
    if ! npm run build >"$WORK/build.log" 2>&1; then
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
check "music: listings still there" has music '>Listings</h2>'
check "music: Ink Radio still there" has music 'id="ink-radio"'
check "music: no owner tools for a visitor" lacks music 'Add a channel'

echo "walk: $OK ok, $FAILED failed"
[ "$FAILED" -eq 0 ]
