#!/usr/bin/env bash
# Probe Music's Now playing shelf in headless Chromium, one "ok -" / "not ok -" line per check.
#
#   bash scripts/probe-cassette.sh                                  # build + next start on :4125, probe it
#   SKIP_BUILD=1 PORT=4126 bash scripts/probe-cassette.sh           # reuse an existing .next build
#   SHOTS_DIR=/tmp/cassette bash scripts/probe-cassette.sh          # also keep screenshots to look at (never commit)
#
# The quiet pass serves the build with every provider variable unset (FACE=quiet in probe-cassette.mjs): at
# 1366x768 and 390x844 touch, light and dark, the labels fit with no sideways scroll, their text and the credit
# are at least 4.5:1, links are at least 24 px tall and labels filled to the parsers' caps keep their reserved
# height; the reels turn only for a playing tape and stand still under reduced motion, at load and switched on
# mid-play; Tab reaches the cassette's link with a visible ring in both themes; with JavaScript off the shelf is
# whole. Negative controls: an unbroken label overflows, grey text fails contrast, a tape not playing is still.
#
# The live pass (FACE=live) serves the same build against loopback fakes (node scripts/probe-cassette.mjs fake)
# answering the longest track and game the parsers let through, the track playing, with throwaway sentinel
# credentials: the same matrix on the fixture labels, the reels turning until reduced motion stops them, the fixture
# reading in the JavaScript-off HTML, and no sentinel in any response the browser received (HTML, RSC, scripts,
# styles). The fakes are a stand-in for Spotify and Steam: nothing here proves a real account works.
#
# Env: PORT (4125, or a free port when that default is busy), FAKE_PORT (4135; the fakes use it and the next two),
# SKIP_BUILD=1, SHOTS_DIR.
# Local only: the server is started here. Playwright is installed into a temp prefix at run time; package.json
# stays unchanged. No `set -e`: every check runs, and the summary names the ones that failed.
set -u

cd "$(dirname "$0")/.." || exit 2
ROOT="$(pwd)"

PORT_SET="${PORT:+1}"
PORT="${PORT:-4125}"
WORK="$(mktemp -d "${TMPDIR:-/tmp}/probe-cassette.XXXXXX")"
SERVER_PID=""
FAKE_PID=""
FAKE_DIR="$WORK/fake"
FAKE_PORT="${FAKE_PORT:-4135}"
FAILED=0

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

BASE_URL="http://localhost:$PORT"
export BETTER_AUTH_SECRET="${BETTER_AUTH_SECRET:-ci-placeholder-not-a-real-secret-0123456789abcdef}"
export BETTER_AUTH_URL="${BETTER_AUTH_URL:-http://localhost:$PORT}"
export DATABASE_URL="${DATABASE_URL:-postgresql://otohime:otohime@127.0.0.1:9/otohime}"
export GITHUB_SHA="${GITHUB_SHA:-0123456789abcdef0123456789abcdef01234567}"

# A busy default port (another probe on a shared host) falls back to a free one; an explicit PORT is refused.
if curl -s -o /dev/null --max-time 2 "$BASE_URL/"; then
  if [ -n "$PORT_SET" ]; then
    echo "not ok - port: something already listens on port $PORT; set PORT to a free port"
    exit 1
  fi
  FREE="$(node -e 'const s=require("net").createServer().listen(0,"127.0.0.1",()=>{console.log(s.address().port);s.close()})')"
  echo "note: default port $PORT is busy; serving on free port $FREE instead"
  [ "$BETTER_AUTH_URL" = "$BASE_URL" ] && export BETTER_AUTH_URL="http://localhost:$FREE"
  PORT="$FREE"
  BASE_URL="http://localhost:$PORT"
fi

if [ "${SKIP_BUILD:-}" != "1" ]; then
  if ! npm run build >"$WORK/build.log" 2>&1; then
    echo "not ok - build: npm run build failed; log:"
    cat "$WORK/build.log"
    exit 1
  fi
fi

PROVIDER_VARS="LANYARD_USER_ID NOW_PLAYING_LANYARD_HOST LISTENBRAINZ_USER NOW_PLAYING_LISTENBRAINZ_HOST SPOTIFY_CLIENT_ID SPOTIFY_CLIENT_SECRET SPOTIFY_REFRESH_TOKEN STEAM_API_KEY STEAM_ID NOW_PLAYING_SPOTIFY_ACCOUNTS_HOST NOW_PLAYING_SPOTIFY_API_HOST NOW_PLAYING_STEAM_HOST"

# start_server [VAR=value...]: next start with every provider variable unset, then the given ones set; waits for it.
start_server() {
  local unset_args=() v ready=0
  for v in $PROVIDER_VARS; do unset_args+=(-u "$v"); done
  set -m
  env "${unset_args[@]}" "$@" ./node_modules/.bin/next start -p "$PORT" >"$WORK/server.log" 2>&1 &
  SERVER_PID=$!
  set +m
  for _ in $(seq 1 60); do
    if curl -s -o /dev/null --max-time 5 "$BASE_URL/"; then
      ready=1
      break
    fi
    sleep 1
  done
  if [ "$ready" -ne 1 ] || ! kill -0 "$SERVER_PID" 2>/dev/null; then
    echo "not ok - ready: our next start on port $PORT did not answer; log:"
    tail -n 20 "$WORK/server.log"
    return 1
  fi
}

PW="$WORK/playwright"
mkdir -p "$PW"
if ! npm i --prefix "$PW" --no-audit --no-fund --silent playwright@1.64.0 >"$WORK/npm.log" 2>&1; then
  echo "not ok - playwright: npm i playwright failed; log:"
  tail -n 20 "$WORK/npm.log"
  exit 1
