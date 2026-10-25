#!/usr/bin/env bash
# Probe the Internet Save Point footer in headless Chromium, one "ok -" / "not ok -" line per check.
#
#   bash scripts/probe-end.sh                                  # build + next start on :4083, probe it
#   SKIP_BUILD=1 PORT=4083 bash scripts/probe-end.sh           # reuse an existing .next build
#   BASE_URL=https://otohime.dev bash scripts/probe-end.sh     # probe a deployed URL (read-only), no build or start
#
# Exercises the full browser verification matrix across 1366x768 (desktop), 768x1024 (tablet), and 390x844
# (touch mobile): all seven public pages, auth/404 and the eleven isolated project roots, canonical links and
# internal group transitions, /music television clear area, layout stability across reveal/poke/unlock/restore,
# SVG LCD text bounds in every state, light/dark contrast, five accents and displacement scale, mobile disclosure,
# once-per-mount scroll entry, offscreen and document-hidden pause, filter isolation, idle timer/rAF efficiency,
# reduced motion at load and toggled mid-press, mascot click/tap/Enter/Space, Konami sequence and exclusions,
# localStorage persistence and blocked-storage fallback, real Tab progression, Back to top scroll + main#main
# focus, no-JavaScript rendering and anchor fallback, and a failing-then-restored canonical-href negative control.
#
# Env: PORT (4083; a port Next reserves is bumped by 10), BASE_URL (remote mode), EXPECT_SHA, SKIP_BUILD=1.
# Playwright is installed into a temp prefix at run time; package.json stays unchanged.
set -u

cd "$(dirname "$0")/.." || exit 2
ROOT="$(pwd)"

PORT_SET="${PORT:+1}"
PORT="${PORT:-4083}"
case "$PORT" in
  1719|1720|1723|2049|3659|4045|5060|5061|6000|6566|6665|6666|6667|6668|6669|6697|10080)
    echo "note: next refuses port $PORT as reserved; serving on $((PORT + 10)) instead"
    PORT=$((PORT + 10))
    ;;
esac

# Keep TMPDIR short so Chromium's SingletonSocket stays within macOS's 104-byte sun_path limit.
export TMPDIR="${TMPDIR:-/tmp}"
if [ "${#TMPDIR}" -gt 48 ]; then
  export TMPDIR="/tmp"
fi

BASE_URL="${BASE_URL:-}"
EXPECT_SHA="${EXPECT_SHA:-}"
ANY_SHA_OR_DEV=""
WORK="$(mktemp -d "${TMPDIR:-/tmp}/probe-end.XXXXXX")"
SERVER_PID=""

cleanup() {
  if [ -n "$SERVER_PID" ]; then
    kill -TERM -- "-$SERVER_PID" 2>/dev/null
    for _ in 1 2 3 4 5 6 7 8 9 10; do
      kill -0 -- "-$SERVER_PID" 2>/dev/null || break
      sleep 0.5
    done
    kill -KILL -- "-$SERVER_PID" 2>/dev/null
  fi
  rm -rf "$WORK"
}
trap cleanup EXIT
trap 'exit 130' INT TERM

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
  [ -n "$ANY_SHA_OR_DEV" ] || EXPECT_SHA="${EXPECT_SHA:-$GITHUB_SHA}"
  READY_TRIES=60

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

  set -m
  ./node_modules/.bin/next start -p "$PORT" >"$WORK/server.log" 2>&1 &
  SERVER_PID=$!
  set +m
else
  LOCAL=0
  BASE_URL="${BASE_URL%/}"
  READY_TRIES=10
fi

READY=0
for _ in $(seq 1 "$READY_TRIES"); do
  if curl -s -o /dev/null --max-time 5 "$BASE_URL/"; then
    READY=1
    break
  fi
  sleep 1
done
if [ "$READY" -ne 1 ]; then
  echo "not ok - ready: nothing answered at $BASE_URL after $READY_TRIES tries"
  [ "$LOCAL" -eq 1 ] && [ -s "$WORK/server.log" ] && tail -n 20 "$WORK/server.log"
  echo "probe: 0 ok, 1 failed"
  exit 1
fi
# The answer must come from our own server, not one that won the port first.
if [ "$LOCAL" -eq 1 ] && ! kill -0 "$SERVER_PID" 2>/dev/null; then
  echo "not ok - ready: our next start on port $PORT exited; another server answered. log:"
  tail -n 20 "$WORK/server.log"
  echo "probe: 0 ok, 1 failed"
  exit 1
fi

PW="$WORK/playwright"
mkdir -p "$PW"
if ! npm i --prefix "$PW" --no-audit --no-fund --silent playwright@1.64.0 >"$WORK/npm.log" 2>&1; then
  echo "not ok - playwright: npm i playwright failed; log:"
  tail -n 20 "$WORK/npm.log"
  echo "probe: 0 ok, 1 failed"
  exit 1
fi
DEPS=""
[ -n "${CI:-}" ] && [ "$(uname)" = Linux ] && DEPS="--with-deps"
if ! "$PW/node_modules/.bin/playwright" install chromium --only-shell $DEPS >"$WORK/browser.log" 2>&1; then
  echo "not ok - playwright: install chromium --only-shell failed; log:"
  tail -n 20 "$WORK/browser.log"
  echo "probe: 0 ok, 1 failed"
  exit 1
fi

export BASE_URL PW_PREFIX="$PW" EXPECT_SHA ANY_SHA_OR_DEV PROBE_LOCAL="$LOCAL" SERVER_LOG="$WORK/server.log"
node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON "$ROOT/scripts/probe-end.mjs"