fi
if ! "$PW/node_modules/.bin/playwright" install chromium --only-shell >"$WORK/browser.log" 2>&1; then
  echo "not ok - playwright: install chromium --only-shell failed; log:"
  tail -n 20 "$WORK/browser.log"
  exit 1
fi

# probe <face> [SENTINELS]: run probe-cassette.mjs against the server that is up.
probe() {
  echo "# FACE=$1"
  BASE_URL="$BASE_URL" PW_PREFIX="$PW" FACE="$1" SENTINELS="${2:-}" SHOTS_DIR="${SHOTS_DIR:+$SHOTS_DIR/$1}" \
    node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON "$ROOT/scripts/probe-cassette.mjs" ||
    FAILED=$((FAILED + 1))
}

# --- Quiet: nothing configured ------------------------------------------------------------------------------------
if start_server; then
  probe quiet
else
  FAILED=$((FAILED + 1))
fi
kill_group "$SERVER_PID"
SERVER_PID=""

# --- Live: the fakes, with the longest labels and the track playing ------------------------------------------------
RUN_ID="$(node -e 'console.log(require("crypto").randomBytes(8).toString("hex"))')"
CREDS=(SPOTIFY_CLIENT_ID="SentinelId$RUN_ID" SPOTIFY_CLIENT_SECRET="SentinelSecret$RUN_ID" SPOTIFY_REFRESH_TOKEN="Sentinel-Refresh_$RUN_ID" STEAM_API_KEY="SentinelSteamKey$RUN_ID" STEAM_ID="76561197960435530")
SENTINELS="SentinelId$RUN_ID,SentinelSecret$RUN_ID,Sentinel-Refresh_$RUN_ID,SentinelSteamKey$RUN_ID,76561197960435530,FakeAccessToken0123456789abcdef"
mkdir -p "$FAKE_DIR"
printf '{"track":"long","steam":"long"}' >"$FAKE_DIR/mode.json"
set -m
env "${CREDS[@]}" FAKE_DIR="$FAKE_DIR" FAKE_TOKEN_PORT="$FAKE_PORT" FAKE_API_PORT="$((FAKE_PORT + 1))" FAKE_STEAM_PORT="$((FAKE_PORT + 2))" \
  node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON \
  "$ROOT/scripts/probe-cassette.mjs" fake >"$WORK/fake.log" 2>&1 &
FAKE_PID=$!
set +m
for _ in $(seq 1 50); do
  [ -f "$FAKE_DIR/ready" ] && break
  sleep 0.2
done
if [ ! -f "$FAKE_DIR/ready" ]; then
  echo "not ok - fakes: the loopback providers did not start (FAKE_PORT=$FAKE_PORT); log:"
  tail -n 20 "$WORK/fake.log"
  FAILED=$((FAILED + 1))
elif start_server "${CREDS[@]}" \
  NOW_PLAYING_SPOTIFY_ACCOUNTS_HOST="http://127.0.0.1:$FAKE_PORT" \
  NOW_PLAYING_SPOTIFY_API_HOST="http://127.0.0.1:$((FAKE_PORT + 1))" \
  NOW_PLAYING_STEAM_HOST="http://127.0.0.1:$((FAKE_PORT + 2))"; then
  probe live "$SENTINELS"
  if grep -q 'auth=bad' "$FAKE_DIR/requests.log"; then
    echo "not ok - fakes: a provider saw wrong credentials"
    FAILED=$((FAILED + 1))
  fi
  for s in ${SENTINELS//,/ }; do
    if grep -qF -- "$s" "$WORK/server.log"; then
      echo "not ok - server log: holds a sentinel"
      FAILED=$((FAILED + 1))
      break
    fi
  done
else
  FAILED=$((FAILED + 1))
fi

# --- Public music, both current and old last-listen faces in the full browser matrix ---
kill_group "$SERVER_PID"
SERVER_PID=""
for face in brainz last lanyard; do
  GAME_ENV=()
  if [ "$face" = lanyard ]; then
    GAME_ENV=(LANYARD_USER_ID="123456789012345678" NOW_PLAYING_LANYARD_HOST="http://127.0.0.1:$((FAKE_PORT + 4))")
  fi
  if [ "$face" = brainz ]; then
    printf '{"lbNow":"long","steam":"long"}' >"$FAKE_DIR/mode.json"
  elif [ "$face" = lanyard ]; then
    printf '{"lbNow":"long","lanyard":"long"}' >"$FAKE_DIR/mode.json"
  else
    printf '{"lbNow":"empty","lbLast":"old","steam":"long"}' >"$FAKE_DIR/mode.json"
  fi
  if start_server "${CREDS[@]}" "${GAME_ENV[@]}" LISTENBRAINZ_USER="Fixture Owner" \
    NOW_PLAYING_LISTENBRAINZ_HOST="http://127.0.0.1:$((FAKE_PORT + 3))" \
    NOW_PLAYING_SPOTIFY_ACCOUNTS_HOST="http://127.0.0.1:$FAKE_PORT" \
    NOW_PLAYING_SPOTIFY_API_HOST="http://127.0.0.1:$((FAKE_PORT + 1))" \
    NOW_PLAYING_STEAM_HOST="http://127.0.0.1:$((FAKE_PORT + 2))"; then
    probe "$face" "$SENTINELS,123456789012345678,PrivateFixtureName,PrivateFixtureAvatar,PrivateFixtureFriends"
  else
    FAILED=$((FAILED + 1))
  fi
  kill_group "$SERVER_PID"
  SERVER_PID=""
done

echo "probe-cassette: $FAILED failed pass(es)"
[ "$FAILED" -eq 0 ]
